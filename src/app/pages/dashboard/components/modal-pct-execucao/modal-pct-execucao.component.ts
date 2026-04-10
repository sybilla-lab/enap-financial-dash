import { Component, Inject } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

export interface PctExecucaoData {
  percentual: number;
  totalRecebido: number;
  totalExecutado: number;
  saldoDisponivel: number;
  projetos: { projeto: string; execucao: number; entradas: number; saidas: number }[];
}

@Component({
  selector: "app-modal-pct-execucao",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatProgressBarModule, DragDropModule, CurrencyPipe, DecimalPipe],
  templateUrl: "./modal-pct-execucao.component.html",
  styleUrl: "./modal-pct-execucao.component.scss",
})
export class ModalPctExecucaoComponent {
  constructor(
    public dialogRef: MatDialogRef<ModalPctExecucaoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PctExecucaoData
  ) {}

  getBarColor(pct: number): string {
    if (pct >= 90) return "#10b981";
    if (pct >= 60) return "#6366f1";
    if (pct >= 30) return "#f59e0b";
    return "#ef4444";
  }
}
