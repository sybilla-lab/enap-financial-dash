import { Component, OnInit, Inject, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { BaseChartDirective } from "ng2-charts";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { ChartConfiguration } from "chart.js";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

@Component({
  selector: "app-modal-execucao",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, BaseChartDirective, DragDropModule],
  templateUrl: "./modal-execucao.component.html",
  styleUrl: "./modal-execucao.component.scss",
})
export class ModalExecucaoComponent implements OnInit {
  chartData: ChartConfiguration<"bar">["data"] = { labels: [], datasets: [] };
  chartOptions: any = {
    responsive: true, maintainAspectRatio: false, indexAxis: "y",
    plugins: {
      legend: { position: "bottom", labels: { color: "#d1d5db", font: { weight: "bold" } } },
      datalabels: { display: false }
    },
    layout: { padding: { right: 50 } },
    scales: {
      x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.03)" }, max: 100 },
      y: { ticks: { color: "#94a3b8" }, grid: { display: false } },
    }
  };
  renderChart = false;

  constructor(
    public dialogRef: MatDialogRef<ModalExecucaoComponent>,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: { projeto: string; execucao: number }[]
  ) { }

  ngOnInit() {
    setTimeout(() => {
      this.chartData = {
        labels: this.data.map(d => d.projeto),
        datasets: [{
          label: "Execução %",
          data: this.data.map(d => Math.min(d.execucao, 100)),
          backgroundColor: "#F87171",
          borderRadius: 4
        }]
      };
      this.renderChart = true;
      this.cdr.detectChanges();
    }, 400);
  }
}
