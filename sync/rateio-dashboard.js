/**
 * Rateio de rendimentos por projeto — réplica fiel do cálculo do dashboard.
 *
 * NÃO grava nada. Só lê a Base e reproduz, em Node, o mesmo algoritmo de
 * src/app/pages/rendimentos/rendimentos.component.ts:
 *
 *   · abrirDetalhe(mesAno)            → rateio DO MÊS  (detalhesRend.rendimentoMes)
 *   · computarHistoricoPorProjeto()   → série mensal acumulada por projeto
 *
 * As duas regras que faltavam no rateio anterior estão aqui:
 *   1. projetos encerrados (aba "Saldos remanescentes") têm o saldo zerado e
 *      transferido para Operação Básica a partir do mês seguinte ao encerramento;
 *   2. o saldo remanescente dos demais projetos (srOutrosProjetos) entra na
 *      base de participação de Operação Básica no mês avaliado.
 *
 * Uso:  node sync/rateio-dashboard.js [MM/AAAA ...]
 */
const { google } = require('googleapis');
const path = require('path');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_BASE = '1ig0YnBpDncfJZu9Qf6IXzUc2jjKiDEVKLOdLPopwPCM';

const ABAS = {
  principal: 'Principal',          // gid 0
  rendimentos: 'Rendimentos',      // gid 2032068393
  saldos: 'Saldos remanescentes',  // gid 86178020
  status: 'Status Projetos',       // gid 1699326950
};

const brl = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mesKey = s => { const [m, y] = String(s).split('/'); return parseInt(y) * 100 + parseInt(m); };
const cent = v => Math.round(v * 100) / 100;

/** Idêntico a DataService.parseValor(). */
function parseValor(valorStr) {
  if (!valorStr) return 0;
  let isNegative = false;
  let cleanStr = String(valorStr).replace(/"/g, '').trim();
  if (cleanStr.startsWith('(') && cleanStr.endsWith(')')) { isNegative = true; cleanStr = cleanStr.slice(1, -1); }
  cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

/** Idêntico a DataService.extrairMesAno(). */
function extrairMesAno(data) {
  if (!data) return '';
  const full = String(data).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (full) return `${full[2].padStart(2, '0')}/${full[3]}`;
  const ma = String(data).match(/^(\d{1,2})\/(\d{4})$/);
  if (ma) return `${ma[1].padStart(2, '0')}/${ma[2]}`;
  return String(data);
}

/** A API corta células vazias no fim da linha; o CSV que o dashboard lê vem preenchido. */
const pad = (rows, n) => rows.map(r => { const c = r.slice(); while (c.length < n) c.push(''); return c; });

async function carregar(sheets) {
  const get = async (aba, range, largura) => {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: ID_BASE, range: `'${aba}'!${range}`, valueRenderOption: 'FORMATTED_VALUE',
    });
    return pad(r.data.values || [], largura);
  };

  // ── Principal → lancamentos (DataService.parsePrincipal) ──────────────────
  const lancamentos = [];
  for (const row of (await get(ABAS.principal, 'A1:M3000', 13)).slice(1)) {
    if (row.length < 11) continue;
    const categoria = (row[8] || '').trim();
    const projeto = (row[10] || '').trim();
    let mesAno = (row[11] || '').trim();
    if (!mesAno || !mesAno.includes('/') || mesAno.startsWith('#')) {
      const parts = (row[2] || '').trim().split('/');
      if (parts.length === 3) mesAno = `${parts[1]}/${parts[2]}`;
    }
    const valor = parseValor((row[12] || row[4] || '').trim());
    if (categoria || projeto) lancamentos.push({ categoria, projeto, mesAno, valor });
  }

  // ── Rendimentos (DataService.parseRendimentos) ────────────────────────────
  const rendimentos = [];
  for (const row of (await get(ABAS.rendimentos, 'A1:D2000', 4)).slice(1)) {
    if (row.length < 3) continue;
    const categoria = (row[0] || '').trim();
    const valor = parseValor((row[2] || '').trim());
    const utilizacao = (row[3] || '').trim();
    if (!categoria && valor === 0) continue;
    rendimentos.push({ categoria, mesAno: extrairMesAno((row[1] || '').trim()), valor, utilizacao });
  }

  // ── Saldos remanescentes (DataService.parseSaldos) ────────────────────────
  const saldos = [];
  for (const row of (await get(ABAS.saldos, 'A1:E1000', 5)).slice(1)) {
    if (row.length < 5) continue;
    const data = (row[0] || '').trim();
    const parceiro = (row[1] || '').trim();
    const projeto = (row[2] || '').trim();
    if (projeto || parceiro) saldos.push({ data, parceiro, projeto, valorTransferido: parseValor(row[3]) });
  }

  // ── Status Projetos (DataService.parseStatusProjetos) ─────────────────────
  const status = [];
  for (const row of (await get(ABAS.status, 'A1:B1000', 2)).slice(1)) {
    if (row.length < 2) continue;
    const projeto = (row[0] || '').trim();
    const st = (row[1] || '').trim()
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').replace(/^[^\wÀ-ÿ]+/g, '').trim();
    if (projeto) status.push({ projeto, status: st });
  }

  return { lancamentos, rendimentos, saldos, status };
}

