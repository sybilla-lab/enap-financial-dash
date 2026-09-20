/**
 * Sincronização de rendimentos — Base de Dados ENAP Financial Dash → Planilha de Orçamento
 * ────────────────────────────────────────────────────────────────────────────────────────
 * Instalar NA PLANILHA DE ORÇAMENTO (Extensões → Apps Script).
 *
 * DIREÇÃO ÚNICA DO FLUXO — não há ciclo:
 *
 *    Base (CSV publicado, somente leitura)  ──►  realizado  ──►  Orçamento
 *    Orçamento  ──►  projeções recalculadas  ──►  Dashboard (lê o CSV do orçamento)
 *
 * O script nunca escreve na Base, e nunca lê do Orçamento um valor que ele próprio
 * gravou como realizado: o realizado vem sempre da Base.
 *
 * Execução: menu "Rendimentos ENAP" → Sincronizar. Idempotente — pode rodar quantas
 * vezes quiser sem duplicar linha nem sobrescrever mês já fechado.
 */

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ════════════════════════════════════════════════════════════════════════════

var CFG = {
  // CSV publicado da Base de Dados ENAP Financial Dash (somente leitura).
  BASE_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTcM2aU8ucv35H649ATmgyUMR6S7pvkVaxPQSwN0p-Hs9DsvAIG5Mm-4PutXobweeZ0vp21mklhYqBM/pub?output=csv',
  GID_RENDIMENTOS: '2032068393',
  GID_PRINCIPAL:   '0',
  GID_SALDOS:      '86178020',      // "Saldos remanescentes" → data de encerramento
  GID_STATUS:      '1699326950',    // "Status Projetos"      → finalizado/encerrado

  // Abas de projeto no Orçamento → nome do projeto na Base.
  // A chave é o nome da aba; a comparação ignora caixa e acento.
  ABAS_PROJETO: {
    'operação básica • enap':          'Operação Básica',
    'co.ne • bid':                     'Co.NE',
    'parceria • mdic':                 'Parceria MDIC',
    'alimenta +1.000 cidades • mds':   'Alimenta +1000 Cidades',
    'car dpg • fbds':                  'CAR DPG'
  },
  ABA_CONSOLIDADO: 'consolidado • 2026 a 2028',

  ABA_TECNICA:      'Base Rendimentos Dash',
  ABA_MOVIMENTACAO: 'Movimentações de Rendimentos',
  ABA_PARAMETROS:   'Parâmetros Rendimentos',
  ABA_LOG:          'Log Sincronização',

  ROTULO_LINHA: 'rendimentos',   // rótulo da linha a atualizar nas abas visuais
  TOLERANCIA:   0.02,            // diferença acima disso bloqueia a gravação
  FUSO:         'America/Sao_Paulo',
  VERSAO:       '1.0.0'
};

// ════════════════════════════════════════════════════════════════════════════
// MENU
// ════════════════════════════════════════════════════════════════════════════

/**
 * A sincronização ampla de realizado está DESATIVADA no menu.
 *
 * O motivo não é o algoritmo — calcularAtribuicao_() já reproduz o método B.
 * É que a rotina reescrevia, de uma vez e sem confirmação, todos os meses de
 * todas as abas, inclusive meses históricos já fechados e conferidos contra o
 * Ofício nº 04/2026. Um clique errado desfaz a conciliação inteira.
 *
 * Para reativar, a rotina precisa antes ter:
 *   · seleção explícita da competência a gravar;
 *   · modo de simulação que mostre antes/depois célula a célula;
 *   · confirmação do usuário antes de escrever;
 *   · bloqueio de regravação de meses já marcados como fechados;
 *   · checkpoint do Ofício nº 04/2026 como porta de entrada;
 *   · validação de que o total por projeto fecha com a Base.
 *
 * Enquanto isso, a gravação controlada sai de sync/sincronizar.js, que já tem
 * todas essas travas. Ver sync/README.md.
 */
var SINCRONIZACAO_ATIVA = false;

function onOpen() {
  var menu = SpreadsheetApp.getUi().createMenu('Rendimentos ENAP');

  if (SINCRONIZACAO_ATIVA) {
    menu.addItem('1. Verificar (simulação, não grava)', 'verificarSincronizacao')
        .addItem('2. Sincronizar realizado', 'sincronizarRendimentos');
  } else {
    menu.addItem('⚠ Sincronização de realizado desativada — usar rotina controlada',
                 'avisoSincronizacaoDesativada');
  }

  menu.addSeparator()
      .addItem('Criar/atualizar abas técnicas', 'prepararAbasTecnicas')
      .addItem('Registrar Ofício nº 04/2026', 'registrarAutorizacaoOficio04')
      .addItem('Corrigir fuso horário', 'corrigirFuso')
      .addToUi();
}

