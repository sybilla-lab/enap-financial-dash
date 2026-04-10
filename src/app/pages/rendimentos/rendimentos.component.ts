import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatTooltipModule } from "@angular/material/tooltip";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import { Rendimento } from "../../models/lancamento.model";

@Component({
  selector: "app-rendimentos",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    BaseChartDirective,
  ],
  templateUrl: "./rendimentos.component.html",
  styleUrl: "./rendimentos.component.scss",
})
export class RendimentosComponent implements OnInit {
  isLoading = true;

  resumo = {
    totalBruto: 0,
    totalImpostos: 0,
    saldoLiquido: 0,
    totalUtilizado: 0,
    saldoDisponivel: 0,
    porMes: [] as { mesAno: string; bruto: number; imposto: number; liquido: number; acumulado: number }[],
  };

  rendimentos: Rendimento[] = [];
  sortColumn: keyof Rendimento | "" = "mesAno";
  sortDirection: "asc" | "desc" = "asc";

  chartReady = false;
  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#94a3b8", font: { weight: "bold" } } },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.9)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        callbacks: {
          label: (ctx: any) => {
            const label = ctx.dataset.label || "";
            return `${label}: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.parsed.y)}`;
          }
        }
      }
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { display: false } },
      y: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y1: {
        type: "linear",
        position: "right",
        ticks: { color: "#6366f1" },
        grid: { display: false },
      },
    },
  };

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getRendimentoResumo().subscribe((r) => {
      this.resumo = r;
      this.buildChart(r.porMes);
      setTimeout(() => (this.isLoading = false), 1200);
    });

    this.dataService.getRendimentos().subscribe((r) => {
      this.rendimentos = [...r];
      this.applySortRendimentos();
    });
  }

  private buildChart(porMes: typeof this.resumo.porMes): void {
    this.chartReady = false;
    setTimeout(() => {
      this.barChartData = {
        labels: porMes.map((m) => m.mesAno),
        datasets: [
          {
            type: "bar",
            label: "Rendimento Bruto",
            data: porMes.map((m) => m.bruto),
            backgroundColor: "rgba(16,185,129,0.45)",
            borderColor: "#10b981",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Impostos",
            data: porMes.map((m) => m.imposto),
            backgroundColor: "rgba(239,68,68,0.4)",
            borderColor: "#ef4444",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "line",
            label: "Saldo Líquido Acumulado",
            data: porMes.map((m) => m.acumulado),
            borderColor: "#6366f1",
            backgroundColor: "rgba(99,102,241,0.1)",
            borderWidth: 3,
            pointBackgroundColor: "#6366f1",
            pointRadius: 4,
            fill: true,
            tension: 0.4,
            yAxisID: "y1",
          } as any,
        ],
      };
      this.chartReady = true;
    }, 50);
  }

  sort(col: keyof Rendimento): void {
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortColumn = col;
      this.sortDirection = "asc";
    }
    this.applySortRendimentos();
  }

  private parseMesAno(s: string): number {
    const p = (s || "").split("/");
    return p.length === 2 ? parseInt(p[1]) * 100 + parseInt(p[0]) : 0;
  }

  private applySortRendimentos(): void {
    const col = this.sortColumn;
    const dir = this.sortDirection;
    this.rendimentos = [...this.rendimentos].sort((a, b) => {
      if (col === "mesAno") {
        const diff = this.parseMesAno(a.mesAno) - this.parseMesAno(b.mesAno);
        return dir === "asc" ? diff : -diff;
      }
      const va = a[col as keyof Rendimento];
      const vb = b[col as keyof Rendimento];
      if (typeof va === "number" && typeof vb === "number") return dir === "asc" ? va - vb : vb - va;
      const cmp = String(va || "").localeCompare(String(vb || ""));
      return dir === "asc" ? cmp : -cmp;
    });
  }

  get pctUtilizado(): number {
    return this.resumo.saldoLiquido > 0
      ? (this.resumo.totalUtilizado / this.resumo.saldoLiquido) * 100
      : 0;
  }

  get pctDisponivel(): number {
    return 100 - this.pctUtilizado;
  }
}
