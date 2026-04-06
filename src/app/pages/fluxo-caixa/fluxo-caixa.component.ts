import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { FormsModule } from "@angular/forms";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { DataService } from "../../services/data.service";
import { FluxoMensal } from "../../models/lancamento.model";
// Chart.register foi movido para o main.ts

@Component({
  selector: "app-fluxo-caixa",
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatSelectModule, MatFormFieldModule, FormsModule, BaseChartDirective],
  templateUrl: "./fluxo-caixa.component.html",
  styleUrl: "./fluxo-caixa.component.scss",
})
export class FluxoCaixaComponent implements OnInit {
  lancamentosOriginais: any[] = [];
  fluxo: FluxoMensal[] = [];
  projetos: string[] = [];
  chartReady = false;
  totais = { entradas: 0, saidas: 0, saldoAtual: 0 };
  filtroAno = "";
  filtroProjeto = "";

  mixedChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  mixedChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#94a3b8", font: { weight: 'bold' } } },
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
      this.aplicarFiltros();
    });

    this.dataService.getProjetosUnicos().subscribe((projs) => {
      this.projetos = projs.sort();
    });
  }

  aplicarFiltros(): void {
    let filtrados = this.lancamentosOriginais;

    if (this.filtroAno) {
      filtrados = filtrados.filter(l => l.mesAno.endsWith(this.filtroAno));
    }

    if (this.filtroProjeto) {
      filtrados = filtrados.filter(l => l.projeto === this.filtroProjeto);
    }

    // Agrupar por mesAno
    const porMes = new Map<string, { entradas: number; saidas: number }>();
    filtrados.forEach((l) => {
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

    // Ordenar e calcular acumulado
    const sorted = Array.from(porMes.entries()).sort((a, b) => {
      const [ma, ya] = a[0].split("/");
      const [mb, yb] = b[0].split("/");
      const dateA = parseInt(ya) * 100 + parseInt(ma);
      const dateB = parseInt(yb) * 100 + parseInt(mb);
      return dateA - dateB;
    });

    let acumulado = 0;
    this.fluxo = sorted.map(([mesAno, data]) => {
      acumulado += data.entradas - data.saidas;
      return {
        mesAno,
        entradas: data.entradas,
        saidas: data.saidas,
        saldoAcumulado: acumulado,
      };
    });

    // Calculando totais
    this.totais = {
      entradas: this.fluxo.reduce((acc, curr) => acc + curr.entradas, 0),
      saidas: this.fluxo.reduce((acc, curr) => acc + curr.saidas, 0),
      saldoAtual: this.fluxo[this.fluxo.length - 1]?.saldoAcumulado || 0
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
            type: "bar",
            label: "Entradas",
            data: this.fluxo.map((f: FluxoMensal) => f.entradas),
            backgroundColor: "rgba(16, 185, 129, 0.4)",
            borderColor: "#10b981",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Saídas",
            data: this.fluxo.map((f: FluxoMensal) => f.saidas),
            backgroundColor: "rgba(239, 68, 68, 0.4)",
            borderColor: "#ef4444",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "line",
            label: "Saldo Acumulado",
            data: this.fluxo.map((f: FluxoMensal) => f.saldoAcumulado),
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            borderWidth: 3,
            pointBackgroundColor: "#6366f1",
            pointRadius: 2,
            fill: true,
            tension: 0.4,
            yAxisID: "y1",
          } as any,
        ],
      };
      this.chartReady = true;
    }, 50);
  }
}
