import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { MatDividerModule } from "@angular/material/divider";
import { MatExpansionModule } from "@angular/material/expansion";
import { DataService } from "../../services/data.service";
import { RecursoDetalhado, Recebimento } from "../../models/lancamento.model";
// Chart.register foi movido para o main.ts

@Component({
  selector: "app-recursos",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatDividerModule,
    MatExpansionModule,
    BaseChartDirective,
  ],
  templateUrl: "./recursos.component.html",
  styleUrl: "./recursos.component.scss",
})
export class RecursosComponent implements OnInit {
  detalhado: RecursoDetalhado = {
    aporteRecebido: 0, aporteInflacao: 0, aporteRecebidoTotal: 0, aportePrevisto: 0,
    captacaoRecebida: 0, captacaoPrevista: 0,
    captacaoTotal: 0, saldoACaptar: 0, totalRecebido: 0, totalComPrevisto: 0,
  };
  recebimentos: Recebimento[] = [];
  recebimentosFiltrados: Recebimento[] = [];

  getProgressColor(percent: number): string {
    if (percent >= 100) return "var(--accent-green)";
    if (percent >= 75) return "var(--accent-primary)";
    if (percent >= 40) return "var(--accent-yellow)";
    return "var(--accent-red)";
  }

  filtroProjeto = "";
  filtroTipo = "";
  filtroPeriodo = "";
  isLoading = true;

  pctAporte = 0;
  pctCaptacaoRecebida = 0;
  pctCaptacaoTotal = 0;
  pctTotalRecebido = 0;
  pctTotalComPrevisto = 0;

  doughnutReady = false;
  barReady = false;

  public pieData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  public pieOptions: ChartConfiguration<"doughnut">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: { position: "right", labels: { color: "#d1d5db", font: { size: 11, weight: "bold" }, usePointStyle: true, padding: 15 } },
      datalabels: { display: false }
    },
  };

  barData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#d1d5db", font: { size: 12, weight: "bold" } } },
      datalabels: { display: false }
    },
    scales: {
      x: { stacked: false, ticks: { color: "#94a3b8" }, grid: { display: false } },
      y: { stacked: false, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.03)" } },
    },
  };

  constructor(public dataService: DataService) { }

  ngOnInit(): void {
    this.dataService.getRecursoDetalhado().subscribe((d) => {
      this.isLoading = false;
      this.detalhado = d;

      this.pctAporte = this.dataService.META_APORTE > 0 ? (d.aporteRecebido / this.dataService.META_APORTE) * 100 : 0;
      this.pctCaptacaoRecebida = this.dataService.META_CAPTACAO > 0 ? (d.captacaoRecebida / this.dataService.META_CAPTACAO) * 100 : 0;
      this.pctCaptacaoTotal = this.dataService.META_CAPTACAO > 0 ? (d.captacaoTotal / this.dataService.META_CAPTACAO) * 100 : 0;
      this.pctTotalRecebido = this.dataService.META_TOTAL > 0 ? (d.totalRecebido / this.dataService.META_TOTAL) * 100 : 0;
      this.pctTotalComPrevisto = this.dataService.META_TOTAL > 0 ? (d.totalComPrevisto / this.dataService.META_TOTAL) * 100 : 0;

      this.pieData = {
        labels: ["Aporte Recebido", "Inflação", "Captação Recebida", "Captação Prevista", "Aporte Previsto"],
        datasets: [{
          data: [
            d.aporteRecebido,
            d.aporteInflacao,
            d.captacaoRecebida,
            d.captacaoPrevista,
            d.aportePrevisto
          ],
          backgroundColor: [
            "#8B5CF6", // Roxo - Aporte
            "#FBBF24", // Amarelo - Inflação
            "#10b981", // Verde Esmeralda - Captação Recebida
            "#F59E0B", // Âmbar - Captação Prevista
            "#DDD6FE"  // Lavanda Claro - Aporte Previsto
          ],
          hoverOffset: 12,
          borderWidth: 0,
        }],
      };
      this.doughnutReady = true;

      this.barData = {
        labels: ["Aporte", "Captação"],
        datasets: [
          {
            label: "Recebido",
            data: [d.aporteRecebido, d.captacaoRecebida],
            backgroundColor: "#34D399",
            borderRadius: 4,
          },
          {
            label: "Previsto",
            data: [d.aportePrevisto, d.captacaoPrevista],
            backgroundColor: "rgba(16, 185, 129, 0.4)",
            borderRadius: 4,
          },
        ],
      };
      this.barReady = true;
    });

    this.dataService.getRecebimentosDetalhados().subscribe((r) => {
      this.recebimentos = r;
      this.applyFilter();
    });
  }

  applyFilter(): void {
    const proj = this.filtroProjeto.toLowerCase();
    const period = this.filtroPeriodo.toLowerCase();
    const type = this.filtroTipo.toLowerCase();

    this.recebimentosFiltrados = this.recebimentos.filter(r => {
      const matchProj = !proj || r.projeto.toLowerCase().includes(proj);
      const matchPeriod = !period || (r.mesAno || "").toLowerCase().includes(period);
      const matchType = !type || r.observacao.toLowerCase().includes(type);
      return matchProj && matchPeriod && matchType;
    });
  }
}
