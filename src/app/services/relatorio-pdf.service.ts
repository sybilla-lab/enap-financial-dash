import { Injectable } from "@angular/core";
import type jsPDF from "jspdf";

/**
 * Geração de relatórios em PDF **nativos**: todo o conteúdo tabular é texto
 * vetorial, pesquisável e selecionável.
 *
 * O exportador anterior fotografava a tela com html2canvas e colava a imagem
 * numa folha A4 — o arquivo resultante não permitia buscar, copiar nem ser lido
 * por leitor de tela, o que o inviabilizava como anexo do Transferegov
 * (achado F-19). Aqui só gráficos entram como imagem; números, nunca.
 */

export interface CabecalhoRelatorio {
  titulo: string;
  subtitulo?: string;
  periodo: string;
  /** Logos já convertidos em data URL pelo chamador. */
  logoIH?: { data: string; w: number; h: number };
  logoEnap?: { data: string; w: number; h: number };
  /** Filtros ativos, registrados no documento conforme critério de aceite. */
  filtros?: string[];
}

export interface ColunaTabela {
  titulo: string;
  chave: string;
  largura?: number;
  alinhamento?: "left" | "right";
}

const INSTRUMENTO = "Termo de Colaboração Transferegov nº 943356/2023";
const FONTE_DADOS = "Base de Dados ENAP Financial Dash";

// Paleta semântica — a mesma da tela.
const COR = {
  tinta: [20, 28, 38] as [number, number, number],
  tinta2: [61, 74, 92] as [number, number, number],
  tinta3: [120, 134, 150] as [number, number, number],
  linha: [223, 228, 234] as [number, number, number],
  faixa: [244, 246, 249] as [number, number, number],
  entrada: [16, 133, 89] as [number, number, number],
  saida: [190, 40, 60] as [number, number, number],
  atencao: [180, 83, 9] as [number, number, number],
};

@Injectable({ providedIn: "root" })
export class RelatorioPdfService {
  readonly MARGEM = 18;          // mm — exigido pelo padrão de relatório
  private readonly TOPO_CONTEUDO = 34;
  private readonly RODAPE = 16;

