import { Component, OnInit, Inject, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import { DashboardConfigService } from "../../services/dashboard-config.service";
// ChartDataLabels foi movido para o registro global no main.ts

// --- INÍCIO DOS COMPONENTES DE MODAL ---

@Component({
  selector: "app-modal-financiadores",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, BaseChartDirective, DragDropModule],
  template: `
    <div class="modal-box" cdkDrag cdkDragBoundary=".cdk-overlay-container">
      <div class="modal-header" cdkDragHandle>
        <h2><mat-icon>account_balance_wallet</mat-icon> Recebido por Financiador</h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>
      <mat-divider></mat-divider>
      <div class="modal-content">
        <div class="chart-container">
           <canvas *ngIf="renderChart" baseChart [data]="chartData" [options]="chartOptions" [type]="'doughnut'"></canvas>
        </div>
        <div class="resume-list">
          @for (f of data; track f.financiador) {
            <div class="list-item">
              <span class="label">{{ f.financiador }}</span>
              <span class="value">{{ f.valor | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-box { 
      padding: 0; 
      background: #ffffff !important; 
      color: #1e293b !important; 
      height: 100%; 
      display: flex; 
      flex-direction: column; 
      resize: both; 
      overflow: hidden; 
      min-width: 400px; 
      min-height: 300px;
      border: 1px solid var(--border-color);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      border-radius: 12px;
    }
    :host-context(body.dark-theme) .modal-box { 
      background: var(--bg-primary) !important; 
      color: var(--text-primary) !important; 
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; cursor: move; }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--text-primary); pointer-events: none; }
    .modal-content { padding: 24px; flex: 1; display: flex; gap: 24px; min-height: 0; align-items: center; }
    .chart-container { flex: 1; position: relative; min-height: 0; }
    .resume-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 8px; }
    .list-item { display: flex; justify-content: space-between; font-size: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; }
    .value { font-weight: 600; font-variant-numeric: tabular-nums; }
  `]
})
export class ModalFinanciadoresComponent implements OnInit {
  chartData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  chartOptions: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { color: "#d1d5db", font: { weight: 'bold', size: 12 } } },
      datalabels: { display: false },
    }
  };
  renderChart = false;

  constructor(
    public dialogRef: MatDialogRef<ModalFinanciadoresComponent>,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: { financiador: string; valor: number }[]
  ) { }

  ngOnInit() {
    setTimeout(() => {
      this.chartData = {
        labels: this.data.map(d => d.financiador),
        datasets: [{
          data: this.data.map(d => d.valor),
          backgroundColor: [
            "#7c4dff", "#00bcd4", "#ff9800", "#4caf50", "#f44336",
            "#2196f3", "#9c27b0", "#ff5722", "#8bc34a", "#ffc107"
          ],
          borderWidth: 0
        }]
      };
      this.renderChart = true;
      this.cdr.detectChanges();
    }, 400);
  }
}

