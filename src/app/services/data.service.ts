import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, forkJoin, map, combineLatest } from "rxjs";
import * as Papa from "papaparse";
import {
  Lancamento,
  Recebimento,
  ProjetoResumo,
  CategoriaResumo,
  FluxoMensal,
  RecursoResumo,
  RecursoDetalhado,
  StatusProjeto,
  SaldoRemanescente,
  Rendimento,
  CategoriaGlossario,
  CategoriaNormalizada,
} from "../models/lancamento.model";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class DataService {
  private lancamentosSubject = new BehaviorSubject<Lancamento[]>([]);
  private recebimentosSubject = new BehaviorSubject<Recebimento[]>([]);
  private statusSubject = new BehaviorSubject<StatusProjeto[]>([]);
  private saldosSubject = new BehaviorSubject<SaldoRemanescente[]>([]);
  private rendimentosSubject = new BehaviorSubject<Rendimento[]>([]);
  private glossarioSubject = new BehaviorSubject<CategoriaGlossario[]>([]);

  lancamentos$ = this.lancamentosSubject.asObservable();
  recebimentos$ = this.recebimentosSubject.asObservable();
  status$ = this.statusSubject.asObservable();
  saldos$ = this.saldosSubject.asObservable();
  rendimentos$ = this.rendimentosSubject.asObservable();
  glossario$ = this.glossarioSubject.asObservable();

  // Metas financeiras
  readonly META_APORTE = 3023000;
  readonly META_CAPTACAO = 17550525;
  readonly META_TOTAL = this.META_APORTE + this.META_CAPTACAO;

  private readonly SHEET_BASE = environment.googleSheetsBaseUrl;
  private readonly SHEET_PRINCIPAL = this.SHEET_BASE + "&gid=0";
  private readonly SHEET_RECEBIMENTOS = this.SHEET_BASE + "&gid=595659211";
  private readonly SHEET_STATUS_PROJETOS = this.SHEET_BASE + "&gid=1699326950";
  private readonly SHEET_SALDOS = this.SHEET_BASE + "&gid=86178020";
  private readonly SHEET_RENDIMENTOS = this.SHEET_BASE + "&gid=2032068393";
  private readonly SHEET_GLOSSARIO = this.SHEET_BASE + "&gid=806545379";

  /** Categoria de entrada: não é item de despesa, não entra no Glossário. */
  static readonly CODIGO_RECEITA = "0.0.0";

  /**
   * Categorias descontinuadas remapeadas para o código oficial.
   * Decisão registrada em 13/09/2026: "1.1.9 Tarifas" existia só para controle
   * interno, não consta do Plano de Trabalho nem do Transferegov. Os lançamentos
   * passam a ser lidos como 1.1.8 Impostos; o texto original é preservado em
   * `observacaoAuditoria` e a planilha não é alterada.
   */
  private readonly REMAPEAMENTO: Record<string, { para: string; motivo: string }> = {
    "1.1.9 tarifas": {
      para: "1.1.8",
      motivo: "Tarifa bancária — categoria interna 1.1.9 descontinuada, remapeada para 1.1.8 Impostos",
    },
  };

  constructor(private http: HttpClient) {
    this.carregarDados();
  }

  private carregarDados(): void {
    forkJoin({
      principal: this.http.get(this.SHEET_PRINCIPAL, { responseType: "text" }),
      recebimentos: this.http.get(this.SHEET_RECEBIMENTOS, { responseType: "text" }),
      status: this.http.get(this.SHEET_STATUS_PROJETOS, { responseType: "text" }),
      saldos: this.http.get(this.SHEET_SALDOS, { responseType: "text" }),
      rendimentos: this.http.get(this.SHEET_RENDIMENTOS, { responseType: "text" }),
      glossario: this.http.get(this.SHEET_GLOSSARIO, { responseType: "text" }),
    }).subscribe({
      next: ({ principal, recebimentos, status, saldos, rendimentos, glossario }) => {
        // Glossário primeiro: a normalização de categorias depende dele.
        this.parseGlossario(glossario);
        this.parsePrincipal(principal);
        this.parseRecebimentos(recebimentos);
        this.parseStatusProjetos(status);
        this.parseSaldos(saldos);
        this.parseRendimentos(rendimentos);
      },
      error: (err) => {
        console.error("Erro ao carregar dados do Google Sheets:", err);
      }
    });
  }

  private parsePrincipal(csvText: string): void {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];
    const lancamentos: Lancamento[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 11) continue;

      const numPag = (row[3] || "").trim();
      const fornecedor = (row[7] || "").trim(); // Coluna H
      const categoria = (row[8] || "").trim();
      const observacao = (row[9] || "").trim();
      const projeto = (row[10] || "").trim();
      let mesAno = (row[11] || "").trim();
      // Column 11 is a formula in Sheets that can produce errors (#VALOR!) → empty in CSV export.
      // Fall back to deriving MM/YYYY from the raw date column (col 2, format DD/MM/YYYY).
      if (!mesAno || !mesAno.includes('/') || mesAno.startsWith('#')) {
        const parts = (row[2] || "").trim().split('/');
        if (parts.length === 3) mesAno = `${parts[1]}/${parts[2]}`;
      }
      const valorStr = (row[12] || row[4] || "").trim(); // Tenta coluna 12, se não, usa a 4
      const valor = this.parseValor(valorStr);

      if (categoria || projeto) {
        lancamentos.push({ fornecedor, categoria, observacao, projeto, mesAno, valor, numPag });
      }
    }

    this.lancamentosSubject.next(lancamentos);
  }

  private parseRecebimentos(csvText: string): void {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];
    const recebimentos: Recebimento[] = [];

    // Colunas: entrada/saída(0), tipo de recurso(1), data(2), valor(3), status(4),
    //          fornecedor(5), categoria(6), observação(7), projeto(8), data(9), valor(10), observação 2(11)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 11) continue;

      const tipoRecurso = (row[1] || "").trim();
      const data = (row[2] || "").trim();
      const valorStr = (row[10] || "").trim();
      const status = (row[4] || "").trim().toLowerCase();
      const fornecedor = (row[5] || "").trim();
      const categoria = (row[6] || "").trim();
      const observacao = (row[7] || "").trim();
      const projeto = (row[8] || "").trim();
      const mesAno = (row[9] || "").trim();
      const observacao2 = (row[11] || "").trim().toLowerCase();
      const valor = this.parseValor(valorStr);

      recebimentos.push({
        tipoRecurso, data, valor, status, fornecedor,
        categoria, observacao, projeto, mesAno, observacao2,
      });
    }

    this.recebimentosSubject.next(recebimentos);
  }

  private parseStatusProjetos(csvText: string): void {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];
    const statusProjetos: StatusProjeto[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) continue;
        const projeto = (row[0] || "").trim();
        let status = (row[1] || "").trim();
        // Remove all emojis and leading special characters
        status = status.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').replace(/^[^\wÀ-ÿ]+/g, '').trim();
        if (projeto) {
            statusProjetos.push({ projeto, status });
        }
    }
    this.statusSubject.next(statusProjetos);
  }

  private parseSaldos(csvText: string): void {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];
    const saldos: SaldoRemanescente[] = [];

    // Colunas: data(0), parceiro(1), descrição/projeto(2), valor transferido(3), valor projeto(4)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 5) continue;

      const data = (row[0] || "").trim();
      const parceiro = (row[1] || "").trim();
      const projeto = (row[2] || "").trim();
      const valorTransferido = this.parseValor(row[3]);
      const valorProjeto = this.parseValor(row[4]);
      const percentualSobra = valorProjeto > 0 ? (valorTransferido / valorProjeto) * 100 : 0;

      if (projeto || parceiro) {
        saldos.push({ data, parceiro, projeto, valorTransferido, valorProjeto, percentualSobra });
      }
    }

    this.saldosSubject.next(saldos);
  }

  // ===== GLOSSÁRIO DE CATEGORIAS ORÇAMENTÁRIAS =====
  /**
   * Aba "Glossário de Categorias" (gid 806545379).
   * Colunas: Meta(0) · Etapa(1) · Item de despesa(2) · Descrição(3).
   * Meta e Etapa só aparecem na primeira linha de cada bloco — são propagadas
   * para baixo, como numa planilha com células mescladas.
   */
  private parseGlossario(csvText: string): void {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];
    const itens: CategoriaGlossario[] = [];

    let cabecalhoVisto = false;
    let metaAtual = "";
    let etapaAtual = "";

    for (const row of rows) {
      if (row.length < 3) continue;
      const c0 = (row[0] || "").trim();
      const item = (row[2] || "").trim();

      if (!cabecalhoVisto) {
        if (c0.toLowerCase() === "meta") cabecalhoVisto = true;
        continue;
      }
      if (c0) metaAtual = c0;
      if ((row[1] || "").trim()) etapaAtual = (row[1] || "").trim();
      if (!item) continue;

      const m = item.match(/^([\d.]+?)\.?\s+(.*)$/);
      if (!m) continue;

      itens.push({
        codigo: m[1],
        nome: m[2].trim(),
        rotulo: item,
        meta: metaAtual,
        etapa: etapaAtual,
        descricao: (row[3] || "").trim(),
      });
    }

    this.glossarioSubject.next(itens);
    this.glossarioPorCodigo.clear();
    itens.forEach(i => this.glossarioPorCodigo.set(i.codigo, i));
  }

  private glossarioPorCodigo = new Map<string, CategoriaGlossario>();

  /**
   * Resolve uma categoria bruta da planilha contra o Glossário oficial.
   *
   * O cruzamento é feito pelo CÓDIGO, nunca pelo texto: o código é estável e o
   * texto varia em caixa, plural e pontuação. A planilha não é alterada —
   * `original` guarda o lançamento como foi escrito.
   */
  normalizarCategoria(bruta: string): CategoriaNormalizada {
    const original = (bruta || "").trim();
    const m = original.match(/^([\d.]+?)\.?\s+(.*)$/);

    if (!m) {
      return { original, codigo: "", oficial: null, rotulo: original,
               natureza: "despesa", mapeado: false };
    }

    let codigo = m[1];
    let observacaoAuditoria: string | undefined;

    // 0.0.0 Recurso é entrada, não item de despesa: fora do Glossário por decisão.
    if (codigo === DataService.CODIGO_RECEITA) {
      return { original, codigo, oficial: null, rotulo: original,
               natureza: "receita", mapeado: true };
    }

    const remap = this.REMAPEAMENTO[original.toLowerCase()];
    if (remap) {
      codigo = remap.para;
      observacaoAuditoria = remap.motivo;
    }

    const oficial = this.glossarioPorCodigo.get(codigo) ?? null;
    return {
      original,
      codigo,
      oficial,
      rotulo: oficial ? oficial.rotulo : original,
      natureza: "despesa",
      mapeado: !!oficial,
      observacaoAuditoria,
    };
  }

  getGlossario(): Observable<CategoriaGlossario[]> {
    return this.glossario$;
  }

  /**
   * Descrição oficial para uso como tooltip em gráficos e tabelas.
   * Aceita tanto o rótulo bruto da planilha ("3.3.1 Serviço de Comunicação")
   * quanto só o nome oficial ("Serviços de comunicação").
   */
  descricaoCategoria(rotuloOuNome: string): string {
    const alvo = (rotuloOuNome || "").trim();
    if (!alvo) return "";

    const n = this.normalizarCategoria(alvo);
    if (n.oficial) return n.oficial.descricao;

    // Sem código: procura pelo nome oficial, ignorando caixa e acento.
    const chave = this.semAcento(alvo);
    for (const item of this.glossarioPorCodigo.values()) {
      if (this.semAcento(item.nome) === chave) return item.descricao;
    }
    return "";
  }

  private semAcento(s: string): string {
    return (s || "").toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/\.$/, "").trim();
  }

  /** Categorias em uso na base que não encontraram correspondência no Glossário. */
  getCategoriasNaoMapeadas(): Observable<{ categoria: string; ocorrencias: number }[]> {
    return combineLatest({ lancs: this.lancamentos$, gloss: this.glossario$ }).pipe(
      map(({ lancs, gloss }) => {
        if (!gloss.length) return [];
        const contagem = new Map<string, number>();
        lancs.forEach(l => {
          if (!l.categoria) return;
          const n = this.normalizarCategoria(l.categoria);
          if (n.natureza === "receita" || n.mapeado) return;
          contagem.set(l.categoria, (contagem.get(l.categoria) ?? 0) + 1);
        });
        return Array.from(contagem.entries())
          .map(([categoria, ocorrencias]) => ({ categoria, ocorrencias }))
          .sort((a, b) => b.ocorrencias - a.ocorrencias);
      })
    );
  }

  /** Ordenação natural por código: 1.1.2 antes de 1.1.10. */
  static compararCodigo(a: string, b: string): number {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  private parseValor(valorStr: string): number {
    if (!valorStr) return 0;
    let isNegative = false;
    let cleanStr = valorStr.replace(/"/g, "").trim();

    if (cleanStr.startsWith("(") && cleanStr.endsWith(")")) {
      isNegative = true;
      cleanStr = cleanStr.slice(1, -1);
    }

    cleanStr = cleanStr.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  }

  // ===== RECURSOS (baseado na aba Recebimentos) =====
  getRecursos(): Observable<RecursoResumo[]> {
    return this.recebimentos$.pipe(
      map((recs) => {
        let totalAporte = 0;
        let totalCaptacao = 0;

        recs.forEach((r) => {
          const obs = r.observacao.toLowerCase();
          if (obs.includes("aporte")) {
            totalAporte += r.valor;
          } else if (obs.includes("captação") || obs.includes("captacao")) {
            totalCaptacao += r.valor;
          }
        });

        const total = totalAporte + totalCaptacao;
        return [
          {
            tipo: "Aporte da Enap",
            total: totalAporte,
            percentual: total > 0 ? (totalAporte / total) * 100 : 0,
          },
          {
            tipo: "Captação",
            total: totalCaptacao,
            percentual: total > 0 ? (totalCaptacao / total) * 100 : 0,
          },
        ];
      })
    );
  }

  getRecursoDetalhado(): Observable<RecursoDetalhado> {
    return this.recebimentos$.pipe(
      map((recs) => {
        let aporteRecebido = 0;
        let aporteInflacao = 0;
        let aportePrevisto = 0;
        let captacaoRecebida = 0;
        let captacaoPrevista = 0;

        recs.forEach((r) => {
          const obs = r.observacao.toLowerCase();
          const isAporte = obs.includes("aporte");
          const isCaptacao = obs.includes("captação") || obs.includes("captacao");
          const isInflacao = r.observacao2.includes("inflação") || r.observacao2.includes("inflacao");

          if (isAporte) {
            if (isInflacao) {
              aporteInflacao += r.valor;
            } else if (r.status === "recebido") {
              aporteRecebido += r.valor;
            } else if (r.status === "previsto") {
              aportePrevisto += r.valor;
            }
          } else if (isCaptacao) {
            if (r.status === "recebido") {
              captacaoRecebida += r.valor;
            } else if (r.status === "previsto") {
              captacaoPrevista += r.valor;
            }
          }
        });

        const captacaoTotalPresente = captacaoRecebida + captacaoPrevista;
        const saldoACaptar = Math.max(0, this.META_CAPTACAO - captacaoTotalPresente);
        const captacaoTotal = captacaoTotalPresente + saldoACaptar;

        // Correção pelo IPCA: entrou no caixa, então soma ao total recebido da
        // Enap — mas não abate a meta original de aporte. Os dois números ficam
        // separados para que a tela possa exibir a composição.
        const totalRecebidoEnap = aporteRecebido + aporteInflacao;

        return {
          aporteRecebido,
          aporteInflacao,
          aporteRecebidoTotal: totalRecebidoEnap,
          totalRecebidoEnap,
          aportePrevisto,
          captacaoRecebida,
          captacaoPrevista,
          captacaoTotal,
          saldoACaptar,
          totalRecebido: totalRecebidoEnap + captacaoRecebida,
          totalComPrevisto: this.META_TOTAL,
        };
      })
    );
  }

  getRecebimentosDetalhados(): Observable<Recebimento[]> {
    return this.recebimentos$;
  }

  getTotalRecebido(): Observable<number> {
    return this.lancamentos$.pipe(
      map((l) =>
        l
          .filter((x) => x.categoria === "0.0.0 Recurso")
          .reduce((sum, x) => sum + x.valor, 0)
      )
    );
  }

  // ===== PROJETOS =====
  getProjetoResumos(): Observable<ProjetoResumo[]> {
    return combineLatest({
      lancs: this.lancamentos$,
      status: this.status$,
      saldos: this.saldos$,
    }).pipe(
      map(({ lancs, status, saldos }) => {
        const porProjeto = new Map<string, { entradas: number; saidas: number; remanescente: number }>();

        lancs.forEach((l: Lancamento) => {
          if (!l.projeto) return;
          if (!porProjeto.has(l.projeto)) {
            porProjeto.set(l.projeto, { entradas: 0, saidas: 0, remanescente: 0 });
          }
          const p = porProjeto.get(l.projeto)!;
          if (l.valor >= 0) {
            p.entradas += l.valor;
          } else {
            p.saidas += Math.abs(l.valor);
          }
        });

        // Somar saldos remanescentes recuperados da nova aba
        saldos.forEach((s) => {
          if (!s.projeto) return;
          if (!porProjeto.has(s.projeto)) {
             porProjeto.set(s.projeto, { entradas: 0, saidas: 0, remanescente: 0 });
          }
          porProjeto.get(s.projeto)!.remanescente += s.valorTransferido;
        });

        return Array.from(porProjeto.entries())
          .map(([projeto, data]) => {
            const statusInfo = status.find((s: StatusProjeto) => s.projeto === projeto);
            return {
              projeto,
              entradas: data.entradas,
              saidas: data.saidas,
              saldo: data.entradas - data.saidas,
              execucao: data.entradas > 0 ? (data.saidas / data.entradas) * 100 : 0,
              saldoRemanescente: data.remanescente,
              status: statusInfo ? statusInfo.status : "Ativo",
            };
          })
          .sort((a, b) => b.entradas - a.entradas);
      })
    );
  }

  getPrevistosPorProjeto(): Observable<Map<string, number>> {
    return this.recebimentos$.pipe(
      map((recs) => {
        const mapa = new Map<string, number>();
        recs
          .filter((r) => r.status === "previsto" && r.projeto)
          .forEach((r) => {
            mapa.set(r.projeto, (mapa.get(r.projeto) || 0) + r.valor);
          });
        return mapa;
      })
    );
  }

  getLancamentosPorProjeto(projeto: string): Observable<Lancamento[]> {
    return this.lancamentos$.pipe(
      map((l) => l.filter((x) => x.projeto === projeto))
    );
  }

  getProjetosUnicos(): Observable<string[]> {
    return this.lancamentos$.pipe(
      map((l) => [...new Set(l.map((x) => x.projeto).filter((p) => !!p))])
    );
  }

  // ===== CATEGORIAS =====
  /**
   * Despesas agregadas pela categoria OFICIAL do Glossário.
   *
   * O agrupamento é pelo código, então variações de grafia da planilha
   * ("Serviço de Avaliação" / "Serviços de avaliação") caem na mesma linha em
   * vez de virarem duas. Entradas (0.0.0) ficam de fora por decisão registrada.
   */
  getCategoriaResumos(): Observable<CategoriaResumo[]> {
    return combineLatest({ lancs: this.lancamentos$, gloss: this.glossario$ }).pipe(
      map(({ lancs }) => {
        const porCodigo = new Map<string, { nome: string; total: number }>();

        lancs
          .filter((l) => l.categoria && l.valor < 0)
          .forEach((l) => {
            const n = this.normalizarCategoria(l.categoria);
            if (n.natureza === "receita") return;
            const chave = n.codigo || n.original;
            const nome = n.oficial ? n.oficial.nome : n.original.replace(/^[\d.]+\s*/, "").trim();
            const atual = porCodigo.get(chave) ?? { nome, total: 0 };
            atual.total += Math.abs(l.valor);
            porCodigo.set(chave, atual);
          });

        return Array.from(porCodigo.values())
          .map(({ nome, total }) => ({ categoria: nome, total }))
          .sort((a, b) => b.total - a.total);
      })
    );
  }

  // ===== FLUXO DE CAIXA =====
  getFluxoMensal(): Observable<FluxoMensal[]> {
    return this.lancamentos$.pipe(
      map((lancs) => {
        const porMes = new Map<string, { entradas: number; saidas: number }>();

        lancs.forEach((l) => {
          if (!l.mesAno) return;
          if (!porMes.has(l.mesAno)) {
            porMes.set(l.mesAno, { entradas: 0, saidas: 0 });
          }
          const m = porMes.get(l.mesAno)!;
          if (l.valor >= 0) {
            m.entradas += l.valor;
          } else {
            m.saidas += Math.abs(l.valor);
          }
        });

        const sorted = Array.from(porMes.entries()).sort((a, b) => {
          const [ma, ya] = a[0].split("/");
          const [mb, yb] = b[0].split("/");
          const dateA = parseInt(ya) * 100 + parseInt(ma);
          const dateB = parseInt(yb) * 100 + parseInt(mb);
          return dateA - dateB;
        });

        let acumulado = 0;
        return sorted.map(([mesAno, data]) => {
          acumulado += data.entradas - data.saidas;
          return {
            mesAno,
            entradas: data.entradas,
            saidas: data.saidas,
            saldoAcumulado: acumulado,
          };
        });
      })
    );
  }

  // ===== INDICADORES =====
  getIndicadoresOperacionais(): Observable<{
    totalRecebido: number;
    totalExecutado: number;
    saldoDisponivel: number;
    percentualExecucao: number;
    numPagamentos: number;
    ticketMedio: number;
  }> {
    return this.lancamentos$.pipe(
      map((lancs) => {
        const totalRecebido = lancs
          .filter((l) => l.categoria === "0.0.0 Recurso")
          .reduce((s, l) => s + l.valor, 0);

        const despesas = lancs.filter(
          (l) => l.categoria !== "0.0.0 Recurso" && l.valor < 0
        );
        const totalExecutado = despesas.reduce(
          (s, l) => s + Math.abs(l.valor),
          0
        );

        const numPagamentos = despesas.length;
        const ticketMedio = numPagamentos > 0 ? totalExecutado / numPagamentos : 0;

        return {
          totalRecebido,
          totalExecutado,
          saldoDisponivel: totalRecebido - totalExecutado,
          percentualExecucao:
            totalRecebido > 0 ? (totalExecutado / totalRecebido) * 100 : 0,
          numPagamentos,
          ticketMedio,
        };
      })
    );
  }

  // ===== NOVOS INDICADORES GESTÃO =====
  getRunway(): Observable<number> {
    return combineLatest({
      fluxo: this.getFluxoMensal(),
      inds: this.getIndicadoresOperacionais(),
    }).pipe(
      map(({ fluxo, inds }) => {
        if (fluxo.length === 0) return 0;
        const mediaSaidas = fluxo.reduce((sum: number, m: FluxoMensal) => sum + m.saidas, 0) / fluxo.length;
        return mediaSaidas > 0 ? inds.saldoDisponivel / mediaSaidas : 0;
      })
    );
  }

  getRecebimentosPorAno(): Observable<{ ano: string; previsto: number; recebido: number }[]> {
    return this.recebimentos$.pipe(
      map((recs) => {
        const mapa = new Map<string, { previsto: number; recebido: number }>();

        recs.forEach((r) => {
          if (!r.mesAno) return;
          const ano = r.mesAno.split("/")[1];
          if (!ano) return;
          if (!mapa.has(ano)) mapa.set(ano, { previsto: 0, recebido: 0 });
          const m = mapa.get(ano)!;
          if (r.status === "previsto") m.previsto += r.valor;
          else if (r.status === "recebido") m.recebido += r.valor;
        });

        return Array.from(mapa.entries())
          .map(([ano, d]) => ({ ano, previsto: d.previsto, recebido: d.recebido }))
          .sort((a, b) => a.ano.localeCompare(b.ano));
      })
    );
  }

  getAportesEnapPorAno(): Observable<{ ano: string; previsto: number; recebido: number }[]> {
    return this.recebimentos$.pipe(
      map((recs) => {
        const mapa = new Map<string, { previsto: number; recebido: number }>();

        recs.forEach((r) => {
          const obs = r.observacao.toLowerCase();
          if (!obs.includes("aporte")) return;

          // Usa observacao2 como fonte do ano (ex: "2023") conforme print da planilha
          const ano = r.observacao2 || r.mesAno.split("/")[1];
          if (!ano) return;

          if (!mapa.has(ano)) mapa.set(ano, { previsto: 0, recebido: 0 });
          const m = mapa.get(ano)!;
          if (r.status === "previsto") m.previsto += r.valor;
          else if (r.status === "recebido") m.recebido += r.valor;
        });

        return Array.from(mapa.entries())
          .map(([ano, d]) => ({ ano, previsto: d.previsto, recebido: d.recebido }))
          .sort((a, b) => a.ano.localeCompare(b.ano));
      })
    );
  }

  getGapCaptacao(): Observable<number> {
    return this.getRecursoDetalhado().pipe(
      map((d) => Math.max(0, this.META_CAPTACAO - d.captacaoRecebida))
    );
  }

  getRecebimentosPorFinanciador(): Observable<{ financiador: string; valor: number }[]> {
    return this.recebimentos$.pipe(
      map((recs) => {
        const mapa = new Map<string, number>();
        recs.forEach((r) => {
          // Exclui aportes: o quadro é de financiadores da captação externa.
          // A coluna "tipo de recurso" só contém Repasse/Contrapartida, então o
          // filtro precisa olhar a observação — era aqui que a Enap entrava
          // indevidamente como financiadora (achado F-15).
          if (r.valor && r.status === "recebido" && !r.observacao.toLowerCase().includes("aporte")) {
             const f = r.fornecedor || "Não identificado";
             mapa.set(f, (mapa.get(f) || 0) + r.valor);
          }
        });
        return Array.from(mapa.entries())
          .map(([financiador, valor]) => ({ financiador, valor }))
          .sort((a, b) => b.valor - a.valor);
      })
    );
  }

  getSaldosResgatadosOperacaoBasica(): Observable<number> {
    return this.lancamentos$.pipe(
      map((lancs) => {
        let total = 0;
        lancs.forEach((l) => {
          if (l.projeto === "Operação Básica" && l.valor > 0) {
            const obs = l.observacao.toLowerCase();
            const cat = l.categoria.toLowerCase();
            if (obs.includes("saldo") || obs.includes("sobra") || cat.includes("saldo") || cat.includes("sobra")) {
              total += l.valor;
            }
          }
        });
        return total;
      })
    );
  }

  // ===== SALDOS REMANESCENTES (Aba GID 86178020) =====
  getSaldos(): Observable<SaldoRemanescente[]> {
    return this.saldos$;
  }

  getSaldosPorParceiro(): Observable<{ parceiro: string; valor: number }[]> {
    return this.saldos$.pipe(
      map((saldos) => {
        const mapa = new Map<string, number>();
        saldos.forEach((s) => {
          mapa.set(s.parceiro, (mapa.get(s.parceiro) || 0) + s.valorTransferido);
        });
        return Array.from(mapa.entries())
          .map(([parceiro, valor]) => ({ parceiro, valor }))
          .sort((a, b) => b.valor - a.valor);
      })
    );
  }

  // ===== RENDIMENTOS (Aba GID 2032068393) =====
  private parseRendimentos(csvText: string): void {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];
    const rendimentos: Rendimento[] = [];

    // Colunas: categoria(0), data(1), valor(2), utilização(3)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 3) continue;

      const categoria = (row[0] || "").trim();
      const data = (row[1] || "").trim();
      const valor = this.parseValor((row[2] || "").trim());
      const utilizacao = (row[3] || "").trim();

      if (!categoria && valor === 0) continue;

      // Derivar mesAno a partir da data (aceita DD/MM/YYYY ou MM/YYYY)
      const mesAno = this.extrairMesAno(data);

      rendimentos.push({ categoria, data, mesAno, valor, utilizacao });
    }

    // Ordenar por mesAno cronológico
    rendimentos.sort((a, b) => this.compareMesAno(a.mesAno, b.mesAno));
    this.rendimentosSubject.next(rendimentos);
  }

  private extrairMesAno(data: string): string {
    if (!data) return "";
    // Formato DD/MM/YYYY
    const fullDate = data.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (fullDate) return `${fullDate[2].padStart(2, "0")}/${fullDate[3]}`;
    // Formato MM/YYYY
    const mesAno = data.match(/^(\d{1,2})\/(\d{4})$/);
    if (mesAno) return `${mesAno[1].padStart(2, "0")}/${mesAno[2]}`;
    return data;
  }

  private compareMesAno(a: string, b: string): number {
    const parse = (s: string) => {
      const parts = s.split("/");
      return parts.length === 2 ? parseInt(parts[1]) * 100 + parseInt(parts[0]) : 0;
    };
    return parse(a) - parse(b);
  }

  getRendimentos(): Observable<Rendimento[]> {
    return this.rendimentos$;
  }

  // ===== ORÇAMENTO — Planilha DFC (rendimentos projetados por mês) =====
  private readonly ORCAMENTO_BASE =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQk5MAr4iJ1c7JubFqBVw8BPbcallMvsRdfFiIMQeSufBLRuYgZvQOYC79_vTyv0Q/pub?output=csv';

  getOrcamentoRendimentos(): Observable<Map<string, number>> {
    return this.http.get(this.ORCAMENTO_BASE, { responseType: 'text' }).pipe(
      map(csv => this.parseOrcamentoRendimentos(csv))
    );
  }

  private parseOrcamentoRendimentos(csv: string): Map<string, number> {
    const MESES_PT: Record<string, string> = {
      'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
      'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
      'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
    };
    const parsed = Papa.parse(csv, { header: false, skipEmptyLines: false });
    const rows = parsed.data as string[][];
    const result = new Map<string, number>();

    let headerColMap: Map<number, string> = new Map(); // colIndex → YYYY-MM

    for (const row of rows) {
      // Detectar linha de cabeçalho com meses: "jan./26", "ago./26", etc.
      const hasMonth = row.some(c => /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.\//i.test(c.trim()));
      if (hasMonth && headerColMap.size === 0) {
        for (let i = 0; i < row.length; i++) {
          const h = row[i].trim().toLowerCase().replace('.', '');  // "jan/26"
          const [mon, yy] = h.split('/');
          const m = MESES_PT[mon];
          if (m && yy) headerColMap.set(i, `20${yy}-${m}`);
        }
        continue;
      }
      // Detectar linha "Rendimentos"
      if (headerColMap.size > 0 && row[1]?.trim().toLowerCase() === 'rendimentos') {
        headerColMap.forEach((mesKey, colIdx) => {
          const val = this.parseValor(row[colIdx] ?? '');
          if (val > 0) result.set(mesKey, val);
        });
        break;
      }
    }
    return result;
  }

  getRendimentoResumo(): Observable<{
    totalBruto: number;
    totalImpostos: number;
    saldoLiquido: number;
    totalUtilizado: number;
    saldoDisponivel: number;
    porMes: { mesAno: string; bruto: number; imposto: number; liquido: number; acumulado: number }[];
  }> {
    return this.rendimentos$.pipe(
      map((rends) => {
        let totalBruto = 0;
        let totalImpostos = 0;
        // Calculados por registro: utilizado = campo preenchido, disponível = campo vazio
        let totalUtilizado = 0;
        let saldoDisponivel = 0;

        const porMesMap = new Map<string, { bruto: number; imposto: number }>();

        rends.forEach((r) => {
          if (r.valor > 0) totalBruto += r.valor;
          else totalImpostos += r.valor; // negativo

          // Campo sempre preenchido: "utilizado" ou "não utilizado"
          if (r.utilizacao.toLowerCase().trim() === "utilizado") {
            totalUtilizado += r.valor;
          } else {
            saldoDisponivel += r.valor;
          }

          const key = r.mesAno || "Sem data";
          if (!porMesMap.has(key)) porMesMap.set(key, { bruto: 0, imposto: 0 });
          const m = porMesMap.get(key)!;
          if (r.valor > 0) m.bruto += r.valor;
          else m.imposto += r.valor;
        });

        const saldoLiquido = totalBruto + totalImpostos;

        let acumulado = 0;
        const porMes = Array.from(porMesMap.entries())
          .sort((a, b) => this.compareMesAno(a[0], b[0]))
          .map(([mesAno, d]) => {
            acumulado += d.bruto + d.imposto;
            return { mesAno, bruto: d.bruto, imposto: d.imposto, liquido: d.bruto + d.imposto, acumulado };
          });

        return { totalBruto, totalImpostos, saldoLiquido, totalUtilizado, saldoDisponivel, porMes };
      })
    );
  }
}
