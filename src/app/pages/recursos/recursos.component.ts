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

      <!-- Charts & Insights -->
      <div class="charts-row">
        <mat-card class="chart-card compact" appearance="outlined">
          <mat-card-header><mat-card-title>Distribuição de Recursos</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper-small">
              @if (doughnutReady) {
              <canvas baseChart [data]="pieData" [options]="pieOptions" [type]="'pie'"></canvas>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="chart-card compact" appearance="outlined">
          <mat-card-header><mat-card-title>Aporte vs Captação (Recebido x Previsto)</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper-small">
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
          <div class="table-header-actions">
            <div class="table-filters">
              <mat-form-field appearance="outline" class="filter-field mini">
                <mat-label>Projeto</mat-label>
                <input matInput (keyup)="applyFilter()" [(ngModel)]="filtroProjeto" placeholder="Buscar projeto...">
              </mat-form-field>
              
              <mat-form-field appearance="outline" class="filter-field mini">
                <mat-label>Tipo</mat-label>
                <mat-select [(ngModel)]="filtroTipo" (selectionChange)="applyFilter()">
                  <mat-option value="">Todos</mat-option>
                  <mat-option value="Aporte">Aporte</mat-option>
                  <mat-option value="Captação">Captação</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="filter-field mini">
                <mat-label>Mês/Ano</mat-label>
                <input matInput (keyup)="applyFilter()" [(ngModel)]="filtroPeriodo" placeholder="Ex: 01/2026">
              </mat-form-field>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Fornecedor</th>
                  <th>Identificação / Obs</th>
                  <th>Mês/Ano</th>
                  <th class="num">Valor</th>
                  <th>Status</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                @for (r of recebimentosFiltrados; track $index) {
                <tr>
                  <td class="font-medium white-text">{{ r.projeto }}</td>
                  <td class="white-text">{{ r.fornecedor }}</td>
                  <td class="text-muted">{{ r.observacao }}</td>
                  <td class="white-text">{{ r.mesAno }}</td>
                  <td class="num positive font-bold">{{ r.valor | currency: "BRL":"symbol":"1.2-2" }}</td>
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
    .page-container { padding: 24px; max-width: 1600px; margin: 0 auto; animation: fadeIn 0.6s ease-out; }
    .page-title { display: flex; align-items: center; gap: 12px; font-size: 24px; font-weight: 500; margin-bottom: 24px; color: var(--text-primary); }
    .section-label { font-size: 14px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin: 16px 0 12px; }
    
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg) !important; border-radius: 12px !important; transition: transform 0.2s; }
    .kpi-card:hover { transform: translateY(-2px); }
    .kpi-card mat-card-content { padding: 20px; display: flex; flex-direction: column; gap: 8px; }
    .kpi-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
    .kpi-value { font-size: 24px; font-weight: 600; color: var(--text-primary); margin: 4px 0; }
    .kpi-sub { font-size: 11px; color: var(--text-muted); }
    
    .text-green { color: var(--accent-green) !important; }
    .text-blue { color: var(--accent-blue) !important; }
    .font-medium { font-weight: 500; }
    .font-bold { font-weight: 600; }
    .white-text { color: var(--text-primary) !important; }

    mat-progress-bar { height: 6px !important; border-radius: 3px; }

    .charts-row { display: grid; grid-template-columns: 1fr 2fr; gap: 24px; margin-bottom: 24px; }
    @media (max-width: 1100px) { .charts-row { grid-template-columns: 1fr; } }
    
    .chart-card.compact { min-height: 320px; }
    .chart-wrapper-small { height: 240px; padding: 16px; position: relative; }

    .table-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .table-filters { display: flex; gap: 12px; padding: 16px 24px; flex-wrap: wrap; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border-color); }
    .filter-field.mini { flex: 1; min-width: 150px; }
    :host ::ng-deep .mini .mat-mdc-text-field-wrapper { height: 48px !important; padding-top: 0 !important; }

    .table-container { overflow-x: auto; padding: 0; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { padding: 16px 24px; text-align: left; background: rgba(255,255,255,0.03); color: var(--text-primary); font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--border-color); }
    .data-table td { padding: 14px 24px; border-bottom: 1px solid var(--border-color); font-size: 14px; }
    .data-table tr:hover td { background: var(--hover-bg); }
    
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .positive { color: var(--accent-green) !important; }
    .text-muted { color: var(--text-secondary); font-size: 13px; }

    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-badge.recebido { background: rgba(52, 211, 153, 0.15); color: var(--accent-green); border: 1px solid rgba(52, 211, 153, 0.2); }
    .status-badge.previsto { background: rgba(56, 189, 248, 0.15); color: var(--accent-blue); border: 1px solid rgba(56, 189, 248, 0.2); }

    .obs-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border-color); }
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
