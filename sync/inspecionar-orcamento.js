/**
 * Leitura de reconhecimento do Orçamento — não grava nada.
 * Mostra, por aba: cabeçalho de meses (linha 5), a linha de Rendimentos em
 * valor formatado E em fórmula, e procura a linha que marca orçado/realizado.
 */
const { google } = require('googleapis');
const path = require('path');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_ORC = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';

const col = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID_ORC, fields: 'properties.title,sheets.properties' });
  console.log('Planilha destino:', meta.data.properties.title);
  console.log('ID:', ID_ORC);
  console.log('='.repeat(90));
  const abas = meta.data.sheets.map(s => s.properties.title);
  meta.data.sheets.forEach(s => console.log(`  gid ${String(s.properties.sheetId).padEnd(12)} ${s.properties.title}`));

  for (const aba of abas) {
    console.log('\n' + '='.repeat(90));
    console.log(`ABA: ${aba}`);
    console.log('='.repeat(90));

    const [fmt, fml] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: ID_ORC, range: `'${aba}'!A1:BA20`, valueRenderOption: 'FORMATTED_VALUE' }),
      sheets.spreadsheets.values.get({ spreadsheetId: ID_ORC, range: `'${aba}'!A1:BA20`, valueRenderOption: 'FORMULA' }),
    ]);
    const V = fmt.data.values || [], F = fml.data.values || [];

    for (let i = 0; i < Math.min(V.length, 20); i++) {
      const linha = V[i] || [];
      const rotulo = linha.slice(0, 3).map(c => String(c).trim()).filter(Boolean).join(' / ').slice(0, 46);
      const amostra = linha.slice(3, 14).map(c => String(c).slice(0, 11).padEnd(11)).join('|');
      console.log(`L${String(i + 1).padStart(2)} [${rotulo.padEnd(46)}] ${amostra}`);
    }

    // Fórmulas das linhas que parecem ser de Rendimentos
    for (let i = 0; i < Math.min(F.length, 20); i++) {
      const rot = String((V[i] || [])[1] || (V[i] || [])[0] || '').toLowerCase();
      if (!rot.includes('rendimento')) continue;
      console.log(`\n  ▸ FÓRMULAS da linha ${i + 1} ("${String((V[i] || [])[1] || (V[i] || [])[0]).trim()}")`);
      (F[i] || []).forEach((c, j) => {
        const s = String(c).trim();
        if (!s) return;
        const cab = String((V[4] || [])[j] || '').trim();
        const tipo = s.startsWith('=') ? 'FÓRMULA' : 'valor  ';
        console.log(`     ${col(j + 1).padEnd(4)}${String(i + 1).padEnd(3)} ${cab.padEnd(10)} ${tipo}  ${s.slice(0, 70)}`);
      });
    }
  }
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
