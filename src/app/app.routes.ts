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
];
