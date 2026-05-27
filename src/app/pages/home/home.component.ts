import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe } from "@angular/common";
import { RouterModule } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Subscription, combineLatest } from "rxjs";
import { DataService } from "../../services/data.service";
import { ProjetoResumo } from "../../models/lancamento.model";
import { environment } from "../../../environments/environment";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.scss",
})
export class HomeComponent implements OnInit, OnDestroy {
  private sub?: Subscription;

  carregando = true;
  readonly featureAuditoria = environment.features?.auditoria === true;

  // KPIs
  totalRecebido = 0;
  totalExecutado = 0;
  saldoDisponivel = 0;
  metaTotal = 0;
  percentualExecucao = 0;
  percentualRecebido = 0;

  projetosAtivos = 0;
  projetosTotais = 0;
  projetosDestaque: ProjetoResumo[] = [];
  execucaoMedia = 0;

  ultimaAtualizacao = new Date();

  constructor(private data: DataService) { }

  ngOnInit(): void {

    this.sub = combineLatest({
      recurso: this.data.getRecursoDetalhado(),
      projetos: this.data.getProjetoResumos(),
    }).subscribe(({ recurso, projetos }) => {
      this.totalRecebido = recurso.totalRecebido;
      this.metaTotal = this.data.META_TOTAL;
      this.percentualRecebido = this.metaTotal
        ? Math.min(100, Math.round((this.totalRecebido / this.metaTotal) * 100))
        : 0;

      this.totalExecutado = projetos.reduce((sum, p) => sum + p.saidas, 0);
      this.saldoDisponivel = this.totalRecebido - this.totalExecutado;
      this.percentualExecucao = this.totalRecebido > 0
        ? Math.min(100, Math.round((this.totalExecutado / this.totalRecebido) * 100))
        : 0;

      this.projetosTotais = projetos.length;
      this.projetosAtivos = projetos.filter(
        (p) => (p.status || "").toLowerCase().includes("ativo")
      ).length;

      this.projetosDestaque = projetos
        .filter((p) => p.entradas > 0 && (p.status || "").toLowerCase().includes("ativo"))
        .sort((a, b) => b.execucao - a.execucao);

      this.execucaoMedia = this.projetosDestaque.length > 0
        ? this.projetosDestaque.reduce((s, p) => s + p.execucao, 0) / this.projetosDestaque.length
        : 0;

      this.carregando = false;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  statusClass(status?: string): string {
    const s = (status || "").toLowerCase();
    if (s.includes("finaliza")) return "status-finalizado";
    if (s.includes("encerra")) return "status-encerrando";
    return "status-ativo";
  }
}
