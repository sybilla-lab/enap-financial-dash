/**
 * Cria/atualiza a aba de PROJEÇÃO TÉCNICA das movimentações de rendimentos.
 *
 * Por que existe
 * -------------
 * A aba oficial "Movimentações de Rendimentos" é a fonte proprietária: tem
 * categoria, fornecedor e a observação longa de cada lançamento. O dashboard
 * não precisa de nada disso — precisa de treze campos. Esta aba é uma projeção
 * só-leitura desses treze campos, ligada por fórmula à oficial: qualquer edição
 * lá aparece aqui no mesmo instante, sem script, sem trigger, sem execução
 * manual. É a aba que vai para a web, não a oficial.
 *
 * Por que não na "Base de Dados • ENAP Financial Dash", como seria o natural
 * -------------------------------------------------------------------------
 * A service account tem leitura na Base, não escrita (`spreadsheets.batchUpdate`
 * devolve "The caller does not have permission"), então a aba técnica não pode
 * ser criada lá por código. E IMPORTRANGE entre as duas planilhas exigiria a
 * autorização de par origem→destino, que só existe pelo botão "Permitir acesso"
 * da interface. A projeção fica então na própria planilha de Orçamento: mesma
 * planilha da fonte, referência direta em vez de IMPORTRANGE, sem autorização
 * pendente e sem uma segunda cópia dos dados em lugar nenhum.
 *
 * Esta aba NUNCA deve ser editada à mão: é fórmula. Escrever por cima quebra o
 * vínculo com a oficial e cria a segunda fonte que a arquitetura evita.
 *
 *   node sync/projecao-movimentacoes.js
 */
const { google } = require('googleapis');
const path = require('path');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
const ORIGEM = 'Movimentações de Rendimentos';
const DESTINO = 'Dashboard • Movimentações Rendimentos';
const ULTIMA_LINHA = 500;   // a aba oficial tem 500 linhas

/**
 * Os treze campos do contrato com o dashboard, na ordem.
 *
 * `col` é a coluna na aba oficial; `fmt` decide como o valor sai no CSV
 * publicado. Datas e valores saem como texto determinístico de propósito: o CSV
 * publicado herda a formatação da célula, e um "R$ 72.847,81" ou um serial
 * 46234 obrigariam o cliente a adivinhar locale. "31/07/2026" e "72847.81" não.
 */
const CAMPOS = [
  { nome: 'id_movimentacao',  col: 'A', fmt: null },
  { nome: 'data_base',        col: 'B', fmt: 'dd/mm/yyyy' },
  { nome: 'data_efetiva',     col: 'C', fmt: 'dd/mm/yyyy' },
  { nome: 'competencia',      col: 'D', fmt: null },
  { nome: 'tipo',             col: 'E', fmt: null },
  { nome: 'documento',        col: 'F', fmt: null },
  { nome: 'projeto_origem',   col: 'G', fmt: null },
  { nome: 'projeto_destino',  col: 'H', fmt: null },
  { nome: 'valor',            col: 'I', fmt: '0.00', ponto: true },
  { nome: 'numero_pagamento', col: 'K', fmt: '0' },
  { nome: 'finalidade',       col: 'N', fmt: null },
  { nome: 'status',           col: 'P', fmt: null },
  { nome: 'atualizado_em',    col: 'Q', fmt: 'yyyy-mm-dd hh:mm:ss' },
];

// Planilha em pt_BR: separador de argumentos é ";" e TEXT() devolve decimal com
// vírgula. `ponto` troca por ponto — o CSV publicado é lido por código, não por
// gente, e "72847.81" dispensa o cliente de adivinhar o locale da planilha.
function formula({ col, fmt, ponto }) {
  const faixa = `'${ORIGEM}'!${col}2:${col}${ULTIMA_LINHA}`;
  const guarda = `'${ORIGEM}'!$A$2:$A$${ULTIMA_LINHA}=""`;
  let valor = faixa;
  if (fmt) {
    const texto = ponto ? `SUBSTITUTE(TEXT(${faixa};"${fmt}");",";".")` : `TEXT(${faixa};"${fmt}")`;
    valor = `IF(${faixa}="";"";${texto})`;
  }
  return `=IFERROR(ARRAYFORMULA(IF(${guarda};"";${valor}));"")`;
}

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const origem = meta.data.sheets.find(s => s.properties.title === ORIGEM);
  if (!origem) throw new Error(`aba "${ORIGEM}" não encontrada`);

  let destino = meta.data.sheets.find(s => s.properties.title === DESTINO);
  if (!destino) {
    const r = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: DESTINO,
              gridProperties: { rowCount: ULTIMA_LINHA, columnCount: CAMPOS.length, frozenRowCount: 1 },
            },
          },
        }],
      },
    });
    destino = { properties: r.data.replies[0].addSheet.properties };
    console.log(`aba criada: "${DESTINO}"`);
  } else {
    console.log(`aba já existia: "${DESTINO}" — fórmulas reescritas`);
  }
  const gid = destino.properties.sheetId;

  // Cabeçalho + a linha de fórmulas. Só a linha 2 leva fórmula: cada uma se
  // expande para baixo sozinha, então incluir linhas não muda nada aqui.
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID,
    range: `'${DESTINO}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [CAMPOS.map(c => c.nome), CAMPOS.map(formula)] },
  });

  // Aviso de proteção (warningOnly): quem abrir e tentar digitar vê o alerta,
  // mas ninguém fica trancado fora da própria planilha.
  const protecoes = (await sheets.spreadsheets.get({
    spreadsheetId: ID, fields: 'sheets(properties.sheetId,protectedRanges(protectedRangeId,range.sheetId))',
  })).data.sheets.flatMap(s => s.protectedRanges || []).filter(p => p.range?.sheetId === gid);

  if (!protecoes.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ID,
      requestBody: {
        requests: [
          {
            addProtectedRange: {
              protectedRange: {
                range: { sheetId: gid },
                description: 'Projeção técnica do dashboard — gerada por fórmula. Não editar: edite a aba "Movimentações de Rendimentos".',
                warningOnly: true,
              },
            },
          },
          {
            repeatCell: {
              range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.937, green: 0.949, blue: 0.965 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
        ],
      },
    });
  }

  const amostra = (await sheets.spreadsheets.values.get({
    spreadsheetId: ID, range: `'${DESTINO}'!A1:M6`, valueRenderOption: 'FORMATTED_VALUE',
  })).data.values || [];

  console.log(`\ngid = ${gid}`);
  console.log(`campos = ${CAMPOS.length}  ·  linhas projetadas = ${Math.max(0, amostra.length - 1)} (amostra)\n`);
  amostra.forEach(r => console.log('  ' + r.map(c => String(c ?? '').slice(0, 20).padEnd(20)).join('')));
  console.log(`\nPara publicar: Arquivo › Compartilhar › Publicar na web › aba "${DESTINO}" › CSV.`);
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
