import { ratearRendimentos, cortarRateio, comporSaldo } from './rateio-rendimentos';
import { entradaDeTeste } from './rateio-rendimentos.fixture';

/**
 * Regressão do núcleo financeiro.
 *
 * Os números vêm da Base de Dados e da planilha "Orçamento e Rendimentos
 * 2026-2028". Se um destes falhar sem que as fontes tenham mudado, o cálculo
 * regrediu: investigue o cálculo, não ajuste o número esperado.
 */

const COMPETENCIA_EFEITO = '2026-08';

/**
 * Acumulado TOTAL na data-base do Ofício, 31/07/2026.
 *
 * Só o total é travado. A repartição por projeto é derivada dos lançamentos da
 * Base e muda legitimamente quando a Base é corrigida — travá-la aqui exigiria
 * que a Base nunca mudasse. A comparação da repartição contra o que está
 * gravado na planilha é feita por sync/rateio-setembro.js, que a reporta como
 * divergência identificada em vez de silenciá-la.
 */
const CHECKPOINT_TOTAL = 537458.75;

/** Líquidos da Base nas competências fechadas. */
const AGOSTO = 64710.03;
const SETEMBRO = 57411.36;

function rendimentoDoMes(mesAno: string): Map<string, number> {
  const r = ratearRendimentos(entradaDeTeste())!;
  const out = new Map<string, number>();
  r.porProjetoMes.forEach((serie, projeto) => {
    const v = serie.get(mesAno);
    if (v !== undefined && v > 0.005) out.set(projeto, Math.round(v * 100) / 100);
  });
  return out;
}

describe('rateio de rendimentos', () => {
  it('distribui o total do período sem sobrar nem faltar centavo', () => {
    const r = ratearRendimentos(entradaDeTeste());
    expect(r).not.toBeNull();
    const soma = Array.from(r!.acumulado.values()).reduce((s, v) => s + v, 0);
    expect(Math.round(soma * 100) / 100).toBe(r!.totalEsperado);
  });

  it('reproduz o checkpoint total de 31/07/2026 do Ofício nº 04/2026', () => {
    const corte = cortarRateio(ratearRendimentos(entradaDeTeste())!, COMPETENCIA_EFEITO);
    expect(corte.totalAte).toBe(CHECKPOINT_TOTAL);
    const soma = Array.from(corte.ate.values()).reduce((s, v) => s + v, 0);
    expect(Math.round(soma * 100) / 100).toBe(CHECKPOINT_TOTAL);
  });

  it('distribui agosto e setembro pelos líquidos da Base', () => {
    ([['08/2026', AGOSTO], ['09/2026', SETEMBRO]] as [string, number][]).forEach(([mesAno, esperado]) => {
      const soma = Array.from(rendimentoDoMes(mesAno).values()).reduce((s, v) => s + v, 0);
      // Antes do resíduo a soma arredondada fica a centavos do líquido.
      expect(Math.abs(soma - esperado)).toBeLessThan(0.05);
    });
  });

  it('a Plataforma Desafio 3.0 mantém capital aplicado mas não recebe atribuição', () => {
    // O saldo da Plataforma é a destinação de R$ 150.002,11, que já É
    // rendimento: atribuir-lhe rendimento outra vez seria render sobre o
    // próprio rendimento e devolvê-lo a quem o recebeu.
    ['07/2026', '08/2026', '09/2026'].forEach(mesAno => {
      expect(rendimentoDoMes(mesAno).get('Plataforma Desafio 3.0'))
        .withContext(`${mesAno} não deve atribuir rendimento à Plataforma`)
        .toBeUndefined();
    });
    expect(ratearRendimentos(entradaDeTeste())!.acumulado.has('Plataforma Desafio 3.0')).toBeFalse();
  });

  it('reparte entre os cinco projetos o rendimento gerado pelo capital da Plataforma', () => {
    // O capital não sai do cálculo: ele segue aplicado e segue gerando. O que
    // muda é quem recebe a cota — e a soma tem de continuar fechando com o
    // líquido do mês, sem fração órfã.
    const setembro = rendimentoDoMes('09/2026');
    expect(setembro.size).toBe(5);
    const soma = Array.from(setembro.values()).reduce((s, v) => s + v, 0);
    expect(Math.abs(soma - SETEMBRO)).toBeLessThan(0.05);
  });

  it('não distribui mês de líquido negativo: carrega para o mês seguinte', () => {
    const e = entradaDeTeste();
    const negativos = e.porMes.filter(m => m.liquido < 0);
    const r = ratearRendimentos(e)!;
    negativos.forEach(m => r.porProjetoMes.forEach(serie => expect(serie.get(m.mesAno)).toBeUndefined()));
    const soma = Array.from(r.acumulado.values()).reduce((s, v) => s + v, 0);
    expect(Math.round(soma * 100) / 100).toBe(r.totalEsperado);
  });

  it('ignora meses já consumidos por encerramento de ciclo', () => {
    const e = entradaDeTeste();
    const utilizados = e.porMes.filter(
      m => (e.utilizacaoPorMes.get(m.mesAno) ?? '').toLowerCase().trim() === 'utilizado'
    );
    const rateados = new Set(ratearRendimentos(e)!.meses.map(m => m.mesAno));
    utilizados.forEach(m => expect(rateados.has(m.mesAno)).toBe(false));
  });
});

/**
 * Composição do saldo líquido.
 *
 * A destinação sai integralmente do disponível quando é feita; a despesa
 * posterior consome o saldo do projeto de destino e não desconta de novo.
 */
describe('composição do saldo líquido', () => {
  const ENTRADA = {
    liquido: 889655.76,
    utilizadoPrimeiroCiclo: 230075.62,   // cobertura da Operação Básica, 08/2025
    utilizadoDaDestinacao: 150002.11,    // Plataforma Desafio 3.0, 08/2026
    destinadoARealizar: 0,               // a destinação já saiu por inteiro
  };

  it('reparte o líquido nos valores conferidos contra a Base', () => {
    const c = comporSaldo(ENTRADA);
    expect(c.utilizado).toBe(380077.73);
    expect(c.disponivel).toBe(509578.03);
  });

  it('utilizado e destinado mais disponível fecha o líquido total', () => {
    const c = comporSaldo(ENTRADA);
    expect(Math.round((c.utilizado + c.disponivel) * 100) / 100).toBe(889655.76);
  });
});
