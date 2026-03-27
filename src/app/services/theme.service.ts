import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ThemeService {
  isDark = signal(true);

  constructor() {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "light") {
      this.isDark.set(false);
    }
    this.applyTheme();
  }

  toggle(): void {
    this.isDark.set(!this.isDark());
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("theme", this.isDark() ? "dark" : "light");
    }
    this.applyTheme();
  }

  private applyTheme(): void {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (this.isDark()) {
      body.classList.add("dark-theme");
      body.classList.remove("light-theme");
    } else {
      body.classList.remove("dark-theme");
      body.classList.add("light-theme");
    }
  }
}
