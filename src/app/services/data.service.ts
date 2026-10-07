import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, forkJoin, map, combineLatest, of, catchError, shareReplay, switchMap } from "rxjs";
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
  UtilizacaoRendimento,
  CategoriaGlossario,
  CategoriaNormalizada,
  OficioRendimentos,
  ProjetoOficio,
  MovimentacaoRendimento,
  TransferenciaRendimento,
  EventoHistorico,
} from "../models/lancamento.model";
import { environment } from "../../environments/environment";
import {
  ratearRendimentos,
  cortarRateio,
  MesRendimento,
  PROJETOS_SEM_ATRIBUICAO_RENDIMENTOS,
} from "./rateio-rendimentos";

const cent = (v: number) => Math.round(v * 100) / 100;

@Injectable({ providedIn: "root" })
export class DataService {
  private lancamentosSubject = new BehaviorSubject<Lancamento[]>([]);
  private recebimentosSubject = new BehaviorSubject<Recebimento[]>([]);
  private statusSubject = new BehaviorSubject<StatusProjeto[]>([]);
  private saldosSubject = new BehaviorSubject<SaldoRemanescente[]>([]);
  private rendimentosSubject = new BehaviorSubject<Rendimento[]>([]);
  /** Resumo mensal do bloco F:G — competência → rendimento líquido do mês. */
  private resumoMensalSubject = new BehaviorSubject<Map<string, number>>(new Map());
  /** Utilizações e destinações do bloco J:L. */
  private utilizacoesSubject = new BehaviorSubject<UtilizacaoRendimento[]>([]);
  /**
   * Problemas de leitura da aba, em texto. A aba é editada à mão: quando a
   * estrutura muda, o certo é a página dizer o que não conseguiu ler, em vez de
   * exibir um número errado com cara de certo.
   */
  private avisosRendimentosSubject = new BehaviorSubject<string[]>([]);
  /** Total declarado na própria aba (linha sem competência), para conferência. */
  private totalDeclarado: number | null = null;
  private glossarioSubject = new BehaviorSubject<CategoriaGlossario[]>([]);

