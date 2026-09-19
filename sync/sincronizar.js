/**
 * Sincronização do realizado: Base/Dashboard (leitura) → Orçamento (escrita).
 *
 * Direção única. O rateio por projeto NÃO é reinventado aqui: sai de
 * sync/rateio-dashboard.js, que é a réplica fiel de computarHistoricoPorProjeto()
 * do dashboard (saldo corrente mês a mês, com transferência dos projetos
 * encerrados para Operação Básica). Esse é o mesmo cálculo que alimenta o modal
 * de rendimentos e o mesmo que produziu jan–jun/26 na planilha oficial.
 *
 * O que grava, por mês alvo:
 *   · linha 8 das 5 abas de projeto (linha 12 no consolidado) → valor realizado;
 *   · linha 4 da mesma coluna → "realizado".
 * Substitui a projeção do mês que virou realizado. Não toca em nenhuma outra
 * coluna: os meses futuros mantêm as fórmulas =MAX(0;AVERAGE(...)) e se
 * reprojetam sozinhos a partir do novo saldo.
 *
 * Uso:
 *   node sync/sincronizar.js                    → simulação (padrão), não grava
 *   node sync/sincronizar.js --write            → grava
 *   node sync/sincronizar.js 08/2026 --write    → grava só agosto
 */
const { google } = require('googleapis');
const path = require('path');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');

// Destino oficial — Google Planilha nativa "Orçamento e Rendimentos 2026-2028".
const ID_ORC = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
// Guarda dura: nunca gravar no arquivo .xlsx antigo do Drive.
const ID_PROIBIDO = '1fd5ou9MV5tHArxuQnKIn-B6pypxa6Bsn';

const GRAVAR = process.argv.includes('--write');
const MESES_ALVO = process.argv.slice(2).filter(a => /^\d{2}\/\d{4}$/.test(a));
const MESES = MESES_ALVO.length ? MESES_ALVO : ['07/2026', '08/2026'];

// Meses protegidos: nada antes de jul./26 pode ser tocado.
const PISO = R.mesKey('07/2026');

const LINHA_MARCA = 4;   // "realizado" / "orçado"
const LINHA_MESES = 5;   // jan./26, fev./26, ...

// O consolidado NÃO recebe valor: a linha 12 soma a linha 8 das cinco abas de
// projeto e deve continuar sendo fórmula. Só a marca realizado/orçado é escrita.
const DESTINOS = [
  { aba: 'consolidado • 2026 a 2028',     projeto: null,                     linha: 12, somenteMarca: true },
  { aba: 'operação básica • ENAP',        projeto: 'Operação Básica',        linha: 8 },
  { aba: 'co.ne • BID',                   projeto: 'Co.NE',                  linha: 8 },
  { aba: 'parceria • MDIC',               projeto: 'Parceria MDIC',          linha: 8 },
  { aba: 'alimenta +1.000 cidades • MDS', projeto: 'Alimenta +1000 Cidades', linha: 8 },
  { aba: 'car dpg • FBDS',                projeto: 'CAR DPG',                linha: 8 },
];

const MESES_PT = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

const brl = R.brl;
const colLetra = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };

/** "jul./26" → "07/2026" */
function mesDeCabecalho(c) {
  const s = String(c || '').toLowerCase().replace(/\./g, '').trim();
  const m = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2,4})$/);
  if (!m) return '';
  const ano = m[2].length === 2 ? '20' + m[2] : m[2];
  return `${String(MESES_PT[m[1]]).padStart(2, '0')}/${ano}`;
}

const ehFormula = c => String(c ?? '').trim().startsWith('=');

/** FORMULA devolve número cru para célula de valor e string "=..." para fórmula. */
function valorDeFormula(c) {
  if (typeof c === 'number') return c;
  const s = String(c ?? '').trim();
  if (!s || ehFormula(s)) return null;
  const v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return isNaN(v) ? null : v;
}

