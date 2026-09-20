/**
 * Conferência da carteira autorizada — só leitura.
 *
 *   node sync/conferir-carteira.js --antes   → salva o estado das linhas de caixa
 *   node sync/conferir-carteira.js           → relê tudo e confere
 *
 * Verifica:
 *   1. não-contaminação: nenhuma fórmula de caixa referencia a aba de
 *      movimentações, e os valores dessas linhas são idênticos ao snapshot;
 *   2. fechamento de agosto/2026 — livre por projeto e no consolidado;
 *   3. fechamento de setembro/2026 — utilizado, disponível e remanescente;
 *   4. linhas de conferência do consolidado em zero;
 *   5. teto por projeto e rastreio reverso do pagamento;
 *   6. validação de dados e intervalos protegidos na aba de movimentações.
 */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_ORC = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
const ABA_MOV = 'Movimentações de Rendimentos';
const ARQ = path.resolve(__dirname, 'backups', 'caixa-antes-carteira.json');
const ANTES = process.argv.includes('--antes');

const ABAS = [
  { aba: 'operação básica • ENAP',        projeto: 'Operação Básica',        acum: 34, caixa: [8, 9, 27, 30, 31, 32] },
  { aba: 'co.ne • BID',                   projeto: 'Co.NE',                  acum: 32, caixa: [8, 9, 25, 28, 29, 30] },
  { aba: 'parceria • MDIC',               projeto: 'Parceria MDIC',          acum: 31, caixa: [8, 9, 24, 27, 28, 29] },
  { aba: 'alimenta +1.000 cidades • MDS', projeto: 'Alimenta +1000 Cidades', acum: 38, caixa: [8, 9, 31, 34, 35, 36] },
  { aba: 'car dpg • FBDS',                projeto: 'CAR DPG',                acum: 34, caixa: [8, 9, 27, 30, 31, 32] },
];
const CONS = { aba: 'consolidado • 2026 a 2028', acum: 31, caixa: [12, 13, 24, 27, 28, 29] };
const TODAS = [...ABAS, CONS];

// Esperado na coluna ago./26: rendimento livre por projeto
const LIVRE_AGO = {
  'Operação Básica': 3311.96, 'Co.NE': 2711.33, 'Parceria MDIC': 13074.67,
  'Alimenta +1000 Cidades': 426271.31, 'CAR DPG': 6797.40,
};
const AUT = { 'Operação Básica': 37476.59, 'Co.NE': 26200.66, 'Parceria MDIC': 13477.05,
              'Alimenta +1000 Cidades': 0, 'CAR DPG': 72847.81 };

const brl = R.brl;
const q = s => `'${s}'`;

