import { Component, OnInit, computed, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { DataService } from "../../services/data.service";
import { CategoriaGlossario } from "../../models/lancamento.model";

@Component({
  selector: "app-glossario",
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatIconModule],
  templateUrl: "./glossario.component.html",
  styleUrl: "./glossario.component.scss",
})
export class GlossarioComponent implements OnInit {
  /** Fonte única: aba "Glossário de Categorias" da Base de Dados ENAP Financial Dash. */
  private itens = signal<CategoriaGlossario[]>([]);
  isLoading = signal(true);

  busca = signal("");
  metaSel = signal<string>("");
  etapaSel = signal<string>("");

  metas = computed(() =>
    [...new Set(this.itens().map(i => i.meta).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))
  );

  /** Etapas disponíveis respeitam a meta já escolhida. */
  etapas = computed(() => {
    const m = this.metaSel();
    const base = m ? this.itens().filter(i => i.meta === m) : this.itens();
    return [...new Set(base.map(i => i.etapa).filter(Boolean))];
  });

  filtrados = computed(() => {
    const q = this.normalizar(this.busca());
    const m = this.metaSel();
    const e = this.etapaSel();
    return this.itens()
      .filter(i => !m || i.meta === m)
      .filter(i => !e || i.etapa === e)
      .filter(i => !q ||
        this.normalizar(i.codigo).includes(q) ||
        this.normalizar(i.nome).includes(q) ||
        this.normalizar(i.descricao).includes(q))
      // Ordenação natural pelo código: 1.1.2 antes de 1.1.10.
      .sort((a, b) => DataService.compararCodigo(a.codigo, b.codigo));
  });

  totalItens = computed(() => this.itens().length);
  temFiltro = computed(() => !!(this.busca() || this.metaSel() || this.etapaSel()));

  /** Agrupa por etapa preservando a ordem já calculada. */
  grupos = computed(() => {
    const out: { etapa: string; meta: string; itens: CategoriaGlossario[] }[] = [];
    for (const i of this.filtrados()) {
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.etapa === i.etapa) ultimo.itens.push(i);
      else out.push({ etapa: i.etapa, meta: i.meta, itens: [i] });
    }
    return out;
  });

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getGlossario().subscribe(itens => {
      this.itens.set(itens);
      if (itens.length) this.isLoading.set(false);
    });
  }

  selecionarMeta(m: string): void {
    this.metaSel.set(this.metaSel() === m ? "" : m);
    // A etapa escolhida pode não pertencer à nova meta.
    if (!this.etapas().includes(this.etapaSel())) this.etapaSel.set("");
  }

  selecionarEtapa(e: string): void {
    this.etapaSel.set(this.etapaSel() === e ? "" : e);
  }

  limpar(): void {
    this.busca.set("");
    this.metaSel.set("");
    this.etapaSel.set("");
  }

  private normalizar(s: string): string {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }
}
