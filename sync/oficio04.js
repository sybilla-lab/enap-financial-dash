/**
 * Ofício nº 04/2026 — destinação de rendimentos à Plataforma Desafios.
 *
 * Data-base 31/07/2026 · competência de efeito 08/2026.
 *
 * O que este script faz, em ordem:
 *   1. atualiza o rateio realizado de agosto/2026, que muda porque a
 *      realocação entra na abertura do mês e altera a base proporcional;
 *   2. reescreve a aba "Movimentações de Rendimentos" com o modelo de
 *      transferência (origem → destino), não mais só autorização/utilização;
 *   3. reconstrói o bloco da carteira em cada aba de projeto e no consolidado;
 *   4. acrescenta as transferências ao Saldo Final de Caixa, para que o
 *      roll-forward e as projeções partam dos saldos realocados.
 *
 * O que NÃO faz: tocar julho, tocar a aba Principal da Base, criar entrada de
 * R$ 150.002,11 no caixa da Operação Básica, ou alterar o consolidado.
 *
 *   node sync/oficio04.js            → simulação
 *   node sync/oficio04.js --write    → grava
 */
const { google } = require('googleapis');
const path = require('path');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_ORC = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
const GRAVAR = process.argv.includes('--write');

const ABA_MOV = 'Movimentações de Rendimentos';
const OB = 'Operação Básica';
const COMP_EFEITO = '08/2026';
const DATA_BASE = '31/07/2026';
const DATA_EFETIVA = '01/08/2026';

const TIPO = {
  TRANSF: 'transferência interna de rendimentos',
  PROPRIA: 'destinação própria',
  USO: 'utilização da carteira',
  ESTORNO: 'estorno ou cancelamento',
};

// aba · projeto · linha de rendimentos · linha do acumulado · linha do Saldo Final
const ABAS = [
  { aba: 'operação básica • ENAP',        projeto: OB,                       acum: 34, saldoFinal: 32 },
  { aba: 'co.ne • BID',                   projeto: 'Co.NE',                  acum: 32, saldoFinal: 30 },
  { aba: 'parceria • MDIC',               projeto: 'Parceria MDIC',          acum: 31, saldoFinal: 29 },
  { aba: 'alimenta +1.000 cidades • MDS', projeto: 'Alimenta +1000 Cidades', acum: 38, saldoFinal: 36 },
  { aba: 'car dpg • FBDS',                projeto: 'CAR DPG',                acum: 34, saldoFinal: 32 },
];
const CONS = { aba: 'consolidado • 2026 a 2028', acum: 31 };

// Rateio de agosto recalculado com a realocação na abertura do mês.
const AGOSTO = {
  [OB]: 4497.31, 'Co.NE': 2435.33, 'Parceria MDIC': 12932.70,
  'CAR DPG': 6030.01, 'Alimenta +1000 Cidades': 38814.68,
};
const AGOSTO_TOTAL = 64710.03;
const JULHO = {
  [OB]: 4026.54, 'Co.NE': 3463.54, 'Parceria MDIC': 13477.05,
  'CAR DPG': 7899.10, 'Alimenta +1000 Cidades': 41513.82,
};

const TRANSFERENCIAS = [
  { origem: 'CAR DPG',       valor: 72847.81 },
  { origem: 'Co.NE',         valor: 26200.66 },
  { origem: 'Parceria MDIC', valor: 13477.05 },
];
const PROPRIA = { projeto: OB, valor: 37476.59 };
const UTILIZACAO = {
  data: '11/09/2026', competencia: '2026-09', valor: 21600.00, numeroPagamento: '10647074',
  categoria: '3.1.1 Serviço de Plataforma', fornecedor: 'GSGUMIER INFORMATICA LTDA', projeto: OB,
};
const DOC = 'Ofício nº 04/2026';
const FINALIDADE = 'atualização da Plataforma Desafios';
const ID_BASE_MOV = 'OFICIO_04_2026_PLATAFORMA_DESAFIOS';

