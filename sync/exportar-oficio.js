/**
 * Exporta a aba "Movimentações de Rendimentos" para public/oficio-04-2026.json.
 *
 * Fonte única: a planilha. O dashboard lê este JSON em tempo de execução, então
 * nenhum valor do Ofício fica escrito dentro de componente. Registrou uma nova
 * utilização na aba? Rode este script e publique — os números se atualizam.
 *
 * A aba de movimentações não está publicada como CSV, e publicar exige a
 * interface do Sheets. Enquanto não estiver, este export é a ponte.
 *
 *   node sync/exportar-oficio.js
 */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID = '17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM';
const ABA = 'Movimentações de Rendimentos';
const SAIDA = path.resolve(__dirname, '..', 'public', 'oficio-04-2026.json');
const OB = 'Operação Básica';

const T_TRANSF = 'transferência interna de rendimentos';
const T_PROPRIA = 'destinação própria';
const T_USO = 'utilização da carteira';

// Acumulado por projeto em 31/07/2026 (data-base do Ofício), do método B.
const ATE_JULHO = {
  'Alimenta +1000 Cidades': 387456.64, 'CAR DPG': 72847.81,
  'Operação Básica': 37476.59, 'Co.NE': 26200.66, 'Parceria MDIC': 13477.05,
};

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // Texto e datas em FORMATTED_VALUE, números em UNFORMATTED: a competência é
  // texto "2026-08" e o Sheets converteria para serial se lida crua.
  const [txt, num] = (await sheets.spreadsheets.values.batchGet({
    spreadsheetId: ID, ranges: [`'${ABA}'!A1:R200`, `'${ABA}'!A1:R200`],
    valueRenderOption: 'FORMATTED_VALUE',
  })).data.valueRanges.map(v => v.values || []);
  const numRows = (await sheets.spreadsheets.values.get({
    spreadsheetId: ID, range: `'${ABA}'!A1:R200`, valueRenderOption: 'UNFORMATTED_VALUE',
  })).data.values || [];
  const rows = txt;
  const head = rows[0] || [];
  const idx = {}; head.forEach((h, i) => { idx[String(h).trim()] = i; });
  const mov = rows.slice(1).filter(r => String(r[0] || '').trim()).map((r, k) => ({
    _n: numRows[k + 1] || [],
    id: r[idx.id_movimentacao], dataBase: r[idx.data_base], dataEfetiva: r[idx.data_efetiva],
    competencia: String(r[idx.competencia]), tipo: String(r[idx.tipo]), documento: String(r[idx.documento]),
    origem: String(r[idx.projeto_origem]), destino: String(r[idx.projeto_destino]),
    valor: R.cent(Number((numRows[k + 1] || [])[idx.valor] || 0)),
    numeroPagamento: r[idx.numero_pagamento] ? String(r[idx.numero_pagamento]) : null,
    categoria: r[idx.categoria] ? String(r[idx.categoria]) : null,
    fornecedor: r[idx.fornecedor] ? String(r[idx.fornecedor]) : null,
    finalidade: String(r[idx.destinacao] || ''), observacao: String(r[idx.observacao] || ''),
    status: String(r[idx.status]),
  })).filter(m => m.status === 'vigente');

  // As transferências entram no rateio como ajuste de saldo na competência de
  // efeito. É o que faz o dashboard reproduzir o mesmo agosto que a planilha.
  const transferencias = [];
  mov.filter(m => m.tipo === T_TRANSF && m.origem !== m.destino).forEach(m => {
    const [ty, tm] = String(m.competencia).split('-');
    const mesAno = `${tm}/${ty}`;
    transferencias.push({ mesAno, projeto: m.origem, valor: -m.valor });
    transferencias.push({ mesAno, projeto: m.destino, valor: m.valor });
  });

  // Rendimento realizado por projeto, direto do método B — mesma fonte do rateio.
  const dadosBase = await R.carregar(sheets);
  const ctx = R.contexto({ ...dadosBase, transferencias });
  const hist = R.historicoPorProjeto(ctx);
  const meses = ctx.porMes
    .filter(m => (ctx.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() !== 'utilizado')
    .sort((a, b) => R.mesKey(a.mesAno) - R.mesKey(b.mesAno));

  const compEfeito = mov.find(m => m.tipo === T_TRANSF)?.competencia || '2026-08';
  const [ay, am] = compEfeito.split('-');
  const chaveEfeito = Number(ay) * 100 + Number(am);

  const posteriores = {};   // rendimento gerado a partir da competência de efeito
  meses.forEach(m => {
    const [mm, yy] = m.mesAno.split('/');
    if (Number(yy) * 100 + Number(mm) < chaveEfeito) return;
    const f = R.fechar(R.rateioHistorico(hist, m.mesAno, m.liquido));
    f.valores.forEach(v => { posteriores[v.projeto] = R.cent((posteriores[v.projeto] ?? 0) + v.valor); });
  });

  const soma = (tipo, campo, proj) => R.cent(mov
    .filter(m => m.tipo === tipo && m[campo] === proj && !(tipo === T_TRANSF && m.origem === m.destino))
    .reduce((s, m) => s + m.valor, 0));

  const projetos = Object.keys(ATE_JULHO).map(p => {
    const cedido = soma(T_TRANSF, 'origem', p);
    const recebido = soma(T_TRANSF, 'destino', p);
    const propria = R.cent(mov.filter(m => m.tipo === T_PROPRIA && m.origem === p).reduce((s, m) => s + m.valor, 0));
    const utilizado = R.cent(mov.filter(m => m.tipo === T_USO && m.origem === p).reduce((s, m) => s + m.valor, 0));
    const novos = R.cent(posteriores[p] ?? 0);
    return {
      projeto: p,
      historicoAteDataBase: ATE_JULHO[p],
      destinado: R.cent(cedido + propria),
      transferidoCedido: cedido,
      transferidoRecebido: recebido,
      destinacaoPropria: propria,
      saldoLivreAposOficio: R.cent(ATE_JULHO[p] - cedido - propria),
      novosRendimentos: novos,
      saldoLivreAtual: R.cent(ATE_JULHO[p] - cedido - propria + novos),
      carteiraSobGestao: R.cent(recebido + propria),
      utilizado,
      carteiraDisponivel: R.cent(recebido + propria - utilizado),
      participa: R.cent(cedido + propria) > 0 || recebido > 0,
    };
  }).sort((a, b) => b.historicoAteDataBase - a.historicoAteDataBase);

  const totalTransferido = R.cent(mov.filter(m => m.tipo === T_TRANSF).reduce((s, m) => s + m.valor, 0));
  const totalPropria = R.cent(mov.filter(m => m.tipo === T_PROPRIA).reduce((s, m) => s + m.valor, 0));
  const totalUtilizado = R.cent(mov.filter(m => m.tipo === T_USO).reduce((s, m) => s + m.valor, 0));

  const out = {
    documento: mov[0]?.documento || 'Ofício nº 04/2026',
    finalidade: mov[0]?.finalidade || 'atualização da Plataforma Desafios',
    projetoExecutor: OB,
    dataBase: mov[0]?.dataBase || '31/07/2026',
    competenciaEfeito: compEfeito,
    checkpointDataBase: R.cent(Object.values(ATE_JULHO).reduce((s, v) => s + v, 0)),
    totalDestinado: R.cent(totalTransferido + totalPropria),
    transferidoDeOutrosProjetos: totalTransferido,
    rendimentoProprioDestinado: totalPropria,
    utilizado: totalUtilizado,
    disponivel: R.cent(totalTransferido + totalPropria - totalUtilizado),
    saldoLivreTotal: R.cent(projetos.reduce((s, p) => s + p.saldoLivreAtual, 0)),
    projetos,
    movimentacoes: mov,
    geradoEm: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify(out, null, 2), 'utf8');

  console.log('Exportado para ' + SAIDA);
  console.log(`  ${out.documento} · data-base ${out.dataBase} · efeito ${out.competenciaEfeito}`);
  console.log(`  destinado ${R.brl(out.totalDestinado)} = transferido ${R.brl(out.transferidoDeOutrosProjetos)} + próprio ${R.brl(out.rendimentoProprioDestinado)}`);
  console.log(`  utilizado ${R.brl(out.utilizado)} · disponível ${R.brl(out.disponivel)}`);
  console.log(`  livre total ${R.brl(out.saldoLivreTotal)}  (livre + carteira = ${R.brl(R.cent(out.saldoLivreTotal + out.totalDestinado))})`);
  console.log('\n  projeto                   histórico 31/07     destinado    livre atual    carteira');
  out.projetos.forEach(p => console.log(
    `  ${p.projeto.padEnd(24)} ${R.brl(p.historicoAteDataBase).padStart(15)} ${R.brl(p.destinado).padStart(14)} ` +
    `${R.brl(p.saldoLivreAtual).padStart(14)} ${R.brl(p.carteiraSobGestao).padStart(14)}`));
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