function avisoSincronizacaoDesativada() {
  SpreadsheetApp.getUi().alert(
    'Sincronização de realizado desativada',
    'A rotina que recalcula e reescreve o rateio mensal está temporariamente ' +
    'desativada neste menu.\n\n' +
    'Ela reescrevia todos os meses de todas as abas de uma vez, sem seleção de ' +
    'competência nem confirmação — o que apagaria a conciliação de jan/2026 a ' +
    'ago/2026 já validada contra o Ofício nº 04/2026.\n\n' +
    'Use a rotina controlada:\n' +
    '   node sync/checkpoint-oficio.js     valida antes de qualquer gravação\n' +
    '   node sync/sincronizar.js           simula\n' +
    '   node sync/sincronizar.js --write   grava\n' +
    '   node sync/conferir.js              confere depois\n\n' +
    'O registro do Ofício e a manutenção das abas técnicas seguem disponíveis ' +
    'neste menu.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function corrigirFuso() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var antes = ss.getSpreadsheetTimeZone();
  ss.setSpreadsheetTimeZone(CFG.FUSO);
  var msg = 'Fuso alterado de ' + antes + ' para ' + CFG.FUSO + '.';
  log_('FUSO', msg);
  SpreadsheetApp.getUi().alert(msg +
    '\n\nA competência mensal passa a ser calculada no horário de Brasília.');
}

// ════════════════════════════════════════════════════════════════════════════
// LEITURA DA BASE  (somente leitura — nunca escreve)
// ════════════════════════════════════════════════════════════════════════════

/** Parser de CSV que respeita aspas e quebras de linha dentro do campo. */
function parseCSV_(txt) {
  return Utilities.parseCsv(txt);
}

function buscarBase_(gid) {
  var url = CFG.BASE_CSV + '&gid=' + gid;
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Falha ao ler a Base (gid ' + gid + '): HTTP ' + resp.getResponseCode());
  }
  return parseCSV_(resp.getContentText());
}

function num_(s) {
  if (typeof s === 'number') return s;
  s = String(s == null ? '' : s).replace(/"/g, '').trim();
  if (!s) return 0;
  var neg = s.charAt(0) === '(' && s.charAt(s.length - 1) === ')';
  if (neg) s = s.substring(1, s.length - 1);
  var v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  if (isNaN(v)) return 0;
  return neg ? -v : v;
}

/** "31/08/2026" ou "08/2026" → "2026-08" */
function competencia_(data) {
  var s = String(data || '').trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2);
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return m[2] + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function normalizar_(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/**
 * Rendimento realizado por competência, direto da aba Rendimentos da Base.
 * Retorna { '2026-08': { bruto, impostos, liquido, utilizacao } }
 *
 * `utilizacao` vem da coluna D e separa o período já utilizado do disponível.
 * O primeiro registro positivo de cada competência define a marca do mês,
 * igual ao dashboard.
 */
function lerRealizadoTotal_() {
  var rows = buscarBase_(CFG.GID_RENDIMENTOS);
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || r.length < 3) continue;
    var comp = competencia_(r[1]);
    if (!comp) continue;
    var v = num_(r[2]);
    if (!out[comp]) out[comp] = { bruto: 0, impostos: 0, liquido: 0, utilizacao: '' };
    if (v > 0) {
      out[comp].bruto += v;
      if (!out[comp].utilizacao) out[comp].utilizacao = String(r[3] || '').trim();
    } else {
      out[comp].impostos += v;
    }
    out[comp].liquido += v;
  }
  return out;
}

/**
 * Competência de encerramento de cada projeto, da aba "Saldos remanescentes".
 * Retorna { 'Datathon': '2025-05', ... }. A partir do mês SEGUINTE, o saldo do
 * projeto é zerado e transferido para Operação Básica.
 */
function lerEncerrados_() {
  var rows = buscarBase_(CFG.GID_SALDOS);
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || r.length < 5) continue;
    var proj = String(r[2] || '').trim();
    var comp = competencia_(r[0]);
    if (proj && comp) out[proj] = comp;
  }
  return out;
}

/** Projetos marcados finalizado/encerrado na aba "Status Projetos". */
function lerInativos_() {
  var rows = buscarBase_(CFG.GID_STATUS);
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || r.length < 2) continue;
    var proj = String(r[0] || '').trim();
    var st = normalizar_(String(r[1] || '').replace(/[^\w\sÀ-ÿ.+]/g, ''));
    if (proj && (st === 'finalizado' || st === 'encerrado')) out[proj] = true;
  }
  return out;
}

