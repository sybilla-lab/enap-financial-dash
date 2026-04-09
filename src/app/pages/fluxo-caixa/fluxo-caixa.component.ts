import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import { FluxoMensal } from "../../models/lancamento.model";

const PROJETO_COLORS = [
  { bg: "rgba(99,102,241,0.18)",  border: "#6366f1", text: "#a5b4fc" },
  { bg: "rgba(16,185,129,0.18)",  border: "#10b981", text: "#6ee7b7" },
  { bg: "rgba(245,158,11,0.18)",  border: "#f59e0b", text: "#fcd34d" },
  { bg: "rgba(236,72,153,0.18)",  border: "#ec4899", text: "#f9a8d4" },
  { bg: "rgba(6,182,212,0.18)",   border: "#06b6d4", text: "#67e8f9" },
  { bg: "rgba(139,92,246,0.18)",  border: "#8b5cf6", text: "#c4b5fd" },
  { bg: "rgba(239,68,68,0.18)",   border: "#ef4444", text: "#fca5a5" },
  { bg: "rgba(20,184,166,0.18)",  border: "#14b8a6", text: "#5eead4" },
];

@Component({
  selector: "app-fluxo-caixa",
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, BaseChartDirective],
  templateUrl: "./fluxo-caixa.component.html",
  styleUrl: "./fluxo-caixa.component.scss",
})
export class FluxoCaixaComponent implements OnInit {
  lancamentosOriginais: any[] = [];
  fluxo: FluxoMensal[] = [];
  projetos: string[] = [];
  anos: string[] = [];
  chartReady = false;
  totais = { entradas: 0, saidas: 0, saldoAtual: 0 };

  filtroAnos: string[] = [];
  filtroProjetos: string[] = [];
  filtroMeses: string[] = [];
  filtrosAbertos = false;

  get totalFiltrosAtivos(): number {
    return this.filtroAnos.length + this.filtroProjetos.length + this.filtroMeses.length;
  }

  limparFiltros(): void {
    this.filtroAnos = [];
    this.filtroProjetos = [];
    this.filtroMeses = [];
    this.aplicarFiltros();
  }

  readonly meses = [
    { valor: "01", abrev: "Jan" },
    { valor: "02", abrev: "Fev" },
    { valor: "03", abrev: "Mar" },
    { valor: "04", abrev: "Abr" },
    { valor: "05", abrev: "Mai" },
    { valor: "06", abrev: "Jun" },
    { valor: "07", abrev: "Jul" },
    { valor: "08", abrev: "Ago" },
    { valor: "09", abrev: "Set" },
    { valor: "10", abrev: "Out" },
    { valor: "11", abrev: "Nov" },
    { valor: "12", abrev: "Dez" },
  ];

  mixedChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  mixedChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#94a3b8", font: { weight: "bold" } } },
      datalabels: { display: false },
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { display: false } },
      y: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y1: {
        type: "linear",
        position: "right",
        ticks: { color: "#6366f1" },
        grid: { display: false },
      },
    },
  };

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.lancamentos$.subscribe((lancs) => {
      this.lancamentosOriginais = lancs;
      this.anos = [...new Set(lancs.map(l => l.mesAno?.split("/")[1]).filter(Boolean))].sort();
      this.aplicarFiltros();
    });

    this.dataService.getProjetosUnicos().subscribe((projs) => {
      this.projetos = projs.sort();
    });
  }

  getProjetoColor(projeto: string) {
    const idx = this.projetos.indexOf(projeto) % PROJETO_COLORS.length;
    return PROJETO_COLORS[idx < 0 ? 0 : idx];
  }

  toggleAno(ano: string): void {
    const idx = this.filtroAnos.indexOf(ano);
    if (idx >= 0) this.filtroAnos.splice(idx, 1);
    else this.filtroAnos.push(ano);
    this.aplicarFiltros();
  }

  toggleProjeto(projeto: string): void {
    const idx = this.filtroProjetos.indexOf(projeto);
    if (idx >= 0) this.filtroProjetos.splice(idx, 1);
    else this.filtroProjetos.push(projeto);
    this.aplicarFiltros();
  }

  toggleMes(valor: string): void {
    const idx = this.filtroMeses.indexOf(valor);
    if (idx >= 0) this.filtroMeses.splice(idx, 1);
    else this.filtroMeses.push(valor);
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    let filtrados = this.lancamentosOriginais;

    if (this.filtroAnos.length > 0) {
      filtrados = filtrados.filter(l => {
        const ano = l.mesAno?.split("/")[1];
        return this.filtroAnos.includes(ano);
      });
    }

    if (this.filtroProjetos.length > 0) {
      filtrados = filtrados.filter(l => this.filtroProjetos.includes(l.projeto));
    }

    if (this.filtroMeses.length > 0) {
      filtrados = filtrados.filter(l => {
        const mes = l.mesAno?.split("/")[0];
        return this.filtroMeses.includes(mes);
      });
    }

    const porMes = new Map<string, { entradas: number; saidas: number }>();
    filtrados.forEach((l) => {
      if (!l.mesAno) return;
      if (!porMes.has(l.mesAno)) porMes.set(l.mesAno, { entradas: 0, saidas: 0 });
      const m = porMes.get(l.mesAno)!;
      if (l.valor >= 0) m.entradas += l.valor;
      else m.saidas += Math.abs(l.valor);
    });

    const sorted = Array.from(porMes.entries()).sort((a, b) => {
      const [ma, ya] = a[0].split("/");
      const [mb, yb] = b[0].split("/");
      return (parseInt(ya) * 100 + parseInt(ma)) - (parseInt(yb) * 100 + parseInt(mb));
    });

    let acumulado = 0;
    this.fluxo = sorted.map(([mesAno, data]) => {
      acumulado += data.entradas - data.saidas;
      return { mesAno, entradas: data.entradas, saidas: data.saidas, saldoAcumulado: acumulado };
    });

    this.totais = {
      entradas: this.fluxo.reduce((acc, curr) => acc + curr.entradas, 0),
      saidas: this.fluxo.reduce((acc, curr) => acc + curr.saidas, 0),
      saldoAtual: this.fluxo[this.fluxo.length - 1]?.saldoAcumulado || 0,
    };

    this.renderizarGrafico();
  }

  private renderizarGrafico(): void {
    this.chartReady = false;
    setTimeout(() => {
      this.mixedChartData = {
        labels: this.fluxo.map((f: FluxoMensal) => f.mesAno),
        datasets: [
          {
            type: "bar", label: "Entradas",
            data: this.fluxo.map((f: FluxoMensal) => f.entradas),
            backgroundColor: "rgba(16, 185, 129, 0.4)", borderColor: "#10b981",
            borderWidth: 1, borderRadius: 4, yAxisID: "y",
          },
          {
            type: "bar", label: "Saídas",
            data: this.fluxo.map((f: FluxoMensal) => f.saidas),
            backgroundColor: "rgba(239, 68, 68, 0.4)", borderColor: "#ef4444",
            borderWidth: 1, borderRadius: 4, yAxisID: "y",
          },
          {
            type: "line", label: "Saldo Acumulado",
            data: this.fluxo.map((f: FluxoMensal) => f.saldoAcumulado),
            borderColor: "#6366f1", backgroundColor: "rgba(99, 102, 241, 0.1)",
            borderWidth: 3, pointBackgroundColor: "#6366f1", pointRadius: 2,
            fill: true, tension: 0.4, yAxisID: "y1",
          } as any,
        ],
      };
      this.chartReady = true;
    }, 50);
  }
}
