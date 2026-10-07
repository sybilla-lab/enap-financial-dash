/**
 * Rateio proporcional dos rendimentos por projeto — implementação única.
 *
 * O cálculo é o que já estava na página de Rendimentos e foi validado contra a
 * planilha oficial (método B). Nada aqui foi reescrito: o corpo é o mesmo, só
 * saiu do componente para poder ser chamado também pelo DataService, que
 * precisa da mesma série para apurar o evento institucional. Duas cópias do
 * rateio seriam duas respostas possíveis para a mesma pergunta.
 *
 * Metodologia: para cada mês com rendimento, o saldo de cada projeto na
 * ABERTURA do mês (acumulado até o mês anterior) é a base de participação.
 * O líquido do mês é distribuído proporcionalmente aos saldos positivos. Mês
 * sem base positiva não distribui: o líquido é carregado para o mês seguinte.
 */

/**
 * Projetos que mantêm capital aplicado mas não recebem atribuição de rendimento.
 *
 * Regra institucional, não derivável dos lançamentos: o saldo da Plataforma
 * Desafio 3.0 é a destinação de R$ 150.002,11, que já É rendimento. Atribuir-lhe
 * rendimento outra vez seria render sobre o próprio rendimento e devolvê-lo a
 * quem o recebeu. O capital segue aplicado e segue compondo o capital da
 * parceria; o rendimento que ele ajuda a gerar é repartido entre os demais
 * projetos pelo critério proporcional validado.
 *
 * As despesas da Plataforma consomem o saldo destinado — isso é tratado na base
 * de execução (ver `getProjetoResumos`), não aqui.
 */
export const PROJETOS_SEM_ATRIBUICAO_RENDIMENTOS = new Set<string>([
  'Plataforma Desafio 3.0',
]);

export const mesKey = (s: string): number => {
  const [m, y] = s.split('/');
  return parseInt(y) * 100 + parseInt(m);
};

/** "2026-08" → 202608, para comparar com mesKey("08/2026"). */
export const competenciaKey = (competencia: string): number => {
  const [y, m] = competencia.split('-');
  return parseInt(y) * 100 + parseInt(m);
};

const cent = (v: number) => Math.round(v * 100) / 100;

export interface MesRendimento {
  mesAno: string;
  bruto: number;
  imposto: number;
  liquido: number;
  /** Só apresentação — o rateio distribui sobre `liquido`. */
  acumulado?: number;
}

export interface LancamentoRateio {
  projeto: string;
  mesAno: string;
  valor: number;
}

export interface EntradaRateio {
  /** Meses de rendimento da Base, já consolidados. */
  porMes: MesRendimento[];
  /** Lançamentos da Base MAIS as transferências internas do evento institucional. */
  lancamentos: LancamentoRateio[];
  /** mesAno → "utilizado" | "não utilizado". */
  utilizacaoPorMes: Map<string, string>;
  /** projeto → mesKey do encerramento. */
  projetosEncerrados: Map<string, number>;
  /** Projetos marcados como finalizados/encerrados na aba Status. */
  projetosInativos: Set<string>;
  /**
   * Projetos que mantêm capital aplicado mas NÃO recebem atribuição de
   * rendimento.
   *
   * É o caso da Plataforma Desafio 3.0: o saldo dela é a destinação de
   * R$ 150.002,11, que já é rendimento. Atribuir-lhe rendimento de novo seria
   * render sobre o próprio rendimento e devolvê-lo a quem o recebeu. O capital
   * continua aplicado e continua compondo o capital da parceria; o rendimento
   * que ele gera é repartido entre os demais projetos pelo critério
   * proporcional validado.
   */
  projetosSemAtribuicao?: Set<string>;
}

export interface ResultadoRateio {
  /** Meses efetivamente rateados (do primeiro disponível em diante). */
  meses: MesRendimento[];
  /** projeto → mesAno → rendimento do mês. */
  porProjetoMes: Map<string, Map<string, number>>;
  /** projeto → acumulado no período, já com o resíduo de arredondamento. */
  acumulado: Map<string, number>;
  /** Soma dos líquidos dos meses rateados — o total que o acumulado tem de fechar. */
  totalEsperado: number;
}

/**
 * Distribui o resíduo de arredondamento no projeto de maior rendimento.
 *
 * Arredondar projeto a projeto quase nunca fecha exatamente contra o líquido do
 * período. O centavo que sobra vai para o maior — é o de menor impacto relativo
 * e mantém a soma dos projetos idêntica ao total da Base.
 */