/**
 * Saldo de cada projeto ao fim de cada competência, a partir da aba Principal.
 * É a base do rateio proporcional — mesma metodologia do dashboard.
 */
function lerSaldosPorProjeto_() {
  var rows = buscarBase_(CFG.GID_PRINCIPAL);
  var lanc = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || r.length < 13) continue;
    var proj = String(r[10] || '').trim();
    if (!proj) continue;
    var mes = String(r[11] || '').trim();
    var comp = competencia_(mes);
    if (!comp) continue;
    var v = num_(r[12] !== '' ? r[12] : r[4]);
    lanc.push({ comp: comp, projeto: proj, valor: v });
  }
  lanc.sort(function (a, b) { return a.comp < b.comp ? -1 : a.comp > b.comp ? 1 : 0; });
  return lanc;
}

var OPERACAO_BASICA = 'Operação Básica';
var cent_ = function (v) { return Math.round(v * 100) / 100; };

/**
 * MÉTODO B — o rateio oficial. Réplica de computarHistoricoPorProjeto() do
 * dashboard, validada contra o Ofício nº 04/2026 com diferença zero.
 *
 * Função pura de propósito: não lê planilha nem rede, só recebe dados e
 * devolve o rateio. É assim que ela pode ser testada fora do Apps Script
 * (ver sync/testar-apps-script.js).
 *
 * Quatro regras, todas necessárias — faltando qualquer uma o resultado diverge:
 *
 *  1. SALDO DO PRÓPRIO MÊS. Os lançamentos entram até o fim do mês corrente
 *     (`<=`), não até o mês anterior: o rendimento é apurado no último dia do
 *     mês, sobre o saldo que existe naquele dia.
 *
 *  2. PROJETOS ENCERRADOS. A partir do mês seguinte ao encerramento, o saldo
 *     positivo do projeto é transferido para Operação Básica e o projeto é
 *     zerado. Sem isso, Operação Básica fica subestimada — foi o que fez
 *     julho/2026 ser preenchido errado.
 *
 *  3. CARREGAMENTO DE MÊS NEGATIVO. Mês de líquido negativo não é rateado
 *     sobre saldos positivos: fica carregado e entra no próximo mês
 *     distribuível. 11/2025 (−R$ 2.060,93) é o caso real. O fechamento de cada
 *     mês é contra o valor DISTRIBUÍDO, nunca contra o líquido do próprio mês —
 *     senão o carregado entra duas vezes.
 *
 *  4. AJUSTE DE CENTAVOS. O resíduo do arredondamento vai para o projeto de
 *     maior participação daquele mês. Coisa distinta da regra 3.
 *
 * @param {Array}  meses      [{comp, liquido}] do período disponível, ordenado
 * @param {Array}  lanc       [{comp, projeto, valor}] ordenado por comp
 * @param {Object} encerrados { projeto: 'YYYY-MM' }
 * @param {Object} inativos   { projeto: true }
 * @return {Object} comp → { projeto: valor, __meta__: {...} }
 */
