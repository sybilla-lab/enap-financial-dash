import { Injectable, signal, inject, PLATFORM_ID, ApplicationRef } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { Router } from "@angular/router";
import { first } from "rxjs";

export interface ExportProgress {
  running: boolean;
  current: number;
  total: number;
  label: string;
}

/* Ordem idêntica ao menu lateral */
const PAGES = [
  { route: "/dashboard",   title: "Dashboard"            },
  { route: "/recursos",    title: "Recursos"             },
  { route: "/projetos",    title: "Projetos"             },
  { route: "/categorias",  title: "Categorias"           },
  { route: "/fluxo-caixa", title: "Fluxo de Caixa"       },
  { route: "/saldos",      title: "Saldos Remanescentes" },
  { route: "/rendimentos", title: "Rendimentos"          },
];

// Ajustes de qualidade vs velocidade
const SCALE                  = 1.5;   // 1.5x: sharp no PDF, 44% menos memória que 2x
const IMG_QUALITY            = 0.85;  // 85% JPEG: boa qualidade, encoding mais rápido
const STABLE_TIMEOUT         = 6000;  // Espera máxima por página para o Angular estabilizar
const CANVAS_TIMEOUT         = 2500;  // Espera máxima para charts (Chart.js usa rAF, fora da zone)
const POST_STABLE_MS         = 120;   // Buffer pós-estabilidade para renders finais
const CANVAS_CAPTURE_TIMEOUT = 25000; // Timeout de segurança para html2canvas (25s)

