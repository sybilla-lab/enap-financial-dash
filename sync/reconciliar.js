/**
 * Reconciliação do histórico 09/2025–08/2026 — só leitura.
 *
 * Para cada competência do período disponível, compara o rateio oficial
 * (método B, com o resíduo de centavos no projeto de maior participação
 * daquele mês) contra o que está gravado na linha "Rendimentos" da planilha
 * oficial, e contra a abertura histórica da linha de saldo acumulado.
 *
 * Não grava nada. Emite a lista exata de células divergentes.
 *
 * Uso:  node sync/reconciliar.js
 */
const { google } = require('googleapis');
const path = require('path');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_ORC = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';

// aba → projeto · linha de Rendimentos · linha do saldo acumulado de rendimentos
const ABAS = [
  { aba: 'operação básica • ENAP',        projeto: 'Operação Básica',        linha: 8,  acum: 34 },
  { aba: 'co.ne • BID',                   projeto: 'Co.NE',                  linha: 8,  acum: 32 },
  { aba: 'parceria • MDIC',               projeto: 'Parceria MDIC',          linha: 8,  acum: 31 },
  { aba: 'alimenta +1.000 cidades • MDS', projeto: 'Alimenta +1000 Cidades', linha: 8,  acum: 38 },
  { aba: 'car dpg • FBDS',                projeto: 'CAR DPG',                linha: 8,  acum: 34 },
];
const CONSOLIDADO = { aba: 'consolidado • 2026 a 2028', linha: 12, acum: 31 };

const PROJETOS = ABAS.map(a => a.projeto);
const OFICIO = {
  'Alimenta +1000 Cidades': 387456.64, 'CAR DPG': 72847.81,
  'Operação Básica': 37476.59, 'Co.NE': 26200.66, 'Parceria MDIC': 13477.05,
};

