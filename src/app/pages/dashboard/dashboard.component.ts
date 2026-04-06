import { Component, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatDialogModule, MatDialog } from "@angular/material/dialog";
import { BaseChartDirective } from "ng2-charts";
import { DataService } from "../../services/data.service";
import { DashboardConfigService } from "../../services/dashboard-config.service";

// Importando os novos componentes de modal
import { ModalFinanciadoresComponent } from "./components/modal-financiadores/modal-financiadores.component";
import { ModalExecucaoComponent } from "./components/modal-execucao/modal-execucao.component";
import { ModalInfoComponent } from "./components/modal-info/modal-info.component";

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
  modalCount = 0;

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
    });

    this.dataService.getRecebimentosPorFinanciador().subscribe((f) => {
      this.financiadores = f;
    });

    this.dataService.getRunway().subscribe(r => this.runway = r);
    this.dataService.getGapCaptacao().subscribe(g => this.gapCaptacao = g);

    this.dataService.getProjetoResumos().subscribe((p) => {
      this.projetos = p;
      this.projetosAtivos = p
        .filter(x => x.status && x.status.toLowerCase() !== "finalizado" && x.status.toLowerCase() !== "encerrado")
        .map(x => ({ projeto: x.projeto, execucao: x.execucao }));

      // Reintroduzindo o delay de 1.5 segundos solicitado para efeito de skeleton loader
      setTimeout(() => {
        this.isLoading = false;
      }, 1500);
    });
  }

  abrirModal(tipo: string): void {
    this.modalCount++;
    const offsetTop = 40 + (this.modalCount % 5) * 40;
    const offsetLeft = 40 + (this.modalCount % 5) * 40;

    const dialogOptions = {
      width: "960px",
      height: "680px",
      maxWidth: "95vw",
      panelClass: "draggable-modal-panel",
      hasBackdrop: false,
      position: { top: `${offsetTop}px`, left: `${offsetLeft}px` }
    };

    if (tipo === "finance") {
      this.dialog.open(ModalFinanciadoresComponent, {
        ...dialogOptions,
        data: this.financiadores
      });
    } else if (tipo === "execucao") {
      this.dialog.open(ModalExecucaoComponent, {
        ...dialogOptions,
        data: this.projetosAtivos
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
