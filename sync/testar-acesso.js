/**
 * Teste de acesso às planilhas via service account.
 * Verifica leitura na Base e ESCRITA na de Orçamento, sem alterar nada de verdade.
 */
const { google } = require('googleapis');
const path = require('path');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');

const ID_BASE = '1ig0YnBpDncfJZu9Qf6IXzUc2jjKiDEVKLOdLPopwPCM';
const ID_ORCAMENTO = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  for (const [rotulo, id, precisaEscrita] of [
    ['BASE (leitura)', ID_BASE, false],
    ['ORÇAMENTO (escrita)', ID_ORCAMENTO, true],
  ]) {
    console.log('='.repeat(72));
    console.log(rotulo);
    console.log('='.repeat(72));
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
      const p = meta.data.properties;
      console.log('  título        :', p.title);
      console.log('  fuso horário  :', p.timeZone);
      console.log('  abas          :', meta.data.sheets.length);
      meta.data.sheets.forEach(s =>
        console.log('     gid=' + String(s.properties.sheetId).padEnd(12) +
                    s.properties.title +
                    '  (' + s.properties.gridProperties.rowCount + '×' +
                    s.properties.gridProperties.columnCount + ')'));

      if (precisaEscrita) {
        // Sonda de escrita: cria uma aba temporária e apaga em seguida.
        const nome = '__probe_' + Date.now();
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: id,
          requestBody: { requests: [{ addSheet: { properties: { title: nome } } }] },
        });
        const m2 = await sheets.spreadsheets.get({ spreadsheetId: id });
        const criada = m2.data.sheets.find(s => s.properties.title === nome);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: id,
          requestBody: { requests: [{ deleteSheet: { sheetId: criada.properties.sheetId } }] },
        });
        console.log('  ESCRITA       : OK (aba de teste criada e removida)');
      }
    } catch (e) {
      console.log('  ERRO :', e.message.split('\n')[0]);
      if (String(e.message).match(/permission|not found|403|404/i)) {
        console.log('  >> compartilhe a planilha com a service account:');
        console.log('     enap-financial-dash@enap-financial-dash.iam.gserviceaccount.com');
      }
    }
    console.log();
  }
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