async function ler(sheets) {
  const ranges = [];
  for (const d of TODAS) {
    ranges.push(`${q(d.aba)}!A5:BA5`);
    for (const l of d.caixa) ranges.push(`${q(d.aba)}!A${l}:BA${l}`);
    ranges.push(`${q(d.aba)}!A${d.acum}:BA${d.acum + (d === CONS ? 8 : 5)}`);
  }
  const [num, frm, fmt] = await Promise.all([
    sheets.spreadsheets.values.batchGet({ spreadsheetId: ID_ORC, ranges, valueRenderOption: 'UNFORMATTED_VALUE' }),
    sheets.spreadsheets.values.batchGet({ spreadsheetId: ID_ORC, ranges, valueRenderOption: 'FORMULA' }),
    sheets.spreadsheets.values.batchGet({ spreadsheetId: ID_ORC, ranges, valueRenderOption: 'FORMATTED_VALUE' }),
  ]);
  const out = {}; let i = 0;
  for (const d of TODAS) {
    const cab = (fmt.data.valueRanges[i].values || [[]])[0] || [];
    const colPorMes = {};
    cab.forEach((c, j) => {
      const s = String(c || '').toLowerCase().replace(/\./g, '').trim();
      const mm = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2})$/);
      if (mm) { const M = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
        colPorMes[`${String(M[mm[1]]).padStart(2, '0')}/20${mm[2]}`] = j + 1; }
    });
    i++;
    const caixa = {};
    for (const l of d.caixa) {
      caixa[l] = { num: (num.data.valueRanges[i].values || [[]])[0] || [],
                   frm: (frm.data.valueRanges[i].values || [[]])[0] || [] };
      i++;
    }
    const bloco = { num: num.data.valueRanges[i].values || [], frm: frm.data.valueRanges[i].values || [] };
    i++;
    out[d.aba] = { colPorMes, caixa, bloco, acum: d.acum };
  }
  return out;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const st = await ler(sheets);

  if (ANTES) {
    const so = {};
    for (const d of TODAS) so[d.aba] = { caixa: st[d.aba].caixa, colPorMes: st[d.aba].colPorMes };
    fs.mkdirSync(path.dirname(ARQ), { recursive: true });
    fs.writeFileSync(ARQ, JSON.stringify(so, null, 2), 'utf8');
    console.log('Estado das linhas de caixa salvo em ' + ARQ);
    for (const d of TODAS) console.log(`  ${d.aba.padEnd(32)} linhas ${d.caixa.join(', ')}`);
    return;
  }

  const falhas = [];
  const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
  const val = (aba, lin, mes) => {
    const L = st[aba]; const c = L.colPorMes[mes]; if (!c) return null;
    const off = lin - L.acum;
    const linha = off >= 0 ? (L.bloco.num[off] || []) : (L.caixa[lin] || {}).num || [];
    return R.cent(Number(linha[c - 1] || 0));
  };

  // ── 1. Não-contaminação ──────────────────────────────────────────────────
  console.log('1. NÃO-CONTAMINAÇÃO — o caixa não pode enxergar a carteira');
  console.log('='.repeat(92));
  let refs = 0;
  for (const d of TODAS) {
    for (const l of d.caixa) {
      (st[d.aba].caixa[l].frm || []).forEach((c, j) => {
        if (/Movimenta/i.test(String(c))) { console.log(`     ✗ ${d.aba}!${j + 1}:${l} referencia a aba`); refs++; }
      });
    }
  }
  ok(refs === 0, 'nenhuma fórmula de Rendimentos, TOTAL, Resultado, Saldo Inicial ou Saldo Final cita a aba de movimentações');

  if (fs.existsSync(ARQ)) {
    const antes = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
    let dif = 0;
    for (const d of TODAS) {
      for (const l of d.caixa) {
        const a = ((antes[d.aba] || {}).caixa || {})[l];
        if (!a) continue;
        const dep = st[d.aba].caixa[l].num;
        const n = Math.max(a.num.length, dep.length);
        for (let j = 0; j < n; j++) {
          const x = typeof a.num[j] === 'number' ? R.cent(a.num[j]) : null;
          const y = typeof dep[j] === 'number' ? R.cent(dep[j]) : null;
          if (x !== y) { console.log(`     ✗ ${d.aba} linha ${l} col ${j + 1}: ${x} → ${y}`); dif++; }
        }
      }
    }
    ok(dif === 0, `valores das ${TODAS.reduce((s, d) => s + d.caixa.length, 0)} linhas de caixa idênticos ao snapshot anterior`);
  } else {
    console.log('  · sem snapshot anterior (rode com --antes antes de gravar)');
  }

  // ── 2. Fechamento de agosto/2026 ─────────────────────────────────────────
  console.log('\n2. FECHAMENTO DE AGOSTO/2026  (coluna ago./26)');
  console.log('='.repeat(92));
  console.log('  projeto                     acum gerado   (−) autoriz.        livre     disponível');
  let somaLivre = 0;
  for (const d of ABAS) {
    const a = d.acum;
    const ger = val(d.aba, a, '08/2026'), aut = val(d.aba, a + 1, '08/2026');
    const livre = val(d.aba, a + 2, '08/2026'), disp = val(d.aba, a + 5, '08/2026');
    somaLivre = R.cent(somaLivre + livre);
    console.log(`  ${d.projeto.padEnd(24)} ${brl(ger).padStart(14)} ${brl(aut).padStart(14)} ${brl(livre).padStart(14)} ${brl(disp).padStart(14)}`);
    ok(livre === LIVRE_AGO[d.projeto], `  ${d.projeto.padEnd(24)} livre ${brl(livre)}  (esperado ${brl(LIVRE_AGO[d.projeto])})`);
    ok(R.cent(-aut) === AUT[d.projeto], `  ${d.projeto.padEnd(24)} autorizado ${brl(-aut)}  (esperado ${brl(AUT[d.projeto])})`);
  }
  ok(somaLivre === 452166.67, `soma dos livres das 5 abas = ${brl(somaLivre)}  (esperado R$ 452.166,67)`);

  const ca = CONS.acum;
  ok(val(CONS.aba, ca, '08/2026') === 602168.78, `consolidado acumulado gerado ${brl(val(CONS.aba, ca, '08/2026'))}`);
  ok(val(CONS.aba, ca + 2, '08/2026') === 452166.67, `consolidado livre ${brl(val(CONS.aba, ca + 2, '08/2026'))}`);
  ok(val(CONS.aba, ca + 3, '08/2026') === 150002.11, `consolidado autorizado ${brl(val(CONS.aba, ca + 3, '08/2026'))}`);
  ok(val(CONS.aba, ca + 4, '08/2026') === 0, `consolidado utilizado ${brl(val(CONS.aba, ca + 4, '08/2026'))}  (utilização é de 09/2026)`);
  ok(val(CONS.aba, ca + 5, '08/2026') === 150002.11, `consolidado disponível ${brl(val(CONS.aba, ca + 5, '08/2026'))}`);

  // ── 3. Fechamento de setembro/2026 ───────────────────────────────────────
  console.log('\n3. FECHAMENTO DE SETEMBRO/2026  (coluna set./26)');
  console.log('='.repeat(92));
  ok(R.cent(-val(CONS.aba, ca + 4, '09/2026')) === 21600.00, `consolidado utilizado ${brl(-val(CONS.aba, ca + 4, '09/2026'))}`);
  ok(val(CONS.aba, ca + 5, '09/2026') === 128402.11, `consolidado autorizado disponível ${brl(val(CONS.aba, ca + 5, '09/2026'))}`);
  // Ancorado no último mês realizado (ago./26): rendimento realizado − utilizado.
  ok(val(CONS.aba, ca + 6, '08/2026') === 602168.78,
    `saldo financeiro remanescente em ago./26 ${brl(val(CONS.aba, ca + 6, '08/2026'))}  (nada utilizado ainda)`);
  ok(val(CONS.aba, ca + 6, '09/2026') === 580568.78,
    `saldo financeiro remanescente em set./26 ${brl(val(CONS.aba, ca + 6, '09/2026'))}  (602.168,78 − 21.600,00)`);
  const ob = ABAS[0];
  ok(val(ob.aba, ob.acum + 5, '09/2026') === 15876.59,
    `Operação Básica disponível ${brl(val(ob.aba, ob.acum + 5, '09/2026'))}  (cota 37.476,59 − 21.600,00)`);
  ok(R.cent(-val(ob.aba, ob.acum + 4, '09/2026')) === 21600.00,
    `Operação Básica utilizado ${brl(-val(ob.aba, ob.acum + 4, '09/2026'))}`);
  for (const d of ABAS.slice(1)) {
    ok(val(d.aba, d.acum + 4, '09/2026') === 0, `${d.projeto.padEnd(24)} utilizado R$ 0,00 — sem consumo de cota`);
  }

  // ── 4. Linhas de conferência ─────────────────────────────────────────────
  console.log('\n4. LINHAS DE CONFERÊNCIA DO CONSOLIDADO');
  console.log('='.repeat(92));
  for (const mes of ['07/2026', '08/2026', '09/2026']) {
    ok(val(CONS.aba, ca + 7, mes) === 0, `${mes}  identidade livre+disponível+utilizado = acumulado → ${brl(val(CONS.aba, ca + 7, mes))}`);
  }
  for (const mes of ['01/2026', '07/2026', '08/2026', '12/2026']) {
    const v = val(CONS.aba, ca + 8, mes);
    if (v === null) continue;
    ok(v === 0, `${mes}  soma das 5 abas × consolidado → ${brl(v)}`);
  }

  // ── 5. Teto e rastreio reverso ───────────────────────────────────────────
  console.log('\n5. TETO E RASTREIO REVERSO');
  console.log('='.repeat(92));
  const mov = (await sheets.spreadsheets.values.get({
    spreadsheetId: ID_ORC, range: `${q(ABA_MOV)}!A1:P100`, valueRenderOption: 'UNFORMATTED_VALUE',
  })).data.values || [];
  const linhas = mov.slice(1).filter(r => String(r[0] || '').trim());
  ok(linhas.length === 5, `aba de movimentações tem ${linhas.length} linhas`);

  const usoPorProj = {}, autPorProj = {};
  linhas.forEach(r => {
    const tipo = String(r[3] || ''), proj = String(r[5] || ''), v = R.cent(Number(r[6] || 0));
    if (String(r[14]).trim() !== 'vigente') return;
    if (/^autoriza/i.test(tipo)) autPorProj[proj] = R.cent((autPorProj[proj] ?? 0) + v);
    else usoPorProj[proj] = R.cent((usoPorProj[proj] ?? 0) + v);
  });
  for (const [p, u] of Object.entries(usoPorProj)) {
    ok(u <= (autPorProj[p] ?? 0) + 0.005, `teto ${p}: utilizado ${brl(u)} ≤ cota ${brl(autPorProj[p] ?? 0)}`);
  }
  ok(R.cent(Object.values(autPorProj).reduce((s, v) => s + v, 0)) === 150002.11, 'soma das autorizações vigentes = R$ 150.002,11');

  const princ = (await sheets.spreadsheets.values.get({
    spreadsheetId: R.ID_BASE, range: `'${R.ABAS.principal}'!A1:M3000`, valueRenderOption: 'FORMATTED_VALUE',
  })).data.values || [];
  linhas.filter(r => !/^autoriza/i.test(String(r[3]))).forEach(r => {
    const pag = String(r[7] || '').trim();
    const achou = princ.find(x => String(x[3] || '').trim() === pag);
    ok(!!achou, `pagamento ${pag} rastreado na Base`);
    if (achou) {
      const v = Math.abs(R.cent(parseFloat(String(achou[12] || achou[4] || '0').replace(/[()R$\s]/g, '').replace(/\./g, '').replace(',', '.'))));
      ok(v === R.cent(Number(r[6])), `  valor ${brl(v)} confere`);
      ok(String(achou[10] || '').trim() === String(r[5] || '').trim(), `  projeto "${String(achou[10]).trim()}" confere`);
    }
  });

  // ── 6. Validação de dados e proteção ─────────────────────────────────────
  console.log('\n6. VALIDAÇÃO DE DADOS E PROTEÇÃO');
  console.log('='.repeat(92));
  // Duas chamadas de propósito: spreadsheets.get com `ranges` devolve SÓ as abas
  // cobertas por esses ranges, então as proteções das outras abas sumiriam.
  const [grid, meta] = await Promise.all([
    sheets.spreadsheets.get({ spreadsheetId: ID_ORC, includeGridData: true,
      ranges: [`${q(ABA_MOV)}!A2:P2`], fields: 'sheets(properties.title,data.rowData.values.dataValidation)' }),
    sheets.spreadsheets.get({ spreadsheetId: ID_ORC,
      fields: 'sheets(properties(sheetId,title),protectedRanges(description,range,warningOnly))' }),
  ]);
  const shMov = grid.data.sheets.find(s => s.properties.title === ABA_MOV);
  const dv = (((shMov.data || [])[0] || {}).rowData || [{}])[0].values || [];
  ok(!!(dv[3] || {}).dataValidation, 'coluna D (tipo) tem validação de lista');
  ok(!!(dv[14] || {}).dataValidation, 'coluna O (status) tem validação de lista');
  ok(!!(dv[5] || {}).dataValidation, 'coluna F (projeto_origem) tem validação de lista');

  const prot = [];
  meta.data.sheets.forEach(s => (s.protectedRanges || []).forEach(p =>
    prot.push({ aba: s.properties.title, desc: p.description || '', aviso: !!p.warningOnly })));
  ok(prot.filter(p => p.aba === ABA_MOV).length >= 4, `${prot.filter(p => p.aba === ABA_MOV).length} colunas técnicas protegidas na aba de movimentações`);
  ok(prot.filter(p => /Carteira autorizada/i.test(p.desc)).length === 6, `${prot.filter(p => /Carteira autorizada/i.test(p.desc)).length} blocos de carteira protegidos`);
  ok(prot.every(p => p.aviso), 'todas as proteções são do tipo aviso — não travam o dono da planilha');

  console.log('\n' + '='.repeat(92));
  console.log(falhas.length ? `✗ ${falhas.length} conferência(s) falharam` : '✓ TODAS AS CONFERÊNCIAS PASSARAM');
  if (falhas.length) process.exit(1);
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
