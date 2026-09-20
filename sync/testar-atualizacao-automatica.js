/**
 * Prova que o dashboard lê as movimentações da planilha, e não do JSON local.
 *
 * Insere uma linha de teste na aba oficial, mostra o que o CSV publicado passa
 * a devolver e remove a linha. A linha nasce com status "vigente" para que o
 * dashboard realmente a conte — é esse o ponto do teste — e o `finally` garante
 * a remoção mesmo se algo falhar no meio.
 *
 *   node sync/testar-atualizacao-automatica.js inserir
 *   node sync/testar-atualizacao-automatica.js remover
 *   node sync/testar-atualizacao-automatica.js          (insere, lê e remove)
 */
const { google } = require('googleapis');
const path = require('path');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
const ABA = 'Movimentações de Rendimentos';
const PUB = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSGQCBmyCjdHlexSVhN0wzJ2i6r6QUlj3oACbKd-gJEa81sCIO5UxI24LYRoVHrUHwTtearktC4Jb5a/pub?gid=185205069&single=true&output=csv';

const ID_TESTE = 'TESTE_ATUALIZACAO_AUTOMATICA';
const VALOR_TESTE = 1234.56;

const LINHA = [
  ID_TESTE, '31/07/2026', '20/09/2026', '2026-09', 'utilização da carteira',
  'Ofício nº 04/2026', 'Operação Básica', 'Operação Básica', VALOR_TESTE, -VALOR_TESTE,
  '', '', '', 'atualização da Plataforma Desafios',
  'LINHA DE TESTE — inserida por sync/testar-atualizacao-automatica.js. Se você está lendo isto na planilha, remova.',
  'vigente', '', '',
];

async function cliente() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function linhasDeTeste(sheets) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${ABA}'!A1:A200` });
  const col = r.data.values || [];
  const achadas = [];
  col.forEach((v, i) => { if (String(v[0] || '').trim() === ID_TESTE) achadas.push(i + 1); });
  return achadas;
}

async function inserir(sheets) {
  if ((await linhasDeTeste(sheets)).length) {
    console.log('já havia linha de teste — nada inserido');
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: ID, range: `'${ABA}'!A1`,
    valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [LINHA] },
  });
  console.log(`linha de teste inserida — utilização de R$ ${VALOR_TESTE.toFixed(2)} na Operação Básica`);
}

async function remover(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  const gid = meta.data.sheets.find(s => s.properties.title === ABA).properties.sheetId;
  const linhas = await linhasDeTeste(sheets);
  if (!linhas.length) { console.log('nenhuma linha de teste na aba'); return; }
  // De trás para frente: apagar de cima muda o índice das de baixo.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      requests: linhas.sort((a, b) => b - a).map(l => ({
        deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: l - 1, endIndex: l } },
      })),
    },
  });
  console.log(`linha(s) de teste removida(s): ${linhas.join(', ')}`);
}

async function lerPublicado() {
  const res = await fetch(PUB, { cache: 'no-store' });
  const csv = await res.text();
  const linhas = csv.split('\n').filter(l => l.includes(ID_TESTE));
  return { presente: linhas.length > 0, total: csv.split('\n').filter(l => l.trim()).length - 1 };
}

async function main() {
  const acao = process.argv[2] || 'ciclo';
  const sheets = await cliente();

  if (acao === 'inserir') return inserir(sheets);
  if (acao === 'remover') return remover(sheets);

  try {
    console.log('antes :', JSON.stringify(await lerPublicado()));
    await inserir(sheets);
    for (let i = 1; i <= 12; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const st = await lerPublicado();
      console.log(`  +${i * 10}s  CSV publicado: ${st.total} movimentações, teste ${st.presente ? 'PRESENTE' : 'ausente'}`);
      if (st.presente) break;
    }
  } finally {
    await remover(sheets);
    const fim = await lerPublicado();
    console.log('depois:', JSON.stringify(fim));
  }
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