  lancamentos$ = this.lancamentosSubject.asObservable();
  recebimentos$ = this.recebimentosSubject.asObservable();
  status$ = this.statusSubject.asObservable();
  saldos$ = this.saldosSubject.asObservable();
  rendimentos$ = this.rendimentosSubject.asObservable();
  resumoMensalRendimentos$ = this.resumoMensalSubject.asObservable();
  utilizacoesRendimentos$ = this.utilizacoesSubject.asObservable();
  avisosRendimentos$ = this.avisosRendimentosSubject.asObservable();
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
      utilizacoes: this.utilizacoesRendimentos$,
    }).pipe(
      map(({ lancs, status, saldos, utilizacoes }) => {
        type Acc = { termo: number; destinado: number; saidas: number; remanescente: number };
        const porProjeto = new Map<string, Acc>();
        const abrir = (p: string): Acc => {
          if (!porProjeto.has(p)) porProjeto.set(p, { termo: 0, destinado: 0, saidas: 0, remanescente: 0 });
          return porProjeto.get(p)!;
        };

        lancs.forEach((l: Lancamento) => {
          if (!l.projeto) return;
          const p = abrir(l.projeto);
          if (l.valor >= 0) {
            p.termo += l.valor;
          } else {
            p.saidas += Math.abs(l.valor);
          }
        });

        /**
         * Rendimentos destinados ao projeto entram na base de execução.
         *
         * A despesa paga com rendimento destinado já estava no numerador, como
         * saída do projeto. Faltava o outro lado: o recurso que a custeou. Sem
         * ele a Plataforma Desafio 3.0 marcava 108% tendo gasto R$ 21.600,00 de
         * uma destinação de R$ 150.002,11, e a Operação Básica marcava 105,8%
         * sobre os R$ 230.075,62 destinados em 2025.
         *
         * O que isto NÃO faz é inventar base para quem não recebeu destinação:
         * o Fundo Gov.Tech segue em 100,7% (saldo -R$ 710,38), que é pendência
         * a apurar e continua à vista.
         */
        utilizacoes.forEach((u: UtilizacaoRendimento) => {
          if (!u.projeto) return;
          abrir(u.projeto).destinado += u.valor;
        });

        // Somar saldos remanescentes recuperados da nova aba
        saldos.forEach((s) => {
          if (!s.projeto) return;
          abrir(s.projeto).remanescente += s.valorTransferido;
        });

        return Array.from(porProjeto.entries())
          .map(([projeto, data]) => {
            const statusInfo = status.find((s: StatusProjeto) => s.projeto === projeto);
            const entradas = cent(data.termo + data.destinado);
            return {
              projeto,
              entradas,
              recursoTermo: cent(data.termo),
              rendimentosDestinados: cent(data.destinado),
              saidas: data.saidas,
              saldo: cent(entradas - data.saidas),
              execucao: entradas > 0 ? (data.saidas / entradas) * 100 : 0,
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
  /**
   * A aba traz três blocos independentes, lado a lado na mesma planilha:
   *
   *   A:C  lançamentos — categoria, competência e valor; impostos negativos
   *   F:G  resumo mensal — competência e rendimento líquido do mês
   *   J:L  utilizações e destinações — ano, valor e projeto
   *
   * São representações dos MESMOS recursos, não parcelas somáveis: F:G é A:C
   * consolidado por mês. Somar os dois dobraria o total — foi exatamente o que
   * aconteceu quando a aba foi reorganizada e o parser antigo, que lia um bloco
   * só, passou a engolir a linha de total: o líquido subiu de R$ 889.655,76
   * para R$ 1.779.311,52.
   *
   * A linha de total não tem competência (C56 e G36 trazem valor sem data ao
   * lado). É esse o critério de descarte: **linha sem competência não é
   * lançamento**. Vale para qualquer total que venha a ser acrescentado.
   */
  private parseRendimentos(csvText: string): void {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];

    const COL = { categoria: 0, data: 1, valor: 2, resumoData: 5, resumoValor: 6,
                  usoAno: 9, usoValor: 10, usoProjeto: 11 };

    const rendimentos: Rendimento[] = [];
    const resumoMensal = new Map<string, number>();
    const utilizacoes: UtilizacaoRendimento[] = [];
    const avisos: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const linha = i + 1;

      // ── Bloco A:C — lançamentos ──
      const categoria = (row[COL.categoria] || "").trim();
      const data = (row[COL.data] || "").trim();
      const bruto = (row[COL.valor] || "").trim();
      if (bruto) {
        const valor = this.parseValor(bruto);
        if (!data) {
          // Total do bloco: fica de fora da série, mas é guardado para conferir.
          if (valor !== 0) this.totalDeclarado = valor;
        } else if (valor !== 0 || categoria) {
          rendimentos.push({ categoria, data, mesAno: this.extrairMesAno(data), valor, utilizacao: "" });
        }
      }

      // ── Bloco F:G — resumo mensal (líquido já consolidado) ──
      const resumoData = (row[COL.resumoData] || "").trim();
      const resumoValor = (row[COL.resumoValor] || "").trim();
      if (resumoValor && resumoData) {
        const mesAno = this.extrairMesAno(resumoData);
        if (mesAno) resumoMensal.set(mesAno, this.parseValor(resumoValor));
        else avisos.push(`linha ${linha}: competência ilegível no resumo mensal ("${resumoData}")`);
      }

      // ── Bloco J:L — utilizações e destinações ──
      const usoAno = (row[COL.usoAno] || "").trim();
      const usoValor = (row[COL.usoValor] || "").trim();
      if (usoAno && usoValor) {
        const ano = parseInt(usoAno, 10);
        const valor = this.parseValor(usoValor);
        if (!ano || !valor) {
          avisos.push(`linha ${linha}: utilização ilegível (ano "${usoAno}", valor "${usoValor}")`);
        } else {
          utilizacoes.push({
            ano,
            valor,
            projeto: this.normalizarProjeto((row[COL.usoProjeto] || "").trim()),
            projetoOriginal: (row[COL.usoProjeto] || "").trim(),
            competencia: null,   // recuperada adiante, nunca inventada
          });
        }
      }
    }

    rendimentos.sort((a, b) => this.compareMesAno(a.mesAno, b.mesAno));

    // Conferência entre os dois blocos: eles têm de contar a mesma história.
    const liquidoLancamentos = cent(rendimentos.reduce((s, r) => s + r.valor, 0));
    const liquidoResumo = cent(Array.from(resumoMensal.values()).reduce((s, v) => s + v, 0));
    if (resumoMensal.size && Math.abs(liquidoLancamentos - liquidoResumo) > 0.02) {
      avisos.push(
        `lançamentos (A:C) somam ${liquidoLancamentos.toFixed(2)} e o resumo mensal (F:G) ` +
        `soma ${liquidoResumo.toFixed(2)} — diferença de ${cent(liquidoLancamentos - liquidoResumo).toFixed(2)}`
      );
    }
    if (this.totalDeclarado !== null && Math.abs(liquidoLancamentos - this.totalDeclarado) > 0.02) {
      avisos.push(
        `total declarado na aba (${this.totalDeclarado.toFixed(2)}) difere da soma dos ` +
        `lançamentos (${liquidoLancamentos.toFixed(2)})`
      );
    }

    // A competência é resolvida em duas etapas: aqui, pelo acumulado; e no
    // cruzamento com as movimentações, em getUtilizacoesComCompetencia(). O
    // aviso de competência pendente só pode sair depois das duas — senão
    // acusaria como irrecuperável algo que a segunda etapa resolve.
    this.competenciasDasUtilizacoes(utilizacoes, resumoMensal);

    this.resumoMensalSubject.next(resumoMensal);
    this.utilizacoesSubject.next(utilizacoes);
    this.avisosRendimentosSubject.next(avisos);
    this.rendimentosSubject.next(rendimentos);
  }

  /**
   * Recupera a competência de cada utilização a partir dos registros existentes.
   *
   * A coluna J traz só o ano — não dá para inventar mês nem dia. Duas pistas
   * reais resolvem:
   *
   *   1. a aba de movimentações, quando a destinação já está registrada lá com
   *      competência de efeito (é o caso da Plataforma, 08/2026);
   *   2. o próprio acumulado do resumo mensal: se o saldo acumulado dentro do
   *      ano bate exatamente com o valor utilizado, aquele mês é o encerramento
   *      do ciclo (é o caso da cobertura da Operação Básica, 08/2025).
   *
   * Não achando nenhuma das duas, a competência fica nula e um aviso é
   * registrado — melhor sem competência do que com uma inventada.
   */
  private competenciasDasUtilizacoes(
    utilizacoes: UtilizacaoRendimento[],
    resumoMensal: Map<string, number>,
  ): void {
    const meses = Array.from(resumoMensal.entries())
      .sort((a, b) => this.compareMesAno(a[0], b[0]));

    utilizacoes.forEach(u => {
      let acumulado = 0;
      for (const [mesAno, valor] of meses) {
        acumulado = cent(acumulado + valor);
        const ano = parseInt(mesAno.split('/')[1], 10);
        if (ano === u.ano && Math.abs(acumulado - u.valor) < 0.02) {
          u.competencia = mesAno;
          u.origemCompetencia = 'acumulado do resumo mensal';
          return;
        }
      }
    });
  }

  /**
   * Quais meses já foram consumidos por um encerramento de ciclo.
   *
   * O layout anterior da aba trazia um rótulo "utilizado/não utilizado" por
   * mês; ele não existe mais. A informação equivalente está no bloco J:L: uma
   * utilização cujo valor bate exatamente com o acumulado até certo mês
   * consumiu tudo o que havia até ali — é um encerramento de ciclo, e a
   * acumulação recomeça na competência seguinte. É o caso da cobertura da
   * Operação Básica, R$ 230.075,62 em 08/2025.
   *
   * Uma destinação que não zera o acumulado (a da Plataforma, R$ 150.002,11)
   * NÃO encerra ciclo: ela reserva parte do saldo, e os meses anteriores
   * seguem compondo a base de atribuição proporcional.
   *
   * Formato preservado (`Map<mesAno, "utilizado" | "">`) para o rateio, que já
   * estava validado contra a planilha, continuar recebendo o que espera.
   */
  getUtilizacaoPorMes(): Observable<Map<string, string>> {
    return combineLatest([this.resumoMensalRendimentos$, this.getUtilizacoesComCompetencia()]).pipe(
      map(([resumo, utilizacoes]) => {
        const mapa = new Map<string, string>();
        const meses = Array.from(resumo.keys()).sort((a, b) => this.compareMesAno(a, b));
        if (!meses.length) return mapa;

        const encerramentos = utilizacoes
          .filter(u => u.competencia && u.origemCompetencia === 'acumulado do resumo mensal')
          .map(u => this.mesKeyLocal(u.competencia!));
        const ultimoEncerramento = encerramentos.length ? Math.max(...encerramentos) : -Infinity;

        meses.forEach(mesAno => {
          mapa.set(mesAno, this.mesKeyLocal(mesAno) <= ultimoEncerramento ? 'utilizado' : '');
        });
        return mapa;
      })
    );
  }

  /**
   * Completa a competência das utilizações que o acumulado não resolve.
   *
   * O bloco J:L traz só o ano. Quando a saída é um encerramento de ciclo, o
   * próprio acumulado denuncia o mês. Quando é uma destinação parcial — a da
   * Plataforma, que não zera nada —, a competência está registrada na aba de
   * movimentações, como competência de efeito do documento. São os registros
   * existentes falando: nenhum mês é inventado aqui.
   */
  getUtilizacoesComCompetencia(): Observable<UtilizacaoRendimento[]> {
    return combineLatest([this.utilizacoesRendimentos$, this.getMovimentacoesRendimentos()]).pipe(
      map(([utilizacoes, movimentacoes]) => {
        const vigentes = movimentacoes.filter(m => m.status.toLowerCase().trim() === 'vigente');
        if (!vigentes.length) return utilizacoes;

        // Total destinado por documento: é esse montante que aparece no J:L.
        const porDocumento = new Map<string, { total: number; competencia: string }>();
        vigentes
          .filter(m => m.tipo === this.TIPO_TRANSFERENCIA || m.tipo === this.TIPO_DESTINACAO_PROPRIA)
          .forEach(m => {
            const atual = porDocumento.get(m.documento);
            porDocumento.set(m.documento, {
              total: cent((atual?.total ?? 0) + m.valor),
              competencia: atual?.competencia ?? m.competencia,
            });
          });

        return utilizacoes.map(u => {
          if (u.competencia) return u;
          for (const [documento, d] of porDocumento) {
            const [ano, mes] = String(d.competencia).split('-');
            if (Math.abs(d.total - u.valor) < 0.02 && parseInt(ano, 10) === u.ano && mes) {
              return { ...u, competencia: `${mes}/${ano}`, origemCompetencia: `competência de efeito do ${documento}` };
            }
          }
          return u;
        });
      })
    );
  }

  /**
   * Avisos de leitura prontos para exibir: os estruturais do parse mais as
   * competências que nenhuma das duas vias conseguiu recuperar.
   */
  getAvisosRendimentos(): Observable<string[]> {
    return combineLatest([this.avisosRendimentos$, this.getUtilizacoesComCompetencia()]).pipe(
      map(([estruturais, utilizacoes]) => [
        ...estruturais,
        ...utilizacoes
          .filter(u => !u.competencia)
          .map(u =>
            `utilização de ${u.valor.toFixed(2)} em ${u.ano} (${u.projeto}): competência não ` +
            `recuperável dos registros — exibida apenas pelo ano`),
      ])
    );
  }

  private mesKeyLocal(mesAno: string): number {
    const [m, y] = mesAno.split('/');
    return parseInt(y, 10) * 100 + parseInt(m, 10);
  }

  /**
   * Diferenças conhecidas entre o valor registrado no projeto e o lançado na
   * aba Principal, nas transferências de 31/05/2025.
   *
   * Nenhum lançamento é criado para fechá-las: um ajuste inventado esconderia a
   * divergência em vez de resolvê-la, e é justamente ela que precisa ser
   * investigada na origem. Ficam no histórico, marcadas como em aberto.
   */
  private readonly PENDENCIAS_CONCILIACAO = [
    { projeto: 'Ambiente Promotor', data: '31/05/2025', noProjeto: 5882.65, naPrincipal: 4107.65, diferenca: 1775.00 },
    { projeto: 'Feira Reversa', data: '31/05/2025', noProjeto: 41498.88, naPrincipal: 44626.93, diferenca: 3128.05 },
  ];

  /** "31/05/2025" → 20250531; "08/2025" → 20250800; "2026" → 20260000. */
  private ordemDeData(data: string): number {
    const dma = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dma) return +dma[3] * 10000 + +dma[2] * 100 + +dma[1];
    const ma = data.match(/^(\d{2})\/(\d{4})$/);
    if (ma) return +ma[2] * 10000 + +ma[1] * 100;
    const a = data.match(/^(\d{4})$/);
    if (a) return +a[1] * 10000;
    return 0;
  }

  /**
   * Linha do tempo única dos acontecimentos financeiros.
   *
   * Reúne o que estava espalhado por quatro telas: destinações de rendimentos,
   * transferências de saldo remanescente, encerramentos de projeto e pendências
   * de conciliação. Cada evento carrega a sua fonte em texto, para poder ser
   * conferido contra a planilha sem sair da página.
   */
  getHistoricoMovimentacoes(): Observable<EventoHistorico[]> {
    return combineLatest({
      utilizacoes: this.getUtilizacoesComCompetencia(),
      saldos: this.saldos$,
      status: this.status$,
    }).pipe(
      map(({ utilizacoes, saldos, status }) => {
        const eventos: EventoHistorico[] = [];

        utilizacoes.forEach(u => {
          const data = u.competencia ?? String(u.ano);
          eventos.push({
            tipo: 'destinacao',
            data,
            ordem: this.ordemDeData(data),
            titulo: `Rendimentos destinados a ${u.projeto}`,
            projeto: u.projeto,
            valor: u.valor,
            fonte: `bloco J:L da aba Rendimentos, exercício ${u.ano}` +
              (u.origemCompetencia ? ` — competência pelo ${u.origemCompetencia}` : ''),
            detalhe: this.detalheDestinacao(u),
          });
        });

        saldos.forEach(s => {
          if (!s.projeto) return;
          const negativo = s.valorTransferido < 0;
          eventos.push({
            tipo: 'transferencia',
            data: s.data,
            ordem: this.ordemDeData(s.data),
            titulo: negativo
              ? `Saldo negativo de ${s.projeto} absorvido pela Operação Básica`
              : `Saldo remanescente de ${s.projeto} devolvido ao fundo`,
            projeto: s.projeto,
            valor: s.valorTransferido,
            fonte: `aba Saldos Remanescentes — parceiro ${s.parceiro || 'não informado'}`,
            detalhe: negativo
              ? 'O projeto fechou o ciclo com despesa acima do recurso recebido; a diferença foi assumida pela Operação Básica.'
              : s.valorProjeto > 0
                ? `Sobra de ${(s.percentualSobra).toFixed(1)}% sobre ${this.brlLocal(s.valorProjeto)} do projeto.`
                : undefined,
          });
        });

        status
          .filter(s => s.status.toLowerCase().includes('finaliz'))
          .forEach(s => {
            const t = saldos.find(x => x.projeto === s.projeto);
            const data = t?.data ?? '';
            eventos.push({
              tipo: 'encerramento',
              data: data || '—',
              ordem: this.ordemDeData(data),
              titulo: `${s.projeto} encerrado`,
              projeto: s.projeto,
              valor: t?.valorTransferido ?? 0,
              fonte: 'aba Status de Projetos',
              detalhe: t
                ? 'O saldo apurado no encerramento foi transferido à Operação Básica.'
                : 'Encerramento sem transferência de saldo registrada.',
            });
          });

        this.PENDENCIAS_CONCILIACAO.forEach(p => {
          eventos.push({
            tipo: 'pendencia',
            data: p.data,
            ordem: this.ordemDeData(p.data),
            titulo: `${p.projeto}: divergência entre o projeto e a aba Principal`,
            projeto: p.projeto,
            valor: p.diferenca,
            fonte: 'conferência entre a aba do projeto e a aba Principal',
            detalhe: `Registrado no projeto: ${this.brlLocal(p.noProjeto)}; lançado na Principal: ` +
              `${this.brlLocal(p.naPrincipal)}. A diferença permanece em aberto — nenhum ` +
              `lançamento compensatório foi criado para fechá-la.`,
            emAberto: true,
          });
        });

        // Mais recente primeiro; o que não tem data vai para o fim.
        return eventos.sort((a, b) => b.ordem - a.ordem);
      })
    );
  }

  /**
   * O que explica a destinação, quando há algo a explicar.
   *
   * O texto da cobertura da Operação Básica vivia num parágrafo fixo da página
   * de Rendimentos, longe dos demais acontecimentos e sem data. Ele descreve um
   * evento, então o lugar dele é a linha do tempo, junto do valor que explica.
   */
  private detalheDestinacao(u: UtilizacaoRendimento): string | undefined {
    if (u.projeto === 'Operação Básica') {
      return 'No Transferegov, o recurso saiu como premiações do Impulso Regional. A ' +
        'Operação Básica havia consumido saldo daquele projeto, e o pagamento das ' +
        'premiações com rendimentos compensou essa utilização anterior, concentrando o ' +
        'uso de rendimentos numa única categoria. Os lançamentos seguem registrados no ' +
        'Impulso Regional: não há crédito novo a utilizar, esse valor já foi gasto.';
    }
    if (!u.competencia) {
      return 'Competência não recuperável dos registros: o evento é datado apenas pelo ano.';
    }
    return undefined;
  }

  private brlLocal(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /**
   * A Base grafa "Operação Báisca" na coluna de projeto das utilizações.
   * Normalizar aqui evita que o mesmo projeto apareça duas vezes no dashboard;
   * a planilha não é alterada.
   */
  private normalizarProjeto(nome: string): string {
    const limpo = nome.trim();
    const chave = limpo.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (chave === 'operacao baisca' || chave === 'operacao basica') return 'Operação Básica';
    return limpo;
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

  // ===== EVENTOS INSTITUCIONAIS — movimentações de rendimentos =====
  /**
   * As movimentações vêm da planilha, ao vivo.
   *
   * Fonte proprietária: aba "Movimentações de Rendimentos" da planilha
   * "Orçamento e Rendimentos 2026-2028". O dashboard não a lê direto: lê a
   * projeção técnica publicada em CSV, que expõe só os treze campos do
   * contrato — sem categoria, fornecedor ou a observação interna de cada
   * lançamento. É o mesmo mecanismo das abas da Base: CSV publicado + Papa.
   *
   * A lista é tentada EM SÉRIE e a primeira que responder com o cabeçalho
   * esperado vence — as seguintes nem chegam a ser pedidas. Em série, e não em
   * paralelo, porque uma aba não publicada responde com redirecionamento para o
   * login do Google: em paralelo isso vira um erro de CORS no console a cada
   * carregamento, mesmo quando outra fonte atendeu.
   *
   * Ordem: a aba oficial primeiro, que é a publicada hoje. Publicar a projeção
   * técnica e despublicar a oficial migra a leitura sozinho, sem deploy — e é
   * justamente esse ato que tira do ar as colunas que o dashboard não usa.
   *
   * O JSON local é o último recurso — fixture de teste e rede de segurança,
   * nunca a fonte. Registrar uma nova utilização na planilha basta: o
   * dashboard reflete no próximo carregamento, sem exportar nada.
   */
  private readonly MOVIMENTACOES_FONTES = environment.movimentacoesRendimentosUrls;
  private readonly MOVIMENTACOES_FALLBACK = 'oficio-04-2026.json';

  private readonly TIPO_TRANSFERENCIA = 'transferência interna de rendimentos';
  private readonly TIPO_DESTINACAO_PROPRIA = 'destinação própria';
  private readonly TIPO_UTILIZACAO = 'utilização da carteira';

  private movimentacoes$?: Observable<MovimentacaoRendimento[]>;
  private oficio$?: Observable<OficioRendimentos | null>;

  getMovimentacoesRendimentos(): Observable<MovimentacaoRendimento[]> {
    if (this.movimentacoes$) return this.movimentacoes$;

    const doJson = this.http.get<OficioRendimentos>(this.MOVIMENTACOES_FALLBACK).pipe(
      map(o => o?.movimentacoes ?? []),
      catchError(() => of([] as MovimentacaoRendimento[]))
    );

    // Uma aba não publicada responde 200 com a página de login do Google, não
    // com erro HTTP — por isso a fonte só é aceita se o CSV trouxer o cabeçalho.
    const tentativa = (url: string): Observable<MovimentacaoRendimento[] | null> =>
      this.http.get(url, { responseType: 'text' }).pipe(
        map(csv => {
          if (!csv.includes('id_movimentacao')) return null;
          const mov = this.parseMovimentacoes(csv);
          return mov.length ? mov : null;
        }),
        catchError(() => of(null))
      );

    const emSerie = (fontes: string[]): Observable<MovimentacaoRendimento[] | null> =>
      fontes.length
        ? tentativa(fontes[0]).pipe(switchMap(mov => (mov ? of(mov) : emSerie(fontes.slice(1)))))
        : of(null);

    this.movimentacoes$ = emSerie(this.MOVIMENTACOES_FONTES).pipe(
      switchMap(mov => (mov ? of(mov) : doJson)),
      shareReplay(1)
    );
    return this.movimentacoes$;
  }

  /**
   * Aceita "72847.81" (projeção técnica) e "R$ 72.847,81" (aba oficial).
   *
   * O símbolo da moeda sai antes de delegar: `parseValor` presume a string já
   * sem prefixo e devolveria 0 para "R$ …" — um zero silencioso, que some no
   * meio de uma soma em vez de estourar.
   */
  private parseValorMovimentacao(bruto: string): number {
    const s = (bruto || '').replace(/R\$/gi, '').trim();
    if (!s) return 0;
    if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    return this.parseValor(s);
  }

  private parseMovimentacoes(csvText: string): MovimentacaoRendimento[] {
    const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (!rows.length) return [];

    const idx = new Map<string, number>();
    rows[0].forEach((h, i) => idx.set(String(h || '').trim().toLowerCase(), i));
    const campo = (row: string[], ...nomes: string[]): string => {
      for (const n of nomes) {
        const i = idx.get(n);
        if (i !== undefined) return (row[i] ?? '').trim();
      }
      return '';
    };

    const out: MovimentacaoRendimento[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const id = campo(row, 'id_movimentacao');
      if (!id) continue;
      out.push({
        id,
        dataBase: campo(row, 'data_base'),
        dataEfetiva: campo(row, 'data_efetiva'),
        competencia: campo(row, 'competencia', 'competência'),
        tipo: campo(row, 'tipo'),
        documento: campo(row, 'documento'),
        origem: campo(row, 'projeto_origem'),
        destino: campo(row, 'projeto_destino'),
        valor: this.parseValorMovimentacao(campo(row, 'valor')),
        numeroPagamento: campo(row, 'numero_pagamento') || null,
        categoria: campo(row, 'categoria') || null,
        fornecedor: campo(row, 'fornecedor') || null,
        // A aba oficial chama o campo de "destinacao"; a projeção, de "finalidade".
        finalidade: campo(row, 'finalidade', 'destinacao', 'destinação'),
        observacao: campo(row, 'observacao', 'observação'),
        status: campo(row, 'status') || 'vigente',
      });
    }
    return out;
  }

  /**
   * Apuração do evento institucional a partir das movimentações ao vivo.
   *
   * Os totais movimentados (cedido, recebido, destinação própria, utilizado)
   * são somas diretas das linhas da planilha. O checkpoint da data-base e o
   * rendimento gerado depois do corte vêm do rateio — a mesma série da página
   * de Rendimentos, partida na competência de efeito do documento.
   */
  getOficioRendimentos(): Observable<OficioRendimentos | null> {
    if (this.oficio$) return this.oficio$;

    this.oficio$ = combineLatest({
      movimentacoes: this.getMovimentacoesRendimentos(),
      resumo: this.getRendimentoResumo(),
      lancamentos: this.lancamentos$,
      utilizacaoPorMes: this.getUtilizacaoPorMes(),
      saldos: this.saldos$,
      status: this.status$,
    }).pipe(
      map(d => this.apurarOficio(d)),
      catchError(() => of(null)),
      shareReplay(1)
    );
    return this.oficio$;
  }

  private apurarOficio(d: {
    movimentacoes: MovimentacaoRendimento[];
    resumo: { porMes: MesRendimento[] };
    lancamentos: Lancamento[];
    utilizacaoPorMes: Map<string, string>;
    saldos: SaldoRemanescente[];
    status: StatusProjeto[];
  }): OficioRendimentos | null {
    const mov = d.movimentacoes.filter(m => m.status.toLowerCase().trim() === 'vigente');
    if (!mov.length || !d.resumo.porMes.length || !d.lancamentos.length) return null;

    const transferencias = this.transferenciasDe(mov);
    const competenciaEfeito =
      mov.find(m => m.tipo === this.TIPO_TRANSFERENCIA)?.competencia ||
      mov[0]?.competencia ||
      '';
    if (!competenciaEfeito) return null;

    const utilizacaoPorMes = d.utilizacaoPorMes;
    if (!utilizacaoPorMes.size) return null;

    const projetosEncerrados = new Map<string, number>();
    d.saldos.forEach(s => {
      const p = s.data.split('/');
      if (p.length === 3) projetosEncerrados.set(s.projeto, parseInt(p[2]) * 100 + parseInt(p[1]));
    });
    const projetosInativos = new Set<string>();
    d.status.forEach(s => {
      const st = s.status.toLowerCase();
      if (st === 'finalizado' || st === 'encerrado') projetosInativos.add(s.projeto);
    });

    const rateio = ratearRendimentos({
      porMes: d.resumo.porMes,
      lancamentos: [
        ...d.lancamentos,
        ...transferencias.map(t => ({ projeto: t.projeto, mesAno: t.mesAno, valor: t.valor })),
      ],
      utilizacaoPorMes,
      projetosEncerrados,
      projetosInativos,
      projetosSemAtribuicao: PROJETOS_SEM_ATRIBUICAO_RENDIMENTOS,
    });
    if (!rateio) return null;
    const corte = cortarRateio(rateio, competenciaEfeito);

    const somar = (filtro: (m: MovimentacaoRendimento) => boolean) =>
      cent(mov.filter(filtro).reduce((s, m) => s + m.valor, 0));
    /**
     * Só transferência interna conta como "cedido".
     *
     * A destinação própria é somada à parte, em `destinacaoPropria`. Incluí-la
     * aqui a faria entrar duas vezes em `destinado = cedido + própria`, e o
     * saldo livre do projeto que destinou recurso próprio seria reduzido pelo
     * dobro — foi o que jogou a Operação Básica para um livre negativo de
     * R$ 29.826,35 e deixou a soma dos livres R$ 37.476,59 abaixo do
     * disponível, exatamente o valor da destinação própria.
     */
    const transferencia = (m: MovimentacaoRendimento) =>
      m.tipo === this.TIPO_TRANSFERENCIA && m.origem !== m.destino;

    const nomes = new Set<string>([...corte.ate.keys(), ...corte.depois.keys()]);
    mov.forEach(m => { nomes.add(m.origem); nomes.add(m.destino); });

    const projetos: ProjetoOficio[] = Array.from(nomes)
      .filter(p => !!p)
      .map(p => {
        const cedido = somar(m => transferencia(m) && m.origem === p);
        const recebido = somar(m => transferencia(m) && m.destino === p);
        const propria = somar(m => m.tipo === this.TIPO_DESTINACAO_PROPRIA && m.origem === p);
        const utilizado = somar(m => m.tipo === this.TIPO_UTILIZACAO && m.origem === p);
        const historico = cent(corte.ate.get(p) ?? 0);
        const novos = cent(corte.depois.get(p) ?? 0);
        const destinado = cent(cedido + propria);
        return {
          projeto: p,
          historicoAteDataBase: historico,
          destinado,
          transferidoCedido: cedido,
          transferidoRecebido: recebido,
          destinacaoPropria: propria,
          saldoLivreAposOficio: cent(historico - destinado),
          novosRendimentos: novos,
          saldoLivreAtual: cent(historico - destinado + novos),
          carteiraSobGestao: cent(recebido + propria),
          utilizado,
          carteiraDisponivel: cent(recebido + propria - utilizado),
          participa: destinado > 0 || recebido > 0,
        };
      })
      .filter(p => p.historicoAteDataBase !== 0 || p.novosRendimentos !== 0 || p.participa)
      .sort((a, b) => b.historicoAteDataBase - a.historicoAteDataBase);

    const totalTransferido = somar(transferencia);
    const totalPropria = somar(m => m.tipo === this.TIPO_DESTINACAO_PROPRIA);
    const totalUtilizado = somar(m => m.tipo === this.TIPO_UTILIZACAO);
    const referencia = mov.find(m => m.tipo === this.TIPO_TRANSFERENCIA) ?? mov[0];

    return {
      documento: referencia.documento,
      finalidade: referencia.finalidade,
      projetoExecutor: referencia.destino || 'Operação Básica',
      dataBase: referencia.dataBase,
      competenciaEfeito,
      checkpointDataBase: corte.totalAte,
      totalDestinado: cent(totalTransferido + totalPropria),
      transferidoDeOutrosProjetos: totalTransferido,
      rendimentoProprioDestinado: totalPropria,
      utilizado: totalUtilizado,
      disponivel: cent(totalTransferido + totalPropria - totalUtilizado),
      saldoLivreTotal: cent(projetos.reduce((s, p) => s + p.saldoLivreAtual, 0)),
      projetos,
      movimentacoes: mov,
      geradoEm: new Date().toISOString(),
    };
  }

  /**
   * Movimentos que deslocam saldo entre projetos, no formato do rateio.
   *
   * Inclui a destinação própria quando origem e destino diferem — desde que a
   * destinação passou a ter como destino a Plataforma Desafio 3.0, ela também
   * move saldo. Enquanto origem e destino eram o mesmo projeto, ela apenas
   * reclassificava o recurso e não tinha efeito sobre a base de rateio.
   *
   * Isto é para a BASE DE RATEIO. Na apuração do evento, a destinação própria
   * continua contada uma vez só, por `destinacaoPropria` — ver `apurarOficio`.
   */
  private transferenciasDe(mov: MovimentacaoRendimento[]): TransferenciaRendimento[] {
    const out: TransferenciaRendimento[] = [];
    mov
      .filter(m => (m.tipo === this.TIPO_TRANSFERENCIA || m.tipo === this.TIPO_DESTINACAO_PROPRIA)
                   && m.origem !== m.destino)
      .forEach(m => {
        const [ano, mes] = String(m.competencia).split('-');
        const mesAno = `${mes}/${ano}`;
        out.push({ mesAno, projeto: m.origem, valor: -m.valor, documento: m.documento });
        out.push({ mesAno, projeto: m.destino, valor: m.valor, documento: m.documento });
      });
    return out;
  }

  /**
   * Transferências internas no formato que o rateio consome: ajuste de saldo na
   * competência de efeito. Não estão na aba Principal porque não são movimento
   * financeiro real — a Principal só registra movimento real.
   */
  getTransferenciasRendimentos(): Observable<TransferenciaRendimento[]> {
    return this.getMovimentacoesRendimentos().pipe(
      map(mov => this.transferenciasDe(mov.filter(m => m.status.toLowerCase().trim() === 'vigente')))
    );
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
    return combineLatest([this.rendimentos$, this.utilizacoesRendimentos$]).pipe(
      map(([rends, utilizacoes]) => {
        let totalBruto = 0;
        let totalImpostos = 0;

        const porMesMap = new Map<string, { bruto: number; imposto: number }>();

        rends.forEach((r) => {
          if (r.valor > 0) totalBruto += r.valor;
          else totalImpostos += r.valor; // negativo

          // Lançamento sem competência já foi descartado na leitura; a chave
          // nunca é vazia, e a série não ganha um mês fantasma "Sem data".
          const key = r.mesAno;
          if (!key) return;
          if (!porMesMap.has(key)) porMesMap.set(key, { bruto: 0, imposto: 0 });
          const m = porMesMap.get(key)!;
          if (r.valor > 0) m.bruto += r.valor;
          else m.imposto += r.valor;
        });

        const saldoLiquido = cent(totalBruto + totalImpostos);

        /**
         * Utilizado e destinado saem do bloco J:L, não mais de um rótulo por
         * mês. São duas coisas que já saíram do bolo disponível para NOVAS
         * destinações: o que foi pago e o que está reservado a uma finalidade.
         *
         * O pagamento de uma destinação já registrada não desconta de novo:
         * o valor integral saiu do disponível no momento da destinação, e daí
         * em diante a despesa consome o saldo do projeto de destino.
         */
        const totalUtilizado = cent(utilizacoes.reduce((s, u) => s + u.valor, 0));
        const saldoDisponivel = cent(saldoLiquido - totalUtilizado);

        let acumulado = 0;
        const porMes = Array.from(porMesMap.entries())
          .sort((a, b) => this.compareMesAno(a[0], b[0]))
          .map(([mesAno, d]) => {
            acumulado = cent(acumulado + d.bruto + d.imposto);
            return {
              mesAno,
              bruto: cent(d.bruto),
              imposto: cent(d.imposto),
              liquido: cent(d.bruto + d.imposto),
              acumulado,
            };
          });

        return {
          totalBruto: cent(totalBruto),
          totalImpostos: cent(totalImpostos),
          saldoLiquido, totalUtilizado, saldoDisponivel, porMes,
        };
      })
    );
  }
}