function fecharResiduo(valores: Map<string, number>, totalEsperado: number): void {
  valores.forEach((v, p) => valores.set(p, cent(v)));
  const soma = cent(Array.from(valores.values()).reduce((s, v) => s + v, 0));
  const residuo = cent(totalEsperado - soma);
  if (residuo === 0) return;
  let maiorProj = '';
  let maiorVal = -Infinity;
  valores.forEach((v, p) => { if (v > maiorVal) { maiorVal = v; maiorProj = p; } });
  if (maiorProj) valores.set(maiorProj, cent(valores.get(maiorProj)! + residuo));
}

export function ratearRendimentos(e: EntradaRateio): ResultadoRateio | null {
  const allSorted = [...e.porMes].sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));
  const isDisp = (mesAno: string) =>
    (e.utilizacaoPorMes.get(mesAno) ?? '').toLowerCase().trim() !== 'utilizado';

  const firstDispMc = allSorted.reduce(
    (acc, m) => (isDisp(m.mesAno) && acc === Infinity ? mesKey(m.mesAno) : acc),
    Infinity as number
  );
  if (firstDispMc === Infinity) return null;

  const dispMonths = allSorted.filter(m => mesKey(m.mesAno) >= firstDispMc && isDisp(m.mesAno));
  if (!dispMonths.length) return null;
  const lastCutoff = mesKey(dispMonths[dispMonths.length - 1].mesAno);

  const lancsSorted = [...e.lancamentos]
    .filter(l => l.mesAno)
    .sort((a, b) => mesKey(a.mesAno) - mesKey(b.mesAno));

  const runningBalance = new Map<string, number>();
  const projRendAcum = new Map<string, number>();
  const projMesRend = new Map<string, Map<string, number>>();
  let lIdx = 0;
  let undistributed = 0;

  for (const mes of dispMonths) {
    const mc = mesKey(mes.mesAno);
    // O rendimento é apurado no último dia do mês, então o próprio mês entra na base.
    while (lIdx < lancsSorted.length && mesKey(lancsSorted[lIdx].mesAno) <= mc) {
      const l = lancsSorted[lIdx++];
      if (!l.projeto) continue;
      runningBalance.set(l.projeto, (runningBalance.get(l.projeto) ?? 0) + l.valor);
    }
    /**
     * Encerramento: o saldo vai para a Operação Básica e o projeto para de render.
     *
     * A aba "Saldos remanescentes" registra uma TRANSFERÊNCIA com data e valor.
     * Ela encerra o projeto apenas quando a aba Status também o dá como
     * inativo; num projeto que o Status mantém ativo, ela é um evento pontual
     * na competência registrada. Tratá-la como encerramento perpétuo devolvia à
     * Operação Básica, todo mês, qualquer saldo novo que o projeto recebesse —
     * é o que fazia a destinação de 08/2026 à Plataforma Desafio 3.0 voltar
     * para a Operação Básica no mesmo mês em que entrava.
     *
     * O saldo transferido é aplicado com o sinal que tiver. A Plataforma
     * transferiu saldo NEGATIVO em 12/2024 (-R$ 323,65): transferir só o
     * positivo apagaria esse passivo em vez de levá-lo à Operação Básica, que
     * é quem o absorveu.
     */
    e.projetosEncerrados.forEach((closedMc, proj) => {
      const inativo = e.projetosInativos.has(proj);
      if (mc < closedMc) return;
      if (!inativo && mc !== closedMc) return;
      const bal = runningBalance.get(proj) ?? 0;
      if (bal !== 0) runningBalance.set('Operação Básica', (runningBalance.get('Operação Básica') ?? 0) + bal);
      runningBalance.set(proj, 0);
    });

    /**
     * A base de participação exclui quem não recebe atribuição.
     *
     * Excluir do numerador e manter no denominador deixaria uma fração do
     * líquido sem destino todo mês, e a soma dos projetos deixaria de fechar
     * com o líquido da Base. O capital segue aplicado — ele simplesmente não
     * reivindica cota do rendimento que ajuda a gerar.
     */
    const semAtribuicao = (proj: string) => e.projetosSemAtribuicao?.has(proj) ?? false;
    let totalPos = 0;
    runningBalance.forEach((v, proj) => { if (v > 0 && !semAtribuicao(proj)) totalPos += v; });

    const toDistribute = mes.liquido + undistributed;
    if (totalPos > 0 && toDistribute > 0) {
      runningBalance.forEach((saldo, proj) => {
        if (saldo > 0 && !semAtribuicao(proj)) {
          const rendMes = toDistribute * (saldo / totalPos);
          projRendAcum.set(proj, (projRendAcum.get(proj) ?? 0) + rendMes);
          if (!projMesRend.has(proj)) projMesRend.set(proj, new Map());
          projMesRend.get(proj)!.set(mes.mesAno, (projMesRend.get(proj)!.get(mes.mesAno) ?? 0) + rendMes);
        }
      });
      undistributed = 0;
    } else {
      undistributed += mes.liquido;
    }
  }

  // Inativo é o que a aba Status diz. Constar em "Saldos remanescentes" é ter
  // tido uma transferência, não estar encerrado — senão o rendimento de um
  // projeto reaberto seria varrido para a Operação Básica no fecho do cálculo,
  // logo depois de ter sido corretamente atribuído a ele.
  const isInativo = (proj: string) => e.projetosInativos.has(proj);

  projRendAcum.forEach((rend, proj) => {
    if (proj !== 'Operação Básica' && isInativo(proj) && rend > 0) {
      projRendAcum.set('Operação Básica', (projRendAcum.get('Operação Básica') ?? 0) + rend);
      const opMap = projMesRend.get('Operação Básica') ?? new Map<string, number>();
      projMesRend.get(proj)?.forEach((v, m) => opMap.set(m, (opMap.get(m) ?? 0) + v));
      projMesRend.set('Operação Básica', opMap);
      projRendAcum.delete(proj);
      projMesRend.delete(proj);
    }
  });

  const totalEsperado = cent(dispMonths.reduce((s, m) => s + m.liquido, 0));
  fecharResiduo(projRendAcum, totalEsperado);

  return { meses: dispMonths, porProjetoMes: projMesRend, acumulado: projRendAcum, totalEsperado };
}

