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
    // Projeto encerrado para de render e devolve o saldo à Operação Básica.
    e.projetosEncerrados.forEach((closedMc, proj) => {
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
          projMesRend.get(proj)!.set(mes.mesAno, (projMesRend.get(proj)!.get(mes.mesAno) ?? 0) + rendMes);
        }
      });
      undistributed = 0;
    } else {
      undistributed += mes.liquido;
    }
  }

  const isInativo = (proj: string) =>
    e.projetosInativos.has(proj) ||
    (e.projetosEncerrados.has(proj) && lastCutoff >= e.projetosEncerrados.get(proj)!);

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