const brl = R.brl;
const colLetra = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };
const curto = p => ({ 'Alimenta +1000 Cidades': 'Alimenta', 'CAR DPG': 'CAR DPG',
  'Operação Básica': 'Op.Básica', 'Co.NE': 'Co.NE', 'Parceria MDIC': 'MDIC' })[p] || p;

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY,
    scopes: [process.argv.includes('--write')
      ? 'https://www.googleapis.com/auth/spreadsheets'
      : 'https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const ctx = R.contexto(await R.carregar(sheets));
  const hist = R.historicoPorProjeto(ctx);

  // Meses do período disponível
  const meses = ctx.porMes
    .filter(m => (ctx.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado')
    .sort((a, b) => R.mesKey(a.mesAno) - R.mesKey(b.mesAno));

  // ── Alvo oficial por mês: método B + fechamento do resíduo ────────────────
  const alvo = {};   // mes → { projeto: valor }, __residuo
  for (const m of meses) {
    const f = R.fechar(R.rateioHistorico(hist, m.mesAno, m.liquido));
    const o = { __liquido: R.cent(m.liquido), __residuo: f.ajuste };
    f.valores.forEach(v => { o[v.projeto] = v.valor; });
    alvo[m.mesAno] = o;
  }

  // ── Lê a planilha: linha de Rendimentos e abertura do acumulado ───────────
  const planilha = {};   // aba → { colPorMes, valores[], aberturaFormula, aberturaValor }
  for (const d of [...ABAS, CONSOLIDADO]) {
    const cab = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `'${d.aba}'!A5:BA5`, valueRenderOption: 'FORMATTED_VALUE',
    })).data.values || [[]])[0] || [];
    const vals = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `'${d.aba}'!A${d.linha}:BA${d.linha}`, valueRenderOption: 'UNFORMATTED_VALUE',
    })).data.values || [[]])[0] || [];
    const acumF = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `'${d.aba}'!A${d.acum}:F${d.acum}`, valueRenderOption: 'FORMULA',
    })).data.values || [[]])[0] || [];

    const colPorMes = {};
    cab.forEach((c, i) => {
      const s = String(c || '').toLowerCase().replace(/\./g, '').trim();
      const mm = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2})$/);
      if (mm) {
        const M = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
        colPorMes[`${String(M[mm[1]]).padStart(2, '0')}/20${mm[2]}`] = i + 1;
      }
    });

    // abertura: primeira célula da linha acumulada, no formato "=12007,9+C8"
    const prim = colPorMes[Object.keys(colPorMes).sort((a, b) => R.mesKey(a) - R.mesKey(b))[0]];
    const formula = String(acumF[prim - 1] ?? '');
    const mAb = formula.match(/^=\s*([\d.,]+)\s*\+/);
    planilha[d.aba] = {
      colPorMes, vals, linha: d.linha, acum: d.acum,
      colPrimeira: prim,
      aberturaFormula: formula,
      abertura: mAb ? parseFloat(mAb[1].replace(/\./g, '').replace(',', '.')) : null,
    };
  }

  // ── Tabela mês a mês ──────────────────────────────────────────────────────
  console.log('='.repeat(118));
  console.log('RECONCILIAÇÃO 09/2025 – 08/2026   ·   método B (oficial) × planilha');
  console.log('='.repeat(118));
  console.log();
  console.log('  comp     líquido Base   projeto      método B      planilha     diferença   resíduo');
  console.log('  ' + '-'.repeat(114));

  const divergencias = [];
  let somaDifAbs = 0;

  for (const m of meses) {
    const a = alvo[m.mesAno];
    const res = a.__residuo ? a.__residuo.projeto : '—';
    let somaB = 0, somaP = 0, primeira = true;

    for (const proj of PROJETOS) {
      const vB = a[proj] ?? 0;
      if (vB === 0 && !PROJETOS.some(p => p === proj && a[p])) { /* projeto sem rateio no mês */ }
      somaB = R.cent(somaB + vB);

      const d = ABAS.find(x => x.projeto === proj);
      const pl = planilha[d.aba];
      const col = pl.colPorMes[m.mesAno];
      const naPlanilha = col ? (typeof pl.vals[col - 1] === 'number' ? R.cent(pl.vals[col - 1]) : null) : null;
      if (naPlanilha !== null) somaP = R.cent(somaP + naPlanilha);

      const dif = naPlanilha === null ? null : R.cent(naPlanilha - vB);
      if (dif !== null && dif !== 0) {
        divergencias.push({ aba: d.aba, celula: `${colLetra(col)}${d.linha}`, mes: m.mesAno,
                            projeto: proj, antes: naPlanilha, depois: vB, dif });
        somaDifAbs = R.cent(somaDifAbs + Math.abs(dif));
      }

      const marca = dif === null ? ' (fora da aba)' : dif === 0 ? '' : '  ←';
      console.log(`  ${(primeira ? m.mesAno : '').padEnd(9)}${(primeira ? brl(a.__liquido) : '').padStart(13)}   ` +
        `${curto(proj).padEnd(11)}${brl(vB).padStart(13)}${(naPlanilha === null ? '—' : brl(naPlanilha)).padStart(14)}` +
        `${(dif === null ? '—' : brl(dif)).padStart(13)}   ${primeira ? curto(res) : ''}${marca}`);
      primeira = false;
    }
    const difSoma = R.cent(somaP - a.__liquido);
    const temColunas = PROJETOS.some(p => planilha[ABAS.find(x => x.projeto === p).aba].colPorMes[m.mesAno]);
    console.log(`  ${''.padEnd(9)}${''.padStart(13)}   ${'soma'.padEnd(11)}${brl(somaB).padStart(13)}` +
      `${(temColunas ? brl(somaP) : '—').padStart(14)}${(temColunas ? brl(difSoma) : '—').padStart(13)}` +
      `   ${temColunas && difSoma !== 0 ? '✗ não fecha' : temColunas ? '✓ fecha' : '(2025: fora da linha 8)'}`);
    console.log();
  }

  // ── Abertura histórica (09–12/2025) ───────────────────────────────────────
  console.log('='.repeat(118));
  console.log('ABERTURA HISTÓRICA 09–12/2025  ·  embutida na linha "Saldo acumulado de rendimentos"');
  console.log('='.repeat(118));
  const fim2025 = '12/2025';
  const acum2025 = {};
  for (const m of meses) {
    if (R.mesKey(m.mesAno) > R.mesKey(fim2025)) continue;
    for (const p of PROJETOS) acum2025[p] = R.cent((acum2025[p] ?? 0) + (alvo[m.mesAno][p] ?? 0));
  }
  let somaAb = 0, somaAbB = 0;
  for (const d of ABAS) {
    const pl = planilha[d.aba];
    const oficial = acum2025[d.projeto] ?? 0;
    const dif = R.cent((pl.abertura ?? 0) - oficial);
    somaAb = R.cent(somaAb + (pl.abertura ?? 0));
    somaAbB = R.cent(somaAbB + oficial);
    console.log(`  ${d.aba.padEnd(32)} ${colLetra(pl.colPrimeira)}${d.acum}  ${String(pl.aberturaFormula).slice(0, 18).padEnd(20)}` +
      `planilha ${brl(pl.abertura ?? 0).padStart(13)}   método B ${brl(oficial).padStart(13)}   dif ${brl(dif).padStart(9)}${dif !== 0 ? '  ←' : ''}`);
    if (dif !== 0) divergencias.push({ aba: d.aba, celula: `${colLetra(pl.colPrimeira)}${d.acum}`,
      mes: 'abertura 09–12/2025', projeto: d.projeto, antes: pl.abertura, depois: oficial, dif, abertura: true });
  }
  const plc = planilha[CONSOLIDADO.aba];
  console.log(`  ${CONSOLIDADO.aba.padEnd(32)} ${colLetra(plc.colPrimeira)}${CONSOLIDADO.acum}  ${String(plc.aberturaFormula).slice(0, 18).padEnd(20)}` +
    `planilha ${brl(plc.abertura ?? 0).padStart(13)}   método B ${brl(somaAbB).padStart(13)}   dif ${brl(R.cent((plc.abertura ?? 0) - somaAbB)).padStart(9)}` +
    `${R.cent((plc.abertura ?? 0) - somaAbB) !== 0 ? '  ←' : ''}`);
  if (R.cent((plc.abertura ?? 0) - somaAbB) !== 0) divergencias.push({ aba: CONSOLIDADO.aba,
    celula: `${colLetra(plc.colPrimeira)}${CONSOLIDADO.acum}`, mes: 'abertura 09–12/2025', projeto: '(consolidado)',
    antes: plc.abertura, depois: somaAbB, dif: R.cent((plc.abertura ?? 0) - somaAbB), abertura: true });
  console.log(`  ${'soma das 5 abas'.padEnd(32)} ${''.padEnd(24)}planilha ${brl(somaAb).padStart(13)}   método B ${brl(somaAbB).padStart(13)}`);

  // ── Acumulado por projeto nos marcos ──────────────────────────────────────
  for (const [rotulo, corte, esperado] of [['31/07/2026', '07/2026', OFICIO], ['31/08/2026', '08/2026', null]]) {
    console.log('\n' + '='.repeat(118));
    console.log(`ACUMULADO POR PROJETO EM ${rotulo}  ·  método B com resíduo fechado`);
    console.log('='.repeat(118));
    let tot = 0;
    for (const p of PROJETOS) {
      let ac = 0;
      for (const m of meses) if (R.mesKey(m.mesAno) <= R.mesKey(corte)) ac = R.cent(ac + (alvo[m.mesAno][p] ?? 0));
      tot = R.cent(tot + ac);
      const ofi = esperado ? esperado[p] : null;
      console.log(`  ${curto(p).padEnd(12)} ${brl(ac).padStart(15)}` +
        (ofi === null ? '' : `   Ofício ${brl(ofi).padStart(14)}   dif ${brl(R.cent(ac - ofi)).padStart(8)}${R.cent(ac - ofi) !== 0 ? '  ✗' : '  ✓'}`));
    }
    const alvoTot = esperado ? 537458.75 : 602168.78;
    console.log(`  ${'TOTAL'.padEnd(12)} ${brl(tot).padStart(15)}   esperado ${brl(alvoTot).padStart(13)}   dif ${brl(R.cent(tot - alvoTot)).padStart(8)}${R.cent(tot - alvoTot) !== 0 ? '  ✗' : '  ✓'}`);
  }

  // ── Lista de células a alterar ────────────────────────────────────────────
  console.log('\n' + '='.repeat(118));
  console.log(`CÉLULAS DIVERGENTES: ${divergencias.length}`);
  console.log('='.repeat(118));
  if (!divergencias.length) console.log('  nenhuma — a planilha já reproduz o método B');
  divergencias.forEach(d => console.log(
    `  ${d.aba.padEnd(32)} ${d.celula.padEnd(6)} ${String(d.mes).padEnd(20)} ${curto(d.projeto).padEnd(11)}` +
    `${brl(d.antes).padStart(14)} → ${brl(d.depois).padStart(14)}   (${brl(-d.dif)})${d.abertura ? '   [abertura]' : ''}`));
  console.log(`\n  soma das diferenças absolutas na linha 8: ${brl(somaDifAbs)}`);

  if (process.env.RECON_JSON) {
    require('fs').writeFileSync(process.env.RECON_JSON, JSON.stringify({ alvo, divergencias }, null, 2));
    console.log('  JSON: ' + process.env.RECON_JSON);
  }

  // ── Correção ──────────────────────────────────────────────────────────────
  if (!divergencias.length) return;

  const updates = [];
  for (const d of divergencias) {
    // Trava: só diferenças de centavos. Qualquer coisa maior é erro de
    // metodologia, não de arredondamento, e não se conserta por aqui.
    if (Math.abs(d.dif) > 0.02)
      throw new Error(`${d.aba}!${d.celula}: diferença de ${brl(d.dif)} é grande demais para correção de centavos`);

    if (d.abertura) {
      // Reescreve só a constante dentro de "=45640,78+C8", preservando a fórmula.
      const pl = planilha[d.aba];
      const nova = pl.aberturaFormula.replace(
        /^=\s*[\d.,]+\s*\+/,
        '=' + d.depois.toFixed(2).replace('.', ',') + '+');
      if (!nova.startsWith('=') || nova === pl.aberturaFormula)
        throw new Error(`${d.aba}!${d.celula}: não consegui reescrever a abertura com segurança`);
      updates.push({ range: `'${d.aba}'!${d.celula}`, values: [[nova]], nota: nova });
    } else {
      const lin = parseInt(d.celula.match(/(\d+)$/)[1]);
      if (lin !== 8) throw new Error(`gravação fora da linha 8: ${d.celula}`);
      updates.push({ range: `'${d.aba}'!${d.celula}`, values: [[d.depois]], nota: d.depois });
    }
  }

  console.log('\n' + '='.repeat(118));
  if (!process.argv.includes('--write')) {
    console.log(`SIMULAÇÃO — ${updates.length} células seriam corrigidas. Rode com --write para aplicar.`);
    updates.forEach(u => console.log('   ' + u.range.padEnd(44) + JSON.stringify(u.nota)));
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID_ORC,
    requestBody: { valueInputOption: 'USER_ENTERED',
                   data: updates.map(u => ({ range: u.range, values: u.values })) },
  });
  console.log(`✓ CORRIGIDO: ${updates.length} células.`);
  updates.forEach(u => console.log('   ' + u.range.padEnd(44) + JSON.stringify(u.nota)));
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
