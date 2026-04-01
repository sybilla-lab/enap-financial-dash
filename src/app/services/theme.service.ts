import { Injectable, signal, effect } from "@angular/core";

export type ThemePalette = "slate-indigo" | "zinc-emerald" | "midnight-blue" | "neutral-amber";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly PALETTE_KEY = "fincontrol-palette";
  private readonly DARK_MODE_KEY = "fincontrol-dark-mode";
  
  // Sinais para estado do tema
  public activePalette = signal<ThemePalette>(this.getSavedPalette());
  public isDark = signal<boolean>(this.getSavedDarkMode());

  constructor() {
    // Efeito para aplicar as classes ao body sempre que os sinais mudarem
    effect(() => {
      this.applyTheme(this.activePalette(), this.isDark());
    });
  }

  toggle() {
    this.isDark.set(!this.isDark());
    localStorage.setItem(this.DARK_MODE_KEY, String(this.isDark()));
  }

  setPalette(palette: ThemePalette) {
    this.activePalette.set(palette);
    localStorage.setItem(this.PALETTE_KEY, palette);
  }

  private getSavedPalette(): ThemePalette {
    const saved = localStorage.getItem(this.PALETTE_KEY) as ThemePalette;
    return (["slate-indigo", "zinc-emerald", "midnight-blue", "neutral-amber"].includes(saved)) 
      ? saved 
      : "slate-indigo";
  }

  private getSavedDarkMode(): boolean {
    const saved = localStorage.getItem(this.DARK_MODE_KEY);
    return saved === null ? true : saved === "true"; // Padrão é dark-theme
  }

  private applyTheme(palette: ThemePalette, isDark: boolean) {
    const body = document.body;
    
    // 1. Gerenciar Modo Escuro/Claro (Legado)
    if (isDark) {
      body.classList.add("dark-theme");
    } else {
      body.classList.remove("dark-theme");
    }
    
    // 2. Gerenciar Paleta (Novo)
    const paletteClasses = ["theme-slate-indigo", "theme-zinc-emerald", "theme-midnight-blue", "theme-neutral-amber"];
    body.classList.remove(...paletteClasses);
    body.classList.add(`theme-${palette}`);
  }
}
