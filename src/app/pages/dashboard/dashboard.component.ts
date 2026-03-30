import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    BaseChartDirective,
  ],
  template: `
    <div class="dashboard-container">
      <h1 class="page-title">
        <mat-icon>dashboard</mat-icon>
        Dashboard Geral
      </h1>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card kpi-recebido card-indicator-green" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon">
              <mat-icon>account_balance_wallet</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-label">Total Recebido</span>
              <span class="kpi-value text-green">{{ indicadores.totalRecebido | currency: "BRL":"symbol":"1.0-0" }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card kpi-executado card-indicator-red" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon">
              <mat-icon>payments</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-label">Total Executado</span>
              <span class="kpi-value text-red">{{ indicadores.totalExecutado | currency: "BRL":"symbol":"1.0-0" }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card kpi-saldo card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon">
              <mat-icon>savings</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-label">Saldo Disponível</span>
              <span class="kpi-value text-blue">{{ indicadores.saldoDisponivel | currency: "BRL":"symbol":"1.0-0" }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card kpi-execucao card-indicator-yellow" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon">
              <mat-icon>speed</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-label">% Execução</span>
              <span class="kpi-value text-yellow">{{ indicadores.percentualExecucao | number: "1.0-1" }}%</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="indicadores.percentualExecucao"></mat-progress-bar>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>receipt_long</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">N° de Pagamentos</span>
              <span class="kpi-value">{{ indicadores.numPagamentos }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>paid</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Ticket Médio</span>
              <span class="kpi-value">{{ indicadores.ticketMedio | currency: "BRL":"symbol":"1.0-0" }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>analytics</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">% Atingido (Meta Total)</span>
              <span class="kpi-value">{{ (indicadores.totalRecebido / dataService.META_TOTAL * 100) | number: "1.1-1" }}%</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="(indicadores.totalRecebido / dataService.META_TOTAL * 100)"></mat-progress-bar>
          </mat-card-content>
        </mat-card>

        <!-- Gestão Estratégica -->
        <mat-card class="kpi-card kpi-runway card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>timer</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Runway (Meses)</span>
              <span class="kpi-value">{{ runway | number: "1.1-1" }}</span>
              <span class="kpi-sub">Tempo estimado de sobrevivência</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card kpi-gap card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>not_interested</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Gap de Captação</span>
              <span class="kpi-value text-red">{{ gapCaptacao | currency: "BRL":"symbol":"1.0-0" }}</span>
              <span class="kpi-sub">Déficit vs Meta Total</span>
            </div>
          </mat-card-content>
        </mat-card>
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
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .dashboard-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .page-title {
      display: flex; align-items: center; gap: 12px;
      font-size: 28px; font-weight: 300; margin-bottom: 24px;
      color: var(--text-primary);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px; margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--card-bg) !important;
      border: 1px solid var(--border-color) !important;
      border-radius: 16px !important;
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
    }
    .kpi-icon mat-icon { color: var(--text-secondary); font-size: 24px; width: 24px; height: 24px; }
    
    .kpi-info { display: flex; flex-direction: column; }
    .kpi-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; letter-spacing: 0.5px; }
    .kpi-value { font-size: 26px; font-weight: 600; color: var(--text-primary); margin-top: 4px; }
    .kpi-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    
    .text-green { color: var(--accent-green) !important; }
    .text-red { color: var(--accent-red) !important; }
    .text-blue { color: var(--accent-blue) !important; }
    .text-yellow { color: var(--accent-yellow) !important; }

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
      grid-column: span 2;
    }
    @media (max-width: 900px) {
      .kpi-runway, .kpi-gap {
        grid-column: span 1;
      }
    }
  `,

})
export class DashboardComponent implements OnInit {
  indicadores = {
    totalRecebido: 0,
    totalExecutado: 0,
    saldoDisponivel: 0,
    percentualExecucao: 0,
    numPagamentos: 0,
    ticketMedio: 0,
  };
  projetos: any[] = [];
  runway = 0;
  gapCaptacao = 0;

  constructor(public dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getIndicadoresOperacionais().subscribe((ind) => {
      this.indicadores = ind;
    });

    this.dataService.getRunway().subscribe(r => this.runway = r);
    this.dataService.getGapCaptacao().subscribe(g => this.gapCaptacao = g);

    this.dataService.getProjetoResumos().subscribe((p) => {
      this.projetos = p;
    });
  }
}
