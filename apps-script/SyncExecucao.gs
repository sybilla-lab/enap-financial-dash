/**
 * Execução da sincronização, validações de fechamento e registro do Ofício nº 04/2026.
 * Complementa SyncRendimentos.gs — instalar os dois no mesmo projeto Apps Script.
 */

// ════════════════════════════════════════════════════════════════════════════
// LOCALIZAÇÃO DA LINHA "Rendimentos" NAS ABAS VISUAIS
// ════════════════════════════════════════════════════════════════════════════

var MESES_PT = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
                 jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

/**
 * Descobre, numa aba de projeto, em que linha está "Rendimentos" e qual coluna
 * corresponde a cada competência. Nada de posição fixa: se a planilha mudar de
 * layout, o script encontra de novo ou falha explicitamente.
 */
function mapearAba_(sh) {
  var dados = sh.getDataRange().getValues();
  var linhaRend = -1, linhaCabecalho = -1, colPorComp = {};

  for (var i = 0; i < dados.length; i++) {
    for (var j = 0; j < dados[i].length; j++) {
      var cel = dados[i][j];

      // Cabeçalho de meses: "jan./26", "ago/26", ou data real.
      if (linhaCabecalho < 0) {
        var comp = compDeCabecalho_(cel);
        if (comp) {
          linhaCabecalho = i;
          for (var k = j; k < dados[i].length; k++) {
            var c = compDeCabecalho_(dados[i][k]);
            if (c) colPorComp[c] = k + 1;   // 1-based
          }
        }
      }

      if (linhaRend < 0 && normalizar_(cel) === CFG.ROTULO_LINHA) linhaRend = i + 1;
    }
    if (linhaRend > 0 && linhaCabecalho >= 0) break;
  }

  if (linhaRend < 0) throw new Error('Linha "Rendimentos" não encontrada em "' + sh.getName() + '".');
  if (linhaCabecalho < 0) throw new Error('Cabeçalho de meses não encontrado em "' + sh.getName() + '".');
  return { linha: linhaRend, colunas: colPorComp };
}

function compDeCabecalho_(cel) {
  if (cel instanceof Date) {
    return cel.getFullYear() + '-' + ('0' + (cel.getMonth() + 1)).slice(-2);
  }
  var s = normalizar_(cel).replace(/\./g, '');
  var m = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2,4})$/);
  if (!m) return '';
  var mm = MESES_PT[m[1]];
  var ano = m[2].length === 2 ? '20' + m[2] : m[2];
  return ano + '-' + ('0' + mm).slice(-2);
}

// ════════════════════════════════════════════════════════════════════════════
// SINCRONIZAÇÃO
// ════════════════════════════════════════════════════════════════════════════

function verificarSincronizacao() { executar_(true); }
function sincronizarRendimentos() { executar_(false); }

