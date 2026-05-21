import { Directive, ElementRef, HostListener, OnDestroy, OnInit } from "@angular/core";

@Directive({
  selector: "[appDragScroll]",
  standalone: true,
})
export class DragScrollDirective implements OnInit, OnDestroy {
  private pending = false;
  private dragging = false;
  private startX = 0;
  private startScroll = 0;
  private justDragged = false;
  private readonly DRAG_THRESHOLD = 6;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.el.nativeElement.addEventListener("click", this.onClickCapture, true);
  }

  ngOnDestroy(): void {
    this.el.nativeElement.removeEventListener("click", this.onClickCapture, true);
    this.pending = false;
    this.dragging = false;
  }

  private onClickCapture = (e: MouseEvent): void => {
    if (this.justDragged) {
      e.stopPropagation();
      e.preventDefault();
      this.justDragged = false;
    }
  };

  @HostListener("mousedown", ["$event"])
  onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.pending = true;
    this.dragging = false;
    this.startX = e.clientX;
    this.startScroll = this.el.nativeElement.scrollLeft;
  }

  @HostListener("window:mousemove", ["$event"])
  onMouseMove(e: MouseEvent): void {
    if (!this.pending) return;
    const dx = e.clientX - this.startX;

    if (!this.dragging) {
      if (Math.abs(dx) < this.DRAG_THRESHOLD) return;
      this.dragging = true;
      this.el.nativeElement.classList.add("is-dragging");
    }

    e.preventDefault();
    this.el.nativeElement.scrollLeft = this.startScroll - dx;
  }

  @HostListener("window:mouseup")
  onMouseUp(): void {
    if (!this.pending) return;
    this.pending = false;
    if (this.dragging) {
      this.dragging = false;
      this.el.nativeElement.classList.remove("is-dragging");
      this.justDragged = true;
      // Reseta a flag no proximo ciclo, caso nao haja click subsequente
      setTimeout(() => { this.justDragged = false; }, 0);
    }
  }
}
