import { Component, ViewChild, ElementRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, RouterOutlet } from "@angular/router";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatListModule } from "@angular/material/list";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router, NavigationEnd } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { filter } from "rxjs/operators";
import { ThemeService } from "./services/theme.service";
import { PdfExportService } from "./services/pdf-export.service";

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatTooltipModule,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  @ViewChild("contentArea", { read: ElementRef }) contentAreaRef!: ElementRef<HTMLDivElement>;

  sidenavCollapsed = false;

  navItems: NavItem[] = [
    { label: "Dashboard",            icon: "dashboard",       route: "/dashboard" },
    { label: "Recursos",             icon: "account_balance", route: "/recursos" },
    { label: "Projetos",             icon: "folder_special",  route: "/projetos" },
    { label: "Categorias",           icon: "category",        route: "/categorias" },
    { label: "Fluxo de Caixa",       icon: "timeline",        route: "/fluxo-caixa" },
    { label: "Saldos Remanescentes", icon: "history_edu",     route: "/saldos" },
    { label: "Rendimentos",          icon: "trending_up",     route: "/rendimentos" },
  ];

  get exportProgress() { return this.pdfExport.progress(); }

  constructor(
    public themeService: ThemeService,
    public pdfExport: PdfExportService,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.dialog.closeAll();
    });
  }

  exportPdf(): void {
    const el = this.contentAreaRef.nativeElement;
    this.pdfExport.exportAll(this.router, el);
  }
}