/** DataService.getRendimentoResumo().porMes */
function porMesDe(rendimentos) {
  const map = new Map();
  rendimentos.forEach(r => {
    const key = r.mesAno || 'Sem data';
    if (!map.has(key)) map.set(key, { bruto: 0, imposto: 0 });
    const m = map.get(key);
    if (r.valor > 0) m.bruto += r.valor; else m.imposto += r.valor;
  });
  return Array.from(map.entries())
    .sort((a, b) => mesKey(a[0]) - mesKey(b[0]))
    .map(([mesAno, d]) => ({ mesAno, bruto: d.bruto, imposto: d.imposto, liquido: d.bruto + d.imposto }));
}

function contexto(dados) {
  const porMes = porMesDe(dados.rendimentos);

  const utilizacaoPorMes = new Map();
  dados.rendimentos.forEach(r => {
    if (r.valor > 0 && !utilizacaoPorMes.has(r.mesAno)) utilizacaoPorMes.set(r.mesAno, r.utilizacao);
  });

  const projetosEncerrados = new Map();
  dados.saldos.forEach(s => {
    const p = s.data.split('/');
    if (p.length === 3) projetosEncerrados.set(s.projeto, parseInt(p[2]) * 100 + parseInt(p[1]));
  });

  const projetosInativos = new Set();
  dados.status.forEach(s => {
    const st = s.status.toLowerCase();
    if (st === 'finalizado' || st === 'encerrado') projetosInativos.add(s.projeto);
  });

  // getProjetoResumos(): saldoRemanescente = soma de valorTransferido por projeto
  const remanescente = new Map();
  dados.saldos.forEach(s => {
    if (!s.projeto) return;
    remanescente.set(s.projeto, (remanescente.get(s.projeto) ?? 0) + s.valorTransferido);
  });
  let srOutrosProjetos = 0;
  remanescente.forEach((v, p) => { if (p !== 'Operação Básica') srOutrosProjetos += v; });

  return { porMes, utilizacaoPorMes, projetosEncerrados, projetosInativos, srOutrosProjetos,
           lancamentos: dados.lancamentos };
}

const isDisp = (ctx, mesAno) => (ctx.utilizacaoPorMes.get(mesAno) ?? '').toLowerCase().trim() !== 'utilizado';

