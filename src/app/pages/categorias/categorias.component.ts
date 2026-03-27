import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { DataService } from "../../services/data.service";
import { CategoriaResumo } from "../../models/lancamento.model";

Chart.register(...registerables);

@Component({
  selector: "app-categorias",
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, BaseChartDirective],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>category</mat-icon>
        Despesas por Categoria
      </h1>

      <!-- Chart -->
      <mat-card class="chart-card" appearance="outlined">
        <mat-card-header><mat-card-title>Distribuição de Despesas</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="chart-wrapper">
            @if (chartReady) {
            <canvas baseChart
              [data]="barChartData"
              [options]="barChartOptions"
              [type]="'bar'">
            </canvas>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Table -->
      <mat-card class="table-card" appearance="outlined">
        <mat-card-header><mat-card-title><mat-icon>table_chart</mat-icon> Detalhamento</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th class="num">Total</th>
                  <th class="num">% do Total</th>
                </tr>
              </thead>
              <tbody>
                @for (c of categorias; track c.categoria) {
                <tr>
                  <td>{{ c.categoria }}</td>
                  <td class="num negative">{{ c.total | currency: "BRL":"symbol":"1.2-2" }}</td>
                  <td class="num">{{ getPercentual(c.total) | number: "1.1-1" }}%</td>
                </tr>
                }
                <tr class="total-row">
                  <td><strong>TOTAL</strong></td>
                  <td class="num"><strong>{{ totalDespesas | currency: "BRL":"symbol":"1.2-2" }}</strong></td>
                  <td class="num"><strong>100%</strong></td>
                </tr>
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
    .chart-wrapper { padding: 16px; min-height: 400px; }
    .table-container { overflow-x: auto; padding: 16px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .data-table th { padding: 12px 16px; text-align: left; border-bottom: 2px solid var(--border-color); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    .data-table td { padding: 10px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .data-table tr:hover td { background: var(--hover-bg); }
    .total-row td { border-top: 2px solid var(--border-color); background: var(--hover-bg); }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .negative { color: #f44336 !important; }
  `,
})
export class CategoriasComponent implements OnInit {
  categorias: CategoriaResumo[] = [];
  totalDespesas = 0;
  chartReady = false;

  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#aaa" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#aaa", font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getCategoriaResumos().subscribe((cats) => {
      this.categorias = cats;
      this.totalDespesas = cats.reduce((s, c) => s + c.total, 0);

      const colors = this.generateColors(cats.length);

      this.barChartData = {
        labels: cats.map((c) => c.categoria),
        datasets: [{
          data: cats.map((c) => c.total),
          backgroundColor: colors,
          borderRadius: 6,
        }],
      };
      this.chartReady = true;
    });
  }

  getPercentual(valor: number): number {
    return this.totalDespesas > 0 ? (valor / this.totalDespesas) * 100 : 0;
  }

  private generateColors(count: number): string[] {
    const base = [
      "rgba(124, 77, 255, 0.75)",
      "rgba(0, 188, 212, 0.75)",
      "rgba(255, 152, 0, 0.75)",
      "rgba(76, 175, 80, 0.75)",
      "rgba(244, 67, 54, 0.75)",
      "rgba(33, 150, 243, 0.75)",
      "rgba(156, 39, 176, 0.75)",
      "rgba(255, 87, 34, 0.75)",
      "rgba(139, 195, 74, 0.75)",
      "rgba(255, 193, 7, 0.75)",
      "rgba(63, 81, 181, 0.75)",
      "rgba(0, 150, 136, 0.75)",
      "rgba(233, 30, 99, 0.75)",
      "rgba(121, 85, 72, 0.75)",
      "rgba(96, 125, 139, 0.75)",
    ];
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(base[i % base.length]);
    }
    return result;
  }
}
