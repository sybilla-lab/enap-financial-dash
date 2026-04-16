import { Injectable, PLATFORM_ID, computed, inject, signal } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { environment } from "../../environments/environment";

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
  exp: number;
}

declare global {
  interface Window {
    google?: any;
  }
}

const STORAGE_KEY = "enap.auth.user";
const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";

@Injectable({ providedIn: "root" })
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private scriptPromise?: Promise<void>;

  currentUser = signal<AuthUser | null>(this.restore());

  isAuthenticated = computed(() => {
    const u = this.currentUser();
    return !!u && u.exp * 1000 > Date.now();
  });

  isAuthorized = computed(() => {
    if (!this.isAuthenticated()) return false;
    const email = this.currentUser()!.email.toLowerCase();
    const allowed = environment.google.allowedEmails.map(e => e.toLowerCase());
    if (allowed.includes(email)) return true;
    const domain = email.split("@")[1] ?? "";
    return environment.google.allowedDomains.some(d => d.toLowerCase() === domain);
  });

  isDenied = computed(() => this.isAuthenticated() && !this.isAuthorized());

  loadGisScript(): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();
    if (this.scriptPromise) return this.scriptPromise;
    this.scriptPromise = new Promise<void>((resolve, reject) => {
      if (window.google?.accounts?.id) return resolve();
      const s = document.createElement("script");
      s.src = GIS_SCRIPT_URL;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Falha ao carregar Google Identity Services"));
      document.head.appendChild(s);
    });
    return this.scriptPromise;
  }

  async signInWithPopup(): Promise<AuthUser> {
    await this.loadGisScript();
    if (!window.google?.accounts?.oauth2) {
      throw new Error("Google Identity Services não carregou");
    }
    return new Promise<AuthUser>((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: environment.google.clientId,
        scope: "openid email profile",
        prompt: "select_account",
        callback: async (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          try {
            const user = await this.fetchUserInfo(resp.access_token, Number(resp.expires_in));
            resolve(user);
          } catch (err) {
            reject(err);
          }
        },
        error_callback: (err: any) => {
          if (err?.type === "popup_closed") {
            reject(new Error("Janela de login fechada antes de concluir."));
          } else {
            reject(new Error(err?.message || err?.type || "Erro ao autenticar"));
          }
        },
      });
      client.requestAccessToken();
    });
  }

  signOut(): void {
    if (this.isBrowser) {
      try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* noop */ }
      sessionStorage.removeItem(STORAGE_KEY);
    }
    this.currentUser.set(null);
  }

  private async fetchUserInfo(accessToken: string, expiresIn: number): Promise<AuthUser> {
    const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) throw new Error("Falha ao obter dados do usuário Google");
    const info = await resp.json();
    if (!info.email) throw new Error("Email não retornado pelo Google");
    if (info.email_verified !== true && String(info.email_verified) !== "true") {
      throw new Error("Email não verificado pelo Google");
    }
    const user: AuthUser = {
      email: info.email,
      name: info.name ?? info.email,
      picture: info.picture ?? "",
      exp: Math.floor(Date.now() / 1000) + (expiresIn > 0 ? expiresIn : 3600),
    };
    this.currentUser.set(user);
    if (this.isBrowser) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  private restore(): AuthUser | null {
    if (!this.isBrowser) return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw) as AuthUser;
      if (user.exp * 1000 <= Date.now()) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }
}
