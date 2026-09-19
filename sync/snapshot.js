/**
 * Snapshot das células afetadas pela sincronização — só leitura.
 *
 * Registra, em JSON, o conteúdo atual (fórmula E valor calculado) das 16
 * células que serão gravadas, mais a linha 8/12 inteira de cada aba, para que
 * se possa (a) restaurar manualmente e (b) comparar as projeções de set/26 em
 * diante antes e depois do recálculo.
 *
 * Uso:  node sync/snapshot.js [rótulo]     → sync/backups/<data>-<rótulo>.json
 */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_ORC = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';

const ABAS = [
  { aba: 'consolidado • 2026 a 2028',     linha: 12 },
  { aba: 'operação básica • ENAP',        linha: 8 },
  { aba: 'co.ne • BID',                   linha: 8 },
  { aba: 'parceria • MDIC',               linha: 8 },
  { aba: 'alimenta +1.000 cidades • MDS', linha: 8 },
  { aba: 'car dpg • FBDS',                linha: 8 },
];

const colLetra = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };

async function snapshot(sheets) {
  const out = { id: ID_ORC, momento: new Date().toISOString(), abas: {} };
  for (const a of ABAS) {
    const vr = (await sheets.spreadsheets.values.batchGet({
      spreadsheetId: ID_ORC,
      ranges: [`'${a.aba}'!A4:BA4`, `'${a.aba}'!A5:BA5`,
               `'${a.aba}'!A${a.linha}:BA${a.linha}`],
      valueRenderOption: 'FORMULA',
    })).data.valueRanges.map(v => (v.values || [[]])[0] || []);
    const cab = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `'${a.aba}'!A5:BA5`, valueRenderOption: 'FORMATTED_VALUE',
    })).data.values || [[]])[0] || [];
    const calc = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `'${a.aba}'!A${a.linha}:BA${a.linha}`, valueRenderOption: 'UNFORMATTED_VALUE',
    })).data.values || [[]])[0] || [];

    const celulas = {};
    cab.forEach((c, i) => {
      const mes = String(c || '').trim();
      if (!mes) return;
      celulas[mes] = {
        marca: String(vr[0][i] ?? '').trim(),
        celula: `${colLetra(i + 1)}${a.linha}`,
        conteudo: vr[2][i] ?? '',
        calculado: typeof calc[i] === 'number' ? calc[i] : null,
        ehFormula: String(vr[2][i] ?? '').trim().startsWith('='),
      };
    });
    out.abas[a.aba] = { linha: a.linha, celulas };
  }
  return out;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const dados = await snapshot(sheets);
  const dir = path.resolve(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const rotulo = (process.argv[2] || 'snapshot').replace(/[^\w-]/g, '');
  const arq = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${rotulo}.json`);
  fs.writeFileSync(arq, JSON.stringify(dados, null, 2), 'utf8');

  console.log('Snapshot gravado em ' + arq + '\n');
  for (const [aba, d] of Object.entries(dados.abas)) {
    const alvos = Object.entries(d.celulas).filter(([m]) => /jul\.\/26|ago\.\/26/.test(m));
    console.log(`${aba}  (linha ${d.linha})`);
    alvos.forEach(([mes, c]) => console.log(
      `   ${mes.padEnd(9)} ${c.celula.padEnd(5)} marca=${c.marca.padEnd(10)} ` +
      `${c.ehFormula ? 'FÓRMULA ' + String(c.conteudo).slice(0, 44) : 'valor ' + c.calculado}`));
    console.log();
  }
}

if (require.main === module) main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
module.exports = { snapshot, ID_ORC, ABAS, colLetra };
