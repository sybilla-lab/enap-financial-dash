import { Component, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatTableModule } from "@angular/material/table";
import { MatDividerModule } from "@angular/material/divider";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import {
  SaldoRemanescente,
  EventoHistorico,
  TipoEventoHistorico,
} from "../../models/lancamento.model";

const ROTULOS: Record<TipoEventoHistorico, string> = {
  destinacao: "Destinação de rendimentos",
  transferencia: "Saldo devolvido",
  encerramento: "Encerramento",
  pendencia: "Conciliação",
};

const ICONES: Record<TipoEventoHistorico, string> = {
  destinacao: "call_split",
  transferencia: "undo",
  encerramento: "flag",
  pendencia: "help_outline",
};

/** Ordem de exibição dos filtros — não depende da ordem em que os dados chegam. */
const ORDEM_TIPOS: TipoEventoHistorico[] = [
  "destinacao",
  "transferencia",
  "encerramento",
  "pendencia",
];

@Component({
  selector: "app-saldos",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatDividerModule,
    BaseChartDirective,
  ],
  providers: [CurrencyPipe, DecimalPipe],
  templateUrl: "./saldos-gestao.component.html",
  styleUrl: "./saldos-gestao.component.scss",
})
export class SaldosGestaoComponent implements OnInit {
  saldos: SaldoRemanescente[] = [];
  eventos: EventoHistorico[] = [];
  eventosFiltrados: EventoHistorico[] = [];
  tipoFiltro: TipoEventoHistorico | null = null;
  tiposDisponiveis: { tipo: TipoEventoHistorico; rotulo: string; quantidade: number }[] = [];

  totalRemanescente = 0;
  totalDestinado = 0;
  totalPendente = 0;
  qtdDestinacoes = 0;
  qtdPendencias = 0;
  eficienciaMedia = 0;

  public barChartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  public barChartOptions: ChartConfiguration<"bar">["options"] = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: "#1e293b",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8", font: { size: 11 } },
        grid: { display: false }
      },
      y: {
        ticks: { color: "#94a3b8", font: { size: 11 } },
        grid: { color: "rgba(255,255,255,0.05)" }
      }
    }
  };

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.dataService.getSaldos().subscribe(data => {
      this.saldos = data;
      this.totalRemanescente = data.reduce((acc, curr) => acc + curr.valorTransferido, 0);

      const eficiencias = data.filter(d => d.valorProjeto > 0).map(d => 100 - d.percentualSobra);
      this.eficienciaMedia = eficiencias.length > 0 ? eficiencias.reduce((a, b) => a + b, 0) / eficiencias.length : 0;

      this.updateChart();
    });

    this.dataService.getHistoricoMovimentacoes().subscribe(eventos => {
      this.eventos = eventos;

      const destinacoes = eventos.filter(e => e.tipo === "destinacao");
      this.totalDestinado = destinacoes.reduce((s, e) => s + e.valor, 0);
      this.qtdDestinacoes = destinacoes.length;

      const pendencias = eventos.filter(e => e.tipo === "pendencia");
      this.totalPendente = pendencias.reduce((s, e) => s + e.valor, 0);
      this.qtdPendencias = pendencias.length;

      this.tiposDisponiveis = ORDEM_TIPOS
        .map(tipo => ({
          tipo,
          rotulo: ROTULOS[tipo],
          quantidade: eventos.filter(e => e.tipo === tipo).length,
        }))
        .filter(t => t.quantidade > 0);

      this.aplicarFiltro();
    });
  }

  filtrarPorTipo(tipo: TipoEventoHistorico | null): void {
    this.tipoFiltro = tipo;
    this.aplicarFiltro();
  }

  private aplicarFiltro(): void {
    this.eventosFiltrados = this.tipoFiltro
      ? this.eventos.filter(e => e.tipo === this.tipoFiltro)
      : this.eventos;
  }

  rotuloDe(tipo: TipoEventoHistorico): string {
    return ROTULOS[tipo];
  }

  iconeDe(tipo: TipoEventoHistorico): string {
    return ICONES[tipo];
  }

  updateChart() {
    this.dataService.getSaldosPorParceiro().subscribe(mapa => {
      this.barChartData = {
        labels: mapa.map(m => m.parceiro),
        datasets: [{
          data: mapa.map(m => m.valor),
          backgroundColor: "#3b82f6",
          borderRadius: 6,
          barThickness: 30
        }]
      };
    });
  }

  getEfficiencyColor(sobraPct: number): string {
    const ef = 100 - sobraPct;
    if (ef > 90) return "#10b981"; // Verde (Muito eficiente)
    if (ef > 75) return "#FBBF24"; // Amarelo
    return "#f43f5e"; // Vermelho
  }
}
