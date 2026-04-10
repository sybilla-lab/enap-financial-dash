import { Component, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatDialogModule, MatDialog } from "@angular/material/dialog";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import { DashboardConfigService } from "../../services/dashboard-config.service";

import { ModalInfoComponent } from "./components/modal-info/modal-info.component";
import { ModalPctExecucaoComponent } from "./components/modal-pct-execucao/modal-pct-execucao.component";
import { ModalPctMetaComponent } from "./components/modal-pct-meta/modal-pct-meta.component";
import { RecursoDetalhado } from "../../models/lancamento.model";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    MatDialogModule,
    BaseChartDirective,
  ],
  providers: [CurrencyPipe, DecimalPipe],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
})
export class DashboardComponent implements OnInit {
  isLoading = true;
  indicadores = {
    totalRecebido: 0,
    totalExecutado: 0,
    saldoDisponivel: 0,
    percentualExecucao: 0,
    numPagamentos: 0,
    ticketMedio: 0,
  };
  projetos: any[] = [];
  projetosAtivos: { projeto: string; execucao: number }[] = [];
  financiadores: { financiador: string; valor: number }[] = [];
  runway = 0;
  gapCaptacao = 0;
  inflacao = 0;
  totalRecebidoNet = 0;
  recursoDetalhado: RecursoDetalhado | null = null;

  // Charts inline
  financiadoresChartReady = false;
  execucaoChartReady = false;

