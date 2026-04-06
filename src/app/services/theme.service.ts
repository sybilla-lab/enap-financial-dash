import { Injectable, signal, effect, PLATFORM_ID, Inject } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";

export type ThemePalette = "corporate-slate" | "organic-growth" | "cyber-midnight" | "sunset-luxury";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly PALETTE_KEY = "fincontrol-palette";
  private readonly DARK_MODE_KEY = "fincontrol-dark-mode";
  
  // Sinais para estado do tema
  public activePalette = signal<ThemePalette>("corporate-slate");
  public isDark = signal<boolean>(true);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Carregar configurações iniciais apenas no navegador
    if (isPlatformBrowser(this.platformId)) {
      this.activePalette.set(this.getSavedPalette());
      this.isDark.set(this.getSavedDarkMode());
    }

    // Efeito para aplicar as classes ao body sempre que os sinais mudarem
    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.applyTheme(this.activePalette(), this.isDark());
      }
    });
  }

  toggle() {
    this.isDark.set(!this.isDark());
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.DARK_MODE_KEY, String(this.isDark()));
    }
  }

  setPalette(palette: ThemePalette) {
    this.activePalette.set(palette);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.PALETTE_KEY, palette);
    }
  }

  private getSavedPalette(): ThemePalette {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.PALETTE_KEY) as ThemePalette;
      const validPalettes: ThemePalette[] = ["corporate-slate", "organic-growth", "cyber-midnight", "sunset-luxury"];
      return validPalettes.includes(saved) ? saved : "corporate-slate";
    }
    return "corporate-slate";
  }

  private getSavedDarkMode(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.DARK_MODE_KEY);
      return saved === null ? true : saved === "true"; // Padrão é dark-theme
    }
    return true;
  }

  private applyTheme(palette: ThemePalette, isDark: boolean) {
    if (!isPlatformBrowser(this.platformId)) return;

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