export interface ComposicaoSaldo {
  liquido: number;
  /** Já pago: primeiro ciclo + utilizações da destinação vigente. */
  utilizado: number;
  primeiroCiclo: number;
  daDestinacao: number;
  /** Ainda não utilizado — e do qual `destinado` é subdivisão, não adição. */
  disponivel: number;
  destinado: number;
  livre: number;
}

/**
 * Reparte o rendimento líquido em utilizado e disponível, e o disponível em
 * destinado e livre.
 *
 * O destinado é uma subdivisão do disponível, nunca uma carteira paralela:
 * somá-lo ao saldo dos projetos contaria o mesmo dinheiro duas vezes. Daí as
 * duas identidades que o teste trava:
 *
 *     utilizado + disponível = líquido
 *     destinado + livre      = disponível
 */
export function comporSaldo(entrada: {
  liquido: number;
  /** Rendimento consumido no encerramento do primeiro ciclo. */
  utilizadoPrimeiroCiclo: number;
  /** Pagamentos já feitos com o saldo destinado. */
  utilizadoDaDestinacao: number;
  /** Saldo destinado ainda não pago. */
  destinadoARealizar: number;
}): ComposicaoSaldo {
  const liquido = cent(entrada.liquido);
  const primeiroCiclo = cent(entrada.utilizadoPrimeiroCiclo);
  const daDestinacao = cent(entrada.utilizadoDaDestinacao);
  const utilizado = cent(primeiroCiclo + daDestinacao);
  const disponivel = cent(liquido - utilizado);
  const destinado = cent(entrada.destinadoARealizar);
  const livre = cent(disponivel - destinado);
  return { liquido, utilizado, primeiroCiclo, daDestinacao, disponivel, destinado, livre };
}

export interface CorteRateio {
  /** projeto → rendimento acumulado ATÉ a competência anterior ao corte (exclusive). */
  ate: Map<string, number>;
  /** projeto → rendimento gerado A PARTIR da competência de corte (inclusive). */
  depois: Map<string, number>;
  totalAte: number;
  totalDepois: number;
}

/**
 * Parte a série em duas na competência de efeito do evento institucional.
 *
 * Cada lado fecha contra o líquido dos seus próprios meses pela mesma regra de
 * resíduo do rateio completo — sem isso, o checkpoint da data-base ficaria um
 * centavo abaixo do total da Base, e é justamente esse número que o Ofício cita.
 */
export function cortarRateio(r: ResultadoRateio, competencia: string): CorteRateio {
  const corte = competenciaKey(competencia);
  const ate = new Map<string, number>();
  const depois = new Map<string, number>();

  r.porProjetoMes.forEach((mapa, proj) => {
    let a = 0;
    let d = 0;
    mapa.forEach((v, mesAno) => { if (mesKey(mesAno) < corte) a += v; else d += v; });
    if (a !== 0) ate.set(proj, a);
    if (d !== 0) depois.set(proj, d);
  });

  const totalAte = cent(r.meses.filter(m => mesKey(m.mesAno) < corte).reduce((s, m) => s + m.liquido, 0));
  const totalDepois = cent(r.meses.filter(m => mesKey(m.mesAno) >= corte).reduce((s, m) => s + m.liquido, 0));
  fecharResiduo(ate, totalAte);
  fecharResiduo(depois, totalDepois);

  return { ate, depois, totalAte, totalDepois };
}
