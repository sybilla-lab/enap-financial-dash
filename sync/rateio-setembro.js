/**
 * Apura o rateio realizado de uma competência e confere o critério contra o
 * que já está gravado na planilha de Orçamento.
 *
 * Por que existe
 * -------------
 * As células de agosto contêm valores fixos: olhando para elas não dá para
 * saber como o rateio foi feito. Este script reproduz o cálculo e compara com
 * o gravado — se agosto fecha, o critério está comprovado, e aí o mesmo
 * critério pode ser aplicado a setembro com segurança.
 *
 * O critério é o da aba "Cálculo Rendimentos Proporcionais" da Base:
 * participação proporcional ao saldo acumulado de cada projeto na abertura do
 * mês, sobre o rendimento LÍQUIDO do mês, com carregamento dos meses sem base
 * positiva e resíduo de arredondamento no projeto de maior rendimento.
 *
 *   node sync/rateio-setembro.js            confere agosto e simula setembro
 *   node sync/rateio-setembro.js --write    grava setembro
 */
const { google } = require('googleapis');
const path = require('path');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_ORCAMENTO = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';

const COMPETENCIA_CONFERENCIA = '08/2026';
const COMPETENCIA_ALVO = '09/2026';

/**
 * Lançamentos acrescentados à Base DEPOIS de agosto ter sido gravado.
 *
 * São os impostos de 09/2025 e 11/2025, lançados na aba Principal como débito
 * da Operação Básica. Entraram na Base entre 20/09 e 21/09/2026 e mudam o saldo
 * base da Operação Básica desde 2025 — por isso agosto, recalculado hoje, não
 * reproduz o que está gravado.
 *
 * A conferência do critério os desconsidera, para comparar com a mesma base que
 * agosto teve. O cálculo de setembro NÃO os desconsidera: a Base de hoje é a
 * correta, e é sobre ela que a competência nova tem de ser apurada.
 */
const RETROATIVOS = [
  { projeto: 'Operação Básica', mesAno: '09/2025', valor: -2384.74 },
  { projeto: 'Operação Básica', mesAno: '11/2025', valor: -4306.80 },
];

/**
 * Transferências do Ofício nº 04/2026, com efeito na abertura de 08/2026.
 *
 * Entram como ajuste de saldo: reduzem a origem e aumentam o destino pelo
 * mesmo valor, sem alterar o total da parceria. É o que faz agosto fechar
 * exatamente com o que está gravado — sem elas, CAR DPG e MDIC seguiriam
 * rendendo sobre um saldo que já não têm.
 */
const TRANSFERENCIAS = [
  ['CAR DPG', -72847.81], ['Operação Básica', 72847.81],
  ['Co.NE', -26200.66], ['Operação Básica', 26200.66],
  ['Parceria MDIC', -13477.05], ['Operação Básica', 13477.05],
].map(([projeto, valor]) => ({ mesAno: '08/2026', projeto, valor }));

/** Onde cada projeto grava a competência, na planilha de Orçamento. */
const CELULAS = {
  '08/2026': {
    'Operação Básica': { aba: 'operação básica • ENAP', celula: 'J8' },
    'Co.NE': { aba: 'co.ne • BID', celula: 'J8' },
    'CAR DPG': { aba: 'car dpg • FBDS', celula: 'J8' },
    'Alimenta +1000 Cidades': { aba: 'alimenta +1.000 cidades • MDS', celula: 'J8' },
    'Parceria MDIC': { aba: 'parceria • MDIC', celula: 'D8' },
  },
  '09/2026': {
    'Operação Básica': { aba: 'operação básica • ENAP', celula: 'K8' },
    'Co.NE': { aba: 'co.ne • BID', celula: 'K8' },
    'CAR DPG': { aba: 'car dpg • FBDS', celula: 'K8' },
    'Alimenta +1000 Cidades': { aba: 'alimenta +1.000 cidades • MDS', celula: 'K8' },
    'Parceria MDIC': { aba: 'parceria • MDIC', celula: 'E8' },
  },
};

