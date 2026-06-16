import { Injectable, signal, PLATFORM_ID, Inject } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";

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
  
  private readonly defaultConfig: DashboardConfig = {
    recebido: true,
    executado: true,
    saldo: true,
    percentual: false,
    pagamentos: false,
    ticket: false,
    inflacao: false,
    meta: false,
    runway: false,
    gap: false,
  };

  // Inicializa com configuração padrão
  config = signal<DashboardConfig>(this.defaultConfig);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.config.set(this.loadConfig());
    }
  }

  private loadConfig(): DashboardConfig {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        try {
          return { ...this.defaultConfig, ...JSON.parse(saved) };
        } catch (e) {
          return this.defaultConfig;
        }
      }
    }
    return this.defaultConfig;
  }

  updateConfig(key: keyof DashboardConfig, visible: boolean) {
    const newConfig = { ...this.config(), [key]: visible };
    this.config.set(newConfig);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
    }
  }

  resetConfig() {
    this.config.set(this.defaultConfig);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}
