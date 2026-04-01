import { Component, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatTableModule } from "@angular/material/table";
import { MatDividerModule } from "@angular/material/divider";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import { SaldoRemanescente } from "../../models/lancamento.model";

@Component({
  selector: "app-saldos",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatDividerModule,
    BaseChartDirective,
  ],
  providers: [CurrencyPipe, DecimalPipe],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>history_edu</mat-icon>
        Saldos Remanescentes
      </h1>

      <div class="kpi-grid">
        <!-- KPI: Total Remanescente -->
        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-info">
              <div class="kpi-label">TOTAL EM SALDOS</div>
              <div class="kpi-value text-blue">{{ totalRemanescente | currency: "BRL":"symbol":"1.2-2" }}</div>
              <div class="kpi-sub">Total transferido de volta ao fundo</div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- KPI: Projetos Finalizados -->
        <mat-card class="kpi-card card-indicator-green" appearance="outlined">
          <mat-card-content>
            <div class="kpi-info">
              <div class="kpi-label">PROJETOS COM SALDO</div>
              <div class="kpi-value text-green">{{ saldos.length }}</div>
              <div class="kpi-sub">Projetos que geraram sobras</div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- KPI: Eficiência Média -->
        <mat-card class="kpi-card card-indicator-purple" appearance="outlined">
          <mat-card-content>
            <div class="kpi-info">
              <div class="kpi-label">EFICIÊNCIA MÉDIA</div>
              <div class="kpi-value text-purple">{{ eficienciaMedia | number: "1.1-1" }}%</div>
              <div class="kpi-sub">Média de utilização do orçamento</div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="main-grid">
        <!-- Chart: Saldos por Parceiro -->
        <mat-card class="summary-card" appearance="outlined">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>analytics</mat-icon> Distribuição por Parceiro
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-wrapper">
               <canvas baseChart [data]="barChartData" [options]="barChartOptions" [type]="'bar'"></canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Table: Detalhamento -->
        <mat-card class="summary-card" appearance="outlined">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>list_alt</mat-icon> Detalhamento de Projetos
            </mat-card-title>
          </mat-card-header>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="center">Data</th>
                  <th>Parceiro</th>
                  <th>Projeto</th>
                  <th class="num">Saldo Transferido</th>
                  <th class="center">Eficiência</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of saldos">
                  <td class="center">{{ s.data }}</td>
                  <td><span class="badge">{{ s.parceiro }}</span></td>
                  <td>{{ s.projeto }}</td>
                  <td class="num font-bold text-blue">{{ s.valorTransferido | currency: "BRL":"symbol":"1.2-2" }}</td>
                  <td class="center">
                    <span class="status-pill" [style.background-color]="getEfficiencyColor(s.percentualSobra)">
                       {{ (100 - s.percentualSobra) | number: "1.1-1" }}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .main-grid { display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 24px; margin-top: 24px; }
    @media (max-width: 1200px) { .main-grid { grid-template-columns: 1fr; } }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-bottom: 32px;
    }
    @media (max-width: 900px) { .kpi-grid { grid-template-columns: 1fr; } }

    .chart-wrapper { height: 380px; padding: 24px; display: flex; align-items: center; justify-content: center; }
    
    .kpi-card { 
      min-height: 120px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      text-align: center;
    }
    .kpi-info { width: 100%; }

    .badge {
      background: var(--hover-bg);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .status-pill {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      color: white;
    }

    .kpi-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .kpi-value {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .kpi-sub {
      font-size: 12px;
      color: var(--text-secondary);
      opacity: 0.8;
    }

    .table-container { 
      padding: 0 24px 24px; 
      overflow-x: auto; 
    }
    .data-table { 
      width: 100%; 
      border-collapse: collapse; 
    }
    .data-table th { 
      text-align: left; 
      padding: 12px 16px; 
      color: var(--text-muted); 
      font-size: 12px; 
      text-transform: uppercase; 
      border-bottom: 2px solid var(--border-color);
    }
    .data-table td { 
      padding: 16px; 
      border-bottom: 1px solid var(--border-color); 
      font-size: 13px;
    }
    .data-table th.num, .data-table td.num { text-align: right; }
    .data-table th.center, .data-table td.center { text-align: center; }

    .font-bold { font-weight: 600; }
  `]
})
export class SaldosGestaoComponent implements OnInit {
  saldos: SaldoRemanescente[] = [];
  totalRemanescente = 0;
  eficienciaMedia = 0;

  public barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  public barChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "#1e293b",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: { 
        ticks: { color: "#94a3b8", font: { size: 11 } }, 
        grid: { display: false } 
      },
      y: { 
        ticks: { color: "#94a3b8", font: { size: 11 } }, 
        grid: { color: "rgba(255,255,255,0.05)" } 
      }
    }
  };

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.dataService.getSaldos().subscribe(data => {
      this.saldos = data;
      this.totalRemanescente = data.reduce((acc, curr) => acc + curr.valorTransferido, 0);
      
      const eficiencias = data.filter(d => d.valorProjeto > 0).map(d => 100 - d.percentualSobra);
      this.eficienciaMedia = eficiencias.length > 0 ? eficiencias.reduce((a, b) => a + b, 0) / eficiencias.length : 0;
      
      this.updateChart();
    });
  }

  updateChart() {
    this.dataService.getSaldosPorParceiro().subscribe(mapa => {
      this.barChartData = {
        labels: mapa.map(m => m.parceiro),
        datasets: [{
          data: mapa.map(m => m.valor),
          backgroundColor: "#3b82f6",
          borderRadius: 6,
          barThickness: 30
        }]
      };
    });
  }

  getEfficiencyColor(sobraPct: number): string {
    const ef = 100 - sobraPct;
    if (ef > 90) return "#10b981"; // Verde (Muito eficiente)
    if (ef > 75) return "#FBBF24"; // Amarelo
    return "#f43f5e"; // Vermelho
  }
}