function ratearMetodoB_(meses, lanc, encerrados, inativos) {
  var saldo = {};          // projeto → saldo corrente
  var porMes = {};         // comp → { projeto: valor bruto, sem arredondar }
  var idx = 0, carregado = 0;
  var i, p, comp;

  for (i = 0; i < meses.length; i++) {
    comp = meses[i].comp;

    // Regra 1: inclui os lançamentos do próprio mês.
    while (idx < lanc.length && lanc[idx].comp <= comp) {
      saldo[lanc[idx].projeto] = (saldo[lanc[idx].projeto] || 0) + lanc[idx].valor;
      idx++;
    }

    // Regra 2: encerrados vão para Operação Básica a partir do mês seguinte.
    for (p in encerrados) {
      if (comp > encerrados[p]) {
        var bal = saldo[p] || 0;
        if (bal > 0) saldo[OPERACAO_BASICA] = (saldo[OPERACAO_BASICA] || 0) + bal;
        saldo[p] = 0;
      }
    }

    var totalPos = 0;
    for (p in saldo) if (saldo[p] > 0) totalPos += saldo[p];

    // Regra 3: mês negativo não é distribuído, fica carregado.
    var distribuir = meses[i].liquido + carregado;
    porMes[comp] = {};
    if (totalPos > 0 && distribuir > 0) {
      for (p in saldo) {
        if (saldo[p] > 0) porMes[comp][p] = distribuir * (saldo[p] / totalPos);
      }
      carregado = 0;
    } else {
      carregado += meses[i].liquido;
    }
  }

  // Projetos inativos são consolidados em Operação Básica, mês a mês.
  var ultimo = meses.length ? meses[meses.length - 1].comp : '';
  var ehInativo = function (proj) {
    return inativos[proj] === true ||
      (encerrados[proj] !== undefined && ultimo >= encerrados[proj]);
  };
  for (comp in porMes) {
    for (p in porMes[comp]) {
      if (p !== OPERACAO_BASICA && ehInativo(p)) {
        if (porMes[comp][p] > 0) {
          porMes[comp][OPERACAO_BASICA] = (porMes[comp][OPERACAO_BASICA] || 0) + porMes[comp][p];
        }
        delete porMes[comp][p];
      }
    }
  }

  // Regra 4: arredonda e joga o resíduo no maior projeto do mês. O alvo é o
  // valor distribuído — a soma dos brutos —, não o líquido do próprio mês.
  var resultado = {};
  for (i = 0; i < meses.length; i++) {
    comp = meses[i].comp;
    var brutos = porMes[comp] || {};
    var alvo = 0;
    for (p in brutos) alvo += brutos[p];
    alvo = cent_(alvo);

    var attr = {}, soma = 0, maiorProj = '', maiorVal = -1;
    for (p in brutos) {
      var v = cent_(brutos[p]);
      if (v <= 0.005) continue;
      attr[p] = v;
      soma = cent_(soma + v);
      if (v > maiorVal) { maiorVal = v; maiorProj = p; }
    }
    var residuo = cent_(alvo - soma);
    if (residuo !== 0 && maiorProj) attr[maiorProj] = cent_(attr[maiorProj] + residuo);

    attr.__meta__ = {
      liquidoOficial: cent_(meses[i].liquido),
      distribuido: alvo,
      carregado: cent_(alvo - cent_(meses[i].liquido)),
      residuo: residuo,
      residuoEm: residuo !== 0 ? maiorProj : ''
    };
    resultado[comp] = attr;
  }
  return resultado;
}

/**
 * Prepara os dados da Base e chama o método B.
 *
 * Restringe ao período DISPONÍVEL, do primeiro mês não marcado "utilizado" em
 * diante — a mesma janela que o dashboard usa e sobre a qual o Ofício nº 04/2026
 * foi apurado. Os meses já utilizados formam outra série e não são rateados aqui.
 */
function calcularAtribuicao_(realizadoTotal) {
  var lanc = lerSaldosPorProjeto_();
  var encerrados = lerEncerrados_();
  var inativos = lerInativos_();

  var comps = Object.keys(realizadoTotal).sort();
  var ehDisponivel = function (comp) {
    return normalizar_(realizadoTotal[comp].utilizacao) !== 'utilizado';
  };

  var primeiro = '';
  for (var i = 0; i < comps.length; i++) {
    if (ehDisponivel(comps[i])) { primeiro = comps[i]; break; }
  }
  if (!primeiro) throw new Error('Nenhum mês disponível na aba Rendimentos da Base.');

  var meses = [];
  for (i = 0; i < comps.length; i++) {
    if (comps[i] >= primeiro && ehDisponivel(comps[i])) {
      meses.push({ comp: comps[i], liquido: realizadoTotal[comps[i]].liquido });
    }
  }
  return ratearMetodoB_(meses, lanc, encerrados, inativos);
}

// ════════════════════════════════════════════════════════════════════════════
// ABAS TÉCNICAS
// ════════════════════════════════════════════════════════════════════════════

var COLS_TECNICA = ['competencia', 'projeto', 'rendimento_bruto_total', 'impostos_total',
  'rendimento_liquido_total', 'saldo_base_projeto', 'participacao_projeto',
  'rendimento_realizado_projeto', 'situacao', 'fonte', 'atualizado_em'];

var COLS_MOV = ['id_movimentacao', 'data', 'competencia', 'tipo', 'documento',
  'projeto_origem', 'valor', 'numero_pagamento', 'categoria', 'fornecedor',
  'destinacao', 'observacao', 'atualizado_em'];

function obterOuCriarAba_(nome, colunas, ocultar) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.appendRow(colunas);
    sh.getRange(1, 1, 1, colunas.length).setFontWeight('bold').setBackground('#f0f3f7');
    sh.setFrozenRows(1);
    if (ocultar) sh.hideSheet();
    log_('ABA', 'Criada: ' + nome);
    return sh;
  }
  // Valida cabeçalho antes de qualquer escrita (exigência da Parte 3).
  var head = sh.getRange(1, 1, 1, colunas.length).getValues()[0];
  for (var i = 0; i < colunas.length; i++) {
    if (normalizar_(head[i]) !== normalizar_(colunas[i])) {
      throw new Error('Cabeçalho inesperado em "' + nome + '", coluna ' + (i + 1) +
        ': esperado "' + colunas[i] + '", encontrado "' + head[i] + '". ' +
        'Gravação abortada para não corromper a aba.');
    }
  }
  return sh;
}