function executar_(simular) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var rel = [];

  try {
    var realizado = lerRealizadoTotal_();
    var atribuicao = calcularAtribuicao_(realizado);
    var comps = Object.keys(realizado).sort();
    if (!comps.length) throw new Error('Nenhum realizado encontrado na Base.');

    var ultimoRealizado = comps[comps.length - 1];
    rel.push('Competências na Base: ' + comps.length +
             '  (de ' + comps[0] + ' a ' + ultimoRealizado + ')');

    // ── Validação 1: soma dos projetos = valor DISTRIBUÍDO do mês ──────────
    // Não é o líquido do próprio mês: meses de líquido negativo ficam
    // carregados para o mês seguinte (ver ratearMetodoB_, regra 3).
    var erros = [];
    var compsRateados = Object.keys(atribuicao).sort();
    for (var i = 0; i < compsRateados.length; i++) {
      var comp = compsRateados[i];
      var attr = atribuicao[comp] || {};
      var meta = attr.__meta__ || { distribuido: 0, carregado: 0 };
      var soma = 0;
      for (var p in attr) { if (p !== '__meta__') soma += attr[p]; }
      var dif = Math.round((soma - meta.distribuido) * 100) / 100;
      if (Math.abs(dif) > CFG.TOLERANCIA) {
        erros.push(comp + ': soma dos projetos ' + fmt_(soma) +
                   ' ≠ distribuído ' + fmt_(meta.distribuido) +
                   '  (dif ' + fmt_(dif) + ')');
      }
    }
    if (erros.length) {
      throw new Error('Fechamento falhou — gravação bloqueada:\n\n' + erros.join('\n'));
    }
    rel.push('✓ Validação 1: soma dos projetos fecha com o distribuído em todos os meses');

    // ── Monta os registros da base técnica ─────────────────────────────────
    var registros = [];
    for (var c = 0; c < compsRateados.length; c++) {
      var cp = compsRateados[c];
      var at = atribuicao[cp] || {};
      var mt = at.__meta__ || {};
      var totalMes = 0, pj;
      for (pj in at) { if (pj !== '__meta__') totalMes += at[pj]; }
      for (pj in at) {
        if (pj === '__meta__') continue;
        registros.push({
          competencia: cp,
          projeto: pj,
          bruto: realizado[cp].bruto,
          impostos: realizado[cp].impostos,
          liquido: realizado[cp].liquido,
          saldoBase: '',
          participacao: totalMes ? at[pj] / totalMes : 0,
          realizado: at[pj],
          situacao: 'realizado',
          fonte: 'Base de Dados ENAP Financial Dash'
        });
      }
      if (mt.carregado) {
        rel.push('  carregado de mês anterior em ' + cp + ': ' + fmt_(mt.carregado));
      }
      if (mt.residuo) {
        rel.push('  resíduo de centavos em ' + cp + ': ' + fmt_(mt.residuo) +
                 ' em ' + mt.residuoEm);
      }
    }

    if (simular) {
      rel.push('');
      rel.push('SIMULAÇÃO — nada foi gravado.');
      rel.push('Seriam gravados ' + registros.length + ' registros na base técnica.');
      rel.push('');
      rel.push(detalharMes_(ultimoRealizado, realizado, atribuicao));
      ui.alert('Verificação', rel.join('\n'), ui.ButtonSet.OK);
      return;
    }

    // ── Gravação ───────────────────────────────────────────────────────────
    var res = gravarBaseTecnica_(registros);
    rel.push('Base técnica: ' + res.inseridas + ' inseridas, ' + res.atualizadas + ' atualizadas');

    var atualizadasAbas = atualizarAbasVisuais_(realizado, atribuicao, ultimoRealizado);
    rel = rel.concat(atualizadasAbas);

    var prox = proximaCompetencia_(ultimoRealizado);
    gravarParametro_('ultimo_mes_realizado', ultimoRealizado);
    gravarParametro_('primeiro_mes_projetado', prox);
    gravarParametro_('atualizado_em',
      Utilities.formatDate(new Date(), CFG.FUSO, 'yyyy-MM-dd HH:mm:ss'));

    rel.push('Último realizado: ' + ultimoRealizado + '  ·  primeiro projetado: ' + prox);
    log_('SYNC', rel.join(' | '));
    ui.alert('Sincronização concluída', rel.join('\n'), ui.ButtonSet.OK);

  } catch (e) {
    log_('ERRO', e.message);
    SpreadsheetApp.getUi().alert('Sincronização interrompida', e.message,
      SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function detalharMes_(comp, realizado, atribuicao) {
  var linhas = ['Detalhe de ' + comp + ':'];
  linhas.push('  bruto    ' + fmt_(realizado[comp].bruto));
  linhas.push('  impostos ' + fmt_(realizado[comp].impostos));
  linhas.push('  líquido  ' + fmt_(realizado[comp].liquido));
  var at = atribuicao[comp] || {};
  var mt = at.__meta__;
  if (mt && mt.carregado) linhas.push('  carregado ' + fmt_(mt.carregado));
  if (mt) linhas.push('  distribuído ' + fmt_(mt.distribuido));
  for (var p in at) {
    if (p === '__meta__') continue;
    linhas.push('    ' + p + ': ' + fmt_(at[p]));
  }
  return linhas.join('\n');
}

/**
 * Substitui a fórmula projetada pelo realizado nas abas visuais.
 * Não toca em meses futuros — a fórmula de projeção permanece intacta neles.
 */
function atualizarAbasVisuais_(realizado, atribuicao, ultimoRealizado) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var msgs = [];
  var abas = ss.getSheets();
  var porNome = {};
  for (var i = 0; i < abas.length; i++) porNome[normalizar_(abas[i].getName())] = abas[i];

  for (var chave in CFG.ABAS_PROJETO) {
    var sh = porNome[normalizar_(chave)];
    if (!sh) { msgs.push('⚠ aba não encontrada: ' + chave); continue; }

    var projeto = CFG.ABAS_PROJETO[chave];
    var mapa;
    try { mapa = mapearAba_(sh); }
    catch (e) { msgs.push('⚠ ' + chave + ': ' + e.message); continue; }

    var gravados = 0;
    for (var comp in realizado) {
      if (comp > ultimoRealizado) continue;          // futuro: mantém projeção
      var col = mapa.colunas[comp];
      if (!col) continue;                             // mês fora do horizonte da aba
      var attr = atribuicao[comp] || {};
      var valor = attr[projeto];
      if (valor === undefined) continue;
      sh.getRange(mapa.linha, col).setValue(valor);
      gravados++;
    }
    msgs.push('✓ ' + chave + ': ' + gravados + ' meses gravados como realizado');
  }

  // Consolidado: total líquido do mês.
  var shCons = porNome[normalizar_(CFG.ABA_CONSOLIDADO)];
  if (shCons) {
    try {
      var mc = mapearAba_(shCons);
      var n = 0;
      for (var cp in realizado) {
        if (cp > ultimoRealizado) continue;
        var cc = mc.colunas[cp];
        if (!cc) continue;
        shCons.getRange(mc.linha, cc).setValue(realizado[cp].liquido);
        n++;
      }
      msgs.push('✓ consolidado: ' + n + ' meses gravados');
    } catch (e) {
      msgs.push('⚠ consolidado: ' + e.message);
    }
  } else {
    msgs.push('⚠ aba consolidado não encontrada');
  }
  return msgs;
}

function proximaCompetencia_(comp) {
  var a = parseInt(comp.substring(0, 4), 10);
  var m = parseInt(comp.substring(5, 7), 10);
  m++; if (m > 12) { m = 1; a++; }
  return a + '-' + ('0' + m).slice(-2);
}

function fmt_(v) {
  return 'R$ ' + Utilities.formatString('%.2f', v)
    .replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '');
}

