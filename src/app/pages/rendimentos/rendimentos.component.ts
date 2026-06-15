import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatTooltipModule } from "@angular/material/tooltip";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import { Rendimento } from "../../models/lancamento.model";

interface DetalheRend {
  projeto: string;
  pctParticipacao: number;    // % do saldo total positivo da conta naquele mês
  rendimentoMes: number;      // rendimento líquido atribuído a este projeto no mês clicado
  rendimentoAcumulado: number; // rendimento líquido acumulado desde o início até o mês clicado
  saldoProjeto: number;       // saldo do projeto ao início do mês clicado (base de cálculo)
  cor: string;
}

const PALETTE = ['#6366f1','#10b981','#f59e0b','#ec4899','#06b6d4','#8b5cf6','#ef4444','#14b8a6','#f97316','#84cc16'];
const mesKey = (s: string) => { const [m, y] = s.split('/'); return parseInt(y) * 100 + parseInt(m); };

@Component({
  selector: "app-rendimentos",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    BaseChartDirective,
  ],
  templateUrl: "./rendimentos.component.html",
  styleUrl: "./rendimentos.component.scss",
})
export class RendimentosComponent implements OnInit {
  isLoading = true;
  lancamentosOriginais: any[] = [];

  resumo = {
    totalBruto: 0,
    totalImpostos: 0,
    saldoLiquido: 0,
    totalUtilizado: 0,
    saldoDisponivel: 0,
    porMes: [] as { mesAno: string; bruto: number; imposto: number; liquido: number; acumulado: number }[],
  };

  tabelaAberta = false;
  mesAnoSelecionado: string | null = null;
  detalhesRend: DetalheRend[] = [];
  utilizacaoPorMes = new Map<string, string>();

  get maxAcumulado(): number {
    return Math.max(...this.resumo.porMes.map(m => Math.abs(m.acumulado)), 1);
  }
  pctAcumulado(acumulado: number): number {
    return (Math.abs(acumulado) / this.maxAcumulado) * 100;
  }
  isUtilizado(mesAno: string): boolean {
    return (this.utilizacaoPorMes.get(mesAno) ?? '').toLowerCase().trim() === 'utilizado';
  }
  // projeto → numeric mesAno do encerramento (ex: 202505 para 31/05/2025)
  private projetosEncerrados = new Map<string, number>();

  get detalheInfo() {
    return this.resumo.porMes.find(m => m.mesAno === this.mesAnoSelecionado);
  }
  get detalheBrutoMes(): number { return this.detalheInfo?.bruto ?? 0; }
  get detalheImpMes(): number { return this.detalheInfo?.imposto ?? 0; }
  get detalheLiquidoMes(): number { return this.detalheInfo?.liquido ?? 0; }
  get detalheAcumulado(): number { return this.detalheInfo?.acumulado ?? 0; }
  get maxRendAcum(): number {
    return Math.max(...this.detalhesRend.map(d => d.rendimentoAcumulado), 1);
  }

