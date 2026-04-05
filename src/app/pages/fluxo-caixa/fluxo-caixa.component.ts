import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { FormsModule } from "@angular/forms";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { DataService } from "../../services/data.service";
import { FluxoMensal } from "../../models/lancamento.model";
// Chart.register foi movido para o main.ts

@Component({
  selector: "app-fluxo-caixa",
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatSelectModule, MatFormFieldModule, FormsModule, BaseChartDirective],
  template: `
    <div class="page-container">
      <div class="header-row">
        <h1 class="page-title">
          <mat-icon>timeline</mat-icon>
          Fluxo de Caixa
        </h1>
        
        <div class="filters-row">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Filtrar por Projeto</mat-label>
            <mat-select [(ngModel)]="filtroProjeto" (selectionChange)="aplicarFiltros()">
              <mat-option value="">Todos os projetos</mat-option>
              @for (p of projetos; track p) {
                <mat-option [value]="p">{{ p }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Filtrar por Ano</mat-label>
            <mat-select [(ngModel)]="filtroAno" (selectionChange)="aplicarFiltros()">
              <mat-option value="">Todos os anos</mat-option>
              <mat-option value="2023">2023</mat-option>
              <mat-option value="2024">2024</mat-option>
              <mat-option value="2025">2025</mat-option>
              <mat-option value="2026">2026</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <div class="kpi-grid">
        <mat-card class="kpi-card card-indicator-green" appearance="outlined">
          <mat-card-content>
            <div class="kpi-label">Total Entradas</div>
            <div class="kpi-value text-green">{{ totais.entradas | currency: "BRL":"symbol":"1.2-2" }}</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-red" appearance="outlined">
          <mat-card-content>
            <div class="kpi-label">Total Saídas</div>
            <div class="kpi-value text-red">{{ totais.saidas | currency: "BRL":"symbol":"1.2-2" }}</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card card-indicator-blue" appearance="outlined">
          <mat-card-content>
            <div class="kpi-label">Saldo Atual</div>
            <div class="kpi-value text-blue">{{ totais.saldoAtual | currency: "BRL":"symbol":"1.2-2" }}</div>
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
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .filters-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .filter-field { width: 250px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .kpi-card mat-card-content { padding: 24px; display: flex; flex-direction: column; gap: 8px; }
    .kpi-card.card-indicator-green { border-left: 5px solid var(--accent-green) !important; }
    .kpi-card.card-indicator-red { border-left: 5px solid var(--accent-red) !important; }
    .kpi-card.card-indicator-blue { border-left: 5px solid var(--accent-primary) !important; }

    .text-green { color: var(--accent-green) !important; }
    .text-red { color: var(--accent-red) !important; }
    .text-blue { color: var(--accent-primary) !important; }

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
  lancamentosOriginais: any[] = [];
  fluxo: FluxoMensal[] = [];
  projetos: string[] = [];
  chartReady = false;
  totais = { entradas: 0, saidas: 0, saldoAtual: 0 };
  filtroAno = "";
  filtroProjeto = "";

  mixedChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  mixedChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#94a3b8", font: { weight: 'bold' } } },
      datalabels: { display: false },
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
    this.dataService.lancamentos$.subscribe((lancs) => {
      this.lancamentosOriginais = lancs;
      this.aplicarFiltros();
    });

    this.dataService.getProjetosUnicos().subscribe((projs) => {
      this.projetos = projs.sort();
    });
  }

  aplicarFiltros(): void {
    let filtrados = this.lancamentosOriginais;

    if (this.filtroAno) {
      filtrados = filtrados.filter(l => l.mesAno.endsWith(this.filtroAno));
    }

    if (this.filtroProjeto) {
      filtrados = filtrados.filter(l => l.projeto === this.filtroProjeto);
    }

    // Agrupar por mesAno
    const porMes = new Map<string, { entradas: number; saidas: number }>();
    filtrados.forEach((l) => {
      if (!l.mesAno) return;
      if (!porMes.has(l.mesAno)) {
        porMes.set(l.mesAno, { entradas: 0, saidas: 0 });
      }
      const m = porMes.get(l.mesAno)!;
      if (l.valor >= 0) {
        m.entradas += l.valor;
      } else {
        m.saidas += Math.abs(l.valor);
      }
    });

    // Ordenar e calcular acumulado
    const sorted = Array.from(porMes.entries()).sort((a, b) => {
      const [ma, ya] = a[0].split("/");
      const [mb, yb] = b[0].split("/");
      const dateA = parseInt(ya) * 100 + parseInt(ma);
      const dateB = parseInt(yb) * 100 + parseInt(mb);
      return dateA - dateB;
    });

    let acumulado = 0;
    this.fluxo = sorted.map(([mesAno, data]) => {
      acumulado += data.entradas - data.saidas;
      return {
        mesAno,
        entradas: data.entradas,
        saidas: data.saidas,
        saldoAcumulado: acumulado,
      };
    });

    // Calculando totais
    this.totais = {
      entradas: this.fluxo.reduce((acc, curr) => acc + curr.entradas, 0),
      saidas: this.fluxo.reduce((acc, curr) => acc + curr.saidas, 0),
      saldoAtual: this.fluxo[this.fluxo.length - 1]?.saldoAcumulado || 0
    };

    this.renderizarGrafico();
  }

  private renderizarGrafico(): void {
    this.chartReady = false;
    setTimeout(() => {
      this.mixedChartData = {
        labels: this.fluxo.map((f: FluxoMensal) => f.mesAno),
        datasets: [
          {
            type: "bar",
            label: "Entradas",
            data: this.fluxo.map((f: FluxoMensal) => f.entradas),
            backgroundColor: "rgba(16, 185, 129, 0.4)",
            borderColor: "#10b981",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Saídas",
            data: this.fluxo.map((f: FluxoMensal) => f.saidas),
            backgroundColor: "rgba(239, 68, 68, 0.4)",
            borderColor: "#ef4444",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "line",
            label: "Saldo Acumulado",
            data: this.fluxo.map((f: FluxoMensal) => f.saldoAcumulado),
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            borderWidth: 3,
            pointBackgroundColor: "#6366f1",
            pointRadius: 2,
            fill: true,
            tension: 0.4,
            yAxisID: "y1",
          } as any,
        ],
      };
      this.chartReady = true;
    }, 50);
  }
}
