/**
 * Conferência pós-gravação — só leitura.
 *
 * Relê a planilha oficial e verifica, ponto a ponto:
 *   1. julho corrigido nas cinco abas de projeto;
 *   2. agosto com o realizado nas cinco abas;
 *   3. agosto marcado como "realizado" nas seis abas;
 *   4. consolidado J12 continua sendo fórmula;
 *   5. consolidado J12 resulta em R$ 64.710,03;
 *   6. set/26 em diante continua em fórmula;
 *   7. projeções de set/26 em diante, antes x depois (contra o snapshot).
 *
 * Uso:  node sync/conferir.js [caminho-do-snapshot-anterior.json]
 */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const S = require('./snapshot.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const ID_ORC = S.ID_ORC;

const ESPERADO = {
  'jul./26': {
    'operação básica • ENAP': 4026.54,
    'co.ne • BID': 3463.54,
    'parceria • MDIC': 13477.05,
    'alimenta +1.000 cidades • MDS': 41513.82,
    'car dpg • FBDS': 7899.10,
  },
  'ago./26': {
    'operação básica • ENAP': 3311.96,
    'co.ne • BID': 2711.33,
    'parceria • MDIC': 13074.67,
    'alimenta +1.000 cidades • MDS': 38814.67,
    'car dpg • FBDS': 6797.40,
  },
};
const CONSOLIDADO = 'consolidado • 2026 a 2028';
const TOTAL_AGOSTO = 64710.03;

const brl = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ordemMes = m => {
  const M = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const x = String(m).toLowerCase().replace(/\./g, '').match(/^(\w{3})\/(\d{2})$/);
  return x ? 2000 + parseInt(x[2]) + M[x[1]] / 100 : 0;
};

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const agora = await S.snapshot(sheets);
  const falhas = [];
  const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) falhas.push(msg); };

  // 1 e 2 — valores de julho e agosto nas cinco abas
  for (const [mes, esperado] of Object.entries(ESPERADO)) {
    console.log(`\n${mes} — valores realizados nas abas de projeto`);
    let soma = 0;
    for (const [aba, alvo] of Object.entries(esperado)) {
      const c = agora.abas[aba].celulas[mes];
      const bate = c && !c.ehFormula && Math.abs(c.calculado - alvo) < 0.005;
      soma += c ? c.calculado : 0;
      ok(bate, `${aba.padEnd(30)} ${c.celula.padEnd(4)} = ${brl(c.calculado).padStart(14)}  (esperado ${brl(alvo)}${c.ehFormula ? ' — AINDA É FÓRMULA' : ''})`);
    }
    const alvoSoma = mes === 'ago./26' ? TOTAL_AGOSTO : 70380.05;
    ok(Math.abs(soma - alvoSoma) < 0.005, `soma das cinco abas = ${brl(soma)}  (esperado ${brl(alvoSoma)})`);
  }

  // 3 — marca realizado nas seis abas
  console.log(`\nago./26 — marcação na linha 4`);
  for (const aba of Object.keys(agora.abas)) {
    const c = agora.abas[aba].celulas['ago./26'];
    ok(c && c.marca.toLowerCase() === 'realizado', `${aba.padEnd(30)} marca = "${c ? c.marca : '(ausente)'}"`);
  }

  // 4 e 5 — consolidado J12
  console.log(`\nconsolidado • 2026 a 2028 — ago./26`);
  const j12 = agora.abas[CONSOLIDADO].celulas['ago./26'];
  ok(j12.ehFormula, `${j12.celula} continua sendo fórmula: ${String(j12.conteudo).slice(0, 56)}…`);
  ok(Math.abs(j12.calculado - TOTAL_AGOSTO) < 0.005, `${j12.celula} resulta em ${brl(j12.calculado)}  (esperado ${brl(TOTAL_AGOSTO)})`);
  const i12 = agora.abas[CONSOLIDADO].celulas['jul./26'];
  ok(Math.abs(i12.calculado - 70380.05) < 0.005, `${i12.celula} (julho) inalterado em ${brl(i12.calculado)}`);

  // 6 — set/26 em diante continua em fórmula
  console.log(`\nset./26 em diante — fórmulas preservadas`);
  for (const [aba, d] of Object.entries(agora.abas)) {
    const fut = Object.entries(d.celulas).filter(([m]) => ordemMes(m) > ordemMes('ago./26'));
    const semF = fut.filter(([, c]) => !c.ehFormula);
    ok(semF.length === 0, `${aba.padEnd(30)} ${fut.length - semF.length}/${fut.length} em fórmula` +
      (semF.length ? ` — SEM fórmula: ${semF.map(([m]) => m).join(', ')}` : ''));
  }

  // 7 — reprojeção: antes x depois
  const anterior = process.argv[2] || (() => {
    const dir = path.resolve(__dirname, 'backups');
    const arqs = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
    return arqs.length ? path.join(dir, arqs[arqs.length - 1]) : null;
  })();

  if (anterior && fs.existsSync(anterior)) {
    const antes = JSON.parse(fs.readFileSync(anterior, 'utf8'));
    console.log(`\nNovas projeções de set./26 em diante  (contra ${path.basename(anterior)})`);
    for (const [aba, d] of Object.entries(agora.abas)) {
      const fut = Object.entries(d.celulas)
        .filter(([m]) => ordemMes(m) > ordemMes('ago./26'))
        .sort((a, b) => ordemMes(a[0]) - ordemMes(b[0]))
        .slice(0, 6);
      if (!fut.length) continue;
      console.log(`  ${aba}`);
      let somaDelta = 0;
      for (const [mes, c] of fut) {
        const a = antes.abas[aba]?.celulas[mes];
        const delta = a && a.calculado !== null ? c.calculado - a.calculado : null;
        if (delta !== null) somaDelta += delta;
        console.log(`     ${mes.padEnd(9)} ${c.celula.padEnd(5)} ${brl(a ? a.calculado : 0).padStart(13)} → ${brl(c.calculado).padStart(13)}` +
          (delta === null ? '' : `   ${(delta >= 0 ? '+' : '') + brl(delta)}`));
      }
      console.log(`     ${'(6 meses)'.padEnd(9)} ${''.padEnd(5)} ${''.padStart(13)}   variação total ${(somaDelta >= 0 ? '+' : '') + brl(somaDelta)}`);
    }
  } else {
    console.log('\n(sem snapshot anterior para comparar as projeções)');
  }

  console.log('\n' + '='.repeat(70));
  console.log(falhas.length ? `✗ ${falhas.length} verificação(ões) falharam` : '✓ TODAS AS VERIFICAÇÕES PASSARAM');
  if (falhas.length) process.exit(1);
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
