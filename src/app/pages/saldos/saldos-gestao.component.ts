import { Component, OnInit } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatTableModule } from "@angular/material/table";
import { MatDividerModule } from "@angular/material/divider";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { DataService } from "../../services/data.service";
import { SaldoRemanescente } from "../../models/lancamento.model";

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
  totalRemanescente = 0;
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
