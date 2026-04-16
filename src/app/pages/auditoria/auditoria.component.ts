import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Subscription } from "rxjs";
import * as XLSX from "xlsx";
import { DataService } from "../../services/data.service";
import { Lancamento } from "../../models/lancamento.model";

interface AuditoriaItem {
  numero: string;
  linhaPlanilha: number;
  encontrado: boolean;
  lancamento?: Lancamento;
  dataTexto: string;
  dataObj?: Date;
  ano?: number;
  mes?: number;
}

const MESES = [
  { num: 1, label: "Jan" }, { num: 2, label: "Fev" }, { num: 3, label: "Mar" },
  { num: 4, label: "Abr" }, { num: 5, label: "Mai" }, { num: 6, label: "Jun" },
  { num: 7, label: "Jul" }, { num: 8, label: "Ago" }, { num: 9, label: "Set" },
  { num: 10, label: "Out" }, { num: 11, label: "Nov" }, { num: 12, label: "Dez" },
];

@Component({
  selector: "app-auditoria",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: "./auditoria.component.html",
  styleUrl: "./auditoria.component.scss",
})
export class AuditoriaComponent implements OnInit, OnDestroy {
  private sub?: Subscription;
  private baseSet = new Set<string>();
  private baseMap = new Map<string, Lancamento>();

  readonly meses = MESES;

  fileName = "";
  totalBase = 0;
  totalCanceladasIgnoradas = 0;

  todosItens: AuditoriaItem[] = [];

  processando = false;
  dragging = false;
  erro = "";
  abaAtiva: "faltantes" | "encontrados" = "faltantes";

  filtroEncontrados = "";
  filtroFaltantes = "";

  anosComMeses: { ano: number, meses: { num: number, label: string }[] }[] = [];
  periodosSelecionados = new Set<string>();
  temCampoData = false;
  filtrosExpandidos = false;

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.sub = this.data.lancamentos$.subscribe((lanc) => {
      this.baseSet.clear();
      this.baseMap.clear();
      for (const l of lanc) {
        const k = this.normalizar(l.numPag);
        if (k) {
          this.baseSet.add(k);
          if (!this.baseMap.has(k)) this.baseMap.set(k, l);
        }
      }
      this.totalBase = this.baseSet.size;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private normalizar(v: any): string {
    if (v === null || v === undefined) return "";
    return String(v).trim().replace(/\s+/g, "").toUpperCase();
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.dragging = true;
  }
  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.dragging = false;
  }
  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragging = false;
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.processarArquivo(file);
  }
  onFileSelect(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processarArquivo(file);
  }

  limpar(): void {
    this.fileName = "";
    this.todosItens = [];
    this.totalCanceladasIgnoradas = 0;
    this.anosComMeses = [];
    this.periodosSelecionados.clear();
    this.temCampoData = false;
    this.erro = "";
  }

  private processarArquivo(file: File): void {
    this.erro = "";
    this.processando = true;
    this.fileName = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array", cellDates: true });
          const firstSheet = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheet];
          const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

        if (!json.length) {
          this.erro = "Planilha vazia.";
          this.processando = false;
          return;
        }

        const colKey = this.encontrarColunaNumero(json[0]);
        if (!colKey) {
          this.erro = 'Coluna "Numero" não encontrada na planilha.';
          this.processando = false;
          return;
        }

        const colSituacao = this.encontrarColunaSituacao(json[0]);
        const colData = this.encontrarColunaData(json[0]);
        this.temCampoData = !!colData;
        const CANCELADA = this.normalizar("Movimentação Financeira Cancelada");

