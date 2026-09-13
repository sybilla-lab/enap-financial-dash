import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
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

  /**
   * Média simples das razões por projeto — não é ponderada por volume.
   * Responde pergunta diferente da execução consolidada do Dashboard
   * (Σ executado ÷ Σ recebido), por isso o rótulo precisa dizer qual é.
   */
  readonly formulaExecucaoMedia =
    'Média aritmética simples de (executado ÷ recebido) entre os projetos ativos ' +
    'com recurso recebido. Não é ponderada pelo volume de cada projeto.';

  ultimaAtualizacao = new Date();
  sobreExpandido = false;

  constructor(private data: DataService) { }

  ngOnInit(): void {

    this.sub = combineLatest({
      indicadores: this.data.getIndicadoresOperacionais(),
      projetos: this.data.getProjetoResumos(),
    }).subscribe(({ indicadores, projetos }) => {
      this.totalRecebido = indicadores.totalRecebido;
      this.metaTotal = this.data.META_TOTAL;
      this.percentualRecebido = this.metaTotal
        ? Math.min(100, Math.round((this.totalRecebido / this.metaTotal) * 100))
        : 0;

      this.totalExecutado = indicadores.totalExecutado;
      this.saldoDisponivel = indicadores.saldoDisponivel;
      this.percentualExecucao = Math.min(100, Math.round(indicadores.percentualExecucao));

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
