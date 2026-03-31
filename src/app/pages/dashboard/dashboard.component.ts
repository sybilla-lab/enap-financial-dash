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
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>dashboard</mat-icon>
        Dashboard Geral
      </h1>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card kpi-recebido card-indicator-green custom-tooltip-container" appearance="outlined">
          <div class="custom-tooltip">
            <strong>Recebido por Financiador</strong>
            <mat-divider style="margin: 8px 0; border-color: rgba(255,255,255,0.1);"></mat-divider>
            @for (f of financiadores; track f.financiador) {
              <div class="tooltip-row">
                <span>{{ f.financiador }}</span>
                <span class="num">{{ f.valor | currency: "BRL":"symbol":"1.0-0" }}</span>
              </div>
            }
            @if (financiadores.length === 0) {
               <div class="tooltip-row"><span>Nenhum financiamento detalhado</span></div>
            }
          </div>
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

        <mat-card class="kpi-card kpi-executado card-indicator-red custom-tooltip-container" appearance="outlined">
          <div class="custom-tooltip">
            <strong>Execução de Projetos Ativos</strong>
            <mat-divider style="margin: 8px 0; border-color: rgba(255,255,255,0.1);"></mat-divider>
            @for (p of projetosAtivos; track p.projeto) {
              <div class="tooltip-row">
                <span>{{ p.projeto }}</span>
                <span class="num">{{ p.execucao | number: "1.0-1" }}%</span>
              </div>
            }
          </div>
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

        <mat-card class="kpi-card card-indicator-blue custom-tooltip-container" appearance="outlined">
          <div class="custom-tooltip">
            <strong>Sobre os Pagamentos</strong>
            <div style="font-size: 11px; margin-top: 4px; line-height: 1.4;">
               Este número representa o total de transações de saída realizadas para a execução dos projetos.
               Pode ser utilizado para dimensionar o esforço operacional da equipe financeira mensalmente.
            </div>
          </div>
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>receipt_long</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">N° de Pagamentos</span>
              <span class="kpi-value">{{ indicadores.numPagamentos }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-blue custom-tooltip-container" appearance="outlined">
          <div class="custom-tooltip">
            <strong>Sobre o Ticket Médio</strong>
            <div style="font-size: 11px; margin-top: 4px; line-height: 1.4;">
               Valor médio por pagamento efetuado (Total Executado / N° de Pagamentos).
               Indica o padrão de gastos transacionais dos projetos, ajudando em projeções de caixa.
            </div>
          </div>
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>paid</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Ticket Médio</span>
              <span class="kpi-value">{{ indicadores.ticketMedio | currency: "BRL":"symbol":"1.0-0" }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-orange" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>trending_up</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Inflação Recebida</span>
              <span class="kpi-value text-orange">{{ inflacao | currency: "BRL":"symbol":"1.0-0" }}</span>
              <span class="kpi-sub">Reajustes contratuais (extra)</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>analytics</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">% Atingido (Meta Total)</span>
              <span class="kpi-value">{{ (totalRecebidoNet / dataService.META_TOTAL * 100) | number: "1.1-1" }}%</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="(totalRecebidoNet / dataService.META_TOTAL * 100)"></mat-progress-bar>
          </mat-card-content>
        </mat-card>

        <!-- Gestão Estratégica -->
        <mat-card class="kpi-card kpi-runway card-indicator-blue custom-tooltip-container" appearance="outlined">
          <div class="custom-tooltip">
            <strong>Runway Estimado</strong>
            <div style="font-size: 11px; margin-top: 4px; line-height: 1.4;">
               Tempo estimado em meses que os recursos atuais cobrirão as despesas, baseado na média mensal histórica de saídas. 
               Isso permite à gestão saber quando iniciar novas captações caso seja necessário.
            </div>
          </div>
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
    .kpi-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 16px; 
      margin-bottom: 24px;
    }
    .kpi-card {
      flex: 1 1 220px;
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
    .text-orange { color: #fb923c !important; }

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

    /* Tooltips customizados CSS */
    .custom-tooltip-container { position: relative; overflow: visible !important; cursor: pointer; }
    .custom-tooltip {
      position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
      background: rgba(15, 42, 38, 0.95);
      border: 1px solid var(--border-color);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      padding: 16px; border-radius: 12px;
      backdrop-filter: blur(12px);
      width: max-content; max-width: 320px;
      z-index: 1000;
      opacity: 0; visibility: hidden;
      transition: all 0.2s ease;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    :host-context(body.light-theme) .custom-tooltip {
      background: rgba(255, 255, 255, 0.95);
      color: #1f1f1f;
    }
    .custom-tooltip-container:hover .custom-tooltip { opacity: 1; visibility: visible; transform: translate(-50%, -4px); }
    .tooltip-row { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 6px; font-size: 13px; }
    .tooltip-row:last-child { margin-bottom: 0; }

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

  constructor(public dataService: DataService) {}

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
    });
  }
}