@Injectable({ providedIn: "root" })
export class PdfExportService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly appRef      = inject(ApplicationRef);

  readonly progress = signal<ExportProgress>({
    running: false, current: 0, total: PAGES.length, label: ""
  });

  async exportAll(router: Router, contentEl: HTMLElement): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // Imports dinâmicos: não incluídos no bundle SSR
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);

    const originalRoute = router.url;
    this.progress.set({ running: true, current: 0, total: PAGES.length, label: "Iniciando..." });

    const pdf     = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
    const pageW   = pdf.internal.pageSize.getWidth();
    const pageH   = pdf.internal.pageSize.getHeight();
    let firstPage = true;

    // ── Patch createPattern para evitar InvalidStateError ─────────────
    // html2canvas converte CSS gradients em canvas patterns internos.
    // Se o elemento renderizado tiver dimensão 0 (qualquer causa: width:0%,
    // flex shrink, overflow hidden, etc.), o canvas interno fica 0×0 e
    // createPattern lança InvalidStateError.
    //
    // Solução: intercepta createPattern e, quando recebe um canvas 0×0,
    // retorna um pattern transparente 1×1 em vez de lançar exceção.
    // Isso é seguro porque o elemento original é invisível de qualquer forma.
    const origCreatePattern = CanvasRenderingContext2D.prototype.createPattern;
    CanvasRenderingContext2D.prototype.createPattern = function (
      image: CanvasImageSource,
      repetition: string | null
    ): CanvasPattern | null {
      if (
        image instanceof HTMLCanvasElement &&
        (image.width === 0 || image.height === 0)
      ) {
        const fallback = document.createElement("canvas");
        fallback.width  = 1;
        fallback.height = 1;
        return origCreatePattern.call(this, fallback, repetition);
      }
      return origCreatePattern.call(this, image, repetition);
    };

    try {
      for (let i = 0; i < PAGES.length; i++) {
        const page = PAGES[i];
        this.progress.set({ running: true, current: i + 1, total: PAGES.length, label: page.title });

        await router.navigate([page.route]);
        await this.waitForPageReady(contentEl);

        const prev = { overflow: contentEl.style.overflow, height: contentEl.style.height };
        contentEl.style.overflow = "visible";
        contentEl.style.height   = "auto";

        // ── Expande painéis e accordions no DOM real ─────────────────
        // html2canvas mede scrollWidth/scrollHeight no DOM original ANTES
        // de clonar. Se os painéis estiverem fechados, o canvas fica pequeno
        // demais e o conteúdo expandido é cortado.
        const savedPanels = this.expandPanels(contentEl);
        const savedAccordions = this.expandAccordions(contentEl);
        // Força reflow para o browser recalcular scrollHeight
        void contentEl.offsetHeight;

        // Coleta pontos de quebra ANTES da captura (DOM está expandido e com layout correto)
        const breakPoints = this.collectBreakPoints(contentEl);

        let canvas: HTMLCanvasElement;
        try {
          canvas = await this.captureWithTimeout(html2canvas, contentEl);
        } finally {
          contentEl.style.overflow = prev.overflow;
          contentEl.style.height   = prev.height;
          this.restorePanels(savedPanels);
          this.restoreAccordions(savedAccordions);
        }

        const margin    = 4;
        const usableW   = pageW - margin * 2;
        const headerH   = 10;
        const topOffset = headerH + 2;
        const usableH   = pageH - topOffset - margin;
        const imgH      = (canvas.height * usableW) / canvas.width;

        if (!firstPage) pdf.addPage();
        firstPage = false;

        this.drawHeader(pdf, page.title, pageW, headerH);

        if (imgH <= usableH) {
          pdf.addImage(canvas.toDataURL("image/jpeg", IMG_QUALITY), "JPEG", margin, topOffset, usableW, imgH);
        } else {
          this.addSlicedPages(
            pdf, canvas, breakPoints,
            page.title, margin, usableW, usableH, headerH, topOffset, pageW
          );
        }
      }

      // Rodapé na última página
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, pageH - 8, pageW, 8, "F");
      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        "FinControl — Execução Financeira do Termo de Colaboração da Estratégia de Inovação Aberta",
        pageW / 2, pageH - 3, { align: "center" }
      );

      const today = new Date().toISOString().split("T")[0];
      pdf.save(`fincontrol-relatorio-${today}.pdf`);

    } catch (err) {
      console.error("[PdfExport] falha durante a exportação:", err);
      this.progress.set({
        running: false, current: 0, total: PAGES.length,
        label: `Erro: ${err instanceof Error ? err.message : "falha inesperada"}`
      });
      return;
    } finally {
      // Sempre restaura o createPattern original e navega de volta
      CanvasRenderingContext2D.prototype.createPattern = origCreatePattern;
      await router.navigate([originalRoute]);
    }

    this.progress.set({ running: false, current: PAGES.length, total: PAGES.length, label: "Concluído" });
  }

  /**
   * Executa html2canvas com timeout de segurança.
   */
  private captureWithTimeout(
    html2canvas: (el: HTMLElement, opts: object) => Promise<HTMLCanvasElement>,
    contentEl: HTMLElement
  ): Promise<HTMLCanvasElement> {
    const opts = {
      scale: SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg-primary").trim() || "#0f172a",
      scrollX: 0,
      scrollY: 0,
      width:        contentEl.scrollWidth,
      height:       contentEl.scrollHeight,
      windowWidth:  contentEl.scrollWidth,
      windowHeight: contentEl.scrollHeight,
      ignoreElements: (el: Element) => el.classList.contains("pdf-ignore"),
      onclone: (_doc: Document, clonedEl: HTMLElement) => {
        // ── Copia canvases dos charts ────────────────────────────────
        const srcCanvases    = Array.from(contentEl.querySelectorAll("canvas")) as HTMLCanvasElement[];
        const clonedCanvases = Array.from(clonedEl.querySelectorAll("canvas"))  as HTMLCanvasElement[];
        srcCanvases.forEach((src, idx) => {
          const dst = clonedCanvases[idx];
          if (dst && src.width > 0 && src.height > 0) {
            try {
              dst.width  = src.width;
              dst.height = src.height;
              dst.getContext("2d")?.drawImage(src, 0, 0);
            } catch {
              // Canvas pode estar tainted — ignora
            }
          }
        });

        // ── Expande painéis do Angular Material ──────────────────────
        (Array.from(clonedEl.querySelectorAll("mat-expansion-panel")) as HTMLElement[])
          .forEach((panel) => {
            panel.classList.add("mat-expanded");
            const body = panel.querySelector(".mat-expansion-panel-body") as HTMLElement | null;
            if (body) {
              body.style.display    = "block";
              body.style.overflow   = "visible";
              body.style.height     = "auto";
              body.style.visibility = "visible";
            }
            const indicator = panel.querySelector(".mat-expansion-indicator") as HTMLElement | null;
            if (indicator) indicator.style.transform = "rotate(180deg)";
          });

        // ── Expande accordions customizados (filtros do fluxo-caixa) ─
        (Array.from(clonedEl.querySelectorAll(".accordion")) as HTMLElement[])
          .forEach((acc) => {
            acc.classList.add("open");
            const body = acc.querySelector(".accordion-body") as HTMLElement | null;
            if (body) {
              body.style.maxHeight  = "none";
              body.style.overflow   = "visible";
              body.style.height     = "auto";
              body.style.visibility = "visible";
            }
          });
      },
    };

    const capture = html2canvas(contentEl, opts);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`html2canvas timeout após ${CANVAS_CAPTURE_TIMEOUT / 1000}s`)), CANVAS_CAPTURE_TIMEOUT)
    );
    return Promise.race([capture, timeout]);
  }

  /**
   * Espera inteligente após navegação de rota.
   */
  private async waitForPageReady(contentEl: HTMLElement): Promise<void> {
    await this.delay(150);

    await new Promise<void>(resolve => {
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; resolve(); } };

      const sub = this.appRef.isStable
        .pipe(first(stable => stable))
        .subscribe({ next: done, error: done, complete: done });

      setTimeout(() => { try { sub.unsubscribe(); } catch { /* ignore */ } done(); }, STABLE_TIMEOUT);
    });

    await this.waitForCanvases(contentEl);
    await this.delay(POST_STABLE_MS);
  }

  /**
   * Aguarda pelo menos um canvas com conteúdo. Retorna imediatamente se não houver canvas.
   */
  private async waitForCanvases(contentEl: HTMLElement): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < CANVAS_TIMEOUT) {
      const canvases = contentEl.querySelectorAll("canvas");
      if (canvases.length === 0) return;
      const rendered = Array.from(canvases).some(
        (c) => (c as HTMLCanvasElement).width > 0 && (c as HTMLCanvasElement).height > 0
      );
      if (rendered) return;
      await this.delay(100);
    }
  }

  private drawHeader(pdf: any, title: string, pageW: number, h: number): void {
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageW, h, "F");
    pdf.setTextColor(248, 250, 252);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(title.toUpperCase(), pageW / 2, h - 3, { align: "center" });
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
      pageW - 5, h - 3, { align: "right" }
    );
  }

  // ── Break points e paginação inteligente ─────────────────────────

  /**
   * Coleta posições verticais (em pixels de canvas) onde é seguro quebrar página.
   * Cada ponto corresponde ao topo de um bloco visual (card, chart, seção).
   */
  private collectBreakPoints(contentEl: HTMLElement): number[] {
    const containerRect = contentEl.getBoundingClientRect();
    const selector =
      "mat-card, mat-expansion-panel, .charts-row, h1, " +
      ".kpi-grid, .kpi-grid-classic, .chart-wrapper, .chart-wrapper-small, " +
      ".table-container, .utilization-card, .chart-card";

    const points: number[] = [0];
    contentEl.querySelectorAll<HTMLElement>(selector).forEach(el => {
      const top = Math.round((el.getBoundingClientRect().top - containerRect.top) * SCALE);
      if (top > 0) points.push(top);
    });
    points.sort((a, b) => a - b);
    // Remove pontos duplicados ou muito próximos (< 30px canvas)
    return points.filter((v, i, arr) => i === 0 || v - arr[i - 1] >= 30);
  }

  /**
   * Adiciona páginas fatiadas ao PDF usando break points inteligentes.
   * Em vez de cortar em intervalos fixos (que partiam gráficos ao meio),
   * quebra na fronteira de seção mais próxima que cabe na folha.
   */
  private addSlicedPages(
    pdf: any, canvas: HTMLCanvasElement, breakPoints: number[],
    title: string, margin: number, usableW: number, usableH: number,
    headerH: number, topOffset: number, pageW: number
  ): void {
    const totalPx = canvas.height;
    const imgH    = (totalPx * usableW) / canvas.width;
    const slicePx = Math.floor(totalPx * (usableH / imgH));

    let srcOffY    = 0;
    let firstSlice = true;

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    const ctx = sliceCanvas.getContext("2d")!;

    while (srcOffY < totalPx) {
      const maxEnd = Math.min(srcOffY + slicePx, totalPx);

      // Encontra o melhor ponto de quebra que cabe dentro desta página.
      // Percorre os break points e pega o último que não ultrapassa maxEnd.
      let bestEnd = maxEnd;
      if (maxEnd < totalPx) {
        let candidate = srcOffY; // fallback: corte fixo se nenhum break point servir
        for (const bp of breakPoints) {
          if (bp <= srcOffY + 30) continue; // ignora pontos no início da fatia
          if (bp > maxEnd) break;            // passou do limite
          candidate = bp;
        }
        if (candidate > srcOffY) bestEnd = candidate;
      }

      const thisPx  = bestEnd - srcOffY;
      const thisMmH = (thisPx * usableW) / canvas.width;

      sliceCanvas.height = thisPx;
      ctx.drawImage(canvas, 0, srcOffY, canvas.width, thisPx, 0, 0, canvas.width, thisPx);

      pdf.addImage(
        sliceCanvas.toDataURL("image/jpeg", IMG_QUALITY), "JPEG",
        margin, firstSlice ? topOffset : margin, usableW, thisMmH
      );

      srcOffY = bestEnd;
      if (srcOffY < totalPx) {
        pdf.addPage();
        this.drawHeader(pdf, `${title} (cont.)`, pageW, headerH);
      }
      firstSlice = false;
    }
  }

  // ── Expansão de mat-expansion-panel no DOM real ──────────────────

  private expandPanels(root: HTMLElement): Array<{
    panel: HTMLElement;
    content: HTMLElement | null;
    hadExpanded: boolean;
    prevContentStyle: { height: string; visibility: string; overflow: string } | null;
  }> {
    const saved: ReturnType<PdfExportService["expandPanels"]> = [];
    root.querySelectorAll<HTMLElement>("mat-expansion-panel").forEach(panel => {
      const hadExpanded = panel.classList.contains("mat-expanded");
      panel.classList.add("mat-expanded");

      // Angular Material 18: o wrapper .mat-expansion-panel-content controla
      // height/visibility via inline styles da animação. Precisamos forçar.
      const content = panel.querySelector(".mat-expansion-panel-content") as HTMLElement | null;
      let prevContentStyle: typeof saved[0]["prevContentStyle"] = null;
      if (content) {
        prevContentStyle = {
          height:     content.style.height,
          visibility: content.style.visibility,
          overflow:   content.style.overflow,
        };
        content.style.height     = "auto";
        content.style.visibility = "visible";
        content.style.overflow   = "visible";
      }

      // Também garante que .mat-expansion-panel-body esteja visível
      const body = panel.querySelector(".mat-expansion-panel-body") as HTMLElement | null;
      if (body) {
        body.style.display    = "block";
        body.style.overflow   = "visible";
        body.style.height     = "auto";
        body.style.visibility = "visible";
      }

      saved.push({ panel, content, hadExpanded, prevContentStyle });
    });
    return saved;
  }

  private restorePanels(saved: ReturnType<PdfExportService["expandPanels"]>): void {
    saved.forEach(({ panel, content, hadExpanded, prevContentStyle }) => {
      if (!hadExpanded) panel.classList.remove("mat-expanded");
      if (content && prevContentStyle) {
        content.style.height     = prevContentStyle.height;
        content.style.visibility = prevContentStyle.visibility;
        content.style.overflow   = prevContentStyle.overflow;
      }
    });
  }

  // ── Expansão de accordions customizados (.accordion) ───────────────

  private expandAccordions(root: HTMLElement): Array<{
    acc: HTMLElement;
    hadOpen: boolean;
    body: HTMLElement | null;
    prevBodyStyle: { maxHeight: string; overflow: string; height: string; visibility: string } | null;
  }> {
    const saved: ReturnType<PdfExportService["expandAccordions"]> = [];
    root.querySelectorAll<HTMLElement>(".accordion").forEach(acc => {
      const hadOpen = acc.classList.contains("open");
      acc.classList.add("open");

      const body = acc.querySelector(".accordion-body") as HTMLElement | null;
      let prevBodyStyle: typeof saved[0]["prevBodyStyle"] = null;
      if (body) {
        prevBodyStyle = {
          maxHeight:  body.style.maxHeight,
          overflow:   body.style.overflow,
          height:     body.style.height,
          visibility: body.style.visibility,
        };
        body.style.maxHeight  = "none";
        body.style.overflow   = "visible";
        body.style.height     = "auto";
        body.style.visibility = "visible";
      }
      saved.push({ acc, hadOpen, body, prevBodyStyle });
    });
    return saved;
  }

  private restoreAccordions(saved: ReturnType<PdfExportService["expandAccordions"]>): void {
    saved.forEach(({ acc, hadOpen, body, prevBodyStyle }) => {
      if (!hadOpen) acc.classList.remove("open");
      if (body && prevBodyStyle) {
        body.style.maxHeight  = prevBodyStyle.maxHeight;
        body.style.overflow   = prevBodyStyle.overflow;
        body.style.height     = prevBodyStyle.height;
        body.style.visibility = prevBodyStyle.visibility;
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