@Component({
  selector: "app-modal-execucao",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, BaseChartDirective, DragDropModule],
  template: `
    <div class="modal-box" cdkDrag cdkDragBoundary=".cdk-overlay-container">
      <div class="modal-header" cdkDragHandle>
        <h2><mat-icon>payments</mat-icon> Execução de Projetos Ativos</h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>
      <mat-divider></mat-divider>
      <div class="modal-content">
        <div class="chart-container">
           <canvas *ngIf="renderChart" baseChart [data]="chartData" [options]="chartOptions" [type]="'bar'"></canvas>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-box { 
      padding: 0; 
      background: #ffffff !important; 
      color: #1e293b !important; 
      height: 100%; 
      display: flex; 
      flex-direction: column; 
      resize: both; 
      overflow: hidden; 
      min-width: 400px; 
      min-height: 300px;
      border: 1px solid var(--border-color);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      border-radius: 12px;
    }
    :host-context(body.dark-theme) .modal-box { 
      background: var(--bg-primary) !important; 
      color: var(--text-primary) !important; 
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; cursor: move; }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--text-primary); pointer-events: none; }
    .modal-content { padding: 24px; flex: 1; display: flex; flex-direction: column; min-height: 0; justify-content: center; }
    .chart-container { flex: 1; position: relative; min-height: 0; }
  `]
})
export class ModalExecucaoComponent implements OnInit {
  chartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  chartOptions: any = {
    responsive: true, maintainAspectRatio: false, indexAxis: "y",
    plugins: {
      legend: { position: "bottom", labels: { color: "#d1d5db", font: { weight: 'bold' } } },
      datalabels: { display: false }
    },
    layout: { padding: { right: 50 } },
    scales: {
      x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.03)" }, max: 100 },
      y: { ticks: { color: "#94a3b8" }, grid: { display: false } },
    }
  };
  renderChart = false;

  constructor(
    public dialogRef: MatDialogRef<ModalExecucaoComponent>,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: { projeto: string; execucao: number }[]
  ) { }

  ngOnInit() {
    setTimeout(() => {
      this.chartData = {
        labels: this.data.map(d => d.projeto),
        datasets: [{
          label: 'Execução %',
          data: this.data.map(d => Math.min(d.execucao, 100)),
          backgroundColor: "#F87171",
          borderRadius: 4
        }]
      };
      this.renderChart = true;
      this.cdr.detectChanges();
    }, 400);
  }
}

@Component({
  selector: 'app-modal-info',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, DragDropModule],
  template: `
    <div class="modal-box" cdkDrag cdkDragBoundary=".cdk-overlay-container">
      <div class="modal-header" cdkDragHandle>
        <h2><mat-icon>{{ data.icon }}</mat-icon> {{ data.title }}</h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>
      <mat-divider></mat-divider>
      <div class="modal-content">
        <p class="description">{{ data.description }}</p>
        @if (data.value) {
          <div class="highlight-value">{{ data.value }}</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .modal-box { 
      padding: 0; 
      background: var(--bg-primary) !important; 
      color: var(--text-primary) !important; 
      height: 100%; 
      display: flex; 
      flex-direction: column; 
      resize: both; 
      overflow: hidden; 
      min-width: 400px; 
      min-height: 300px;
      border: 1px solid var(--border-color);
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      border-radius: 12px;
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: move; }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: #f8fafc; pointer-events: none; }
    .modal-header mat-icon { color: var(--accent-primary); }
    .modal-content { padding: 32px 48px; display: flex; flex-direction: column; gap: 24px; flex: 1; justify-content: center; align-items: center; text-align: center; }
    .description { font-size: 18px; line-height: 1.6; color: var(--text-secondary); margin: 0; max-width: 600px; }
    .highlight-value { font-size: 40px; font-weight: 700; color: var(--text-primary); text-align: center; padding: 24px 48px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid var(--border-color); }
  `]
})
export class ModalInfoComponent {
  constructor(
    public dialogRef: MatDialogRef<ModalInfoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; icon: string; description: string; value?: string }
  ) { }
}

// --- FIM DOS COMPONENTES DE MODAL ---


