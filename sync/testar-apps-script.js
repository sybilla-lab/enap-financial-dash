/**
 * Teste do Apps Script fora do Apps Script — só leitura, não grava nada.
 *
 * Carrega apps-script/SyncRendimentos.gs num contexto isolado, com stubs para
 * os serviços do Google, e alimenta buscarBase_() com os dados REAIS da Base
 * lidos pela Sheets API. Assim o que é exercitado é o código que vai rodar na
 * planilha — leitura, parsing e rateio —, não uma reimplementação.
 *
 * Confere:
 *   1. o rateio do Apps Script contra sync/rateio-dashboard.js, mês a mês;
 *   2. o acumulado em 31/07/2026 contra o Ofício nº 04/2026;
 *   3. julho e agosto de 2026 contra o que está gravado na planilha oficial;
 *   4. o carregamento de 11/2025 e o fechamento de cada mês.
 *
 * Uso:  node sync/testar-apps-script.js
 * Sai com código 1 se qualquer conferência falhar.
 */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const GS = path.resolve(__dirname, '..', 'apps-script', 'SyncRendimentos.gs');

const OFICIO = {
  'Alimenta +1000 Cidades': 387456.64, 'CAR DPG': 72847.81,
  'Operação Básica': 37476.59, 'Co.NE': 26200.66, 'Parceria MDIC': 13477.05,
};
const JUL = { 'Operação Básica': 4026.54, 'Co.NE': 3463.54, 'Parceria MDIC': 13477.05,
              'Alimenta +1000 Cidades': 41513.82, 'CAR DPG': 7899.10 };
const AGO = { 'Operação Básica': 3311.96, 'Co.NE': 2711.33, 'Parceria MDIC': 13074.67,
              'Alimenta +1000 Cidades': 38814.67, 'CAR DPG': 6797.40 };

const brl = R.brl;
const comp = m => { const [mm, yy] = m.split('/'); return `${yy}-${mm}`; };

