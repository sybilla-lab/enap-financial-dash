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

/**
 * Só o que o relatório usa do evento — estruturalmente igual a
 * `OficioRendimentos`, declarado aqui para o serviço de PDF não depender do
 * modelo de domínio do dashboard.
 */
export interface EventoParaRelatorio {
  documento: string;
  dataBase: string;
  competenciaEfeito: string;
  checkpointDataBase: number;
  saldoLivreTotal: number;
  totalDestinado: number;
  utilizado: number;
  disponivel: number;
  projetos: {
    projeto: string; historicoAteDataBase: number; destinado: number;
    novosRendimentos: number; carteiraSobGestao: number;
    utilizado: number; carteiraDisponivel: number;
  }[];
  movimentacoes: {
    documento: string; dataBase: string; competencia: string; tipo: string;
    origem: string; destino: string; valor: number;
    numeroPagamento: string | null; finalidade: string;
  }[];
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

  /**
   * Troca caracteres que a fonte padrão do jsPDF não tem por equivalentes.
   *
   * As fontes embutidas usam WinAnsi. Um U+2212 (sinal de menos "matemático")
   * ou um U+2192 sai como lixo — foi o que aconteceu com "recebido − executado",
   * impresso como `r e c e b i d o "`. Em vez de caçar caso a caso, todo texto
   * passa por aqui antes de ir para o papel.
   */
  private seguro(s: string): string {
    return (s ?? '')
      .replace(/−/g, '-')        // menos matemático
      .replace(/[–—]/g, '—')  // en dash → em dash (existe no WinAnsi)
      .replace(/→/g, '>')        // seta
      .replace(/[≤≥]/g, m => (m === '≤' ? '<=' : '>='))
      .replace(/ /g, ' ');       // espaço não separável
  }

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

