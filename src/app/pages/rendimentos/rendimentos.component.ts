import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatTooltipModule } from "@angular/material/tooltip";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import { RelatorioPdfService, CabecalhoRelatorio } from '../../services/relatorio-pdf.service';
import { Rendimento, OficioRendimentos, ProjetoOficio, TransferenciaRendimento, UtilizacaoRendimento } from "../../models/lancamento.model";
import { ratearRendimentos, comporSaldo } from "../../services/rateio-rendimentos";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DetalheRend {
  projeto: string;
  pctParticipacao: number;
  rendimentoMes: number;
  rendimentoAcumulado: number;
  saldoProjeto: number;
  cor: string;
}

interface MesProjHistorico {
  mesAno: string;
  rendimentoMes: number;
  rendimentoAcumulado: number;
  pctParticipacao: number;
}

interface ProjetoHistorico {
  projeto: string;
  cor: string;
  meses: MesProjHistorico[];
  /** Rendimento gerado pelo projeto no período — o histórico, que não muda. */
  totalAcumulado: number;
  pctTotal: number;
  /**
   * Saldo livre atual: o que sobrou do gerado depois do que foi destinado.
   * Para quem destinou em 31/07/2026, é só o rendimento posterior ao corte.
   */
  saldoLivre: number;
  /** Participação no saldo livre total — a base da leitura da seção. */
  pctLivre: number;
  /** Quanto o projeto destinou no evento institucional; 0 para quem não participou. */
  destinado: number;
  aberto: boolean;
}

/** Sparkline do modal — leitura descritiva do histórico já calculado. */
interface SparkPonto { mesAno: string; valor: number; x: number; y: number; }
interface SparkProjeto {
  /**
   * 'serie'   — 2+ meses, desenha a trajetória
   * 'unico'   — projeto entrou neste mês, há valor mas não há série
   * 'ausente' — mês fora da janela coberta pelo histórico por projeto
   */
  estado: 'serie' | 'unico' | 'ausente';
  pontos: SparkPonto[];
  linha: string;
  area: string;
  fim: SparkPonto | null;
  media: number;
  mediaY: number;
  melhorLabel: string;
  melhorValor: number;
  deltaPct: number;
  qtdMeses: number;
  primeiroLabel: string;
}

interface CalcRendResult {
  mes: string; label: string; rend_total: number;
  proj_rend: { [k: string]: number };
  proj_part: { [k: string]: number };
  proj_fin:  { [k: string]: number };
}

interface MesPrevisto { mes: string; label: string; rendMes: number; pct: number; saldoFin: number; acumRun: number; }
interface ProjetoPrev { projeto: string; cor: string; histAcum: number; projTotal: number; totalGeral: number; meses: MesPrevisto[]; aberto: boolean; }

const PALETTE = ['#6366f1','#10b981','#f59e0b','#ec4899','#06b6d4','#8b5cf6','#ef4444','#14b8a6','#f97316','#84cc16'];
const mesKey = (s: string) => { const [m, y] = s.split('/'); return parseInt(y) * 100 + parseInt(m); };
const cent = (v: number) => Math.round(v * 100) / 100;

/**
 * Rateio proporcional PROPOSTO (EM REVISÃO — aguarda validação pelo Impact Hub).
 * "Outros" é categoria separada: Fundo GovTech/BID + Inovação Crédito/MDA + Oficina Energias/ANEEL.
 * NUNCA consolidar Outros em Op. Básica — distorce o rendimento de cada projeto.
 * Hipótese identificada: possível ausência do pool Outros no rateio apresentado pelo FinControl,
 * sujeita à confirmação no detalhamento integral dos lançamentos.
 * Fonte: historico_diagnostico.json — rend_proporcional (não substituído pelo FinControl real).
 */
const REND_HIST_PROPOSTO: Record<string, Record<string, number>> = {
  '01/2026': { 'Op. Básica': 4443.21, 'Alimenta': 54181.84, 'Co.NE': 3946.84, 'CAR DPG': 10051.37, 'Outros': 1225.06 },
  '02/2026': { 'Op. Básica': 3399.96, 'Alimenta': 46482.42, 'Co.NE': 2817.65, 'CAR DPG':  8637.19, 'Outros': 1011.13 },
  '03/2026': { 'Op. Básica': 3468.87, 'Alimenta': 56205.50, 'Co.NE': 2859.60, 'CAR DPG': 10466.07, 'Outros':  789.78 },
  '04/2026': { 'Op. Básica': 2497.93, 'Alimenta': 49897.98, 'Co.NE': 2086.27, 'CAR DPG':  9287.91, 'Outros':  277.35 },
  '05/2026': { 'Op. Básica': 1830.38, 'Alimenta': 46928.57, 'Co.NE': 1582.18, 'CAR DPG':  8812.99, 'Outros':  127.78 },
  '06/2026': { 'Op. Básica': 1303.33, 'Alimenta': 47590.70, 'Co.NE': 2602.29, 'CAR DPG':  9164.49, 'Outros':   14.53 },
};


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
export class RendimentosComponent implements OnInit, OnDestroy {
  isLoading = true;

  /**
   * A página só aparece quando o painel "Rendimentos da conta" está pronto.
   *
   * As seções chegavam em tempos diferentes: o resumo da conta depende da aba
   * de Rendimentos e do rateio sobre todos os lançamentos, e é o mais lento.
   * Liberar cada bloco assim que ele ficava pronto fazia a tela montar aos
   * pedaços, com números mudando de valor na frente do leitor enquanto o
   * restante ainda carregava. Agora é tudo de uma vez.
   *
   * O evento institucional entra na conta porque as transferências alteram o
   * rateio de agosto em diante: mostrar o histórico antes dele seria mostrar um
   * número que muda em seguida.
   */
  private readonly carregado = { resumo: false, historico: false, evento: false };

  /** Teto de espera: uma fonte fora do ar não pode deixar a página em branco. */
  private static readonly ESPERA_MAXIMA_MS = 12000;

  private avaliarCarregamento(): void {
    this.carregado.resumo = this.resumo.porMes.length > 0;
    this.carregado.historico = this.historicoPorProjeto.length > 0;
    if (!this.isLoading) return;
    if (this.carregado.resumo && this.carregado.historico && this.carregado.evento) {
      // Um quadro para o gráfico terminar de montar antes de a tela trocar.
      setTimeout(() => (this.isLoading = false), 150);
    }
  }
  /** Lançamentos da Base, sem ajuste. */
  lancamentosBase: any[] = [];
  /** Base + transferências internas de rendimentos — é o que o rateio consome. */
  lancamentosOriginais: any[] = [];
  transferencias: TransferenciaRendimento[] = [];
  oficio: OficioRendimentos | null = null;

  private aplicarTransferencias(): void {
    this.lancamentosOriginais = [
      ...this.lancamentosBase,
      ...this.transferencias.map(t => ({
        categoria: 'TRANSFERÊNCIA INTERNA', observacao: t.documento,
        projeto: t.projeto, mesAno: t.mesAno, valor: t.valor, fornecedor: '', numPag: '',
      })),
    ];
  }

  /** Projetos que cederam ou receberam no evento, para a faixa institucional. */
  get oficioPorProjeto(): ProjetoOficio[] {
    return this.oficio ? this.oficio.projetos : [];
  }
  get oficioParticipantes(): ProjetoOficio[] {
    return this.oficioPorProjeto.filter(p => p.participa);
  }

  resumo = {
    totalBruto: 0,
    totalImpostos: 0,
    saldoLiquido: 0,
    totalUtilizado: 0,
    saldoDisponivel: 0,
    porMes: [] as { mesAno: string; bruto: number; imposto: number; liquido: number; acumulado: number }[],
  };

  tabelaAberta = false;
  mesAnoSelecionado: string | null = null;
  detalhesRend: DetalheRend[] = [];
  utilizacaoPorMes = new Map<string, string>();
  /** Utilizações e destinações lidas do bloco J:L da aba "Rendimentos". */
  utilizacoes: UtilizacaoRendimento[] = [];
  /** Falhas de leitura da aba, exibidas na página em vez de silenciadas. */
  avisosLeitura: string[] = [];

  /**
   * Diferenças conhecidas entre o valor registrado no projeto e o lançado na
   * aba Principal, nas transferências de 31/05/2025.
   *
   * Ficam à vista como pendência de conciliação. Nenhum ajuste é criado para
   * fechá-las: um lançamento inventado esconderia a divergência em vez de
   * resolvê-la, e é justamente ela que precisa ser investigada na origem.
   */
  readonly pendenciasConciliacao = [
    { projeto: 'Ambiente Promotor', noProjeto: 5882.65, naPrincipal: 4107.65, diferenca: 1775.00 },
    { projeto: 'Feira Reversa', noProjeto: 41498.88, naPrincipal: 44626.93, diferenca: 3128.05 },
  ];
  /** `acumulado` aqui é o saldo DISPONÍVEL: acumulado do período menos o utilizado. */
  porMesCorrigido: {
    mesAno: string; bruto: number; imposto: number; liquido: number; acumulado: number;
    utilizadoNoMes: number; rotuloUtilizacao: string; detalheUtilizacao: string;
  }[] = [];