  /** Formata em BRL sem quebrar linha. */
  brl(v: number, casas = 2): string {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: "BRL",
      minimumFractionDigits: casas, maximumFractionDigits: casas,
    }).format(v ?? 0);
  }

  dataExtracao(): string {
    return new Date().toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  /** Cabeçalho institucional. Compacto a partir da segunda página. */
  desenharCabecalho(doc: jsPDF, cab: CabecalhoRelatorio, primeira: boolean): number {
    const L = doc.internal.pageSize.getWidth();
    const m = this.MARGEM;
    let y = m;

    if (primeira && (cab.logoIH?.data || cab.logoEnap?.data)) {
      const alturaLogo = 9;
      let x = m;
      if (cab.logoIH?.data) {
        const w = (cab.logoIH.w / cab.logoIH.h) * alturaLogo;
        doc.addImage(cab.logoIH.data, "PNG", x, y, w, alturaLogo);
        x += w + 7;
      }
      if (cab.logoEnap?.data) {
        const w = (cab.logoEnap.w / cab.logoEnap.h) * alturaLogo;
        doc.addImage(cab.logoEnap.data, "PNG", x, y + 1, w, alturaLogo - 2);
      }
      y += alturaLogo + 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(primeira ? 15 : 9.5);
    doc.setTextColor(...COR.tinta);
    doc.text(cab.titulo, m, y);

    if (primeira) {
      y += 6;
      if (cab.subtitulo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...COR.tinta2);
        doc.text(cab.subtitulo, m, y);
        y += 5;
      }
      doc.setFontSize(8.5);
      doc.setTextColor(...COR.tinta3);
      doc.text(INSTRUMENTO, m, y); y += 4;
      doc.text(`Período: ${cab.periodo}`, m, y); y += 4;
      doc.text(`Fonte: ${FONTE_DADOS} · extraído em ${this.dataExtracao()}`, m, y); y += 4;
      if (cab.filtros?.length) {
        doc.text(`Filtros: ${cab.filtros.join(" · ")}`, m, y);
        y += 4;
      }
      y += 2;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COR.tinta3);
      doc.text(cab.periodo, L - m, y, { align: "right" });
      y += 3;
    }

    doc.setDrawColor(...COR.linha);
    doc.setLineWidth(0.3);
    doc.line(m, y, L - m, y);
    return y + (primeira ? 8 : 6);
  }

  /** Rodapé com paginação "Página X de Y" em todas as páginas. */
  desenharRodapes(doc: jsPDF): void {
    const total = doc.getNumberOfPages();
    const L = doc.internal.pageSize.getWidth();
    const A = doc.internal.pageSize.getHeight();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setDrawColor(...COR.linha);
      doc.setLineWidth(0.2);
      doc.line(this.MARGEM, A - this.RODAPE + 4, L - this.MARGEM, A - this.RODAPE + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...COR.tinta3);
      doc.text(INSTRUMENTO, this.MARGEM, A - this.RODAPE + 9);
      doc.text(`Página ${p} de ${total}`, L - this.MARGEM, A - this.RODAPE + 9, { align: "right" });
    }
  }

  /** Garante espaço; abre página nova e redesenha o cabeçalho se faltar. */
  garantirEspaco(doc: jsPDF, y: number, precisa: number, cab: CabecalhoRelatorio): number {
    const A = doc.internal.pageSize.getHeight();
    if (y + precisa <= A - this.RODAPE - 4) return y;
    doc.addPage();
    return this.desenharCabecalho(doc, cab, false);
  }

  /** Título de seção. Nunca fica órfão no pé da página. */
  secao(doc: jsPDF, y: number, texto: string, cab: CabecalhoRelatorio): number {
    y = this.garantirEspaco(doc, y, 16, cab);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COR.tinta);
    doc.text(texto, this.MARGEM, y);
    return y + 6;
  }

  /** Faixa de KPIs com rótulo, valor e base de cálculo. */
  kpis(doc: jsPDF, y: number, itens: { rotulo: string; valor: string; base?: string }[],
       cab: CabecalhoRelatorio): number {
    y = this.garantirEspaco(doc, y, 22, cab);
    const L = doc.internal.pageSize.getWidth();
    const largura = (L - this.MARGEM * 2) / itens.length;

    doc.setDrawColor(...COR.linha);
    doc.setFillColor(...COR.faixa);
    doc.roundedRect(this.MARGEM, y, L - this.MARGEM * 2, 19, 1.5, 1.5, "FD");

    itens.forEach((k, i) => {
      const x = this.MARGEM + largura * i + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COR.tinta3);
      doc.text(k.rotulo.toUpperCase(), x, y + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COR.tinta);
      doc.text(k.valor, x, y + 12);
      if (k.base) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...COR.tinta3);
        doc.text(k.base, x, y + 16);
      }
      if (i > 0) {
        doc.setDrawColor(...COR.linha);
        doc.line(this.MARGEM + largura * i, y + 3, this.MARGEM + largura * i, y + 16);
      }
    });
    return y + 25;
  }

  /**
   * Tabela com cabeçalho repetido em toda página nova — requisito do
   * Transferegov e critério de aceite explícito.
   */
  tabela(doc: jsPDF, y: number, colunas: ColunaTabela[],
         linhas: Record<string, string>[], cab: CabecalhoRelatorio,
         totalizador?: Record<string, string>): number {
    const L = doc.internal.pageSize.getWidth();
    const util = L - this.MARGEM * 2;
    const somaPesos = colunas.reduce((s, c) => s + (c.largura ?? 1), 0);
    const larguras = colunas.map(c => ((c.largura ?? 1) / somaPesos) * util);
    const ALTURA = 7;

    const cabecalhoTabela = (yy: number): number => {
      doc.setFillColor(...COR.faixa);
      doc.rect(this.MARGEM, yy, util, ALTURA, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...COR.tinta2);
      let x = this.MARGEM;
      colunas.forEach((c, i) => {
        const dir = c.alinhamento === "right";
        doc.text(c.titulo.toUpperCase(), dir ? x + larguras[i] - 2 : x + 2, yy + 4.8,
                 { align: dir ? "right" : "left" });
        x += larguras[i];
      });
      doc.setDrawColor(...COR.linha);
      doc.setLineWidth(0.2);
      doc.line(this.MARGEM, yy + ALTURA, L - this.MARGEM, yy + ALTURA);
      return yy + ALTURA;
    };

    y = this.garantirEspaco(doc, y, ALTURA * 3, cab);
    y = cabecalhoTabela(y);

    for (const linha of linhas) {
      if (y + ALTURA > doc.internal.pageSize.getHeight() - this.RODAPE - 4) {
        doc.addPage();
        y = this.desenharCabecalho(doc, cab, false);
        y = cabecalhoTabela(y);   // repete o cabeçalho na página nova
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COR.tinta);
      let x = this.MARGEM;
      colunas.forEach((c, i) => {
        const dir = c.alinhamento === "right";
        const txt = linha[c.chave] ?? "";
        if (txt.startsWith("-") || txt.startsWith("(")) doc.setTextColor(...COR.saida);
        else doc.setTextColor(...COR.tinta);
        doc.text(txt, dir ? x + larguras[i] - 2 : x + 2, y + 4.8,
                 { align: dir ? "right" : "left", maxWidth: larguras[i] - 4 });
        x += larguras[i];
      });
      doc.setDrawColor(...COR.linha);
      doc.setLineWidth(0.1);
      doc.line(this.MARGEM, y + ALTURA, L - this.MARGEM, y + ALTURA);
      y += ALTURA;
    }

    if (totalizador) {
      y = this.garantirEspaco(doc, y, ALTURA + 2, cab);
      doc.setFillColor(...COR.faixa);
      doc.rect(this.MARGEM, y, util, ALTURA, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COR.tinta);
      let x = this.MARGEM;
      colunas.forEach((c, i) => {
        const dir = c.alinhamento === "right";
        const txt = totalizador[c.chave] ?? "";
        doc.text(txt, dir ? x + larguras[i] - 2 : x + 2, y + 4.8,
                 { align: dir ? "right" : "left" });
        x += larguras[i];
      });
      y += ALTURA;
    }
    return y + 5;
  }

  /** Nota de rodapé de seção: metodologia, fórmula ou ressalva. */
  nota(doc: jsPDF, y: number, texto: string, cab: CabecalhoRelatorio,
       tom: "neutro" | "atencao" = "neutro"): number {
    const L = doc.internal.pageSize.getWidth();
    const largura = L - this.MARGEM * 2 - 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const linhas = doc.splitTextToSize(texto, largura) as string[];
    const altura = linhas.length * 3.6 + 5;
    y = this.garantirEspaco(doc, y, altura + 3, cab);

    const cor = tom === "atencao" ? COR.atencao : COR.tinta3;
    doc.setDrawColor(...cor);
    doc.setLineWidth(0.8);
    doc.line(this.MARGEM, y, this.MARGEM, y + altura - 2);
    doc.setTextColor(...cor);
    linhas.forEach((l, i) => doc.text(l, this.MARGEM + 3, y + 3.4 + i * 3.6));
    return y + altura + 2;
  }

  /** Carrega uma imagem como data URL, para logos e gráficos. */
  carregarImagem(src: string): Promise<{ data: string; w: number; h: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d")!.drawImage(img, 0, 0);
        resolve({ data: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => resolve({ data: "", w: 0, h: 0 });
      img.src = src;
    });
  }

  get topoConteudo(): number { return this.TOPO_CONTEUDO; }
}
