/**
 * Conferência do Ofício nº 04/2026 — só leitura.
 * Relê a planilha e valida os critérios de aceite, um a um.
 */
const { google } = require('googleapis');
const path = require('path');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
const ABA_MOV = 'Movimentações de Rendimentos';
const OB = 'Operação Básica';

const ABAS = [
  { aba: 'operação básica • ENAP',        projeto: OB,                       acum: 34, saldoFinal: 32 },
  { aba: 'co.ne • BID',                   projeto: 'Co.NE',                  acum: 32, saldoFinal: 30 },
  { aba: 'parceria • MDIC',               projeto: 'Parceria MDIC',          acum: 31, saldoFinal: 29 },
  { aba: 'alimenta +1.000 cidades • MDS', projeto: 'Alimenta +1000 Cidades', acum: 38, saldoFinal: 36 },
  { aba: 'car dpg • FBDS',                projeto: 'CAR DPG',                acum: 34, saldoFinal: 32 },
];
const CONS = { aba: 'consolidado • 2026 a 2028', acum: 31, rend: 12 };

const JUL = { [OB]: 4026.54, 'Co.NE': 3463.54, 'Parceria MDIC': 13477.05, 'Alimenta +1000 Cidades': 41513.82, 'CAR DPG': 7899.10 };
const AGO = { [OB]: 4497.31, 'Co.NE': 2435.33, 'Parceria MDIC': 12932.70, 'Alimenta +1000 Cidades': 38814.68, 'CAR DPG': 6030.01 };
const LIVRE = { [OB]: 4497.31, 'Co.NE': 2435.33, 'Parceria MDIC': 12932.70, 'Alimenta +1000 Cidades': 426271.32, 'CAR DPG': 6030.01 };
const DESTINADO = { [OB]: 37476.59, 'Co.NE': 26200.66, 'Parceria MDIC': 13477.05, 'Alimenta +1000 Cidades': 0, 'CAR DPG': 72847.81 };
const brl = R.brl, q = s => `'${s}'`;

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const todas = [...ABAS, CONS];
  const ranges = [];
  todas.forEach(d => {
    ranges.push(`${q(d.aba)}!A5:BA5`);
    ranges.push(`${q(d.aba)}!A${d.rend || 8}:BA${d.rend || 8}`);
    ranges.push(`${q(d.aba)}!A${d.acum}:BA${d.acum + (d === CONS ? 10 : 8)}`);
    if (d.saldoFinal) ranges.push(`${q(d.aba)}!A${d.saldoFinal}:BA${d.saldoFinal}`);
  });
  ranges.push(`${q(ABA_MOV)}!A1:R50`);
  const vr = (await sheets.spreadsheets.values.batchGet({ spreadsheetId: ID, ranges, valueRenderOption: 'UNFORMATTED_VALUE' })).data.valueRanges;
  const fm = (await sheets.spreadsheets.values.batchGet({ spreadsheetId: ID, ranges: todas.map(d => `${q(d.aba)}!A5:BA5`), valueRenderOption: 'FORMATTED_VALUE' })).data.valueRanges;

  const S = {}; let i = 0;
  todas.forEach((d, k) => {
    const cab = (fm[k].values || [[]])[0] || [];
    const col = {};
    cab.forEach((c, j) => {
      const s = String(c || '').toLowerCase().replace(/\./g, '').trim();
      const mm = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2})$/);
      if (mm) { const M = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
        col[`${String(M[mm[1]]).padStart(2, '0')}/20${mm[2]}`] = j + 1; }
    });
    i++;
    const rend = (vr[i].values || [[]])[0] || []; i++;
    const bloco = vr[i].values || []; i++;
    let saldo = null; if (d.saldoFinal) { saldo = (vr[i].values || [[]])[0] || []; i++; }
    S[d.aba] = { col, rend, bloco, saldo, acum: d.acum };
  });
  const mov = vr[i].values || [];

  const v = (aba, off, mes) => { const L = S[aba]; const c = L.col[mes]; if (!c) return null;
    return R.cent(Number((L.bloco[off] || [])[c - 1] || 0)); };
  const rend = (aba, mes) => { const L = S[aba]; const c = L.col[mes]; return c ? R.cent(Number(L.rend[c - 1] || 0)) : null; };

  const f = [];
  const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) f.push(m); };

  console.log('CRITÉRIOS DE ACEITE — Ofício nº 04/2026');
  console.log('='.repeat(96));

  // 3. julho inalterado · 4/5. agosto
  console.log('\n3–5. Julho inalterado · agosto recalculado');
  let sj = 0, sa = 0;
  for (const d of ABAS) {
    const j = rend(d.aba, '07/2026'), a = rend(d.aba, '08/2026');
    sj = R.cent(sj + j); sa = R.cent(sa + a);
    ok(j === JUL[d.projeto], `${d.projeto.padEnd(24)} jul ${brl(j).padStart(14)}  (inalterado)`);
    ok(a === AGO[d.projeto], `${d.projeto.padEnd(24)} ago ${brl(a).padStart(14)}  (esperado ${brl(AGO[d.projeto])})`);
  }
  ok(sj === 70380.05, `julho soma ${brl(sj)}`);
  ok(sa === 64710.03, `agosto soma ${brl(sa)}`);
  ok(R.cent(Number((S[CONS.aba].rend)[S[CONS.aba].col['08/2026'] - 1] || 0)) === 64710.03,
    `consolidado agosto ${brl(R.cent(Number((S[CONS.aba].rend)[S[CONS.aba].col['08/2026'] - 1] || 0)))}`);

  // 1/2. checkpoint de julho
  console.log('\n1–2. Checkpoint de 31/07/2026');
  let c07 = 0;
  for (const d of ABAS) { const x = v(d.aba, 0, '07/2026'); c07 = R.cent(c07 + x);
    ok(x === { [OB]: 37476.59, 'Co.NE': 26200.66, 'Parceria MDIC': 13477.05, 'Alimenta +1000 Cidades': 387456.64, 'CAR DPG': 72847.81 }[d.projeto],
      `${d.projeto.padEnd(24)} acumulado 31/07 ${brl(x).padStart(15)}`); }
  ok(c07 === 537458.75, `checkpoint total ${brl(c07)}  (Ofício R$ 537.458,75)`);

  // 6/7/8. transferências
  console.log('\n6–8. Transferências interprojetos');
  ok(v(CONS.aba, 10, '08/2026') === 0, `consolidado: cedidas + recebidas = ${brl(v(CONS.aba, 10, '08/2026'))} em ago./26`);
  ok(v('alimenta +1.000 cidades • MDS', 1, '08/2026') === 0 && v('alimenta +1.000 cidades • MDS', 2, '08/2026') === 0,
    'Alimenta não tem transferência cedida nem recebida');
  ok(v('operação básica • ENAP', 2, '08/2026') === 112525.52,
    `Operação Básica recebeu ${brl(v('operação básica • ENAP', 2, '08/2026'))} de outros projetos`);
  for (const d of ABAS.filter(x => DESTINADO[x.projeto] && x.projeto !== OB)) {
    ok(R.cent(-v(d.aba, 1, '08/2026')) === DESTINADO[d.projeto],
      `${d.projeto.padEnd(24)} cedeu ${brl(-v(d.aba, 1, '08/2026'))}`);
  }

  // 9/10/11. carteira
  console.log('\n9–11. Carteira sob gestão da Operação Básica');
  ok(v('operação básica • ENAP', 6, '08/2026') === 150002.11, `carteira ago ${brl(v('operação básica • ENAP', 6, '08/2026'))}`);
  ok(R.cent(-v('operação básica • ENAP', 7, '09/2026')) === 21600.00, `utilizado set ${brl(-v('operação básica • ENAP', 7, '09/2026'))}`);
  ok(v('operação básica • ENAP', 8, '09/2026') === 128402.11, `disponível set ${brl(v('operação básica • ENAP', 8, '09/2026'))}`);
  ok(v(CONS.aba, 6, '08/2026') === 150002.11, `consolidado carteira ${brl(v(CONS.aba, 6, '08/2026'))}`);
  ok(v(CONS.aba, 8, '09/2026') === 128402.11, `consolidado disponível ${brl(v(CONS.aba, 8, '09/2026'))}`);

  // saldo livre
  console.log('\nSaldo livre pós-Ofício (ago./26)');
  let sl = 0;
  for (const d of ABAS) { const x = v(d.aba, 5, '08/2026'); sl = R.cent(sl + x);
    ok(x === LIVRE[d.projeto], `${d.projeto.padEnd(24)} livre ${brl(x).padStart(15)}  (esperado ${brl(LIVRE[d.projeto])})`); }
  ok(sl === 452166.67, `soma dos livres ${brl(sl)}`);
  ok(v(CONS.aba, 5, '08/2026') === 452166.67, `consolidado livre ${brl(v(CONS.aba, 5, '08/2026'))}`);
  ok(v(CONS.aba, 9, '08/2026') === 0, `conferência livre + carteira = gerado → ${brl(v(CONS.aba, 9, '08/2026'))}`);

  // 12. pagamento uma única vez
  console.log('\n12. Pagamento 10647074');
  const linhasUso = mov.slice(1).filter(r => String(r[10] || '').trim() === '10647074');
  ok(linhasUso.length === 1, `aparece ${linhasUso.length} vez(es) na aba de movimentações`);
  ok(mov.slice(1).filter(r => String(r[0] || '').trim()).length === 5, `aba tem ${mov.slice(1).filter(r => String(r[0] || '').trim()).length} linhas`);

  // 13/14. saldos e projeções
  console.log('\n13–14. Saldos recalculados e projeções');
  const sf = (aba, mes) => { const L = S[aba]; const c = L.col[mes]; return c ? R.cent(Number(L.saldo[c - 1] || 0)) : null; };
  let t8 = 0, t9 = 0;
  for (const d of ABAS) {
    const a = sf(d.aba, '08/2026'), s = sf(d.aba, '09/2026');
    t8 = R.cent(t8 + a); t9 = R.cent(t9 + s);
    console.log(`     ${d.projeto.padEnd(24)} saldo final ago ${brl(a).padStart(16)}   set ${brl(s).padStart(16)}`);
  }
  console.log(`     ${'SOMA'.padEnd(24)} ${brl(t8).padStart(28)}   ${brl(t9).padStart(20)}`);
  ok(sf('operação básica • ENAP', '08/2026') > 300000, `Operação Básica recebeu a transferência no saldo final de agosto`);
  const setProj = rend('operação básica • ENAP', '09/2026');
  ok(setProj !== null && setProj > 0, `projeção de setembro recalculada a partir do novo saldo: ${brl(setProj)}`);

  // 15. fórmulas sem erro
  console.log('\n15. Fórmulas sem erro');
  let erros = 0;
  todas.forEach(d => (S[d.aba].bloco || []).forEach(row => (row || []).forEach(c => {
    if (typeof c === 'string' && /^#(REF|VALUE|DIV|NAME|N\/A|NUM|ERROR)/i.test(c)) erros++;
  })));
  ok(erros === 0, `nenhum #REF!/#VALUE! nos blocos da carteira`);

  console.log('\n' + '='.repeat(96));
  console.log(f.length ? `✗ ${f.length} critério(s) falharam` : '✓ TODOS OS CRITÉRIOS PASSARAM — diferença R$ 0,00');
  if (f.length) process.exit(1);
}
main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