/** Réplica de abrirDetalhe(mesAno) — devolve o rateio DO MÊS e o acumulado. */
function abrirDetalhe(ctx, mesAno) {
  const cutoff = mesKey(mesAno);
  const isClickedDisponivel = isDisp(ctx, mesAno);

  const allMonthsSorted = [...ctx.porMes].sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));
  const firstDispMc = allMonthsSorted.reduce((acc, m) =>
    isDisp(ctx, m.mesAno) && acc === Infinity ? mesKey(m.mesAno) : acc, Infinity);

  const lancsSorted = [...ctx.lancamentos].filter(l => l.mesAno).sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));

  const sortedMonths = ctx.porMes.filter(m => {
    const mc = mesKey(m.mesAno);
    if (mc > cutoff) return false;
    return isClickedDisponivel ? mc >= firstDispMc : !isDisp(ctx, m.mesAno);
  }).sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));

  const runningBalance = new Map();
  const projRendAcum = new Map();
  let lIdx = 0, undistributed = 0;

  for (const mes of sortedMonths) {
    const mc = mesKey(mes.mesAno);
    while (lIdx < lancsSorted.length && mesKey(lancsSorted[lIdx].mesAno) <= mc) {
      const l = lancsSorted[lIdx++];
      if (!l.projeto) continue;
      runningBalance.set(l.projeto, (runningBalance.get(l.projeto) ?? 0) + l.valor);
    }
    ctx.projetosEncerrados.forEach((closedMc, proj) => {
      if (mc > closedMc) {
        const bal = runningBalance.get(proj) ?? 0;
        if (bal > 0) runningBalance.set('Operação Básica', (runningBalance.get('Operação Básica') ?? 0) + bal);
        runningBalance.set(proj, 0);
      }
    });
    const totalPos = Array.from(runningBalance.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const toDistribute = mes.liquido + undistributed;
    if (totalPos > 0 && toDistribute > 0) {
      runningBalance.forEach((saldo, proj) => {
        if (saldo > 0) projRendAcum.set(proj, (projRendAcum.get(proj) ?? 0) + toDistribute * (saldo / totalPos));
      });
      undistributed = 0;
    } else { undistributed += mes.liquido; }
  }

  const isInativo = proj => ctx.projetosInativos.has(proj) ||
    (ctx.projetosEncerrados.has(proj) && cutoff >= ctx.projetosEncerrados.get(proj));

  Array.from(projRendAcum.keys()).forEach(proj => {
    const rend = projRendAcum.get(proj);
    if (proj !== 'Operação Básica' && isInativo(proj)) {
      if (rend > 0) projRendAcum.set('Operação Básica', (projRendAcum.get('Operação Básica') ?? 0) + rend);
      projRendAcum.delete(proj);
    }
  });

  projRendAcum.forEach((rend, proj) => projRendAcum.set(proj, cent(rend)));
  const expectedTotal = cent(sortedMonths.reduce((s, m) => s + m.liquido, 0));
  const actualSum = cent(Array.from(projRendAcum.values()).reduce((s, v) => s + v, 0));
  const residuo = cent(expectedTotal - actualSum);
  if (residuo !== 0) {
    let maxProj = '', maxRend = -Infinity;
    projRendAcum.forEach((rend, proj) => { if (rend > maxRend) { maxRend = rend; maxProj = proj; } });
    if (maxProj) projRendAcum.set(maxProj, cent(projRendAcum.get(maxProj) + residuo));
  }

  // Base de participação do mês avaliado
  const saldoBase = new Map();
  ctx.lancamentos.forEach(l => {
    if (!l.mesAno || !l.projeto || mesKey(l.mesAno) > cutoff) return;
    const closedMc = ctx.projetosEncerrados.get(l.projeto);
    if (closedMc && cutoff > closedMc) return;
    saldoBase.set(l.projeto, (saldoBase.get(l.projeto) ?? 0) + l.valor);
  });
  if (ctx.srOutrosProjetos > 0)
    saldoBase.set('Operação Básica', (saldoBase.get('Operação Básica') ?? 0) + ctx.srOutrosProjetos);
  const totalBase = Array.from(saldoBase.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const mesLiquido = ctx.porMes.find(m => m.mesAno === mesAno)?.liquido ?? 0;

  const linhas = Array.from(projRendAcum.keys()).map(projeto => {
    const saldo = saldoBase.get(projeto) ?? 0;
    const pct = totalBase > 0 && saldo > 0 ? saldo / totalBase : 0;
    return { projeto, pctParticipacao: pct * 100, rendimentoMes: mesLiquido * pct,
             rendimentoAcumulado: projRendAcum.get(projeto) ?? 0, saldoProjeto: saldo };
  }).filter(d => d.rendimentoAcumulado > 0.01)
    .sort((a, b) => b.rendimentoAcumulado - a.rendimentoAcumulado);

  return { mesAno, mesLiquido, linhas, totalBase };
}

/**
 * Réplica de computarHistoricoPorProjeto() — série mensal por projeto.
 * Diferente de abrirDetalhe(): o rateio de cada mês sai do saldo corrente
 * daquele mês (com a transferência dos encerrados já aplicada), não de uma
 * foto do saldo no mês avaliado.
 */
function historicoPorProjeto(ctx) {
  const allSorted = [...ctx.porMes].sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));
  const firstDispMc = allSorted.reduce((acc, m) =>
    isDisp(ctx, m.mesAno) && acc === Infinity ? mesKey(m.mesAno) : acc, Infinity);
  if (firstDispMc === Infinity) return { meses: [], porMes: new Map(), acum: new Map() };

  const dispMonths = allSorted.filter(m => mesKey(m.mesAno) >= firstDispMc && isDisp(ctx, m.mesAno));
  if (!dispMonths.length) return { meses: [], porMes: new Map(), acum: new Map() };
  const lastCutoff = mesKey(dispMonths[dispMonths.length - 1].mesAno);

  const lancsSorted = [...ctx.lancamentos].filter(l => l.mesAno).sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));

  const runningBalance = new Map();
  const projRendAcum = new Map();
  const projMesRend = new Map();
  let lIdx = 0, undistributed = 0;

  for (const mes of dispMonths) {
    const mc = mesKey(mes.mesAno);
    while (lIdx < lancsSorted.length && mesKey(lancsSorted[lIdx].mesAno) <= mc) {
      const l = lancsSorted[lIdx++];
      if (!l.projeto) continue;
      runningBalance.set(l.projeto, (runningBalance.get(l.projeto) ?? 0) + l.valor);
    }
    ctx.projetosEncerrados.forEach((closedMc, proj) => {
      if (mc > closedMc) {
        const bal = runningBalance.get(proj) ?? 0;
        if (bal > 0) runningBalance.set('Operação Básica', (runningBalance.get('Operação Básica') ?? 0) + bal);
        runningBalance.set(proj, 0);
      }
    });
    const totalPos = Array.from(runningBalance.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const toDistribute = mes.liquido + undistributed;
    if (totalPos > 0 && toDistribute > 0) {
      runningBalance.forEach((saldo, proj) => {
        if (saldo > 0) {
          const rendMes = toDistribute * (saldo / totalPos);
          projRendAcum.set(proj, (projRendAcum.get(proj) ?? 0) + rendMes);
          if (!projMesRend.has(proj)) projMesRend.set(proj, new Map());
          projMesRend.get(proj).set(mes.mesAno, (projMesRend.get(proj).get(mes.mesAno) ?? 0) + rendMes);
        }
      });
      undistributed = 0;
    } else { undistributed += mes.liquido; }
  }

  const isInativo = proj => ctx.projetosInativos.has(proj) ||
    (ctx.projetosEncerrados.has(proj) && lastCutoff >= ctx.projetosEncerrados.get(proj));

  Array.from(projRendAcum.keys()).forEach(proj => {
    const rend = projRendAcum.get(proj);
    if (proj !== 'Operação Básica' && isInativo(proj) && rend > 0) {
      projRendAcum.set('Operação Básica', (projRendAcum.get('Operação Básica') ?? 0) + rend);
      const opMap = projMesRend.get('Operação Básica') ?? new Map();
      (projMesRend.get(proj) ?? new Map()).forEach((v, m) => opMap.set(m, (opMap.get(m) ?? 0) + v));
      projMesRend.set('Operação Básica', opMap);
      projRendAcum.delete(proj);
      projMesRend.delete(proj);
    }
  });

  return { meses: dispMonths, porMes: projMesRend, acum: projRendAcum };
}

