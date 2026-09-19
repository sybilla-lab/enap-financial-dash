/**
 * 1. Ajusta o fuso da planilha de Orçamento para America/Araguaina.
 * 2. Lista apenas as abas VISÍVEIS das duas planilhas.
 */
const { google } = require('googleapis');
const path = require('path');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_BASE = '1ig0YnBpDncfJZu9Qf6IXzUc2jjKiDEVKLOdLPopwPCM';
const ID_ORCAMENTO = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
const FUSO = 'America/Araguaina';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // ── 1. Fuso ──────────────────────────────────────────────────────────────
  const antes = (await sheets.spreadsheets.get({ spreadsheetId: ID_ORCAMENTO }))
    .data.properties.timeZone;

  if (antes !== FUSO) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ID_ORCAMENTO,
      requestBody: {
        requests: [{
          updateSpreadsheetProperties: {
            properties: { timeZone: FUSO },
            fields: 'timeZone',
          },
        }],
      },
    });
    console.log(`FUSO Orçamento: ${antes} → ${FUSO}  (alterado)`);
  } else {
    console.log(`FUSO Orçamento: já em ${FUSO}`);
  }

  const baseTz = (await sheets.spreadsheets.get({ spreadsheetId: ID_BASE }))
    .data.properties.timeZone;
  console.log(`FUSO Base     : ${baseTz}${baseTz === FUSO ? '  (já alinhado)' : '  << divergente'}`);

  // ── 2. Abas visíveis ─────────────────────────────────────────────────────
  for (const [rotulo, id] of [['BASE', ID_BASE], ['ORÇAMENTO', ID_ORCAMENTO]]) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const todas = meta.data.sheets.map(s => s.properties);
    const visiveis = todas.filter(p => !p.hidden);
    const ocultas = todas.filter(p => p.hidden);

    console.log('\n' + '='.repeat(72));
    console.log(`${rotulo} — ${visiveis.length} visíveis de ${todas.length}`);
    console.log('='.repeat(72));
    visiveis.forEach(p =>
      console.log(`  gid=${String(p.sheetId).padEnd(12)}${p.title}` +
                  `  (${p.gridProperties.rowCount}×${p.gridProperties.columnCount})`));
    if (ocultas.length) {
      console.log(`  --- ocultas (ignoradas): ${ocultas.map(p => p.title).join(', ')}`);
    }
  }
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
