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
import { ThemeService } from "../../services/theme.service";
import { ProjetoResumo, Lancamento } from "../../models/lancamento.model";
import { effect } from "@angular/core";

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
  templateUrl: "./projetos.component.html",
  styleUrl: "./projetos.component.scss",
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
  totalSaldosRemanescentes = 0;

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
    scales: {
      x: { stacked: true, ticks: { color: "#64748b" }, grid: { display: false } },
      y: { stacked: true, ticks: { color: "#64748b", autoSkip: false }, grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };

  constructor(private dataService: DataService, private themeService: ThemeService) { 
    // Efeito para ajustar cores do gráfico dinamicamente quando o tema muda
    effect(() => {
      const isDark = this.themeService.isDark();
      const textColor = isDark ? "#f8fafc" : "#1e293b";
      const subColor = isDark ? "#94a3b8" : "#64748b";

      this.barChartOptions = {
        ...this.barChartOptions,
        plugins: {
          ...this.barChartOptions.plugins,
          legend: {
            ...this.barChartOptions.plugins?.legend,
            labels: {
              ...this.barChartOptions.plugins?.legend?.labels,
              color: textColor
            }
          }
        },
        scales: {
          x: { 
            ...this.barChartOptions.scales?.x,
            ticks: { ...this.barChartOptions.scales?.x?.ticks, color: subColor }
          },
          y: { 
            ...this.barChartOptions.scales?.y,
            ticks: { 
              ...this.barChartOptions.scales?.y?.ticks, 
              color: subColor,
              autoSkip: false // Garantir que todos os labels de projetos apareçam
            }
          }
        }
      };

      if (!this.isLoading && this.projetos.length > 0) {
        this.buildChart(this.projetosFiltrados);
      }
    });
  }

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
      this.totalSaldosRemanescentes = p.reduce((acc, curr) => acc + (curr.saldoRemanescente || 0), 0);
      this.stats = {
        ativos: p.filter(x => x.status && x.status.toLowerCase() !== "finalizado").length,
        execucaoMedia: p.reduce((acc, curr) => acc + curr.execucao, 0) / p.length
      };
      setTimeout(() => {
        this.isLoading = false;
      }, 1500);
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
      // Total de saldos que saíram dos projetos e foram para Operação Básica
      const totalSaldosParaOpBasica = p
        .filter(x => x.projeto !== "Operação Básica")
        .reduce((acc, x) => acc + (x.saldoRemanescente || 0), 0);

      this.barChartData = {
        labels: p.map((x) => x.projeto),
        datasets: [
          {
            label: "Receitas",
            data: p.map(x => x.entradas),
            backgroundColor: "#10b981",
            borderRadius: 4,
            stack: "Stack 0",
          },
          {
            // Só aparece na linha de Operação Básica: soma de todos os saldos recebidos
            label: "Saldos Recebidos (Op. Básica)",
            data: p.map(x => x.projeto === "Operação Básica" ? totalSaldosParaOpBasica : 0),
            backgroundColor: "#065f46",
            borderRadius: 4,
            stack: "Stack 0",
          },
          {
            label: "Despesas",
            data: p.map(x => x.saidas),
            backgroundColor: "#6366f1",
            borderRadius: 4,
            stack: "Stack 1",
          },
          {
            // Saldo que saiu de cada projeto (exceto Op. Básica): aparece como despesa
            label: "Saldo Transferido p/ Op. Básica",
            data: p.map(x => x.projeto === "Operação Básica" ? 0 : (x.saldoRemanescente || 0)),
            backgroundColor: "#f59e0b",
            borderRadius: 4,
            stack: "Stack 1",
          },
        ],
      };
      this.chartReady = true;
    }, 50);
  }
}