  chartReady = false;
  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#94a3b8", font: { weight: "bold" } } },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.9)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        callbacks: {
          label: (ctx: any) => {
            const label = ctx.dataset.label || "";
            return `${label}: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { display: false } },
      y: {
        ticks: {
          color: "#64748b",
          callback: (v: any) => "R$ " + new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)
        },
        grid: { color: "rgba(255,255,255,0.05)" }
      },
    },
  };

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getRendimentoResumo().subscribe((r) => {
      this.resumo = r;
      this.buildChart(r.porMes);
      setTimeout(() => (this.isLoading = false), 1200);
    });

    this.dataService.lancamentos$.subscribe((lancs) => {
      this.lancamentosOriginais = lancs;
    });

    this.dataService.getRendimentos().subscribe((rends: Rendimento[]) => {
      this.utilizacaoPorMes.clear();
      rends.forEach(r => {
        if (r.valor > 0 && !this.utilizacaoPorMes.has(r.mesAno)) {
          this.utilizacaoPorMes.set(r.mesAno, r.utilizacao);
        }
      });
    });

    this.dataService.getSaldos().subscribe(saldos => {
      this.projetosEncerrados.clear();
      saldos.forEach(s => {
        // data no formato "DD/MM/YYYY"
        const parts = s.data.split('/');
        if (parts.length === 3) {
          const mc = parseInt(parts[2]) * 100 + parseInt(parts[1]);
          this.projetosEncerrados.set(s.projeto, mc);
        }
      });
    });
  }

  /**
   * Calcula a atribuição proporcional de rendimentos por projeto.
   *
   * Metodologia: para cada mês com rendimento, usa o saldo de cada projeto
   * ao INÍCIO daquele mês (= saldo acumulado até o mês anterior) como base.
   * O percentual de participação = saldo_projeto / soma_dos_saldos_positivos.
   * O rendimento líquido do mês é distribuído proporcionalmente.
   * O resultado é exclusivamente informativo.
   */
  abrirDetalhe(mesAno: string): void {
    const cutoff = mesKey(mesAno);

    // Ordena lancamentos cronologicamente uma vez
    const lancsSorted = [...this.lancamentosOriginais]
      .filter(l => l.mesAno)
      .sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));

    // Meses de rendimento até o mês clicado, em ordem
    const sortedMonths = this.resumo.porMes
      .filter(m => mesKey(m.mesAno) <= cutoff)
      .sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));

    // Saldo corrente por projeto (avança mês a mês)
    const runningBalance = new Map<string, number>();
    const projRendAcum = new Map<string, number>();
    let lIdx = 0;

    for (const mes of sortedMonths) {
      const mc = mesKey(mes.mesAno);

      // Incorpora todos os lançamentos até o final deste mês de rendimento
      // (inclui o próprio mês pois o rendimento é apurado no último dia do mês)
      while (lIdx < lancsSorted.length && mesKey(lancsSorted[lIdx].mesAno) <= mc) {
        const l = lancsSorted[lIdx++];
        const key = l.projeto || 'Sem projeto';
        runningBalance.set(key, (runningBalance.get(key) ?? 0) + l.valor);
      }

      // Zera projetos encerrados antes deste mês (saldo transferido para Operação Básica)
      this.projetosEncerrados.forEach((closedMc, proj) => {
        if (mc > closedMc) runningBalance.set(proj, 0);
      });

      // Distribui o rendimento líquido do mês proporcionalmente aos saldos positivos
      const totalPos = Array.from(runningBalance.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
      if (totalPos > 0 && mes.liquido > 0) {
        runningBalance.forEach((saldo, proj) => {
          if (saldo > 0) {
            projRendAcum.set(proj, (projRendAcum.get(proj) ?? 0) + mes.liquido * (saldo / totalPos));
          }
        });
      }
    }

    // Saldo de cada projeto ao início do mês clicado (para exibir % de participação atual)
    const saldoBase = new Map<string, number>();
    this.lancamentosOriginais.forEach(l => {
      if (!l.mesAno || mesKey(l.mesAno) > cutoff) return;
      const key = l.projeto || 'Sem projeto';
      // Ignora projetos encerrados antes do mês clicado
      const closedMc = this.projetosEncerrados.get(key);
      if (closedMc && cutoff > closedMc) return;
      saldoBase.set(key, (saldoBase.get(key) ?? 0) + l.valor);
    });
    const totalBase = Array.from(saldoBase.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const mesLiquido = this.resumo.porMes.find(m => m.mesAno === mesAno)?.liquido ?? 0;

    this.detalhesRend = Array.from(projRendAcum.keys())
      .map((projeto, i) => {
        const saldo = saldoBase.get(projeto) ?? 0;
        const pct = totalBase > 0 && saldo > 0 ? saldo / totalBase : 0;
        return {
          projeto,
          pctParticipacao: pct * 100,
          rendimentoMes: mesLiquido * pct,
          rendimentoAcumulado: projRendAcum.get(projeto) ?? 0,
          saldoProjeto: saldo,
          cor: PALETTE[i % PALETTE.length],
        };
      })
      .filter(d => d.rendimentoAcumulado > 0.01 && d.pctParticipacao > 0.01)
      .sort((a, b) => b.rendimentoAcumulado - a.rendimentoAcumulado);

    this.mesAnoSelecionado = mesAno;
  }

  fecharDetalhe(): void { this.mesAnoSelecionado = null; }

  pctBarRend(valor: number): number {
    return (valor / this.maxRendAcum) * 100;
  }

  private buildChart(porMes: typeof this.resumo.porMes): void {
    this.chartReady = false;
    setTimeout(() => {
      const base = porMes.length > 0 ? porMes[0].acumulado : 0;
      const acumuladoNorm = porMes.map((m) => m.acumulado - base);
      this.barChartData = {
        labels: porMes.map((m) => m.mesAno),
        datasets: [
          { type: "bar", label: "Rendimento Bruto", data: porMes.map((m) => m.bruto), backgroundColor: "rgba(16,185,129,0.45)", borderColor: "#10b981", borderWidth: 1, borderRadius: 4, yAxisID: "y" },
          { type: "bar", label: "Impostos", data: porMes.map((m) => m.imposto), backgroundColor: "rgba(239,68,68,0.4)", borderColor: "#ef4444", borderWidth: 1, borderRadius: 4, yAxisID: "y" },
          { type: "line", label: "Saldo Líquido Acumulado", data: acumuladoNorm, borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 2, pointBackgroundColor: "#6366f1", pointRadius: 3, pointHoverRadius: 5, fill: true, tension: 0.4, yAxisID: "y" } as any,
        ],
      };
      this.chartReady = true;
    }, 50);
  }

  get pctUtilizado(): number {
    return this.resumo.saldoLiquido > 0 ? (this.resumo.totalUtilizado / this.resumo.saldoLiquido) * 100 : 0;
  }
  get pctDisponivel(): number { return 100 - this.pctUtilizado; }
}
