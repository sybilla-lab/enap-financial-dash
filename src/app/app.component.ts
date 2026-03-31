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
        <!-- Sidebar header: Logos -->
        <div class="sidenav-header">
          @if (!sidenavCollapsed) {
            <img src="logo-impacthub.png" alt="Impact Hub Brasil" class="logo-hub" />
            <img src="logo-enap.png" alt="ENAP" class="logo-enap" />
          } @else {
            <img src="logo-impacthub.png" alt="Impact Hub Brasil" class="logo-hub-small" />
            <img src="logo-enap.png" alt="ENAP" class="logo-enap-small" />
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

        <div class="spacer"></div>

        <!-- System items -->
        <mat-nav-list class="bottom-nav">
          <a mat-list-item routerLink="/gerenciar" routerLinkActive="active-link"
            [matTooltip]="sidenavCollapsed ? 'Gerenciar' : ''" matTooltipPosition="right">
            <mat-icon matListItemIcon>settings_suggest</mat-icon>
            @if (!sidenavCollapsed) {
            <span matListItemTitle>Gerenciar</span>
            }
          </a>
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
          <span class="toolbar-title">Execuçao Financeira do Termo de Colaboração da Estratégia de Inovação Aberta</span>
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
    /* ===== Container ===== */
    .app-container { height: 100vh; }

    /* ===== Sidenav ===== */
    .app-sidenav {
      width: 260px;
      background: var(--sidenav-bg) !important;
      border-right: 1px solid var(--border-color) !important;
      transition: width 0.3s ease;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }
    .app-sidenav.collapsed { width: 68px; }

    :host ::ng-deep .app-sidenav .mat-drawer-inner-container {
      background: var(--sidenav-bg) !important;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* ===== Sidebar header: Logos ===== */
    .sidenav-header {
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      border-bottom: 1px solid var(--border-color);
      min-height: 120px;
      flex-shrink: 0;
    }
    .logo-hub {
      height: 72px;
      max-width: 220px;
      object-fit: contain;
    }
    .logo-hub-small {
      height: 40px;
      object-fit: contain;
    }
    .logo-enap {
      height: 36px;
      max-width: 180px;
      object-fit: contain;
    }
    .logo-enap-small {
      height: 20px;
      object-fit: contain;
    }
    
    :host-context(body.dark-theme) .logo-enap, :host-context(body.dark-theme) .logo-enap-small {
      filter: brightness(0) invert(1);
    }


    /* ===== App title ===== */
    .app-title-box {
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }
    .app-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #7c4dff, #448aff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .app-subtitle {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* ===== Nav list ===== */
    mat-nav-list { flex: 1; padding-top: 8px; overflow-y: auto; overflow-x: hidden; }
    mat-nav-list a { border-radius: 12px !important; margin: 4px 8px !important; height: 48px !important; }
    mat-nav-list a mat-icon { color: var(--text-secondary); }
    mat-nav-list a span { color: var(--text-primary); font-size: 14px; }
    .active-link { background: rgba(16, 185, 129, 0.12) !important; }
    .active-link mat-icon { color: var(--accent-green) !important; }
    .active-link span { color: var(--accent-green) !important; font-weight: 500; }

    /* ===== Footer ===== */
    .sidenav-footer {
      padding: 4px 8px 12px;
      display: flex;
      justify-content: center;
      flex-shrink: 0;
    }
    .sidenav-footer button mat-icon { color: var(--text-secondary); }

    /* ===== Toolbar ===== */
    .app-toolbar {
      background: var(--toolbar-bg) !important;
      color: var(--text-primary) !important;
      border-bottom: 1px solid var(--border-color);
      height: 64px;
      backdrop-filter: blur(10px);
      gap: 12px;
    }
    .menu-btn { display: none; }
    .menu-btn { display: none; }
    @media (max-width: 768px) { .menu-btn { display: block; } }
    .toolbar-title { font-size: 16px; font-weight: 400; color: var(--text-secondary); }
    .spacer { flex: 1; }
    .bottom-nav { flex-shrink: 0; padding: 0 !important; }
    .app-sidenav .spacer { flex: 1; }

    /* ===== Main content ===== */
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

  constructor(public themeService: ThemeService) { }
}
