import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatChipsModule } from "@angular/material/chips";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { DataService } from "../../services/data.service";
import { RecursoDetalhado, Recebimento } from "../../models/lancamento.model";

Chart.register(...registerables);

@Component({
  selector: "app-recursos",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    BaseChartDirective,
  ],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>account_balance</mat-icon>
        Recursos — Aporte vs Captação
      </h1>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon aporte"><mat-icon>arrow_downward</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Aporte ENAP</span>
              <span class="kpi-value">{{ detalhado.aporteRecebido | currency: "BRL":"symbol":"1.2-2" }}</span>
              <span class="kpi-sub">Meta: {{ dataService.META_APORTE | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="pctAporte" color="primary"></mat-progress-bar>
            <span class="kpi-pct">{{ pctAporte | number: "1.1-1" }}% da meta</span>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon captacao-recebida"><mat-icon>check_circle</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Captação Recebida</span>
              <span class="kpi-value">{{ detalhado.captacaoRecebida | currency: "BRL":"symbol":"1.2-2" }}</span>
              <span class="kpi-sub">Meta: {{ dataService.META_CAPTACAO | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="pctCaptacaoRecebida" color="accent"></mat-progress-bar>
            <span class="kpi-pct">{{ pctCaptacaoRecebida | number: "1.1-1" }}% da meta (recebido)</span>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card highlight" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon captacao-total"><mat-icon>trending_up</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Captação Total (Recebida + Prevista)</span>
              <span class="kpi-value">{{ detalhado.captacaoTotal | currency: "BRL":"symbol":"1.2-2" }}</span>
              <span class="kpi-sub">
                Prevista: {{ detalhado.captacaoPrevista | currency: "BRL":"symbol":"1.2-2" }}
                (parcelas de contratos assinados)
              </span>
            </div>
            <mat-progress-bar mode="determinate" [value]="pctCaptacaoTotal" color="warn"></mat-progress-bar>
            <span class="kpi-pct">{{ pctCaptacaoTotal | number: "1.1-1" }}% da meta (total)</span>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Total row -->
      <div class="kpi-grid secondary">
        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon total-recebido"><mat-icon>account_balance_wallet</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Total Recebido (Aporte + Captação Recebida)</span>
              <span class="kpi-value">{{ detalhado.totalRecebido | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="pctTotalRecebido"></mat-progress-bar>
            <span class="kpi-pct">{{ pctTotalRecebido | number: "1.1-1" }}% da meta total</span>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card highlight" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon total-previsto"><mat-icon>assessment</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Total com Previstos (Aporte + Captação Total)</span>
              <span class="kpi-value">{{ detalhado.totalComPrevisto | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="pctTotalComPrevisto" color="warn"></mat-progress-bar>
            <span class="kpi-pct">{{ pctTotalComPrevisto | number: "1.1-1" }}% da meta total</span>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Charts -->
      <div class="chart-row">
        <mat-card class="chart-card" appearance="outlined">
          <mat-card-header><mat-card-title>Distribuição — Visão Recebido</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper">
              @if (doughnutReady) {
              <canvas baseChart [data]="doughnutData" [options]="doughnutOptions" [type]="'doughnut'"></canvas>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="chart-card" appearance="outlined">
          <mat-card-header><mat-card-title>Captação — Recebido vs Previsto</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper">
              @if (barReady) {
              <canvas baseChart [data]="barData" [options]="barOptions" [type]="'bar'"></canvas>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Table -->
      <mat-card class="table-card" appearance="outlined">
        <mat-card-header>
          <mat-card-title><mat-icon>table_chart</mat-icon> Detalhamento de Recebimentos</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Fornecedor</th>
                  <th>Tipo</th>
                  <th>Mês/Ano</th>
                  <th class="num">Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (r of recebimentos; track $index) {
                <tr>
                  <td>{{ r.projeto }}</td>
                  <td>{{ r.fornecedor }}</td>
                  <td>{{ r.observacao }}</td>
                  <td>{{ r.mesAno }}</td>
                  <td class="num positive">{{ r.valor | currency: "BRL":"symbol":"1.2-2" }}</td>
                  <td>
                    <span class="status-badge" [class.recebido]="r.status === 'recebido'" [class.previsto]="r.status === 'previsto'">
                      {{ r.status }}
                    </span>
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .page-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .page-title { display: flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 300; margin-bottom: 24px; color: var(--text-primary); }

    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg) !important; border: 1px solid var(--border-color) !important; border-radius: 16px !important; transition: transform 0.2s; }
    .kpi-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
    .kpi-card.highlight { border-color: rgba(255, 171, 64, 0.3) !important; }
    .kpi-card mat-card-content { display: flex; flex-direction: column; gap: 10px; padding: 20px; }

    .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .kpi-icon mat-icon { color: #fff; font-size: 28px; width: 28px; height: 28px; }
    .aporte { background: linear-gradient(135deg, #7c4dff, #651fff); }
    .captacao-recebida { background: linear-gradient(135deg, #00bcd4, #0097a7); }
    .captacao-total { background: linear-gradient(135deg, #ff9800, #e65100); }
    .total-recebido { background: linear-gradient(135deg, #4caf50, #2e7d32); }
    .total-previsto { background: linear-gradient(135deg, #ff9800, #f57c00); }

    .kpi-info { display: flex; flex-direction: column; }
    .kpi-label { font-size: 13px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 24px; font-weight: 600; color: var(--text-primary); }
    .kpi-sub { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
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
    .table-container { overflow-x: auto; padding: 16px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .data-table th { padding: 12px 16px; text-align: left; border-bottom: 2px solid var(--border-color); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 12px; }
    .data-table td { padding: 10px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .data-table tr:hover td { background: var(--hover-bg); }
    .num { text-align: right !important; }
    .positive { color: #4caf50 !important; }

    .status-badge {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .status-badge.recebido { background: rgba(76, 175, 80, 0.15); color: #4caf50; }
    .status-badge.previsto { background: rgba(255, 152, 0, 0.15); color: #ff9800; }
  `,
})
export class RecursosComponent implements OnInit {
  detalhado: RecursoDetalhado = {
    aporteRecebido: 0, captacaoRecebida: 0, captacaoPrevista: 0,
    captacaoTotal: 0, totalRecebido: 0, totalComPrevisto: 0,
  };
  recebimentos: Recebimento[] = [];

  pctAporte = 0;
  pctCaptacaoRecebida = 0;
  pctCaptacaoTotal = 0;
  pctTotalRecebido = 0;
  pctTotalComPrevisto = 0;

  doughnutReady = false;
  barReady = false;

  doughnutData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  doughnutOptions: ChartConfiguration<"doughnut">["options"] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { color: "#ccc", padding: 20 } } },
  };

  barData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top", labels: { color: "#ccc" } } },
    scales: {
      x: { ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };

  constructor(public dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getRecursoDetalhado().subscribe((d) => {
      this.detalhado = d;

      this.pctAporte = this.dataService.META_APORTE > 0 ? (d.aporteRecebido / this.dataService.META_APORTE) * 100 : 0;
      this.pctCaptacaoRecebida = this.dataService.META_CAPTACAO > 0 ? (d.captacaoRecebida / this.dataService.META_CAPTACAO) * 100 : 0;
      this.pctCaptacaoTotal = this.dataService.META_CAPTACAO > 0 ? (d.captacaoTotal / this.dataService.META_CAPTACAO) * 100 : 0;
      this.pctTotalRecebido = this.dataService.META_TOTAL > 0 ? (d.totalRecebido / this.dataService.META_TOTAL) * 100 : 0;
      this.pctTotalComPrevisto = this.dataService.META_TOTAL > 0 ? (d.totalComPrevisto / this.dataService.META_TOTAL) * 100 : 0;

      // Doughnut: Aporte vs Captação Recebida vs Captação Prevista
      this.doughnutData = {
        labels: ["Aporte ENAP", "Captação Recebida", "Captação Prevista"],
        datasets: [{
          data: [d.aporteRecebido, d.captacaoRecebida, d.captacaoPrevista],
          backgroundColor: ["#7c4dff", "#00bcd4", "#ff9800"],
          borderWidth: 0,
        }],
      };
      this.doughnutReady = true;

      // Bar: Recebido vs Previsto
      this.barData = {
        labels: ["Aporte", "Captação"],
        datasets: [
          {
            label: "Recebido",
            data: [d.aporteRecebido, d.captacaoRecebida],
            backgroundColor: "rgba(0, 188, 212, 0.8)",
            borderRadius: 8,
          },
          {
            label: "Previsto",
            data: [0, d.captacaoPrevista],
            backgroundColor: "rgba(255, 152, 0, 0.8)",
            borderRadius: 8,
          },
        ],
      };
      this.barReady = true;
    });

    this.dataService.getRecebimentosDetalhados().subscribe((r) => {
      this.recebimentos = r;
    });
  }
}
