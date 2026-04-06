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
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  sidenavCollapsed = false;

  navItems: NavItem[] = [
    { label: "Dashboard", icon: "dashboard", route: "/dashboard" },
    { label: "Recursos", icon: "account_balance", route: "/recursos" },
    { label: "Projetos", icon: "folder_special", route: "/projetos" },
    { label: "Categorias", icon: "category", route: "/categorias" },
    { label: "Fluxo de Caixa", icon: "timeline", route: "/fluxo-caixa" },
    { label: "Saldos Remanescentes", icon: "history_edu", route: "/saldos" },
  ];

  constructor(public themeService: ThemeService) { }
}