  histAberto = false;
  historicoPorProjeto: ProjetoHistorico[] = [];
  somaVerificacao = { totalProjetos: 0, totalGeral: 0, bate: true, somaLivre: 0, livreEsperado: 0, livreBate: true };

  private readonly platformId = inject(PLATFORM_ID);

  // ── Previsão ──
  prevAberto = false;
  previsaoCarregada = false;
  previsaoPorProjeto: ProjetoPrev[] = [];
  prevTotais = { hist: 467078.70, proj2026: 0, proj2027: 0, proj2028: 0, projTotal: 0, geral: 0 };
  private _rawPrevResults: CalcRendResult[] = [];
  private _sheetsRendimentos = new Map<string, number>(); // YYYY-MM → total do orçamento
  private _histAcumDynamic  = new Map<string, number>(); // PROJETOS_KEY → acumulado histórico real
  projFirstMes = '2026-07';     // YYYY-MM — primeiro mês da projeção (atualizado via resumo)
  projFirstLabel = 'jul/26';    // label curto do primeiro mês projetado
  projLastHistLabel = 'jun/26'; // label curto do último mês realizado
  prevHistTotal = 467078.70;    // total realizado (derivado de resumo.porMes)

  private logoIH = '';   private logoIHW = 0;   private logoIHH = 0;
  private logoEnap = ''; private logoEnapW = 0; private logoEnapH = 0;


  get maxAcumulado(): number {
    return Math.max(...this.porMesCorrigido.map(m => Math.abs(m.acumulado)), 1);
  }
  pctAcumulado(acumulado: number): number {
    return (Math.abs(acumulado) / this.maxAcumulado) * 100;
  }
  isUtilizado(mesAno: string): boolean {
    return (this.utilizacaoPorMes.get(mesAno) ?? '').toLowerCase().trim() === 'utilizado';
  }
  // projeto → numeric mesAno do encerramento (ex: 202505 para 31/05/2025)
  private projetosEncerrados = new Map<string, number>();
  private projetosInativos = new Set<string>(); // projetos finalizado/encerrado sem entrada na aba Saldos
  private srOutrosProjetos = 0;

  get detalheInfo() {
    return this.porMesCorrigido.find(m => m.mesAno === this.mesAnoSelecionado);
  }
  get detalheBrutoMes(): number { return this.detalheInfo?.bruto ?? 0; }
  get detalheImpMes(): number { return this.detalheInfo?.imposto ?? 0; }
  get detalheLiquidoMes(): number { return this.detalheInfo?.liquido ?? 0; }
  get detalheAcumulado(): number { return this.detalheInfo?.acumulado ?? 0; }
  get maxRendAcum(): number {
    return Math.max(...this.detalhesRend.map(d => d.rendimentoAcumulado), 1);
  }

  // ─── Sparkline por projeto (modal) ──────────────────────────────────────────
  // Apenas apresentação: lê a série já produzida por computarHistoricoPorProjeto()
  // e a recorta até o mês aberto no modal. Cache por projeto+mês para não
  // recalcular a cada ciclo de detecção de mudanças.
  private _sparkCache = new Map<string, SparkProjeto>();
  private static readonly SPARK_AUSENTE: SparkProjeto = {
    estado: 'ausente', pontos: [], linha: '', area: '', fim: null,
    media: 0, mediaY: 0, melhorLabel: '', melhorValor: 0, deltaPct: 0, qtdMeses: 0,
    primeiroLabel: '',
  };

  sparkline(projeto: string): SparkProjeto {
    const chave = projeto + '|' + (this.mesAnoSelecionado ?? '');
    const emCache = this._sparkCache.get(chave);
    if (emCache) return emCache;

    const ausente = RendimentosComponent.SPARK_AUSENTE;
    const hist = this.historicoPorProjeto.find(h => h.projeto === projeto);
    if (!hist || !this.mesAnoSelecionado) { this._sparkCache.set(chave, ausente); return ausente; }

    const corte = this.compararMes(this.mesAnoSelecionado);
    const meses = hist.meses.filter(m => this.compararMes(m.mesAno) <= corte);
    // Meses do período já utilizado ficam fora de computarHistoricoPorProjeto(),
    // então não há série a exibir — o painel abre explicando isso.
    if (meses.length === 0) { this._sparkCache.set(chave, ausente); return ausente; }

    // Projeto que entrou agora: há valor, mas não há série anterior.
    if (meses.length === 1) {
      const unico: SparkProjeto = {
        ...ausente, estado: 'unico', qtdMeses: 1,
        primeiroLabel: meses[0].mesAno,
        media: meses[0].rendimentoMes,
        melhorLabel: meses[0].mesAno,
        melhorValor: meses[0].rendimentoMes,
      };
      this._sparkCache.set(chave, unico);
      return unico;
    }

    const W = 600, H = 56, padX = 5, padTopo = 7, padBase = 8;
    const larguraInterna = W - padX * 2;
    const alturaInterna = H - padTopo - padBase;

    const valores = meses.map(m => m.rendimentoMes);
    const maximo = Math.max(...valores);
    const minimo = Math.min(...valores, 0);
    const amplitude = maximo - minimo || 1;
    const paraY = (v: number) => padTopo + alturaInterna - ((v - minimo) / amplitude) * alturaInterna;

    const pontos: SparkPonto[] = meses.map((m, i) => ({
      mesAno: m.mesAno,
      valor: m.rendimentoMes,
      x: padX + (i / (meses.length - 1)) * larguraInterna,
      y: paraY(m.rendimentoMes),
    }));

    const linha = pontos
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const base = H - padBase;
    const area = `${linha} L${pontos[pontos.length - 1].x.toFixed(1)},${base} `
               + `L${pontos[0].x.toFixed(1)},${base} Z`;

    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    const fim = pontos[pontos.length - 1];
    let melhor = 0;
    valores.forEach((v, i) => { if (v > valores[melhor]) melhor = i; });

    const dados: SparkProjeto = {
      estado: 'serie', pontos, linha, area, fim, media,
      mediaY: paraY(media),
      melhorLabel: meses[melhor].mesAno,
      melhorValor: valores[melhor],
      deltaPct: media > 0 ? ((fim.valor - media) / media) * 100 : 0,
      qtdMeses: meses.length,
      primeiroLabel: meses[0].mesAno,
    };
    this._sparkCache.set(chave, dados);
    return dados;
  }

  private compararMes(mesAno: string): number {
    const [m, a] = mesAno.split('/');
    return parseInt(a) * 100 + parseInt(m);
  }

