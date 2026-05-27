import { Routes, Router, CanActivateFn } from "@angular/router";
import { inject } from "@angular/core";
import { environment } from "../environments/environment";
import { authGuard } from "./auth/auth.guard";

const auditoriaGuard: CanActivateFn = () => {
  if (environment.features?.auditoria) return true;
  inject(Router).navigate(["/"]);
  return false;
};

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./pages/home/home.component").then(
        (m) => m.HomeComponent
      ),
    pathMatch: "full",
  },
  {
    path: "dashboard",
    loadComponent: () =>
      import("./pages/dashboard/dashboard.component").then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: "recursos",
    loadComponent: () =>
      import("./pages/recursos/recursos.component").then(
        (m) => m.RecursosComponent
      ),
  },
  {
    path: "projetos",
    loadComponent: () =>
      import("./pages/projetos/projetos.component").then(
        (m) => m.ProjetosComponent
      ),
  },
  {
    path: "categorias",
    loadComponent: () =>
      import("./pages/categorias/categorias.component").then(
        (m) => m.CategoriasComponent
      ),
  },
  {
    path: "fluxo-caixa",
    loadComponent: () =>
      import("./pages/fluxo-caixa/fluxo-caixa.component").then(
        (m) => m.FluxoCaixaComponent
      ),
  },
  {
    path: "gerenciar",
    loadComponent: () =>
      import("./pages/gerenciar/gerenciar.component").then(
        (m) => m.GerenciarComponent
      ),
  },
  {
    // Novo módulo de Saldos Remanescentes
    path: "saldos",
    loadComponent: () =>
      import("./pages/saldos/saldos-gestao.component").then(
        (m) => m.SaldosGestaoComponent
      ),
  },
  {
    path: "rendimentos",
    loadComponent: () =>
      import("./pages/rendimentos/rendimentos.component").then(
        (m) => m.RendimentosComponent
      ),
  },
  {
    path: "auditoria",
    canActivate: [auditoriaGuard, authGuard],
    loadComponent: () =>
      import("./pages/auditoria/auditoria.component").then(
        (m) => m.AuditoriaComponent
      ),
  },
  {
    path: "visao-projeto",
    loadComponent: () =>
      import("./pages/visao-projeto/visao-projeto.component").then(
        (m) => m.VisaoProjetoComponent
      ),
  },
  {
    path: "login",
    loadComponent: () =>
      import("./pages/login/login.component").then(
        (m) => m.LoginComponent
      ),
  },
];
