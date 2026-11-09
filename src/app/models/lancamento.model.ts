export interface Lancamento {
  categoria: string;
  observacao: string;
  projeto: string;
  mesAno: string;
  valor: number;
  numPag: string;
  fornecedor?: string;
}

export interface Recebimento {
  tipoRecurso: string;
  data: string;
  valor: number;
  status: string; // "recebido" | "previsto"
  fornecedor: string;
  categoria: string;
  observacao: string;
  projeto: string;
  mesAno: string;
  observacao2: string; // "inflação" ou vazio
}

export interface ProjetoResumo {
  projeto: string;
  /**
   * Tudo que o projeto tem para gastar: recurso do Termo MAIS rendimentos
   * destinados a ele. É o denominador da execução.
   *
   * Contar só o recurso do Termo punha a Plataforma Desafio 3.0 em 108% e a
   * Operação Básica em 105,8%: as duas pagaram despesas com rendimentos
   * destinados (R$ 150.002,11 e R$ 230.075,62, bloco J:L da aba Rendimentos),
   * que apareciam no numerador e não no denominador.
   */
  entradas: number;
  /** Parcela de `entradas` vinda do Termo — aba de lançamentos. */
  recursoTermo: number;
  /** Parcela de `entradas` vinda da destinação de rendimentos — bloco J:L. */
  rendimentosDestinados: number;
  saidas: number;
  saldo: number;
  execucao: number;
  saldoRemanescente?: number;
  status?: string; // Ativo, Em encerramento, Finalizado
}

export interface StatusProjeto {
  projeto: string;
  status: string;
}

export interface CategoriaResumo {
  categoria: string;
  total: number;
}

export interface FluxoMensal {
  mesAno: string;
  entradas: number;
  saidas: number;
  saldoAcumulado: number;
}

export interface RecursoResumo {
  tipo: string;
  total: number;
  percentual: number;
}

export interface RecursoDetalhado {
  aporteRecebido: number;        // Aporte recebido SEM inflação
  aporteInflacao: number;         // Valor da inflação recebida
  aporteRecebidoTotal: number;    // Aporte recebido + inflação
  aportePrevisto: number;         // Aporte previsto futuro
  /**
   * Aporte + correção pelo IPCA. Decisão de 13/09/2026: a correção integra o
   * total financeiro recebido da Enap (houve entrada do recurso), mas NÃO conta
   * como parcela da meta original de aporte — por isso fica em campo próprio.
   */
  totalRecebidoEnap: number;
  captacaoRecebida: number;
  captacaoPrevista: number;
  captacaoTotal: number;
  saldoACaptar: number;           // Valor que falta para atingir a meta de captação
  totalRecebido: number;
  totalComPrevisto: number;
}

export interface SaldoRemanescente {
  data: string;
  parceiro: string;
  projeto: string;
  valorTransferido: number;
  valorProjeto: number;
  percentualSobra: number;
}

/**
 * Um acontecimento na vida financeira dos recursos, para a linha do tempo única.
 *
 * Antes, cada tipo de evento morava na tela onde por acaso tinha sido
 * implementado: a destinação de R$ 150.002,11 num bloco da Visão por Projeto, os
 * R$ 230.075,62 num parágrafo de Rendimentos, as transferências numa página só
 * delas e as pendências de conciliação numa terceira. Quem precisava responder
 * "o que aconteceu com o dinheiro" tinha de visitar quatro telas e juntar na
 * cabeça. Aqui eles são o mesmo tipo de coisa, ordenados por data.
 */
export type TipoEventoHistorico =
  | "destinacao"      // rendimentos destinados a um projeto
  | "transferencia"   // saldo remanescente devolvido ao fundo
  | "encerramento"    // projeto encerrado
  | "pendencia";      // divergência em aberto, aguardando apuração

export interface EventoHistorico {
  tipo: TipoEventoHistorico;
  /** "31/05/2025" quando há dia; "08/2025" quando só a competência; "2026" quando só o ano. */
  data: string;
  /** Ordenação estável: AAAAMMDD, com 00 no que não se conhece. */
  ordem: number;
  titulo: string;
  projeto: string;
  valor: number;
  /** De onde veio o número, em texto — o evento tem de ser conferível. */
  fonte: string;
  detalhe?: string;
  /** Pendência em aberto: fica à vista até a causa ser apurada. */
  emAberto?: boolean;
}

export interface Rendimento {
  categoria: string;
  data: string;
  mesAno: string;  // derivado de data
  valor: number;
  /**
   * Resquício do layout anterior da aba, que trazia uma coluna classificatória
   * "utilização". Hoje as utilizações vivem no bloco J:L, em
   * `UtilizacaoRendimento`. Mantido vazio para não quebrar leitores antigos.
   */
  utilizacao: string;
}

