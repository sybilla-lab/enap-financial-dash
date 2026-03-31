import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { FormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { combineLatest } from "rxjs";
import { DataService } from "../../services/data.service";
import { ProjetoResumo, Lancamento } from "../../models/lancamento.model";

Chart.register(...registerables);

@Component({
  selector: "app-projetos",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    MatTableModule,
    BaseChartDirective,
  ],
  template: `
    <div class="page-container">
      <h1 class="page-title">
        <mat-icon>folder_special</mat-icon>
        Prestação de Contas por Projeto
      </h1>

      <!-- Filter -->
      <mat-card class="filter-card" appearance="outlined">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field appearance="outline">
              <mat-label>Filtrar por Projeto</mat-label>
              <mat-select [(ngModel)]="projetoSelecionado" (selectionChange)="onFiltroChange()">
                <mat-option value="">Todos os projetos</mat-option>
                @for (p of projetosLista; track p) {
                <mat-option [value]="p">{{ p }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Filtrar por Status</mat-label>
              <mat-select [(ngModel)]="statusSelecionado" (selectionChange)="onFiltroChange()">
                <mat-option value="">Todos os status</mat-option>
                @for (s of statusLista; track s) {
                <mat-option [value]="s">{{ s }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Chart -->
      <mat-card class="chart-card" appearance="outlined">
        <mat-card-header><mat-card-title>Balanço Operacional de Receitas e Despesas</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="chart-wrapper">
            @if (isLoading) {
              <div class="skeleton-box" style="width: 100%; height: 100%; border-radius: 8px;"></div>
            } @else if (chartReady) {
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
        <mat-card-header><mat-card-title><mat-icon>table_chart</mat-icon> Execução Financeira</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th class="num">Entradas</th>
                  <th class="num">Saídas</th>
                  <th class="num">Saldo</th>
                  <th class="num">Execução %</th>
                  <th class="status-col">Status</th>
                </tr>
              </thead>
              <tbody>
                @if (isLoading) {
                  @for (i of [1,2,3,4,5]; track i) {
                    <tr>
                      <td><div class="skeleton-box" style="width: 150px; height: 16px; border-radius: 4px;"></div></td>
                      <td><div class="skeleton-box" style="width: 100px; height: 16px; border-radius: 4px; margin-left: auto;"></div></td>
                      <td><div class="skeleton-box" style="width: 100px; height: 16px; border-radius: 4px; margin-left: auto;"></div></td>
                      <td><div class="skeleton-box" style="width: 100px; height: 16px; border-radius: 4px; margin-left: auto;"></div></td>
                      <td><div class="skeleton-box" style="width: 60px; height: 16px; border-radius: 4px; margin-left: auto;"></div></td>
                      <td class="status-col"><div class="skeleton-box" style="width: 100px; height: 24px; border-radius: 20px; margin: 0 auto;"></div></td>
                    </tr>
                  }
                } @else {
                  @for (p of projetosFiltrados; track p.projeto) {
                  <tr>
                    <td>{{ p.projeto }}</td>
                    <td class="num positive">{{ p.entradas | currency: "BRL":"symbol":"1.2-2" }}</td>
                    <td class="num negative">{{ p.saidas | currency: "BRL":"symbol":"1.2-2" }}</td>
                    <td class="num" [class.positive]="p.saldo >= 0" [class.negative]="p.saldo < 0">{{ p.saldo | currency: "BRL":"symbol":"1.2-2" }}</td>
                    <td class="num">{{ p.execucao | number: "1.1-1" }}%</td>
                    <td class="status-col">
                      <span class="status-badge" [ngClass]="p.status?.toLowerCase() || ''">
                        {{ p.status || 'Ativo' }}
                      </span>
                    </td>
                  </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Alimenta +1000 Cidades detail -->
      @if (projetoSelecionado === "Alimenta +1000 Cidades") {
      <mat-card class="table-card" appearance="outlined">
        <mat-card-header>
          <mat-card-title><mat-icon>info</mat-icon> Detalhamento — Alimenta +1000 Cidades (TED/MDS)</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Observação</th>
                  <th class="num">Valor</th>
                  <th>Mês/Ano</th>
                </tr>
              </thead>
              <tbody>
                @for (l of lancamentosAlimenta; track $index) {
                <tr>
                  <td>{{ l.categoria }}</td>
                  <td>{{ l.observacao }}</td>
                  <td class="num" [class.positive]="l.valor >= 0" [class.negative]="l.valor < 0">{{ l.valor | currency: "BRL":"symbol":"1.2-2" }}</td>
                  <td>{{ l.mesAno }}</td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
      }
    </div>
  `,
  styles: `
    .skeleton-box {
      background: linear-gradient(90deg, var(--hover-bg) 25%, rgba(255,255,255,0.08) 50%, var(--hover-bg) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .filter-card { background: var(--card-bg) !important; border-radius: 12px !important; margin-bottom: 24px; }
    .filter-card mat-card-content { padding: 16px 24px; }
    .filters-row { display: flex; gap: 24px; flex-wrap: wrap; }
    mat-form-field { width: 100%; max-width: 400px; flex: 1 1 300px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .kpi-card mat-card-content { padding: 24px; display: flex; flex-direction: column; gap: 8px; }
    .kpi-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; letter-spacing: 0.5px; }
    .kpi-value { font-size: 26px; font-weight: 600; color: var(--text-primary); }
    
    .text-green { color: var(--accent-green) !important; }
    .text-blue { color: var(--accent-blue) !important; }

    .charts-grid { display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px; }
    .chart-card, .table-card { background: var(--card-bg) !important; border-radius: 12px !important; }
    .chart-card mat-card-header, .table-card mat-card-header { padding: 24px 24px 0; }
    .chart-card mat-card-title, .table-card mat-card-title { font-size: 16px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
    .chart-wrapper { height: 350px; padding: 24px; }

    .table-container { overflow-x: auto; padding: 24px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .data-table th { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-weight: 600; font-size: 12px; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .data-table tr:hover td { background: var(--hover-bg); }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .positive { color: var(--accent-green) !important; }
    .negative { color: var(--accent-red) !important; }
    
    .status-col { text-align: center !important; }
    .status-badge {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; min-width: 100px;
    }
    .status-badge.ativo { background: rgba(52, 211, 153, 0.1); color: var(--accent-green); border: 1px solid rgba(52, 211, 153, 0.2); }
    .status-badge.em.encerramento, .status-badge.encerramento { background: rgba(251, 191, 36, 0.1); color: var(--accent-yellow); border: 1px solid rgba(251, 191, 36, 0.2); }
    .status-badge.finalizado { background: rgba(248, 113, 113, 0.1); color: var(--accent-red); border: 1px solid rgba(248, 113, 113, 0.2); }
  `,
})
export class ProjetosComponent implements OnInit {
  isLoading = true;
  projetos: ProjetoResumo[] = [];
  projetosFiltrados: ProjetoResumo[] = [];
  projetosLista: string[] = [];
  statusLista: string[] = [];
  projetoSelecionado = "";
  statusSelecionado = "";
  lancamentosAlimenta: Lancamento[] = [];
  stats = { ativos: 0, execucaoMedia: 0 };
  saldosOpBasica = 0;

