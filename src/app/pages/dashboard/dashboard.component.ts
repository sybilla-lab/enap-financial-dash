import { Component, OnInit, Inject } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import ChartDataLabels from "chartjs-plugin-datalabels";

// --- INÍCIO DOS COMPONENTES DE MODAL ---

@Component({
  selector: 'app-modal-financiadores',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, BaseChartDirective],
  template: `
    <div class="modal-box">
      <div class="modal-header">
        <h2><mat-icon>account_balance_wallet</mat-icon> Recebido por Financiador</h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>
      <mat-divider></mat-divider>
      <div class="modal-content">
        <div class="chart-container" style="height: 300px; padding: 16px 0;">
           <canvas baseChart [data]="chartData" [options]="chartOptions" [type]="'doughnut'"></canvas>
        </div>
        <div class="resume-list">
          @for (f of data; track f.financiador) {
            <div class="list-item">
              <span class="label">{{ f.financiador }}</span>
              <span class="value">{{ f.valor | currency: "BRL":"symbol":"1.0-0" }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-box { padding: 0; background: var(--card-bg); color: var(--text-primary); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 500; display: flex; align-items: center; gap: 8px; color: var(--text-primary); }
    .modal-content { padding: 16px 24px; }
    .resume-list { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
    .list-item { display: flex; justify-content: space-between; font-size: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; }
    .value { font-weight: 600; font-variant-numeric: tabular-nums; }
  `]
})
export class ModalFinanciadoresComponent implements OnInit {
  chartData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  chartOptions: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#9CA3AF' } },
      datalabels: { display: false } // Desativa datalabels numérico pra rosca
    }
  };

  constructor(
    public dialogRef: MatDialogRef<ModalFinanciadoresComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { financiador: string; valor: number }[]
  ) {}

  ngOnInit() {
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
  }
}

@Component({
  selector: 'app-modal-execucao',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, BaseChartDirective],
  template: `
    <div class="modal-box">
      <div class="modal-header">
        <h2><mat-icon>payments</mat-icon> Execução de Projetos Ativos</h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>
      <mat-divider></mat-divider>
      <div class="modal-content">
        <div class="chart-container" style="height: 350px; padding: 16px 0;">
           <canvas baseChart [data]="chartData" [options]="chartOptions" [type]="'bar'"></canvas>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-box { padding: 0; background: var(--card-bg); color: var(--text-primary); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 500; display: flex; align-items: center; gap: 8px; color: var(--text-primary); }
    .modal-content { padding: 16px 24px; }
  `]
})
export class ModalExecucaoComponent implements OnInit {
  chartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  chartOptions: any = {
    responsive: true, maintainAspectRatio: false, indexAxis: "y",
    plugins: { 
      legend: { display: false },
      datalabels: {
        anchor: "end", align: "end", color: "#9CA3AF", font: { weight: "bold" },
        formatter: (value: any) => value.toFixed(1).replace(".", ",") + "%"
      }
    },
    layout: { padding: { right: 50 } },
    scales: {
      x: { ticks: { color: "#6B7280" }, grid: { color: "rgba(255,255,255,0.03)" }, max: 100 },
      y: { ticks: { color: "#6B7280" }, grid: { display: false } },
    }
  };

  constructor(
    public dialogRef: MatDialogRef<ModalExecucaoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { projeto: string; execucao: number }[]
  ) {}

  ngOnInit() {
    this.chartData = {
      labels: this.data.map(d => d.projeto),
      datasets: [{
        data: this.data.map(d => Math.min(d.execucao, 100)),
        backgroundColor: "#F87171",
        borderRadius: 4
      }]
    };
  }
}