async function main() {
  const gravar = process.argv.includes('--write');
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets' + (gravar ? '' : '.readonly')],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const base = await R.carregar(sheets);

  const montar = lancamentos => {
    const ctx = R.contexto({ ...base, lancamentos, transferencias: TRANSFERENCIAS });
    return { ctx, hist: R.historicoPorProjeto(ctx) };
  };

  // Base de hoje, para setembro; base sem os retroativos, para conferir agosto.
  const atual = montar(base.lancamentos);
  const comoEmAgosto = montar(base.lancamentos.filter(l => !RETROATIVOS.some(r =>
    l.projeto === r.projeto && l.mesAno === r.mesAno && Math.abs(l.valor - r.valor) < 0.005)));

  const liquidoDe = (ctx, mesAno) => {
    const m = ctx.porMes.find(x => x.mesAno === mesAno);
    return m ? R.cent(m.liquido) : null;
  };

  const rateioDe = (mesAno, { ctx, hist }) => {
    const linhas = [];
    hist.porMes.forEach((serie, projeto) => {
      const v = serie.get(mesAno);
      if (v !== undefined && v > 0.005) linhas.push({ projeto, valor: R.cent(v) });
    });
    linhas.sort((a, b) => b.valor - a.valor);

    // Resíduo de arredondamento no projeto de maior rendimento — mesma regra do
    // dashboard e da planilha, para a soma fechar com o líquido do mês.
    const liquido = liquidoDe(ctx, mesAno);
    const soma = R.cent(linhas.reduce((s, l) => s + l.valor, 0));
    const residuo = R.cent(liquido - soma);
    if (residuo !== 0 && linhas.length) {
      linhas[0].valor = R.cent(linhas[0].valor + residuo);
      linhas[0].residuo = residuo;
    }
    return { linhas, liquido, residuo };
  };

  // ── 1. Conferência do critério contra agosto, já gravado ──────────────────
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID_ORCAMENTO });
  const lerCelula = async (aba, celula) => {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORCAMENTO, range: `'${aba}'!${celula}`, valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const v = (r.data.values || [[null]])[0][0];
    return typeof v === 'number' ? R.cent(v) : null;
  };

  console.log('='.repeat(78));
  console.log(`CONFERÊNCIA DO CRITÉRIO — ${COMPETENCIA_CONFERENCIA} (já gravado na planilha)`);
  console.log('='.repeat(78));
  const agosto = rateioDe(COMPETENCIA_CONFERENCIA, comoEmAgosto);
  let criterioBate = true;
  for (const l of agosto.linhas) {
    const alvo = CELULAS[COMPETENCIA_CONFERENCIA][l.projeto];
    if (!alvo) { console.log(`  ${l.projeto.padEnd(24)} sem célula mapeada`); continue; }
    const gravado = await lerCelula(alvo.aba, alvo.celula);
    const bate = gravado !== null && Math.abs(gravado - l.valor) < 0.015;
    if (!bate) criterioBate = false;
    console.log(`  ${l.projeto.padEnd(24)} calculado ${R.brl(l.valor).padStart(14)}` +
                `   gravado ${R.brl(gravado ?? 0).padStart(14)}   ${bate ? 'confere' : '<-- DIVERGE'}`);
  }
  console.log(`  ${'soma'.padEnd(24)} ${R.brl(agosto.liquido).padStart(14)}` +
              `   líquido do mês na Base`);
  console.log(`\n  critério ${criterioBate ? 'COMPROVADO' : 'NÃO comprovado — não gravar setembro'}`);

  // ── 2. Rateio da competência alvo ─────────────────────────────────────────
  console.log('\n' + '='.repeat(78));
  console.log(`RATEIO REALIZADO — ${COMPETENCIA_ALVO}${gravar ? '  [GRAVAÇÃO]' : '  [SIMULAÇÃO]'}`);
  console.log('='.repeat(78));
  const alvo = rateioDe(COMPETENCIA_ALVO, atual);
  if (alvo.liquido === null) {
    console.log(`  competência ${COMPETENCIA_ALVO} não encontrada na Base — nada a fazer`);
    return;
  }
  console.log(`  líquido do mês na Base: ${R.brl(alvo.liquido)}\n`);
  alvo.linhas.forEach(l => {
    const pct = (l.valor / alvo.liquido) * 100;
    const cel = CELULAS[COMPETENCIA_ALVO][l.projeto];
    console.log(`  ${l.projeto.padEnd(24)} ${R.brl(l.valor).padStart(14)}  ${pct.toFixed(4).padStart(8)}%` +
                `  ${cel ? `'${cel.aba}'!${cel.celula}` : 'SEM CÉLULA MAPEADA'}` +
                (l.residuo ? `   (resíduo ${R.brl(l.residuo)})` : ''));
  });
  const soma = R.cent(alvo.linhas.reduce((s, l) => s + l.valor, 0));
  console.log(`  ${'soma'.padEnd(24)} ${R.brl(soma).padStart(14)}  ${soma === alvo.liquido ? 'fecha com o líquido' : '<-- NÃO FECHA'}`);

  const semCelula = alvo.linhas.filter(l => !CELULAS[COMPETENCIA_ALVO][l.projeto]);
  if (semCelula.length) {
    console.log('\n  ATENÇÃO — projetos sem célula mapeada na planilha de Orçamento:');
    semCelula.forEach(l => console.log(`     ${l.projeto}  ${R.brl(l.valor)}`));
    console.log('  Gravar assim deixaria o consolidado menor que o líquido do mês.');
  }

  if (!gravar) {
    console.log('\n  SIMULAÇÃO — nada gravado. Rode com --write para aplicar.');
    return;
  }
  if (!criterioBate) {
    console.log('\n  GRAVAÇÃO ABORTADA: o critério não reproduz agosto.');
    process.exit(1);
  }
  if (semCelula.length) {
    console.log('\n  GRAVAÇÃO ABORTADA: há projeto sem célula mapeada.');
    process.exit(1);
  }

  for (const l of alvo.linhas) {
    const cel = CELULAS[COMPETENCIA_ALVO][l.projeto];
    await sheets.spreadsheets.values.update({
      spreadsheetId: ID_ORCAMENTO, range: `'${cel.aba}'!${cel.celula}`,
      valueInputOption: 'RAW', requestBody: { values: [[l.valor]] },
    });
    console.log(`  gravado  '${cel.aba}'!${cel.celula} = ${R.brl(l.valor)}`);
  }
  console.log('\n  Consolidado: fórmula preservada — soma as abas de origem.');
}

main().catch(e => { console.error('FALHA:', e.stack); process.exit(1); });
