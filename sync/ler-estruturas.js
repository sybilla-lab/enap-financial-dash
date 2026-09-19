/**
 * Leitura de reconhecimento — não grava nada.
 * Confirma o layout informado: datas na linha 5, "Rendimentos" na linha 8
 * (linha 12 no consolidado), e lê a aba Cálculo Rendimentos Proporcionais.
 */
const { google } = require('googleapis');
const path = require('path');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_BASE = '1ig0YnBpDncfJZu9Qf6IXzUc2jjKiDEVKLOdLPopwPCM';
const ID_ORC = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';

const ABAS = [
  { nome: 'consolidado • 2026 a 2028', linhaRend: 12 },
  { nome: 'operação básica • ENAP', linhaRend: 8 },
  { nome: 'co.ne • BID', linhaRend: 8 },
  { nome: 'parceria • MDIC', linhaRend: 8 },
  { nome: 'alimenta +1.000 cidades • MDS', linhaRend: 8 },
  { nome: 'car dpg • FBDS', linhaRend: 8 },
];

const col = n => {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
  return s;
};

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // ── 1. Cálculo Rendimentos Proporcionais (Base) ──────────────────────────
  console.log('='.repeat(76));
  console.log('BASE · Cálculo Rendimentos Proporcionais');
  console.log('='.repeat(76));
  const calc = await sheets.spreadsheets.values.get({
    spreadsheetId: ID_BASE,
    range: "'Cálculo Rendimentos Proporcionais'!A1:Z20",
  });
  (calc.data.values || []).slice(0, 14).forEach((r, i) =>
    console.log(String(i + 1).padStart(3) + ': ' +
      r.slice(0, 10).map(c => String(c).slice(0, 14).padEnd(14)).join('|')));

  // ── 2. Layout das abas do Orçamento ──────────────────────────────────────
  for (const aba of ABAS) {
    console.log('\n' + '='.repeat(76));
    console.log(`ORÇAMENTO · ${aba.nome}   (Rendimentos esperado na linha ${aba.linhaRend})`);
    console.log('='.repeat(76));

    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC,
      range: `'${aba.nome}'!A4:AW${aba.linhaRend + 1}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const v = r.data.values || [];
    const linha5 = v[1] || [];                       // A4 é índice 0 → linha 5 é índice 1
    const linhaR = v[aba.linhaRend - 4] || [];

    // Primeiras colunas de data da linha 5
    const datas = [];
    linha5.forEach((c, i) => {
      const s = String(c).trim();
      if (/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i.test(s) || /\d{1,2}\/\d{2,4}/.test(s)) {
        datas.push(`${col(i + 1)}=${s}`);
      }
    });
    console.log('  linha 5 (datas): ' + (datas.length ? datas.slice(0, 12).join('  ') : '(nenhuma reconhecida)'));
    console.log('  total de colunas de data: ' + datas.length);
    console.log(`  linha ${aba.linhaRend} rótulo (col A-C): ` +
      linhaR.slice(0, 3).map(c => `"${String(c).slice(0, 30)}"`).join(' | '));
    console.log(`  linha ${aba.linhaRend} amostra de valores: ` +
      linhaR.slice(3, 10).map(c => String(c).slice(0, 12)).join(' | '));
  }
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