/** Rateio de um mês específico segundo a série histórica. */
function rateioHistorico(hist, mesAno, liquido) {
  const linhas = [];
  hist.porMes.forEach((mapa, proj) => {
    const v = mapa.get(mesAno);
    if (v !== undefined && v > 0.005) linhas.push({ projeto: proj, rendimentoMes: v, pctParticipacao: liquido > 0 ? (v / liquido) * 100 : 0 });
  });
  linhas.sort((a, b) => b.rendimentoMes - a.rendimentoMes);
  return { mesAno, mesLiquido: liquido, linhas };
}

/**
 * Fecha o rateio do mês em centavos exatos: arredonda cada projeto e joga o
 * resíduo no maior, como o dashboard faz com o acumulado.
 */
function fechar(det) {
  const v = det.linhas.map(l => ({ projeto: l.projeto, valor: cent(l.rendimentoMes), pct: l.pctParticipacao }));
  const alvo = cent(det.mesLiquido);
  const soma = cent(v.reduce((s, x) => s + x.valor, 0));
  const residuo = cent(alvo - soma);
  let ajuste = null;
  if (residuo !== 0 && v.length) {
    let idx = 0;
    v.forEach((x, i) => { if (x.valor > v[idx].valor) idx = i; });
    v[idx].valor = cent(v[idx].valor + residuo);
    ajuste = { projeto: v[idx].projeto, valor: residuo };
  }
  return { valores: v, alvo, ajuste, somaFinal: cent(v.reduce((s, x) => s + x.valor, 0)) };
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const ctx = contexto(await carregar(sheets));

  const pedidos = process.argv.slice(2).filter(a => /^\d{2}\/\d{4}$/.test(a));
  const meses = pedidos.length ? pedidos : ['07/2026', '08/2026'];

  console.log(`Base: ${ID_BASE}`);
  console.log(`Meses de rendimento carregados: ${ctx.porMes.length} (${ctx.porMes[0].mesAno} a ${ctx.porMes[ctx.porMes.length - 1].mesAno})`);
  console.log(`Projetos encerrados (aba Saldos): ${ctx.projetosEncerrados.size}`);
  console.log(`Saldo remanescente de outros projetos → Operação Básica: ${brl(ctx.srOutrosProjetos)}\n`);

  const hist = historicoPorProjeto(ctx);

  const mostra = (rotulo, f) => {
    console.log(`  ── ${rotulo}`);
    f.valores.slice().sort((a, b) => b.valor - a.valor).forEach(x =>
      console.log(`     ${x.projeto.padEnd(26)} ${brl(x.valor).padStart(15)}   ${x.pct.toFixed(4).padStart(8)}%`));
    console.log(`     ${'SOMA'.padEnd(26)} ${brl(f.somaFinal).padStart(15)}   alvo ${brl(f.alvo)}`);
    if (f.ajuste) console.log(`     (resíduo de ${brl(f.ajuste.valor)} em ${f.ajuste.projeto})`);
    console.log();
  };

  const saida = {};
  for (const mes of meses) {
    const det = abrirDetalhe(ctx, mes);
    const fA = fechar(det);
    const fB = fechar(rateioHistorico(hist, mes, det.mesLiquido));
    console.log('='.repeat(72));
    console.log(`${mes}   líquido do mês: ${brl(det.mesLiquido)}`);
    console.log('='.repeat(72));
    mostra('método A · abrirDetalhe (foto do saldo no mês + SR agregado)', fA);
    mostra('método B · computarHistoricoPorProjeto (saldo corrente mês a mês)', fB);
    saida[mes] = { metodoA: fA, metodoB: fB, liquido: det.mesLiquido };
  }

  if (process.env.RATEIO_JSON) {
    require('fs').writeFileSync(process.env.RATEIO_JSON, JSON.stringify(saida, null, 2));
    console.log('JSON salvo em ' + process.env.RATEIO_JSON);
  }
}

if (require.main === module) main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
module.exports = { carregar, contexto, abrirDetalhe, historicoPorProjeto, rateioHistorico, fechar, ID_BASE, ABAS, brl, cent, mesKey };