        const itens: AuditoriaItem[] = [];
        const anosMap = new Map<number, Set<number>>();
        let canceladas = 0;
        json.forEach((row, idx) => {
          if (colSituacao) {
            const sit = this.normalizar(row[colSituacao]);
            if (sit === CANCELADA) {
              canceladas++;
              return;
            }
          }
          const raw = row[colKey];
          const numero = this.normalizar(raw);
          if (!numero) return;

          const dataTexto = colData ? String(row[colData] || "").trim() : "";
          const dataObj = dataTexto ? this.parseData(dataTexto) : undefined;
          if (dataObj) {
            const a = dataObj.getFullYear();
            const m = dataObj.getMonth() + 1;
            if (!anosMap.has(a)) anosMap.set(a, new Set());
            anosMap.get(a)!.add(m);
          }

          const lanc = this.baseMap.get(numero);
          itens.push({
            numero: String(raw).trim(),
            linhaPlanilha: idx + 2,
            encontrado: this.baseSet.has(numero),
            lancamento: lanc,
            dataTexto,
            dataObj,
            ano: dataObj?.getFullYear(),
            mes: dataObj ? dataObj.getMonth() + 1 : undefined,
          });
        });

        this.totalCanceladasIgnoradas = canceladas;
        this.todosItens = itens;
        this.anosComMeses = Array.from(anosMap.entries()).map(([ano, mesesSet]) => ({
             ano,
             meses: Array.from(mesesSet).sort((a, b) => a - b).map(num => MESES.find(x => x.num === num)!)
        })).sort((a, b) => b.ano - a.ano);
        this.periodosSelecionados.clear();
        this.anosComMeses.forEach(g => g.meses.forEach(m => this.periodosSelecionados.add(`${g.ano}-${m.num}`)));
        this.abaAtiva = this.totalFaltante > 0 ? "faltantes" : "encontrados";
        } catch (err: any) {
          this.erro = "Falha ao ler planilha: " + (err?.message || err);
        } finally {
          this.processando = false;
        }
      }, 50);
    };
    reader.onerror = () => {
      this.erro = "Erro ao ler o arquivo.";
      this.processando = false;
    };
    reader.readAsArrayBuffer(file);
  }

  private parseData(v: any): Date | undefined {
    if (!v) return undefined;
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    const s = String(v).trim();

    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (br) {
      const dia = parseInt(br[1], 10);
      const mes = parseInt(br[2], 10) - 1;
      let ano = parseInt(br[3], 10);
      if (ano < 100) ano += 2000;
      const d = new Date(ano, mes, dia);
      return isNaN(d.getTime()) ? undefined : d;
    }

    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const d = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  }

  private encontrarColunaNumero(sample: any): string | null {
    const keys = Object.keys(sample);
    const alvo = keys.find((k) => this.normalizar(k) === "NUMERO" || this.normalizar(k) === "NÚMERO");
    if (alvo) return alvo;
    const contem = keys.find((k) => this.normalizar(k).includes("NUMERO"));
    return contem || null;
  }

  private encontrarColunaSituacao(sample: any): string | null {
    const keys = Object.keys(sample);
    const exata = keys.find((k) => {
      const n = this.normalizar(k);
      return n === "SITUACAO" || n === "SITUAÇÃO";
    });
    if (exata) return exata;
    const contem = keys.find((k) => this.normalizar(k).includes("SITUA"));
    if (contem) return contem;
    return keys.length ? keys[keys.length - 1] : null;
  }

  private encontrarColunaData(sample: any): string | null {
    const keys = Object.keys(sample);
    const exata = keys.find((k) => this.normalizar(k) === "DATA");
    if (exata) return exata;
    return keys.find((k) => this.normalizar(k).includes("DATA")) || null;
  }

  private passaFiltroData(item: AuditoriaItem): boolean {
    if (!this.temCampoData) return true;
    if (!item.ano || !item.mes) return !this.filtroDataAtivo;
    return this.periodosSelecionados.has(`${item.ano}-${item.mes}`);
  }

  get itensVisiveis(): AuditoriaItem[] {
    return this.todosItens.filter((i) => this.passaFiltroData(i));
  }

  get encontrados(): AuditoriaItem[] {
    return this.itensVisiveis.filter((i) => i.encontrado);
  }
  get faltantes(): AuditoriaItem[] {
    return this.itensVisiveis.filter((i) => !i.encontrado);
  }

  get totalEnviado(): number { return this.itensVisiveis.length; }
  get totalEncontrado(): number { return this.encontrados.length; }
  get totalFaltante(): number { return this.faltantes.length; }
  get percentualMatch(): number {
    return this.totalEnviado ? Math.round((this.totalEncontrado / this.totalEnviado) * 100) : 0;
  }

  get encontradosFiltrados(): AuditoriaItem[] {
    if (!this.filtroEncontrados) return this.encontrados;
    const q = this.normalizar(this.filtroEncontrados);
    return this.encontrados.filter((i) => this.normalizar(i.numero).includes(q));
  }

  get faltantesFiltrados(): AuditoriaItem[] {
    if (!this.filtroFaltantes) return this.faltantes;
    const q = this.normalizar(this.filtroFaltantes);
    return this.faltantes.filter((i) => this.normalizar(i.numero).includes(q));
  }

  isSelecionado(ano: number, mes: number): boolean {
    return this.periodosSelecionados.has(`${ano}-${mes}`);
  }

  togglePeriodo(ano: number, mes: number): void {
    const k = `${ano}-${mes}`;
    if (this.periodosSelecionados.has(k)) this.periodosSelecionados.delete(k);
    else this.periodosSelecionados.add(k);
    this.periodosSelecionados = new Set(this.periodosSelecionados);
  }

  selecionarGrupo(ano: number): void {
    const grupo = this.anosComMeses.find(g => g.ano === ano);
    if (grupo) {
       grupo.meses.forEach(m => this.periodosSelecionados.add(`${ano}-${m.num}`));
       this.periodosSelecionados = new Set(this.periodosSelecionados);
    }
  }

  limparGrupo(ano: number): void {
    const grupo = this.anosComMeses.find(g => g.ano === ano);
    if (grupo) {
       grupo.meses.forEach(m => this.periodosSelecionados.delete(`${ano}-${m.num}`));
       this.periodosSelecionados = new Set(this.periodosSelecionados);
    }
  }

  get totalPeriodos(): number {
    return this.anosComMeses.reduce((acc, g) => acc + g.meses.length, 0);
  }

  get filtroDataAtivo(): boolean {
    if (!this.temCampoData) return false;
    return this.periodosSelecionados.size !== this.totalPeriodos;
  }

  resetarFiltroData(): void {
    this.periodosSelecionados.clear();
    this.anosComMeses.forEach(g => g.meses.forEach(m => this.periodosSelecionados.add(`${g.ano}-${m.num}`)));
    this.periodosSelecionados = new Set(this.periodosSelecionados);
  }

  formatarData(item: AuditoriaItem): string {
    if (item.dataObj) {
      const d = item.dataObj;
      const dia = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      return `${dia}/${mes}/${d.getFullYear()}`;
    }
    return item.dataTexto || "";
  }

  exportarFaltantes(): void {
    this.exportar(this.faltantes, "auditoria-faltantes");
  }

  exportarEncontrados(): void {
    this.exportar(this.encontrados, "auditoria-encontrados");
  }

  private exportar(itens: AuditoriaItem[], nome: string): void {
    if (!itens.length) return;
    const data = itens.map((i) => ({
      Numero: i.numero,
      Data: this.formatarData(i),
      "Linha Planilha": i.linhaPlanilha,
      Status: i.encontrado ? "Encontrado" : "Não encontrado",
      Projeto: i.lancamento?.projeto || "",
      Categoria: i.lancamento?.categoria || "",
      Valor: i.lancamento?.valor || "",
      "Mês/Ano": i.lancamento?.mesAno || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${nome}-${stamp}.xlsx`);
  }
}
