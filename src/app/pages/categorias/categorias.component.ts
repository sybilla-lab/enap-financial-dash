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
  templateUrl: "./categorias.component.html",
  styleUrl: "./categorias.component.scss",
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
