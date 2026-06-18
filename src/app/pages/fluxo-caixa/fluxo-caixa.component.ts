import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import { FluxoMensal, ProjetoResumo } from "../../models/lancamento.model";

const PROJETO_COLORS = [
  { bg: "rgba(99,102,241,0.18)",  border: "#6366f1", text: "#a5b4fc" },
  { bg: "rgba(16,185,129,0.18)",  border: "#10b981", text: "#6ee7b7" },
  { bg: "rgba(245,158,11,0.18)",  border: "#f59e0b", text: "#fcd34d" },
  { bg: "rgba(236,72,153,0.18)",  border: "#ec4899", text: "#f9a8d4" },
  { bg: "rgba(6,182,212,0.18)",   border: "#06b6d4", text: "#67e8f9" },
  { bg: "rgba(139,92,246,0.18)",  border: "#8b5cf6", text: "#c4b5fd" },
  { bg: "rgba(239,68,68,0.18)",   border: "#ef4444", text: "#fca5a5" },
  { bg: "rgba(20,184,166,0.18)",  border: "#14b8a6", text: "#5eead4" },
];

interface DetalheProj {
  projeto: string;
  entradasMes: number;
  saidasMes: number;
  saldoAcumulado: number;
  pctEntradas: number;
  pctSaidas: number;
  cor: string;
}

@Component({
  selector: "app-fluxo-caixa",
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, BaseChartDirective],
  templateUrl: "./fluxo-caixa.component.html",
  styleUrl: "./fluxo-caixa.component.scss",
})
export class FluxoCaixaComponent implements OnInit {
  lancamentosOriginais: any[] = [];
  fluxo: FluxoMensal[] = [];
  projetos: string[] = [];
  anos: string[] = [];
  chartReady = false;
  totais = { entradas: 0, saidas: 0, saldoAtual: 0 };
  private srOutrosProjetos = 0;

  filtroAnos: string[] = [];
  filtroProjetos: string[] = [];
  filtroMeses: string[] = [];
  filtrosAbertos = false;

  tabelaAberta = false;
  mesAnoSelecionado: string | null = null;
  detalhesProjetos: DetalheProj[] = [];

  get detalheTotalEntradas(): number { return this.detalhesProjetos.reduce((s, d) => s + d.entradasMes, 0); }
  get detalheTotalSaidas(): number { return this.detalhesProjetos.reduce((s, d) => s + d.saidasMes, 0); }
  get detalheSaldoAcumulado(): number {
    return this.fluxo.find(f => f.mesAno === this.mesAnoSelecionado)?.saldoAcumulado ?? 0;
  }

  get totalFiltrosAtivos(): number {
    return this.filtroAnos.length + this.filtroProjetos.length + this.filtroMeses.length;
  }

  limparFiltros(): void {
    this.filtroAnos = [];
    this.filtroProjetos = [];
    this.filtroMeses = [];
    this.aplicarFiltros();
  }

  readonly meses = [
    { valor: "01", abrev: "Jan" },
    { valor: "02", abrev: "Fev" },
    { valor: "03", abrev: "Mar" },
    { valor: "04", abrev: "Abr" },
    { valor: "05", abrev: "Mai" },
    { valor: "06", abrev: "Jun" },
    { valor: "07", abrev: "Jul" },
    { valor: "08", abrev: "Ago" },
    { valor: "09", abrev: "Set" },
    { valor: "10", abrev: "Out" },
    { valor: "11", abrev: "Nov" },
    { valor: "12", abrev: "Dez" },
  ];

  mixedChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  mixedChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { color: "#94a3b8", font: { weight: "bold" } } },
      datalabels: { display: false },
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { display: false } },
      y: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,0.05)" } },
      y1: {
        type: "linear",
        position: "right",
        ticks: { color: "#f59e0b" },
        grid: { display: false },
      },
    },
  };

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.lancamentos$.subscribe((lancs) => {
      this.lancamentosOriginais = lancs;
      this.anos = [...new Set(lancs.map(l => l.mesAno?.split("/")[1]).filter(Boolean))].sort();
      this.aplicarFiltros();
    });

    this.dataService.getProjetoResumos().subscribe((resumos: ProjetoResumo[]) => {
      this.srOutrosProjetos = resumos
        .filter(r => r.projeto !== "Operação Básica")
        .reduce((acc, r) => acc + (r.saldoRemanescente || 0), 0);
      this.aplicarFiltros();
    });

    this.dataService.getProjetosUnicos().subscribe((projs) => {
      this.projetos = projs.sort();
    });
  }

  getProjetoColor(projeto: string) {
    const idx = this.projetos.indexOf(projeto) % PROJETO_COLORS.length;
    return PROJETO_COLORS[idx < 0 ? 0 : idx];
  }

  toggleAno(ano: string): void {
    const idx = this.filtroAnos.indexOf(ano);
    if (idx >= 0) {
      this.filtroAnos = this.filtroAnos.filter(a => a < ano);
    } else {
      [...this.anos].sort().filter(a => a <= ano).forEach(a => {
        if (!this.filtroAnos.includes(a)) this.filtroAnos.push(a);
      });
    }
    this.aplicarFiltros();
  }

  toggleProjeto(projeto: string): void {
    const idx = this.filtroProjetos.indexOf(projeto);
    if (idx >= 0) this.filtroProjetos.splice(idx, 1);
    else this.filtroProjetos.push(projeto);
    this.aplicarFiltros();
  }

  toggleMes(valor: string): void {
    const idx = this.filtroMeses.indexOf(valor);
    if (idx >= 0) {
      this.filtroMeses = this.filtroMeses.filter(m => m < valor);
    } else {
      ['01','02','03','04','05','06','07','08','09','10','11','12']
        .filter(m => m <= valor)
        .forEach(m => { if (!this.filtroMeses.includes(m)) this.filtroMeses.push(m); });
    }
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    let filtrados = this.lancamentosOriginais;

    // Filtro de data acumulativo: anos anteriores ao último mostram todos os meses
    if (this.filtroAnos.length > 0 && this.filtroMeses.length > 0) {
      const maxAno = [...this.filtroAnos].sort().at(-1)!;
      filtrados = filtrados.filter(l => {
        const parts = l.mesAno?.split("/");
        if (!parts || parts.length !== 2) return false;
        const [mes, ano] = parts;
        if (!this.filtroAnos.includes(ano)) return false;
        return ano < maxAno || this.filtroMeses.includes(mes);
      });
    } else if (this.filtroAnos.length > 0) {
      filtrados = filtrados.filter(l => {
        const ano = l.mesAno?.split("/")[1];
        return this.filtroAnos.includes(ano);
      });
    } else if (this.filtroMeses.length > 0) {
      filtrados = filtrados.filter(l => {
        const mes = l.mesAno?.split("/")[0];
        return this.filtroMeses.includes(mes);
      });
    }

    if (this.filtroProjetos.length > 0) {
      filtrados = filtrados.filter(l => this.filtroProjetos.includes(l.projeto));
    }

    const porMes = new Map<string, { entradas: number; saidas: number }>();
    filtrados.forEach((l) => {
      if (!l.mesAno) return;
      if (!porMes.has(l.mesAno)) porMes.set(l.mesAno, { entradas: 0, saidas: 0 });
      const m = porMes.get(l.mesAno)!;
      if (l.valor >= 0) m.entradas += l.valor;
      else m.saidas += Math.abs(l.valor);
    });

    const sorted = Array.from(porMes.entries()).sort((a, b) => {
      const [ma, ya] = a[0].split("/");
      const [mb, yb] = b[0].split("/");
      return (parseInt(ya) * 100 + parseInt(ma)) - (parseInt(yb) * 100 + parseInt(mb));
    });

    let acumulado = 0;
    this.fluxo = sorted.map(([mesAno, data]) => {
      acumulado += data.entradas - data.saidas;
      return { mesAno, entradas: data.entradas, saidas: data.saidas, saldoAcumulado: acumulado };
    });

    const saldoAtualBruto = this.fluxo[this.fluxo.length - 1]?.saldoAcumulado || 0;
    const apenasOpBasica = this.filtroProjetos.length === 1 && this.filtroProjetos[0] === "Operação Básica";

    this.totais = {
      entradas: this.fluxo.reduce((acc, curr) => acc + curr.entradas, 0),
      saidas: this.fluxo.reduce((acc, curr) => acc + curr.saidas, 0),
      saldoAtual: apenasOpBasica ? saldoAtualBruto + this.srOutrosProjetos : saldoAtualBruto,
    };

    this.renderizarGrafico();
  }

  abrirDetalhe(mesAno: string): void {
    const [mesStr, anoStr] = mesAno.split('/');
    const cutoff = parseInt(anoStr) * 100 + parseInt(mesStr);

    // Todos os lançamentos ATÉ o mês clicado (histórico acumulado)
    const lancsAte = this.lancamentosOriginais.filter(l => {
      if (!l.mesAno) return false;
      if (this.filtroProjetos.length > 0 && !this.filtroProjetos.includes(l.projeto)) return false;
      const [m, a] = l.mesAno.split('/');
      return parseInt(a) * 100 + parseInt(m) <= cutoff;
    });

    const projMap = new Map<string, { entradasMes: number; saidasMes: number; totalEntradas: number; totalSaidas: number }>();
    lancsAte.forEach(l => {
      const key = l.projeto || 'Sem projeto';
      if (!projMap.has(key)) projMap.set(key, { entradasMes: 0, saidasMes: 0, totalEntradas: 0, totalSaidas: 0 });
      const m = projMap.get(key)!;
      const isMes = l.mesAno === mesAno;
      if (l.valor >= 0) {
        m.totalEntradas += l.valor;
        if (isMes) m.entradasMes += l.valor;
      } else if (l.categoria !== '0.0.0 Recurso') {
        m.totalSaidas += Math.abs(l.valor);
        if (isMes) m.saidasMes += Math.abs(l.valor);
      }
    });

    const maxE = Math.max(...Array.from(projMap.values()).map(d => d.entradasMes), 1);
    const maxS = Math.max(...Array.from(projMap.values()).map(d => d.saidasMes), 1);
    const palette = ['#6366f1','#10b981','#f59e0b','#ec4899','#06b6d4','#8b5cf6','#ef4444','#14b8a6','#f97316','#84cc16'];

    this.detalhesProjetos = Array.from(projMap.entries())
      .map(([projeto, d], i) => ({
        projeto,
        entradasMes: d.entradasMes,
        saidasMes: d.saidasMes,
        saldoAcumulado: d.totalEntradas - d.totalSaidas + (projeto === 'Operação Básica' ? this.srOutrosProjetos : 0),
        pctEntradas: (d.entradasMes / maxE) * 100,
        pctSaidas: (d.saidasMes / maxS) * 100,
        cor: palette[i % palette.length],
      }))
      .filter(d => d.entradasMes > 0 || d.saidasMes > 0)
      .sort((a, b) => b.saldoAcumulado - a.saldoAcumulado);

    this.mesAnoSelecionado = mesAno;
  }

  fecharDetalhe(): void { this.mesAnoSelecionado = null; }

  private renderizarGrafico(): void {
    this.chartReady = false;
    setTimeout(() => {
      this.mixedChartData = {
        labels: this.fluxo.map((f: FluxoMensal) => f.mesAno),
        datasets: [
          {
            type: "bar", label: "Entradas",
            data: this.fluxo.map((f: FluxoMensal) => f.entradas),
            backgroundColor: "rgba(16, 185, 129, 0.4)", borderColor: "#10b981",
            borderWidth: 1, borderRadius: 4, yAxisID: "y",
          },
          {
            type: "bar", label: "Saídas",
            data: this.fluxo.map((f: FluxoMensal) => f.saidas),
            backgroundColor: "rgba(239, 68, 68, 0.4)", borderColor: "#ef4444",
            borderWidth: 1, borderRadius: 4, yAxisID: "y",
          },
          {
            type: "line", label: "Saldo Acumulado",
            data: this.fluxo.map((f: FluxoMensal) => f.saldoAcumulado),
            borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.1)",
            borderWidth: 3, pointBackgroundColor: "#f59e0b", pointRadius: 2,
            fill: true, tension: 0.4, yAxisID: "y1",
          } as any,
        ],
      };
      this.chartReady = true;
    }, 50);
  }
}
