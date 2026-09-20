/**
 * Carteira autorizada do Ofício nº 04/2026 — aba de movimentações + blocos.
 *
 * Cria a aba "Movimentações de Rendimentos" como LIVRO MEMORANDO e acrescenta,
 * em cada aba de projeto e no consolidado, o bloco que classifica o rendimento
 * já existente entre livre e autorizado.
 *
 * A garantia estrutural é esta: nenhuma fórmula de ENTRADAS, SAÍDAS, Resultado,
 * Saldo Inicial ou Saldo Final referencia a aba de movimentações. A carteira
 * classifica rendimento que já está no caixa; ela não move dinheiro. O teste de
 * não-contaminação confere isso relendo a planilha depois de gravar.
 *
 * Tudo é acréscimo: nenhuma célula existente é alterada.
 *
 * Uso:
 *   node sync/movimentacoes.js            → simulação (padrão), não grava
 *   node sync/movimentacoes.js --write    → grava
 */
const { google } = require('googleapis');
const path = require('path');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_ORC = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
const ID_PROIBIDO = '1fd5ou9MV5tHArxuQnKIn-B6pypxa6Bsn';
const GRAVAR = process.argv.includes('--write');

const ABA_MOV = 'Movimentações de Rendimentos';
const TIPO_AUT = 'autorização';
const TIPO_USO = 'utilização da autorização';
const STATUS = ['vigente', 'cancelada'];

const PROJETOS = ['Operação Básica', 'Co.NE', 'Parceria MDIC', 'Alimenta +1000 Cidades', 'CAR DPG'];

// aba → projeto · linha do saldo acumulado de rendimentos (o bloco vem logo abaixo)
const ABAS = [
  { aba: 'operação básica • ENAP',        projeto: 'Operação Básica',        acum: 34 },
  { aba: 'co.ne • BID',                   projeto: 'Co.NE',                  acum: 32 },
  { aba: 'parceria • MDIC',               projeto: 'Parceria MDIC',          acum: 31 },
  { aba: 'alimenta +1.000 cidades • MDS', projeto: 'Alimenta +1000 Cidades', acum: 38 },
  { aba: 'car dpg • FBDS',                projeto: 'CAR DPG',                acum: 34 },
];
const CONSOLIDADO = { aba: 'consolidado • 2026 a 2028', acum: 31 };

// Linhas de caixa que NÃO podem referenciar a aba de movimentações.
// Confirmadas por leitura dos rótulos, não inferidas de fórmula:
// Rendimentos · TOTAL entradas · TOTAL saídas · Resultado · Saldo Inicial · Saldo Final.
const LINHAS_CAIXA = {
  'operação básica • ENAP':        [8, 9, 27, 30, 31, 32],
  'co.ne • BID':                   [8, 9, 25, 28, 29, 30],
  'parceria • MDIC':               [8, 9, 24, 27, 28, 29],
  'alimenta +1.000 cidades • MDS': [8, 9, 31, 34, 35, 36],
  'car dpg • FBDS':                [8, 9, 27, 30, 31, 32],
  'consolidado • 2026 a 2028':     [12, 13, 24, 27, 28, 29],
};

const OFICIO = {
  id: 'OFICIO_04_2026_PLATAFORMA_DESAFIOS',
  documento: 'Ofício nº 04/2026',
  destinacao: 'atualização evolutiva da Plataforma Desafios',
  competencia: '2026-07',
  dataAut: '31/07/2026',
  autorizacoes: [
    { projeto: 'Operação Básica', valor: 37476.59 },
    { projeto: 'Co.NE',           valor: 26200.66 },
    { projeto: 'CAR DPG',         valor: 72847.81 },
    { projeto: 'Parceria MDIC',   valor: 13477.05 },
  ],
  utilizacoes: [
    { data: '11/09/2026', competencia: '2026-09', valor: 21600.00,
      numeroPagamento: '10647074', categoria: '3.1.1 Serviço de Plataforma',
      fornecedor: 'GSGUMIER INFORMATICA LTDA', projetoOrigem: 'Operação Básica' },
  ],
};
const TOTAL_AUT = 150002.11, TOTAL_USO = 21600.00;

const COLS_MOV = ['id_movimentacao', 'data', 'competencia', 'tipo', 'documento',
  'projeto_origem', 'valor', 'numero_pagamento', 'categoria', 'fornecedor',
  'destinacao', 'observacao', 'atualizado_em', 'valor_com_sinal', 'status',
  'competencia_data'];
