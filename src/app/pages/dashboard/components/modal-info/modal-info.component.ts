import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

@Component({
  selector: "app-modal-info",
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule, DragDropModule],
  templateUrl: "./modal-info.component.html",
  styleUrl: "./modal-info.component.scss",
})
export class ModalInfoComponent {
  constructor(
    public dialogRef: MatDialogRef<ModalInfoComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; icon: string; description: string; value?: string }
  ) { }
}