// ════════════════════════════════════════════════════════════════════════════
// OFÍCIO Nº 04/2026 — AUTORIZAÇÃO E PRIMEIRA UTILIZAÇÃO
// ════════════════════════════════════════════════════════════════════════════

var OFICIO = {
  id: 'OFICIO_04_2026_PLATAFORMA_DESAFIOS',
  documento: 'Ofício nº 04/2026',
  destinacao: 'atualização evolutiva da Plataforma Desafios',
  competencia: '2026-07',
  autorizacoes: [
    { projeto: 'Operação Básica', valor: 37476.59 },
    { projeto: 'Co.NE',           valor: 26200.66 },
    { projeto: 'CAR DPG',         valor: 72847.81 },
    { projeto: 'Parceria MDIC',   valor: 13477.05 }
  ],
  utilizacoes: [
    { data: '2026-09-11', competencia: '2026-09', valor: 21600.00,
      numeroPagamento: '10647074', categoria: '3.1.1 Serviço de Plataforma',
      fornecedor: 'GSGUMIER INFORMATICA LTDA', projeto: 'Operação Básica' }
  ]
};

/**
 * Registra autorização e utilização de forma idempotente: a chave é o
 * id_movimentacao, então rodar duas vezes não duplica linha.
 */
function registrarAutorizacaoOficio04() {
  var ui = SpreadsheetApp.getUi();
  try {
    var sh = obterOuCriarAba_(CFG.ABA_MOVIMENTACAO, COLS_MOV, false);
    var ultima = sh.getLastRow();
    var existentes = {};
    if (ultima > 1) {
      var ids = sh.getRange(2, 1, ultima - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) existentes[String(ids[i][0])] = i + 2;
    }

    var agora = Utilities.formatDate(new Date(), CFG.FUSO, 'yyyy-MM-dd HH:mm:ss');
    var linhas = [], somaAut = 0, somaUso = 0, a, id, linha;

    for (var j = 0; j < OFICIO.autorizacoes.length; j++) {
      a = OFICIO.autorizacoes[j];
      somaAut += a.valor;
      id = OFICIO.id + '|AUT|' + normalizar_(a.projeto).replace(/\s/g, '_');
      linha = [id, OFICIO.competencia + '-31', OFICIO.competencia, 'autorização',
               OFICIO.documento, a.projeto, a.valor, '', '', '',
               OFICIO.destinacao,
               'Autorização não é saída financeira: reclassifica saldo disponível para carteira autorizada.',
               agora];
      if (existentes[id]) sh.getRange(existentes[id], 1, 1, COLS_MOV.length).setValues([linha]);
      else linhas.push(linha);
    }

    for (var k = 0; k < OFICIO.utilizacoes.length; k++) {
      var u = OFICIO.utilizacoes[k];
      somaUso += u.valor;
      id = OFICIO.id + '|USO|' + u.numeroPagamento;
      linha = [id, u.data, u.competencia, 'utilização da autorização',
               OFICIO.documento, u.projeto, u.valor, u.numeroPagamento,
               u.categoria, u.fornecedor, OFICIO.destinacao,
               'Saída financeira real já lançada na Base (aba Principal). Aqui só o vínculo com a autorização — não lançar de novo no fluxo.',
               agora];
      if (existentes[id]) sh.getRange(existentes[id], 1, 1, COLS_MOV.length).setValues([linha]);
      else linhas.push(linha);
    }

    if (linhas.length) {
      sh.getRange(sh.getLastRow() + 1, 1, linhas.length, COLS_MOV.length).setValues(linhas);
    }

    // ── Validações 5 a 9 da Parte 11 ───────────────────────────────────────
    var AUT_ESPERADO = 150002.11, USO_ESPERADO = 21600.00;
    var checks = [];
    checks.push(verif_('Autorizado = soma por projeto', somaAut, AUT_ESPERADO));
    checks.push(verif_('Utilizado = soma dos pagamentos', somaUso, USO_ESPERADO));
    checks.push(verif_('Saldo pendente', somaAut - somaUso, 128402.11));
    checks.push(verif_('Livre/preservado', 602168.78 - somaAut, 452166.67));
    checks.push(verif_('Saldo financeiro remanescente',
                       (602168.78 - somaAut) + (somaAut - somaUso), 580568.78));
    checks.push(verif_('Utilizado total', 230075.62 + somaUso, 251675.62));
    checks.push(verif_('Saldo líquido total gerado',
                       ((602168.78 - somaAut) + (somaAut - somaUso)) + 230075.62 + somaUso,
                       832244.40));

    var falhas = checks.filter(function (c) { return !c.ok; });
    var txt = checks.map(function (c) {
      return (c.ok ? '✓ ' : '✗ ') + c.nome + ': ' + fmt_(c.obtido) +
             (c.ok ? '' : '  (esperado ' + fmt_(c.esperado) + ')');
    }).join('\n');

    log_('OFICIO', 'Registrado. ' + linhas.length + ' novas linhas. Falhas: ' + falhas.length);
    ui.alert(falhas.length ? 'Registrado COM DIVERGÊNCIA' : 'Ofício registrado',
             txt + '\n\n' + linhas.length + ' linha(s) inserida(s).', ui.ButtonSet.OK);

  } catch (e) {
    log_('ERRO', e.message);
    ui.alert('Falha ao registrar', e.message, ui.ButtonSet.OK);
  }
}

function verif_(nome, obtido, esperado) {
  return { nome: nome, obtido: obtido, esperado: esperado,
           ok: Math.abs(obtido - esperado) <= CFG.TOLERANCIA };
}
