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

      <div class="kpi-grid">
        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-info">
              <span class="kpi-label">Total de Categorias</span>
              <span class="kpi-value text-blue">{{ categorias.length }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-green" appearance="outlined">
          <mat-card-content>
            <div class="kpi-info">
              <span class="kpi-label">Total Executado</span>
              <span class="kpi-value text-green">{{ totalDespesas | currency: "BRL":"symbol":"1.0-0" }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

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
                @for (c of allCategorias; track c.categoria) {
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
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .kpi-card mat-card-content { display: flex; flex-direction: column; gap: 8px; padding: 24px; }
    .kpi-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; letter-spacing: 0.5px; }
    .kpi-value { font-size: 26px; font-weight: 600; color: var(--text-primary); }

    .text-green { color: var(--accent-green) !important; }
    .text-blue { color: var(--accent-blue) !important; }

    .charts-grid { display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px; }
    .chart-card, .table-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .chart-card mat-card-header, .table-card mat-card-header { padding: 24px 24px 0; }
    .chart-card mat-card-title, .table-card mat-card-title { font-size: 16px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
    .chart-wrapper { height: 400px; padding: 24px; }

    .table-container { overflow-x: auto; padding: 24px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .data-table th { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-weight: 600; font-size: 12px; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .data-table tr:hover td { background: var(--hover-bg); }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .positive { color: var(--accent-green) !important; }
    .negative { color: var(--accent-red) !important; }
  `,
})
export class CategoriasComponent implements OnInit {
  categorias: CategoriaResumo[] = []; // Compatibilidade (não usada)
  allCategorias: CategoriaResumo[] = [];
  chartCategorias: CategoriaResumo[] = [];
  totalDespesas = 0;
  chartReady = false;

  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#6B7280" }, grid: { color: "rgba(255,255,255,0.03)" } },
      y: { ticks: { color: "#6B7280" }, grid: { display: false } },
    },
  };

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getCategoriaResumos().subscribe((allCats) => {
      this.totalDespesas = allCats.reduce((s, c) => s + c.total, 0);

      const sorted = [...allCats].sort((a, b) => b.total - a.total);
      
      // Full list for table
      this.allCategorias = sorted;

      // Top 15 for chart
      const top15 = sorted.slice(0, 15);
      const others = sorted.slice(15);
      
      if (others.length > 0) {
        const othersTotal = others.reduce((s, c) => s + c.total, 0);
        this.chartCategorias = [...top15, { categoria: "Outros", total: othersTotal }];
      } else {
        this.chartCategorias = top15;
      }

      const colors = this.generateColors(this.chartCategorias.length);

      this.barChartData = {
        labels: this.chartCategorias.map((c) => c.categoria),
        datasets: [{
          data: this.chartCategorias.map((c) => c.total),
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
