import { Component, Inject } from "@angular/core";
import { CommonModule, CurrencyPipe, DecimalPipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

export interface PctMetaData {
  percentual: number;
  aporteRecebido: number;
  captacaoRecebida: number;
  totalRecebido: number;
  metaTotal: number;
  saldoACaptar: number;
  financiadores: { financiador: string; valor: number }[];
}

@Component({
  selector: "app-modal-pct-meta",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, MatProgressBarModule, DragDropModule, CurrencyPipe, DecimalPipe],
  templateUrl: "./modal-pct-meta.component.html",
  styleUrl: "./modal-pct-meta.component.scss",
})
export class ModalPctMetaComponent {
  constructor(
    public dialogRef: MatDialogRef<ModalPctMetaComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PctMetaData
  ) {}

  get pctAporte(): number {
    return this.data.metaTotal > 0 ? (this.data.aporteRecebido / this.data.metaTotal) * 100 : 0;
  }

  get pctCaptacao(): number {
    return this.data.metaTotal > 0 ? (this.data.captacaoRecebida / this.data.metaTotal) * 100 : 0;
  }

  get pctFaltante(): number {
    return Math.max(0, 100 - this.data.percentual);
  }
}