  financiadoresChartData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  financiadoresChartOptions: ChartConfiguration<"doughnut">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: { position: "right", labels: { color: "#94a3b8", font: { size: 11, weight: "bold" }, usePointStyle: true, padding: 12 } },
      datalabels: { display: false },
    }
  };

  execucaoChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  execucaoChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.9)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        callbacks: {
          label: (ctx: any) => ` ${ctx.parsed.x.toFixed(1)}%`
        }
      }
    },
    scales: {
      x: { max: 100, ticks: { color: "#64748b", callback: (v: any) => v + "%" }, grid: { display: false } },
      y: { ticks: { color: "#64748b" }, grid: { display: false } },
    }
  };

  get config() {
    return this.configService.config;
  }

  constructor(
    public dataService: DataService,
    private dialog: MatDialog,
    private configService: DashboardConfigService,
    private currencyPipe: CurrencyPipe,
    private decimalPipe: DecimalPipe
  ) { }

  ngOnInit(): void {
    this.dataService.getIndicadoresOperacionais().subscribe((ind) => {
      this.indicadores = ind;
    });

    this.dataService.getRecursoDetalhado().subscribe(rd => {
      this.inflacao = rd.aporteInflacao;
      this.totalRecebidoNet = rd.totalRecebido;
      this.recursoDetalhado = rd;
    });

    this.dataService.getRecebimentosPorFinanciador().subscribe((f) => {
      this.financiadores = f;
      setTimeout(() => {
        this.financiadoresChartData = {
          labels: f.map(x => x.financiador),
          datasets: [{
            data: f.map(x => x.valor),
            backgroundColor: [
              "#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#ef4444",
              "#ec4899", "#14b8a6", "#f97316", "#a855f7", "#84cc16",
              "#06b6d4", "#e11d48", "#8b5cf6", "#22c55e", "#fb923c"
            ],
            borderWidth: 0,
          }]
        };
        this.financiadoresChartReady = true;
      }, 50);
    });

    this.dataService.getRunway().subscribe(r => this.runway = r);
    this.dataService.getGapCaptacao().subscribe(g => this.gapCaptacao = g);

    this.dataService.getProjetoResumos().subscribe((p) => {
      this.projetos = p;
      this.projetosAtivos = p
        .filter(x => x.status && x.status.toLowerCase() !== "finalizado" && x.status.toLowerCase() !== "encerrado")
        .map(x => ({ projeto: x.projeto, execucao: x.execucao }));

      setTimeout(() => {
        this.execucaoChartData = {
          labels: this.projetosAtivos.map(x => x.projeto),
          datasets: [{
            label: "Execução %",
            data: this.projetosAtivos.map(x => Math.min(x.execucao, 100)),
            backgroundColor: this.projetosAtivos.map(x =>
              x.execucao >= 90 ? "rgba(16,185,129,0.5)" :
              x.execucao >= 60 ? "rgba(99,102,241,0.5)" :
              x.execucao >= 30 ? "rgba(245,158,11,0.5)" : "rgba(239,68,68,0.5)"
            ),
            borderColor: this.projetosAtivos.map(x =>
              x.execucao >= 90 ? "#10b981" :
              x.execucao >= 60 ? "#6366f1" :
              x.execucao >= 30 ? "#f59e0b" : "#ef4444"
            ),
            borderWidth: 1,
            borderRadius: 4,
          }]
        };
        this.execucaoChartReady = true;
        this.isLoading = false;
      }, 1500);
    });
  }

  abrirModal(tipo: string): void {
    const dialogOptions = {
      width: "960px",
      height: "680px",
      maxWidth: "95vw",
      panelClass: "draggable-modal-panel",
      hasBackdrop: true,
    };

    if (tipo === "pct-execucao") {
      this.dialog.open(ModalPctExecucaoComponent, {
        ...dialogOptions,
        width: "680px",
        height: "600px",
        data: {
          percentual: this.indicadores.percentualExecucao,
          totalRecebido: this.indicadores.totalRecebido,
          totalExecutado: this.indicadores.totalExecutado,
          saldoDisponivel: this.indicadores.saldoDisponivel,
          projetos: this.projetos.map((p: any) => ({
            projeto: p.projeto,
            execucao: p.execucao,
            entradas: p.entradas,
            saidas: p.saidas
          }))
        }
      });
    } else if (tipo === "pct-meta") {
      this.dialog.open(ModalPctMetaComponent, {
        ...dialogOptions,
        width: "680px",
        height: "640px",
        data: {
          percentual: this.recursoDetalhado ? (this.totalRecebidoNet / this.dataService.META_TOTAL * 100) : 0,
          aporteRecebido: this.recursoDetalhado?.aporteRecebido ?? 0,
          captacaoRecebida: this.recursoDetalhado?.captacaoRecebida ?? 0,
          totalRecebido: this.totalRecebidoNet,
          metaTotal: this.dataService.META_TOTAL,
          saldoACaptar: this.recursoDetalhado?.saldoACaptar ?? 0,
          financiadores: this.financiadores
        }
      });
    } else if (tipo === "pagamentos") {
      this.dialog.open(ModalInfoComponent, {
        ...dialogOptions,
        data: {
          title: "Sobre os Pagamentos",
          icon: "receipt_long",
          description: "Este número representa o total de transações de saída realizadas na execução dos projetos. Ele permite dimensionar facilmente o volume de esforço operacional da equipe financeira mensalmente.",
          value: this.indicadores.numPagamentos.toString()
        }
      });
    } else if (tipo === "ticket") {
      this.dialog.open(ModalInfoComponent, {
        ...dialogOptions,
        data: {
          title: "Ticket Médio",
          icon: "paid",
          description: "O Ticket Médio representa o valor base das saídas (Total Executado / N° de Pagamentos). Ter uma visão desse montante estabelece o padrão de custo por transação para futuras projeções de fluxo de caixa.",
          value: this.currencyPipe.transform(this.indicadores.ticketMedio, "BRL", "symbol", "1.0-2")
        }
      });
    } else if (tipo === "runway") {
      this.dialog.open(ModalInfoComponent, {
        ...dialogOptions,
        data: {
          title: "Runway Estimado",
          icon: "timer",
          description: "Expressa em meses o tempo de vida do projeto financeiramente falando (com base na média das saídas dos últimos meses vs montante disponível global). Ajuda a Diretoria e o time a saberem quando a captação precisa acelerar.",
          value: this.decimalPipe.transform(this.runway, "1.1-1") + " meses"
        }
      });
    } else if (tipo === "gap") {
      this.dialog.open(ModalInfoComponent, {
        ...dialogOptions,
        data: {
          title: "Gap de Captação",
          icon: "not_interested",
          description: "Indica a falta (déficit) dos recursos correntes captados se comparados com a meta global do acordo ou orçamento central. A meta de captação global almejada precisa ser atingida mitigando o Gap.",
          value: this.currencyPipe.transform(this.gapCaptacao, "BRL", "symbol", "1.2-2")
        }
      });
    }
  }
}