@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    MatDialogModule,
    BaseChartDirective,
  ],
  providers: [CurrencyPipe, DecimalPipe],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>dashboard</mat-icon>
        Dashboard
      </h1>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        @if (config().recebido) {
        <mat-card class="kpi-card clickable kpi-recebido card-indicator-green" appearance="outlined" (click)="abrirModal('finance')">
          <mat-card-content>
            <div class="kpi-icon">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-label">Total Recebido</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 140px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value text-green">{{ indicadores.totalRecebido | currency: "BRL":"symbol":"1.2-2" }}</span>
              }
            </div>
            <mat-icon class="view-more-icon">visibility</mat-icon>
          </mat-card-content>
        </mat-card>
        }

        @if (config().executado) {
        <mat-card class="kpi-card clickable kpi-executado card-indicator-red" appearance="outlined" (click)="abrirModal('execucao')">
          <mat-card-content>
            <div class="kpi-icon">
              <mat-icon>payments</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-label">Total Executado</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 140px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value text-red">{{ indicadores.totalExecutado | currency: "BRL":"symbol":"1.2-2" }}</span>
              }
            </div>
            <mat-icon class="view-more-icon">visibility</mat-icon>
          </mat-card-content>
        </mat-card>
        }

        @if (config().saldo) {
        <mat-card class="kpi-card kpi-saldo card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon">
              <mat-icon>savings</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-label">Saldo Disponível</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 140px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value text-blue">{{ indicadores.saldoDisponivel | currency: "BRL":"symbol":"1.2-2" }}</span>
              }
            </div>
          </mat-card-content>
        </mat-card>
        }

        @if (config().percentual) {
        <mat-card class="kpi-card kpi-execucao card-indicator-yellow" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon">
              <mat-icon>speed</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-label">% Execução</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 80px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value text-yellow">{{ indicadores.percentualExecucao | number: "1.0-1" }}%</span>
              }
            </div>
            <mat-progress-bar mode="determinate" [value]="indicadores.percentualExecucao"></mat-progress-bar>
          </mat-card-content>
        </mat-card>
        }

        @if (config().pagamentos) {
        <mat-card class="kpi-card clickable card-indicator-gray" appearance="outlined" (click)="abrirModal('pagamentos')">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>receipt_long</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">N° de Pagamentos</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 60px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value">{{ indicadores.numPagamentos }}</span>
              }
            </div>
            <mat-icon class="view-more-icon">visibility</mat-icon>
          </mat-card-content>
        </mat-card>
        }

        @if (config().ticket) {
        <mat-card class="kpi-card clickable card-indicator-gray" appearance="outlined" (click)="abrirModal('ticket')">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>paid</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Ticket Médio</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 120px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value">{{ indicadores.ticketMedio | currency: "BRL":"symbol":"1.2-2" }}</span>
              }
            </div>
            <mat-icon class="view-more-icon">visibility</mat-icon>
          </mat-card-content>
        </mat-card>
        }

        @if (config().inflacao) {
        <mat-card class="kpi-card card-indicator-orange" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>trending_up</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Inflação Recebida</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 130px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value text-orange">{{ inflacao | currency: "BRL":"symbol":"1.2-2" }}</span>
              }
              <span class="kpi-sub">Reajustes contratuais (extra)</span>
            </div>
          </mat-card-content>
        </mat-card>
        }

        @if (config().meta) {
        <mat-card class="kpi-card card-indicator-purple" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>analytics</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">% Atingido (Meta Total)</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 80px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value">{{ (totalRecebidoNet / dataService.META_TOTAL * 100) | number: "1.1-1" }}%</span>
              }
            </div>
            <mat-progress-bar mode="determinate" [value]="(totalRecebidoNet / dataService.META_TOTAL * 100)"></mat-progress-bar>
          </mat-card-content>
        </mat-card>
        }

        <!-- Gestão Estratégica -->
        @if (config().runway) {
        <mat-card class="kpi-card clickable kpi-runway card-indicator-gray" appearance="outlined" (click)="abrirModal('runway')">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>timer</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Runway (Meses)</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 70px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value">{{ runway | number: "1.1-1" }}</span>
              }
              <span class="kpi-sub">Tempo estimado de sobrevivência</span>
            </div>
            <mat-icon class="view-more-icon">visibility</mat-icon>
          </mat-card-content>
        </mat-card>
        }

        @if (config().gap) {
        <mat-card class="kpi-card clickable kpi-gap card-indicator-red" appearance="outlined" (click)="abrirModal('gap')">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>not_interested</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Gap de Captação</span>
              @if (isLoading) {
                <div class="skeleton-box" style="width: 140px; height: 32px; border-radius: 4px; margin-top: 4px;"></div>
              } @else {
                <span class="kpi-value text-red">{{ gapCaptacao | currency: "BRL":"symbol":"1.2-2" }}</span>
              }
              <span class="kpi-sub">Déficit vs Meta Total</span>
            </div>
            <mat-icon class="view-more-icon">visibility</mat-icon>
          </mat-card-content>
        </mat-card>
        }
      </div>


      <!-- Projects summary table -->
      <mat-card class="summary-card" appearance="outlined">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>folder_special</mat-icon>
            Resumo por Projeto
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th class="num">Entradas</th>
                  <th class="num">Saídas</th>
                  <th class="num">Saldo</th>
                  <th class="num">Execução</th>
                </tr>
              </thead>
              <tbody>
                @if (isLoading) {
                  @for (i of [1,2,3,4,5]; track i) {
                    <tr>
                      <td><div class="skeleton-box" style="width: 120px; height: 16px; border-radius: 4px;"></div></td>
                      <td><div class="skeleton-box" style="width: 100px; height: 16px; border-radius: 4px; margin-left: auto;"></div></td>
                      <td><div class="skeleton-box" style="width: 100px; height: 16px; border-radius: 4px; margin-left: auto;"></div></td>
                      <td><div class="skeleton-box" style="width: 100px; height: 16px; border-radius: 4px; margin-left: auto;"></div></td>
                      <td><div class="skeleton-box" style="width: 60px; height: 16px; border-radius: 4px; margin-left: auto;"></div></td>
                    </tr>
                  }
                } @else {
                  @for (p of projetos; track p.projeto) {
                  <tr>
                    <td>{{ p.projeto }}</td>
                    <td class="num positive">{{ p.entradas | currency: "BRL":"symbol":"1.2-2" }}</td>
                    <td class="num negative">{{ p.saidas | currency: "BRL":"symbol":"1.2-2" }}</td>
                    <td class="num" [class.positive]="p.saldo >= 0" [class.negative]="p.saldo < 0">
                      {{ p.saldo | currency: "BRL":"symbol":"1.2-2" }}
                    </td>
                    <td class="num">{{ p.execucao | number: "1.1-1" }}%</td>
                  </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .clickable { cursor: pointer; position: relative; }

    .kpi-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 16px; 
      margin-bottom: 24px;
      width: 100%;
    }

    .kpi-card {
      flex: 1 1 calc(20% - 16px);
      min-width: 200px;
      background: var(--card-bg) !important;
      border: 1px solid var(--border-color) !important;
      border-radius: 16px !important;
      min-height: 100px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .kpi-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }
    .kpi-card mat-card-content {
      display: flex; flex-direction: column; gap: 12px; padding: 24px;
    }
    .kpi-icon {
      width: 44px; height: 44px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      background: var(--hover-bg);
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      flex-shrink: 0;
    }
    .kpi-icon mat-icon { font-size: 24px; width: 24px; height: 24px; color: var(--kpi-blue-icon) !important; }
    
    /* Fundos preenchidos baseados no indicador do card - USO DE VARIÁVEIS GLOBAIS DE ICONOGRAFIA */
    .card-indicator-green .kpi-icon { background: var(--kpi-green-bg); border: none; }
    .card-indicator-green .kpi-icon mat-icon { color: var(--kpi-green-icon) !important; }

    .card-indicator-red .kpi-icon { background: var(--kpi-red-bg); border: none; }
    .card-indicator-red .kpi-icon mat-icon { color: var(--kpi-red-icon) !important; }

    .card-indicator-blue .kpi-icon { background: var(--kpi-blue-bg); border: none; }
    .card-indicator-blue .kpi-icon mat-icon { color: var(--kpi-blue-icon) !important; }

    .card-indicator-yellow .kpi-icon { background: var(--kpi-yellow-bg); border: none; }
    .card-indicator-yellow .kpi-icon mat-icon { color: var(--kpi-yellow-icon) !important; }

    .card-indicator-orange .kpi-icon { background: var(--kpi-orange-bg); border: none; }
    .card-indicator-orange .kpi-icon mat-icon { color: var(--kpi-orange-icon) !important; }

    .card-indicator-gray .kpi-icon { background: var(--kpi-gray-bg); border: none; }
    .card-indicator-gray .kpi-icon mat-icon { color: var(--kpi-gray-icon) !important; }

    .card-indicator-purple .kpi-icon { background: var(--kpi-purple-bg); border: none; }
    .card-indicator-purple .kpi-icon mat-icon { color: var(--kpi-purple-icon) !important; }

    /* Garantia de visibilidade dos indicadores de 5px no Dashboard */
    .kpi-card.card-indicator-green { border-left: 5px solid var(--accent-green) !important; }
    .kpi-card.card-indicator-red { border-left: 5px solid var(--accent-red) !important; }
    .kpi-card.card-indicator-blue { border-left: 5px solid var(--accent-primary) !important; }
    .kpi-card.card-indicator-yellow { border-left: 5px solid var(--accent-yellow) !important; }
    .kpi-card.card-indicator-orange { border-left: 5px solid var(--accent-orange) !important; }
    .kpi-card.card-indicator-purple { border-left: 5px solid var(--accent-purple) !important; }
    .kpi-card.card-indicator-gray { border-left: 5px solid var(--text-muted) !important; }

    .view-more-icon {
      position: absolute;
      bottom: 16px;
      right: 16px;
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--text-muted);
      opacity: 0.3;
      transition: all 0.2s ease-in-out;
    }
    .kpi-card:hover .view-more-icon {
      opacity: 1;
      color: var(--text-primary);
      transform: scale(1.1);
    }
    
    .kpi-info { display: flex; flex-direction: column; }
    .kpi-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; letter-spacing: 0.5px; }
    .kpi-value { font-size: 26px; font-weight: 600; color: var(--text-primary); margin-top: 4px; }
    .kpi-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    
    .text-green { color: var(--accent-green) !important; }
    .text-red { color: var(--accent-red) !important; }
    .text-blue { color: var(--accent-primary) !important; }
    .text-yellow { color: var(--accent-yellow) !important; }
    .text-orange { color: var(--accent-orange) !important; }

    mat-progress-bar { border-radius: 4px; height: 4px !important; margin-top: 8px; }
    .summary-card {
      background: var(--card-bg) !important;
      border-radius: 12px !important;
    }
    .summary-card mat-card-header { padding: 24px 24px 0; }
    .summary-card mat-card-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 16px; font-weight: 500; color: var(--text-primary);
    }
    .table-container { overflow-x: auto; padding: 24px; }
    .data-table {
      width: 100%; border-collapse: collapse;
      font-size: 14px;
    }
    .data-table th {
      padding: 12px 16px; text-align: left;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-secondary); font-weight: 600;
      text-transform: none; font-size: 12px;
    }
    .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-primary);
    }
    .data-table tr:hover td { background: var(--hover-bg); }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .positive { color: var(--accent-green) !important; }
    .negative { color: var(--accent-red) !important; }

    /* Estendimento dos cards de gestão */
    .kpi-runway, .kpi-gap {
      flex: 1 1 450px;
    }
    @media (max-width: 900px) {
      .kpi-runway, .kpi-gap {
        grid-column: span 1;
      }
    }
  `,

})
export class DashboardComponent implements OnInit {
  isLoading = true;
  indicadores = {
    totalRecebido: 0,
    totalExecutado: 0,
    saldoDisponivel: 0,
    percentualExecucao: 0,
    numPagamentos: 0,
    ticketMedio: 0,
  };
  projetos: any[] = [];
  projetosAtivos: { projeto: string; execucao: number }[] = [];
  financiadores: { financiador: string; valor: number }[] = [];
  runway = 0;
  gapCaptacao = 0;
  inflacao = 0;
  totalRecebidoNet = 0;
  modalCount = 0;

  get config() {
    return this.configService.config;
  }

  constructor(
    public dataService: DataService,
    private dialog: MatDialog,
    private configService: DashboardConfigService,
    private currencyPipe: CurrencyPipe,
    private decimalPipe: DecimalPipe
  ) { }

  ngOnInit(): void {
    this.dataService.getIndicadoresOperacionais().subscribe((ind) => {
      this.indicadores = ind;
    });

    this.dataService.getRecursoDetalhado().subscribe(rd => {
      this.inflacao = rd.aporteInflacao;
      this.totalRecebidoNet = rd.totalRecebido;
    });

    this.dataService.getRecebimentosPorFinanciador().subscribe((f) => {
      this.financiadores = f;
    });

    this.dataService.getRunway().subscribe(r => this.runway = r);
    this.dataService.getGapCaptacao().subscribe(g => this.gapCaptacao = g);

    this.dataService.getProjetoResumos().subscribe((p) => {
      this.projetos = p;
      this.projetosAtivos = p
        .filter(x => x.status && x.status.toLowerCase() !== "finalizado" && x.status.toLowerCase() !== "encerrado")
        .map(x => ({ projeto: x.projeto, execucao: x.execucao }));

      // Reintroduzindo o delay de 1.5 segundos solicitado para efeito de skeleton loader
      setTimeout(() => {
        this.isLoading = false;
      }, 1500);
    });
  }

  abrirModal(tipo: string): void {
    this.modalCount++;
    const offsetTop = 40 + (this.modalCount % 5) * 40;
    const offsetLeft = 40 + (this.modalCount % 5) * 40;

    const dialogOptions = {
      width: "960px",
      height: "680px",
      maxWidth: "95vw",
      panelClass: "draggable-modal-panel",
      hasBackdrop: false,
      position: { top: `${offsetTop}px`, left: `${offsetLeft}px` }
    };

    if (tipo === "finance") {
      this.dialog.open(ModalFinanciadoresComponent, {
        ...dialogOptions,
        data: this.financiadores
      });
    } else if (tipo === "execucao") {
      this.dialog.open(ModalExecucaoComponent, {
        ...dialogOptions,
        data: this.projetosAtivos
      });
    } else if (tipo === "pagamentos") {
      this.dialog.open(ModalInfoComponent, {
        ...dialogOptions,
        data: {
          title: "Sobre os Pagamentos",
          icon: "receipt_long",
          description: "Este número representa o total de transações de saída realizadas na execução dos projetos. Ele permite dimensionar facilmente o volume de esforço operacional da equipe financeira mensalmente.",
          value: this.indicadores.numPagamentos.toString()
        }
      });
    } else if (tipo === "ticket") {
      this.dialog.open(ModalInfoComponent, {
        ...dialogOptions,
        data: {
          title: "Ticket Médio",
          icon: "paid",
          description: "O Ticket Médio representa o valor base das saídas (Total Executado / N° de Pagamentos). Ter uma visão desse montante estabelece o padrão de custo por transação para futuras projeções de fluxo de caixa.",
          value: this.currencyPipe.transform(this.indicadores.ticketMedio, "BRL", "symbol", "1.0-2")
        }
      });
    } else if (tipo === "runway") {
      this.dialog.open(ModalInfoComponent, {
        ...dialogOptions,
        data: {
          title: "Runway Estimado",
          icon: "timer",
          description: "Expressa em meses o tempo de vida do projeto financeiramente falando (com base na média das saídas dos últimos meses vs montante disponível global). Ajuda a Diretoria e o time a saberem quando a captação precisa acelerar.",
          value: this.decimalPipe.transform(this.runway, "1.1-1") + " meses"
        }
      });
    } else if (tipo === "gap") {
      this.dialog.open(ModalInfoComponent, {
        ...dialogOptions,
        data: {
          title: "Gap de Captação",
          icon: "not_interested",
          description: "Indica a falta (déficit) dos recursos correntes captados se comparados com a meta global do acordo ou orçamento central. A meta de captação global almejada precisa ser atingida mitigando o Gap.",
          value: this.currencyPipe.transform(this.gapCaptacao, "BRL", "symbol", "1.2-2")
        }
      });
    }
  }
}
