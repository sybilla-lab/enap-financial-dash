import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { DashboardConfigService, DashboardConfig } from "../../services/dashboard-config.service";
import { ThemeService, ThemePalette } from "../../services/theme.service";

@Component({
  selector: "app-gerenciar",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatDividerModule,
  ],
  templateUrl: "./gerenciar.component.html",
  styleUrl: "./gerenciar.component.scss",
})
export class GerenciarComponent {
  themes: { id: ThemePalette; label: string; color: string; bg: string }[] = [
    { id: "corporate-slate", label: "Slate & Indigo", color: "#6366f1", bg: "#0f172a" },
    { id: "organic-growth", label: "Organic Emerald", color: "#10b981", bg: "#064e3b" },
    { id: "cyber-midnight", label: "Cyber Sky", color: "#0ea5e9", bg: "#020617" },
    { id: "sunset-luxury", label: "Sunset Rose", color: "#f43f5e", bg: "#18181b" },
  ];

  get config() {
    return this.configService.config;
  }

  constructor(
    private configService: DashboardConfigService,
    public themeService: ThemeService
  ) {}

  toggle(key: keyof DashboardConfig, visible: boolean) {
    this.configService.updateConfig(key, visible);
  }

  restaurarPadrao() {
    this.configService.resetConfig();
    this.themeService.setPalette("corporate-slate");
  }
}
