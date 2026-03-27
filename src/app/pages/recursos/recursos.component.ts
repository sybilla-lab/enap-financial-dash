import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { DataService } from "../../services/data.service";
import { RecursoResumo } from "../../models/lancamento.model";
import { ThemeService } from "../../services/theme.service";

Chart.register(...registerables);

@Component({
  selector: "app-recursos",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    BaseChartDirective,
  ],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>account_balance</mat-icon>
        Recursos — Aporte vs Captação
      </h1>

      <div class="kpi-grid">
        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon aporte"><mat-icon>arrow_downward</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Aporte ENAP</span>
              <span class="kpi-value">{{ totalAporte | currency: "BRL":"symbol":"1.2-2" }}</span>
              <span class="kpi-sub">Meta: {{ dataService.META_APORTE | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="percentualAporte" color="primary"></mat-progress-bar>
            <span class="kpi-pct">{{ percentualAporte | number: "1.1-1" }}% da meta</span>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon captacao"><mat-icon>trending_up</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Captação</span>
              <span class="kpi-value">{{ totalCaptacao | currency: "BRL":"symbol":"1.2-2" }}</span>
              <span class="kpi-sub">Meta: {{ dataService.META_CAPTACAO | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="percentualCaptacao" color="accent"></mat-progress-bar>
            <span class="kpi-pct">{{ percentualCaptacao | number: "1.1-1" }}% da meta</span>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon total"><mat-icon>assessment</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Total Recebido</span>
              <span class="kpi-value">{{ totalAporte + totalCaptacao | currency: "BRL":"symbol":"1.2-2" }}</span>
              <span class="kpi-sub">Meta Total: {{ dataService.META_TOTAL | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="percentualTotal"></mat-progress-bar>
            <span class="kpi-pct">{{ percentualTotal | number: "1.1-1" }}% da meta total</span>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Chart -->
      <div class="chart-row">
        <mat-card class="chart-card" appearance="outlined">
          <mat-card-header><mat-card-title>Distribuição dos Recursos</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper">
              @if (pieChartReady) {
              <canvas baseChart
                [data]="pieChartData"
                [options]="pieChartOptions"
                [type]="'doughnut'">
              </canvas>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="chart-card" appearance="outlined">
          <mat-card-header><mat-card-title>Aporte vs Captação (Barras)</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper">
              @if (barChartReady) {
              <canvas baseChart
                [data]="barChartData"
                [options]="barChartOptions"
                [type]="'bar'">
              </canvas>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Table -->
      <mat-card class="table-card" appearance="outlined">
        <mat-card-header>
          <mat-card-title><mat-icon>table_chart</mat-icon> Tabela Consolidada</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipo de Recurso</th>
                <th class="num">Valor Total</th>
                <th class="num">% Participação</th>
              </tr>
            </thead>
            <tbody>
              @for (r of recursos; track r.tipo) {
              <tr>
                <td>{{ r.tipo }}</td>
                <td class="num">{{ r.total | currency: "BRL":"symbol":"1.2-2" }}</td>
                <td class="num">{{ r.percentual | number: "1.1-1" }}%</td>
              </tr>
              }
            </tbody>
          </table>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .page-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .page-title {
      display: flex; align-items: center; gap: 12px;
      font-size: 28px; font-weight: 300; margin-bottom: 24px; color: var(--text-primary);
    }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg) !important; border: 1px solid var(--border-color) !important; border-radius: 16px !important; transition: transform 0.2s; }
    .kpi-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
    .kpi-card mat-card-content { display: flex; flex-direction: column; gap: 10px; padding: 20px; }
    .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .kpi-icon mat-icon { color: #fff; font-size: 28px; width: 28px; height: 28px; }
    .aporte { background: linear-gradient(135deg, #7c4dff, #651fff); }
    .captacao { background: linear-gradient(135deg, #00bcd4, #0097a7); }
    .total { background: linear-gradient(135deg, #ff9800, #e65100); }
    .kpi-info { display: flex; flex-direction: column; }
    .kpi-label { font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 24px; font-weight: 600; color: var(--text-primary); }
    .kpi-sub { font-size: 12px; color: var(--text-secondary); }
    .kpi-pct { font-size: 12px; color: var(--text-secondary); text-align: right; }
    mat-progress-bar { border-radius: 4px; height: 6px !important; }
    .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    @media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } }
    .chart-card { background: var(--card-bg) !important; border: 1px solid var(--border-color) !important; border-radius: 16px !important; }
    .chart-card mat-card-header { padding: 20px 20px 0; }
    .chart-card mat-card-title { font-size: 16px; font-weight: 500; color: var(--text-primary); }
    .chart-wrapper { padding: 16px; height: 300px; display: flex; align-items: center; justify-content: center; }
    .chart-wrapper canvas { max-height: 280px; }
    .table-card { background: var(--card-bg) !important; border: 1px solid var(--border-color) !important; border-radius: 16px !important; }
    .table-card mat-card-header { padding: 20px 20px 0; }
    .table-card mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 16px; color: var(--text-primary); }
    .data-table { width: 100%; border-collapse: collapse; font-size: 14px; padding: 16px; }
    .data-table th { padding: 12px 16px; text-align: left; border-bottom: 2px solid var(--border-color); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 12px; }
    .data-table td { padding: 10px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .num { text-align: right !important; }
  `,
})
export class RecursosComponent implements OnInit {
  recursos: RecursoResumo[] = [];
  totalAporte = 0;
  totalCaptacao = 0;
  percentualAporte = 0;
  percentualCaptacao = 0;
  percentualTotal = 0;

  pieChartReady = false;
  barChartReady = false;

  pieChartData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  pieChartOptions: ChartConfiguration<"doughnut">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { color: "#ccc", padding: 20 } },
    },
  };

  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };

  constructor(
    public dataService: DataService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.dataService.getRecursos().subscribe((recursos) => {
      this.recursos = recursos;
      const aporte = recursos.find((r) => r.tipo === "Aporte ENAP");
      const captacao = recursos.find((r) => r.tipo === "Captação");

      this.totalAporte = aporte?.total || 0;
      this.totalCaptacao = captacao?.total || 0;

      this.percentualAporte = this.dataService.META_APORTE > 0 ? (this.totalAporte / this.dataService.META_APORTE) * 100 : 0;
      this.percentualCaptacao = this.dataService.META_CAPTACAO > 0 ? (this.totalCaptacao / this.dataService.META_CAPTACAO) * 100 : 0;
      this.percentualTotal = this.dataService.META_TOTAL > 0 ? ((this.totalAporte + this.totalCaptacao) / this.dataService.META_TOTAL) * 100 : 0;

      this.pieChartData = {
        labels: ["Aporte ENAP", "Captação"],
        datasets: [{
          data: [this.totalAporte, this.totalCaptacao],
          backgroundColor: ["#7c4dff", "#00bcd4"],
          borderWidth: 0,
        }],
      };
      this.pieChartReady = true;

      this.barChartData = {
        labels: ["Aporte ENAP", "Captação"],
        datasets: [{
          data: [this.totalAporte, this.totalCaptacao],
          backgroundColor: ["rgba(124, 77, 255, 0.8)", "rgba(0, 188, 212, 0.8)"],
          borderRadius: 8,
        }],
      };
      this.barChartReady = true;
    });
  }
}
