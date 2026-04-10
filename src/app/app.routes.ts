import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    redirectTo: "dashboard",
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
];
