import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';

const DASHBOARD_CONTEXT = `
CONTEXTO DO SISTEMA:
Este dashboard representa a execução financeira de projetos no âmbito de um Termo de Colaboração (MROSC), com foco em acompanhamento de recursos, execução e prestação de contas. O objetivo não é análise de lucro ou performance empresarial, mas sim organização, transparência e rastreabilidade dos dados para gestão e prestação de contas.

ESTRUTURA DO DASHBOARD:
1. VISÃO GERAL — KPIs consolidados (total entradas, saídas, saldo)
2. RECURSOS — Aportes ENAP, captação externa e rendimentos; tabela detalhada de recebimentos
3. PROJETOS — Execução financeira por projeto (entradas, saídas, saldo, % execução)
4. FLUXO DE CAIXA — Evolução temporal de entradas e saídas mensais
5. SALDOS REMANESCENTES — Valores não executados por projeto/parceiro
6. RENDIMENTOS — Rendimentos financeiros (bruto, líquido, utilizado)
7. DESPESAS POR CATEGORIA — Distribuição e ranking das despesas

REGRAS DE LEITURA DOS DADOS:
- "Entradas" = recebimentos via aporte ENAP + captação + rendimentos
- "Saídas" = execução financeira (pagamentos realizados)
- "Saldo" = total recebido menos total executado
- "% Execução" = total executado / total recebido × 100
- Saldos remanescentes são valores não executados transferidos para Operação Básica
- Rendimentos são gerados sobre o saldo em conta corrente

RESTRIÇÕES DE INTERPRETAÇÃO:
- Não inferir lucro, prejuízo ou resultado financeiro como objetivo
- Não criar métricas que dependam de dados inexistentes (orçamento futuro, metas não cadastradas)
- Não classificar projetos como críticos, problemáticos ou ineficientes
- Não gerar análises de risco sem base completa de dados
- Responder apenas com base nos dados disponíveis; se os dados não estiverem disponíveis, informar claramente

MODELO DE LEITURA:
Responder perguntas como: Quanto foi recebido? Como os recursos estão distribuídos? Como está a execução por projeto? Qual a evolução do caixa? Quais são as maiores despesas?
`.trim();

export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  /* 
  // BI Chat endpoint removed temporarily to avoid build failures with missing dependencies.
  // Re-enable only when @anthropic-ai/sdk is correctly resolved.
  server.post('/api/ai/chat', express.json({ limit: '64kb' }), async (req, res) => {
    ...
  });
  */

  server.get('*.*', express.static(browserDistFolder, { maxAge: '1y' }));

  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;
    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();
