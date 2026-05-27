import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { ActivatedRoute } from "@angular/router";
import { Subject, combineLatest, takeUntil } from "rxjs";
import { DataService } from "../../services/data.service";
import { Lancamento, StatusProjeto } from "../../models/lancamento.model";
import ChartDataLabels from "chartjs-plugin-datalabels";

Chart.register(...registerables, ChartDataLabels);

interface ProjetoSnapshot {
  projeto: string;
  entradas: number;
  saidas: number;
  saldo: number;
  execucao: number;
  numPagamentos: number;
  ticketMedio: number;
  status: string;
}

interface CategoriaLocal {
  categoria: string;
  total: number;
  percentual: number;
}

interface FluxoLocal {
  mesAno: string;
  entradas: number;
  saidas: number;
  saldoAcumulado: number;
}

interface TransacaoRecente {
  mesAno: string;
  categoria: string;
  fornecedor: string;
  observacao: string;
  valor: number;
}

@Component({
  selector: "app-visao-projeto",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    BaseChartDirective,
  ],
  templateUrl: "./visao-projeto.component.html",
  styleUrl: "./visao-projeto.component.scss",
})
export class VisaoProjetoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  projetos: string[] = [];
  projetoSelecionado: string | null = null;

  private inicializado = false;

  // Filtros de data
  anosDisponiveis: string[] = [];
  filtroAnos: string[] = [];
  filtroMeses: string[] = [];
  filtrosAbertos = true;

  readonly meses = [
    { valor: "01", abrev: "Jan" }, { valor: "02", abrev: "Fev" },
    { valor: "03", abrev: "Mar" }, { valor: "04", abrev: "Abr" },
    { valor: "05", abrev: "Mai" }, { valor: "06", abrev: "Jun" },
    { valor: "07", abrev: "Jul" }, { valor: "08", abrev: "Ago" },
    { valor: "09", abrev: "Set" }, { valor: "10", abrev: "Out" },
    { valor: "11", abrev: "Nov" }, { valor: "12", abrev: "Dez" },
  ];

  get totalFiltrosAtivos(): number {
    return this.filtroAnos.length + this.filtroMeses.length;
  }

  allLancamentos: Lancamento[] = [];
  statusMap = new Map<string, string>();

  snapshot: ProjetoSnapshot | null = null;
  categorias: CategoriaLocal[] = [];
  fluxo: FluxoLocal[] = [];
  transacoesRecentes: TransacaoRecente[] = [];

  chartCategoriasReady = false;
  chartFluxoReady = false;

  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: "end",
        align: "end",
        color: "#94a3b8",
        font: { weight: "bold", size: 11 },
        formatter: (value: number, ctx: any) => {
          const data = ctx.chart.data.datasets[0].data as number[];
          const total = data.reduce((a: number, b: number) => a + b, 0);
          const pct = total > 0 ? (value / total) * 100 : 0;
          return pct.toFixed(1).replace(".", ",") + "%";
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed.x;
            return " " + new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
          },
        },
      },
    },
    layout: { padding: { right: 60 } },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,0.04)" } },
      y: { ticks: { color: "#94a3b8", font: { size: 11 } }, grid: { display: false } },
    },
  };

  mixedChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  mixedChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#94a3b8", font: { weight: "bold" } } },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed.y;
            return " " + new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { display: false } },
      y: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,0.04)" } },
      y1: {
        type: "linear",
        position: "right",
        ticks: { color: "#f59e0b" },
        grid: { display: false },
      },
    },
  };

  constructor(private dataService: DataService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const projetoFromUrl = this.route.snapshot.queryParamMap.get('p');

    combineLatest({
      lancs: this.dataService.lancamentos$,
      status: this.dataService.status$,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ lancs, status }) => {
        this.allLancamentos = lancs;
        this.statusMap = new Map(status.map((s: StatusProjeto) => [s.projeto, s.status]));

        const projetosSet = [...new Set(lancs.map((l) => l.projeto).filter(Boolean))];
        this.projetos = projetosSet.sort();
        this.anosDisponiveis = [...new Set(lancs.map((l) => l.mesAno?.split("/")[1]).filter(Boolean))].sort();

        if (this.inicializado) return;
        this.inicializado = true;
        if (projetoFromUrl && this.projetos.includes(projetoFromUrl)) {
          this.projetoSelecionado = projetoFromUrl;
        }
        // null = Todos (padrão quando não há ?p=)
        this.processData();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectProjeto(projeto: string | null): void {
    this.projetoSelecionado = projeto;
    this.processData();
  }

  toggleAno(ano: string): void {
    const idx = this.filtroAnos.indexOf(ano);
    if (idx >= 0) this.filtroAnos.splice(idx, 1);
    else this.filtroAnos.push(ano);
    this.processData();
  }

  toggleMes(mes: string): void {
    const idx = this.filtroMeses.indexOf(mes);
    if (idx >= 0) this.filtroMeses.splice(idx, 1);
    else this.filtroMeses.push(mes);
    this.processData();
  }

  limparFiltrosData(): void {
    this.filtroAnos = [];
    this.filtroMeses = [];
    this.processData();
  }

  getStatusClass(status: string): string {
    const s = (status || "").toLowerCase();
    if (s.includes("encerr")) return "status-warning";
    if (s.includes("finaliz")) return "status-neutral";
    return "status-active";
  }

  private processData(): void {
    const isTodos = this.projetoSelecionado === null;

    let filtered = isTodos
      ? this.allLancamentos
      : this.allLancamentos.filter((l) => l.projeto === this.projetoSelecionado);

    // Aplicar filtros de data
    if (this.filtroAnos.length > 0) {
      filtered = filtered.filter((l) => {
        const ano = l.mesAno?.split("/")[1];
        return ano && this.filtroAnos.includes(ano);
      });
    }
    if (this.filtroMeses.length > 0) {
      filtered = filtered.filter((l) => {
        const mes = l.mesAno?.split("/")[0];
        return mes && this.filtroMeses.includes(mes);
      });
    }

    // KPI snapshot
    const entradas = filtered
      .filter((l) => l.valor >= 0)
      .reduce((s, l) => s + l.valor, 0);
    const despesas = filtered.filter(
      (l) => l.valor < 0 && l.categoria !== "0.0.0 Recurso"
    );
    const saidas = despesas.reduce((s, l) => s + Math.abs(l.valor), 0);

    const ativos = isTodos
      ? this.projetos.filter((p) => (this.statusMap.get(p) || "Ativo").toLowerCase().includes("ativo")).length
      : 0;

    this.snapshot = {
      projeto: isTodos ? `Todos os ${this.projetos.length} projetos` : this.projetoSelecionado!,
      entradas,
      saidas,
      saldo: entradas - saidas,
      execucao: entradas > 0 ? (saidas / entradas) * 100 : 0,
      numPagamentos: despesas.length,
      ticketMedio: despesas.length > 0 ? saidas / despesas.length : 0,
      status: isTodos ? `${ativos} ativos` : (this.statusMap.get(this.projetoSelecionado!) || "Ativo"),
    };

    // Categorias
    const catMap = new Map<string, number>();
    filtered
      .filter((l) => l.categoria !== "0.0.0 Recurso" && l.valor < 0)
      .forEach((l) => {
        const cat = l.categoria.replace(/^\d+(\.\d+)*\s*/, "").trim();
        catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(l.valor));
      });
    const catTotal = Array.from(catMap.values()).reduce((s, v) => s + v, 0);
    this.categorias = Array.from(catMap.entries())
      .map(([categoria, total]) => ({
        categoria,
        total,
        percentual: catTotal > 0 ? (total / catTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Fluxo mensal
    const fluxoMap = new Map<string, { entradas: number; saidas: number }>();
    filtered.forEach((l) => {
      if (!l.mesAno) return;
      if (!fluxoMap.has(l.mesAno)) fluxoMap.set(l.mesAno, { entradas: 0, saidas: 0 });
      const m = fluxoMap.get(l.mesAno)!;
      if (l.valor >= 0) m.entradas += l.valor;
      else m.saidas += Math.abs(l.valor);
    });
    const sortedFluxo = Array.from(fluxoMap.entries()).sort((a, b) => {
      const [ma, ya] = a[0].split("/");
      const [mb, yb] = b[0].split("/");
      return (parseInt(ya) * 100 + parseInt(ma)) - (parseInt(yb) * 100 + parseInt(mb));
    });
    let acumulado = 0;
    this.fluxo = sortedFluxo.map(([mesAno, data]) => {
      acumulado += data.entradas - data.saidas;
      return { mesAno, entradas: data.entradas, saidas: data.saidas, saldoAcumulado: acumulado };
    });

    // Transações recentes (saídas apenas, ordenadas por mesAno desc, top 20)
    this.transacoesRecentes = filtered
      .filter((l) => l.valor < 0 && l.categoria !== "0.0.0 Recurso")
      .map((l) => ({
        mesAno: l.mesAno,
        categoria: l.categoria.replace(/^\d+(\.\d+)*\s*/, "").trim(),
        fornecedor: l.fornecedor || "—",
        observacao: l.observacao,
        valor: Math.abs(l.valor),
      }))
      .sort((a, b) => {
        const [ma, ya] = a.mesAno.split("/");
        const [mb, yb] = b.mesAno.split("/");
        return (parseInt(yb) * 100 + parseInt(mb)) - (parseInt(ya) * 100 + parseInt(ma));
      })
      .slice(0, 25);

    this.renderCharts();
  }

  private renderCharts(): void {
    this.chartCategoriasReady = false;
    this.chartFluxoReady = false;

    const colors = this.generateColors(this.categorias.length);

    setTimeout(() => {
      this.barChartData = {
        labels: this.categorias.map((c) => c.categoria),
        datasets: [
          {
            label: "Despesas",
            data: this.categorias.map((c) => c.total),
            backgroundColor: colors,
            borderRadius: 5,
          },
        ],
      };
      this.chartCategoriasReady = true;
    }, 30);

    setTimeout(() => {
      this.mixedChartData = {
        labels: this.fluxo.map((f) => f.mesAno),
        datasets: [
          {
            type: "bar",
            label: "Entradas",
            data: this.fluxo.map((f) => f.entradas),
            backgroundColor: "rgba(16,185,129,0.35)",
            borderColor: "#10b981",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Saídas",
            data: this.fluxo.map((f) => f.saidas),
            backgroundColor: "rgba(239,68,68,0.35)",
            borderColor: "#ef4444",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "line",
            label: "Saldo Acumulado",
            data: this.fluxo.map((f) => f.saldoAcumulado),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245,158,11,0.08)",
            borderWidth: 3,
            pointBackgroundColor: "#f59e0b",
            pointRadius: 3,
            fill: true,
            tension: 0.4,
            yAxisID: "y1",
          } as any,
        ],
      };
      this.chartFluxoReady = true;
    }, 50);
  }

  private generateColors(count: number): string[] {
    const palette = [
      "rgba(99,102,241,0.75)",
      "rgba(16,185,129,0.75)",
      "rgba(100,116,139,0.75)",
      "rgba(245,158,11,0.75)",
      "rgba(239,68,68,0.75)",
      "rgba(139,92,246,0.75)",
      "rgba(20,184,166,0.75)",
      "rgba(249,115,22,0.75)",
      "rgba(59,130,246,0.75)",
      "rgba(107,114,128,0.75)",
      "rgba(168,85,247,0.75)",
      "rgba(236,72,153,0.75)",
      "rgba(14,165,233,0.75)",
    ];
    return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
  }
}