const TOTAL_TRANSF = 112525.52, TOTAL_CARTEIRA = 150002.11, DISPONIVEL = 128402.11;
const LIVRE_TOTAL = 452166.67, GERADO_TOTAL = 602168.78;

const COLS = ['id_movimentacao', 'data_base', 'data_efetiva', 'competencia', 'tipo', 'documento',
  'projeto_origem', 'projeto_destino', 'valor', 'valor_com_sinal', 'numero_pagamento',
  'categoria', 'fornecedor', 'destinacao', 'observacao', 'status', 'atualizado_em',
  'competencia_data'];
const C = {}; COLS.forEach((c, i) => { C[c] = String.fromCharCode(65 + i); });
const COLS_TECNICAS = [0, 9, 16, 17];   // id · valor_com_sinal · atualizado_em · competencia_data

const brl = R.brl;
const q = s => `'${s}'`;
const letra = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };
const chave = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
const dia1 = comp => `01/${comp.slice(5, 7)}/${comp.slice(0, 4)}`;

/** SUMIFS na aba de movimentações. `acumulado` = até a coluna; senão só o mês. */
function soma({ tipo, origem, destino, acumulado, col, excluirMesmoProjeto }) {
  const m = q(ABA_MOV);
  const p = [`${m}!$${C.valor}:$${C.valor}`, `${m}!$${C.tipo}:$${C.tipo}; "${tipo}"`];
  if (origem) p.push(`${m}!$${C.projeto_origem}:$${C.projeto_origem}; "${origem}"`);
  if (destino) p.push(`${m}!$${C.projeto_destino}:$${C.projeto_destino}; "${destino}"`);
  if (excluirMesmoProjeto) p.push(`${m}!$${C.projeto_origem}:$${C.projeto_origem}; "<>"&"${excluirMesmoProjeto}"`);
  p.push(`${m}!$${C.status}:$${C.status}; "vigente"`);
  p.push(`${m}!$${C.competencia_data}:$${C.competencia_data}; "${acumulado ? '<=' : '='}"&${col}$5`);
  return `SUMIFS(${p.join('; ')})`;
}