  chartReady = false;
  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };

  /**
   * Marco institucional no gráfico de evolução.
   *
   * A série de saldo acumulado tem uma ruptura em 08/2026 que, sem explicação,
   * parece perda de recurso. Uma linha vertical na competência de efeito e um
   * rodapé no tooltip daquele mês contam o que de fato aconteceu: o acumulado
   * até julho saiu do saldo livre e passou a destinado, e o rendimento voltou
   * a acumular do zero. A transferência não é receita nem despesa.
   */
  private readonly marcoInstitucional = {
    id: 'marcoInstitucional',
    afterDatasetsDraw: (chart: any) => {
      const rotulo = this.marcoLabel;
      if (!rotulo) return;
      const i = (chart.data.labels || []).indexOf(rotulo);
      if (i < 0) return;

      const { ctx, chartArea } = chart;
      const x = chart.scales['x'].getPixelForValue(i);
      // Meio caminho entre a barra do corte e a anterior: a linha marca a
      // ABERTURA da competência, não o fechamento do mês.
      const largura = chart.scales['x'].getPixelForValue(1) - chart.scales['x'].getPixelForValue(0);
      const px = i > 0 ? x - largura / 2 : x;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(240,180,95,0.85)';
      ctx.moveTo(px, chartArea.top);
      ctx.lineTo(px, chartArea.bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.font = '600 10px Inter, Roboto, sans-serif';
      ctx.textBaseline = 'top';
      const texto = this.oficio?.documento ?? 'Evento institucional';
      const larguraTexto = ctx.measureText(texto).width;
      // Perto da borda direita o rótulo vira para a esquerda em vez de cortar.
      const alinhaEsquerda = px + larguraTexto + 14 > chartArea.right;
      const tx = alinhaEsquerda ? px - larguraTexto - 8 : px + 8;

      ctx.fillStyle = 'rgba(240,180,95,0.16)';
      ctx.fillRect(tx - 5, chartArea.top + 2, larguraTexto + 10, 16);
      ctx.fillStyle = 'rgb(240,180,95)';
      ctx.fillText(texto, tx, chartArea.top + 5);
      ctx.restore();
    },
  };
  readonly chartPlugins = [this.marcoInstitucional];

  /** mesAno do corte ("08/2026") ou null enquanto o evento não carregou. */
  private get marcoLabel(): string | null {
    if (!this.oficio?.competenciaEfeito) return null;
    const [ano, mes] = this.oficio.competenciaEfeito.split('-');
    return mes ? `${mes}/${ano}` : null;
  }

  /**
   * Rodapé do tooltip: separa o que o gráfico sozinho não distingue.
   *
   * As barras mostram rendimento gerado; a linha, o acumulado. Nenhum dos dois
   * mostra que parte do acumulado deixou de ser saldo livre e passou a
   * destinado, nem que houve pagamento consumindo esse saldo. O rodapé só
   * aparece nos meses em que isso aconteceu.
   */
  private rodapeTooltip(mesAno: string | undefined): string[] {
    const o = this.oficio;
    if (!o || !mesAno) return [];
    const linhas: string[] = [];

    if (mesAno === this.marcoLabel) {
      linhas.push(
        `${o.documento} — abertura de ${mesAno}`,
        `Transferência cedida: ${this.brl(o.transferidoDeOutrosProjetos)}`,
        `Transferência recebida: ${this.brl(o.transferidoDeOutrosProjetos)} (${o.projetoExecutor})`,
        `Saldo destinado: ${this.brl(o.totalDestinado)}`,
        `Livre nos projetos: ${this.brl(o.saldoLivreTotal)}`,
        'Transferência entre projetos — não é receita nem despesa.',
      );
    }

    const usos = o.movimentacoes.filter(
      m => m.tipo === 'utilização da carteira' && this.competenciaParaMesAno(m.competencia) === mesAno
    );
    usos.forEach(m => linhas.push(
      `Utilizado no mês: ${this.brl(m.valor)}` +
      (m.numeroPagamento ? ` (pagamento ${m.numeroPagamento})` : '')
    ));

    return linhas;
  }

  private competenciaParaMesAno(competencia: string): string {
    const [ano, mes] = String(competencia).split('-');
    return mes ? `${mes}/${ano}` : competencia;
  }

  private brl(v: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

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
        footerColor: "#f0b45f",
        footerFont: { weight: "normal" as const, size: 11 },
        callbacks: {
          label: (ctx: any) => {
            // Nomes explícitos: "rendimento gerado" é o que a conta rendeu no
            // mês; "saldo livre" é o que sobra depois do que foi destinado.
            const label = ctx.dataset.label || "";
            return `${label}: ${this.brl(ctx.parsed.y)}`;
          },
          footer: (itens: any[]) => this.rodapeTooltip(itens?.[0]?.label),
        }
      }
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { display: false } },
      y: {
        ticks: {
          color: "#64748b",
          callback: (v: any) => "R$ " + new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)
        },
        grid: { color: "rgba(255,255,255,0.05)" }
      },
    },
  };

  constructor(
    private dataService: DataService,
    private http: HttpClient,
    private relatorioPdf: RelatorioPdfService,
  ) {}

  ngOnDestroy(): void {}

  toggleProjPrev(proj: string): void {
    const p = this.previsaoPorProjeto.find(h => h.projeto === proj);
    if (p) p.aberto = !p.aberto;
  }

  prevUtilizadoTotal = 0;

  /** Primeiro e último mês do período utilizado — derivados dos dados, nunca fixos. */
  histPrimeiroUtilizadoLabel = '';
  histUltimoUtilizadoLabel = '';
  get periodoUtilizadoLabel(): string {
    if (!this.histPrimeiroUtilizadoLabel) return '';
    return `${this.histPrimeiroUtilizadoLabel}–${this.histUltimoUtilizadoLabel}`;
  }

  private deriveProjectionStart(): void {
    if (!this.resumo.porMes.length) return;
    const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const sorted = [...this.resumo.porMes].sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));
    const last = sorted[sorted.length - 1];
    const [mm, yyyy] = last.mesAno.split('/');
    const lastM = parseInt(mm), lastY = parseInt(yyyy);
    const nextM = lastM === 12 ? 1 : lastM + 1;
    const nextY = lastM === 12 ? lastY + 1 : lastY;
    this.projFirstMes = `${nextY}-${String(nextM).padStart(2, '0')}`;
    this.projFirstLabel = `${MESES[nextM - 1]}/${String(nextY).slice(2)}`;
    this.projLastHistLabel = `${MESES[lastM - 1]}/${String(lastY).slice(2)}`;
    if (this.utilizacaoPorMes.size > 0) {
      const isUtil = (m: { mesAno: string }) =>
        (this.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() === 'utilizado';
      this.prevHistTotal    = Math.round(sorted.filter(m => !isUtil(m)).reduce((s, m) => s + (m.liquido ?? 0), 0) * 100) / 100;
      this.prevUtilizadoTotal = Math.round(sorted.filter(m =>  isUtil(m)).reduce((s, m) => s + (m.liquido ?? 0), 0) * 100) / 100;

      // Rótulo do período utilizado derivado dos dados — nada de "dez/23–ago/25" fixo.
      const utilizados = sorted.filter(isUtil);
      const rotulo = (mesAno: string) => {
        const [mm, yyyy] = mesAno.split('/');
        return `${MESES[parseInt(mm) - 1]}/${yyyy.slice(2)}`;
      };
      this.histPrimeiroUtilizadoLabel = utilizados.length ? rotulo(utilizados[0].mesAno) : '';
      this.histUltimoUtilizadoLabel = utilizados.length ? rotulo(utilizados[utilizados.length - 1].mesAno) : '';
    }
    if (this._rawPrevResults.length) this.computarPrevisao(this._rawPrevResults);
  }

  private computarPrevisao(results: CalcRendResult[]): void {
    this._rawPrevResults = results;
    results = results.filter(r => r.mes >= this.projFirstMes);
    const PROJETOS_KEY = ['Alimenta', 'CAR DPG', 'MDIC', 'Co.NE', 'Op. Básica'];
    // Fallback hardcoded só até o histórico dinâmico (historicoPorProjeto) chegar
    const HIST_ACUM_FB: Record<string, number> = {
      'Alimenta': 345942.81, 'CAR DPG': 64948.71,
      'Op. Básica': 33450.06, 'Co.NE': 22737.13, 'MDIC': 0,
    };
    const histAcumFor = (p: string) => this._histAcumDynamic.get(p) ?? (HIST_ACUM_FB[p] ?? 0);
    const DISPLAY: Record<string, string> = {
      'Alimenta': 'Alimenta +1000 Cidades', 'CAR DPG': 'CAR DPG',
      'MDIC': 'Parceria MDIC', 'Co.NE': 'Co.NE', 'Op. Básica': 'Operação Básica',
    };
    const PROJ_END: Record<string, string> = {
      'Alimenta': '2027-05', 'Co.NE': '2027-01',
      'CAR DPG': '2027-12', 'MDIC': '2027-03', 'Op. Básica': '2028-12',
    };

    const projTotal: Record<string, number> = {};
    const projPorAno: Record<string, Record<number, number>> = {};
    for (const p of PROJETOS_KEY) { projTotal[p] = 0; projPorAno[p] = { 2026: 0, 2027: 0, 2028: 0 }; }
    const bancoPorAno: Record<number, number> = { 2026: 0, 2027: 0, 2028: 0 };

    for (const m of results) {
      const yr = parseInt(m.mes.substring(0, 4));
      const sheetsTotal = this._sheetsRendimentos.get(m.mes);

      if (sheetsTotal !== undefined) {
        // Planilha é a fonte de verdade — total do ano não passa pelo filtro de projetos
        bancoPorAno[yr] = (bancoPorAno[yr] ?? 0) + sheetsTotal;
        // Distribuição por projeto é só para exibição (accordion); usa proj_part do JSON
        for (const p of PROJETOS_KEY) {
          if (m.mes > (PROJ_END[p] ?? '2028-12')) continue;
          const rend = sheetsTotal * (m.proj_part[p] ?? 0);
          projTotal[p] += rend;
          projPorAno[p][yr] = (projPorAno[p][yr] ?? 0) + rend;
        }
      } else {
        // Fallback JSON: tudo derivado do JSON (meses além do alcance da planilha)
        for (const p of PROJETOS_KEY) {
          if (m.mes > (PROJ_END[p] ?? '2028-12')) continue;
          const rend = m.proj_rend[p] ?? 0;
          projTotal[p] += rend;
          projPorAno[p][yr] = (projPorAno[p][yr] ?? 0) + rend;
          bancoPorAno[yr] = (bancoPorAno[yr] ?? 0) + rend;
        }
      }
    }
    const bancoTotal = Object.values(bancoPorAno).reduce((s, v) => s + v, 0);

    this.prevTotais = {
      hist: this.prevHistTotal,
      proj2026: bancoPorAno[2026] ?? 0,
      proj2027: bancoPorAno[2027] ?? 0,
      proj2028: bancoPorAno[2028] ?? 0,
      projTotal: bancoTotal,
      geral: this.prevUtilizadoTotal + this.prevHistTotal + bancoTotal,
    };

    this.previsaoPorProjeto = PROJETOS_KEY
      .map((p, i) => {
        const histAcum = histAcumFor(p);
        const endDate = PROJ_END[p] ?? '2028-12';
        let acumRun = 0;
        const meses = results
          .filter(m => m.mes <= endDate && (
            (m.proj_rend[p] ?? 0) > 0.01 ||
            ((this._sheetsRendimentos.get(m.mes) ?? 0) * (m.proj_part[p] ?? 0)) > 0.01
          ))
          .map(m => {
            const sheetsTotal = this._sheetsRendimentos.get(m.mes);
            const rendMes = Math.round((sheetsTotal !== undefined
              ? sheetsTotal * (m.proj_part[p] ?? 0)
              : (m.proj_rend[p] ?? 0)) * 100) / 100;
            acumRun = Math.round((acumRun + rendMes) * 100) / 100;
            return { mes: m.mes, label: m.label, rendMes,
                     pct: (m.proj_part[p] ?? 0) * 100,
                     saldoFin: Math.round((m.proj_fin[p] ?? 0) * 100) / 100,
                     acumRun } as MesPrevisto;
          });
        const projSum = Math.round(projTotal[p] * 100) / 100;
        return { projeto: DISPLAY[p] ?? p, cor: PALETTE[i % PALETTE.length],
                 histAcum, projTotal: projSum,
                 totalGeral: Math.round((histAcum + projSum) * 100) / 100,
                 meses, aberto: false } as ProjetoPrev;
      })
      .filter(p => p.totalGeral > 0.01)
      .sort((a, b) => b.totalGeral - a.totalGeral);

    this.previsaoCarregada = true;
  }

  private preloadLogo(url: string): Promise<{data: string; w: number; h: number}> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve({ data: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => resolve({ data: '', w: 0, h: 0 });
      img.src = url;
    });
  }

  private addPdfLogos(doc: jsPDF, headerH: number): void {
    const W = doc.internal.pageSize.getWidth();
    const margin = 14;
    const logoH = 9;
    const padX = 4;
    const padV = 3;

    const logos: Array<{data: string; w: number; h: number}> = [];
    if (this.logoIH   && this.logoIHH   > 0) logos.push({ data: this.logoIH,   w: this.logoIHW,   h: this.logoIHH   });
    if (this.logoEnap && this.logoEnapH > 0) logos.push({ data: this.logoEnap, w: this.logoEnapW, h: this.logoEnapH });
    if (logos.length === 0) return;

    const drawWidths = logos.map(l => logoH * (l.w / l.h));
    const totalW = drawWidths.reduce((a, b) => a + b, 0) + (logos.length - 1) * padX + padX * 2;
    const pillH  = logoH + padV * 2;
    const pillX  = W - margin - totalW;
    const pillY  = (headerH - pillH) / 2;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pillX, pillY, totalW, pillH, 2.5, 2.5, 'F');

    let cx = pillX + padX;
    for (let i = 0; i < logos.length; i++) {
      doc.addImage(logos[i].data, 'PNG', cx, pillY + padV, drawWidths[i], logoH);
      cx += drawWidths[i] + padX;
    }
  }

  exportarPdfPrevisao(): void {
    const brl = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
    const pct = (v: number) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = margin;

    const hexToRgb = (hex: string): [number, number, number] => {
      const h = hex.startsWith('#') ? hex : '#6366f1';
      return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    };

    doc.setFillColor(20, 30, 60);
    doc.rect(0, 0, W, 22, 'F');
    this.addPdfLogos(doc, 22);
    doc.setTextColor(255,255,255);
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('Previsão de Rendimentos — Impact Hub + Enap', margin, 10);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.setTextColor(160,180,220);
    doc.text(`Projeção ${this.projFirstLabel.split('/')[0]}/${this.projFirstMes.split('-')[0]}–dez/2028 — Metodologia proporcional`, margin, 16);
    doc.setFontSize(7); doc.setTextColor(120,145,195);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, margin, 21);
    y = 28;

    const totalUtilizado = this.resumo.porMes
      .filter(m => this.isUtilizado(m.mesAno))
      .reduce((sum, m) => sum + m.liquido, 0);

    const boxH = 22;
    doc.setFillColor(245,247,252);
    doc.roundedRect(margin, y, W-margin*2, boxH, 2, 2, 'F');
    doc.setDrawColor(210,215,230);
    doc.setLineWidth(0.2);
    doc.line(margin + 46, y + 4, margin + 46, y + boxH - 4);

    const summaryData = [
      { x: margin + 4,   label: 'UTILIZADO',  sub: 'dez/23–ago/25',                                          val: totalUtilizado,           muted: true  },
      { x: margin + 52,  label: 'DISPONÍVEL', sub: `set/25–${this.projLastHistLabel}`,                        val: this.prevTotais.hist,      muted: false },
      { x: margin + 100, label: 'PROJETADO',  sub: `${this.projFirstLabel}–dez/28`,                           val: this.prevTotais.projTotal, muted: false },
      { x: margin + 148, label: 'TOTAL',      sub: 'disponível + proj.',                                      val: this.prevTotais.geral,    muted: false },
    ];
    for (const col of summaryData) {
      doc.setFontSize(6.5); doc.setFont('helvetica','bold');
      doc.setTextColor(col.muted ? 130 : 80, col.muted ? 130 : 80, col.muted ? 140 : 110);
      doc.text(col.label, col.x, y + 6);
      doc.setFontSize(6); doc.setFont('helvetica','normal');
      doc.setTextColor(150, 150, 165);
      doc.text(col.sub, col.x, y + 10.5);
      doc.setFontSize(9.5); doc.setFont('helvetica','bold');
      doc.setTextColor(col.muted ? 140 : 20, col.muted ? 140 : 20, col.muted ? 150 : 40);
      doc.text(brl(col.val), col.x, y + 18);
    }
    y += boxH + 6;

    for (const p of this.previsaoPorProjeto) {
      if (p.meses.length === 0) continue;
      const [r,g,b] = hexToRgb(p.cor);
      doc.setFillColor(r,g,b); doc.rect(margin, y, 3, 8, 'F');
      doc.setFillColor(248,249,252); doc.rect(margin+3, y, W-margin*2-3, 8, 'F');
      doc.setTextColor(20,20,40); doc.setFontSize(9); doc.setFont('helvetica','bold');
      doc.text(p.projeto, margin+7, y+5.5);
      doc.setTextColor(80,80,110); doc.setFontSize(7.5);
      doc.text(`Hist.: ${brl(p.histAcum)}  |  Proj.: ${brl(p.projTotal)}`, margin+70, y+5.5);
      doc.setTextColor(20,20,40); doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text(brl(p.totalGeral), W-margin, y+5.5, { align: 'right' });
      y += 10;

      const rows = p.meses.map(m => [m.label, pct(m.pct), '+'+brl(m.rendMes), brl(m.acumRun)]);
      rows.push(['Total projetado','','',brl(p.projTotal)]);
      autoTable(doc, {
        startY: y, margin: { left: margin, right: margin },
        head: [['Mês','Participação','Rend. projetado','Acumulado proj.']],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica', textColor: [30,30,50] },
        headStyles: { fillColor: [55,65,81], textColor: [255,255,255], fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold', textColor: [80,80,110] },
          1: { halign: 'right', textColor: [80,80,110], fontStyle: 'bold' },
          2: { halign: 'right', textColor: [80,80,110], fontStyle: 'bold' },
          3: { halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data: any) => {
          if (data.row.index === rows.length - 1) {
            data.cell.styles.fillColor = [240,242,248];
            data.cell.styles.textColor = [50,50,80];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.row.index % 2 === 1) {
            data.cell.styles.fillColor = [250,250,253];
          }
        },
        tableLineColor: [220,225,235], tableLineWidth: 0.2,
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      if (y > 265 && p !== this.previsaoPorProjeto[this.previsaoPorProjeto.length - 1]) {
        doc.addPage(); y = margin;
      }
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(160,160,180); doc.setFont('helvetica','normal');
      doc.text('Impact Hub + Enap — Previsão de Rendimentos', margin, 292);
      doc.text(`Página ${i} de ${pageCount}`, W-margin, 292, { align: 'right' });
    }
    doc.save(`previsao-rendimentos-${new Date().toISOString().slice(0,10)}.pdf`);
  }

  ngOnInit(): void {
    // Teto de espera: se uma das fontes não responder, a página abre com o que
    // tiver em vez de ficar em esqueleto para sempre.
    setTimeout(() => (this.isLoading = false), RendimentosComponent.ESPERA_MAXIMA_MS);

    if (isPlatformBrowser(this.platformId)) {
      this.http.get<{ results: CalcRendResult[] }>('/calc_rendimentos.json').subscribe(data => {
        this._rawPrevResults = data.results ?? [];
        this.computarPrevisao(this._rawPrevResults);
      });

      this.dataService.getOrcamentoRendimentos().subscribe(mapa => {
        this._sheetsRendimentos = mapa;
        if (this._rawPrevResults.length) this.computarPrevisao(this._rawPrevResults);
      });

      this.preloadLogo('/logo-impacthub.png').then(r => { this.logoIH = r.data; this.logoIHW = r.w; this.logoIHH = r.h; });
      this.preloadLogo('/logo-enap.png').then(r => { this.logoEnap = r.data; this.logoEnapW = r.w; this.logoEnapH = r.h; });
    }

    this.dataService.getRendimentoResumo().subscribe((r) => {
      this.resumo = r;
      this.buildChart(r.porMes);
      this.computarPorMesCorrigido();
      this.tryComputarHistorico();
      this.deriveProjectionStart();
    });

    this.dataService.lancamentos$.subscribe((lancs) => {
      this.lancamentosBase = lancs;
      this.aplicarTransferencias();
      this.tryComputarHistorico();
    });

    // Evento institucional (Ofício nº 04/2026). As transferências internas não
    // estão na aba Principal — ela só registra movimento financeiro real — e
    // por isso entram aqui como ajuste de saldo na competência de efeito. Sem
    // isto o rateio do dashboard divergiria do da planilha a partir de ago/26.
    this.dataService.getOficioRendimentos().subscribe(o => {
      this.oficio = o;
      // Resolvido conta como pronto mesmo vindo nulo: sem evento vigente a
      // página não tem por que ficar esperando.
      this.carregado.evento = true;
      // A tabela mensal desconta as utilizações da carteira, que só existem
      // depois que o evento chega — sem recomputar, o saldo do último mês
      // ficaria sem a subtração.
      this.computarPorMesCorrigido();
      this.tryComputarHistorico();
      // O gráfico pode já ter sido montado antes do evento chegar; sem
      // remontar, o marco de 08/2026 só apareceria no primeiro hover.
      if (o && this.resumo.porMes.length) this.buildChart(this.resumo.porMes);
    });
    this.dataService.getTransferenciasRendimentos().subscribe(t => {
      this.transferencias = t;
      this.aplicarTransferencias();
      this.tryComputarHistorico();
    });

    // Quais meses já foram consumidos por um encerramento de ciclo. Vem do
    // bloco J:L da aba, não mais de um rótulo por linha de rendimento.
    this.dataService.getUtilizacaoPorMes().subscribe(mapa => {
      this.utilizacaoPorMes = mapa;
      this.computarPorMesCorrigido();
      this.tryComputarHistorico();
      this.deriveProjectionStart();
    });

    this.dataService.getUtilizacoesComCompetencia().subscribe(u => {
      this.utilizacoes = u;
      this.computarPorMesCorrigido();
    });

    this.dataService.getAvisosRendimentos().subscribe(a => { this.avisosLeitura = a; });

    this.dataService.getSaldos().subscribe(saldos => {
      this.projetosEncerrados.clear();
      saldos.forEach(s => {
        const parts = s.data.split('/');
        if (parts.length === 3) {
          const mc = parseInt(parts[2]) * 100 + parseInt(parts[1]);
          this.projetosEncerrados.set(s.projeto, mc);
        }
      });
      this.tryComputarHistorico();
    });

    this.dataService.getProjetoResumos().subscribe((resumos: any[]) => {
      this.srOutrosProjetos = resumos
        .filter(r => r.projeto !== 'Operação Básica')
        .reduce((acc, r) => acc + (r.saldoRemanescente || 0), 0);
    });

    this.dataService.status$.subscribe(statuses => {
      this.projetosInativos.clear();
      statuses.forEach(s => {
        const st = s.status.toLowerCase();
        if (st === 'finalizado' || st === 'encerrado')
          this.projetosInativos.add(s.projeto);
      });
    });
  }

  /**
   * Calcula a atribuição proporcional de rendimentos por projeto.
   *
   * Metodologia: para cada mês com rendimento, usa o saldo de cada projeto
   * ao INÍCIO daquele mês (= saldo acumulado até o mês anterior) como base.
   * O percentual de participação = saldo_projeto / soma_dos_saldos_positivos.
   * O rendimento líquido do mês é distribuído proporcionalmente.
   * O resultado é exclusivamente informativo.
   */
  abrirDetalhe(mesAno: string): void {
    const cutoff = mesKey(mesAno);

    // Determina se o mês clicado é "disponível" ou "utilizado"
    const isClickedDisponivel = (this.utilizacaoPorMes.get(mesAno) ?? '').toLowerCase().trim() !== 'utilizado';

    // Encontra o primeiro mês "disponível" (ponto de reset do acumulado)
    const allMonthsSorted = [...this.resumo.porMes].sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));
    const firstDispMc = allMonthsSorted.reduce((acc, m) => {
      const isDisp = (this.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado';
      return isDisp && acc === Infinity ? mesKey(m.mesAno) : acc;
    }, Infinity);

    // Ordena lancamentos cronologicamente uma vez
    const lancsSorted = [...this.lancamentosOriginais]
      .filter(l => l.mesAno)
      .sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));

    // Filtra os meses de rendimento pelo mesmo período que porMesCorrigido:
    // - se clicado é "disponível": só meses a partir do primeiro disponível
    // - se clicado é "utilizado": só meses "utilizado"
    const sortedMonths = this.resumo.porMes
      .filter(m => {
        const mc = mesKey(m.mesAno);
        if (mc > cutoff) return false;
        const isDisp = (this.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado';
        return isClickedDisponivel ? mc >= firstDispMc : !isDisp;
      })
      .sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));

    // Saldo corrente por projeto (avança mês a mês)
    const runningBalance = new Map<string, number>();
    const projRendAcum = new Map<string, number>();
    let lIdx = 0;
    let undistributed = 0; // rendimento acumulado de meses sem projetos com saldo positivo

    for (const mes of sortedMonths) {
      const mc = mesKey(mes.mesAno);

      // Incorpora todos os lançamentos até o final deste mês de rendimento
      // (inclui o próprio mês pois o rendimento é apurado no último dia do mês)
      while (lIdx < lancsSorted.length && mesKey(lancsSorted[lIdx].mesAno) <= mc) {
        const l = lancsSorted[lIdx++];
        if (!l.projeto) continue; // ignora créditos de rendimento sem projeto
        runningBalance.set(l.projeto, (runningBalance.get(l.projeto) ?? 0) + l.valor);
      }

      // Zera projetos encerrados e transfere saldo positivo para Operação Básica
      this.projetosEncerrados.forEach((closedMc, proj) => {
        if (mc > closedMc) {
          const bal = runningBalance.get(proj) ?? 0;
          if (bal > 0) runningBalance.set('Operação Básica', (runningBalance.get('Operação Básica') ?? 0) + bal);
          runningBalance.set(proj, 0);
        }
      });

      // Distribui o rendimento líquido do mês proporcionalmente aos saldos positivos.
      // Rendimentos de meses sem projetos com saldo positivo são acumulados e redistribuídos
      // no próximo mês com distribuição possível, garantindo que a soma = total acumulado.
      const totalPos = Array.from(runningBalance.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
      const toDistribute = mes.liquido + undistributed;
      if (totalPos > 0 && toDistribute > 0) {
        runningBalance.forEach((saldo, proj) => {
          if (saldo > 0) {
            projRendAcum.set(proj, (projRendAcum.get(proj) ?? 0) + toDistribute * (saldo / totalPos));
          }
        });
        undistributed = 0;
      } else {
        undistributed += mes.liquido;
      }
    }

    // Consolida rendimento de projetos encerrados/inativos em Operação Básica
    const isInativo = (proj: string) =>
      this.projetosInativos.has(proj) ||
      (this.projetosEncerrados.has(proj) && cutoff >= this.projetosEncerrados.get(proj)!);

    projRendAcum.forEach((rend, proj) => {
      if (proj !== 'Operação Básica' && isInativo(proj)) {
        if (rend > 0)
          projRendAcum.set('Operação Básica', (projRendAcum.get('Operação Básica') ?? 0) + rend);
        projRendAcum.delete(proj);
      }
    });

    // Correção de arredondamento: garante que a soma dos acumulados por projeto
    // seja exatamente igual ao acumulado total exibido no header (evita Δ de R$ 0,01).
    projRendAcum.forEach((rend, proj) => {
      projRendAcum.set(proj, Math.round(rend * 100) / 100);
    });
    const expectedTotal = Math.round(sortedMonths.reduce((s, m) => s + m.liquido, 0) * 100) / 100;
    const actualSum    = Math.round(Array.from(projRendAcum.values()).reduce((s, v) => s + v, 0) * 100) / 100;
    const residuo = Math.round((expectedTotal - actualSum) * 100) / 100;
    if (residuo !== 0) {
      let maxProj = ''; let maxRend = -Infinity;
      projRendAcum.forEach((rend, proj) => { if (rend > maxRend) { maxRend = rend; maxProj = proj; } });
      if (maxProj) projRendAcum.set(maxProj, Math.round((projRendAcum.get(maxProj)! + residuo) * 100) / 100);
    }

    // Saldo de cada projeto ao início do mês clicado (para exibir % de participação atual)
    const saldoBase = new Map<string, number>();
    this.lancamentosOriginais.forEach(l => {
      if (!l.mesAno || !l.projeto || mesKey(l.mesAno) > cutoff) return;
      const closedMc = this.projetosEncerrados.get(l.projeto);
      if (closedMc && cutoff > closedMc) return;
      saldoBase.set(l.projeto, (saldoBase.get(l.projeto) ?? 0) + l.valor);
    });
    if (this.srOutrosProjetos > 0)
      saldoBase.set('Operação Básica', (saldoBase.get('Operação Básica') ?? 0) + this.srOutrosProjetos);
    const totalBase = Array.from(saldoBase.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const mesLiquido = this.resumo.porMes.find(m => m.mesAno === mesAno)?.liquido ?? 0;

    this.detalhesRend = Array.from(projRendAcum.keys())
      .map((projeto, i) => {
        const saldo = saldoBase.get(projeto) ?? 0;
        const pct = totalBase > 0 && saldo > 0 ? saldo / totalBase : 0;
        return {
          projeto,
          pctParticipacao: pct * 100,
          rendimentoMes: mesLiquido * pct,
          rendimentoAcumulado: projRendAcum.get(projeto) ?? 0,
          saldoProjeto: saldo,
          cor: PALETTE[i % PALETTE.length],
        };
      })
      .filter(d => d.rendimentoAcumulado > 0.01)
      .sort((a, b) => b.rendimentoAcumulado - a.rendimentoAcumulado);

    this.mesAnoSelecionado = mesAno;
  }

  fecharDetalhe(): void { this.mesAnoSelecionado = null; }

  toggleProjHist(proj: string): void {
    const p = this.historicoPorProjeto.find(h => h.projeto === proj);
    if (p) p.aberto = !p.aberto;
  }

  private tryComputarHistorico(): void {
    if (this.resumo.porMes.length && this.lancamentosOriginais.length && this.utilizacaoPorMes.size)
      this.computarHistoricoPorProjeto();
    // Avaliar aqui, e não em cada subscribe: toda fonte que muda o cálculo
    // passa por este ponto, e era fácil esquecer de reavaliar em uma delas.
    this.avaliarCarregamento();
  }

  private computarHistoricoPorProjeto(): void {
    // O rateio em si vive em services/rateio-rendimentos.ts — o DataService usa
    // a mesma função para apurar o evento institucional. Aqui fica só o que é
    // apresentação: cor, percentual, série mês a mês e a verificação da soma.
    const rateio = ratearRendimentos({
      porMes: this.resumo.porMes,
      lancamentos: this.lancamentosOriginais,
      utilizacaoPorMes: this.utilizacaoPorMes,
      projetosEncerrados: this.projetosEncerrados,
      projetosInativos: this.projetosInativos,
    });
    if (!rateio) return;
    const dispMonths = rateio.meses;
    const projMesRend = rateio.porProjetoMes;
    const projRendAcum = rateio.acumulado;
    const expectedTotal = rateio.totalEsperado;

    this.historicoPorProjeto = Array.from(projRendAcum.keys())
      .filter(p => (projRendAcum.get(p) ?? 0) > 0.01)
      .sort((a, b) => (projRendAcum.get(b) ?? 0) - (projRendAcum.get(a) ?? 0))
      .map((proj, i) => {
        const mesMap = projMesRend.get(proj) ?? new Map<string, number>();
        let acumRun = 0;
        const meses = dispMonths
          .filter(m => mesMap.has(m.mesAno))
          .map(m => {
            const rendMes = Math.round((mesMap.get(m.mesAno) ?? 0) * 100) / 100;
            acumRun = Math.round((acumRun + rendMes) * 100) / 100;
            return { mesAno: m.mesAno, rendimentoMes: rendMes, rendimentoAcumulado: acumRun,
                     pctParticipacao: m.liquido > 0 ? (rendMes / m.liquido) * 100 : 0 } as MesProjHistorico;
          });
        const doEvento = this.oficio?.projetos.find(x => x.projeto === proj);
        const gerado = projRendAcum.get(proj)!;
        return { projeto: proj, cor: PALETTE[i % PALETTE.length], meses,
                 totalAcumulado: gerado,
                 pctTotal: expectedTotal > 0 ? (gerado / expectedTotal) * 100 : 0,
                 // Sem evento vigente, o saldo livre é o próprio rendimento gerado.
                 saldoLivre: doEvento ? doEvento.saldoLivreAtual : gerado,
                 pctLivre: 0,
                 destinado: doEvento?.destinado ?? 0,
                 aberto: false } as ProjetoHistorico;
      });

    // A seção é lida pelo saldo livre, então a participação também é sobre ele.
    const somaLivre = cent(this.historicoPorProjeto.reduce((s, p) => s + p.saldoLivre, 0));
    this.historicoPorProjeto.forEach(p => {
      p.pctLivre = somaLivre > 0 ? (p.saldoLivre / somaLivre) * 100 : 0;
    });
    this.historicoPorProjeto.sort((a, b) => b.saldoLivre - a.saldoLivre);

    const somaProj = Math.round(this.historicoPorProjeto.reduce((s, p) => s + p.totalAcumulado, 0) * 100) / 100;
    // Duas conferências: o gerado tem de fechar com o líquido do período, e o
    // livre com o saldo livre total do evento.
    const livreEsperado = cent(this.oficio?.saldoLivreTotal ?? expectedTotal);
    this.somaVerificacao = { totalProjetos: somaProj, totalGeral: expectedTotal,
                              bate: Math.abs(somaProj - expectedTotal) < 0.02,
                              somaLivre, livreEsperado,
                              livreBate: Math.abs(somaLivre - livreEsperado) < 0.02 };

    // Atualiza o acumulado histórico por projeto para a seção de previsão
    const HIST_KEY_MAP: Record<string, string> = {
      'Alimenta +1000 Cidades': 'Alimenta', 'CAR DPG': 'CAR DPG',
      'Operação Básica': 'Op. Básica', 'Co.NE': 'Co.NE', 'Parceria MDIC': 'MDIC',
    };
    this._histAcumDynamic.clear();
    this.historicoPorProjeto.forEach(p => {
      const key = HIST_KEY_MAP[p.projeto];
      if (key) this._histAcumDynamic.set(key, p.totalAcumulado);
    });
    // A série mudou — descarta sparklines memoizados sobre a versão anterior.
    this._sparkCache.clear();
    if (this._rawPrevResults.length) this.computarPrevisao(this._rawPrevResults);
  }

  /**
   * Relatório completo de rendimentos em PDF nativo.
   *
   * Reescrito sobre RelatorioPdfService para herdar cabeçalho institucional,
   * cabeçalho de tabela repetido a cada quebra, paginação "X de Y" e notas de
   * metodologia. Os totais vêm de `resumo`, já consolidado — sem recálculo
   * paralelo, que era o risco estrutural do achado F-12.
   */
  async exportarPdfCompleto(): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const R = this.relatorioPdf;

    const [logoIH, logoEnap] = await Promise.all([
      R.carregarImagem('/logo-impacthub.png'),
      R.carregarImagem('/logo-enap.png'),
    ]);

    const periodo = this.periodoUtilizadoLabel
      ? `${this.histPrimeiroUtilizadoLabel} a ${this.projLastHistLabel} (realizado) · ` +
        `${this.projFirstLabel} a dez/28 (projetado)`
      : 'Todo o período';

    const cab: CabecalhoRelatorio = {
      titulo: 'Rendimentos financeiros',
      subtitulo: 'Parceria Impact Hub Brasil e Enap — Estratégia de Inovação Aberta da Enap',
      periodo,
      logoIH, logoEnap,
    };

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = R.desenharCabecalho(doc, cab, true);

    // ── Composição do saldo ────────────────────────────────────────────
    y = R.secao(doc, y, 'Composição do saldo', cab);
    y = R.kpis(doc, y, [
      { rotulo: 'Rendimento bruto', valor: R.brl(this.resumo.totalBruto), base: 'créditos de aplicação' },
      { rotulo: 'Impostos retidos', valor: R.brl(this.resumo.totalImpostos), base: 'IOF e IR' },
      { rotulo: 'Rendimento líquido', valor: R.brl(this.resumo.saldoLiquido), base: 'bruto - impostos' },
    ], cab);
    const c = this.composicao;
    y = R.kpis(doc, y, [
      { rotulo: 'Utilizado e destinado', valor: R.brl(c.utilizado), base: 'já aplicado ou reservado a uma finalidade' },
      { rotulo: 'Disponível para novas destinações', valor: R.brl(c.disponivel), base: 'líquido - utilizado e destinado' },
    ], cab);

    if (c.itens.length) {
      y = R.tabela(doc, y, [
        { titulo: 'Utilização / destinação', chave: 'proj', largura: 90 },
        { titulo: 'Competência', chave: 'per', largura: 40 },
        { titulo: 'Valor', chave: 'val', largura: 44, alinhamento: 'right' },
      ], c.itens.map(i => ({ proj: i.rotulo, per: i.periodo, val: R.brl(i.valor) })), cab,
        { proj: 'Total', per: '', val: R.brl(c.utilizado) });
    }

    y = R.nota(doc, y,
      'Utilizado e destinado reúne o que já foi aplicado e o que está reservado a uma finalidade — ' +
      'não é o total de pagamentos. A cobertura da Operação Básica foi paga no Transferegov como ' +
      'premiações do Impulso Regional: a Operação Básica havia consumido saldo daquele projeto, e o ' +
      'pagamento das premiações com rendimentos compensou essa utilização anterior, concentrando o uso ' +
      'de rendimentos numa única categoria. Depois de destinado, o saldo passa a ser executado pelo ' +
      'projeto de destino: as despesas reduzem o saldo do projeto, não o disponível para novas ' +
      'destinações. Destinação formal: complementação da Meta 2, conforme o Plano de Trabalho, ' +
      'mediante autorização da Enap e vinculação ao objeto do Termo de Colaboração.', cab);

    // ── Detalhamento mensal ────────────────────────────────────────────
    if (this.porMesCorrigido.length) {
      y = R.secao(doc, y, 'Detalhamento mensal', cab);
      const tb = this.porMesCorrigido.reduce((s, m) => s + m.bruto, 0);
      const ti = this.porMesCorrigido.reduce((s, m) => s + m.imposto, 0);
      const tu = this.porMesCorrigido.reduce((s, m) => s + m.utilizadoNoMes, 0);
      // Mesmas colunas da tela: a utilização é valor na linha, não rótulo.
      y = R.tabela(doc, y,
        [
          { titulo: 'Mês/ano', chave: 'mes', largura: 20 },
          { titulo: 'Rendimento bruto', chave: 'bruto', largura: 30, alinhamento: 'right' },
          { titulo: 'Impostos', chave: 'imp', largura: 27, alinhamento: 'right' },
          { titulo: 'Rendimento líquido', chave: 'liq', largura: 30, alinhamento: 'right' },
          { titulo: 'Utilizado no mês', chave: 'uso', largura: 29, alinhamento: 'right' },
          { titulo: 'Saldo disponível acumulado', chave: 'saldo', largura: 38, alinhamento: 'right' },
        ],
        this.porMesCorrigido.map(m => ({
          mes: m.mesAno,
          bruto: R.brl(m.bruto),
          imp: R.brl(m.imposto),
          liq: R.brl(m.liquido),
          uso: m.utilizadoNoMes > 0 ? `-${R.brl(m.utilizadoNoMes)}` : '—',
          saldo: R.brl(m.acumulado),
        })),
        cab,
        { mes: 'Total', bruto: R.brl(tb), imp: R.brl(ti), liq: R.brl(tb + ti),
          uso: `-${R.brl(tu)}`, saldo: R.brl(c.disponivel) });

      y = R.nota(doc, y,
        'Saldo disponível acumulado = rendimento líquido acumulado menos o que já foi utilizado. ' +
        'As linhas com valor em "utilizado no mês" são as utilizações de rendimentos: o saldo cai ' +
        'porque foi subtraído, não porque a série recomeça.', cab);
    }

    // ── Evento institucional ───────────────────────────────────────────
    // Depois do detalhamento mensal: o leitor já viu a série e agora entende
    // por que o saldo livre muda de patamar na competência de efeito.
    y = R.eventosInstitucionais(doc, y, cab, this.oficio);

    // ── Atribuição por projeto ─────────────────────────────────────────
    if (this.historicoPorProjeto.length) {
      y = R.secao(doc, y, 'Saldo livre por projeto', cab);
      // Gerado e livre lado a lado: o histórico não muda, o que muda é quanto
      // dele continua livre depois do que foi destinado.
      y = R.tabela(doc, y,
        [
          { titulo: 'Projeto', chave: 'proj', largura: 52 },
          { titulo: 'Rendimento gerado', chave: 'ger', largura: 32, alinhamento: 'right' },
          { titulo: 'Destinado', chave: 'dest', largura: 30, alinhamento: 'right' },
          { titulo: 'Saldo livre', chave: 'livre', largura: 32, alinhamento: 'right' },
          { titulo: '% do livre', chave: 'pct', largura: 28, alinhamento: 'right' },
        ],
        this.historicoPorProjeto.map(p => ({
          proj: p.projeto,
          ger: R.brl(p.totalAcumulado),
          dest: p.destinado > 0 ? R.brl(p.destinado) : '—',
          livre: R.brl(p.saldoLivre),
          pct: `${p.pctLivre.toFixed(1)}%`,
        })),
        cab,
        { proj: 'Total', ger: R.brl(this.somaVerificacao.totalProjetos),
          dest: R.brl(this.oficio?.totalDestinado ?? 0),
          livre: R.brl(this.somaVerificacao.somaLivre), pct: '100,0%' });

      y = R.nota(doc, y,
        'Metodologia: atribuição proporcional ao saldo base de cada projeto no início de cada ' +
        'mês. Rendimento gerado é o histórico do projeto, que não muda; saldo livre é o que dele ' +
        'segue disponível sem destinação específica. O resíduo de arredondamento é lançado no ' +
        'projeto de maior rendimento para que a soma das partes reconcilie com o total.', cab);
    }

    // ── Projeção ───────────────────────────────────────────────────────
    if (this.previsaoCarregada) {
      y = R.secao(doc, y, 'Projeção de rendimentos', cab);
      y = R.kpis(doc, y, [
        { rotulo: `Projeção ${this.projFirstLabel}–dez/26`, valor: R.brl(this.prevTotais.proj2026), base: 'estimativa' },
        { rotulo: 'Projeção 2027', valor: R.brl(this.prevTotais.proj2027), base: 'estimativa' },
        { rotulo: 'Projeção 2028', valor: R.brl(this.prevTotais.proj2028), base: 'estimativa' },
      ], cab);

      y = R.nota(doc, y,
        'Premissas: total mensal conforme a planilha de orçamento vigente, rateado entre os ' +
        'projetos na proporção do saldo base, respeitando a data de encerramento de cada um. ' +
        'Valores projetados são estimativa e não devem ser somados ao saldo disponível sem ' +
        'essa ressalva.', cab, 'atencao');
    }

    R.desenharRodapes(doc);
    doc.save(`relatorio-completo-rendimentos-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  exportarPdf(): void {
    const brl = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
    const pct = (v: number) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = margin;

    const hexToRgb = (hex: string): [number, number, number] => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b];
    };

    // ── Cabeçalho ──
    doc.setFillColor(30, 30, 50);
    doc.rect(0, 0, W, 22, 'F');
    this.addPdfLogos(doc, 22);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Rendimento por Projeto — Impact Hub + Enap', margin, 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 210);
    // Período derivado da série, não fixo no código: o texto antigo ainda dizia
    // "set/2025 a jun/2026" depois de a base já ter avançado dois meses.
    doc.text(`Histórico mensal — período disponível (${this.periodoHistoricoLabel})`, margin, 16);
    const dataGer = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.setFontSize(7); doc.setTextColor(140, 150, 185);
    doc.text(`Gerado em ${dataGer}`, margin, 21);
    y = 30;

    // ── Sumário ──
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, y, W - margin * 2, 16, 2, 2, 'F');
    doc.setTextColor(100, 100, 120);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL RENDIMENTOS', margin + 4, y + 5);
    doc.text('SOMA DOS PROJETOS', margin + 60, y + 5);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 40);
    doc.text(brl(this.somaVerificacao.totalGeral), margin + 4, y + 12);
    doc.text(brl(this.somaVerificacao.totalProjetos), margin + 60, y + 12);
    y += 22;

    y = this.desenharEventoInstitucional(doc, y, W, margin, brl);

    // ── Tabela por projeto ──
    for (const p of this.historicoPorProjeto) {
      const [r, g, b] = hexToRgb(p.cor.startsWith('#') ? p.cor : '#6366f1');

      // cabeçalho do projeto
      doc.setFillColor(r, g, b);
      doc.rect(margin, y, 3, 8, 'F');
      doc.setFillColor(r + 20 > 255 ? 255 : r + 20, g + 20 > 255 ? 255 : g + 20, b + 20 > 255 ? 255 : b + 20, 0.08);
      doc.setFillColor(248, 249, 252);
      doc.rect(margin + 3, y, W - margin * 2 - 3, 8, 'F');
      doc.setTextColor(20, 20, 40);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(p.projeto, margin + 7, y + 5.5);
      doc.setTextColor(80, 80, 110);
      doc.setFontSize(8);
      doc.text(pct(p.pctTotal) + ' do total', margin + 80, y + 5.5);
      doc.setTextColor(20, 20, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(brl(p.totalAcumulado), W - margin, y + 5.5, { align: 'right' });
      y += 10;

      // tabela mensal
      const rows = p.meses.map(m => [
        m.mesAno,
        pct(m.pctParticipacao),
        '+' + brl(m.rendimentoMes),
        brl(m.rendimentoAcumulado),
      ]);
      rows.push(['Total acumulado', '', '', brl(p.totalAcumulado)]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Mês', 'Participação', 'Rend. do mês', 'Acumulado']],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica', textColor: [30, 30, 50] },
        headStyles: {
          fillColor: [55, 65, 81],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
        },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold', textColor: [80, 80, 110] },
          1: { halign: 'right', textColor: [80, 80, 110], fontStyle: 'bold' },
          2: { halign: 'right', textColor: [80, 80, 110], fontStyle: 'bold' },
          3: { halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data: any) => {
          const isTotal = data.row.index === rows.length - 1;
          if (isTotal) {
            data.cell.styles.fillColor = [240, 242, 248];
            data.cell.styles.textColor = [50, 50, 80];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.row.index % 2 === 1) {
            data.cell.styles.fillColor = [250, 250, 253];
          }
        },
        tableLineColor: [220, 225, 235],
        tableLineWidth: 0.2,
      });

      y = (doc as any).lastAutoTable.finalY + 8;

      if (y > 265 && p !== this.historicoPorProjeto[this.historicoPorProjeto.length - 1]) {
        doc.addPage();
        y = margin;
      }
    }

    // ── Rodapé ──
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 180);
      doc.setFont('helvetica', 'normal');
      doc.text('Impact Hub + Enap — Estratégia de Inovação Aberta', margin, 292);
      doc.text(`Página ${i} de ${pageCount}`, W - margin, 292, { align: 'right' });
    }

    doc.save(`rendimentos-por-projeto-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  /** Primeiro e último mês da série rateada, para o subtítulo do relatório. */
  private get periodoHistoricoLabel(): string {
    const meses = this.porMesCorrigido.length ? this.porMesCorrigido : this.resumo.porMes;
    if (!meses.length) return 'sem período';
    const ord = [...meses].sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));
    return `${ord[0].mesAno} a ${ord[ord.length - 1].mesAno}`;
  }

  /**
   * Bloco compacto do evento institucional no relatório por projeto.
   *
   * Esse PDF tem layout próprio (autoTable), e não o do RelatorioPdfService —
   * por isso a seção é desenhada aqui, no mesmo idioma visual do arquivo, em
   * vez de importar um cabeçalho que brigaria com o dele. O pagamento entra
   * como vínculo, nunca como despesa: ele já está no quadro de despesas.
   */
  private desenharEventoInstitucional(
    doc: jsPDF, y: number, W: number, margin: number, brl: (v: number) => string,
  ): number {
    const o = this.oficio;
    if (!o || !o.movimentacoes.length) return y;

    const mesAno = (c: string) => {
      const [a, m] = String(c).split('-');
      return m ? `${m}/${a}` : c;
    };

    doc.setTextColor(20, 20, 40);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Eventos institucionais no período', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Documento', 'Data-base', 'Compet.', 'Tipo', 'Origem', 'Destino', 'Valor', 'Finalidade']],
      body: o.movimentacoes.map(m => [
        m.documento, m.dataBase, mesAno(m.competencia), m.tipo, m.origem, m.destino,
        brl(m.valor), m.finalidade + (m.numeroPagamento ? ` · pagto ${m.numeroPagamento}` : ''),
      ]),
      styles: { fontSize: 6.8, cellPadding: 2, font: 'helvetica', textColor: [30, 30, 50] },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: { 6: { halign: 'right', fontStyle: 'bold' } },
      tableLineColor: [220, 225, 235],
      tableLineWidth: 0.2,
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(110, 110, 135);
    const nota =
      `Carteira destinada ${brl(o.totalDestinado)} · utilizado ${brl(o.utilizado)} · ` +
      `disponível ${brl(o.disponivel)}. Transferência interna entre projetos do mesmo instrumento: ` +
      `não é receita nem despesa e soma zero no consolidado. O pagamento vinculado já consta no ` +
      `quadro de despesas pela aba Principal e não é lançado novamente aqui.`;
    const linhas = doc.splitTextToSize(nota, W - margin * 2) as string[];
    linhas.forEach((l, i) => doc.text(l, margin, y + i * 3.2));
    return y + linhas.length * 3.2 + 6;
  }

  /**
   * Série mensal com a conta de verdade: saldo disponível = acumulado − utilizado.
   *
   * A versão anterior zerava o acumulado no primeiro mês disponível e mostrava
   * uma coluna "Utilização" só classificatória — o zero aparecia sem que nada
   * na linha explicasse de onde ele vinha. Agora a utilização é um valor na
   * própria linha, e o saldo cai porque foi subtraído, não porque a série
   * recomeçou. O histórico dos meses não muda: só ganha a coluna que faltava.
   */
  private computarPorMesCorrigido(): void {
    if (this.resumo.porMes.length === 0) return;
    const utilizacoes = this.utilizacoesPorMes();

    let saldo = 0;
    this.porMesCorrigido = this.resumo.porMes.map(m => {
      saldo = cent(saldo + m.liquido);
      const u = utilizacoes.get(m.mesAno);
      const utilizadoNoMes = u?.valor ?? 0;
      saldo = cent(saldo - utilizadoNoMes);
      return {
        ...m,
        acumulado: saldo,
        utilizadoNoMes,
        rotuloUtilizacao: u?.rotulo ?? '',
        detalheUtilizacao: u?.detalhe ?? '',
      };
    });
  }

  /**
   * Mês a mês, quanto de rendimento foi efetivamente pago.
   *
   * Duas origens, que nunca se sobrepõem:
   *
   *   - o primeiro ciclo, encerrado quando o saldo acumulado até então foi
   *     aplicado na complementação da Meta 2. A aba de Rendimentos marca os
   *     meses consumidos; a saída é lançada no último deles;
   *   - as utilizações da carteira destinada, cada uma na sua competência.
   *
   * Uma utilização com competência posterior ao último mês apurado aparece no
   * último mês da série — senão sumiria da tabela, e com ela o saldo deixaria
   * de fechar. O texto de apoio informa a data real do pagamento.
   */
  /**
   * Mês a mês, quanto de rendimento saiu do saldo disponível.
   *
   * Vem do bloco J:L da aba: ano, valor e projeto. A competência exata é
   * recuperada pelo DataService a partir dos registros existentes — nunca
   * inventada. Sem competência, a saída não entra na série mensal (apareceria
   * num mês arbitrário) e um aviso de leitura é exibido na página.
   *
   * O pagamento de uma destinação já registrada NÃO entra aqui: o valor
   * integral saiu do disponível quando foi destinado, e a despesa passa a
   * consumir o saldo do projeto de destino. Contá-lo de novo seria subtrair
   * duas vezes o mesmo dinheiro.
   */
  private utilizacoesPorMes(): Map<string, { valor: number; rotulo: string; detalhe: string }> {
    const mapa = new Map<string, { valor: number; rotulo: string; detalhe: string }>();

    this.utilizacoes.forEach(u => {
      if (!u.competencia) return;
      const rotulo = u.valor === this.encerramentoDeCiclo(u) ? 'Encerramento de ciclo' : 'Destinação de rendimentos';
      const detalhe = u.valor === this.encerramentoDeCiclo(u)
        ? `Todo o rendimento acumulado até ${u.competencia} foi aplicado em ${u.projeto}. ` +
          `A acumulação recomeça na competência seguinte.`
        : `Destinado a ${u.projeto} em ${u.competencia}. A partir daqui as despesas ` +
          `consomem o saldo do projeto, não o rendimento disponível.`;
      const atual = mapa.get(u.competencia);
      mapa.set(u.competencia, atual
        ? { valor: cent(atual.valor + u.valor), rotulo: atual.rotulo, detalhe: `${atual.detalhe} · ${detalhe}` }
        : { valor: cent(u.valor), rotulo, detalhe });
    });

    return mapa;
  }

  /** Valor que a utilização teria se tivesse consumido todo o acumulado até a competência. */
  private encerramentoDeCiclo(u: UtilizacaoRendimento): number {
    if (!u.competencia) return NaN;
    const corte = mesKey(u.competencia);
    return cent(this.resumo.porMes
      .filter(m => mesKey(m.mesAno) <= corte)
      .reduce((s, m) => s + m.liquido, 0));
  }

  /**
   * Composição do saldo líquido, em dois níveis.
   *
   * Utilizado e disponível repartem o líquido total; dentro do disponível, o
   * que está destinado e o que segue livre. O destinado NÃO é uma carteira
   * paralela a somar ao saldo dos projetos — é uma subdivisão do disponível, e
   * somá-lo de novo contaria o mesmo dinheiro duas vezes.
   */
  get composicao() {
    const liquido = cent(this.resumo.saldoLiquido);
    const utilizado = cent(this.resumo.totalUtilizado);
    const disponivel = cent(liquido - utilizado);
    const pct = (v: number) => (liquido > 0 ? (v / liquido) * 100 : 0);
    return {
      liquido, utilizado, disponivel,
      pctUtilizado: pct(utilizado),
      pctDisponivel: pct(disponivel),
      /** Cada utilização/destinação, para o detalhamento do bloco "utilizado". */
      itens: this.utilizacoes
        .map(u => ({
          rotulo: u.projeto,
          valor: u.valor,
          periodo: u.competencia ?? String(u.ano),
        }))
        .sort((a, b) => b.valor - a.valor),
    };
  }

  pctBarRend(valor: number): number {
    return (valor / this.maxRendAcum) * 100;
  }

  private buildChart(porMes: typeof this.resumo.porMes): void {
    this.chartReady = false;
    setTimeout(() => {
      const base = porMes.length > 0 ? porMes[0].acumulado : 0;
      const acumuladoNorm = porMes.map((m) => m.acumulado - base);
      this.barChartData = {
        labels: porMes.map((m) => m.mesAno),
        datasets: [
          // Rótulos explícitos: o tooltip precisa deixar claro que a barra é o
          // rendimento GERADO no mês e a linha é o acumulado — nenhum dos dois
          // é "saldo livre", que só o rodapé do evento informa.
          { type: "bar", label: "Rendimento gerado (bruto)", data: porMes.map((m) => m.bruto), backgroundColor: "rgba(16,185,129,0.45)", borderColor: "#10b981", borderWidth: 1, borderRadius: 4, yAxisID: "y" },
          { type: "bar", label: "IOF / IR", data: porMes.map((m) => m.imposto), backgroundColor: "rgba(239,68,68,0.4)", borderColor: "#ef4444", borderWidth: 1, borderRadius: 4, yAxisID: "y" },
          { type: "line", label: "Rendimento líquido acumulado", data: acumuladoNorm, borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 2, pointBackgroundColor: "#6366f1", pointRadius: 3, pointHoverRadius: 5, fill: true, tension: 0.4, yAxisID: "y" } as any,
        ],
      };
      this.chartReady = true;
    }, 50);
  }

  get pctUtilizado(): number {
    return this.resumo.saldoLiquido > 0 ? (this.resumo.totalUtilizado / this.resumo.saldoLiquido) * 100 : 0;
  }
  get pctDisponivel(): number { return 100 - this.pctUtilizado; }
}
