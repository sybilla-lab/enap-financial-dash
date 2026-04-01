import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { DataService } from "../../services/data.service";
import { CategoriaResumo } from "../../models/lancamento.model";
import ChartDataLabels from "chartjs-plugin-datalabels";

Chart.register(...registerables, ChartDataLabels);

@Component({
  selector: "app-categorias",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    BaseChartDirective
  ],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>category</mat-icon>
        Despesas por Categoria
      </h1>

      <div class="filter-bar">
        <mat-form-field appearance="outline" class="filter-select">
          <mat-label>Filtrar por Projetos</mat-label>
          <mat-select [formControl]="projectFilter" multiple (selectionChange)="onFilterChange()">
            <mat-select-trigger>
              {{ (projectFilter.value && projectFilter.value.length > 0) ? projectFilter.value[0] : '' }}
              @if ((projectFilter.value?.length || 0) > 1) {
                <span class="additional-selection">
                  (+{{ (projectFilter.value?.length || 0) - 1 }} {{ (projectFilter.value?.length || 0) === 2 ? 'outro' : 'outros' }})
                </span>
              }
            </mat-select-trigger>
            @for (proj of allAvailableProjects; track proj) {
              <mat-option [value]="proj">{{ proj }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        
        @if (projectFilter.value && projectFilter.value.length > 0) {
          <button mat-button color="warn" (click)="clearFilters()" class="clear-btn">
            <mat-icon>filter_list_off</mat-icon>
            Limpar Filtros
          </button>
        }
      </div>

      <div class="kpi-grid">
        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>category</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Total de Categorias </span>
              <span class="kpi-value text-blue">{{ allCategorias.length }}</span>
            </div>
          </mat-card-content>
        </mat-card>
 
        <mat-card class="kpi-card card-indicator-green" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>payments</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">Total Executado </span>
              <span class="kpi-value text-green">{{ totalDespesas | currency: "BRL":"symbol":"1.2-2" }}</span>
            </div>
          </mat-card-content>
        </mat-card>
 
        <mat-card class="kpi-card card-indicator-orange" appearance="outlined">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>pie_chart</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-label">% Concentração Top5 </span>
              <span class="kpi-value text-orange">{{ top5Percentual | number: "1.1-1" }}%</span>
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
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .filter-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; background: var(--card-bg); padding: 20px 24px; border-radius: 12px; border: 1px solid var(--border-color); }
    .filter-select { flex: 1; max-width: 400px; margin-bottom: -1.25em; } /* Ajuste fino para remover o espaço reservado para hints/erros */
    .clear-btn { height: 56px; border-radius: 8px; display: flex; align-items: center; gap: 8px; }
    .additional-selection { opacity: 0.7; font-size: 0.85em; margin-left: 4px; }
    .kpi-card { 
      background: var(--card-bg) !important; 
      border-radius: 12px !important; 
      border: 1px solid var(--border-color) !important;
    }
    
    /* Garantia de visibilidade dos indicadores nesta guia - DINÂMICO */
    .kpi-card.card-indicator-blue { border-left: 5px solid var(--accent-primary) !important; }
    .kpi-card.card-indicator-green { border-left: 5px solid var(--accent-green) !important; }
    .kpi-card.card-indicator-orange { border-left: 5px solid var(--accent-orange) !important; }

    .kpi-card mat-card-content { display: flex; align-items: center; gap: 16px; padding: 24px; }
    .kpi-icon {
      width: 44px; height: 44px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .kpi-icon mat-icon { font-size: 24px; width: 24px; height: 24px; color: #ffffff !important; }

    /* Estilos luxo preenchidos para Categorias - Gradientes Dinâmicos */
    .card-indicator-blue .kpi-icon { background: linear-gradient(135deg, var(--accent-primary), rgba(255,255,255,0.1)); }
    .card-indicator-green .kpi-icon { background: linear-gradient(135deg, var(--accent-green), var(--accent-green-soft)); }
    .card-indicator-orange .kpi-icon { background: linear-gradient(135deg, var(--accent-orange), #ea580c); }
    .kpi-card.card-indicator-blue { border-left: 5px solid #6366f1 !important; }
    .kpi-card.card-indicator-green { border-left: 5px solid #10b981 !important; }
    .kpi-card.card-indicator-orange { border-left: 5px solid #f97316 !important; }

    .kpi-info { display: flex; flex-direction: column; }
    .kpi-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; letter-spacing: 0.5px; }
    .kpi-value { font-size: 24px; font-weight: 600; color: var(--text-primary); }
    
    .text-green { color: var(--accent-green) !important; }
    .text-blue { color: var(--accent-primary) !important; }
    .text-orange { color: var(--accent-orange) !important; }

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
  allCategorias: CategoriaResumo[] = [];
  chartCategorias: CategoriaResumo[] = [];
  totalDespesas = 0;
  top5Percentual = 0;
  chartReady = false;

  private allLancamentos: any[] = [];
  allAvailableProjects: string[] = [];
  projectFilter = new FormControl<string[]>([]);

  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: "end",
        align: "end",
        color: "#94a3b8",
        font: { weight: "bold", size: 11 },
        formatter: (value: any, ctx: any) => {
          const datasetData = ctx.chart.data.datasets[0].data as number[];
          const total = datasetData.reduce((a, b) => a + b, 0);
          const percent = total > 0 ? (value / total) * 100 : 0;
          return percent.toFixed(1).replace(".", ",") + "%";
        }
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.x !== null) {
              label += new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(context.parsed.x);
            }
            return label;
          }
        }
      }
    },
    layout: {
      padding: { right: 50 }
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y: { ticks: { color: "#94a3b8", font: { size: 11 } }, grid: { display: false } },
    },
  };

  constructor(private dataService: DataService) { }

  ngOnInit(): void {
    // Subscreve ao stream principal de lançamentos e projetos
    this.dataService.lancamentos$.subscribe((lancs) => {
      this.allLancamentos = lancs;
      this.dataService.getProjetosUnicos().subscribe(projs => {
        this.allAvailableProjects = projs.sort();
        this.processData();
      });
    });
  }

  onFilterChange(): void {
    this.processData();
  }

  clearFilters(): void {
    this.projectFilter.setValue([]);
    this.processData();
  }

  private processData(): void {
    const selectedProjects = this.projectFilter.value || [];

    // 1. Filtrar lançamentos por projeto (se houver seleção)
    let filteredLancs = this.allLancamentos;
    if (selectedProjects.length > 0) {
      filteredLancs = this.allLancamentos.filter(l => selectedProjects.includes(l.projeto));
    }

    // 2. Agrupar por categoria (lógica movida da DataService para maior flexibilidade local)
    const mapaCategorias = new Map<string, number>();
    filteredLancs
      .filter((l) => l.categoria !== "0.0.0 Recurso" && l.categoria && l.valor < 0)
      .forEach((l) => {
        const cleanCat = l.categoria.replace(/^\d+(\.\d+)*\s*/, "").trim();
        const current = mapaCategorias.get(cleanCat) || 0;
        mapaCategorias.set(cleanCat, current + Math.abs(l.valor));
      });

    const result: CategoriaResumo[] = Array.from(mapaCategorias.entries())
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);

    this.allCategorias = result;
    this.totalDespesas = result.reduce((s, c) => s + c.total, 0);

    // 3. KPIs
    const top5Total = result.slice(0, 5).reduce((s, c) => s + c.total, 0);
    this.top5Percentual = this.totalDespesas > 0 ? (top5Total / this.totalDespesas) * 100 : 0;

    // 4. Gráfico (Top 15 + Outros se não filtrado, exatamente os filtrados se houver seleção)
    if (selectedProjects.length > 0) {
      this.chartCategorias = result;
    } else {
      const top15 = result.slice(0, 15);
      const others = result.slice(15);
      if (others.length > 0) {
        const othersTotal = others.reduce((s, c) => s + c.total, 0);
        this.chartCategorias = [...top15, { categoria: "Outros", total: othersTotal }];
      } else {
        this.chartCategorias = top15;
      }
    }

    const colors = this.generateColors(this.chartCategorias.length);
    this.barChartData = {
      labels: this.chartCategorias.map((c) => c.categoria),
      datasets: [{
        label: 'Total Despesas',
        data: this.chartCategorias.map((c) => c.total),
        backgroundColor: colors,
        borderRadius: 6,
      }],
    };
    this.chartReady = true;
  }

  getPercentual(valor: number): number {
    return this.totalDespesas > 0 ? (valor / this.totalDespesas) * 100 : 0;
  }

  private generateColors(count: number): string[] {
    const base = [
      "rgba(99, 102, 241, 0.8)",  /* Indigo 500 */
      "rgba(16, 185, 129, 0.8)",  /* Emerald 500 */
      "rgba(100, 116, 139, 0.8)", /* Slate 500 */
      "rgba(245, 158, 11, 0.8)",  /* Amber 500 */
      "rgba(239, 68, 68, 0.8)",   /* Red 500 */
      "rgba(139, 92, 246, 0.8)",  /* Violet 500 */
      "rgba(20, 184, 166, 0.8)",  /* Teal 500 */
      "rgba(249, 115, 22, 0.8)",  /* Orange 500 */
      "rgba(59, 130, 246, 0.8)",  /* Blue 500 */
      "rgba(107, 114, 128, 0.8)", /* Gray 500 */
      "rgba(168, 85, 247, 0.8)",  /* Purple 500 */
      "rgba(236, 72, 153, 0.8)",  /* Pink 500 */
      "rgba(14, 165, 233, 0.8)",  /* Sky 500 */
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