// Colunas derivadas/técnicas, protegidas contra edição acidental.
const COLS_TECNICAS = [0, 12, 13, 15];   // A id · M atualizado_em · N valor_com_sinal · P competencia_data

const brl = R.brl;
const colLetra = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };
const q = s => `'${s}'`;
const primeiroDia = comp => `01/${comp.slice(5, 7)}/${comp.slice(0, 4)}`;

/** SUMIFS acumulado até a coluna do mês, na aba de movimentações. */
function somaMov(tipo, projeto, colMes) {
  const m = q(ABA_MOV);
  const partes = [
    `${m}!$G:$G`,
    `${m}!$D:$D; "${tipo}"`,
    projeto ? `${m}!$F:$F; "${projeto}"` : null,
    `${m}!$O:$O; "vigente"`,
    `${m}!$P:$P; "<="&${colMes}$5`,
  ].filter(Boolean);
  return `=-SUMIFS(${partes.join('; ')})`;
}

async function main() {
  if (ID_ORC === ID_PROIBIDO) throw new Error('destino aponta para o arquivo proibido');
  console.log('DESTINO   ' + ID_ORC + (GRAVAR ? '   [GRAVAÇÃO]' : '   [SIMULAÇÃO]'));
  console.log();

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY,
    scopes: [GRAVAR ? 'https://www.googleapis.com/auth/spreadsheets'
                    : 'https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const falhas = [];
  const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) falhas.push(msg); };

  // ── 1. Testes que precedem qualquer escrita ──────────────────────────────
  console.log('TESTES PRÉVIOS');
  console.log('='.repeat(92));

  const somaAut = R.cent(OFICIO.autorizacoes.reduce((s, a) => s + a.valor, 0));
  const somaUso = R.cent(OFICIO.utilizacoes.reduce((s, u) => s + u.valor, 0));
  ok(somaAut === TOTAL_AUT, `soma das autorizações = ${brl(somaAut)}`);
  ok(somaUso === TOTAL_USO, `soma das utilizações  = ${brl(somaUso)}`);

  // Autorização de cada projeto = acumulado dele em 31/07/2026 pelo método B
  const ctx = R.contexto(await R.carregar(sheets));
  const hist = R.historicoPorProjeto(ctx);
  const acum0726 = {};
  ctx.porMes
    .filter(m => (ctx.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado')
    .filter(m => R.mesKey(m.mesAno) <= R.mesKey('07/2026'))
    .forEach(m => {
      const f = R.fechar(R.rateioHistorico(hist, m.mesAno, m.liquido));
      f.valores.forEach(v => { acum0726[v.projeto] = R.cent((acum0726[v.projeto] ?? 0) + v.valor); });
    });
  for (const a of OFICIO.autorizacoes) {
    ok(R.cent(acum0726[a.projeto] ?? 0) === a.valor,
      `autorização ${a.projeto.padEnd(24)} ${brl(a.valor).padStart(14)} = acumulado 31/07/2026 pelo método B`);
  }

  // Teto por projeto: utilização acumulada ≤ autorização
  const autPorProj = {}; OFICIO.autorizacoes.forEach(a => { autPorProj[a.projeto] = a.valor; });
  const usoPorProj = {};
  OFICIO.utilizacoes.forEach(u => { usoPorProj[u.projetoOrigem] = R.cent((usoPorProj[u.projetoOrigem] ?? 0) + u.valor); });
  for (const [p, usado] of Object.entries(usoPorProj)) {
    const cota = autPorProj[p] ?? 0;
    ok(usado <= cota + 0.005,
      `teto ${p.padEnd(24)} utilizado ${brl(usado)} ≤ cota ${brl(cota)}  (resta ${brl(R.cent(cota - usado))})`);
  }
  for (const u of OFICIO.utilizacoes) {
    ok(autPorProj[u.projetoOrigem] !== undefined,
      `projeto_origem "${u.projetoOrigem}" tem autorização registrada`);
  }

  // Rastreio reverso: a utilização existe na Base com mesmo valor, projeto e competência
  const princ = (await sheets.spreadsheets.values.get({
    spreadsheetId: R.ID_BASE, range: `'${R.ABAS.principal}'!A1:M3000`, valueRenderOption: 'FORMATTED_VALUE',
  })).data.values || [];
  for (const u of OFICIO.utilizacoes) {
    const achou = princ.find(r => String(r[3] || '').trim() === u.numeroPagamento);
    const valorBase = achou ? Math.abs(R.cent(parseFloat(String(achou[12] || achou[4] || '0')
      .replace(/[()R$\s]/g, '').replace(/\./g, '').replace(',', '.')))) : null;
    const compBase = achou ? String(achou[11] || '').trim() : '';
    const projBase = achou ? String(achou[10] || '').trim() : '';
    ok(!!achou, `pagamento ${u.numeroPagamento} existe na Base (aba ${R.ABAS.principal})`);
    ok(valorBase === u.valor, `  valor na Base ${brl(valorBase ?? 0)} = ${brl(u.valor)}`);
    ok(projBase === u.projetoOrigem, `  projeto na Base "${projBase}" = "${u.projetoOrigem}"`);
    ok(compBase === `${u.competencia.slice(5)}/${u.competencia.slice(0, 4)}`,
      `  competência na Base ${compBase} = ${u.competencia}`);
  }

  if (falhas.length) {
    console.error(`\n✗ ${falhas.length} teste(s) falharam — nada será gravado.`);
    process.exit(1);
  }

  // ── 2. Linhas da aba de movimentações ────────────────────────────────────
  const agora = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const linhasMov = [];
  const chave = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');

  for (const a of OFICIO.autorizacoes) {
    linhasMov.push([
      `${OFICIO.id}|AUT|${chave(a.projeto)}`, OFICIO.dataAut, OFICIO.competencia, TIPO_AUT,
      OFICIO.documento, a.projeto, a.valor, '', '', '', OFICIO.destinacao,
      'Autorização não é saída financeira: reclassifica rendimento já realizado ' +
      'de saldo livre para carteira autorizada. Ofício nº 04/2026.',
      agora, a.valor, 'vigente', primeiroDia(OFICIO.competencia),
    ]);
  }
  for (const u of OFICIO.utilizacoes) {
    linhasMov.push([
      `${OFICIO.id}|USO|${u.numeroPagamento}`, u.data, u.competencia, TIPO_USO,
      OFICIO.documento, u.projetoOrigem, u.valor, u.numeroPagamento, u.categoria, u.fornecedor,
      OFICIO.destinacao,
      `Pagamento ${u.numeroPagamento} já lançado como saída na Base (aba Principal, ` +
      `competência ${u.competencia}). Aqui só o vínculo com a autorização do Ofício nº 04/2026 — ` +
      'não lançar de novo no fluxo de caixa.',
      agora, -u.valor, 'vigente', primeiroDia(u.competencia),
    ]);
  }

  console.log(`\nABA "${ABA_MOV}"  ·  ${COLS_MOV.length} colunas, ${linhasMov.length} linhas`);
  console.log('='.repeat(92));
  linhasMov.forEach(l => console.log(
    `  ${String(l[0]).slice(-28).padEnd(30)} ${l[3].padEnd(26)} ${l[5].padEnd(24)} ${brl(l[6]).padStart(14)}  ${l[2]}`));

  // ── 3. Blocos da carteira ────────────────────────────────────────────────
  const layout = {};
  for (const d of [...ABAS, CONSOLIDADO]) {
    const cab = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `${q(d.aba)}!A5:BA5`, valueRenderOption: 'FORMATTED_VALUE',
    })).data.values || [[]])[0] || [];
    const colPorMes = {}; const mesPorCol = {};
    cab.forEach((c, i) => {
      const s = String(c || '').toLowerCase().replace(/\./g, '').trim();
      const mm = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2})$/);
      if (mm) {
        const M = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
        const k = `${String(M[mm[1]]).padStart(2, '0')}/20${mm[2]}`;
        colPorMes[k] = i + 1; mesPorCol[i + 1] = k;
      }
    });
    // Confere que a linha de acumulado é mesmo a esperada
    const rot = ((await sheets.spreadsheets.values.get({
      spreadsheetId: ID_ORC, range: `${q(d.aba)}!B${d.acum}`, valueRenderOption: 'FORMATTED_VALUE',
    })).data.values || [['']])[0][0] || '';
    if (!/saldo acumulado de rendimentos/i.test(String(rot)))
      throw new Error(`${d.aba} linha ${d.acum}: esperava "Saldo acumulado de rendimentos", achei "${rot}"`);
    layout[d.aba] = { colPorMes, mesPorCol, acum: d.acum };
  }

  // Meses em que a conferência "soma das 5 abas" faz sentido: todas as abas de
  // projeto precisam ter a coluna. MDIC antes de jul/26 não existe e vale zero.
  const mesesComuns = Object.keys(layout[CONSOLIDADO.aba].colPorMes).filter(m =>
    ABAS.every(d => layout[d.aba].colPorMes[m] || (d.projeto === 'Parceria MDIC' && R.mesKey(m) < R.mesKey('07/2026'))));

  const updates = [];
  const rotulos = [];

  for (const d of ABAS) {
    const L = layout[d.aba], a = d.acum;
    rotulos.push(
      { range: `${q(d.aba)}!B${a + 1}`, values: [[`(−) Total autorizado · ${OFICIO.documento}   (memorando)`]] },
      { range: `${q(d.aba)}!B${a + 2}`, values: [['(=) Rendimento livre / não autorizado   (memorando)']] },
      { range: `${q(d.aba)}!B${a + 3}`, values: [[`Carteira autorizada · total autorizado   (memorando)`]] },
      { range: `${q(d.aba)}!B${a + 4}`, values: [['(−) Utilizado da carteira autorizada   (memorando)']] },
      { range: `${q(d.aba)}!B${a + 5}`, values: [['(=) Autorizado disponível   (memorando)']] },
    );
    for (const [mes, col] of Object.entries(L.colPorMes)) {
      const c = colLetra(col);
      updates.push(
        { range: `${q(d.aba)}!${c}${a + 1}`, values: [[somaMov(TIPO_AUT, d.projeto, c)]] },
        { range: `${q(d.aba)}!${c}${a + 2}`, values: [[`=${c}${a}+${c}${a + 1}`]] },
        { range: `${q(d.aba)}!${c}${a + 3}`, values: [[`=-${c}${a + 1}`]] },
        { range: `${q(d.aba)}!${c}${a + 4}`, values: [[somaMov(TIPO_USO, d.projeto, c)]] },
        { range: `${q(d.aba)}!${c}${a + 5}`, values: [[`=${c}${a + 3}+${c}${a + 4}`]] },
      );
    }
    console.log(`\n${d.aba}   bloco nas linhas ${a + 1}–${a + 5}, ${Object.keys(L.colPorMes).length} colunas`);
  }

  // Última coluna marcada "realizado" no consolidado. O saldo financeiro
  // remanescente é rendimento REALIZADO menos utilizado — misturar projeção de
  // meses futuros com uma utilização que já aconteceu dá número sem sentido.
  const marca4 = ((await sheets.spreadsheets.values.get({
    spreadsheetId: ID_ORC, range: `${q(CONSOLIDADO.aba)}!A4:BA4`, valueRenderOption: 'FORMATTED_VALUE',
  })).data.values || [[]])[0] || [];
  let colRealizado = 0, mesRealizado = '';
  for (const [mes, col] of Object.entries(layout[CONSOLIDADO.aba].colPorMes)) {
    if (String(marca4[col - 1] || '').trim().toLowerCase() === 'realizado' && col > colRealizado) {
      colRealizado = col; mesRealizado = mes;
    }
  }
  if (!colRealizado) throw new Error('nenhum mês marcado "realizado" no consolidado');
  const refRealizado = `$${colLetra(colRealizado)}$${CONSOLIDADO.acum}`;
  console.log(`\núltimo mês realizado: ${mesRealizado} (coluna ${colLetra(colRealizado)}) — ` +
    `saldo financeiro remanescente ancorado em ${refRealizado}`);

  // Consolidado
  {
    const d = CONSOLIDADO, L = layout[d.aba], a = d.acum;
    rotulos.push(
      { range: `${q(d.aba)}!B${a + 1}`, values: [[`(−) Total autorizado · ${OFICIO.documento}   (memorando)`]] },
      { range: `${q(d.aba)}!B${a + 2}`, values: [['(=) Rendimento livre / não autorizado   (memorando)']] },
      { range: `${q(d.aba)}!B${a + 3}`, values: [['Carteira autorizada · total autorizado   (memorando)']] },
      { range: `${q(d.aba)}!B${a + 4}`, values: [['(−) Utilizado da carteira autorizada   (memorando)']] },
      { range: `${q(d.aba)}!B${a + 5}`, values: [['(=) Autorizado disponível   (memorando)']] },
      { range: `${q(d.aba)}!B${a + 6}`, values: [[`Saldo financeiro remanescente · realizado até ${mesRealizado} − utilizado   (memorando)`]] },
      { range: `${q(d.aba)}!B${a + 7}`, values: [['Conferência da identidade — deve dar zero']] },
      { range: `${q(d.aba)}!B${a + 8}`, values: [['Soma das 5 abas × consolidado — deve dar zero']] },
    );
    for (const [mes, col] of Object.entries(L.colPorMes)) {
      const c = colLetra(col);
      updates.push(
        { range: `${q(d.aba)}!${c}${a + 1}`, values: [[somaMov(TIPO_AUT, null, c)]] },
        { range: `${q(d.aba)}!${c}${a + 2}`, values: [[`=${c}${a}+${c}${a + 1}`]] },
        { range: `${q(d.aba)}!${c}${a + 3}`, values: [[`=-${c}${a + 1}`]] },
        { range: `${q(d.aba)}!${c}${a + 4}`, values: [[somaMov(TIPO_USO, null, c)]] },
        { range: `${q(d.aba)}!${c}${a + 5}`, values: [[`=${c}${a + 3}+${c}${a + 4}`]] },
        { range: `${q(d.aba)}!${c}${a + 6}`, values: [[`=${refRealizado}+${c}${a + 4}`]] },
        { range: `${q(d.aba)}!${c}${a + 7}`, values: [[`=${c}${a}-(${c}${a + 2}+${c}${a + 5}-${c}${a + 4})`]] },
      );
      if (mesesComuns.includes(mes)) {
        const termos = ABAS
          .filter(x => layout[x.aba].colPorMes[mes])
          .map(x => `${q(x.aba)}!${colLetra(layout[x.aba].colPorMes[mes])}${layout[x.aba].acum}`);
        updates.push({ range: `${q(d.aba)}!${c}${a + 8}`, values: [[`=${c}${a}-(${termos.join('+')})`]] });
      }
    }
    console.log(`\n${d.aba}   bloco nas linhas ${a + 1}–${a + 8}, ${Object.keys(L.colPorMes).length} colunas` +
      `  (conferência das 5 abas em ${mesesComuns.length} meses: ${mesesComuns[0]} a ${mesesComuns[mesesComuns.length - 1]})`);
  }

  console.log(`\nTotal: 1 aba nova + ${rotulos.length} rótulos + ${updates.length} fórmulas`);

  // ── 4. Verificação de escopo ─────────────────────────────────────────────
  console.log('\nESCOPO DA GRAVAÇÃO');
  console.log('='.repeat(92));
  let foraDeEscopo = 0;
  for (const u of [...rotulos, ...updates]) {
    const m = u.range.match(/^'(.+)'!([A-Z]+)(\d+)$/);
    const aba = m[1], lin = parseInt(m[3]);
    const base = aba === CONSOLIDADO.aba ? CONSOLIDADO.acum : (ABAS.find(x => x.aba === aba) || {}).acum;
    const limite = aba === CONSOLIDADO.aba ? 8 : 5;
    if (!(lin > base && lin <= base + limite)) { console.log(`  ✗ fora de escopo: ${u.range}`); foraDeEscopo++; }
  }
  ok(foraDeEscopo === 0, `todas as ${rotulos.length + updates.length} células estão abaixo da linha de acumulado`);
  ok(LINHAS_CAIXA[CONSOLIDADO.aba].every(l => l < CONSOLIDADO.acum),
    'nenhuma linha de caixa está no intervalo que será escrito');

  if (!GRAVAR) {
    console.log('\nSIMULAÇÃO — nada gravado. Exemplos de fórmula:');
    console.log('  ' + updates[0].range + '\n     ' + updates[0].values[0][0]);
    console.log('  ' + updates[3].range + '\n     ' + updates[3].values[0][0]);
    const ultC = updates[updates.length - 1];
    console.log('  ' + ultC.range + '\n     ' + ultC.values[0][0]);
    console.log('\nRode com --write para aplicar.');
    return;
  }

  // ── 5. Gravação ──────────────────────────────────────────────────────────
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID_ORC, fields: 'sheets.properties(sheetId,title)' });
  let gidMov = (meta.data.sheets.find(s => s.properties.title === ABA_MOV) || {}).properties?.sheetId;

  if (gidMov === undefined) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ID_ORC,
      requestBody: { requests: [{ addSheet: { properties: { title: ABA_MOV, gridProperties: { rowCount: 500, columnCount: COLS_MOV.length, frozenRowCount: 1 } } } }] },
    });
    gidMov = res.data.replies[0].addSheet.properties.sheetId;
    console.log(`\n✓ aba "${ABA_MOV}" criada (gid ${gidMov})`);
  } else {
    console.log(`\n· aba "${ABA_MOV}" já existia (gid ${gidMov}) — linhas serão reescritas`);
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID_ORC,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${q(ABA_MOV)}!A1`, values: [COLS_MOV] },
        { range: `${q(ABA_MOV)}!A2`, values: linhasMov },
      ],
    },
  });
  console.log(`✓ ${linhasMov.length} movimentações gravadas`);

  // Formatação, validação de dados e proteção
  const req = [];
  req.push({ repeatCell: {
    range: { sheetId: gidMov, startRowIndex: 0, endRowIndex: 1 },
    cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.94, green: 0.95, blue: 0.97 } } },
    fields: 'userEnteredFormat(textFormat,backgroundColor)' } });
  // P: competencia_data como data
  req.push({ repeatCell: {
    range: { sheetId: gidMov, startRowIndex: 1, startColumnIndex: 15, endColumnIndex: 16 },
    cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } },
    fields: 'userEnteredFormat.numberFormat' } });
  // G e N como moeda
  for (const ci of [6, 13]) req.push({ repeatCell: {
    range: { sheetId: gidMov, startRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 },
    cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: 'R$ #,##0.00' } } },
    fields: 'userEnteredFormat.numberFormat' } });

  const validacao = (ci, valores) => ({ setDataValidation: {
    range: { sheetId: gidMov, startRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 },
    rule: { condition: { type: 'ONE_OF_LIST', values: valores.map(v => ({ userEnteredValue: v })) },
            showCustomUi: true, strict: true,
            inputMessage: 'Escolha um valor da lista. Campo controlado.' } } });
  req.push(validacao(3, [TIPO_AUT, TIPO_USO]));          // D tipo
  req.push(validacao(14, STATUS));                        // O status
  req.push(validacao(5, PROJETOS));                       // F projeto_origem

  // Proteção com aviso: protege contra edição acidental sem travar o dono.
  // Idempotente: se já existe proteção com a mesma descrição, não duplica.
  const jaProtegido = new Set();
  (await sheets.spreadsheets.get({ spreadsheetId: ID_ORC, fields: 'sheets(properties.title,protectedRanges.description)' }))
    .data.sheets.forEach(s => (s.protectedRanges || []).forEach(p =>
      jaProtegido.add(s.properties.title + '|' + (p.description || ''))));

  for (const ci of COLS_TECNICAS) {
    if (jaProtegido.has(`${ABA_MOV}|Coluna técnica (${COLS_MOV[ci]}) — derivada, não editar à mão`)) continue;
    req.push({ addProtectedRange: { protectedRange: {
      range: { sheetId: gidMov, startColumnIndex: ci, endColumnIndex: ci + 1 },
      description: `Coluna técnica (${COLS_MOV[ci]}) — derivada, não editar à mão`,
      warningOnly: true } } });
  }
  const descCarteira = 'Carteira autorizada (memorando) — fórmulas, não editar à mão';
  for (const d of [...ABAS, CONSOLIDADO]) {
    if (jaProtegido.has(`${d.aba}|${descCarteira}`)) continue;
    const gid = (meta.data.sheets.find(s => s.properties.title === d.aba) || {}).properties.sheetId;
    const n = d.aba === CONSOLIDADO.aba ? 8 : 5;
    req.push({ addProtectedRange: { protectedRange: {
      range: { sheetId: gid, startRowIndex: d.acum, endRowIndex: d.acum + n },
      description: descCarteira, warningOnly: true } } });
  }

  const novasProt = req.filter(r => r.addProtectedRange).length;
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID_ORC, requestBody: { requests: req } });
  console.log(`✓ formatação e 3 validações de dados` +
    (novasProt ? `; ${novasProt} intervalos protegidos` : '; proteções já existentes, nada duplicado'));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID_ORC,
    requestBody: { valueInputOption: 'USER_ENTERED', data: [...rotulos, ...updates] },
  });
  console.log(`✓ ${rotulos.length} rótulos e ${updates.length} fórmulas gravados`);
  console.log('\nRode agora:  node sync/conferir-carteira.js');
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
