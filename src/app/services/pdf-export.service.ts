import { Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface ExportProgress {
  running: boolean;
  current: number;
  total: number;
  label: string;
}

const PAGES = [
  { route: "/dashboard",    title: "Dashboard",              wait: 3500 },
  { route: "/recursos",     title: "Recursos",               wait: 3500 },
  { route: "/projetos",     title: "Projetos",               wait: 3500 },
  { route: "/fluxo-caixa",  title: "Fluxo de Caixa",         wait: 2500 },
  { route: "/saldos",       title: "Saldos Remanescentes",   wait: 2500 },
  { route: "/rendimentos",  title: "Rendimentos",            wait: 2500 },
  { route: "/categorias",   title: "Categorias",             wait: 2500 },
];

@Injectable({ providedIn: "root" })
export class PdfExportService {
  readonly progress = signal<ExportProgress>({
    running: false, current: 0, total: PAGES.length, label: ""
  });

  async exportAll(router: Router, contentEl: HTMLElement): Promise<void> {
    const originalRoute = router.url;

    this.progress.set({ running: true, current: 0, total: PAGES.length, label: "Iniciando..." });

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    let firstPage = true;

    for (let i = 0; i < PAGES.length; i++) {
      const page = PAGES[i];
      this.progress.set({ running: true, current: i + 1, total: PAGES.length, label: page.title });

      // router.navigate() retorna Promise<boolean> que resolve após NavigationEnd
      await router.navigate([page.route]);

      // Aguarda renderização completa dos gráficos e dados assíncronos
      await this.delay(page.wait);

      // Expande temporariamente para captura completa
      const prev = { overflow: contentEl.style.overflow, height: contentEl.style.height };
      contentEl.style.overflow = "visible";
      contentEl.style.height   = "auto";

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(contentEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg-primary").trim() || "#0f172a",
          scrollX: 0,
          scrollY: 0,
          width:        contentEl.scrollWidth,
          height:       contentEl.scrollHeight,
          windowWidth:  contentEl.scrollWidth,
          windowHeight: contentEl.scrollHeight,
          ignoreElements: (el) => el.classList.contains("pdf-ignore"),
          onclone: (_doc, clonedEl) => {
            // Transfere conteúdo dos canvas Chart.js para o clone
            const srcCanvases    = Array.from(contentEl.querySelectorAll("canvas")) as HTMLCanvasElement[];
            const clonedCanvases = Array.from(clonedEl.querySelectorAll("canvas"))  as HTMLCanvasElement[];
            srcCanvases.forEach((src, idx) => {
              const dst = clonedCanvases[idx];
              if (dst && src.width > 0 && src.height > 0) {
                dst.width  = src.width;
                dst.height = src.height;
                dst.getContext("2d")?.drawImage(src, 0, 0);
              }
            });
          },
        });
      } finally {
        contentEl.style.overflow = prev.overflow;
        contentEl.style.height   = prev.height;
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const margin  = 4;
      const usableW = pageW - margin * 2;
      const headerH = 10;
      const imgH    = (canvas.height * usableW) / canvas.width;

      if (!firstPage) pdf.addPage();
      firstPage = false;

      this.drawHeader(pdf, page.title, pageW, headerH);

      const topOffset = headerH + 2;
      const usableH   = pageH - topOffset - margin;

      if (imgH <= usableH) {
        pdf.addImage(imgData, "JPEG", margin, topOffset, usableW, imgH);
      } else {
        // Divide em fatias de altura pageH cada
        const totalPx  = canvas.height;
        const slicePx  = Math.floor(totalPx * (usableH / imgH));
        let   srcOffY  = 0;
        let   firstSlice = true;

        while (srcOffY < totalPx) {
          const thisPx    = Math.min(slicePx, totalPx - srcOffY);
          const thisMmH   = (thisPx * usableW) / canvas.width;
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width  = canvas.width;
          sliceCanvas.height = thisPx;
          sliceCanvas.getContext("2d")!.drawImage(canvas, 0, srcOffY, canvas.width, thisPx, 0, 0, canvas.width, thisPx);
          const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
          const yPos = firstSlice ? topOffset : margin;
          pdf.addImage(sliceData, "JPEG", margin, yPos, usableW, thisMmH);
          srcOffY += thisPx;
          if (srcOffY < totalPx) {
            pdf.addPage();
            this.drawHeader(pdf, `${page.title} (cont.)`, pageW, headerH);
          }
          firstSlice = false;
        }
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

    await router.navigate([originalRoute]);
    this.progress.set({ running: false, current: PAGES.length, total: PAGES.length, label: "Concluído" });

    const today = new Date().toISOString().split("T")[0];
    pdf.save(`fincontrol-relatorio-${today}.pdf`);
  }

  private drawHeader(pdf: jsPDF, title: string, pageW: number, h: number): void {
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