async function main() {
  console.log(`OFÍCIO Nº 04/2026 — data-base ${DATA_BASE} · efeito em ${COMP_EFEITO}`);
  console.log(`DESTINO ${ID_ORC}${GRAVAR ? '   [GRAVAÇÃO]' : '   [SIMULAÇÃO]'}\n`);

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY,
    scopes: [GRAVAR ? 'https://www.googleapis.com/auth/spreadsheets'
                    : 'https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const falhas = [];
  const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

  // ── Testes de coerência dos números do Ofício ────────────────────────────
  console.log('COERÊNCIA DOS VALORES');
  console.log('='.repeat(94));
  ok(R.cent(TRANSFERENCIAS.reduce((s, t) => s + t.valor, 0)) === TOTAL_TRANSF,
    `transferências interprojetos = ${brl(TOTAL_TRANSF)}`);
  ok(R.cent(TOTAL_TRANSF + PROPRIA.valor) === TOTAL_CARTEIRA,
    `carteira = ${brl(TOTAL_TRANSF)} + ${brl(PROPRIA.valor)} próprios = ${brl(TOTAL_CARTEIRA)}`);
  ok(R.cent(TOTAL_CARTEIRA - UTILIZACAO.valor) === DISPONIVEL, `disponível = ${brl(DISPONIVEL)}`);
  ok(R.cent(Object.values(AGOSTO).reduce((s, v) => s + v, 0)) === AGOSTO_TOTAL,
    `rateio de agosto fecha em ${brl(AGOSTO_TOTAL)}`);
  const livre = {};
  for (const [p, v] of Object.entries(AGOSTO)) {
    const destinado = p === OB ? PROPRIA.valor : (TRANSFERENCIAS.find(t => t.origem === p) || {}).valor || 0;
    const ate07 = { [OB]: 37476.59, 'Co.NE': 26200.66, 'Parceria MDIC': 13477.05,
                    'CAR DPG': 72847.81, 'Alimenta +1000 Cidades': 387456.64 }[p];
    livre[p] = R.cent(ate07 + v - destinado);
  }
  ok(R.cent(Object.values(livre).reduce((s, v) => s + v, 0)) === LIVRE_TOTAL,
    `rendimento livre pós-Ofício = ${brl(LIVRE_TOTAL)}`);
  ok(R.cent(LIVRE_TOTAL + TOTAL_CARTEIRA) === GERADO_TOTAL,
    `livre + carteira = ${brl(GERADO_TOTAL)} = total gerado até agosto`);
  Object.entries(livre).forEach(([p, v]) => console.log(`     ${p.padEnd(24)} livre ${brl(v).padStart(15)}`));

  if (falhas.length) { console.error('\n✗ valores incoerentes — nada gravado.'); process.exit(1); }

  // ── Layout das abas ─────────────────────────────────────────────────────
  const layout = {};
  for (const d of [...ABAS, CONS]) {
    const [cab, rot] = (await sheets.spreadsheets.values.batchGet({
      spreadsheetId: ID_ORC,
      ranges: [`${q(d.aba)}!A5:BA5`, `${q(d.aba)}!B${d.acum}`],
      valueRenderOption: 'FORMATTED_VALUE',
    })).data.valueRanges.map(v => (v.values || [[]])[0] || []);
    const colPorMes = {};
    cab.forEach((c, i) => {
      const s = String(c || '').toLowerCase().replace(/\./g, '').trim();
      const mm = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2})$/);
      if (mm) { const M = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
        colPorMes[`${String(M[mm[1]]).padStart(2, '0')}/20${mm[2]}`] = i + 1; }
    });
    if (!/saldo acumulado de rendimentos/i.test(String(rot[0] || '')))
      throw new Error(`${d.aba} L${d.acum}: rótulo inesperado "${rot[0]}"`);
    layout[d.aba] = { colPorMes };
  }

  // ── 1. Rateio de agosto ─────────────────────────────────────────────────
  console.log('\n1. RATEIO DE AGOSTO/2026 — realocação na abertura do mês');
  console.log('='.repeat(94));
  const updAgosto = [];
  for (const d of ABAS) {
    const col = layout[d.aba].colPorMes[COMP_EFEITO];
    if (!col) throw new Error(`${d.aba} não tem coluna ${COMP_EFEITO}`);
    const cel = `${letra(col)}8`;
    const atual = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `${q(d.aba)}!${cel}`, valueRenderOption: 'UNFORMATTED_VALUE',
    })).data.values || [[0]])[0][0];
    const alvo = AGOSTO[d.projeto];
    console.log(`  ${d.projeto.padEnd(24)} ${cel.padEnd(5)} ${brl(R.cent(Number(atual) || 0)).padStart(14)} → ${brl(alvo).padStart(14)}`);
    updAgosto.push({ range: `${q(d.aba)}!${cel}`, values: [[alvo]] });
  }

  // ── 2. Aba de movimentações ─────────────────────────────────────────────
  const agora = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const linhas = [];
  const obsTransf = `Transferência interna de rendimentos por força do ${DOC}. Saldo acumulado ` +
    `até ${DATA_BASE} destinado à ${FINALIDADE}, sob execução da ${OB}. Não é receita nem despesa: ` +
    `entra no roll-forward como transferência e soma zero no consolidado.`;
  TRANSFERENCIAS.forEach(t => linhas.push([
    `${ID_BASE_MOV}|TRANSF|${chave(t.origem)}`, DATA_BASE, DATA_EFETIVA, "'2026-08", TIPO.TRANSF, DOC,
    t.origem, OB, t.valor, t.valor, '', '', '', FINALIDADE, obsTransf, 'vigente', agora, dia1('2026-08'),
  ]));
  linhas.push([
    `${ID_BASE_MOV}|PROPRIA|${chave(OB)}`, DATA_BASE, DATA_EFETIVA, "'2026-08", TIPO.PROPRIA, DOC,
    OB, OB, PROPRIA.valor, PROPRIA.valor, '', '', '', FINALIDADE,
    `Destinação própria: o saldo já pertencia à ${OB}. Muda de livre para destinado, ` +
    `sem transferência de caixa e sem entrada nova. Não somar aos ${brl(TOTAL_TRANSF)} recebidos.`,
    'vigente', agora, dia1('2026-08'),
  ]);
  linhas.push([
    `${ID_BASE_MOV}|USO|${UTILIZACAO.numeroPagamento}`, UTILIZACAO.data, UTILIZACAO.data,
    "'" + UTILIZACAO.competencia, TIPO.USO, DOC, OB, OB, UTILIZACAO.valor, -UTILIZACAO.valor,
    UTILIZACAO.numeroPagamento, UTILIZACAO.categoria, UTILIZACAO.fornecedor, FINALIDADE,
    `Pagamento ${UTILIZACAO.numeroPagamento} já lançado como débito na aba Principal da Base ` +
    `(competência ${UTILIZACAO.competencia}). Aqui só o vínculo com a carteira — não lançar de novo. ` +
    `O vínculo é explícito pelo número do pagamento: nenhum outro débito da ${OB} com recurso ` +
    `"Rendimentos" consome a carteira sem uma linha própria aqui.`,
    'vigente', agora, dia1(UTILIZACAO.competencia),
  ]);

  console.log('\n2. ABA DE MOVIMENTAÇÕES');
  console.log('='.repeat(94));
  console.log('  tipo                               origem → destino                       valor      comp.');
  linhas.forEach(l => console.log(
    `  ${l[4].padEnd(34)} ${(l[6] + ' → ' + l[7]).padEnd(36)} ${brl(l[8]).padStart(13)}  ${l[3]}`));

  // ── 3. Blocos da carteira ───────────────────────────────────────────────
  const rotulos = [], formulas = [];
  const ROT = [
    'Transferências de rendimentos cedidas no mês',
    'Transferências de rendimentos recebidas no mês',
    '(−) Transferências cedidas acumuladas',
    '(−) Destinação própria à carteira',
    '(=) Rendimento livre de rendimentos',
    'Carteira destinada à Plataforma Desafios',
    '(−) Utilizado da carteira',
    '(=) Carteira disponível',
  ];

  for (const d of ABAS) {
    const a = layout[d.aba].acum = ABAS.find(x => x.aba === d.aba).acum;
    ROT.forEach((r, i) => rotulos.push({ range: `${q(d.aba)}!B${a + 1 + i}`, values: [[r + '   (memorando)']] }));
    for (const [, col] of Object.entries(layout[d.aba].colPorMes)) {
      const c = letra(col);
      formulas.push(
        { range: `${q(d.aba)}!${c}${a + 1}`, values: [[`=-${soma({ tipo: TIPO.TRANSF, origem: d.projeto, col: c })}`]] },
        { range: `${q(d.aba)}!${c}${a + 2}`, values: [[`=${soma({ tipo: TIPO.TRANSF, destino: d.projeto, excluirMesmoProjeto: d.projeto, col: c })}`]] },
        { range: `${q(d.aba)}!${c}${a + 3}`, values: [[`=-${soma({ tipo: TIPO.TRANSF, origem: d.projeto, acumulado: true, col: c })}`]] },
        { range: `${q(d.aba)}!${c}${a + 4}`, values: [[`=-${soma({ tipo: TIPO.PROPRIA, origem: d.projeto, acumulado: true, col: c })}`]] },
        { range: `${q(d.aba)}!${c}${a + 5}`, values: [[`=${c}${a}+${c}${a + 3}+${c}${a + 4}`]] },
        { range: `${q(d.aba)}!${c}${a + 6}`, values: [[`=${soma({ tipo: TIPO.TRANSF, destino: d.projeto, excluirMesmoProjeto: d.projeto, acumulado: true, col: c })}+${soma({ tipo: TIPO.PROPRIA, origem: d.projeto, acumulado: true, col: c })}`]] },
        { range: `${q(d.aba)}!${c}${a + 7}`, values: [[`=-${soma({ tipo: TIPO.USO, origem: d.projeto, acumulado: true, col: c })}`]] },
        { range: `${q(d.aba)}!${c}${a + 8}`, values: [[`=${c}${a + 6}+${c}${a + 7}`]] },
      );
    }
  }

  const ca = CONS.acum;
  [...ROT, 'Conferência — livre + carteira = gerado (zero)',
           'Conferência — transferências somam zero (zero)'].forEach((r, i) =>
    rotulos.push({ range: `${q(CONS.aba)}!B${ca + 1 + i}`, values: [[r + (i < 8 ? '   (memorando)' : '')]] }));
  for (const [, col] of Object.entries(layout[CONS.aba].colPorMes)) {
    const c = letra(col);
    formulas.push(
      { range: `${q(CONS.aba)}!${c}${ca + 1}`, values: [[`=-${soma({ tipo: TIPO.TRANSF, col: c })}`]] },
      { range: `${q(CONS.aba)}!${c}${ca + 2}`, values: [[`=${soma({ tipo: TIPO.TRANSF, col: c })}`]] },
      { range: `${q(CONS.aba)}!${c}${ca + 3}`, values: [[`=-${soma({ tipo: TIPO.TRANSF, acumulado: true, col: c })}`]] },
      { range: `${q(CONS.aba)}!${c}${ca + 4}`, values: [[`=-${soma({ tipo: TIPO.PROPRIA, acumulado: true, col: c })}`]] },
      { range: `${q(CONS.aba)}!${c}${ca + 5}`, values: [[`=${c}${ca}+${c}${ca + 3}+${c}${ca + 4}`]] },
      { range: `${q(CONS.aba)}!${c}${ca + 6}`, values: [[`=${soma({ tipo: TIPO.TRANSF, acumulado: true, col: c })}+${soma({ tipo: TIPO.PROPRIA, acumulado: true, col: c })}`]] },
      { range: `${q(CONS.aba)}!${c}${ca + 7}`, values: [[`=-${soma({ tipo: TIPO.USO, acumulado: true, col: c })}`]] },
      { range: `${q(CONS.aba)}!${c}${ca + 8}`, values: [[`=${c}${ca + 6}+${c}${ca + 7}`]] },
      { range: `${q(CONS.aba)}!${c}${ca + 9}`, values: [[`=${c}${ca}-(${c}${ca + 5}+${c}${ca + 6})`]] },
      { range: `${q(CONS.aba)}!${c}${ca + 10}`, values: [[`=${c}${ca + 1}+${c}${ca + 2}`]] },
    );
  }
  console.log(`\n3. BLOCOS DA CARTEIRA — 8 linhas por aba de projeto, 10 no consolidado`);
  console.log('='.repeat(94));
  ABAS.forEach(d => console.log(`  ${d.aba.padEnd(32)} linhas ${d.acum + 1}–${d.acum + 8}`));
  console.log(`  ${CONS.aba.padEnd(32)} linhas ${ca + 1}–${ca + 10}`);

  // ── 4. Roll-forward: transferências no Saldo Final ──────────────────────
  console.log('\n4. ROLL-FORWARD — transferências entram no Saldo Final de Caixa');
  console.log('='.repeat(94));
  const updSaldo = [];
  for (const d of ABAS) {
    const a = d.acum;
    const atual = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `${q(d.aba)}!A${d.saldoFinal}:BA${d.saldoFinal}`,
      valueRenderOption: 'FORMULA',
    })).data.values || [[]])[0] || [];
    let n = 0, exemplo = '';
    for (const [, col] of Object.entries(layout[d.aba].colPorMes)) {
      const c = letra(col);
      const f = String(atual[col - 1] ?? '').trim();
      if (!f.startsWith('=')) continue;
      if (f.includes(`${c}${a + 1}`)) continue;            // já ajustada
      const nova = `${f}+${c}${a + 1}+${c}${a + 2}`;
      if (!n) exemplo = `${c}${d.saldoFinal}:  ${f}  →  ${nova}`;
      updSaldo.push({ range: `${q(d.aba)}!${c}${d.saldoFinal}`, values: [[nova]] });
      n++;
    }
    console.log(`  ${d.aba.padEnd(32)} linha ${d.saldoFinal}, ${n} colunas`);
    if (exemplo) console.log(`     ${exemplo}`);
  }

  const total = updAgosto.length + rotulos.length + formulas.length + updSaldo.length;
  console.log(`\nTOTAL: ${updAgosto.length} rateio + ${rotulos.length} rótulos + ${formulas.length} fórmulas + ${updSaldo.length} saldo final = ${total} células`);

  if (!GRAVAR) {
    console.log('\nSIMULAÇÃO — nada gravado. Exemplo de fórmula da carteira:');
    console.log('  ' + formulas[5].range + '\n     ' + formulas[5].values[0][0].slice(0, 200));
    console.log('\nRode com --write para aplicar.');
    return;
  }

  // ── Gravação ────────────────────────────────────────────────────────────
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID_ORC, fields: 'sheets.properties(sheetId,title)' });
  const shMov = meta.data.sheets.find(s => s.properties.title === ABA_MOV);
  let gid = shMov ? shMov.properties.sheetId : null;
  if (gid === null) {
    gid = (await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID_ORC, requestBody: { requests: [{
      addSheet: { properties: { title: ABA_MOV, gridProperties: { rowCount: 500, columnCount: COLS.length, frozenRowCount: 1 } } } }] },
    })).data.replies[0].addSheet.properties.sheetId;
  } else {
    // Limpa o conteúdo antigo (modelo anterior tinha outra estrutura de colunas).
    await sheets.spreadsheets.values.clear({ spreadsheetId: ID_ORC, range: `${q(ABA_MOV)}!A1:Z500` });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID_ORC,
    requestBody: { valueInputOption: 'USER_ENTERED', data: [
      { range: `${q(ABA_MOV)}!A1`, values: [COLS] },
      { range: `${q(ABA_MOV)}!A2`, values: linhas },
      ...updAgosto, ...rotulos, ...formulas, ...updSaldo,
    ] },
  });
  console.log(`\n✓ ${total + linhas.length + 1} células gravadas`);

  // Formatação, validação e proteção
  const req = [];
  req.push({ repeatCell: { range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1 },
    cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: .94, green: .95, blue: .97 } } },
    fields: 'userEnteredFormat(textFormat,backgroundColor)' } });
  req.push({ repeatCell: { range: { sheetId: gid, startRowIndex: 1, startColumnIndex: 17, endColumnIndex: 18 },
    cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } },
    fields: 'userEnteredFormat.numberFormat' } });
  for (const ci of [8, 9]) req.push({ repeatCell: { range: { sheetId: gid, startRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 },
    cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: 'R$ #,##0.00' } } },
    fields: 'userEnteredFormat.numberFormat' } });

  const lista = (ci, vals) => ({ setDataValidation: {
    range: { sheetId: gid, startRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 },
    rule: { condition: { type: 'ONE_OF_LIST', values: vals.map(v => ({ userEnteredValue: v })) },
            showCustomUi: true, strict: true, inputMessage: 'Campo controlado — escolha da lista.' } } });
  const projetos = [...ABAS.map(d => d.projeto)];
  req.push(lista(4, Object.values(TIPO)));
  req.push(lista(15, ['vigente', 'cancelada']));
  req.push(lista(6, projetos));
  req.push(lista(7, projetos));

  const jaProt = new Set();
  meta.data.sheets.forEach(s => (s.protectedRanges || []).forEach(p => jaProt.add(s.properties.title + '|' + (p.description || ''))));
  for (const ci of COLS_TECNICAS) {
    const desc = `Coluna técnica (${COLS[ci]}) — derivada, não editar à mão`;
    if (jaProt.has(`${ABA_MOV}|${desc}`)) continue;
    req.push({ addProtectedRange: { protectedRange: { range: { sheetId: gid, startColumnIndex: ci, endColumnIndex: ci + 1 },
      description: desc, warningOnly: true } } });
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID_ORC, requestBody: { requests: req } });
  console.log('✓ formatação, 4 validações de lista e proteções aplicadas');
  console.log('\nRode:  node sync/conferir-oficio04.js');
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
