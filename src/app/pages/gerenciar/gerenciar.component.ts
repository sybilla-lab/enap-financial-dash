import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { DashboardConfigService, DashboardConfig } from "../../services/dashboard-config.service";

@Component({
  selector: "app-gerenciar",
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatDividerModule,
  ],
  template: `
    <div class="page-container">
      <div class="header-row">
        <h1 class="page-title">
          <mat-icon>settings_suggest</mat-icon>
          Gerenciamento do Dashboard
        </h1>
        <button mat-stroked-button color="warn" (click)="restaurarPadrao()">
          <mat-icon>restart_alt</mat-icon>
          Restaurar Padrão
        </button>
      </div>

      <p class="subtitle">Personalize a exibição dos indicadores conforme sua necessidade de análise. As mudanças são salvas automaticamente.</p>

      <div class="config-grid">
        <!-- Financeiro -->
        <mat-card class="config-card" appearance="outlined">
          <mat-card-header>
            <mat-icon mat-card-avatar class="icon-blue">payments</mat-icon>
            <mat-card-title>Financeiro</mat-card-title>
            <mat-card-subtitle>Indicadores de entrada e saída global</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="toggle-list">
              <div class="toggle-item">
                <div class="info">
                  <span class="label">Total Recebido</span>
                  <span class="desc">Soma de todos os aportes confirmados</span>
                </div>
                <mat-slide-toggle [checked]="config().recebido" (change)="toggle('recebido', $event.checked)"></mat-slide-toggle>
              </div>
              <mat-divider></mat-divider>
              <div class="toggle-item">
                <div class="info">
                  <span class="label">Total Executado</span>
                  <span class="desc">Total de pagamentos realizados</span>
                </div>
                <mat-slide-toggle [checked]="config().executado" (change)="toggle('executado', $event.checked)"></mat-slide-toggle>
              </div>
              <mat-divider></mat-divider>
              <div class="toggle-item">
                <div class="info">
                  <span class="label">Saldo Disponível</span>
                  <span class="desc">Recurso em conta (Recebido - Executado)</span>
                </div>
                <mat-slide-toggle [checked]="config().saldo" (change)="toggle('saldo', $event.checked)"></mat-slide-toggle>
              </div>
              <mat-divider></mat-divider>
              <div class="toggle-item">
                <div class="info">
                  <span class="label">Inflação Recebida</span>
                  <span class="desc">Aportes extras de reajustes contratuais</span>
                </div>
                <mat-slide-toggle [checked]="config().inflacao" (change)="toggle('inflacao', $event.checked)"></mat-slide-toggle>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Operacional -->
        <mat-card class="config-card" appearance="outlined">
          <mat-card-header>
            <mat-icon mat-card-avatar class="icon-green">analytics</mat-icon>
            <mat-card-title>Operacional</mat-card-title>
            <mat-card-subtitle>Métricas de eficiência e volume</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="toggle-list">
              <div class="toggle-item">
                <div class="info">
                  <span class="label">% Execução</span>
                  <span class="desc">Percentual do plano de trabalho executado</span>
                </div>
                <mat-slide-toggle [checked]="config().percentual" (change)="toggle('percentual', $event.checked)"></mat-slide-toggle>
              </div>
              <mat-divider></mat-divider>
              <div class="toggle-item">
                <div class="info">
                  <span class="label">N° de Pagamentos</span>
                  <span class="desc">Volume total de transações de saída</span>
                </div>
                <mat-slide-toggle [checked]="config().pagamentos" (change)="toggle('pagamentos', $event.checked)"></mat-slide-toggle>
              </div>
              <mat-divider></mat-divider>
              <div class="toggle-item">
                <div class="info">
                  <span class="label">Ticket Médio</span>
                  <span class="desc">Valor médio por pagamento realizado</span>
                </div>
                <mat-slide-toggle [checked]="config().ticket" (change)="toggle('ticket', $event.checked)"></mat-slide-toggle>
              </div>
              <mat-divider></mat-divider>
              <div class="toggle-item">
                <div class="info">
                  <span class="label">% Atingido (Meta Total)</span>
                  <span class="desc">Status vs Orçamento global aprovado</span>
                </div>
                <mat-slide-toggle [checked]="config().meta" (change)="toggle('meta', $event.checked)"></mat-slide-toggle>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Estratégico -->
        <mat-card class="config-card" appearance="outlined">
          <mat-card-header>
            <mat-icon mat-card-avatar class="icon-purple">timer</mat-icon>
            <mat-card-title>Estratégico</mat-card-title>
            <mat-card-subtitle>Indicadores de sobrevivência e gap</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="toggle-list">
              <div class="toggle-item">
                <div class="info">
                  <span class="label">Runway (Meses)</span>
                  <span class="desc">Tempo estimado de sobrevivência financeira</span>
                </div>
                <mat-slide-toggle [checked]="config().runway" (change)="toggle('runway', $event.checked)"></mat-slide-toggle>
              </div>
              <mat-divider></mat-divider>
              <div class="toggle-item">
                <div class="info">
                  <span class="label">Gap de Captação</span>
                  <span class="desc">Déficit atual em relação à meta total</span>
                </div>
                <mat-slide-toggle [checked]="config().gap" (change)="toggle('gap', $event.checked)"></mat-slide-toggle>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: `
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .subtitle { color: var(--text-secondary); margin-bottom: 32px; font-size: 15px; }

    .config-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); 
      gap: 24px; 
    }

    .config-card { 
      background: var(--card-bg) !important; 
      border-radius: 16px !important; 
      border: 1px solid var(--border-color) !important;
    }

    mat-card-header { margin-bottom: 16px; padding: 16px 24px 0; }
    mat-card-title { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    mat-card-subtitle { font-size: 12px; }

    .icon-blue { color: var(--accent-blue); }
    .icon-green { color: var(--accent-green); }
    .icon-purple { color: #a855f7; }

    .toggle-list { display: flex; flex-direction: column; }
    .toggle-item { 
      padding: 16px 24px; 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      transition: background 0.2s;
    }
    .toggle-item:hover { background: var(--hover-bg); }

    .info { display: flex; flex-direction: column; gap: 4px; }
    .label { font-size: 14px; font-weight: 500; color: var(--text-primary); }
    .desc { font-size: 11px; color: var(--text-muted); }

    mat-divider { opacity: 0.5; }
  `,
})
export class GerenciarComponent {
  get config() {
    return this.configService.config;
  }

  constructor(private configService: DashboardConfigService) {}

  toggle(key: keyof DashboardConfig, visible: boolean) {
    this.configService.updateConfig(key, visible);
  }

  restaurarPadrao() {
    this.configService.resetConfig();
  }
}
