import { Component, effect, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { AuthService } from "../../auth/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  user = this.auth.currentUser;
  isAuthorized = this.auth.isAuthorized;
  isDenied = this.auth.isDenied;
  loading = signal(false);
  error = signal("");

  constructor() {
    effect(() => {
      if (this.auth.isAuthorized()) {
        const redirect = this.route.snapshot.queryParamMap.get("redirect") || "/auditoria";
        this.router.navigateByUrl(redirect);
      }
    });
  }

  async login(): Promise<void> {
    this.error.set("");
    this.loading.set(true);
    try {
      await this.auth.signInWithPopup();
    } catch (err: any) {
      this.error.set(err?.message ?? "Falha ao autenticar com Google");
    } finally {
      this.loading.set(false);
    }
  }

  trocarConta(): void {
    this.auth.signOut();
    this.error.set("");
  }
}
