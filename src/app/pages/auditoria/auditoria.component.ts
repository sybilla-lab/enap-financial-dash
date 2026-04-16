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
}

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
  private lancamentos: Lancamento[] = [];
  private baseSet = new Set<string>();
  private baseMap = new Map<string, Lancamento>();

  fileName = "";
  totalBase = 0;
  totalEnviado = 0;
  totalEncontrado = 0;
  totalFaltante = 0;
  totalCanceladasIgnoradas = 0;
  percentualMatch = 0;

  encontrados: AuditoriaItem[] = [];
  faltantes: AuditoriaItem[] = [];

  processando = false;
  dragging = false;
  erro = "";
  abaAtiva: "faltantes" | "encontrados" = "faltantes";

  filtroEncontrados = "";
  filtroFaltantes = "";

  constructor(private data: DataService) {}

  ngOnInit(): void {
    this.sub = this.data.lancamentos$.subscribe((lanc) => {
      this.lancamentos = lanc;
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
    this.encontrados = [];
    this.faltantes = [];
    this.totalEnviado = 0;
    this.totalEncontrado = 0;
    this.totalFaltante = 0;
    this.totalCanceladasIgnoradas = 0;
    this.percentualMatch = 0;
    this.erro = "";
  }

  private processarArquivo(file: File): void {
    this.erro = "";
    this.processando = true;
    this.fileName = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
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
        const CANCELADA = this.normalizar("Movimentação Financeira Cancelada");

        const itens: AuditoriaItem[] = [];
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
          const lanc = this.baseMap.get(numero);
          itens.push({
            numero: String(raw).trim(),
            linhaPlanilha: idx + 2,
            encontrado: this.baseSet.has(numero),
            lancamento: lanc,
          });
        });
        this.totalCanceladasIgnoradas = canceladas;

        this.encontrados = itens.filter((i) => i.encontrado);
        this.faltantes = itens.filter((i) => !i.encontrado);
        this.totalEnviado = itens.length;
        this.totalEncontrado = this.encontrados.length;
        this.totalFaltante = this.faltantes.length;
        this.percentualMatch = this.totalEnviado
          ? Math.round((this.totalEncontrado / this.totalEnviado) * 100)
          : 0;
        this.abaAtiva = this.totalFaltante > 0 ? "faltantes" : "encontrados";
      } catch (err: any) {
        this.erro = "Falha ao ler planilha: " + (err?.message || err);
      } finally {
        this.processando = false;
      }
    };
    reader.onerror = () => {
      this.erro = "Erro ao ler o arquivo.";
      this.processando = false;
    };
    reader.readAsArrayBuffer(file);
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
