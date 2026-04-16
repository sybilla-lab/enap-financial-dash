import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe } from "@angular/common";
import { RouterModule } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatSliderModule } from "@angular/material/slider";
import { FormsModule } from "@angular/forms";
import { Subscription, combineLatest } from "rxjs";
import { DataService } from "../../services/data.service";
import { ProjetoResumo } from "../../models/lancamento.model";
import { environment } from "../../../environments/environment";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule, MatSliderModule, FormsModule],
  templateUrl: "./home.component.html",
  styleUrl: "./home.component.scss",
})
export class HomeComponent implements OnInit, OnDestroy {
  private sub?: Subscription;
  private timelineSub?: Subscription;

  carregando = true;
  readonly featureAuditoria = environment.features?.auditoria === true;

  timelineTicks: { label: string; value: number }[] = [];
  currentTimelineIndex: number = 0;
  isTimelineAllTime: boolean = true;
  timelineLabelCurrent: string = "Tempo Real (Visão Integral)";

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

  ultimaAtualizacao = new Date();

  // Citação rotativa (muda a cada reload)
  frase = "";
  private frases = [
    "Transparência é o melhor investimento.",
    "Cada centavo contado é um projeto bem executado.",
    "Gestão financeira que entrega inovação.",
    "O controle vira confiança quando é compartilhado.",
  ];

  constructor(private data: DataService) { }

  ngOnInit(): void {
    this.frase = this.frases[Math.floor(Math.random() * this.frases.length)];

    this.timelineSub = this.data.getTimelineTicks().subscribe((ticks) => {
      this.timelineTicks = ticks;
      if (ticks.length > 0 && this.isTimelineAllTime) {
        this.currentTimelineIndex = ticks.length;
      }
    });

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
        .filter((p) => p.entradas > 0)
        .sort((a, b) => b.saidas - a.saidas)
        .slice(0, 4);

      this.carregando = false;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.timelineSub?.unsubscribe();
  }

  formatTimelineLabel = (value: number): string => {
    if (value >= this.timelineTicks.length) return "Integral";
    return this.timelineTicks[value]?.label || "";
  }

  onTimelineChange(index: number): void {
    if (index >= this.timelineTicks.length) {
      this.isTimelineAllTime = true;
      this.timelineLabelCurrent = "Tempo Real (Visão Integral)";
      this.data.setTimeFilter(null);
    } else {
      this.isTimelineAllTime = false;
      const tick = this.timelineTicks[index];
      this.timelineLabelCurrent = `Cenário retrospectivo até: ${tick.label}`;
      this.data.setTimeFilter(tick.value);
    }
  }

  statusClass(status?: string): string {
    const s = (status || "").toLowerCase();
    if (s.includes("finaliza")) return "status-finalizado";
    if (s.includes("encerra")) return "status-encerrando";
    return "status-ativo";
  }
}
