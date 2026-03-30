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
    MatExpansionModule,
    BaseChartDirective,
  ],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>account_balance</mat-icon>
        Recursos — Aporte vs Captação
      </h1>

      <!-- Accordion Container -->
      <mat-accordion multi="true" class="resource-accordion">
        
        <!-- Aporte ENAP Section -->
        <mat-expansion-panel [expanded]="true" class="custom-panel">
          <mat-expansion-panel-header>
            <mat-panel-title>
              <div class="panel-title-text"><mat-icon>account_balance</mat-icon> APORTE ENAP (META R$ 3.023.000)</div>
            </mat-panel-title>
          </mat-expansion-panel-header>
          <div class="kpi-grid-classic">
            <!-- 1. Recebido -->
        <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon purple"><mat-icon>archive</mat-icon></div>
              <div class="classic-label">APORTE RECEBIDO</div>
            </div>
            <div class="classic-value">{{ detalhado.aporteRecebido | currency: "BRL":"symbol":"1.2-2" }}</div>
            <mat-progress-bar mode="determinate" [value]="pctAporte" class="classic-progress blue"></mat-progress-bar>
            <div class="classic-footer">{{ pctAporte | number: "1.1-1" }}% da meta atingida</div>
          </mat-card-content>
        </mat-card>

        <!-- 2. Previsto -->
        <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon purple-light"><mat-icon>schedule</mat-icon></div>
              <div class="classic-label">APORTE PREVISTO</div>
            </div>
            <div class="classic-value">{{ detalhado.aportePrevisto | currency: "BRL":"symbol":"1.2-2" }}</div>
            <div class="classic-sub">Parcelas futuras acordadas</div>
            <mat-progress-bar mode="determinate" [value]="(detalhado.aportePrevisto / dataService.META_APORTE * 100)" class="classic-progress purple-bar"></mat-progress-bar>
            <div class="classic-footer">{{ (detalhado.aportePrevisto / dataService.META_APORTE * 100) | number: "1.1-1" }}% do total</div>
          </mat-card-content>
        </mat-card>

        <!-- 3. Meta Total -->
        <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon purple-dark"><mat-icon>flag</mat-icon></div>
              <div class="classic-label">META TOTAL APORTE</div>
            </div>
            <div class="classic-value">{{ dataService.META_APORTE | currency: "BRL":"symbol":"1.2-2" }}</div>
            <div class="classic-sub">Recebido + Previsto acordado</div>
            <mat-progress-bar mode="determinate" [value]="100" class="classic-progress blue"></mat-progress-bar>
            <div class="classic-footer">Valor final do projeto</div>
          </mat-card-content>
        </mat-card>

        <!-- 4. Inflação (Separado) -->
        <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon orange-light"><mat-icon>trending_up</mat-icon></div>
              <div class="classic-label">INFLAÇÃO RECEBIDA</div>
            </div>
            <div class="classic-value">{{ detalhado.aporteInflacao | currency: "BRL":"symbol":"1.2-2" }}</div>
            <div class="classic-sub">Saldo extra (não conta para a meta)</div>
            <mat-progress-bar mode="determinate" [value]="0" class="classic-progress gray"></mat-progress-bar>
            <div class="classic-footer">Reajustes contratuais</div>
          </mat-card-content>
        </mat-card>
          </div>
        </mat-expansion-panel>

        <!-- Captação Externa Section -->
        <mat-expansion-panel [expanded]="true" class="custom-panel">
          <mat-expansion-panel-header>
            <mat-panel-title>
              <div class="panel-title-text"><mat-icon>public</mat-icon> CAPTAÇÃO EXTERNA (META R$ 17.550.525)</div>
            </mat-panel-title>
          </mat-expansion-panel-header>
          <div class="kpi-grid-classic">
            <!-- 1. Recebido -->
        <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon teal"><mat-icon>archive</mat-icon></div>
              <div class="classic-label">CAPTAÇÃO RECEBIDA</div>
            </div>
            <div class="classic-value">{{ detalhado.captacaoRecebida | currency: "BRL":"symbol":"1.2-2" }}</div>
            <mat-progress-bar mode="determinate" [value]="pctCaptacaoRecebida" class="classic-progress teal"></mat-progress-bar>
            <div class="classic-footer">{{ pctCaptacaoRecebida | number: "1.1-1" }}% da meta atingida</div>
          </mat-card-content>
        </mat-card>

        <!-- 2. Previsto -->
        <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon teal-light"><mat-icon>schedule</mat-icon></div>
              <div class="classic-label">CAPTAÇÃO PREVISTA</div>
            </div>
            <div class="classic-value">{{ detalhado.captacaoPrevista | currency: "BRL":"symbol":"1.2-2" }}</div>
            <div class="classic-sub">Contratos assinados</div>
            <mat-progress-bar mode="determinate" [value]="(detalhado.captacaoPrevista / dataService.META_CAPTACAO * 100)" class="classic-progress teal-bar"></mat-progress-bar>
            <div class="classic-footer">{{ (detalhado.captacaoPrevista / dataService.META_CAPTACAO * 100) | number: "1.1-1" }}% do total</div>
          </mat-card-content>
        </mat-card>

        <!-- 3. A Formalizar -->
        <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon orange-light"><mat-icon>assignment_late</mat-icon></div>
              <div class="classic-label">A FORMALIZAR</div>
            </div>
            <div class="classic-value">{{ detalhado.saldoACaptar | currency: "BRL":"symbol":"1.2-2" }}</div>
            <div class="classic-sub">Saldo p/ atingir meta</div>
            <mat-progress-bar mode="determinate" [value]="(detalhado.saldoACaptar / dataService.META_CAPTACAO * 100)" class="classic-progress orange-bar"></mat-progress-bar>
            <div class="classic-footer">Remanescente contratual</div>
          </mat-card-content>
        </mat-card>

        <!-- 4. Meta Total -->
        <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon teal-dark"><mat-icon>flag</mat-icon></div>
              <div class="classic-label">META TOTAL CAPTAÇÃO</div>
            </div>
            <div class="classic-value">{{ dataService.META_CAPTACAO | currency: "BRL":"symbol":"1.2-2" }}</div>
            <div class="classic-sub">Total planejado</div>
            <mat-progress-bar mode="determinate" [value]="100" class="classic-progress teal"></mat-progress-bar>
            <div class="classic-footer">Objetivo de captação</div>
          </mat-card-content>
        </mat-card>
          </div>
        </mat-expansion-panel>

        <!-- Consolidado Section -->
        <mat-expansion-panel [expanded]="true" class="custom-panel">
          <mat-expansion-panel-header>
            <mat-panel-title>
              <div class="panel-title-text"><mat-icon>account_balance_wallet</mat-icon> CONSOLIDADO</div>
            </mat-panel-title>
          </mat-expansion-panel-header>
          <!-- Row 2: Consolidado -->
          <div class="kpi-grid-classic">
            <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon green"><mat-icon>account_balance_wallet</mat-icon></div>
              <div class="classic-label">TOTAL RECEBIDO (NET)</div>
            </div>
            <div class="classic-value">{{ detalhado.totalRecebido | currency: "BRL":"symbol":"1.2-2" }}</div>
            <mat-progress-bar mode="determinate" [value]="pctTotalRecebido" class="classic-progress blue"></mat-progress-bar>
            <div class="classic-footer">{{ pctTotalRecebido | number: "1.1-1" }}% da meta total conquistada</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="classic-card" appearance="outlined">
          <mat-card-content>
            <div class="classic-header">
              <div class="circle-icon gold"><mat-icon>stars</mat-icon></div>
              <div class="classic-label">POTENCIAL TOTAL (META)</div>
            </div>
            <div class="classic-value">{{ dataService.META_TOTAL | currency: "BRL":"symbol":"1.2-2" }}</div>
            <div class="classic-sub">Aporte + Captação Planejada</div>
            <mat-progress-bar mode="determinate" [value]="pctTotalComPrevisto" class="classic-progress orange"></mat-progress-bar>
            <div class="classic-footer">{{ pctTotalComPrevisto | number: "1.1-1" }}% das metas formalizadas</div>
          </mat-card-content>
        </mat-card>
          </div>
        </mat-expansion-panel>
      </mat-accordion>

      <!-- Charts & Insights -->
      <div class="charts-row">
        <mat-card class="chart-card compact" appearance="outlined">
          <mat-card-header><mat-card-title>Distribuição dos Recursos</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper-small">
              @if (doughnutReady) {
              <canvas baseChart [data]="pieData" [options]="pieOptions" [type]="'doughnut'"></canvas>
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
                <input matInput (keyup)="applyFilter()" [(ngModel)]="filtroProjeto" placeholder="projeto...">
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
                <input matInput (keyup)="applyFilter()" [(ngModel)]="filtroPeriodo" placeholder="01/2026">
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
    .resource-accordion { display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px; }
    :host ::ng-deep .custom-panel { background: transparent !important; box-shadow: none !important; }
    :host ::ng-deep .custom-panel .mat-expansion-panel-header { padding: 0 16px; height: 56px; background: rgba(0,0,0,0.15); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
    :host ::ng-deep .custom-panel .mat-expansion-panel-body { padding: 24px 0 0 0 !important; }
    .panel-title-text { font-size: 14px; font-weight: 700; color: var(--text-primary); letter-spacing: 1.5px; padding-left: 12px; border-left: 3px solid var(--accent-green); display: flex; align-items: center; gap: 8px;}
    
    .page-container { padding: 24px; width: 100%; box-sizing: border-box; animation: fadeIn 0.6s ease-out; }
    .page-title { display: flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 500; margin-bottom: 24px; color: var(--text-primary); letter-spacing: -0.5px; }
    
    .kpi-grid-classic { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 24px; }
    @media (max-width: 900px) { .kpi-grid-classic { display: grid; grid-template-columns: 1fr; } }
    
    /* Evitar sobreposição de Label e Placeholder */
    .mat-mdc-form-field.mat-form-field-should-float .mdc-floating-label {
      background: var(--bg-primary) !important;
      padding: 0 8px !important;
      border-radius: 4px;
      transform: translateY(-24px) scale(0.75) !important;
    }

    .mat-mdc-form-field.mat-form-field-should-float .mdc-notched-outline__notch {
      border-top: none !important;
    }

    .classic-card { flex: 1; min-width: 220px; background: var(--card-bg) !important; border-radius: 16px !important; margin-bottom: 8px; border: 1px solid var(--glass-border) !important; }
    .classic-card mat-card-content { padding: 24px; display: flex; flex-direction: column; gap: 10px; }
    .classic-header { display: flex; align-items: center; gap: 15px; margin-bottom: 4px; }
    .classic-label { font-size: 13px; font-weight: 600; color: var(--text-muted); opacity: 0.8; letter-spacing: 0.5px; }
    .classic-value { font-size: 28px; font-weight: 700; color: var(--text-primary); }
    .classic-meta, .classic-sub { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
    .classic-footer { font-size: 12px; color: var(--text-secondary); text-align: right; }
    
    .circle-icon.purple { background: linear-gradient(135deg, #A78BFA, #7C3AED); }
    .circle-icon.purple-light { background: linear-gradient(135deg, #DDD6FE, #8B5CF6); }
    .circle-icon.purple-dark { background: linear-gradient(135deg, #4C1D95, #7c4dff); }
    .circle-icon.teal { background: linear-gradient(135deg, #2DD4BF, #0D9488); }
    .circle-icon.orange { background: linear-gradient(135deg, #FB923C, #EA580C); }
    .circle-icon.green { background: linear-gradient(135deg, #4ADE80, #16A34A); }
    .circle-icon.orange-light { background: linear-gradient(135deg, #FDBA74, #F97316); }

    .classic-progress { height: 10px !important; border-radius: 5px; background: rgba(255,255,255,0.05); }
    :host ::ng-deep .classic-progress.gray .mdc-linear-progress__bar-inner { border-color: #9CA3AF !important; }
    :host ::ng-deep .classic-progress.purple-bar .mdc-linear-progress__bar-inner { border-color: #8B5CF6 !important; }
    .consolidado-row-header { font-size: 14px; font-weight: 700; color: var(--text-muted); letter-spacing: 2px; margin: 24px 0 12px; padding-left: 4px; border-left: 3px solid var(--accent-green); }
    .consolidado-row-header.first { margin-top: 0; }

    .charts-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 24px; margin-bottom: 24px; }
    .chart-card.compact { height: 420px; }
    .chart-wrapper-small { height: 320px; padding: 16px; position: relative; }

    .table-card { background: var(--card-bg) !important; border-radius: 12px !important; width: 100%; }
    .table-filters { display: flex; gap: 20px; padding: 24px; flex-wrap: wrap; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border-color); }
    .filter-field.mini { flex: 1; min-width: 200px; max-width: 350px; }
    
    .table-container { overflow-x: auto; width: 100%; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { padding: 16px 24px; text-align: left; background: rgba(255,255,255,0.03); color: var(--text-primary); border-bottom: 1px solid var(--border-color); }
    .data-table td { padding: 14px 24px; border-bottom: 1px solid var(--border-color); font-size: 14px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .status-badge.recebido { background: rgba(52, 211, 153, 0.15); color: var(--accent-green); }
    .status-badge.previsto { background: rgba(56, 189, 248, 0.15); color: var(--accent-blue); }
    .obs-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border-color); }
  `,

})
export class RecursosComponent implements OnInit {
  detalhado: RecursoDetalhado = {
    aporteRecebido: 0, aporteInflacao: 0, aporteRecebidoTotal: 0, aportePrevisto: 0,
    captacaoRecebida: 0, captacaoPrevista: 0,
    captacaoTotal: 0, saldoACaptar: 0, totalRecebido: 0, totalComPrevisto: 0,
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

  public pieData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  public pieOptions: ChartConfiguration<"doughnut">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: { position: "right", labels: { color: "#F3F4F6", font: { size: 10, weight: "bold" }, usePointStyle: true, padding: 15 } },
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
            "#22D3EE", // Ciano - Captação Recebida
            "#FB923C", // Laranja - Captação Prevista
            "#A78BFA"  // Roxo Claro - Aporte Previsto
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
