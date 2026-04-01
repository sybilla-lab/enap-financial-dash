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
} from "../models/lancamento.model";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class DataService {
  private lancamentosSubject = new BehaviorSubject<Lancamento[]>([]);
  private recebimentosSubject = new BehaviorSubject<Recebimento[]>([]);
  private statusSubject = new BehaviorSubject<StatusProjeto[]>([]);
  private saldosSubject = new BehaviorSubject<SaldoRemanescente[]>([]);
  
  lancamentos$ = this.lancamentosSubject.asObservable();
  recebimentos$ = this.recebimentosSubject.asObservable();
  status$ = this.statusSubject.asObservable();
  saldos$ = this.saldosSubject.asObservable();

  // Metas financeiras
  readonly META_APORTE = 3023000;
  readonly META_CAPTACAO = 17550525;
  readonly META_TOTAL = this.META_APORTE + this.META_CAPTACAO;

  private readonly SHEET_BASE = environment.googleSheetsBaseUrl;
  private readonly SHEET_PRINCIPAL = this.SHEET_BASE + "&gid=0";
  private readonly SHEET_RECEBIMENTOS = this.SHEET_BASE + "&gid=595659211";
  private readonly SHEET_STATUS_PROJETOS = this.SHEET_BASE + "&gid=1699326950";
  private readonly SHEET_SALDOS = this.SHEET_BASE + "&gid=86178020";

  constructor(private http: HttpClient) {
    this.carregarDados();
  }

  private carregarDados(): void {
    forkJoin({
      principal: this.http.get(this.SHEET_PRINCIPAL, { responseType: "text" }),
      recebimentos: this.http.get(this.SHEET_RECEBIMENTOS, { responseType: "text" }),
      status: this.http.get(this.SHEET_STATUS_PROJETOS, { responseType: "text" }),
      saldos: this.http.get(this.SHEET_SALDOS, { responseType: "text" }),
    }).subscribe({
      next: ({ principal, recebimentos, status, saldos }) => {
        this.parsePrincipal(principal);
        this.parseRecebimentos(recebimentos);
        this.parseStatusProjetos(status);
        this.parseSaldos(saldos);
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

      const categoria = (row[8] || "").trim();
      const observacao = (row[9] || "").trim();
      const projeto = (row[10] || "").trim();
      const mesAno = (row[11] || "").trim();
      const valorStr = (row[12] || row[4] || "").trim(); // Tenta coluna 12, se não, usa a 4
      const valor = this.parseValor(valorStr);

      if (categoria || projeto) {
        lancamentos.push({ categoria, observacao, projeto, mesAno, valor });
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
            tipo: "Aporte ENAP",
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
        const aporteRecebidoTotal = aporteRecebido + aporteInflacao;

        return {
          aporteRecebido,
          aporteInflacao,
          aporteRecebidoTotal,
          aportePrevisto,
          captacaoRecebida,
          captacaoPrevista,
          captacaoTotal,
          saldoACaptar,
          totalRecebido: aporteRecebido + captacaoRecebida,
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
    }).pipe(
      map(({ lancs, status }) => {
        const porProjeto = new Map<string, { entradas: number; saidas: number }>();

        lancs.forEach((l: Lancamento) => {
          if (!l.projeto) return;
          if (!porProjeto.has(l.projeto)) {
            porProjeto.set(l.projeto, { entradas: 0, saidas: 0 });
          }
          const p = porProjeto.get(l.projeto)!;
          if (l.valor >= 0) {
            p.entradas += l.valor;
          } else {
            p.saidas += Math.abs(l.valor);
          }
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
              status: statusInfo ? statusInfo.status : "Ativo",
            };
          })
          .sort((a, b) => b.entradas - a.entradas);
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
  getCategoriaResumos(): Observable<CategoriaResumo[]> {
    return this.lancamentos$.pipe(
      map((lancs) => {
        const porCategoria = new Map<string, number>();

        lancs
          .filter((l) => l.categoria !== "0.0.0 Recurso" && l.categoria && l.valor < 0)
          .forEach((l) => {
            const cleanCategoria = l.categoria.replace(/^\d+(\.\d+)*\s*/, "").trim();
            const current = porCategoria.get(cleanCategoria) || 0;
            porCategoria.set(cleanCategoria, current + Math.abs(l.valor));
          });

        return Array.from(porCategoria.entries())
          .map(([categoria, total]) => ({ categoria, total }))
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
          if (r.valor && r.status === "recebido" && r.tipoRecurso !== "Aporte") { // assumindo que tipoRecurso=="Aporte" é da ENAP, financiadores são captação.
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
}