  chartReady = false;
  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { position: "top", labels: { color: "#1f2937", font: { weight: 'bold' } } },
      datalabels: { display: false },
      tooltip: {
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
          },
          afterBody: (tooltipItems: any[]) => {
            // Se estivermos em uma tooltip misturada do stack, calculamos o ratio.
            return ""; 
          }
        }
      }
    },
    scales: {
      x: { stacked: true, ticks: { color: "#6B7280" }, grid: { display: false } },
      y: { stacked: true, ticks: { color: "#6B7280" }, grid: { color: "rgba(255,255,255,0.03)" } },
    },
  };

  constructor(private dataService: DataService) { }

  ngOnInit(): void {
    combineLatest({
      p: this.dataService.getProjetoResumos(),
      saldos: this.dataService.getSaldosResgatadosOperacaoBasica()
    }).subscribe(({ p, saldos }) => {
      this.saldosOpBasica = saldos;
      this.projetos = p;
      this.projetosFiltrados = p;
      this.projetosLista = p.map((x) => x.projeto);
      this.statusLista = Array.from(new Set(p.map((x) => x.status || "Ativo"))).sort();
      this.stats = {
        ativos: p.filter(x => x.status && x.status.toLowerCase() !== "finalizado").length,
        execucaoMedia: p.reduce((acc, curr) => acc + curr.execucao, 0) / p.length
      };
      this.isLoading = false;
      this.buildChart(p);
    });
  }

  onFiltroChange(): void {
    this.projetosFiltrados = this.projetos.filter((p) => {
      const matchProjeto = !this.projetoSelecionado || p.projeto === this.projetoSelecionado;
      const matchStatus = !this.statusSelecionado || (p.status || "Ativo") === this.statusSelecionado;
      return matchProjeto && matchStatus;
    });

    this.buildChart(this.projetosFiltrados);

    if (this.projetoSelecionado === "Alimenta +1000 Cidades") {
      this.dataService
        .getLancamentosPorProjeto("Alimenta +1000 Cidades")
        .subscribe((l) => {
          this.lancamentosAlimenta = l;
        });
    }
  }

  private buildChart(p: ProjetoResumo[]): void {
    this.chartReady = false;
    setTimeout(() => {
      const entradasNormais = p.map(x => {
          if (x.projeto === "Operação Básica") {
              return Math.max(0, x.entradas - this.saldosOpBasica);
          }
          return x.entradas;
      });

      const saldosExtras = p.map(x => {
          if (x.projeto === "Operação Básica") return this.saldosOpBasica;
          return 0;
      });

      this.barChartData = {
        labels: p.map((x) => x.projeto),
        datasets: [
          {
            label: "Receitas",
            data: entradasNormais,
            backgroundColor: "#34D399",
            borderRadius: 4,
            stack: "Stack 0",
          },
          {
            label: "Saldos Recuperados",
            data: saldosExtras,
            backgroundColor: "#059669",
            borderRadius: 4,
            stack: "Stack 0",
          },
          {
            label: "Despesas",
            data: p.map(x => x.saidas),
            backgroundColor: "#38BDF8",
            borderRadius: 4,
            stack: "Stack 1",
          },
        ],
      };
      this.chartReady = true;
    }, 50);
  }
}