async function main() {
  if (ID_ORC === ID_PROIBIDO) throw new Error('destino aponta para o arquivo proibido');
  console.log('DESTINO   ' + ID_ORC);
  console.log('          https://docs.google.com/spreadsheets/d/' + ID_ORC + '/edit');
  console.log('ORIGEM    ' + R.ID_BASE + '  (abas ' + Object.values(R.ABAS).join(', ') + ')');
  console.log('MESES     ' + MESES.join(', ') + (GRAVAR ? '   [GRAVAÇÃO]' : '   [SIMULAÇÃO]'));
  console.log();

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY,
    scopes: [GRAVAR ? 'https://www.googleapis.com/auth/spreadsheets'
                    : 'https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // ── 1. Rateio realizado, do mesmo cálculo do dashboard ───────────────────
  const ctx = R.contexto(await R.carregar(sheets));
  const hist = R.historicoPorProjeto(ctx);

  const rateio = {};
  for (const mes of MESES) {
    if (R.mesKey(mes) < PISO)
      throw new Error(`${mes} é anterior a 07/2026 — meses fechados não podem ser tocados`);
    const linhaMes = ctx.porMes.find(m => m.mesAno === mes);
    if (!linhaMes) throw new Error(`${mes} não existe na aba Rendimentos da Base`);
    const f = R.fechar(R.rateioHistorico(hist, mes, linhaMes.liquido));
    if (R.cent(f.somaFinal) !== R.cent(f.alvo))
      throw new Error(`${mes}: rateio não fecha (${brl(f.somaFinal)} vs ${brl(f.alvo)})`);
    rateio[mes] = f;

    console.log(`${mes}  líquido realizado ${brl(f.alvo)}`);
    f.valores.slice().sort((a, b) => b.valor - a.valor).forEach(x =>
      console.log(`   ${x.projeto.padEnd(26)} ${brl(x.valor).padStart(15)}   ${x.pct.toFixed(4).padStart(8)}%`));
    console.log(`   ${'soma'.padEnd(26)} ${brl(f.somaFinal).padStart(15)}   ✓ fecha`);
    if (f.ajuste) console.log(`   (resíduo de ${brl(f.ajuste.valor)} alocado em ${f.ajuste.projeto})`);
    console.log();
  }

  // ── 2. Monta a gravação, aba por aba ─────────────────────────────────────
  const updates = [];
  const formulasPreservadas = [];

  for (const d of DESTINOS) {
    // Linhas 4 e 5 são texto/data → FORMATTED_VALUE ("jul./26", "orçado").
    // A linha de rendimentos vai em FORMULA para distinguir projeção de valor fixo.
    const [marca, cabec] = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: ID_ORC,
      ranges: [`'${d.aba}'!A${LINHA_MARCA}:BA${LINHA_MARCA}`,
               `'${d.aba}'!A${LINHA_MESES}:BA${LINHA_MESES}`],
      valueRenderOption: 'FORMATTED_VALUE',
    }).then(r => r.data.valueRanges.map(v => (v.values || [[]])[0] || []));

    const valores = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `'${d.aba}'!A${d.linha}:BA${d.linha}`,
      valueRenderOption: 'FORMULA',
    })).data.values || [[]])[0] || [];

    const colPorMes = {};
    cabec.forEach((c, i) => { const m = mesDeCabecalho(c); if (m) colPorMes[m] = i + 1; });

    console.log(`${d.aba}   (linha ${d.linha}${d.projeto ? '' : ' · total consolidado'})`);

    for (const mes of MESES) {
      const col = colPorMes[mes];
      if (!col) { console.log(`   ${mes}  — coluna não encontrada nesta aba, ignorado`); continue; }

      const alvo = d.projeto === null
        ? R.cent(rateio[mes].alvo)
        : (rateio[mes].valores.find(v => v.projeto === d.projeto) || {}).valor;
      if (alvo === undefined) { console.log(`   ${mes}  — projeto sem rateio neste mês, ignorado`); continue; }

      const cel = `${colLetra(col)}${d.linha}`;
      const bruto = valores[col - 1];
      const antes = valorDeFormula(bruto);
      const origem = ehFormula(bruto) ? 'projeção' : 'valor';
      const muda = !d.somenteMarca && (antes === null || Math.abs(antes - alvo) > 0.005);

      console.log(`   ${mes}  ${cel.padEnd(5)} ${origem.padEnd(9)} ` +
        `${(antes === null ? String(bruto).slice(0, 22) : brl(antes)).padStart(22)} → ${brl(alvo).padStart(14)}` +
        `${d.somenteMarca ? '  (fórmula preservada)' : muda ? '  ←' : '  (igual)'}`);

      if (muda) updates.push({ range: `'${d.aba}'!${cel}`, values: [[alvo]] });

      const celMarca = `${colLetra(col)}${LINHA_MARCA}`;
      const marcaAtual = String(marca[col - 1] ?? '').trim();
      if (marcaAtual.toLowerCase() !== 'realizado') {
        console.log(`   ${mes}  ${celMarca.padEnd(5)} marca     ${marcaAtual.padStart(22)} → ${'realizado'.padStart(14)}  ←`);
        updates.push({ range: `'${d.aba}'!${celMarca}`, values: [['realizado']] });
      }
    }

    // Conferência: as colunas posteriores ao último mês alvo continuam em fórmula.
    const ultimo = R.mesKey(MESES[MESES.length - 1]);
    const futuras = Object.entries(colPorMes)
      .filter(([m]) => R.mesKey(m) > ultimo)
      .map(([m, c]) => ({ mes: m, col: c, formula: ehFormula(valores[c - 1]) }));
    const semFormula = futuras.filter(f => !f.formula);
    console.log(`   futuros: ${futuras.length} meses após ${MESES[MESES.length - 1]}, ` +
      `${futuras.length - semFormula.length} com fórmula` +
      (semFormula.length ? `, ${semFormula.length} SEM fórmula (${semFormula.map(f => f.mes).join(', ')})` : ' ✓'));
    formulasPreservadas.push({ aba: d.aba, total: futuras.length, comFormula: futuras.length - semFormula.length });
    console.log();
  }

  // ── 3. Guarda final: nenhuma célula fora do escopo ────────────────────────
  const colsAlvo = new Set(updates.map(u => u.range));
  if (colsAlvo.size !== updates.length) throw new Error('célula repetida na lista de gravação');
  for (const u of updates) {
    const lin = parseInt(u.range.match(/(\d+)$/)[1]);
    if (![LINHA_MARCA, 8, 12].includes(lin)) throw new Error('gravação fora das linhas permitidas: ' + u.range);
  }

  if (!GRAVAR) {
    console.log(`SIMULAÇÃO — ${updates.length} células seriam gravadas. Rode com --write para aplicar.`);
    updates.forEach(u => console.log('   ' + u.range.padEnd(42) + JSON.stringify(u.values[0][0])));
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID_ORC,
    requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
  });
  console.log(`✓ GRAVADO em ${ID_ORC}: ${updates.length} células.`);
  console.log(`  meses marcados como realizado: ${MESES.join(', ')}`);
  console.log(`  fórmulas dos meses seguintes preservadas: ` +
    formulasPreservadas.map(f => `${f.aba.split(' •')[0]} ${f.comFormula}/${f.total}`).join(' · '));
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
