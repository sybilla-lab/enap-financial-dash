import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { BaseChartDirective } from "ng2-charts";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { ActivatedRoute } from "@angular/router";
import { Subject, combineLatest, takeUntil } from "rxjs";
import { DataService } from "../../services/data.service";
import { Lancamento, StatusProjeto, ProjetoResumo, Rendimento, SaldoRemanescente } from "../../models/lancamento.model";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { DragDropModule, CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { RelatorioPdfService, CabecalhoRelatorio } from "../../services/relatorio-pdf.service";
import { EventoInstitucionalComponent } from "../../components/evento-institucional/evento-institucional.component";
import { OficioRendimentos } from "../../models/lancamento.model";

Chart.register(...registerables, ChartDataLabels);

// ── Alimenta +1000 Cidades ──────────────────────────────────────────────────
interface ProdutoAlimenta {
  codigo: string; nome: string; meta: string;
  orcamento: number; inicio: string; fim: string;
}
interface ProdutoExecucao extends ProdutoAlimenta { realizado: number; percentual: number; }
interface CategoriaAlimenta { nome: string; valor: number; percentual: number; cor: string; }
interface MetaGrupo {
  id: string; titulo: string; produtos: ProdutoExecucao[];
  orcamento: number; realizado: number; percentual: number;
  inicio: string; fim: string; expandido: boolean;
}

const MES_NUM: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAIO: 5, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};
function parseMesAno(s: string): number {
  const [m, a] = (s || "").split("/");
  return parseInt(a || "0") * 100 + (MES_NUM[(m || "").toUpperCase()] || 0);
}

// For MM/YYYY numeric key (rendimentos format)
const mesKeyNum = (s: string) => { const [m, y] = s.split('/'); return parseInt(y) * 100 + parseInt(m); };

const ALIMENTA_PRODUTOS: ProdutoAlimenta[] = [
  { codigo: "1.1", nome: "Configuração da plataforma", meta: "META 1 — Trilha de Implementação", orcamento: 106056.80, inicio: "NOV/2025", fim: "FEV/2026" },
  { codigo: "1.2", nome: "Execução dos módulos", meta: "META 1 — Trilha de Implementação", orcamento: 2645754.65, inicio: "JAN/2026", fim: "OUT/2026" },
  { codigo: "1.3", nome: "Monitoramento e avaliação", meta: "META 1 — Trilha de Implementação", orcamento: 519365.00, inicio: "SET/2026", fim: "MAR/2027" },
  { codigo: "2.1", nome: "Preparando o terreno", meta: "META 2 — Ciclo de Inovação Aberta", orcamento: 30287.18, inicio: "NOV/2025", fim: "JAN/2026" },
  { codigo: "2.2", nome: "Mapeando problemas", meta: "META 2 — Ciclo de Inovação Aberta", orcamento: 504276.11, inicio: "FEV/2026", fim: "ABR/2026" },
  { codigo: "2.3", nome: "Desenhando a competição", meta: "META 2 — Ciclo de Inovação Aberta", orcamento: 327691.98, inicio: "ABR/2026", fim: "MAIO/2026" },
  { codigo: "2.4", nome: "Lançando o Desafio", meta: "META 2 — Ciclo de Inovação Aberta", orcamento: 130420.75, inicio: "JUN/2026", fim: "JUN/2026" },
  { codigo: "2.5", nome: "Avaliando propostas", meta: "META 2 — Ciclo de Inovação Aberta", orcamento: 112838.88, inicio: "JUL/2026", fim: "JUL/2026" },
  { codigo: "2.6", nome: "Acelerando soluções", meta: "META 2 — Ciclo de Inovação Aberta", orcamento: 382799.34, inicio: "AGO/2026", fim: "OUT/2026" },
  { codigo: "2.7", nome: "Levando o desafio adiante", meta: "META 2 — Ciclo de Inovação Aberta", orcamento: 55763.40, inicio: "NOV/2026", fim: "MAR/2027" },
  { codigo: "3.1", nome: "IV Encontro da Estratégia Alimenta Cidades", meta: "META 3 — Reconhecendo as conquistas", orcamento: 509059.71, inicio: "NOV/2026", fim: "DEZ/2026" },
];
// ────────────────────────────────────────────────────────────────────────────

interface ProjetoSnapshot {
  projeto: string;
  entradas: number;
  saidas: number;
  saldo: number;
  saldoRemanescente: number;
  execucao: number;
  numPagamentos: number;
  ticketMedio: number;
  status: string;
  srOpBasica: number;
  /** Rendimentos destinados ao projeto (bloco J:L) — parte da base de execução. */
  rendDestinados: number;
  /** Denominador efetivo do percentual, para poder ser exibido por extenso. */
  baseExecucao: number;
}

interface CategoriaLocal {
  categoria: string;
  total: number;
  percentual: number;
}

interface FluxoLocal {
  mesAno: string;
  entradas: number;
  saidas: number;
  saldoAcumulado: number;
}

interface TransacaoRecente {
  mesAno: string;
  categoria: string;
  fornecedor: string;
  observacao: string;
  valor: number;
  /** Número do pagamento no Transferegov — é por ele que a despesa se confere. */
  numPag: string;
}

interface RendAtribuido {
  mesAno: string;
  pctParticipacao: number;
  rendimentoMes: number;
  rendimentoAcumulado: number;
  saldoProjeto: number;
}