/** Ambiente mínimo do Apps Script, suficiente para as funções de leitura. */
function carregarGS(linhasPorGid) {
  const ctx = vm.createContext({
    console,
    Utilities: {
      parseCsv: t => t,
      formatDate: () => '',
      formatString: (f, v) => String(v),
    },
    UrlFetchApp: { fetch: () => { throw new Error('rede não deve ser usada no teste'); } },
    SpreadsheetApp: {
      getUi: () => ({ alert: () => {}, createMenu: () => ({ addItem() { return this; },
        addSeparator() { return this; }, addToUi() {} }), ButtonSet: { OK: 'OK' } }),
      getActiveSpreadsheet: () => { throw new Error('planilha não deve ser tocada no teste'); },
    },
  });
  vm.runInContext(fs.readFileSync(GS, 'utf8'), ctx, { filename: 'SyncRendimentos.gs' });
  // Substitui só o acesso à rede: o parsing e o rateio continuam sendo os reais.
  ctx.buscarBase_ = gid => {
    if (!linhasPorGid[gid]) throw new Error('gid sem dados no teste: ' + gid);
    return linhasPorGid[gid];
  };
  return ctx;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // ── Dados reais da Base, no formato de linhas que buscarBase_ devolveria ──
  const faixas = [
    `'${R.ABAS.rendimentos}'!A1:D2000`, `'${R.ABAS.principal}'!A1:M3000`,
    `'${R.ABAS.saldos}'!A1:E1000`, `'${R.ABAS.status}'!A1:B1000`,
  ];
  const vr = (await sheets.spreadsheets.values.batchGet({
    spreadsheetId: R.ID_BASE, ranges: faixas, valueRenderOption: 'FORMATTED_VALUE',
  })).data.valueRanges;
  const pad = (rows, n) => (rows || []).map(r => { const c = r.slice(); while (c.length < n) c.push(''); return c; });

  const ctx = carregarGS({
    '2032068393': pad(vr[0].values, 4),
    '0':          pad(vr[1].values, 13),
    '86178020':   pad(vr[2].values, 5),
    '1699326950': pad(vr[3].values, 2),
  });

  // ── Executa o código do Apps Script ───────────────────────────────────────
  const realizado = ctx.lerRealizadoTotal_();
  const atrib = ctx.calcularAtribuicao_(realizado);
  const compsGS = Object.keys(atrib).sort();

  // ── Referência: sync/rateio-dashboard.js ──────────────────────────────────
  const ref = R.contexto(await R.carregar(sheets));
  const hist = R.historicoPorProjeto(ref);

  const falhas = [];
  const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) falhas.push(msg); };

  console.log('APPS SCRIPT × rateio-dashboard.js  ·  mês a mês');
  console.log('='.repeat(96));
  console.log(`  período rateado pelo Apps Script: ${compsGS[0]} a ${compsGS[compsGS.length - 1]}  (${compsGS.length} meses)`);

  const mesesRef = ref.porMes.filter(m =>
    (ref.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado');
  ok(compsGS.length === mesesRef.length,
    `mesma janela: ${compsGS.length} meses no Apps Script, ${mesesRef.length} na referência`);

  for (const m of mesesRef) {
    const c = comp(m.mesAno);
    const a = atrib[c] || {};
    const meta = a.__meta__ || {};
    const f = R.fechar(R.rateioHistorico(hist, m.mesAno, m.liquido));

    let divergiu = false;
    const linhas = [];
    const projs = new Set([...Object.keys(a).filter(k => k !== '__meta__'), ...f.valores.map(v => v.projeto)]);
    for (const p of projs) {
      const vGS = R.cent(a[p] ?? 0);
      const vRef = R.cent((f.valores.find(v => v.projeto === p) || {}).valor ?? 0);
      if (vGS !== vRef) { divergiu = true; linhas.push(`      ${p}: GS ${brl(vGS)} × ref ${brl(vRef)}`); }
    }
    let soma = 0;
    for (const k of Object.keys(a)) if (k !== '__meta__') soma = R.cent(soma + a[k]);
    const fecha = soma === R.cent(meta.distribuido ?? 0);

    ok(!divergiu && fecha,
      `${c}  líquido ${brl(meta.liquidoOficial ?? 0).padStart(13)}` +
      `  distribuído ${brl(meta.distribuido ?? 0).padStart(13)}` +
      (meta.carregado ? `  carregado ${brl(meta.carregado)}` : '') +
      (meta.residuo ? `  resíduo ${brl(meta.residuo)} em ${meta.residuoEm}` : ''));
    linhas.forEach(l => console.log(l));
  }

  // ── Carregamento de 11/2025 ───────────────────────────────────────────────
  console.log('\nRegra de carregamento');
  console.log('='.repeat(96));
  const nov = atrib['2025-11'] || {}, dez = atrib['2025-12'] || {};
  ok((nov.__meta__ || {}).distribuido === 0, `11/2025 não distribui nada (líquido ${brl((nov.__meta__ || {}).liquidoOficial ?? 0)})`);
  ok(R.cent((dez.__meta__ || {}).carregado ?? 0) === -2060.93, `12/2025 recebe carregado de ${brl((dez.__meta__ || {}).carregado ?? 0)}`);
  ok(R.cent((dez.__meta__ || {}).distribuido ?? 0) === 62630.92, `12/2025 distribui ${brl((dez.__meta__ || {}).distribuido ?? 0)}`);

  // ── Acumulado × Ofício nº 04/2026 ─────────────────────────────────────────
  console.log('\nAcumulado em 31/07/2026 × Ofício nº 04/2026');
  console.log('='.repeat(96));
  const acum = {};
  for (const c of compsGS) {
    if (c > '2026-07') continue;
    for (const p of Object.keys(atrib[c])) {
      if (p === '__meta__') continue;
      acum[p] = R.cent((acum[p] ?? 0) + atrib[c][p]);
    }
  }
  let tot = 0;
  for (const [p, esperado] of Object.entries(OFICIO)) {
    tot = R.cent(tot + (acum[p] ?? 0));
    ok(R.cent(acum[p] ?? 0) === esperado, `${p.padEnd(24)} ${brl(acum[p] ?? 0).padStart(15)}  (Ofício ${brl(esperado)})`);
  }
  ok(tot === 537458.75, `TOTAL ${brl(tot)}  (Ofício R$ 537.458,75)`);

  // ── Julho e agosto × planilha oficial ─────────────────────────────────────
  console.log('\nJulho e agosto de 2026 × planilha oficial');
  console.log('='.repeat(96));
  for (const [c, esperado, total] of [['2026-07', JUL, 70380.05], ['2026-08', AGO, 64710.03]]) {
    let s = 0;
    for (const [p, v] of Object.entries(esperado)) {
      const got = R.cent(atrib[c][p] ?? 0);
      s = R.cent(s + got);
      ok(got === v, `${c}  ${p.padEnd(24)} ${brl(got).padStart(14)}  (planilha ${brl(v)})`);
    }
    ok(s === total, `${c}  soma ${brl(s)}  (planilha ${brl(total)})`);
  }

  console.log('\n' + '='.repeat(96));
  console.log(falhas.length ? `✗ ${falhas.length} conferência(s) falharam` : '✓ APPS SCRIPT VALIDADO — reproduz o método B, o Ofício e a planilha');
  if (falhas.length) process.exit(1);
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