/**
 * Utilização ou destinação de rendimentos — bloco J:L da aba "Rendimentos".
 *
 * A planilha registra só o ano; `competencia` é recuperada dos registros
 * existentes (ver DataService.competenciasDasUtilizacoes) e fica nula quando
 * não há como recuperá-la sem inventar mês.
 */
export interface UtilizacaoRendimento {
  ano: number;
  valor: number;
  /** Nome normalizado — a Base grafa "Operação Báisca". */
  projeto: string;
  /** Grafia original da planilha, preservada para auditoria. */
  projetoOriginal: string;
  /** "08/2025" quando recuperável; `null` quando só o ano é conhecido. */
  competencia: string | null;
  origemCompetencia?: string;
}

/**
 * Item oficial do Glossário de Categorias Orçamentárias.
 * Fonte única: aba "Glossário de Categorias" da Base de Dados ENAP Financial Dash.
 */
export interface CategoriaGlossario {
  codigo: string;      // "1.2.2"
  nome: string;        // "Serviços de especialistas" (grafia oficial, sem o código)
  rotulo: string;      // "1.2.2 Serviços de especialistas"
  meta: string;        // "1" | "2" | "3" | "4"
  etapa: string;
  descricao: string;
}

/**
 * Resultado da normalização de uma categoria bruta da base contra o Glossário.
 * A base nunca é alterada — `original` preserva o texto como foi lançado.
 */
export interface CategoriaNormalizada {
  original: string;               // texto exatamente como está na planilha
  codigo: string;                 // código extraído ("1.1.9")
  oficial: CategoriaGlossario | null;
  rotulo: string;                 // nome oficial quando houver; senão o original
  natureza: 'despesa' | 'receita';
  mapeado: boolean;
  /** Preenchido quando o lançamento foi remapeado para outro código (ex.: Tarifas → 1.1.8). */
  observacaoAuditoria?: string;
}

// ── Evento institucional: destinação de rendimentos ──────────────────────────
// Espelha public/oficio-04-2026.json, gerado da aba "Movimentações de
// Rendimentos" da planilha oficial por `node sync/exportar-oficio.js`.

export interface MovimentacaoRendimento {
  id: string;
  dataBase: string;
  dataEfetiva: string;
  competencia: string;          // "2026-08"
  tipo: string;                 // transferência interna | destinação própria | utilização da carteira
  documento: string;            // "Ofício nº 04/2026"
  origem: string;
  destino: string;
  valor: number;
  numeroPagamento: string | null;
  categoria: string | null;
  fornecedor: string | null;
  finalidade: string;
  observacao: string;
  status: string;               // vigente | cancelada
}

/**
 * Linha da fotografia documental de um ofício, por projeto.
 *
 * É um checkpoint, não movimento: não é receita, transferência adicional nem
 * rendimento novo. Os rendimentos posteriores à data-base continuam a ser
 * somados normalmente por cima dela.
 */
export interface ProjetoFotografia {
  projeto: string;
  /** Acumulado até a data-base, como consta no documento enviado à ENAP. */
  acumuladoDocumental: number;
  /**
   * Abertura da série realizada — acumulado até a competência anterior ao
   * primeiro mês que o Rateio • Realizado cobre.
   *
   * É documental e por projeto. O motor não pode mexer nela: a série oficial
   * começa aqui e só então soma mês a mês.
   */
  acumuladoAbertura: number;
  /** Série mensal preservada, quando a memória a registra. mesAno → valor. */
  serieMensal: Map<string, number>;
  /** Saldo livre registrado na memória, quando houver — só conferência. */
  saldoLivreRegistrado: number | null;
  /** Caixa do projeto na data registrada na memória, quando houver. */
  caixaRegistrado: number | null;
}

/**
 * Fotografia documental de um ofício — a série congelada, lida da planilha.
 *
 * A Base muda depois que o ofício é emitido: regularizações de saldo, novos
 * lançamentos, correções de data. Recalcular o acumulado da data-base sobre a
 * Base de hoje faz o número do documento mudar junto, e o que foi enviado à
 * ENAP deixa de ser reproduzível. Por isso o checkpoint é lido, não calculado.
 */