function prepararAbasTecnicas() {
  obterOuCriarAba_(CFG.ABA_TECNICA, COLS_TECNICA, true);
  obterOuCriarAba_(CFG.ABA_MOVIMENTACAO, COLS_MOV, false);
  criarParametros_();
  SpreadsheetApp.getUi().alert('Abas técnicas prontas.');
}

function criarParametros_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG.ABA_PARAMETROS);
  if (sh) return sh;
  sh = ss.insertSheet(CFG.ABA_PARAMETROS);
  var dados = [
    ['Parâmetro', 'Valor', 'Observação'],
    ['taxa_mensal_projetada', 0.009597, 'Taxa usada na reprojeção. Antes estava repetida em centenas de células.'],
    ['ultimo_mes_realizado', '', 'Preenchido pela sincronização.'],
    ['primeiro_mes_projetado', '', 'Sempre o mês seguinte ao último realizado.'],
    ['criterio_arredondamento', '2 casas; resíduo no projeto de maior participação', ''],
    ['tolerancia_fechamento', CFG.TOLERANCIA, 'Diferença acima disso bloqueia a gravação.'],
    ['versao_metodologia', CFG.VERSAO, ''],
    ['atualizado_em', '', '']
  ];
  sh.getRange(1, 1, dados.length, 3).setValues(dados);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#f0f3f7');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 3);
  log_('ABA', 'Criada: ' + CFG.ABA_PARAMETROS);
  return sh;
}

function lerParametro_(chave) {
  var sh = criarParametros_();
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (normalizar_(v[i][0]) === normalizar_(chave)) return v[i][1];
  }
  return null;
}

function gravarParametro_(chave, valor) {
  var sh = criarParametros_();
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (normalizar_(v[i][0]) === normalizar_(chave)) {
      sh.getRange(i + 1, 2).setValue(valor);
      return;
    }
  }
  sh.appendRow([chave, valor, '']);
}

// ════════════════════════════════════════════════════════════════════════════
// GRAVAÇÃO IDEMPOTENTE NA BASE TÉCNICA
// ════════════════════════════════════════════════════════════════════════════

/**
 * Escreve na aba técnica usando a chave competencia+projeto.
 * Atualiza linha existente, insere a que não existe, nunca duplica e não
 * depende de posição fixa — localiza pela chave.
 */
function gravarBaseTecnica_(registros) {
  var sh = obterOuCriarAba_(CFG.ABA_TECNICA, COLS_TECNICA, true);
  var ultimaLinha = sh.getLastRow();
  var existentes = {};
  if (ultimaLinha > 1) {
    var vals = sh.getRange(2, 1, ultimaLinha - 1, COLS_TECNICA.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      var k = vals[i][0] + '|' + vals[i][1];
      existentes[k] = i + 2;   // número da linha na planilha
    }
  }

  var agora = Utilities.formatDate(new Date(), CFG.FUSO, 'yyyy-MM-dd HH:mm:ss');
  var novas = [], atualizadas = 0;

  for (var j = 0; j < registros.length; j++) {
    var r = registros[j];
    var linha = [r.competencia, r.projeto, r.bruto, r.impostos, r.liquido,
                 r.saldoBase, r.participacao, r.realizado, r.situacao, r.fonte, agora];
    var chave = r.competencia + '|' + r.projeto;
    if (existentes[chave]) {
      sh.getRange(existentes[chave], 1, 1, COLS_TECNICA.length).setValues([linha]);
      atualizadas++;
    } else {
      novas.push(linha);
    }
  }
  if (novas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, novas.length, COLS_TECNICA.length).setValues(novas);
  }
  return { inseridas: novas.length, atualizadas: atualizadas };
}

// ════════════════════════════════════════════════════════════════════════════
// LOG
// ════════════════════════════════════════════════════════════════════════════

function log_(tipo, msg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG.ABA_LOG);
  if (!sh) {
    sh = ss.insertSheet(CFG.ABA_LOG);
    sh.appendRow(['data_hora', 'tipo', 'mensagem']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#f0f3f7');
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  sh.appendRow([Utilities.formatDate(new Date(), CFG.FUSO, 'yyyy-MM-dd HH:mm:ss'), tipo, msg]);
}
