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
import { Rendimento } from "../../models/lancamento.model";
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
  totalAcumulado: number;
  pctTotal: number;
  aberto: boolean;
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
  lancamentosOriginais: any[] = [];

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
  porMesCorrigido: { mesAno: string; bruto: number; imposto: number; liquido: number; acumulado: number }[] = [];

  histAberto = false;
  historicoPorProjeto: ProjetoHistorico[] = [];
  somaVerificacao = { totalProjetos: 0, totalGeral: 0, bate: true };

  private readonly platformId = inject(PLATFORM_ID);

  // ── Previsão ──
  prevAberto = false;
  previsaoCarregada = false;
  previsaoPorProjeto: ProjetoPrev[] = [];
  prevTotais = { hist: 467078.70, proj2026: 0, proj2027: 0, proj2028: 0, projTotal: 0, geral: 0 };

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

  chartReady = false;
  barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
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
        callbacks: {
          label: (ctx: any) => {
            const label = ctx.dataset.label || "";
            return `${label}: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctx.parsed.y)}`;
          }
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

  constructor(private dataService: DataService, private http: HttpClient) {}

  ngOnDestroy(): void {}

  toggleProjPrev(proj: string): void {
    const p = this.previsaoPorProjeto.find(h => h.projeto === proj);
    if (p) p.aberto = !p.aberto;
  }

  private computarPrevisao(results: CalcRendResult[]): void {
    const PROJETOS_KEY = ['Alimenta', 'CAR DPG', 'MDIC', 'Co.NE', 'Op. Básica'];
    const HIST_ACUM: Record<string, number> = {
      'Alimenta': 345942.81, 'CAR DPG': 64948.71,
      'Op. Básica': 33450.06, 'Co.NE': 22737.13, 'MDIC': 0,
    };
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
      for (const p of PROJETOS_KEY) {
        if (m.mes > (PROJ_END[p] ?? '2028-12')) continue;
        const rend = m.proj_rend[p] ?? 0;
        projTotal[p] += rend;
        projPorAno[p][yr] = (projPorAno[p][yr] ?? 0) + rend;
        bancoPorAno[yr] = (bancoPorAno[yr] ?? 0) + rend;
      }
    }
    const bancoTotal = Object.values(bancoPorAno).reduce((s, v) => s + v, 0);

    this.prevTotais = {
      hist: 467078.70,
      proj2026: bancoPorAno[2026] ?? 0,
      proj2027: bancoPorAno[2027] ?? 0,
      proj2028: bancoPorAno[2028] ?? 0,
      projTotal: bancoTotal,
      geral: 467078.70 + bancoTotal,
    };

    this.previsaoPorProjeto = PROJETOS_KEY
      .map((p, i) => {
        const histAcum = HIST_ACUM[p] ?? 0;
        const endDate = PROJ_END[p] ?? '2028-12';
        let acumRun = 0;
        const meses = results
          .filter(m => m.mes <= endDate && (m.proj_rend[p] ?? 0) > 0.01)
          .map(m => {
            const rendMes = Math.round((m.proj_rend[p] ?? 0) * 100) / 100;
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
    doc.text('Previsão de Rendimentos — Impact Hub x Enap', margin, 10);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.setTextColor(160,180,220);
    doc.text('Projeção jul/2026–dez/2028 — Metodologia proporcional', margin, 16);
    doc.setFontSize(7); doc.setTextColor(120,145,195);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, margin, 21);
    y = 28;

    doc.setFillColor(245,247,252);
    doc.roundedRect(margin, y, W-margin*2, 18, 2, 2, 'F');
    doc.setTextColor(80,80,110); doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.text('TOTAL REALIZADO', margin+4, y+5);
    doc.text('TOTAL PROJETADO', margin+60, y+5);
    doc.text('GRAND TOTAL', margin+118, y+5);
    doc.setFontSize(10); doc.setTextColor(20,20,40);
    doc.text(brl(this.prevTotais.hist), margin+4, y+13);
    doc.text(brl(this.prevTotais.projTotal), margin+60, y+13);
    doc.setTextColor(50,50,80);
    doc.text(brl(this.prevTotais.geral), margin+118, y+13);
    y += 24;

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
      doc.text('Impact Hub x Enap — Previsão de Rendimentos', margin, 292);
      doc.text(`Página ${i} de ${pageCount}`, W-margin, 292, { align: 'right' });
    }
    doc.save(`previsao-rendimentos-${new Date().toISOString().slice(0,10)}.pdf`);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.http.get<{ results: CalcRendResult[] }>('/calc_rendimentos.json').subscribe(data => {
        this.computarPrevisao(data.results ?? []);
      });
      this.preloadLogo('/logo-impacthub.png').then(r => { this.logoIH = r.data; this.logoIHW = r.w; this.logoIHH = r.h; });
      this.preloadLogo('/logo-enap.png').then(r => { this.logoEnap = r.data; this.logoEnapW = r.w; this.logoEnapH = r.h; });
    }

    this.dataService.getRendimentoResumo().subscribe((r) => {
      this.resumo = r;
      this.buildChart(r.porMes);
      this.computarPorMesCorrigido();
      this.tryComputarHistorico();
      setTimeout(() => (this.isLoading = false), 1200);
    });

    this.dataService.lancamentos$.subscribe((lancs) => {
      this.lancamentosOriginais = lancs;
      this.tryComputarHistorico();
    });

    this.dataService.getRendimentos().subscribe((rends: Rendimento[]) => {
      this.utilizacaoPorMes.clear();
      rends.forEach(r => {
        if (r.valor > 0 && !this.utilizacaoPorMes.has(r.mesAno)) {
          this.utilizacaoPorMes.set(r.mesAno, r.utilizacao);
        }
      });
      this.computarPorMesCorrigido();
      this.tryComputarHistorico();
    });

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
  }

  private computarHistoricoPorProjeto(): void {
    const allSorted = [...this.resumo.porMes].sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));
    const firstDispMc = allSorted.reduce((acc, m) => {
      const isD = (this.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado';
      return isD && acc === Infinity ? mesKey(m.mesAno) : acc;
    }, Infinity);
    if (firstDispMc === Infinity) return;

    const dispMonths = allSorted.filter(m =>
      mesKey(m.mesAno) >= firstDispMc &&
      (this.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado'
    );
    if (!dispMonths.length) return;
    const lastCutoff = mesKey(dispMonths[dispMonths.length - 1].mesAno);

    const lancsSorted = [...this.lancamentosOriginais]
      .filter(l => l.mesAno).sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));

    const runningBalance = new Map<string, number>();
    const projRendAcum  = new Map<string, number>();
    const projMesRend   = new Map<string, Map<string, number>>();
    let lIdx = 0, undistributed = 0;

    for (const mes of dispMonths) {
      const mc = mesKey(mes.mesAno);
      while (lIdx < lancsSorted.length && mesKey(lancsSorted[lIdx].mesAno) <= mc) {
        const l = lancsSorted[lIdx++];
        if (!l.projeto) continue;
        runningBalance.set(l.projeto, (runningBalance.get(l.projeto) ?? 0) + l.valor);
      }
      this.projetosEncerrados.forEach((closedMc, proj) => {
        if (mc > closedMc) {
          const bal = runningBalance.get(proj) ?? 0;
          if (bal > 0) runningBalance.set('Operação Básica', (runningBalance.get('Operação Básica') ?? 0) + bal);
          runningBalance.set(proj, 0);
        }
      });
      const totalPos   = Array.from(runningBalance.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
      const toDistribute = mes.liquido + undistributed;
      if (totalPos > 0 && toDistribute > 0) {
        runningBalance.forEach((saldo, proj) => {
          if (saldo > 0) {
            const rendMes = toDistribute * (saldo / totalPos);
            projRendAcum.set(proj, (projRendAcum.get(proj) ?? 0) + rendMes);
            if (!projMesRend.has(proj)) projMesRend.set(proj, new Map());
            projMesRend.get(proj)!.set(mes.mesAno, (projMesRend.get(proj)!.get(mes.mesAno) ?? 0) + rendMes);
          }
        });
        undistributed = 0;
      } else { undistributed += mes.liquido; }
    }

    const isInativo = (proj: string) =>
      this.projetosInativos.has(proj) ||
      (this.projetosEncerrados.has(proj) && lastCutoff >= this.projetosEncerrados.get(proj)!);

    projRendAcum.forEach((rend, proj) => {
      if (proj !== 'Operação Básica' && isInativo(proj) && rend > 0) {
        projRendAcum.set('Operação Básica', (projRendAcum.get('Operação Básica') ?? 0) + rend);
        const opMap = projMesRend.get('Operação Básica') ?? new Map<string, number>();
        projMesRend.get(proj)?.forEach((v, m) => opMap.set(m, (opMap.get(m) ?? 0) + v));
        projMesRend.set('Operação Básica', opMap);
        projRendAcum.delete(proj);
        projMesRend.delete(proj);
      }
    });

    // Arredondamento e correção de resíduo
    projRendAcum.forEach((rend, proj) => projRendAcum.set(proj, Math.round(rend * 100) / 100));
    const expectedTotal = Math.round(dispMonths.reduce((s, m) => s + m.liquido, 0) * 100) / 100;
    const actualSum     = Math.round(Array.from(projRendAcum.values()).reduce((s, v) => s + v, 0) * 100) / 100;
    const residuo = Math.round((expectedTotal - actualSum) * 100) / 100;
    if (residuo !== 0) {
      let maxProj = ''; let maxRend = -Infinity;
      projRendAcum.forEach((rend, proj) => { if (rend > maxRend) { maxRend = rend; maxProj = proj; } });
      if (maxProj) projRendAcum.set(maxProj, Math.round((projRendAcum.get(maxProj)! + residuo) * 100) / 100);
    }

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
        return { projeto: proj, cor: PALETTE[i % PALETTE.length], meses,
                 totalAcumulado: projRendAcum.get(proj)!,
                 pctTotal: expectedTotal > 0 ? (projRendAcum.get(proj)! / expectedTotal) * 100 : 0,
                 aberto: false } as ProjetoHistorico;
      });

    const somaProj = Math.round(this.historicoPorProjeto.reduce((s, p) => s + p.totalAcumulado, 0) * 100) / 100;
    this.somaVerificacao = { totalProjetos: somaProj, totalGeral: expectedTotal,
                              bate: Math.abs(somaProj - expectedTotal) < 0.02 };
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
    doc.text('Rendimento por Projeto — Impact Hub x Enap', margin, 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 210);
    doc.text('Histórico mensal — período disponível (set/2025 a jun/2026)', margin, 16);
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
    doc.text('VERIFICAÇÃO', margin + 118, y + 5);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 40);
    doc.text(brl(this.somaVerificacao.totalGeral), margin + 4, y + 12);
    doc.text(brl(this.somaVerificacao.totalProjetos), margin + 60, y + 12);
    if (this.somaVerificacao.bate) {
      doc.setTextColor(5, 150, 105);
      doc.text('✓ Somas conferem', margin + 118, y + 12);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text('✗ Divergência detectada', margin + 118, y + 12);
    }
    y += 22;

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
      doc.text('Impact Hub x Enap — Estratégia de Inovação Aberta', margin, 292);
      doc.text(`Página ${i} de ${pageCount}`, W - margin, 292, { align: 'right' });
    }

    doc.save(`rendimentos-por-projeto-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  private computarPorMesCorrigido(): void {
    if (this.resumo.porMes.length === 0) return;
    let acc = 0;
    let resetado = false;
    this.porMesCorrigido = this.resumo.porMes.map(m => {
      const isDisponivel = (this.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado';
      if (isDisponivel && !resetado) {
        acc = 0;
        resetado = true;
      }
      acc += m.liquido;
      return { ...m, acumulado: acc };
    });
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
          { type: "bar", label: "Rendimento Bruto", data: porMes.map((m) => m.bruto), backgroundColor: "rgba(16,185,129,0.45)", borderColor: "#10b981", borderWidth: 1, borderRadius: 4, yAxisID: "y" },
          { type: "bar", label: "Impostos", data: porMes.map((m) => m.imposto), backgroundColor: "rgba(239,68,68,0.4)", borderColor: "#ef4444", borderWidth: 1, borderRadius: 4, yAxisID: "y" },
          { type: "line", label: "Saldo Líquido Acumulado", data: acumuladoNorm, borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 2, pointBackgroundColor: "#6366f1", pointRadius: 3, pointHoverRadius: 5, fill: true, tension: 0.4, yAxisID: "y" } as any,
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
