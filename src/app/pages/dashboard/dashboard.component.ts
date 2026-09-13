import { Component, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatDialogModule, MatDialog } from "@angular/material/dialog";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatExpansionModule } from "@angular/material/expansion";
import { FormsModule } from "@angular/forms";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { BehaviorSubject, combineLatest, map, Observable } from "rxjs";
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
    MatSidenavModule,
    MatCheckboxModule,
    MatExpansionModule,
    FormsModule,
    BaseChartDirective,
  ],
  providers: [CurrencyPipe, DecimalPipe],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
})
export class DashboardComponent implements OnInit {
  recursoDetalhado: RecursoDetalhado | null = null;

  // Filtros
  periodosDisponiveis: { ano: number; meses: { num: number; nome: string }[] }[] = [];
  selecionados = new Set<string>(); // "MM/YYYY"
  filtrosExpandidos = false;

  // Streams Filtradas (locais ao Dashboard)
  private filterSubject = new BehaviorSubject<Set<string>>(new Set());
  filteredLancamentos$!: Observable<any[]>;
  filteredRecebimentos$!: Observable<any[]>;

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

  // Charts inline
  financiadoresChartReady = false;
  execucaoChartReady = false;
  recebimentosAnoChartReady = false;

  financiadoresChartData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  financiadoresChartOptions: ChartConfiguration<"doughnut">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: { position: "right", labels: { color: "#94a3b8", font: { size: 11, weight: "bold" }, usePointStyle: true, padding: 12 } },
      datalabels: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const total = this.indicadores.totalRecebido ||
              (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            const val = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.parsed);
            return `  ${val}  (${pct}%)`;
          }
        }
      }
    }
  };

  recebimentosAnoChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  recebimentosAnoChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: "#64748b", font: { size: 11, weight: "bold" }, usePointStyle: true } },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.9)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { display: false } },
      y: { ticks: { color: "#64748b", callback: (v: any) => "R$ " + new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v) }, grid: { color: "rgba(255,255,255,0.05)" } },
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

  get totalMesesPossiveis(): number {
    return this.periodosDisponiveis.reduce((acc, p) => acc + p.meses.length, 0);
  }

  constructor(
    public dataService: DataService,
    private dialog: MatDialog,
    private configService: DashboardConfigService,
    private currencyPipe: CurrencyPipe,
    private decimalPipe: DecimalPipe
  ) {
    this.initFilterStreams();
  }

  private initFilterStreams(): void {
    // Filtra lancamentos
    this.filteredLancamentos$ = combineLatest([
      this.dataService.lancamentos$,
      this.filterSubject
    ]).pipe(
      map(([lancs, filter]) => {
        if (filter.size === 0) return lancs;
        return lancs.filter(l => filter.has(l.mesAno));
      })
    );

    // Filtra recebimentos
    this.filteredRecebimentos$ = combineLatest([
      this.dataService.recebimentos$,
      this.filterSubject
    ]).pipe(
      map(([recs, filter]) => {
        if (filter.size === 0) return recs;
        return recs.filter(r => filter.has(r.mesAno));
      })
    );
  }

  private extrairPeriodos(lancs: any[], recs: any[]): void {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    const todosMesAno = new Set<string>();
    lancs.forEach(l => { if (l.mesAno) todosMesAno.add(l.mesAno); });
    recs.forEach(r => { if (r.mesAno) todosMesAno.add(r.mesAno); });

    const anosMap = new Map<number, Set<number>>();
    todosMesAno.forEach(ma => {
      const [m, a] = ma.split("/").map(Number);
      if (!m || !a) return;
      if (a > anoAtual || (a === anoAtual && m > mesAtual)) return;
      if (!anosMap.has(a)) anosMap.set(a, new Set());
      anosMap.get(a)!.add(m);
    });

    const nomesMeses = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    this.periodosDisponiveis = Array.from(anosMap.entries())
      .map(([ano, meses]) => ({
        ano,
        meses: Array.from(meses).sort((a, b) => a - b).map(m => ({ num: m, nome: nomesMeses[m] }))
      }))
      .sort((a, b) => b.ano - a.ano);

    // Inicializa selecionados com tudo
    const initial = new Set<string>();
    this.periodosDisponiveis.forEach(p => {
      p.meses.forEach(m => initial.add(`${m.num.toString().padStart(2, "0")}/${p.ano}`));
    });
    this.selecionados = initial;
    this.filterSubject.next(this.selecionados);
  }

  toggleMes(mes: number, ano: number): void {
    const key = `${mes.toString().padStart(2, "0")}/${ano}`;
    if (this.selecionados.has(key)) {
      this.selecionados.delete(key);
    } else {
      this.selecionados.add(key);
    }
    this.selecionados = new Set(this.selecionados);
    this.filterSubject.next(this.selecionados);
  }

  isMesSelecionado(mes: number, ano: number): boolean {
    return this.selecionados.has(`${mes.toString().padStart(2, "0")}/${ano}`);
  }

  isAnoSelecionado(anoObj: any): boolean {
    return anoObj.meses.length > 0 && anoObj.meses.every((m: any) => this.isMesSelecionado(m.num, anoObj.ano));
  }

  isAnoIndeterminado(anoObj: any): boolean {
    const selecionadosNoAno = anoObj.meses.filter((m: any) => this.isMesSelecionado(m.num, anoObj.ano)).length;
    return selecionadosNoAno > 0 && selecionadosNoAno < anoObj.meses.length;
  }

  toggleAno(anoObj: any): void {
    const todosSelecionados = anoObj.meses.every((m: any) => this.isMesSelecionado(m.num, anoObj.ano));
    if (todosSelecionados) {
      anoObj.meses.forEach((m: any) => this.selecionados.delete(`${m.num.toString().padStart(2, "0")}/${anoObj.ano}`));
    } else {
      anoObj.meses.forEach((m: any) => this.selecionados.add(`${m.num.toString().padStart(2, "0")}/${anoObj.ano}`));
    }
    this.selecionados = new Set(this.selecionados);
    this.filterSubject.next(this.selecionados);
  }

  selecionarAno(anoObj: any): void {
    anoObj.meses.forEach((m: any) => this.selecionados.add(`${m.num.toString().padStart(2, "0")}/${anoObj.ano}`));
    this.selecionados = new Set(this.selecionados);
    this.filterSubject.next(this.selecionados);
  }

  limparAno(anoObj: any): void {
    anoObj.meses.forEach((m: any) => this.selecionados.delete(`${m.num.toString().padStart(2, "0")}/${anoObj.ano}`));
    this.selecionados = new Set(this.selecionados);
    this.filterSubject.next(this.selecionados);
  }

  get filtroAtivo(): boolean {
    return this.selecionados.size > 0 && this.selecionados.size < this.totalMesesPossiveis;
  }

  limparFiltros(): void {
    this.selecionados = new Set();
    this.filterSubject.next(this.selecionados);
  }

  selecionarTudo(): void {
    const all = new Set<string>();
    this.periodosDisponiveis.forEach(p => {
      p.meses.forEach(m => all.add(`${m.num.toString().padStart(2, "0")}/${p.ano}`));
    });
    this.selecionados = all;
    this.filterSubject.next(this.selecionados);
  }

  ngOnInit(): void {
    // Carrega períodos disponíveis uma vez
    combineLatest([this.dataService.lancamentos$, this.dataService.recebimentos$]).subscribe(([l, r]) => {
      if (this.periodosDisponiveis.length === 0 && l.length > 0) {
        this.extrairPeriodos(l, r);
      }
    });

    this.getIndicadoresOperacionais().subscribe((ind) => {
      this.indicadores = ind;
    });

    this.getRecursoDetalhado().subscribe(rd => {
      this.inflacao = rd.aporteInflacao;
      this.totalRecebidoNet = rd.totalRecebido;
      this.recursoDetalhado = rd;
    });

    this.getRecebimentosPorFinanciador().subscribe((f) => {
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

    this.getRunway().subscribe(r => this.runway = r);
    this.getGapCaptacao().subscribe(g => this.gapCaptacao = g);

    this.getAportesEnapPorAno().subscribe((anos) => {
      setTimeout(() => {
        const bgColors = anos.map(a =>
          a.recebido > 0 ? "rgba(16,185,129,0.5)" : "rgba(99,102,241,0.35)"
        );
        const borderColors = anos.map(a =>
          a.recebido > 0 ? "#10b981" : "#6366f1"
        );

        this.recebimentosAnoChartData = {
          labels: anos.map(a => a.ano),
          datasets: [
            {
              label: "Total Anual",
              data: anos.map(a => a.recebido + a.previsto),
              backgroundColor: bgColors,
              borderColor: borderColors,
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: "Meta 500k",
              type: "line",
              data: anos.map(() => 500000),
              borderColor: "#3b82f6",
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false
            } as any
          ]
        };
        this.recebimentosAnoChartReady = true;
      }, 50);
    });

    this.getProjetoResumos().subscribe((p) => {
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

  // ===== WRAPPERS PARA FILTRO LOCAL =====

  private getIndicadoresOperacionais(): Observable<any> {
    return this.filteredLancamentos$.pipe(
      map(lancs => {
        const totalRecebido = lancs
          .filter(l => l.categoria === "0.0.0 Recurso")
          .reduce((s, l) => s + l.valor, 0);

        const despesas = lancs.filter(l => l.categoria !== "0.0.0 Recurso" && l.valor < 0);
        const totalExecutado = despesas.reduce((s, l) => s + Math.abs(l.valor), 0);

        return {
          totalRecebido,
          totalExecutado,
          saldoDisponivel: totalRecebido - totalExecutado,
          percentualExecucao: totalRecebido > 0 ? (totalExecutado / totalRecebido) * 100 : 0,
          numPagamentos: despesas.length,
          ticketMedio: despesas.length > 0 ? totalExecutado / despesas.length : 0
        };
      })
    );
  }

  private getRecursoDetalhado(): Observable<RecursoDetalhado> {
    return this.filteredRecebimentos$.pipe(
      map(recs => {
        let aporteRecebido = 0, aporteInflacao = 0, aportePrevisto = 0;
        let captacaoRecebida = 0, captacaoPrevista = 0;

        recs.forEach(r => {
          const obs = r.observacao.toLowerCase();
          const isAporte = obs.includes("aporte");
          const isCaptacao = obs.includes("captação") || obs.includes("captacao");
          const isInflacao = r.observacao2?.includes("inflação") || r.observacao2?.includes("inflacao");

          if (isAporte) {
            if (isInflacao) aporteInflacao += r.valor;
            else if (r.status === "recebido") aporteRecebido += r.valor;
            else if (r.status === "previsto") aportePrevisto += r.valor;
          } else if (isCaptacao) {
            if (r.status === "recebido") captacaoRecebida += r.valor;
            else if (r.status === "previsto") captacaoPrevista += r.valor;
          }
        });

        const captacaoTotalPresente = captacaoRecebida + captacaoPrevista;
        const saldoACaptar = Math.max(0, this.dataService.META_CAPTACAO - captacaoTotalPresente);
        const captacaoTotal = captacaoTotalPresente + saldoACaptar;
        // Mesma regra do serviço: correção pelo IPCA entra no total recebido da
        // Enap, mas não abate a meta original de aporte.
        const totalRecebidoEnap = aporteRecebido + aporteInflacao;

        return {
          aporteRecebido,
          aporteInflacao,
          aporteRecebidoTotal: totalRecebidoEnap,
          totalRecebidoEnap,
          aportePrevisto,
          captacaoRecebida,
          captacaoPrevista,
          captacaoTotal,
          saldoACaptar,
          totalRecebido: totalRecebidoEnap + captacaoRecebida,
          totalComPrevisto: this.dataService.META_TOTAL
        };
      })
    );
  }

  private getRecebimentosPorFinanciador(): Observable<any[]> {
    return this.filteredRecebimentos$.pipe(
      map(recs => {
        const mapa = new Map<string, number>();
        recs.forEach(r => {
          if (r.valor && r.status === "recebido" && !r.observacao.toLowerCase().includes("aporte")) {
            const f = r.fornecedor || "Não identificado";
            mapa.set(f, (mapa.get(f) || 0) + r.valor);
          }
        });
        return Array.from(mapa.entries()).map(([financiador, valor]) => ({ financiador, valor })).sort((a, b) => b.valor - a.valor);
      })
    );
  }

  private getRunway(): Observable<number> {
    return combineLatest([this.filteredLancamentos$, this.getIndicadoresOperacionais()]).pipe(
      map(([lancs, inds]) => {
        const porMes = new Map<string, number>();
        lancs.forEach(l => {
          if (l.mesAno && l.valor < 0) {
            porMes.set(l.mesAno, (porMes.get(l.mesAno) || 0) + Math.abs(l.valor));
          }
        });
        const media = porMes.size > 0 ? Array.from(porMes.values()).reduce((a, b) => a + b, 0) / porMes.size : 0;
        return media > 0 ? inds.saldoDisponivel / media : 0;
      })
    );
  }

  private getGapCaptacao(): Observable<number> {
    return this.getRecursoDetalhado().pipe(map(d => Math.max(0, this.dataService.META_CAPTACAO - d.captacaoRecebida)));
  }

  private getAportesEnapPorAno(): Observable<any[]> {
    // Usa dados sem filtro de período para incluir aportes previstos futuros (2026-2028)
    return this.dataService.recebimentos$.pipe(
      map(recs => {
        const mapa = new Map<string, { previsto: number; recebido: number }>();
        recs.forEach(r => {
          if (!r.observacao.toLowerCase().includes("aporte")) return;
          const ano = r.observacao2 || r.mesAno.split("/")[1];
          if (!ano) return;
          if (!mapa.has(ano)) mapa.set(ano, { previsto: 0, recebido: 0 });
          const m = mapa.get(ano)!;
          if (r.status === "previsto") m.previsto += r.valor;
          else if (r.status === "recebido") m.recebido += r.valor;
        });
        return Array.from(mapa.entries()).map(([ano, d]) => ({ ano, ...d })).sort((a, b) => a.ano.localeCompare(b.ano));
      })
    );
  }

  private getProjetoResumos(): Observable<any[]> {
    return combineLatest([this.filteredLancamentos$, this.dataService.status$, this.dataService.saldos$]).pipe(
      map(([lancs, status, saldos]) => {
        const porProjeto = new Map<string, { entradas: number; saidas: number; remanescente: number }>();
        lancs.forEach(l => {
          if (!l.projeto) return;
          if (!porProjeto.has(l.projeto)) porProjeto.set(l.projeto, { entradas: 0, saidas: 0, remanescente: 0 });
          const p = porProjeto.get(l.projeto)!;
          if (l.valor >= 0) p.entradas += l.valor;
          else p.saidas += Math.abs(l.valor);
        });
        saldos.forEach(s => {
          if (s.projeto && porProjeto.has(s.projeto)) porProjeto.get(s.projeto)!.remanescente += s.valorTransferido;
        });
        return Array.from(porProjeto.entries()).map(([projeto, data]) => {
          const s = status.find(st => st.projeto === projeto);
          return {
            projeto,
            entradas: data.entradas,
            saidas: data.saidas,
            saldo: data.entradas - data.saidas,
            execucao: data.entradas > 0 ? (data.saidas / data.entradas) * 100 : 0,
            status: s ? s.status : "Ativo"
          };
        }).sort((a, b) => b.entradas - a.entradas);
      })
    );
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
