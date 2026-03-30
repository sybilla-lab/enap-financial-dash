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
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatDividerModule,
    BaseChartDirective,
  ],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>account_balance</mat-icon>
        Recursos — Aporte vs Captação
      </h1>

      <!-- Aporte row -->
      <div class="section-label">Aporte ENAP</div>
      <div class="kpi-grid">
        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon aporte"><mat-icon>arrow_downward</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Aporte Recebido (sem inflação)</span>
              <span class="kpi-value">{{ detalhado.aporteRecebido | currency: "BRL":"symbol":"1.2-2" }}</span>
              <span class="kpi-sub">Meta: {{ dataService.META_APORTE | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="pctAporte" color="primary"></mat-progress-bar>
            <span class="kpi-pct">{{ pctAporte | number: "1.1-1" }}% da meta</span>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card inflacao-card" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon inflacao"><mat-icon>trending_up</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Inflação Recebida</span>
              <span class="kpi-value">{{ detalhado.aporteInflacao | currency: "BRL":"symbol":"1.2-2" }}</span>
              <span class="kpi-sub">Previsto em parceria (R$500k/ano + inflação)</span>
              <span class="kpi-sub">Não contabiliza na meta</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon aporte-prev"><mat-icon>schedule</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Aporte Previsto</span>
              <span class="kpi-value">{{ detalhado.aportePrevisto | currency: "BRL":"symbol":"1.2-2" }}</span>
              <span class="kpi-sub">Parcelas futuras previstas</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Captação row -->
      <div class="section-label">Captação Externa</div>
      <div class="kpi-grid">
      <div class="kpi-grid">
        <mat-card class="kpi-card card-indicator-green" appearance="outlined">
          <mat-card-content>
            <div class="kpi-label">Aporte Federal (Total)</div>
            <div class="kpi-value text-green">{{ detalhado.aporteRecebido | currency: "BRL":"symbol":"1.0-0" }}</div>
            <mat-progress-bar mode="determinate" [value]="pctAporte"></mat-progress-bar>
            <div class="kpi-sub">{{ pctAporte | number: "1.1-1" }}% Recebido</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-label">Captação Externa (Meta)</div>
            <div class="kpi-value text-blue">{{ detalhado.captacaoTotal | currency: "BRL":"symbol":"1.0-0" }}</div>
            <mat-progress-bar mode="determinate" [value]="pctCaptacaoRecebida"></mat-progress-bar>
            <div class="kpi-sub">{{ pctCaptacaoRecebida | number: "1.1-1" }}% da meta atingida</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-green" appearance="outlined">
          <mat-card-content>
            <div class="kpi-label">Total Recebido (Geral)</div>
            <div class="kpi-value text-green">{{ detalhado.totalRecebido | currency: "BRL":"symbol":"1.0-0" }}</div>
            <div class="kpi-sub">Soma de todas as fontes</div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Charts -->
      <div class="charts-grid">
        <mat-card class="chart-card" appearance="outlined">
          <mat-card-header><mat-card-title>Distribuição dos Recursos</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper">
              @if (doughnutReady) {
              <canvas baseChart [data]="pieData" [options]="pieOptions" [type]="'pie'"></canvas>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="chart-card" appearance="outlined">
          <mat-card-header><mat-card-title>Aporte vs Captação — Recebido vs Previsto</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper">
              @if (barReady) {
              <canvas baseChart [data]="barData" [options]="barOptions" [type]="'bar'"></canvas>
              }
            </div>
            <div class="chart-info">
              <span class="info-item"><mat-icon>info</mat-icon> Comparação direta entre valores realizados e planejados</span>
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
          <div class="table-filters">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Filtrar Projeto</mat-label>
              <input matInput (keyup)="applyFilter()" [(ngModel)]="filtroProjeto" placeholder="Ex: Projeto X">
            </mat-form-field>
            
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Tipo</mat-label>
              <mat-select [(ngModel)]="filtroTipo" (selectionChange)="applyFilter()">
                <mat-option value="">Todos</mat-option>
                <mat-option value="Aporte">Aporte</mat-option>
                <mat-option value="Captação">Captação</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Período</mat-label>
              <input matInput (keyup)="applyFilter()" [(ngModel)]="filtroPeriodo" placeholder="Ex: 01/2026">
            </mat-form-field>
          </div>

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
                  <th>Obs.</th>
                </tr>
              </thead>
              <tbody>
                @for (r of recebimentosFiltrados; track $index) {
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
                  <td>
                    @if (r.observacao2) {
                    <span class="obs-badge">{{ r.observacao2 }}</span>
                    }
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
    .recursos-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .page-title { display: flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 300; margin-bottom: 24px; color: var(--text-primary); }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .kpi-card mat-card-content { padding: 24px; display: flex; flex-direction: column; gap: 8px; }
    .kpi-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; letter-spacing: 0.5px; }
    .kpi-value { font-size: 26px; font-weight: 600; color: var(--text-primary); margin: 4px 0; }
    .kpi-sub { font-size: 11px; color: var(--text-muted); }
    
    .text-green { color: var(--accent-green) !important; }
    .text-blue { color: var(--accent-blue) !important; }

    mat-progress-bar { height: 4px !important; border-radius: 2px; }

    .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px; margin-bottom: 24px; }
    .chart-card, .table-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .chart-card mat-card-header, .table-card mat-card-header { padding: 24px 24px 0; }
    .chart-card mat-card-title, .table-card mat-card-title { font-size: 16px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
    .chart-wrapper { height: 300px; padding: 24px; }

    .table-container { overflow-x: auto; padding: 24px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .data-table th { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-weight: 600; font-size: 12px; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .data-table tr:hover td { background: var(--hover-bg); }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .positive { color: var(--accent-green) !important; }

    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .status-badge.recebido { background: rgba(52, 211, 153, 0.1); color: var(--accent-green); }
    .status-badge.previsto { background: rgba(56, 189, 248, 0.1); color: var(--accent-blue); }

    .obs-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: var(--hover-bg); color: var(--text-muted); text-transform: uppercase; }

    .table-filters { display: flex; gap: 16px; padding: 24px; flex-wrap: wrap; }
    .filter-field { flex: 1; min-width: 200px; }
    .chart-info { display: flex; align-items: center; gap: 8px; padding: 0 24px 24px; color: var(--text-muted); font-size: 11px; }
    .chart-info mat-icon { font-size: 14px; width: 14px; height: 14px; }
  `,
})
export class RecursosComponent implements OnInit {
  detalhado: RecursoDetalhado = {
    aporteRecebido: 0, aporteInflacao: 0, aporteRecebidoTotal: 0, aportePrevisto: 0,
    captacaoRecebida: 0, captacaoPrevista: 0,
    captacaoTotal: 0, totalRecebido: 0, totalComPrevisto: 0,
  };
  recebimentos: Recebimento[] = [];
  recebimentosFiltrados: Recebimento[] = [];

  filtroProjeto = "";
  filtroTipo = "";
  filtroPeriodo = "";

  pctAporte = 0;
  pctCaptacaoRecebida = 0;
  pctCaptacaoTotal = 0;
  pctTotalRecebido = 0;
  pctTotalComPrevisto = 0;

  doughnutReady = false;
  barReady = false;

  public pieData: ChartConfiguration["data"] = { labels: [], datasets: [] };
  public pieOptions: ChartConfiguration["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { color: "#9CA3AF", font: { size: 11 } } },
    },
  };

  barData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "top", labels: { color: "#9CA3AF", font: { size: 11 } } } },
    scales: {
      x: { stacked: false, ticks: { color: "#6B7280" }, grid: { display: false } },
      y: { stacked: false, ticks: { color: "#6B7280" }, grid: { color: "rgba(255,255,255,0.03)" } },
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

      this.pieData = {
        labels: ["Aporte Federal", "Captação Externa"],
        datasets: [{
          data: [d.aporteRecebido, d.captacaoRecebida],
          backgroundColor: ["#34D399", "#38BDF8"],
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
            backgroundColor: "rgba(56, 189, 248, 0.4)",
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
