import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Subscription } from "rxjs";
import * as XLSX from "xlsx";
import { DataService } from "../../services/data.service";
import { Lancamento } from "../../models/lancamento.model";
import { AuthService } from "../../auth/auth.service";

interface AuditoriaItem {
  numero: string;
  linhaPlanilha: number;
  encontrado: boolean;
  lancamento?: Lancamento;
  dataTexto: string;
  dataObj?: Date;
  ano?: number;
  mes?: number;
  fornecedor?: string;
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
  todosItens: AuditoriaItem[] = [];
  erro = "";
  processando = false;
  dragging = false;

  totalCanceladasIgnoradas = 0;
  totalEstornadasIgnoradas = 0;

  abaAtiva: "faltantes" | "encontrados" = "faltantes";

  filtroEncontrados = "";
  filtroFaltantes = "";

  anosComMeses: { ano: number, meses: { num: number, label: string }[] }[] = [];
  periodosSelecionados = new Set<string>();
  temCampoData = false;
  filtrosExpandidos = false;

  private auth = inject(AuthService);
  private router = inject(Router);

  usuario = this.auth.currentUser;

  constructor(private data: DataService) {}

  sair(): void {
    this.auth.signOut();
    this.router.navigate(["/"]);
  }

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
    this.totalEstornadasIgnoradas = 0;
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
          const json: any[] = XLSX.utils.sheet_to_json(ws, { header: "A", defval: "", raw: false });

        if (!json.length || json.length < 2) {
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

        const keysArr = Object.keys(json[0]);
        const headerRow = json[0];
        const dataRows = json.slice(1);

        const colSituacao = this.encontrarColunaSituacao(headerRow);
        const colData = this.encontrarColunaData(headerRow);
        
        const findC = (subs: string[], ignores: string[] = []): string | null => {
           for (const [k, v] of Object.entries(headerRow)) {
             const n = this.normalizar(String(v));
             if (subs.some(s => n.includes(this.normalizar(s))) && !ignores.some(i => n.includes(this.normalizar(i)))) {
               return k;
             }
           }
           return null;
        };

        const colBruto = "D";
        const colFavorecidoValor = "E";
        
        // Pelo seu Excel de importação, Fornecedor bate G(Cnpj) e H(Nome).
        const colCnpj = "G";
        let colRazao = "H"; 
        
        this.temCampoData = !!colData;
        const CANCELADA = this.normalizar("Movimentação Financeira Cancelada");

        const isZeroVal = (val: any): boolean => {
          if (val === 0 || val === "0" || val === "0,00" || val === "0.00") return true;
          if (!val || String(val).trim() === "" || String(val).trim() === "-") return true;
          const cln = String(val).replace(/[^\d,\.-]/g, "").replace(",", ".");
          if (!cln) return true;
          return parseFloat(cln) === 0;
        };

        const itens: AuditoriaItem[] = [];
        const anosMap = new Map<number, Set<number>>();
        let canceladas = 0;
        let estornadas = 0;
        dataRows.forEach((row, idx) => {
          if (colSituacao) {
            const sit = this.normalizar(row[colSituacao]);
            if (sit === CANCELADA) {
              canceladas++;
              return;
            }
          }
          
          if (colBruto && colFavorecidoValor) {
             if (isZeroVal(row[colBruto]) && isZeroVal(row[colFavorecidoValor])) {
                 estornadas++;
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

          const fCnpj = colCnpj ? String(row[colCnpj] || "").trim() : "";
          const fRazao = colRazao ? String(row[colRazao] || "").trim() : "";
          let fFinal = fCnpj;
          if (fRazao && fCnpj !== fRazao) {
              fFinal = fCnpj ? `${fRazao} (${fCnpj})` : fRazao;
          } else if (fRazao) {
              fFinal = fRazao;
          }

          const lanc = this.baseMap.get(numero);
          
          let fornecedorExibir = fFinal;
          if (lanc && lanc.fornecedor) {
             fornecedorExibir = fCnpj ? `${lanc.fornecedor} (${fCnpj})` : lanc.fornecedor;
          }

          itens.push({
            numero: String(raw).trim(),
            linhaPlanilha: idx + 2,
            encontrado: this.baseSet.has(numero),
            lancamento: lanc,
            dataTexto,
            dataObj,
            ano: dataObj?.getFullYear(),
            mes: dataObj ? dataObj.getMonth() + 1 : undefined,
            fornecedor: fornecedorExibir,
          });
        });

        this.totalCanceladasIgnoradas = canceladas;
        this.totalEstornadasIgnoradas = estornadas;
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

  private encontrarColunaNumero(headerRow: any): string | null {
    const entries = Object.entries(headerRow);
    const alvo = entries.find(([k, v]) => this.normalizar(String(v)) === "NUMERO" || this.normalizar(String(v)) === "NÚMERO");
    if (alvo) return alvo[0];
    const contem = entries.find(([k, v]) => this.normalizar(String(v)).includes("NUMERO"));
    return contem ? contem[0] : null;
  }

  private encontrarColunaSituacao(headerRow: any): string | null {
    const entries = Object.entries(headerRow);
    const exata = entries.find(([k, v]) => {
      const n = this.normalizar(String(v));
      return n === "SITUACAO" || n === "SITUAÇÃO";
    });
    if (exata) return exata[0];
    const contem = entries.find(([k, v]) => this.normalizar(String(v)).includes("SITUA"));
    if (contem) return contem[0];
    return entries.length ? entries[entries.length - 1][0] : null;
  }

  private encontrarColunaData(headerRow: any): string | null {
    const entries = Object.entries(headerRow);
    const exata = entries.find(([k, v]) => this.normalizar(String(v)) === "DATA");
    if (exata) return exata[0];
    const contem = entries.find(([k, v]) => this.normalizar(String(v)).includes("DATA"));
    return contem ? contem[0] : null;
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
      Fornecedor: i.fornecedor || "",
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