  /**
   * Título de seção. Nunca fica órfão no pé da página.
   *
   * O espaço exigido cobre o título mais o cabeçalho da tabela e a primeira
   * linha: com folga menor, o título cabia no rodapé e o conteúdo começava só
   * na página seguinte.
   */
  secao(doc: jsPDF, y: number, texto: string, cab: CabecalhoRelatorio): number {
    y = this.garantirEspaco(doc, y, 28, cab);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COR.tinta);
    doc.text(this.seguro(texto), this.MARGEM, y);
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
      doc.text(this.seguro(k.rotulo).toUpperCase(), x, y + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COR.tinta);
      doc.text(this.seguro(k.valor), x, y + 12);
      if (k.base) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...COR.tinta3);
        doc.text(this.seguro(k.base), x, y + 16);
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

    /**
     * O cabeçalho quebra em duas linhas quando o título não cabe na coluna.
     *
     * Antes o título era desenhado inteiro, transbordando por cima do vizinho:
     * "UTILIZADO NO MÊS" e "SALDO DISPONÍVEL ACUMULADO" saíam grudados, sem
     * qualquer sinal de que algo tinha dado errado.
     */
    const ENTRELINHA_TITULO = 3.4;
    const titulos = colunas.map((c, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      return doc.splitTextToSize(this.seguro(c.titulo).toUpperCase(), larguras[i] - 4) as string[];
    });
    const alturaCabecalho = Math.max(
      ALTURA,
      titulos.reduce((m, t) => Math.max(m, t.length), 1) * ENTRELINHA_TITULO + 3.4
    );

    const cabecalhoTabela = (yy: number): number => {
      doc.setFillColor(...COR.faixa);
      doc.rect(this.MARGEM, yy, util, alturaCabecalho, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...COR.tinta2);
      let x = this.MARGEM;
      colunas.forEach((c, i) => {
        const dir = c.alinhamento === "right";
        // Alinhado ao pé da célula: títulos de uma e de duas linhas ficam na
        // mesma base, como numa tabela de imprensa.
        const base = yy + alturaCabecalho - 2.4 - (titulos[i].length - 1) * ENTRELINHA_TITULO;
        titulos[i].forEach((linha, k) => {
          doc.text(linha, dir ? x + larguras[i] - 2 : x + 2, base + k * ENTRELINHA_TITULO,
                   { align: dir ? "right" : "left" });
        });
        x += larguras[i];
      });
      doc.setDrawColor(...COR.linha);
      doc.setLineWidth(0.2);
      doc.line(this.MARGEM, yy + alturaCabecalho, L - this.MARGEM, yy + alturaCabecalho);
      return yy + alturaCabecalho;
    };

    /**
     * Quebra cada célula na largura da coluna e devolve a altura da linha.
     *
     * Com altura fixa, um texto que não coubesse era desenhado em várias linhas
     * que invadiam a linha de baixo — e um valor em BRL chegava a ser partido no
     * meio ("R$ 72.84 7,81"). A linha agora cresce com o conteúdo, e colunas
     * alinhadas à direita nunca quebram: número partido é sempre erro.
     */
    const ENTRELINHA = 3.6;
    const preparar = (linha: Record<string, string>) => {
      doc.setFontSize(8);
      const celulas = colunas.map((c, i) => {
        const txt = this.seguro(linha[c.chave] ?? "");
        if (c.alinhamento === "right") return [txt];
        return doc.splitTextToSize(txt, larguras[i] - 4) as string[];
      });
      const maxLinhas = celulas.reduce((m, c) => Math.max(m, c.length), 1);
      return { celulas, altura: Math.max(ALTURA, maxLinhas * ENTRELINHA + 3.2) };
    };

    y = this.garantirEspaco(doc, y, alturaCabecalho + ALTURA * 2, cab);
    y = cabecalhoTabela(y);

    for (const linha of linhas) {
      const { celulas, altura } = preparar(linha);
      if (y + altura > doc.internal.pageSize.getHeight() - this.RODAPE - 4) {
        doc.addPage();
        y = this.desenharCabecalho(doc, cab, false);
        y = cabecalhoTabela(y);   // repete o cabeçalho na página nova
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      let x = this.MARGEM;
      colunas.forEach((c, i) => {
        const dir = c.alinhamento === "right";
        const partes = celulas[i];
        if ((partes[0] ?? "").startsWith("-") || (partes[0] ?? "").startsWith("(")) doc.setTextColor(...COR.saida);
        else doc.setTextColor(...COR.tinta);
        partes.forEach((parte, k) => {
          doc.text(parte, dir ? x + larguras[i] - 2 : x + 2, y + 4.8 + k * ENTRELINHA,
                   { align: dir ? "right" : "left" });
        });
        x += larguras[i];
      });
      doc.setDrawColor(...COR.linha);
      doc.setLineWidth(0.1);
      doc.line(this.MARGEM, y + altura, L - this.MARGEM, y + altura);
      y += altura;
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
        const txt = this.seguro(totalizador[c.chave] ?? "");
        doc.text(txt, dir ? x + larguras[i] - 2 : x + 2, y + 4.8,
                 { align: dir ? "right" : "left" });
        x += larguras[i];
      });
      y += ALTURA;
    }
    return y + 5;
  }

  /**
   * Seção "Eventos institucionais no período".
   *
   * Desenha o evento de destinação de rendimentos quando ele for pertinente à
   * visão que o relatório retrata: fora do período filtrado, ou num projeto que
   * não participou nem preservou saldo, a seção simplesmente não existe — em
   * vez de um título com tabela vazia.
   *
   * O pagamento que consome o saldo destinado NÃO entra como despesa aqui: ele já está
   * lançado na aba Principal e aparece uma vez só, no quadro de despesas. Aqui
   * ele consta apenas como vínculo, pelo número.
   *
   * `projeto` nulo = visão consolidada. `inicio`/`fim` em "YYYY-MM".
   */
  eventosInstitucionais(
    doc: jsPDF, y: number, cab: CabecalhoRelatorio,
    oficio: EventoParaRelatorio | null,
    opcoes: { projeto?: string | null; inicio?: string | null; fim?: string | null } = {},
  ): number {
    if (!oficio) return y;

    const chave = (c: string | null | undefined): number | null => {
      const m = (c || '').match(/^(\d{4})-(\d{2})$/);
      return m ? parseInt(m[1]) * 100 + parseInt(m[2]) : null;
    };
    const efeito = chave(oficio.competenciaEfeito);
    const ini = chave(opcoes.inicio);
    const fim = chave(opcoes.fim);
    if (efeito === null) return y;
    if (ini !== null && efeito < ini) return y;
    if (fim !== null && efeito > fim) return y;

    const projeto = opcoes.projeto ?? null;
    const mov = oficio.movimentacoes.filter(m =>
      !projeto || m.origem === projeto || m.destino === projeto
    );
    const p = projeto ? oficio.projetos.find(x => x.projeto === projeto) : null;
    // Um projeto sem movimentação e sem saldo no corte não tem o que contar.
    if (projeto && !mov.length && !(p && p.historicoAteDataBase > 0)) return y;

    const mesAno = (c: string) => {
      const [a, m] = String(c).split('-');
      return m ? `${m}/${a}` : c;
    };

    y = this.secao(doc, y, 'Eventos institucionais no período', cab);

    const linhas = mov.map(m => ({
      documento: m.documento,
      dataBase: m.dataBase,
      competencia: mesAno(m.competencia),
      origem: m.origem,
      destino: m.destino,
      tipo: m.tipo,
      valor: this.brl(m.valor),
      finalidade: m.finalidade + (m.numeroPagamento ? ` · pagamento ${m.numeroPagamento}` : ''),
    }));

    if (linhas.length) {
      // Pesos em milímetros de A4 retrato (174 mm úteis), somando 174 para
      // leitura direta. Datas e valores não podem quebrar — uma data partida
      // em "31/07/20 26" é erro de leitura, não economia de espaço —, então
      // cada uma leva a largura do seu próprio título de coluna.
      y = this.tabela(doc, y, [
        { titulo: 'Documento', chave: 'documento', largura: 24 },
        { titulo: 'Data-base', chave: 'dataBase', largura: 20 },
        { titulo: 'Compet.', chave: 'competencia', largura: 15 },
        { titulo: 'Tipo', chave: 'tipo', largura: 24 },
        { titulo: 'Origem', chave: 'origem', largura: 22 },
        { titulo: 'Destino', chave: 'destino', largura: 22 },
        { titulo: 'Valor', chave: 'valor', largura: 25, alinhamento: 'right' },
        { titulo: 'Finalidade', chave: 'finalidade', largura: 22 },
      ], linhas, cab);
    }

    // Utilizado e saldo a utilizar só quando a visão inclui quem executa a destinação.
    const executor = projeto
      ? (p && p.carteiraSobGestao > 0 ? p : null)
      : { carteiraSobGestao: oficio.totalDestinado, utilizado: oficio.utilizado, carteiraDisponivel: oficio.disponivel };
    if (executor) {
      y = this.kpis(doc, y, [
        { rotulo: 'Valor destinado', valor: this.brl(executor.carteiraSobGestao),
          base: `data-base ${oficio.dataBase} · efeito ${mesAno(oficio.competenciaEfeito)}` },
        { rotulo: 'Utilizado', valor: this.brl(executor.utilizado), base: 'pagamentos já realizados' },
        { rotulo: 'Saldo a utilizar', valor: this.brl(executor.carteiraDisponivel), base: 'destinado e ainda não pago' },
      ], cab);
    }

    // No consolidado, fecha a conta que o evento conta: o acumulado da
    // data-base se reparte entre o destinado e o livre nos projetos.
    if (!projeto) {
      y = this.kpis(doc, y, [
        { rotulo: `Acumulado até ${oficio.dataBase}`, valor: this.brl(oficio.checkpointDataBase),
          base: 'rendimento realizado na data-base' },
        { rotulo: 'Destinado pelo documento', valor: this.brl(oficio.totalDestinado),
          base: 'transferido + destinação própria' },
        { rotulo: 'Livre nos projetos', valor: this.brl(oficio.saldoLivreTotal),
          base: `livre após o corte + rendimento desde ${mesAno(oficio.competenciaEfeito)}` },
      ], cab);
    }

    if (p && !p.destinado && p.historicoAteDataBase > 0) {
      y = this.nota(doc, y,
        `${p.projeto} não participou da realocação: o saldo de ${this.brl(p.historicoAteDataBase)} acumulado até ` +
        `${oficio.dataBase} foi preservado no corte de ${mesAno(oficio.competenciaEfeito)} e os rendimentos ` +
        `posteriores seguem acumulando — ${this.brl(p.novosRendimentos)} desde então.`, cab);
    }

    y = this.nota(doc, y,
      'Transferência interna de rendimentos entre projetos do mesmo instrumento: não é receita nem despesa e ' +
      'soma zero no consolidado. A destinação própria apenas reclassifica saldo que já pertencia ao projeto, ' +
      'de livre para destinado. O saldo destinado é subdivisão do saldo disponível e não se soma a ele. ' +
      'O pagamento vinculado já consta no quadro de despesas pela aba ' +
      'Principal e não é lançado novamente aqui.', cab);

    return y;
  }

  /** Nota de rodapé de seção: metodologia, fórmula ou ressalva. */
  nota(doc: jsPDF, y: number, texto: string, cab: CabecalhoRelatorio,
       tom: "neutro" | "atencao" = "neutro"): number {
    const L = doc.internal.pageSize.getWidth();
    const largura = L - this.MARGEM * 2 - 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const linhas = doc.splitTextToSize(this.seguro(texto), largura) as string[];
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
