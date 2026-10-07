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
import { ActivatedRoute, Router } from "@angular/router";
import { DataService } from "../../services/data.service";
import { ThemeService } from "../../services/theme.service";
import { ProjetoResumo, Lancamento } from "../../models/lancamento.model";
import { DragScrollDirective } from "../../directives/drag-scroll.directive";
import { effect } from "@angular/core";

Chart.register(...registerables);

interface ProdutoAlimenta {
  codigo: string;
  nome: string;
  meta: string;
  orcamento: number;
  inicio: string;
  fim: string;
}

interface ProdutoExecucao extends ProdutoAlimenta {
  realizado: number;
  percentual: number;
}

interface CategoriaAlimenta {
  nome: string;
  valor: number;
  percentual: number;
  cor: string;
}

interface MetaGrupo {
  id: string;            // ex: "META 1"
  titulo: string;        // ex: "Trilha de Implementação"
  produtos: ProdutoExecucao[];
  orcamento: number;
  realizado: number;
  percentual: number;
  inicio: string;
  fim: string;
  expandido: boolean;
}

const MES_NUM: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAIO: 5, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

function parseMesAno(s: string): number {
  const [m, a] = (s || "").split("/");
  return parseInt(a || "0") * 100 + (MES_NUM[(m || "").toUpperCase()] || 0);
}

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
    DragScrollDirective,
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
  produtosAlimenta: ProdutoExecucao[] = [];
  metasAlimenta: MetaGrupo[] = [];
  alimentaTotais = { orcamento: 0, realizado: 0, percentual: 0 };
  categoriasAlimenta: CategoriaAlimenta[] = [];
  totalGastoAlimenta = 0;
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
        borderColor: "rgba(255, 255, 255, 0.1)",
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
  metasExpandido = false;
  categoriasExpandido = false;
  stats = { ativos: 0, execucaoMedia: 0 };
  saldosOpBasica = 0;
  totalSaldosRemanescentes = 0;
  previstosPorProjeto = new Map<string, number>();

  chartReady = false;
  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#1f2937",
          font: { weight: 'bold' },
          filter: (item: any, data: any) => {
            // Show each label only once; hide "Previsto" if all values are zero
            const firstIdx = data.datasets.findIndex((d: any) => d.label === item.text);
            if (firstIdx !== item.datasetIndex) return false;
            if (item.text === "Previsto") {
              const ds = data.datasets[item.datasetIndex];
              return (ds.data as number[]).some((v: number) => v > 0);
            }
            return true;
          }
        }
      },
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

  constructor(
    private dataService: DataService,
    private themeService: ThemeService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
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
      saldos: this.dataService.getSaldosResgatadosOperacaoBasica(),
      previstos: this.dataService.getPrevistosPorProjeto(),
    }).subscribe(({ p, saldos, previstos }) => {
      this.saldosOpBasica = saldos;
      this.previstosPorProjeto = previstos;
      this.projetos = p;
      this.projetosLista = p.map((x) => x.projeto);
      this.statusLista = Array.from(new Set(p.map((x) => x.status || "Ativo"))).sort();
      this.totalSaldosRemanescentes = p.reduce((acc, curr) => acc + (curr.saldoRemanescente || 0), 0);
      this.stats = {
        ativos: p.filter(x => x.status && x.status.toLowerCase() !== "finalizado").length,
        execucaoMedia: p.length > 0 ? p.reduce((acc, curr) => acc + curr.execucao, 0) / p.length : 0,
      };

      // Aguarda dados chegarem para então ler e aplicar filtros vindos da URL
      if (p.length > 0) {
        this.lerFiltrosDaURL();
        this.aplicarFiltro();
        setTimeout(() => { this.isLoading = false; }, 1500);
      }
    });

    // Reage a mudanças manuais na URL (paste do link, voltar/avançar)
    this.route.queryParamMap.subscribe(() => {
      if (this.projetos.length > 0) {
        const mudou = this.lerFiltrosDaURL();
        if (mudou) this.aplicarFiltro();
      }
    });
  }

  private slugify(texto: string): string {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s-]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private lerFiltrosDaURL(): boolean {
    const params = this.route.snapshot.queryParamMap;
    const projetoSlug = params.get("projeto") || "";
    const statusSlug = params.get("status") || "";

    const novoProjeto = projetoSlug
      ? (this.projetosLista.find((p) => this.slugify(p) === projetoSlug) || "")
      : "";
    const novoStatus = statusSlug
      ? (this.statusLista.find((s) => this.slugify(s) === statusSlug) || "")
      : "";

    const mudou =
      novoProjeto !== this.projetoSelecionado ||
      novoStatus !== this.statusSelecionado;
    this.projetoSelecionado = novoProjeto;
    this.statusSelecionado = novoStatus;
    return mudou;
  }

  private atualizarURL(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        projeto: this.projetoSelecionado ? this.slugify(this.projetoSelecionado) : null,
        status: this.statusSelecionado ? this.slugify(this.statusSelecionado) : null,
      },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  onFiltroChange(): void {
    this.aplicarFiltro();
    this.atualizarURL();
  }

  setProjeto(p: string): void {
    this.projetoSelecionado = p;
    if (p) this.statusSelecionado = "";
    this.onFiltroChange();
  }

  setStatus(s: string): void {
    this.statusSelecionado = s;
    this.onFiltroChange();
  }

  get hasFiltro(): boolean {
    return !!this.projetoSelecionado || !!this.statusSelecionado;
  }

  getProjetoIniciais(nome: string): string {
    if (!nome) return "";
    const palavras = nome
      .replace(/[+]/g, "")
      .split(/\s+/)
      .filter((p) => p.length > 1 || /[A-ZÀ-Ý]/.test(p));
    if (palavras.length === 1) return palavras[0].substring(0, 2).toUpperCase();
    return (palavras[0][0] + palavras[1][0]).toUpperCase();
  }

  getProjetoGradient(nome: string): string {
    const paletas = [
      ["#10b981", "#059669"],
      ["#3b82f6", "#1d4ed8"],
      ["#8b5cf6", "#6d28d9"],
      ["#f59e0b", "#b45309"],
      ["#ec4899", "#be185d"],
      ["#14b8a6", "#0f766e"],
      ["#6366f1", "#4338ca"],
      ["#f97316", "#c2410c"],
    ];
    let hash = 0;
    for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
    const [a, b] = paletas[hash % paletas.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
  }

  /**
   * Numerador e denominador da execução, em texto, para o `title` da célula.
   *
   * O percentual sozinho não deixa conferir, e foi justamente a base invisível
   * que pôs a Plataforma Desafio 3.0 em 108%: as despesas pagas com rendimento
   * destinado contavam no numerador sem o recurso correspondente embaixo.
   */
  baseExecucao(p: ProjetoResumo): string {
    const brl = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const base = p.rendimentosDestinados
      ? `${brl(p.entradas)} (${brl(p.recursoTermo)} do Termo + ${brl(p.rendimentosDestinados)} de rendimentos destinados)`
      : brl(p.entradas);
    return `${brl(p.saidas)} executados sobre ${base}`;
  }

  private aplicarFiltro(): void {
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
          this.calcularExecucaoProdutos(l);
        });
    } else {
      this.lancamentosAlimenta = [];
      this.produtosAlimenta = [];
      this.metasAlimenta = [];
      this.alimentaTotais = { orcamento: 0, realizado: 0, percentual: 0 };
      this.categoriasAlimenta = [];
      this.totalGastoAlimenta = 0;
      this.donutChartData = { labels: [], datasets: [] };
    }
  }

  toggleMeta(meta: MetaGrupo): void {
    meta.expandido = !meta.expandido;
  }

  private calcularExecucaoProdutos(lancs: Lancamento[]): void {
    const realizadoPorCodigo = new Map<string, number>();
    lancs.forEach((l) => {
      if (l.valor >= 0) return;
      const match = (l.observacao || "").match(/^(\d+\.\d+)/);
      if (!match) return;
      const codigo = match[1];
      realizadoPorCodigo.set(codigo, (realizadoPorCodigo.get(codigo) || 0) + Math.abs(l.valor));
    });

    this.produtosAlimenta = ALIMENTA_PRODUTOS.map((p) => {
      const realizado = realizadoPorCodigo.get(p.codigo) || 0;
      const percentual = p.orcamento > 0 ? (realizado / p.orcamento) * 100 : 0;
      return { ...p, realizado, percentual };
    });

    const orc = this.produtosAlimenta.reduce((s, p) => s + p.orcamento, 0);
    const real = this.produtosAlimenta.reduce((s, p) => s + p.realizado, 0);
    this.alimentaTotais = {
      orcamento: orc,
      realizado: real,
      percentual: orc > 0 ? (real / orc) * 100 : 0,
    };

    // Agrupa por META preservando a ordem natural dos códigos
    const grupos = new Map<string, MetaGrupo>();
    this.produtosAlimenta.forEach((p) => {
      const [idRaw, tituloRaw] = p.meta.split("—");
      const id = (idRaw || "").trim();
      const titulo = (tituloRaw || "").trim();
      if (!grupos.has(id)) {
        grupos.set(id, {
          id, titulo, produtos: [], orcamento: 0, realizado: 0, percentual: 0,
          inicio: p.inicio, fim: p.fim, expandido: false,
        });
      }
      const g = grupos.get(id)!;
      g.produtos.push(p);
      g.orcamento += p.orcamento;
      g.realizado += p.realizado;
    });

    grupos.forEach((g) => {
      g.percentual = g.orcamento > 0 ? (g.realizado / g.orcamento) * 100 : 0;
      g.inicio = g.produtos.reduce(
        (min, p) => (parseMesAno(p.inicio) < parseMesAno(min) ? p.inicio : min),
        g.produtos[0].inicio,
      );
      g.fim = g.produtos.reduce(
        (max, p) => (parseMesAno(p.fim) > parseMesAno(max) ? p.fim : max),
        g.produtos[0].fim,
      );
    });

    // Mantém metas previamente expandidas após recálculo
    const expandidasAntes = new Set(this.metasAlimenta.filter((m) => m.expandido).map((m) => m.id));
    this.metasAlimenta = Array.from(grupos.values()).map((g) => ({
      ...g,
      expandido: expandidasAntes.has(g.id),
    }));

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
    const palette = [
      "#10b981", "#34d399", "#0ea5e9", "#6366f1", "#8b5cf6",
      "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#14b8a6",
      "#84cc16", "#a855f7",
    ];

    this.categoriasAlimenta = sorted.map(([nome, valor], i) => ({
      nome,
      valor,
      percentual: total > 0 ? (valor / total) * 100 : 0,
      cor: palette[i % palette.length],
    }));
    this.totalGastoAlimenta = total;

    this.donutChartData = {
      labels: this.categoriasAlimenta.map((c) => c.nome),
      datasets: [
        {
          data: this.categoriasAlimenta.map((c) => c.valor),
          backgroundColor: this.categoriasAlimenta.map((c) => c.cor),
          borderColor: "transparent",
          borderWidth: 2,
          hoverOffset: 8,
        } as any,
      ],
    };
  }

  private buildChart(p: ProjetoResumo[]): void {
    this.chartReady = false;
    setTimeout(() => {
      // Ativos primeiro, demais depois — mantendo ordem por entradas dentro de cada grupo
      const isAtivo = (x: ProjetoResumo) =>
        !x.status || (x.status.toLowerCase() !== "finalizado" && x.status.toLowerCase() !== "encerrado");
      const sorted = [
        ...p.filter(isAtivo).sort((a, b) => b.entradas - a.entradas),
        ...p.filter(x => !isAtivo(x)).sort((a, b) => b.entradas - a.entradas),
      ];

      // Total de saldos que saíram dos projetos e foram para Operação Básica
      const totalSaldosParaOpBasica = sorted
        .filter(x => x.projeto !== "Operação Básica")
        .reduce((acc, x) => acc + (x.saldoRemanescente || 0), 0);

      this.barChartData = {
        labels: sorted.map((x) => x.projeto),
        datasets: [
          {
            label: "Receitas",
            data: sorted.map(x => x.entradas),
            backgroundColor: "#10b981",
            borderRadius: 4,
            stack: "Stack 0",
          },
          {
            // Só aparece na linha de Operação Básica: soma de todos os saldos recebidos
            label: "Saldo Remanescente",
            data: sorted.map(x => x.projeto === "Operação Básica" ? totalSaldosParaOpBasica : 0),
            backgroundColor: "#065f46",
            borderRadius: 4,
            stack: "Stack 0",
          },
          {
            // Valores previstos por projeto (aparecem na mesma barra de receitas, mais claros)
            label: "Previsto",
            data: sorted.map(x => this.previstosPorProjeto.get(x.projeto) || 0),
            backgroundColor: "rgba(16,185,129,0.25)",
            borderColor: "#10b981",
            borderWidth: 1,
            borderRadius: 4,
            borderDash: [4, 3],
            stack: "Stack 0",
          } as any,
          {
            label: "Despesas",
            data: sorted.map(x => x.saidas),
            backgroundColor: "#6366f1",
            borderRadius: 4,
            stack: "Stack 1",
          },
          {
            // Saldo que saiu de cada projeto (exceto Op. Básica): aparece como despesa
            label: "Saldo Remanescente",
            data: sorted.map(x => x.projeto === "Operação Básica" ? 0 : (x.saldoRemanescente || 0)),
            backgroundColor: "#065f46",
            borderRadius: 4,
            stack: "Stack 1",
          },
        ],
      };

      /**
       * O eixo só desce abaixo de zero quando há algo lá embaixo.
       *
       * O Chart.js escolhia a escala sozinho e abria uma faixa até −1.000.000
       * sem nenhuma barra nela, encolhendo todas as barras reais pela metade.
       * Ancorar em zero não esconde negativo nenhum: havendo um valor negativo
       * — e há, como o saldo remanescente da Plataforma —, o `min` é liberado e
       * a barra aparece.
       */
      const temNegativo = this.barChartData.datasets.some(d =>
        (d.data as number[]).some(v => typeof v === "number" && v < 0)
      );
      this.barChartOptions = {
        ...this.barChartOptions,
        scales: {
          ...this.barChartOptions.scales,
          x: { ...this.barChartOptions.scales?.x, min: temNegativo ? undefined : 0 },
        },
      };

      this.chartReady = true;
    }, 50);
  }
}
