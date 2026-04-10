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
  selector: "app-modal-financiadores",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, BaseChartDirective, DragDropModule],
  templateUrl: "./modal-financiadores.component.html",
  styleUrl: "./modal-financiadores.component.scss",
})
export class ModalFinanciadoresComponent implements OnInit {
  chartData: ChartConfiguration<"doughnut">["data"] = { labels: [], datasets: [] };
  chartOptions: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: "right", labels: { color: "#d1d5db", font: { weight: "bold", size: 12 } } },
      datalabels: { display: false },
    }
  };
  renderChart = false;

  constructor(
    public dialogRef: MatDialogRef<ModalFinanciadoresComponent>,
    private cdr: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: { financiador: string; valor: number }[]
  ) { }

  ngOnInit() {
    setTimeout(() => {
      this.chartData = {
        labels: this.data.map(d => d.financiador),
        datasets: [{
          data: this.data.map(d => d.valor),
          backgroundColor: [
            "#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#ef4444",
            "#ec4899", "#14b8a6", "#f97316", "#a855f7", "#84cc16",
            "#06b6d4", "#e11d48", "#8b5cf6", "#22c55e", "#fb923c"
          ],
          borderWidth: 0
        }]
      };
      this.renderChart = true;
      this.cdr.detectChanges();
    }, 400);
  }
}