@Component({
  selector: "app-visao-projeto",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    BaseChartDirective,
    DragDropModule,
    EventoInstitucionalComponent,
  ],
  templateUrl: "./visao-projeto.component.html",
  styleUrl: "./visao-projeto.component.scss",
})
export class VisaoProjetoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** Evento institucional vigente; null enquanto carrega ou se não houver. */
  oficio: OficioRendimentos | null = null;

  projetos: string[] = [];
  projetoSelecionado: string | null = null;

  private inicializado = false;

  // Filtros de data
  anosDisponiveis: string[] = [];
  dataInicio = '';
  dataFim = '';
  periodoAtivo = 'tudo';
  inicioMes = '';
  inicioAno = '';
  fimMes = '';
  fimAno = '';
  inicioPickerOpen = false;
  fimPickerOpen = false;

  readonly meses = [
    { valor: "01", abrev: "Jan" }, { valor: "02", abrev: "Fev" },
    { valor: "03", abrev: "Mar" }, { valor: "04", abrev: "Abr" },
    { valor: "05", abrev: "Mai" }, { valor: "06", abrev: "Jun" },
    { valor: "07", abrev: "Jul" }, { valor: "08", abrev: "Ago" },
    { valor: "09", abrev: "Set" }, { valor: "10", abrev: "Out" },
    { valor: "11", abrev: "Nov" }, { valor: "12", abrev: "Dez" },
  ];

  get totalFiltrosAtivos(): number {
    return (this.dataInicio ? 1 : 0) + (this.dataFim ? 1 : 0);
  }

  allLancamentos: Lancamento[] = [];
  statusMap = new Map<string, string>();

  snapshot: ProjetoSnapshot | null = null;
  categorias: CategoriaLocal[] = [];
  fluxo: FluxoLocal[] = [];
  transacoesRecentes: TransacaoRecente[] = [];

  // ── Lançamentos: paginação e exportação ──────────────────────────────────
  // A paginação é só de exibição. O total e as exportações falam sempre do
  // conjunto inteiro que os filtros alcançam, nunca da página visível.
  readonly porPaginaLancamentos = 25;
  paginaLancamentos = 0;

  get totalLancamentos(): number {
    return this.transacoesRecentes.length;
  }

  get totalValorLancamentos(): number {
    return this.transacoesRecentes.reduce((s, t) => s + t.valor, 0);
  }

  get totalPaginasLancamentos(): number {
    return Math.max(1, Math.ceil(this.totalLancamentos / this.porPaginaLancamentos));
  }

  get lancamentosPagina(): TransacaoRecente[] {
    const de = this.paginaLancamentos * this.porPaginaLancamentos;
    return this.transacoesRecentes.slice(de, de + this.porPaginaLancamentos);
  }

  get faixaLancamentos(): string {
    if (!this.totalLancamentos) return '0';
    const de = this.paginaLancamentos * this.porPaginaLancamentos + 1;
    const ate = Math.min(de + this.porPaginaLancamentos - 1, this.totalLancamentos);
    return `${de}–${ate}`;
  }

  irParaPagina(p: number): void {
    this.paginaLancamentos = Math.min(Math.max(0, p), this.totalPaginasLancamentos - 1);
  }

  /** O recorte em texto — vai no cabeçalho das duas exportações. */
  private get recorteAtual(): string {
    const partes = [this.projetoSelecionado ?? 'Todos os projetos'];
    if (this.dataInicio || this.dataFim) {
      partes.push(`período ${this.dataInicio || 'início'} a ${this.dataFim || 'hoje'}`);
    } else {
      partes.push('período completo');
    }
    return partes.join(' · ');
  }

  /**
   * Exporta em CSV o conjunto filtrado inteiro.
   *
   * O arquivo abre o cabeçalho com o recorte, a contagem e o total, para que a
   * planilha exportada não possa ser lida fora do contexto em que foi gerada.
   */
  exportarLancamentosCsv(): void {
    const esc = (v: string | number) => {
      const t = String(v ?? '');
      return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const num = (v: number) => v.toFixed(2).replace('.', ',');

    const linhas = [
      `Lançamentos — ${this.recorteAtual}`,
      `Gerado em;${new Date().toLocaleString('pt-BR')}`,
      `Lançamentos;${this.totalLancamentos}`,
      `Total;${num(this.totalValorLancamentos)}`,
      '',
      ['Mês/Ano', 'Nº pagamento', 'Categoria', 'Fornecedor', 'Observação', 'Valor'].join(';'),
      ...this.transacoesRecentes.map(t => [
        esc(t.mesAno), esc(t.numPag), esc(t.categoria),
        esc(t.fornecedor), esc(t.observacao), num(t.valor),
      ].join(';')),
    ];

    // BOM para o Excel reconhecer o UTF-8 e não quebrar os acentos.
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lancamentos-${this.nomeArquivo()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private nomeArquivo(): string {
    const proj = (this.projetoSelecionado ?? 'todos')
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const periodo = this.dataInicio || this.dataFim
      ? `-${(this.dataInicio || 'inicio')}_${(this.dataFim || 'hoje')}`.replace(/\//g, '')
      : '';
    return `${proj}${periodo}`;
  }

  // Alimenta +1000 Cidades
  metasAlimenta: MetaGrupo[] = [];
  alimentaTotais = { orcamento: 0, realizado: 0, percentual: 0 };
  categoriasAlimenta: CategoriaAlimenta[] = [];
  totalGastoAlimenta = 0;
  metasExpandido = false;
  categoriasExpandido = false;
  donutChartData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  donutChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (ctx: any) => {
            const v = ctx.parsed;
            return ` ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)}`;
          },
        },
      },
    },
  };

  resumosMap = new Map<string, ProjetoResumo>();
  previstosPorProjeto = new Map<string, number>();

  chartSections = ['categorias', 'fluxo', 'balanco'];
  exportingPDF = false;

  // Rendimentos proporcionais
  private rendResumoData: { totalUtilizado: number; porMes: { mesAno: string; bruto: number; imposto: number; liquido: number; acumulado: number }[] } | null = null;
  private rendUtilizacaoPorMes = new Map<string, string>();
  private rendProjetosEncerrados = new Map<string, number>();
  rendimentosAtribuidos: RendAtribuido[] = [];
  totalRendimentoAtribuido = 0;
  rendAccAberto = false;

  chartCategoriasReady = false;
  chartFluxoReady = false;
  balancaoChartReady = false;

  balancaoChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  balancaoChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#94a3b8",
          font: { weight: "bold" },
          filter: (item: any, data: any) => {
            const firstIdx = data.datasets.findIndex((d: any) => d.label === item.text);
            if (firstIdx !== item.datasetIndex) return false;
            if (item.text === "Previsto") {
              const ds = data.datasets[item.datasetIndex];
              return (ds.data as number[]).some((v: number) => v > 0);
            }
            return true;
          },
        },
      },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.92)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed.x;
            return " " + new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
          },
        },
      },
    },
    scales: {
      x: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,0.04)" } },
      y: { stacked: true, ticks: { color: "#94a3b8", font: { size: 11 }, autoSkip: false } as any, grid: { display: false } },
    },
  };

  get balancaoChartHeight(): number {
    const count = this.projetoSelecionado === null ? this.projetos.length : 1;
    return Math.min(640, Math.max(160, count * 46));
  }

  get catChartHeight(): number {
    return Math.max(320, this.categorias.length * 28);
  }

  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration<"bar">["options"] = {
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
        formatter: (value: number, ctx: any) => {
          const data = ctx.chart.data.datasets[0].data as number[];
          const total = data.reduce((a: number, b: number) => a + b, 0);
          const pct = total > 0 ? (value / total) * 100 : 0;
          return pct.toFixed(1).replace(".", ",") + "%";
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed.x;
            return " " + new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
          },
        },
      },
    },
    layout: { padding: { right: 60 } },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,0.04)" } },
      y: { ticks: { color: "#94a3b8", font: { size: 11 }, autoSkip: false } as any, grid: { display: false } },
    },
  };

  mixedChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  mixedChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#94a3b8", font: { weight: "bold" } } },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed.y;
            return " " + new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { display: false } },
      y: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,0.04)" } },
      y1: {
        type: "linear",
        position: "right",
        ticks: { color: "#f59e0b" },
        grid: { display: false },
      },
    },
  };

  constructor(
    private dataService: DataService,
    private route: ActivatedRoute,
    private relatorioPdf: RelatorioPdfService,
  ) {}

  ngOnInit(): void {
    const projetoFromUrl = this.route.snapshot.queryParamMap.get('p');

    this.dataService.getOficioRendimentos()
      .pipe(takeUntil(this.destroy$))
      .subscribe(o => { this.oficio = o; });

    combineLatest({
      lancs: this.dataService.lancamentos$,
      status: this.dataService.status$,
      resumos: this.dataService.getProjetoResumos(),
      previstos: this.dataService.getPrevistosPorProjeto(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ lancs, status, resumos, previstos }) => {
        this.allLancamentos = lancs;
        this.statusMap = new Map(status.map((s: StatusProjeto) => [s.projeto, s.status]));
        this.resumosMap = new Map(resumos.map((r: ProjetoResumo) => [r.projeto, r]));
        this.previstosPorProjeto = previstos;

        const projetosSet = [...new Set(lancs.map((l) => l.projeto).filter(Boolean))];
        this.projetos = projetosSet.sort();
        this.anosDisponiveis = [...new Set(lancs.map((l) => l.mesAno?.split("/")[1]).filter(Boolean))].sort();

        // Apply URL param selection once — but only after real data has arrived
        if (!this.inicializado && this.projetos.length > 0) {
          this.inicializado = true;
          if (projetoFromUrl && this.projetos.includes(projetoFromUrl)) {
            this.projetoSelecionado = projetoFromUrl;
          }
        }

        // Always re-process so the view reflects the latest data on every emission
        this.processData();
      });

    // Rendimentos proporcionais — subscriptions independentes do combineLatest
    this.dataService.getRendimentoResumo().subscribe(r => {
      this.rendResumoData = r;
      this.processData();
    });

    this.dataService.getRendimentos().subscribe((rends: Rendimento[]) => {
      this.rendUtilizacaoPorMes.clear();
      rends.forEach(r => {
        if (r.valor > 0 && !this.rendUtilizacaoPorMes.has(r.mesAno)) {
          this.rendUtilizacaoPorMes.set(r.mesAno, r.utilizacao);
        }
      });
      this.computarRendimentosAtribuidos();
    });

    this.dataService.getSaldos().subscribe((saldos: SaldoRemanescente[]) => {
      this.rendProjetosEncerrados.clear();
      saldos.forEach(s => {
        const parts = s.data.split('/');
        if (parts.length === 3) {
          const mc = parseInt(parts[2]) * 100 + parseInt(parts[1]);
          this.rendProjetosEncerrados.set(s.projeto, mc);
        }
      });
      this.computarRendimentosAtribuidos();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectProjeto(projeto: string | null): void {
    this.projetoSelecionado = projeto;
    this.processData();
  }

  private get nowKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  setPeriodo(periodo: string): void {
    this.periodoAtivo = periodo;
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const mm = String(m).padStart(2, '0');
    switch (periodo) {
      case 'mes':
        this.dataInicio = `${y}-${mm}`;
        this.dataFim = `${y}-${mm}`;
        break;
      case 'trimestre': {
        const qStart = String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0');
        this.dataInicio = `${y}-${qStart}`;
        this.dataFim = `${y}-${mm}`;
        break;
      }
      case 'semestre':
        this.dataInicio = `${y}-${m <= 6 ? '01' : '07'}`;
        this.dataFim = `${y}-${mm}`;
        break;
      case 'ano':
        this.dataInicio = `${y}-01`;
        this.dataFim = `${y}-12`;
        break;
      case 'tudo':
        this.dataInicio = '';
        this.dataFim = '';
        break;
    }
    this.syncSelects();
    this.processData();
  }

  private syncSelects(): void {
    if (this.dataInicio) {
      [this.inicioAno, this.inicioMes] = this.dataInicio.split('-');
    } else { this.inicioAno = this.inicioMes = ''; }
    if (this.dataFim) {
      [this.fimAno, this.fimMes] = this.dataFim.split('-');
    } else { this.fimAno = this.fimMes = ''; }
  }

  private updateFromSelects(): void {
    this.dataInicio = this.inicioAno && this.inicioMes ? `${this.inicioAno}-${this.inicioMes}` : '';
    this.dataFim = this.fimAno && this.fimMes ? `${this.fimAno}-${this.fimMes}` : '';
    this.periodoAtivo = 'custom';
    this.processData();
  }

  get inicioLabel(): string {
    if (!this.inicioMes && !this.inicioAno) return '';
    const m = this.meses.find(x => x.valor === this.inicioMes);
    return [m?.abrev, this.inicioAno].filter(Boolean).join(' ');
  }

  get fimLabel(): string {
    if (!this.fimMes && !this.fimAno) return '';
    const m = this.meses.find(x => x.valor === this.fimMes);
    return [m?.abrev, this.fimAno].filter(Boolean).join(' ');
  }

  togglePicker(which: 'inicio' | 'fim', e: Event): void {
    e.stopPropagation();
    this.inicioPickerOpen = which === 'inicio' ? !this.inicioPickerOpen : false;
    this.fimPickerOpen    = which === 'fim'    ? !this.fimPickerOpen    : false;
  }

  closeAllPickers(): void {
    this.inicioPickerOpen = false;
    this.fimPickerOpen = false;
  }

  selectAno(which: 'inicio' | 'fim', ano: string): void {
    if (which === 'inicio') this.inicioAno = ano;
    else                    this.fimAno    = ano;
    this.updateFromSelects();
  }

  selectMes(which: 'inicio' | 'fim', mes: string): void {
    if (which === 'inicio') { this.inicioMes = mes; if (this.inicioAno) this.inicioPickerOpen = false; }
    else                    { this.fimMes    = mes; if (this.fimAno)    this.fimPickerOpen    = false; }
    this.updateFromSelects();
  }

  limparFiltrosData(): void {
    this.dataInicio = '';
    this.dataFim = '';
    this.periodoAtivo = 'tudo';
    this.syncSelects();
    this.processData();
  }

  getChipStatusClass(proj: string): string {
    const s = (this.statusMap.get(proj) || "Ativo").toLowerCase();
    if (s.includes("encerr") || s.includes("finaliz")) return "chip-inactive";
    return "chip-active";
  }

  dropChart(event: CdkDragDrop<string[]>): void {
    moveItemInArray(this.chartSections, event.previousIndex, event.currentIndex);
  }


  pdfOrientation: 'portrait' | 'landscape' = 'portrait';

  /**
   * Relatório em PDF **nativo**: texto vetorial, pesquisável e selecionável.
   *
   * Substitui a captura com html2canvas, que produzia um arquivo com 114
   * caracteres extraíveis em 2 páginas — uma fotografia da tela colada numa
   * folha A4, inviável como anexo do Transferegov (achado F-19).
   */
  async exportPDF(): Promise<void> {
    if (this.exportingPDF) return;
    this.exportingPDF = true;

    try {
      const { jsPDF } = await import('jspdf');
      const R = this.relatorioPdf;

      const [logoIH, logoEnap] = await Promise.all([
        R.carregarImagem('/logo-impacthub.png'),
        R.carregarImagem('/logo-enap.png'),
      ]);

      const proj = this.projetoSelecionado ?? 'Todos os projetos';
      const periodo = this.inicioLabel && this.fimLabel
        ? `${this.inicioLabel} a ${this.fimLabel}`
        : this.inicioLabel || this.fimLabel || 'Todo o período';

      const filtros: string[] = [];
      filtros.push(this.projetoSelecionado ? `Projeto: ${proj}` : 'Projeto: todos');
      if (this.dataInicio) filtros.push(`De ${this.inicioLabel}`);
      if (this.dataFim) filtros.push(`Até ${this.fimLabel}`);

      const cab: CabecalhoRelatorio = {
        titulo: this.projetoSelecionado ? proj : 'Visão consolidada por projeto',
        subtitulo: 'Parceria Impact Hub Brasil e Enap — Estratégia de Inovação Aberta da Enap',
        periodo,
        logoIH, logoEnap, filtros,
      };

      // A4 retrato sempre: é o formato aceito para anexo e prestação de contas.
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let y = R.desenharCabecalho(doc, cab, true);

      // ── Situação financeira ────────────────────────────────────────────
      const s = this.snapshot;
      if (s) {
        y = R.secao(doc, y, 'Situação financeira', cab);
        y = R.kpis(doc, y, [
          { rotulo: 'Recursos recebidos', valor: R.brl(s.entradas), base: 'créditos no período' },
          { rotulo: 'Despesas executadas', valor: R.brl(s.saidas), base: 'débitos válidos' },
          { rotulo: 'Saldo financeiro', valor: R.brl(s.saldo), base: 'disponível - executado' },
          { rotulo: 'Execução', valor: `${s.execucao.toFixed(1)}%`, base: 'executado ÷ disponível' },
        ], cab);

        if (s.execucao > 100) {
          y = R.nota(doc, y,
            `Atenção: a execução supera o recurso disponível em ` +
            `${R.brl(s.saidas - s.baseExecucao)}. O percentual não foi truncado em ` +
            `100%: a diferença é pendência de conciliação e permanece à vista.`, cab, 'atencao');
        }

        // A base por extenso: um percentual que não se confere não presta contas.
        const partes = [`${R.brl(s.entradas)} recebidos`];
        if (s.srOpBasica) partes.push(`${R.brl(s.srOpBasica)} de saldos remanescentes de outros projetos`);
        if (s.rendDestinados) partes.push(`${R.brl(s.rendDestinados)} de rendimentos destinados`);
        y = R.nota(doc, y,
          `Execução = despesas executadas ÷ recursos disponíveis, na mesma unidade de ` +
          `análise e no mesmo período. Base: ${R.brl(s.baseExecucao)}` +
          (partes.length > 1 ? ` (${partes.join(' + ')})` : '') + `. ` +
          `Pagamentos no período: ${s.numPagamentos}; ` +
          `valor médio por pagamento: ${R.brl(s.ticketMedio)}.`, cab);
      }

      // ── Evento institucional ───────────────────────────────────────────
      // Respeita projeto e período filtrados, e some quando não se aplica.
      // Vem antes das despesas de propósito: é contexto de saldo, não despesa,
      // e o pagamento vinculado é contado uma única vez, no quadro de despesas.
      y = R.eventosInstitucionais(doc, y, cab, this.oficio, {
        projeto: this.projetoSelecionado,
        inicio: this.dataInicio || null,
        fim: this.dataFim || null,
      });

      // ── Despesas por categoria orçamentária ────────────────────────────
      if (this.categorias.length) {
        y = R.secao(doc, y, 'Despesas por categoria orçamentária', cab);
        const total = this.categorias.reduce((acc, c) => acc + c.total, 0);
        y = R.tabela(doc, y,
          [
            { titulo: 'Categoria', chave: 'cat', largura: 3 },
            { titulo: 'Valor executado', chave: 'val', largura: 1.3, alinhamento: 'right' },
            { titulo: '% do total', chave: 'pct', largura: 0.9, alinhamento: 'right' },
          ],
          this.categorias.map(c => ({
            cat: c.categoria,
            val: R.brl(c.total),
            pct: `${c.percentual.toFixed(1)}%`,
          })),
          cab,
          { cat: 'Total', val: R.brl(total), pct: '100,0%' });

        y = R.nota(doc, y,
          'Nomes conforme o Glossário de Categorias Orçamentárias. Variações de grafia ' +
          'da base são mapeadas pelo código da categoria, sem alteração dos registros originais.',
          cab);
      }

      // ── Movimentação mensal ────────────────────────────────────────────
      if (this.fluxo.length) {
        y = R.secao(doc, y, 'Movimentação mensal', cab);
        const te = this.fluxo.reduce((a, f) => a + f.entradas, 0);
        const ts = this.fluxo.reduce((a, f) => a + f.saidas, 0);
        y = R.tabela(doc, y,
          [
            { titulo: 'Mês/ano', chave: 'mes', largura: 1 },
            { titulo: 'Entradas', chave: 'ent', largura: 1.4, alinhamento: 'right' },
            { titulo: 'Saídas', chave: 'sai', largura: 1.4, alinhamento: 'right' },
            { titulo: 'Resultado', chave: 'res', largura: 1.4, alinhamento: 'right' },
          ],
          this.fluxo.map(f => ({
            mes: f.mesAno,
            ent: R.brl(f.entradas),
            sai: R.brl(f.saidas),
            res: R.brl(f.entradas - f.saidas),
          })),
          cab,
          { mes: 'Total', ent: R.brl(te), sai: R.brl(ts), res: R.brl(te - ts) });
      }

      // ── Rendimentos atribuídos ─────────────────────────────────────────
      if (this.rendimentosAtribuidos.length) {
        y = R.secao(doc, y, 'Rendimentos financeiros atribuídos', cab);
        y = R.tabela(doc, y,
          [
            { titulo: 'Mês/ano', chave: 'mes', largura: 1 },
            { titulo: 'Participação', chave: 'pct', largura: 1, alinhamento: 'right' },
            { titulo: 'Rendimento do mês', chave: 'val', largura: 1.4, alinhamento: 'right' },
            { titulo: 'Acumulado', chave: 'acc', largura: 1.4, alinhamento: 'right' },
          ],
          this.rendimentosAtribuidos.map(r => ({
            mes: r.mesAno,
            pct: `${(r.pctParticipacao ?? 0).toFixed(1)}%`,
            val: R.brl(r.rendimentoMes),
            acc: R.brl(r.rendimentoAcumulado),
          })),
          cab,
          { mes: 'Total atribuído', pct: '', val: R.brl(this.totalRendimentoAtribuido), acc: '' });

        y = R.nota(doc, y,
          'Atribuição proporcional ao saldo base de cada projeto no início do mês. ' +
          'Valor atribuído economicamente — não representa aplicação já realizada.', cab);
      }

      // ── Lançamentos ────────────────────────────────────────────────────
      // Todos os do recorte, não uma amostra: o quadro é peça de prestação de
      // contas e o total ao pé tem de fechar com as linhas acima dele.
      if (this.transacoesRecentes.length) {
        y = R.secao(doc, y, 'Lançamentos do período', cab);
        y = R.nota(doc, y,
          `${this.totalLancamentos} lançamento(s) no recorte — ${this.recorteAtual}. ` +
          `Total: ${R.brl(this.totalValorLancamentos)}.`, cab);
        y = R.tabela(doc, y,
          [
            { titulo: 'Mês/ano', chave: 'mes', largura: 0.85 },
            { titulo: 'Nº pag.', chave: 'pag', largura: 0.9 },
            { titulo: 'Categoria', chave: 'cat', largura: 1.9 },
            { titulo: 'Fornecedor', chave: 'forn', largura: 1.8 },
            { titulo: 'Valor', chave: 'val', largura: 1.2, alinhamento: 'right' },
          ],
          this.transacoesRecentes.map((t: any) => ({
            mes: t.mesAno ?? '',
            pag: t.numPag || '—',
            cat: t.categoria ?? '',
            forn: t.fornecedor ?? '',
            val: R.brl(t.valor ?? 0),
          })),
          cab);
      }

      R.desenharRodapes(doc);

      const slug = proj.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const hoje = new Date().toISOString().slice(0, 10);
      doc.save(`visao-projeto-${slug}-${hoje}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
    } finally {
      this.exportingPDF = false;
    }
  }


  getStatusClass(status: string): string {
    const s = (status || "").toLowerCase();
    if (s.includes("encerr")) return "status-warning";
    if (s.includes("finaliz")) return "status-neutral";
    return "status-active";
  }

  private processData(): void {
    const isTodos = this.projetoSelecionado === null;

    let filtered = isTodos
      ? this.allLancamentos
      : this.allLancamentos.filter((l) => l.projeto === this.projetoSelecionado);

    // Aplicar filtro de intervalo de datas
    if (this.dataInicio || this.dataFim) {
      filtered = filtered.filter((l) => {
        if (!l.mesAno) return false;
        const [mes, ano] = l.mesAno.split('/');
        const key = `${ano}-${mes}`;
        if (this.dataInicio && key < this.dataInicio) return false;
        if (this.dataFim && key > this.dataFim) return false;
        return true;
      });
    }

    // KPI snapshot
    const entradas = filtered
      .filter((l) => l.valor >= 0)
      .reduce((s, l) => s + l.valor, 0);
    const despesas = filtered.filter(
      (l) => l.valor < 0 && l.categoria !== "0.0.0 Recurso"
    );
    const saidas = despesas.reduce((s, l) => s + Math.abs(l.valor), 0);

    const ativos = isTodos
      ? this.projetos.filter((p) => (this.statusMap.get(p) || "Ativo").toLowerCase().includes("ativo")).length
      : 0;

    const saldoRemanescente = isTodos
      ? Array.from(this.resumosMap.values()).reduce((s, r) => s + (r.saldoRemanescente || 0), 0)
      : (this.resumosMap.get(this.projetoSelecionado!)?.saldoRemanescente || 0);

    // Para Operação Básica: adiciona o saldo remanescente dos outros projetos
    // transferido formalmente para Op. Básica, tanto no saldo quanto na base de execução.
    let saldo = entradas - saidas;
    let srOpBasica = 0;
    if (!isTodos && this.projetoSelecionado === "Operação Básica") {
      srOpBasica = Array.from(this.resumosMap.values())
        .filter(r => r.projeto !== "Operação Básica")
        .reduce((acc, r) => acc + (r.saldoRemanescente || 0), 0);
      saldo += srOpBasica;
    }

    /**
     * Rendimentos destinados ao projeto também custeiam despesa, logo entram na
     * base. Sem eles a Plataforma Desafio 3.0 marcava 108%: os R$ 21.600,00
     * pagos em 09/2026 saíram da destinação de R$ 150.002,11, apareciam como
     * saída e não tinham recurso correspondente no denominador.
     */
    const rendDestinados = isTodos
      ? Array.from(this.resumosMap.values()).reduce((s, r) => s + (r.rendimentosDestinados || 0), 0)
      : (this.resumosMap.get(this.projetoSelecionado!)?.rendimentosDestinados || 0);
    saldo += rendDestinados;

    const baseExecucao = entradas + srOpBasica + rendDestinados;
    this.snapshot = {
      projeto: isTodos ? `Todos os ${this.projetos.length} projetos` : this.projetoSelecionado!,
      entradas,
      saidas,
      saldo,
      saldoRemanescente,
      execucao: baseExecucao > 0 ? (saidas / baseExecucao) * 100 : 0,
      numPagamentos: despesas.length,
      ticketMedio: despesas.length > 0 ? saidas / despesas.length : 0,
      status: isTodos ? `${ativos} ativos` : (this.statusMap.get(this.projetoSelecionado!) || "Ativo"),
      srOpBasica,
      rendDestinados,
      baseExecucao,
    };

    // Categorias
    const catMap = new Map<string, number>();
    filtered
      .filter((l) => l.categoria !== "0.0.0 Recurso" && l.valor < 0)
      .forEach((l) => {
        const cat = l.categoria.replace(/^\d+(\.\d+)*\s*/, "").trim();
        catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(l.valor));
      });
    const catTotal = Array.from(catMap.values()).reduce((s, v) => s + v, 0);
    this.categorias = Array.from(catMap.entries())
      .map(([categoria, total]) => ({
        categoria,
        total,
        percentual: catTotal > 0 ? (total / catTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Fluxo mensal
    const fluxoMap = new Map<string, { entradas: number; saidas: number }>();
    filtered.forEach((l) => {
      if (!l.mesAno) return;
      if (!fluxoMap.has(l.mesAno)) fluxoMap.set(l.mesAno, { entradas: 0, saidas: 0 });
      const m = fluxoMap.get(l.mesAno)!;
      if (l.valor >= 0) m.entradas += l.valor;
      else m.saidas += Math.abs(l.valor);
    });
    const sortedFluxo = Array.from(fluxoMap.entries()).sort((a, b) => {
      const [ma, ya] = a[0].split("/");
      const [mb, yb] = b[0].split("/");
      return (parseInt(ya) * 100 + parseInt(ma)) - (parseInt(yb) * 100 + parseInt(mb));
    });
    let acumulado = 0;
    this.fluxo = sortedFluxo.map(([mesAno, data]) => {
      acumulado += data.entradas - data.saidas;
      return { mesAno, entradas: data.entradas, saidas: data.saidas, saldoAcumulado: acumulado };
    });

    /**
     * Todos os lançamentos que o filtro alcança — não "os últimos 25".
     *
     * O corte fixo dava um recorte que não correspondia a nenhum critério: nem
     * ao projeto escolhido, nem ao período, nem ao total exibido nos cartões.
     * Quem exportava levava 25 linhas e um total que não fechava com elas. A
     * lista agora segue os filtros, e a paginação é só de exibição: o total e a
     * exportação sempre falam do conjunto inteiro.
     */
    this.transacoesRecentes = filtered
      .filter((l) => l.valor < 0 && l.categoria !== "0.0.0 Recurso")
      .map((l) => ({
        mesAno: l.mesAno,
        categoria: l.categoria.replace(/^\d+(\.\d+)*\s*/, "").trim(),
        fornecedor: l.fornecedor || "—",
        observacao: l.observacao,
        valor: Math.abs(l.valor),
        numPag: l.numPag || "",
      }))
      .sort((a, b) => {
        const [ma, ya] = a.mesAno.split("/");
        const [mb, yb] = b.mesAno.split("/");
        const dif = (parseInt(yb) * 100 + parseInt(mb)) - (parseInt(ya) * 100 + parseInt(ma));
        return dif !== 0 ? dif : b.valor - a.valor;
      });
    this.paginaLancamentos = 0;

    this.renderCharts(filtered);

    if (this.projetoSelecionado === "Alimenta +1000 Cidades") {
      this.calcularExecucaoProdutos(filtered);
    } else {
      this.metasAlimenta = [];
      this.alimentaTotais = { orcamento: 0, realizado: 0, percentual: 0 };
      this.categoriasAlimenta = [];
      this.totalGastoAlimenta = 0;
      this.donutChartData = { labels: [], datasets: [] };
    }

    this.computarRendimentosAtribuidos();
  }

  private computarRendimentosAtribuidos(): void {
    const proj = this.projetoSelecionado;
    if (!proj || !this.rendResumoData || this.rendResumoData.porMes.length === 0 || this.allLancamentos.length === 0) {
      this.rendimentosAtribuidos = [];
      this.totalRendimentoAtribuido = 0;
      return;
    }

    const closedMc = this.rendProjetosEncerrados.get(proj);

    // Mesmo critério de inativo usado em rendimentos.component
    const isInativo = (p: string) => {
      const st = (this.statusMap.get(p) ?? '').toLowerCase();
      return st === 'finalizado' || st === 'encerrado' || this.rendProjetosEncerrados.has(p);
    };

    // Exclui lançamentos sem projeto (créditos de rendimento) — mesmo filtro de rendimentos.component
    const lancsSorted = [...this.allLancamentos]
      .filter(l => l.mesAno && l.projeto)
      .sort((a, b) => mesKeyNum(a.mesAno) - mesKeyNum(b.mesAno));

    const allMonthsSorted = [...this.rendResumoData.porMes]
      .sort((a, b) => mesKeyNum(a.mesAno) - mesKeyNum(b.mesAno));

    const runningBalance = new Map<string, number>();
    let lIdx = 0;
    let accumProject = 0;
    let undistributed = 0;
    const result: RendAtribuido[] = [];

    for (const mes of allMonthsSorted) {
      const mc = mesKeyNum(mes.mesAno);
      if (closedMc && mc > closedMc) break;

      // Sempre avança lançamentos para manter runningBalance correto
      while (lIdx < lancsSorted.length && mesKeyNum(lancsSorted[lIdx].mesAno) <= mc) {
        const l = lancsSorted[lIdx++];
        runningBalance.set(l.projeto, (runningBalance.get(l.projeto) ?? 0) + l.valor);
      }

      // Transfere saldo de projetos encerrados (aba Saldos) para Op. Básica
      this.rendProjetosEncerrados.forEach((cMc, p) => {
        if (mc > cMc) {
          const bal = runningBalance.get(p) ?? 0;
          if (bal > 0) runningBalance.set('Operação Básica', (runningBalance.get('Operação Básica') ?? 0) + bal);
          runningBalance.set(p, 0);
        }
      });

      // Transfere saldo de projetos inativos por Status (sem entrada na aba Saldos)
      runningBalance.forEach((bal, p) => {
        if (p !== 'Operação Básica' && isInativo(p) && !this.rendProjetosEncerrados.has(p)) {
          if (bal > 0) runningBalance.set('Operação Básica', (runningBalance.get('Operação Básica') ?? 0) + bal);
          runningBalance.set(p, 0);
        }
      });

      const totalPos = Array.from(runningBalance.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
      const toDistribute = mes.liquido + undistributed;

      if (totalPos <= 0 || toDistribute <= 0) {
        undistributed += mes.liquido;
        continue;
      }

      const saldoProjeto = runningBalance.get(proj) ?? 0;
      if (saldoProjeto <= 0) {
        undistributed = 0;
        continue;
      }

      const pct = saldoProjeto / totalPos;
      const rendimentoMes = toDistribute * pct;
      undistributed = 0;

      accumProject += rendimentoMes;
      result.push({ mesAno: mes.mesAno, pctParticipacao: pct * 100, rendimentoMes, rendimentoAcumulado: accumProject, saldoProjeto });
    }

    this.rendimentosAtribuidos = result;
    this.totalRendimentoAtribuido = result.reduce((s, r) => s + r.rendimentoMes, 0);
  }

  toggleMeta(meta: MetaGrupo): void { meta.expandido = !meta.expandido; }

  private calcularExecucaoProdutos(lancs: Lancamento[]): void {
    const realizadoPorCodigo = new Map<string, number>();
    lancs.forEach((l) => {
      if (l.valor >= 0) return;
      const match = (l.observacao || "").match(/^(\d+\.\d+)/);
      if (!match) return;
      const codigo = match[1];
      realizadoPorCodigo.set(codigo, (realizadoPorCodigo.get(codigo) || 0) + Math.abs(l.valor));
    });

    const produtos: ProdutoExecucao[] = ALIMENTA_PRODUTOS.map((p) => {
      const realizado = realizadoPorCodigo.get(p.codigo) || 0;
      return { ...p, realizado, percentual: p.orcamento > 0 ? (realizado / p.orcamento) * 100 : 0 };
    });

    const orc = produtos.reduce((s, p) => s + p.orcamento, 0);
    const real = produtos.reduce((s, p) => s + p.realizado, 0);
    this.alimentaTotais = { orcamento: orc, realizado: real, percentual: orc > 0 ? (real / orc) * 100 : 0 };

    const grupos = new Map<string, MetaGrupo>();
    produtos.forEach((p) => {
      const [idRaw, tituloRaw] = p.meta.split("—");
      const id = (idRaw || "").trim();
      const titulo = (tituloRaw || "").trim();
      if (!grupos.has(id)) {
        grupos.set(id, { id, titulo, produtos: [], orcamento: 0, realizado: 0, percentual: 0, inicio: p.inicio, fim: p.fim, expandido: false });
      }
      const g = grupos.get(id)!;
      g.produtos.push(p);
      g.orcamento += p.orcamento;
      g.realizado += p.realizado;
    });

    grupos.forEach((g) => {
      g.percentual = g.orcamento > 0 ? (g.realizado / g.orcamento) * 100 : 0;
      g.inicio = g.produtos.reduce((min, p) => parseMesAno(p.inicio) < parseMesAno(min) ? p.inicio : min, g.produtos[0].inicio);
      g.fim = g.produtos.reduce((max, p) => parseMesAno(p.fim) > parseMesAno(max) ? p.fim : max, g.produtos[0].fim);
    });

    const expandidasAntes = new Set(this.metasAlimenta.filter((m) => m.expandido).map((m) => m.id));
    this.metasAlimenta = Array.from(grupos.values()).map((g) => ({ ...g, expandido: expandidasAntes.has(g.id) }));

    this.calcularCategorias(lancs);
  }

  private calcularCategorias(lancs: Lancamento[]): void {
    const porCategoria = new Map<string, number>();
    lancs.forEach((l) => {
      if (l.valor >= 0) return;
      const nome = (l.categoria || "").replace(/^\d+(\.\d+)*\s*/, "").trim();
      if (!nome) return;
      porCategoria.set(nome, (porCategoria.get(nome) || 0) + Math.abs(l.valor));
    });

    const sorted = Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    const palette = ["#10b981","#34d399","#0ea5e9","#6366f1","#8b5cf6","#f59e0b","#f97316","#ef4444","#ec4899","#14b8a6","#84cc16","#a855f7"];

    this.categoriasAlimenta = sorted.map(([nome, valor], i) => ({
      nome, valor, percentual: total > 0 ? (valor / total) * 100 : 0, cor: palette[i % palette.length],
    }));
    this.totalGastoAlimenta = total;

    this.donutChartData = {
      labels: this.categoriasAlimenta.map((c) => c.nome),
      datasets: [{
        data: this.categoriasAlimenta.map((c) => c.valor),
        backgroundColor: this.categoriasAlimenta.map((c) => c.cor),
        borderColor: "transparent",
        borderWidth: 2,
        hoverOffset: 8,
      } as any],
    };
  }

  private renderCharts(filtered: Lancamento[]): void {
    this.chartCategoriasReady = false;
    this.chartFluxoReady = false;
    this.balancaoChartReady = false;

    const colors = this.generateColors(this.categorias.length);

    setTimeout(() => {
      this.barChartData = {
        labels: this.categorias.map((c) => c.categoria),
        datasets: [
          {
            label: "Despesas",
            data: this.categorias.map((c) => c.total),
            backgroundColor: colors,
            borderRadius: 5,
          },
        ],
      };
      this.chartCategoriasReady = true;
    }, 30);

    setTimeout(() => {
      this.mixedChartData = {
        labels: this.fluxo.map((f) => f.mesAno),
        datasets: [
          {
            type: "bar",
            label: "Entradas",
            data: this.fluxo.map((f) => f.entradas),
            backgroundColor: "rgba(16,185,129,0.35)",
            borderColor: "#10b981",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "bar",
            label: "Saídas",
            data: this.fluxo.map((f) => f.saidas),
            backgroundColor: "rgba(239,68,68,0.35)",
            borderColor: "#ef4444",
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: "y",
          },
          {
            type: "line",
            label: "Saldo Acumulado",
            data: this.fluxo.map((f) => f.saldoAcumulado),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245,158,11,0.08)",
            borderWidth: 3,
            pointBackgroundColor: "#f59e0b",
            pointRadius: 3,
            fill: true,
            tension: 0.4,
            yAxisID: "y1",
          } as any,
        ],
      };
      this.chartFluxoReady = true;
    }, 50);

    setTimeout(() => {
      this.buildBalancaoChart(filtered);
      this.balancaoChartReady = true;
    }, 70);
  }

  private buildBalancaoChart(filtered: Lancamento[]): void {
    const projMap = new Map<string, { entradas: number; saidas: number }>();
    filtered.forEach((l) => {
      const key = l.projeto || "Sem projeto";
      if (!projMap.has(key)) projMap.set(key, { entradas: 0, saidas: 0 });
      const m = projMap.get(key)!;
      if (l.valor >= 0) m.entradas += l.valor;
      else if (l.categoria !== "0.0.0 Recurso") m.saidas += Math.abs(l.valor);
    });

    const isAtivo = (proj: string) => {
      const s = (this.statusMap.get(proj) || "Ativo").toLowerCase();
      return !s.includes("finaliz") && !s.includes("encerr");
    };
    const all = Array.from(projMap.entries());
    const entries = [
      ...all.filter(([p]) => isAtivo(p)).sort((a, b) => b[1].entradas - a[1].entradas),
      ...all.filter(([p]) => !isAtivo(p)).sort((a, b) => b[1].entradas - a[1].entradas),
    ];

    const totalSaldosParaOpBasica = Array.from(this.resumosMap.values())
      .filter(r => r.projeto !== "Operação Básica")
      .reduce((acc, r) => acc + (r.saldoRemanescente || 0), 0);

    this.balancaoChartData = {
      labels: entries.map(([label]) => label),
      datasets: [
        {
          label: "Receitas",
          data: entries.map(([, d]) => d.entradas),
          backgroundColor: "#10b981",
          borderRadius: 4,
          stack: "Stack 0",
        },
        {
          label: "Saldo Remanescente",
          data: entries.map(([proj]) => proj === "Operação Básica" ? totalSaldosParaOpBasica : 0),
          backgroundColor: "#065f46",
          borderRadius: 4,
          stack: "Stack 0",
        },
        {
          label: "Previsto",
          data: entries.map(([proj]) => this.previstosPorProjeto.get(proj) || 0),
          backgroundColor: "rgba(16,185,129,0.25)",
          borderColor: "#10b981",
          borderWidth: 1,
          borderRadius: 4,
          stack: "Stack 0",
        } as any,
        {
          label: "Despesas",
          data: entries.map(([, d]) => d.saidas),
          backgroundColor: "#6366f1",
          borderRadius: 4,
          stack: "Stack 1",
        },
        {
          label: "Saldo Remanescente",
          data: entries.map(([proj]) => proj === "Operação Básica" ? 0 : (this.resumosMap.get(proj)?.saldoRemanescente || 0)),
          backgroundColor: "#065f46",
          borderRadius: 4,
          stack: "Stack 1",
        },
      ],
    };

    /**
     * O eixo só desce abaixo de zero quando há algo lá embaixo.
     *
     * Sem isso o Chart.js abria uma faixa negativa vazia e encolhia pela
     * metade todas as barras reais. Ancorar em zero não esconde negativo: se
     * houver um, o `min` é liberado e a barra aparece.
     */
    const temNegativo = this.balancaoChartData.datasets.some(d =>
      (d.data as number[]).some(v => typeof v === "number" && v < 0)
    );
    this.balancaoChartOptions = {
      ...this.balancaoChartOptions,
      scales: {
        ...this.balancaoChartOptions?.scales,
        x: { ...this.balancaoChartOptions?.scales?.['x'], min: temNegativo ? undefined : 0 },
      },
    };
  }

  private generateColors(count: number): string[] {
    const palette = [
      "rgba(99,102,241,0.75)",
      "rgba(16,185,129,0.75)",
      "rgba(100,116,139,0.75)",
      "rgba(245,158,11,0.75)",
      "rgba(239,68,68,0.75)",
      "rgba(139,92,246,0.75)",
      "rgba(20,184,166,0.75)",
      "rgba(249,115,22,0.75)",
      "rgba(59,130,246,0.75)",
      "rgba(107,114,128,0.75)",
      "rgba(168,85,247,0.75)",
      "rgba(236,72,153,0.75)",
      "rgba(14,165,233,0.75)",
    ];
    return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
  }
}
