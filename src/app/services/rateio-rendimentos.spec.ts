import { ratearRendimentos, cortarRateio } from './rateio-rendimentos';
import { entradaDeTeste } from './rateio-rendimentos.fixture';

/**
 * Regressão do núcleo financeiro.
 *
 * Os números aqui são os do Ofício nº 04/2026, conferidos contra a planilha
 * oficial "Orçamento e Rendimentos 2026-2028". Não são expectativas
 * arbitrárias: são o resultado que a prestação de contas já registrou. Se um
 * destes falhar sem que a série histórica tenha mudado, o cálculo regrediu —
 * o certo é investigar o cálculo, nunca ajustar o número esperado.
 */

const COMPETENCIA_EFEITO = '2026-08';

const CHECKPOINT_POR_PROJETO: Record<string, number> = {
  'Alimenta +1000 Cidades': 387456.64,
  'CAR DPG': 72847.81,
  'Operação Básica': 37476.59,
  'Co.NE': 26200.66,
  'Parceria MDIC': 13477.05,
};

const POS_CORTE_POR_PROJETO: Record<string, number> = {
  'Alimenta +1000 Cidades': 38814.68,
  'CAR DPG': 6030.01,
  'Operação Básica': 4497.31,
  'Co.NE': 2435.33,
  'Parceria MDIC': 12932.70,
};

const CHECKPOINT_TOTAL = 537458.75;
const POS_CORTE_TOTAL = 64710.03;

describe('rateio de rendimentos', () => {
  it('distribui o total do período sem sobrar nem faltar centavo', () => {
    const r = ratearRendimentos(entradaDeTeste());
    expect(r).not.toBeNull();
    const soma = Array.from(r!.acumulado.values()).reduce((s, v) => s + v, 0);
    expect(Math.round(soma * 100) / 100).toBe(r!.totalEsperado);
  });

  it('reproduz o checkpoint de 31/07/2026 do Ofício nº 04/2026', () => {
    const r = ratearRendimentos(entradaDeTeste())!;
    const corte = cortarRateio(r, COMPETENCIA_EFEITO);

    expect(corte.totalAte).toBe(CHECKPOINT_TOTAL);
    Object.entries(CHECKPOINT_POR_PROJETO).forEach(([projeto, esperado]) => {
      expect(corte.ate.get(projeto)).toBe(esperado);
    });
    const soma = Array.from(corte.ate.values()).reduce((s, v) => s + v, 0);
    expect(Math.round(soma * 100) / 100).toBe(CHECKPOINT_TOTAL);
  });

  it('fecha agosto/2026 em R$ 64.710,03 depois da realocação', () => {
    const r = ratearRendimentos(entradaDeTeste())!;
    const corte = cortarRateio(r, COMPETENCIA_EFEITO);

    expect(corte.totalDepois).toBe(POS_CORTE_TOTAL);
    Object.entries(POS_CORTE_POR_PROJETO).forEach(([projeto, esperado]) => {
      expect(corte.depois.get(projeto)).toBe(esperado);
    });
  });

  it('a realocação muda o rateio a partir da competência de efeito', () => {
    // Sem as transferências, quem cedeu continuaria rendendo sobre um saldo que
    // já não tem — é exatamente o que o evento corrige na abertura de 08/2026.
    const com = cortarRateio(ratearRendimentos(entradaDeTeste(true))!, COMPETENCIA_EFEITO);
    const sem = cortarRateio(ratearRendimentos(entradaDeTeste(false))!, COMPETENCIA_EFEITO);

    expect(com.totalAte).toBe(sem.totalAte);          // o passado não muda
    expect(com.totalDepois).toBe(sem.totalDepois);    // o líquido do mês não muda
    expect(com.depois.get('CAR DPG')).not.toBe(sem.depois.get('CAR DPG'));
  });

  it('não distribui mês de líquido negativo: carrega para o mês seguinte', () => {
    const e = entradaDeTeste();
    const negativos = e.porMes.filter(m => m.liquido < 0);
    const r = ratearRendimentos(e)!;
    negativos.forEach(m => {
      r.porProjetoMes.forEach(serie => expect(serie.get(m.mesAno)).toBeUndefined());
    });
    // Mesmo assim o total fecha: o negativo foi absorvido, não perdido.
    const soma = Array.from(r.acumulado.values()).reduce((s, v) => s + v, 0);
    expect(Math.round(soma * 100) / 100).toBe(r.totalEsperado);
  });

  it('ignora meses já utilizados, que não entram no saldo disponível', () => {
    const e = entradaDeTeste();
    const utilizados = e.porMes.filter(
      m => (e.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() === 'utilizado'
    );
    const r = ratearRendimentos(e)!;
    const rateados = new Set(r.meses.map(m => m.mesAno));
    utilizados.forEach(m => expect(rateados.has(m.mesAno)).toBe(false));
  });
});
