import { Injectable, signal } from "@angular/core";

export interface DashboardConfig {
  recebido: boolean;
  executado: boolean;
  saldo: boolean;
  percentual: boolean;
  pagamentos: boolean;
  ticket: boolean;
  inflacao: boolean;
  meta: boolean;
  runway: boolean;
  gap: boolean;
}

@Injectable({
  providedIn: "root",
})
export class DashboardConfigService {
  private readonly STORAGE_KEY = "dashboard_config";
  
  // Usando Signal para melhor performance no Angular 17+
  config = signal<DashboardConfig>(this.loadConfig());

  constructor() {}

  private loadConfig(): DashboardConfig {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    const defaultConfig: DashboardConfig = {
      recebido: true,
      executado: true,
      saldo: true,
      percentual: true,
      pagamentos: true,
      ticket: true,
      inflacao: true,
      meta: true,
      runway: true,
      gap: true,
    };

    if (saved) {
      try {
        return { ...defaultConfig, ...JSON.parse(saved) };
      } catch (e) {
        return defaultConfig;
      }
    }
    return defaultConfig;
  }

  updateConfig(key: keyof DashboardConfig, visible: boolean) {
    const newConfig = { ...this.config(), [key]: visible };
    this.config.set(newConfig);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
  }

  resetConfig() {
    const defaultConfig: DashboardConfig = {
      recebido: true,
      executado: true,
      saldo: true,
      percentual: true,
      pagamentos: true,
      ticket: true,
      inflacao: true,
      meta: true,
      runway: true,
      gap: true,
    };
    this.config.set(defaultConfig);
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
