# 📊 FinControl: Painel de Análise Financeira ENAP

<p align="center">
  <img src="public/logo-enap.png" alt="ENAP Logo" height="80">
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="public/logo-impacthub.png" alt="Impact Hub Logo" height="80">
</p>

O **FinControl** é uma plataforma de Business Intelligence (BI) de alto impacto desenvolvida para a **Escola Nacional de Administração Pública (ENAP)**. O objetivo central é fornecer uma visão estratégica e granular sobre a captação e execução de recursos financeiros destinados a projetos de inovação e gestão.

## 🌟 Destaques do Projeto

A aplicação foi construída com foco em **visualização de dados de alta performance** (nível CFO), combinando uma arquitetura serverless baseada em Google Sheets com uma interface moderna e responsiva.

---

## 🛠️ Funcionalidades Principais

### 📈 Dashboard Estratégico
Visão consolidada com KPIs essenciais para tomada de decisão imediata:
*   **Gestão de Runway:** Cálculo dinâmico do tempo de vida do saldo atual com base na média histórica de gastos.
*   **Gap de Captação:** Monitoramento em tempo real da meta de investimentos externos.
*   **Indicadores Operacionais:** Ticket médio por pagamento, número de transações e percentual de execução global.

### 💼 Gestão de Projetos
Monitoramento detalhado da saúde financeira de cada iniciativa:
*   **Status Tracking:** Acompanhamento automático do ciclo de vida dos projetos.
*   **Recuperação de Saldos:** Controle de valores remanescentes e sobras de projetos finalizados.
*   **Drill-down:** Análise detalhada de lançamentos por projeto específico.

### 💵 Controle de Recursos
Mapeamento preciso da origem dos fundos:
*   **Aporte ENAP vs. Captação:** Diferenciação clara entre recursos próprios e patrocínios.
*   **Previsibilidade Financeira:** Gestão de valores recebidos versus previstos para garantir fluxo de caixa saudável.

### 📅 Fluxo de Caixa Mensal
Visualização temporal da evolução financeira com gráficos interativos de entradas, saídas e saldo acumulado.

---

## 🚀 Tecnologias Utilizadas

A stack foi escolhida para garantir rapidez no carregamento e facilidade de manutenção:

*   **Frontend:** [Angular 18](https://angular.dev/) (Última Versão)
*   **Componentes UI:** [Angular Material](https://material.angular.io/)
*   **Visualização:** [Chart.js](https://www.chartjs.org/) + [ng2-charts](https://valor-software.com/ng2-charts/)
*   **Integração de Dados:** [PapaParse](https://www.papaparse.com/) para consumo de Google Sheets em tempo real via CSV.
*   **CI/CD:** [GitHub Actions](https://github.com/features/actions) para deploy automatizado.

---

## 💻 Como Começar

### Pré-requisitos
*   Node.js (v20 ou superior)
*   Angular CLI

### Instalação
```powershell
# Instalar dependências
npm install --legacy-peer-deps

# Iniciar servidor de desenvolvimento
ng serve
```
Acesse `http://localhost:4200/` no seu navegador.

### Build & Deploy
O projeto está configurado para deploy automático via GitHub Actions. Sempre que um push é realizado na branch `main`, o processo de build e publicação no GitHub Pages é disparado.

Para gerar o build manual:
```powershell
ng build --configuration production
```

---

## 📊 Arquitetura de Dados

A aplicação utiliza uma abordagem **Serverless/Sheet-to-Web**, onde os dados são consumidos diretamente de planilhas do Google Sheets publicadas como CSV. Isso permite que a equipe de gestão atualize os dados financeiros sem necessidade de acesso ao código ou banco de dados.

As URLs das planilhas são gerenciadas via variáveis de ambiente (`environment.ts` e secrets do repositório).

---

## 📝 Licença

Este projeto é de uso exclusivo da **ENAP (Escola Nacional de Administração Pública)** em parceria com o **Impact Hub**.

<p align="right">
  <i>Desenvolvido com ❤️ pelo time de Inovação.</i>
</p>
