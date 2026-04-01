import { Injectable, signal, effect } from "@angular/core";

export type ThemePalette = "corporate-slate" | "organic-growth" | "cyber-midnight" | "sunset-luxury";

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
    const validPalettes: ThemePalette[] = ["corporate-slate", "organic-growth", "cyber-midnight", "sunset-luxury"];
    return validPalettes.includes(saved) ? saved : "corporate-slate";
  }

  private getSavedDarkMode(): boolean {
    const saved = localStorage.getItem(this.DARK_MODE_KEY);
    return saved === null ? true : saved === "true"; // Padrão é dark-theme
  }

  private applyTheme(palette: ThemePalette, isDark: boolean) {
    const body = document.body;
    
    // 1. Gerenciar Modo Escuro/Claro
    if (isDark) {
      body.classList.add("dark-theme");
    } else {
      body.classList.remove("dark-theme");
    }
    
    // 2. Gerenciar Paleta
    const palettePrefix = "theme-";
    const paletteClasses = ["theme-corporate-slate", "theme-organic-growth", "theme-cyber-midnight", "theme-sunset-luxury"];
    
    // Remover todas as classes de paleta existentes
    paletteClasses.forEach(cls => body.classList.remove(cls));
    
    // Adicionar a nova paleta
    body.classList.add(`${palettePrefix}${palette}`);
  }
}
