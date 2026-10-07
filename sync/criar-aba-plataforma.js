/**
 * Cria a aba "plataforma desafio 3.0 • Meta 3" na planilha de Orçamento.
 *
 * A Plataforma voltou a ser projeto em aberto e passou a receber destinação de
 * rendimentos, mas não tinha aba onde o realizado pudesse ser gravado — o
 * consolidado somava cinco abas e o rendimento atribuído a ela não tinha
 * destino. A aba replica o layout das demais: meses na linha 5, entradas a
 * partir da 6, rendimentos na 8, total na 9, saídas a partir da 11.
 *
 *   node sync/criar-aba-plataforma.js            simula
 *   node sync/criar-aba-plataforma.js --write    cria
 */
const { google } = require('googleapis');
const path = require('path');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
const MODELO = 'co.ne • BID';
const NOVA = 'plataforma desafio 3.0 • Meta 3';

async function main() {
  const gravar = process.argv.includes('--write');
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  if (meta.data.sheets.some(s => s.properties.title === NOVA)) {
    console.log(`aba "${NOVA}" já existe — nada a criar`);
    return;
  }

  // Cabeçalho de meses copiado do modelo: mesmas colunas, mesmas competências.
  const linha4 = (await sheets.spreadsheets.values.get({
    spreadsheetId: ID, range: `'${MODELO}'!A4:AN4`, valueRenderOption: 'UNFORMATTED_VALUE' })).data.values?.[0] ?? [];
  const linha5 = (await sheets.spreadsheets.values.get({
    spreadsheetId: ID, range: `'${MODELO}'!A5:AN5`, valueRenderOption: 'UNFORMATTED_VALUE' })).data.values?.[0] ?? [];
  console.log(`modelo "${MODELO}": ${linha5.filter(v => typeof v === 'number').length} competências na linha 5`);

  if (!gravar) { console.log('\nSIMULAÇÃO — rode com --write para criar.'); return; }

  const criada = (await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: { requests: [{ addSheet: { properties: {
      title: NOVA,
      gridProperties: { rowCount: 200, columnCount: 49, frozenRowCount: 5, frozenColumnCount: 2 },
    } } }] },
  })).data.replies[0].addSheet.properties;

  const ultima = linha5.length;
  const col = i => {
    let n = i + 1, s = '';
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const fim = col(ultima - 1);

  const valores = [];
  valores.push({ range: `'${NOVA}'!B2`, values: [['Plataforma Desafio 3.0 | Meta 3']] });
  valores.push({ range: `'${NOVA}'!A4:${fim}4`, values: [linha4] });
  valores.push({ range: `'${NOVA}'!A5:${fim}5`, values: [linha5] });
  valores.push({ range: `'${NOVA}'!B6`, values: [['ENTRADAS']] });
  valores.push({ range: `'${NOVA}'!B7`, values: [['Destinação de rendimentos']] });
  valores.push({ range: `'${NOVA}'!B8`, values: [['Rendimentos']] });
  valores.push({ range: `'${NOVA}'!B9`, values: [['TOTAL']] });
  valores.push({ range: `'${NOVA}'!B11`, values: [['SAÍDAS']] });
  valores.push({ range: `'${NOVA}'!B12`, values: [['3.1.1 Serviço de Plataforma']] });
  valores.push({ range: `'${NOVA}'!B13`, values: [['TOTAL']] });

  // TOTAL das entradas e das saídas, coluna a coluna — mesma fórmula do modelo.
  const totEnt = [], totSai = [];
  for (let i = 2; i < ultima; i++) {
    const c = col(i);
    totEnt.push(`=SUM(${c}7:${c}8)`);
    totSai.push(`=SUM(${c}12:${c}12)`);
  }
  valores.push({ range: `'${NOVA}'!C9:${fim}9`, values: [totEnt] });
  valores.push({ range: `'${NOVA}'!C13:${fim}13`, values: [totSai] });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID, requestBody: { valueInputOption: 'USER_ENTERED', data: valores },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: { requests: [
      { repeatCell: { range: { sheetId: criada.sheetId, startRowIndex: 1, endRowIndex: 2 },
        cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } },
        fields: 'userEnteredFormat.textFormat' } },
      { repeatCell: { range: { sheetId: criada.sheetId, startRowIndex: 5, endRowIndex: 6 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
      { repeatCell: { range: { sheetId: criada.sheetId, startRowIndex: 10, endRowIndex: 11 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } },
    ] },
  });

  console.log(`aba criada: "${NOVA}"  gid=${criada.sheetId}  colunas até ${fim}`);
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