export interface FotografiaDocumental {
  /** "Ofício nº 04/2026" */
  oficio: string;
  /** "31/07/2026" */
  dataBase: string;
  /** "2026-08" — a competência a partir da qual o ofício produz efeito. */
  competenciaEfeito: string;
  /** projeto → linha documental. */
  projetos: Map<string, ProjetoFotografia>;
  /** Soma dos acumulados documentais — o checkpoint do ofício. */
  total: number;
  /** "12/2025" — competência da abertura documental da série realizada. */
  competenciaAbertura: string;
  /** Falhas de leitura, para a página dizer o que não conseguiu ler. */
  avisos: string[];
}

/** Uma linha do Rateio • Realizado: um projeto numa competência. */
export interface LinhaRealizada {
  competencia: string;          // "01/2026"
  projeto: string;
  caixaAbertura: number;
  participacao: number;         // fração do líquido, 0..1
  liquidoBancario: number;
  rendimentoAtribuido: number;
  saldoLivre: number;
  caixaFechamento: number;
  situacao: string;
}

/**
 * Distribuição realizada por projeto, lida da aba "Rateio • Realizado".
 *
 * A aba se declara "fonte única para as abas e o dashboard", e é mesmo: ela
 * pondera pela caixa na abertura de cada projeto, que não é a mesma grandeza
 * que o saldo interno reconstruído dos lançamentos. Rodar o motor por cima
 * destes meses dava outra repartição — mesmo total, projetos diferentes.
 *
 * Só meses fechados entram. Os meses em projeção aparecem zerados na aba, e
 * zero não é previsão.
 */
export interface SerieRealizada {
  /** competência "MM/AAAA" → projeto → linha. Apenas meses fechados. */
  porCompetencia: Map<string, Map<string, LinhaRealizada>>;
  /** Competências fechadas, em ordem cronológica. */
  competencias: string[];
  /** Projetos presentes na série. */
  projetos: string[];
  /** Último mês fechado, de "Controle • Integrações!B4". */
  corte: string;                // "10/2026"
  avisos: string[];
}

/** A série oficial de um projeto: abertura documental mais meses fechados. */
export interface SerieOficialProjeto {
  projeto: string;
  /** Acumulado documental na abertura (até 12/2025). */
  abertura: number;
  meses: { mesAno: string; rendimento: number; acumulado: number; participacao: number }[];
  /** Abertura mais todos os meses fechados. */
  acumulado: number;
  /** Acumulado menos o destinado por ofício. */
  saldoLivre: number;
  /** Saldo livre como a própria aba o registra, para conferência. */
  saldoLivreRegistrado: number | null;
}

export interface ProjetoOficio {
  projeto: string;
  /**
   * Acumulado até a data-base. Vem da fotografia documental quando ela existe
   * para este ofício; só cai no recálculo sobre a Base quando não existe, e
   * nesse caso um aviso acompanha o número.
   */
  historicoAteDataBase: number;
  /**
   * O mesmo acumulado recalculado sobre a Base de hoje, para auditoria.
   *
   * Fica separado de propósito: é ele que mostra o quanto a Base andou desde a
   * emissão do ofício, e essa diferença é informação, não erro a ser escondido.
   */
  historicoRecalculado: number;
  /** `historicoRecalculado - historicoAteDataBase`, zero quando não há deriva. */
  derivaDocumental: number;
  /** Se o acumulado veio da memória documental ou de recálculo. */
  origemHistorico: 'fotografia documental' | 'recálculo sobre a Base';
  destinado: number;              // cedido + destinação própria
  transferidoCedido: number;
  transferidoRecebido: number;
  destinacaoPropria: number;
  saldoLivreAposOficio: number;   // logo após o corte
  novosRendimentos: number;       // gerados a partir da competência de efeito
  saldoLivreAtual: number;
  carteiraSobGestao: number;
  utilizado: number;
  carteiraDisponivel: number;
  participa: boolean;
}

export interface OficioRendimentos {
  documento: string;
  finalidade: string;
  projetoExecutor: string;
  dataBase: string;               // "31/07/2026"
  competenciaEfeito: string;      // "2026-08"
  checkpointDataBase: number;
  totalDestinado: number;
  transferidoDeOutrosProjetos: number;
  rendimentoProprioDestinado: number;
  utilizado: number;
  disponivel: number;
  saldoLivreTotal: number;
  projetos: ProjetoOficio[];
  movimentacoes: MovimentacaoRendimento[];
  /** A memória documental usada, quando encontrada para este ofício. */
  fotografia: FotografiaDocumental | null;
  /** Leitura da memória e divergências entre documento e recálculo. */
  avisosDocumentais: string[];
  geradoEm: string;
}

export interface TransferenciaRendimento {
  mesAno: string;                 // "08/2026"
  projeto: string;
  valor: number;                  // negativo no cedente, positivo no destinatário
  documento: string;
}
