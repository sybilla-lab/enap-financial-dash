import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, RouterOutlet } from "@angular/router";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatListModule } from "@angular/material/list";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ThemeService } from "./services/theme.service";

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
  template: `
    <mat-sidenav-container class="app-container">
      <mat-sidenav #sidenav mode="side" opened class="app-sidenav" [class.collapsed]="sidenavCollapsed">
        <!-- Logo -->
        <div class="sidenav-header">
          @if (!sidenavCollapsed) {
            <div class="logo-full">
              <mat-icon class="logo-icon">insights</mat-icon>
              <span class="logo-text">FinControl</span>
            </div>
          } @else {
            <mat-icon class="logo-icon-small">insights</mat-icon>
          }
        </div>

        <!-- Nav items -->
        <mat-nav-list>
          @for (item of navItems; track item.route) {
          <a mat-list-item [routerLink]="item.route" routerLinkActive="active-link"
            [matTooltip]="sidenavCollapsed ? item.label : ''" matTooltipPosition="right">
            <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            @if (!sidenavCollapsed) {
            <span matListItemTitle>{{ item.label }}</span>
            }
          </a>
          }
        </mat-nav-list>

        <!-- Collapse button -->
        <div class="sidenav-footer">
          <button mat-icon-button (click)="sidenavCollapsed = !sidenavCollapsed" matTooltip="Recolher menu">
            <mat-icon>{{ sidenavCollapsed ? "chevron_right" : "chevron_left" }}</mat-icon>
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content class="main-content">
        <!-- Toolbar -->
        <mat-toolbar class="app-toolbar">
          <button mat-icon-button (click)="sidenav.toggle()" class="menu-btn">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="toolbar-title">Sistema de Análise Financeira — ENAP</span>
          <span class="spacer"></span>
          <button mat-icon-button (click)="themeService.toggle()" [matTooltip]="themeService.isDark() ? 'Modo Claro' : 'Modo Escuro'">
            <mat-icon>{{ themeService.isDark() ? "light_mode" : "dark_mode" }}</mat-icon>
          </button>
        </mat-toolbar>

        <!-- Content -->
        <div class="content-area">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .app-container { height: 100vh; }
    .app-sidenav {
      width: 260px; background: var(--sidenav-bg) !important;
      border-right: 1px solid var(--border-color) !important;
      transition: width 0.3s ease;
      display: flex; flex-direction: column;
    }
    .app-sidenav.collapsed { width: 68px; }
    .sidenav-header {
      padding: 20px 16px; display: flex; align-items: center;
      border-bottom: 1px solid var(--border-color);
      min-height: 64px;
    }
    .logo-full { display: flex; align-items: center; gap: 12px; }
    .logo-icon { color: #7c4dff; font-size: 32px; width: 32px; height: 32px; }
    .logo-icon-small { color: #7c4dff; font-size: 28px; width: 28px; height: 28px; margin: 0 auto; }
    .logo-text { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: var(--text-primary);
      background: linear-gradient(135deg, #7c4dff, #448aff);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    mat-nav-list { flex: 1; padding-top: 8px; }
    mat-nav-list a { border-radius: 12px !important; margin: 4px 8px !important; height: 48px !important; }
    mat-nav-list a mat-icon { color: var(--text-secondary); }
    mat-nav-list a span { color: var(--text-primary); font-size: 14px; }
    .active-link { background: rgba(124, 77, 255, 0.12) !important; }
    .active-link mat-icon { color: #7c4dff !important; }
    .active-link span { color: #7c4dff !important; font-weight: 500; }
    .sidenav-footer { padding: 8px; border-top: 1px solid var(--border-color); display: flex; justify-content: center; }
    .sidenav-footer button mat-icon { color: var(--text-secondary); }
    .app-toolbar {
      background: var(--toolbar-bg) !important; color: var(--text-primary) !important;
      border-bottom: 1px solid var(--border-color);
      height: 64px;
      backdrop-filter: blur(10px);
    }
    .menu-btn { display: none; }
    @media (max-width: 768px) { .menu-btn { display: block; } }
    .toolbar-title { font-size: 16px; font-weight: 400; margin-left: 8px; color: var(--text-secondary); }
    .spacer { flex: 1; }
    .main-content { background: var(--bg-primary) !important; }
    .content-area { overflow-y: auto; height: calc(100vh - 64px); }
  `,
})
export class AppComponent {
  sidenavCollapsed = false;

  navItems: NavItem[] = [
    { label: "Dashboard Geral", icon: "dashboard", route: "/dashboard" },
    { label: "Recursos", icon: "account_balance", route: "/recursos" },
    { label: "Projetos", icon: "folder_special", route: "/projetos" },
    { label: "Categorias", icon: "category", route: "/categorias" },
    { label: "Fluxo de Caixa", icon: "timeline", route: "/fluxo-caixa" },
  ];

  constructor(public themeService: ThemeService) {}
}
