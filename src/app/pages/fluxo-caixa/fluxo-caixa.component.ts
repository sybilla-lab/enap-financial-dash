import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { DataService } from "../../services/data.service";
import { FluxoMensal } from "../../models/lancamento.model";

Chart.register(...registerables);

@Component({
  selector: "app-fluxo-caixa",
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, BaseChartDirective],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>timeline</mat-icon>
        Fluxo de Caixa
      </h1>

      <div class="kpi-grid">
        <mat-card class="kpi-card card-indicator-green" appearance="outlined">
          <mat-card-content>
            <div class="kpi-label">Total de Entradas</div>
            <div class="kpi-value text-green">{{ totais.entradas | currency: "BRL":"symbol":"1.0-0" }}</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-red" appearance="outlined">
          <mat-card-content>
            <div class="kpi-label">Total de Saídas</div>
            <div class="kpi-value text-red">{{ totais.saidas | currency: "BRL":"symbol":"1.0-0" }}</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-label">Saldo Atual</div>
            <div class="kpi-value text-blue">{{ totais.saldoAtual | currency: "BRL":"symbol":"1.0-0" }}</div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Mixed Chart -->
      <mat-card class="chart-card" appearance="outlined">
        <mat-card-header><mat-card-title>Entradas, Saídas e Saldo Acumulado</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="chart-wrapper">
            @if (chartReady) {
            <canvas baseChart
              [data]="mixedChartData"
              [options]="mixedChartOptions"
              [type]="'bar'">
            </canvas>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Table -->
      <mat-card class="table-card" appearance="outlined">
        <mat-card-header><mat-card-title><mat-icon>table_chart</mat-icon> Detalhamento Mensal</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mês/Ano</th>
                  <th class="num">Entradas</th>
                  <th class="num">Saídas</th>
                  <th class="num">Resultado</th>
                  <th class="num">Saldo Acumulado</th>
                </tr>
              </thead>
              <tbody>
                @for (f of fluxo; track f.mesAno) {
                <tr>
                  <td>{{ f.mesAno }}</td>
                  <td class="num positive">{{ f.entradas | currency: "BRL":"symbol":"1.2-2" }}</td>
                  <td class="num negative">{{ f.saidas | currency: "BRL":"symbol":"1.2-2" }}</td>
                  <td class="num" [class.positive]="f.entradas - f.saidas >= 0" [class.negative]="f.entradas - f.saidas < 0">
                    {{ f.entradas - f.saidas | currency: "BRL":"symbol":"1.2-2" }}
                  </td>
                  <td class="num" [class.positive]="f.saldoAcumulado >= 0" [class.negative]="f.saldoAcumulado < 0">
                    {{ f.saldoAcumulado | currency: "BRL":"symbol":"1.2-2" }}
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
    .fluxo-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .page-title { display: flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 300; margin-bottom: 24px; color: var(--text-primary); }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .kpi-card mat-card-content { padding: 24px; display: flex; flex-direction: column; gap: 8px; }
    .kpi-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; letter-spacing: 0.5px; }
    .kpi-value { font-size: 26px; font-weight: 600; color: var(--text-primary); }
    
    .text-green { color: var(--accent-green) !important; }
    .text-red { color: var(--accent-red) !important; }
    .text-blue { color: var(--accent-blue) !important; }

    .chart-card { background: var(--card-bg) !important; border-radius: 12px !important; margin-bottom: 24px; }
    .chart-card mat-card-header { padding: 24px 24px 0; }
    .chart-card mat-card-title { font-size: 16px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
    .chart-wrapper { height: 500px; padding: 24px; }

    .table-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .table-container { overflow-x: auto; padding: 16px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .data-table th { padding: 12px 16px; text-align: left; border-bottom: 2px solid var(--border-color); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    .data-table td { padding: 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .data-table tr:hover td { background: var(--hover-bg); }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .positive { color: var(--accent-green) !important; }
    .negative { color: var(--accent-red) !important; }
  `,
})
export class FluxoCaixaComponent implements OnInit {
  fluxo: FluxoMensal[] = [];
  chartReady = false;
  totais = { entradas: 0, saidas: 0, saldoAtual: 0 };

  mixedChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  mixedChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#9CA3AF" } },
    },
    scales: {
      x: { ticks: { color: "#6B7280" }, grid: { display: false } },
      y: { ticks: { color: "#6B7280" }, grid: { color: "rgba(255,255,255,0.03)" } },
      y1: {
        type: "linear",
        position: "right",
        ticks: { color: "#38BDF8" },
        grid: { display: false },
      },
    },
  };

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getFluxoMensal().subscribe((fluxo: FluxoMensal[]) => {
      this.fluxo = fluxo;
      
      // Calculando totais com tipagem explícita
      this.totais = {
        entradas: fluxo.reduce((acc: number, curr: FluxoMensal) => acc + curr.entradas, 0),
        saidas: fluxo.reduce((acc: number, curr: FluxoMensal) => acc + curr.saidas, 0),
        saldoAtual: fluxo[fluxo.length - 1]?.saldoAcumulado || 0
      };

      this.mixedChartData = {
        labels: fluxo.map((f: FluxoMensal) => f.mesAno),
        datasets: [
          {
            type: "bar",
            label: "Entradas",
            data: fluxo.map((f: FluxoMensal) => f.entradas),
            backgroundColor: "rgba(52, 211, 153, 0.4)",
            borderColor: "#34D399",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Saídas",
            data: fluxo.map((f: FluxoMensal) => f.saidas),
            backgroundColor: "rgba(248, 113, 113, 0.4)",
            borderColor: "#F87171",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "line",
            label: "Saldo Acumulado",
            data: fluxo.map((f: FluxoMensal) => f.saldoAcumulado),
            borderColor: "#38BDF8",
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            borderWidth: 3,
            pointBackgroundColor: "#38BDF8",
            pointRadius: 2,
            fill: true,
            tension: 0.4,
            yAxisID: "y1",
          } as any,
        ],
      };
      this.chartReady = true;
    });
  }
}