@Component({
  selector: 'app-modal-info',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule],
  template: `
    <div class="modal-box">
      <div class="modal-header">
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
    .modal-box { padding: 0; background: var(--card-bg); color: var(--text-primary); max-width: 400px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 500; display: flex; align-items: center; gap: 8px; color: var(--text-primary); }
    .modal-header mat-icon { color: var(--accent-blue); }
    .modal-content { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
    .description { font-size: 15px; line-height: 1.6; color: var(--text-secondary); margin: 0; }
    .highlight-value { font-size: 32px; font-weight: 700; color: var(--text-primary); text-align: center; padding: 16px; background: var(--hover-bg); border-radius: 8px; }
  `]
})
export class ModalInfoComponent {
  constructor(
    public dialogRef: MatDialogRef<ModalInfoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; icon: string; description: string; value?: string }
  ) {}
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
        Dashboard Geral
      </h1>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card clickable kpi-recebido card-indicator-green" appearance="outlined" (click)="abrirModal('finance')">
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

        <mat-card class="kpi-card clickable kpi-executado card-indicator-red" appearance="outlined" (click)="abrirModal('execucao')">
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

        <mat-card class="kpi-card clickable card-indicator-blue" appearance="outlined" (click)="abrirModal('pagamentos')">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>receipt_long</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">N° de Pagamentos</span>
              <span class="kpi-value">{{ indicadores.numPagamentos }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card clickable card-indicator-blue" appearance="outlined" (click)="abrirModal('ticket')">
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
        <mat-card class="kpi-card clickable kpi-runway card-indicator-blue" appearance="outlined" (click)="abrirModal('runway')">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>timer</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Runway (Meses)</span>
              <span class="kpi-value">{{ runway | number: "1.1-1" }}</span>
              <span class="kpi-sub">Tempo estimado de sobrevivência</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card clickable kpi-gap card-indicator-blue" appearance="outlined" (click)="abrirModal('gap')">
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
    .clickable { cursor: pointer; position: relative; }
    .clickable::after { 
        content: 'visibility';
        font-family: 'Material Icons';
        position: absolute; top: 12px; right: 12px;
        color: var(--text-muted); opacity: 0; font-size: 18px;
        transition: opacity 0.2s;
    }
    .clickable:hover::after { opacity: 0.5; }

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

  constructor(
    public dataService: DataService,
    private dialog: MatDialog,
    private currencyPipe: CurrencyPipe,
    private decimalPipe: DecimalPipe
  ) {}

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

  abrirModal(tipo: string): void {
    if (tipo === 'finance') {
      this.dialog.open(ModalFinanciadoresComponent, {
        width: '500px',
        panelClass: 'custom-dialog-container',
        data: this.financiadores
      });
    } else if (tipo === 'execucao') {
      this.dialog.open(ModalExecucaoComponent, {
        width: '600px',
        panelClass: 'custom-dialog-container',
        data: this.projetosAtivos
      });
    } else if (tipo === 'pagamentos') {
      this.dialog.open(ModalInfoComponent, {
        width: '400px',
        panelClass: 'custom-dialog-container',
        data: {
          title: 'Sobre os Pagamentos',
          icon: 'receipt_long',
          description: 'Este número representa o total de transações de saída realizadas na execução dos projetos. Ele permite dimensionar facilmente o volume de esforço operacional da equipe financeira mensalmente.',
          value: this.indicadores.numPagamentos.toString()
        }
      });
    } else if (tipo === 'ticket') {
      this.dialog.open(ModalInfoComponent, {
        width: '400px',
        panelClass: 'custom-dialog-container',
        data: {
          title: 'Ticket Médio',
          icon: 'paid',
          description: 'O Ticket Médio representa o valor base das saídas (Total Executado / N° de Pagamentos). Ter uma visão desse montante estabelece o padrão de custo por transação para futuras projeções de fluxo de caixa.',
          value: this.currencyPipe.transform(this.indicadores.ticketMedio, 'BRL', 'symbol', '1.0-2')
        }
      });
    } else if (tipo === 'runway') {
      this.dialog.open(ModalInfoComponent, {
        width: '400px',
        panelClass: 'custom-dialog-container',
        data: {
          title: 'Runway Estimado',
          icon: 'timer',
          description: 'Expressa em meses o tempo de vida do projeto financeiramente falando (com base na média das saídas dos últimos meses vs montante disponível global). Ajuda a Diretoria e o time a saberem quando a captação precisa acelerar.',
          value: this.decimalPipe.transform(this.runway, '1.1-1') + " meses"
        }
      });
    } else if (tipo === 'gap') {
      this.dialog.open(ModalInfoComponent, {
        width: '400px',
        panelClass: 'custom-dialog-container',
        data: {
          title: 'Gap de Captação',
          icon: 'not_interested',
          description: 'Indica a falta (déficit) dos recursos correntes captados se comparados com a meta global do acordo ou orçamento central. A meta de captação global almejada precisa ser atingida mitigando o Gap.',
          value: this.currencyPipe.transform(this.gapCaptacao, 'BRL', 'symbol', '1.0-0')
        }
      });
    }
  }
}
