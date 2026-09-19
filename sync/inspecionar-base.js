/**
 * Leitura de reconhecimento da Base — não grava nada.
 * Lista as abas (título + gid) e mostra as primeiras linhas das abas que o
 * dashboard consome, para confirmar o mapeamento gid → título e o formato
 * dos valores (com ou sem "R$", separador decimal).
 */
const { google } = require('googleapis');
const path = require('path');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_BASE = '1ig0YnBpDncfJZu9Qf6IXzUc2jjKiDEVKLOdLPopwPCM';

const GIDS_DASHBOARD = {
  0: 'PRINCIPAL',
  595659211: 'RECEBIMENTOS',
  1699326950: 'STATUS_PROJETOS',
  86178020: 'SALDOS',
  2032068393: 'RENDIMENTOS',
};

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID_BASE, fields: 'properties.title,sheets.properties' });
  console.log('Planilha:', meta.data.properties.title);
  console.log('='.repeat(78));
  const porGid = {};
  for (const s of meta.data.sheets) {
    const { sheetId, title, gridProperties } = s.properties;
    porGid[sheetId] = title;
    const marca = GIDS_DASHBOARD[sheetId] ? `  ← ${GIDS_DASHBOARD[sheetId]}` : '';
    console.log(`  gid ${String(sheetId).padEnd(12)} ${title.padEnd(42)} ${gridProperties.rowCount}x${gridProperties.columnCount}${marca}`);
  }

  for (const [gid, papel] of Object.entries(GIDS_DASHBOARD)) {
    const titulo = porGid[gid];
    console.log('\n' + '='.repeat(78));
    console.log(`${papel}  (gid ${gid})  →  aba "${titulo}"`);
    console.log('='.repeat(78));
    if (!titulo) { console.log('  !! gid não encontrado nesta planilha'); continue; }
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: ID_BASE, range: `'${titulo}'!A1:N8`, valueRenderOption: 'FORMATTED_VALUE',
    });
    (r.data.values || []).forEach((row, i) =>
      console.log(String(i + 1).padStart(3) + ': ' + row.map(c => String(c).slice(0, 15).padEnd(15)).join('|')));
  }
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
