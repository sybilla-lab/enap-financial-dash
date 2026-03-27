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
    .page-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .page-title { display: flex; align-items: center; gap: 12px; font-size: 28px; font-weight: 300; margin-bottom: 24px; color: var(--text-primary); }
    .chart-card, .table-card { background: var(--card-bg) !important; border: 1px solid var(--border-color) !important; border-radius: 16px !important; margin-bottom: 24px; }
    .chart-card mat-card-header, .table-card mat-card-header { padding: 20px 20px 0; }
    .chart-card mat-card-title, .table-card mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 16px; color: var(--text-primary); }
    .chart-wrapper { padding: 16px; height: 400px; }
    .table-container { overflow-x: auto; padding: 16px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .data-table th { padding: 12px 16px; text-align: left; border-bottom: 2px solid var(--border-color); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    .data-table td { padding: 10px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .data-table tr:hover td { background: var(--hover-bg); }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .positive { color: #4caf50 !important; }
    .negative { color: #f44336 !important; }
  `,
})
export class FluxoCaixaComponent implements OnInit {
  fluxo: FluxoMensal[] = [];
  chartReady = false;

  mixedChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  mixedChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#ccc", padding: 16 } },
    },
    scales: {
      x: { ticks: { color: "#aaa", maxRotation: 45 }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: {
        type: "linear",
        position: "left",
        ticks: { color: "#aaa" },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y1: {
        type: "linear",
        position: "right",
        ticks: { color: "#ffab40" },
        grid: { display: false },
      },
    },
  };

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getFluxoMensal().subscribe((fluxo) => {
      this.fluxo = fluxo;

      this.mixedChartData = {
        labels: fluxo.map((f) => f.mesAno),
        datasets: [
          {
            type: "bar",
            label: "Entradas",
            data: fluxo.map((f) => f.entradas),
            backgroundColor: "rgba(76, 175, 80, 0.7)",
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Saídas",
            data: fluxo.map((f) => f.saidas),
            backgroundColor: "rgba(244, 67, 54, 0.7)",
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "line",
            label: "Saldo Acumulado",
            data: fluxo.map((f) => f.saldoAcumulado),
            borderColor: "#ffab40",
            backgroundColor: "rgba(255, 171, 64, 0.1)",
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            yAxisID: "y1",
          } as any,
        ],
      };
      this.chartReady = true;
    });
  }
}
