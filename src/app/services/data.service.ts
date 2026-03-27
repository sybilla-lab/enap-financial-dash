import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, map } from "rxjs";
import * as Papa from "papaparse";
import {
  Lancamento,
  ProjetoResumo,
  CategoriaResumo,
  FluxoMensal,
  RecursoResumo,
} from "../models/lancamento.model";

@Injectable({ providedIn: "root" })
export class DataService {
  private lancamentosSubject = new BehaviorSubject<Lancamento[]>([]);
  lancamentos$ = this.lancamentosSubject.asObservable();

  // Metas financeiras
  readonly META_APORTE = 3023000;
  readonly META_CAPTACAO = 17550525;
  readonly META_TOTAL = this.META_APORTE + this.META_CAPTACAO;

  private readonly SHEET_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTcM2aU8ucv35H649ATmgyUMR6S7pvkVaxPQSwN0p-Hs9DsvAIG5Mm-4PutXobweeZ0vp21mklhYqBM/pub?output=csv";

  constructor(private http: HttpClient) {
    this.carregarDados();
  }

  private carregarDados(): void {
    this.http
      .get(this.SHEET_URL, { responseType: "text" })
      .subscribe((csvText) => {
        const parsed = Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
        });

        const rows = parsed.data as string[][];
        const lancamentos: Lancamento[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 13) continue;

          const categoria = (row[8] || "").trim();
          const observacao = (row[9] || "").trim();
          const projeto = (row[10] || "").trim();
          const mesAno = (row[11] || "").trim();
          const valorStr = (row[12] || "").trim();

          const valor = this.parseValor(valorStr);

          if (categoria || projeto) {
            lancamentos.push({ categoria, observacao, projeto, mesAno, valor });
          }
        }

        this.lancamentosSubject.next(lancamentos);
      });
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

  // ===== RECURSOS =====
  getRecursos(): Observable<RecursoResumo[]> {
    return this.lancamentos$.pipe(
      map((l) => {
        const recursos = l.filter((x) => x.categoria === "0.0.0 Recurso");
        let totalAporte = 0;
        let totalCaptacao = 0;

        recursos.forEach((r) => {
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
    return this.lancamentos$.pipe(
      map((lancs) => {
        const porProjeto = new Map<
          string,
          { entradas: number; saidas: number }
        >();

        lancs.forEach((l) => {
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
          .map(([projeto, data]) => ({
            projeto,
            entradas: data.entradas,
            saidas: data.saidas,
            saldo: data.entradas - data.saidas,
            execucao: data.entradas > 0 ? (data.saidas / data.entradas) * 100 : 0,
          }))
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
          .filter(
            (l) => l.categoria !== "0.0.0 Recurso" && l.categoria && l.valor < 0
          )
          .forEach((l) => {
            const current = porCategoria.get(l.categoria) || 0;
            porCategoria.set(l.categoria, current + Math.abs(l.valor));
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
}
