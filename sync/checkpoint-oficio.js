/**
 * Validação do checkpoint do Ofício nº 04/2026 — só leitura.
 *
 * Confere o rendimento ACUMULADO por projeto em 31/07/2026, considerando todo
 * o período disponível (do primeiro mês "não utilizado" em diante), contra os
 * valores do Ofício. Tolerância total máxima: R$ 0,02.
 *
 * Uso:  node sync/checkpoint-oficio.js
 * Sai com código 1 se o checkpoint não fechar.
 */
const { google } = require('googleapis');
const path = require('path');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const MES = '07/2026';
const TOLERANCIA_TOTAL = 0.02;

const OFICIO = {
  'Alimenta +1000 Cidades': 387456.64,
  'CAR DPG': 72847.81,
  'Operação Básica': 37476.59,
  'Co.NE': 26200.66,
  'Parceria MDIC': 13477.05,
};
const OFICIO_TOTAL = 537458.75;

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const ctx = R.contexto(await R.carregar(sheets));
  const det = R.abrirDetalhe(ctx, MES);

  // Período efetivamente considerado
  const disp = ctx.porMes.filter(m =>
    (ctx.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado');
  const primeiro = disp[0];
  const meses = disp.filter(m => R.mesKey(m.mesAno) <= R.mesKey(MES));

  console.log(`Checkpoint Ofício nº 04/2026 — acumulado em 31/07/2026`);
  console.log(`Período disponível: ${primeiro.mesAno} a ${MES}  (${meses.length} meses)`);
  console.log(`Método: computarHistoricoPorProjeto (saldo corrente, encerrados → Operação Básica)\n`);

  const linhas = [];
  let somaCalc = 0, somaOfi = 0, somaAbsDif = 0;
  const projetos = Array.from(new Set([...Object.keys(OFICIO), ...det.linhas.map(l => l.projeto)]));

  for (const p of projetos) {
    const calc = R.cent((det.linhas.find(l => l.projeto === p) || {}).rendimentoAcumulado ?? 0);
    const ofi = OFICIO[p] ?? 0;
    const dif = R.cent(calc - ofi);
    somaCalc = R.cent(somaCalc + calc);
    somaOfi = R.cent(somaOfi + ofi);
    somaAbsDif = R.cent(somaAbsDif + Math.abs(dif));
    linhas.push({ p, calc, ofi, dif });
  }
  linhas.sort((a, b) => b.calc - a.calc);

  console.log('  projeto                      calculado          ofício       diferença');
  console.log('  ' + '-'.repeat(72));
  for (const l of linhas) {
    const marca = l.dif === 0 ? '  ✓' : (Math.abs(l.dif) <= 0.01 ? '  ~' : '  ✗');
    console.log(`  ${l.p.padEnd(26)} ${R.brl(l.calc).padStart(14)} ${R.brl(l.ofi).padStart(15)} ${R.brl(l.dif).padStart(13)}${marca}`);
  }
  console.log('  ' + '-'.repeat(72));
  console.log(`  ${'TOTAL'.padEnd(26)} ${R.brl(somaCalc).padStart(14)} ${R.brl(somaOfi).padStart(15)} ${R.brl(R.cent(somaCalc - somaOfi)).padStart(13)}`);
  console.log(`  ${'conferência do total'.padEnd(26)} ${R.brl(somaCalc).padStart(14)} ${R.brl(OFICIO_TOTAL).padStart(15)} ${R.brl(R.cent(somaCalc - OFICIO_TOTAL)).padStart(13)}`);
  console.log(`\n  soma das diferenças absolutas: ${R.brl(somaAbsDif)}   (tolerância ${R.brl(TOLERANCIA_TOTAL)})`);

  const ok = somaAbsDif <= TOLERANCIA_TOTAL && Math.abs(R.cent(somaCalc - OFICIO_TOTAL)) <= TOLERANCIA_TOTAL;
  console.log(ok ? '\n  ✓ CHECKPOINT FECHA — liberado para gravação'
                 : '\n  ✗ CHECKPOINT NÃO FECHA — gravação bloqueada');
  if (!ok) process.exit(1);
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
