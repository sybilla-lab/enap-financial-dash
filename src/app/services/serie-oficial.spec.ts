import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DataService } from './data.service';
import { SerieRealizada } from '../models/lancamento.model';
import { environment } from '../../environments/environment';

/**
 * Série oficial do realizado — "Rateio • Realizado" mais a abertura documental.
 *
 * A aba se declara fonte única e é mesmo: ela pondera pela caixa na abertura
 * de cada projeto, grandeza que o motor não reproduz. Em out/2026 o motor dava
 * R$ 34.473,43 ao Alimenta onde a planilha registra R$ 32.545,67 — mesmo total
 * do mês, repartição diferente. O que se trava aqui é que os meses fechados
 * saem da planilha, que a abertura de 2026 é documental por projeto, e que
 * falta de dado vira aviso em vez de zero.
 */

const CAB = 'Competência,Projeto,Caixa na abertura,Base elegível,Participação,Líquido bancário,' +
  'Rateio arredondado,Ajuste de centavos,Rendimento atribuído,Situação,Registrado / projetado,' +
  'Diferença,Saldo livre,Caixa no fechamento';

/** Recorte real da aba: set/2026 fechado, out/2026 apurado, nov/2026 em projeção. */
const CSV_RATEIO = [
  'RATEIO REALIZADO • fonte única para as abas e o dashboard,,,,,,,,,,,,,',
  'Histórico até setembro preservado.,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,',
  'Sincronização,VÍNCULOS ATIVOS,,,,,,,,,,,,',
  CAB,
  'set./2026,Operação Básica,"R$ 153.082,55","R$ 153.082,55","2,0834%","R$ 57.411,36","R$ 0,00","R$ 0,00","R$ 1.196,13",HISTÓRICO PRESERVADO,,,"R$ 5.693,44","R$ 153.082,55"',
  'set./2026,Co.NE,"R$ 196.329,10","R$ 196.329,10","3,2292%","R$ 57.411,36","R$ 0,00","R$ 0,00","R$ 1.853,93",HISTÓRICO PRESERVADO,,,"R$ 4.289,26","R$ 196.329,10"',
  'set./2026,CAR DPG,"R$ 651.304,12","R$ 651.304,12","10,0187%","R$ 57.411,36","R$ 0,00","R$ 0,00","R$ 5.821,13",HISTÓRICO PRESERVADO,,,"R$ 11.851,14","R$ 605.416,27"',
  'set./2026,Alimenta +1000 Cidades,"R$ 4.110.933,01","R$ 4.110.933,01","63,2366%","R$ 57.411,36","R$ 0,00","R$ 0,00","R$ 37.449,02",HISTÓRICO PRESERVADO,,,"R$ 463.720,34","R$ 3.813.645,77"',
  'set./2026,Parceria MDIC,"R$ 1.254.106,13","R$ 1.254.106,13","19,2913%","R$ 57.411,36","R$ 0,00","R$ 0,00","R$ 11.091,15",HISTÓRICO PRESERVADO,,,"R$ 24.023,85","R$ 1.029.637,05"',
  'out./2026,Operação Básica,"R$ 156.535,31","R$ 156.535,31","2,6982%","R$ 49.510,55","R$ 1.335,87","R$ 0,00","R$ 1.335,87",APURADO — encerramentos regularizados,,,"R$ 7.029,31","R$ 65.711,01"',
  'out./2026,Co.NE,"R$ 196.329,10","R$ 196.329,10","3,3841%","R$ 49.510,55","R$ 1.675,47","R$ 0,00","R$ 1.675,47",APURADO — encerramentos regularizados,,,"R$ 5.964,73","R$ 102.716,52"',
  'out./2026,CAR DPG,"R$ 605.416,27","R$ 605.416,27","10,4354%","R$ 49.510,55","R$ 5.166,62","R$ 0,00","R$ 5.166,62",APURADO — encerramentos regularizados,,,"R$ 17.017,76","R$ 560.963,02"',
  'out./2026,Alimenta +1000 Cidades,"R$ 3.813.645,77","R$ 3.813.645,77","65,7348%","R$ 49.510,55","R$ 32.545,66","R$ 0,01","R$ 32.545,67",APURADO — encerramentos regularizados,,,"R$ 496.266,01","R$ 3.461.340,57"',
  'out./2026,Parceria MDIC,"R$ 1.029.637,05","R$ 1.029.637,05","17,7476%","R$ 49.510,55","R$ 8.786,92","R$ 0,00","R$ 8.786,92",APURADO — encerramentos regularizados,,,"R$ 32.810,77","R$ 783.151,49"',
  'nov./2026,Operação Básica,"R$ 0,00","R$ 0,00","0,0000%","R$ 0,00","R$ 0,00","R$ 0,00","R$ 0,00",PROJEÇÃO NA ABA,"R$ 316,20",MÊS NÃO FECHADO,,',
  'nov./2026,Alimenta +1000 Cidades,"R$ 0,00","R$ 0,00","0,0000%","R$ 0,00","R$ 0,00","R$ 0,00","R$ 0,00",PROJEÇÃO NA ABA,"R$ 29.253,77",,,',
].join('\n');

const CSV_CONTROLE = [
  ',,,,',
  ',Integrações e premissas,,,',
  ',,,,',
  'Último mês encerrado,out./26,,,',
  'Taxa mensal de forecast,"0,9597%",,,',
].join('\n');

describe('Série oficial do realizado • Rateio • Realizado', () => {
  let service: DataService;
  let http: HttpTestingController;

  const carregar = (rateio = CSV_RATEIO, controle = CSV_CONTROLE): SerieRealizada => {
    let serie!: SerieRealizada;
    service.getSerieRealizada().subscribe(s => (serie = s));
    http.expectOne(environment.rateioRealizadoUrl).flush(rateio);
    http.expectOne(environment.controleIntegracoesUrl).flush(controle);
    return serie;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [DataService] });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);
    http.match(r => r.url !== environment.rateioRealizadoUrl
                 && r.url !== environment.controleIntegracoesUrl).forEach(r => r.flush(''));
  });

  it('lê o corte de fechamento de Controle • Integrações', () => {
    expect(carregar().corte).toBe('10/2026');
  });

  it('traz apenas competências fechadas, nunca as em projeção', () => {
    const s = carregar();
    expect(s.competencias).toEqual(['09/2026', '10/2026']);
    expect(s.porCompetencia.has('11/2026')).toBeFalse();
  });

  it('reproduz a distribuição de outubro projeto a projeto', () => {
    const out = carregar().porCompetencia.get('10/2026')!;
    expect(out.get('Alimenta +1000 Cidades')!.rendimentoAtribuido).toBe(32545.67);
    expect(out.get('Parceria MDIC')!.rendimentoAtribuido).toBe(8786.92);
    expect(out.get('CAR DPG')!.rendimentoAtribuido).toBe(5166.62);
    expect(out.get('Co.NE')!.rendimentoAtribuido).toBe(1675.47);
    expect(out.get('Operação Básica')!.rendimentoAtribuido).toBe(1335.87);
    const soma = Array.from(out.values()).reduce((s, l) => s + l.rendimentoAtribuido, 0);
    expect(Math.round(soma * 100) / 100).toBe(49510.55);
  });

  it('lê o saldo livre registrado, que soma os R$ 559.088,58 de outubro', () => {
    const out = carregar().porCompetencia.get('10/2026')!;
    expect(out.get('Alimenta +1000 Cidades')!.saldoLivre).toBe(496266.01);
    const soma = Array.from(out.values()).reduce((s, l) => s + l.saldoLivre, 0);
    expect(Math.round(soma * 100) / 100).toBe(559088.58);
  });

  it('ignora mês marcado como fechado depois do corte, e avisa', () => {
    const adiantado = CSV_RATEIO.replace(
      'nov./2026,Operação Básica,"R$ 0,00","R$ 0,00","0,0000%","R$ 0,00","R$ 0,00","R$ 0,00","R$ 0,00",PROJEÇÃO NA ABA',
      'nov./2026,Operação Básica,"R$ 10,00","R$ 10,00","1,0000%","R$ 100,00","R$ 1,00","R$ 0,00","R$ 1,00",HISTÓRICO PRESERVADO'
    );
    const s = carregar(adiantado);
    expect(s.competencias).toEqual(['09/2026', '10/2026']);
    expect(s.avisos.some(a => a.includes('11/2026') && a.includes('posterior ao corte'))).toBeTrue();
  });

  it('avisa quando uma competência fechada não traz todos os projetos', () => {
    const semUm = CSV_RATEIO.split('\n')
      .filter(l => !l.startsWith('out./2026,Co.NE')).join('\n');
    const s = carregar(semUm);
    expect(s.avisos.some(a => a.includes('10/2026') && a.includes('Co.NE'))).toBeTrue();
  });

  it('avisa em vez de adivinhar quando falta coluna obrigatória', () => {
    const semColuna = CSV_RATEIO.replace('Rendimento atribuído', 'Rendimento');
    const s = carregar(semColuna);
    expect(s.competencias).toEqual([]);
    expect(s.avisos.some(a => a.includes('coluna obrigatória ausente'))).toBeTrue();
  });

  it('sem corte legível, nenhuma competência é tratada como realizada', () => {
    const s = carregar(CSV_RATEIO, 'Taxa mensal de forecast,"0,9597%",,,');
    expect(s.competencias).toEqual([]);
    expect(s.avisos.some(a => a.includes('Último mês encerrado'))).toBeTrue();
  });

  it('lê a projeção da coluna própria, não da de rendimento atribuído', () => {
    const s = carregar();
    const nov = s.projecoes.get('11/2026')!;
    expect(nov.get('Operação Básica')).toBe(316.20);
    expect(nov.get('Alimenta +1000 Cidades')).toBe(29253.77);
    // A coluna de rendimento atribuído está zerada nesses meses: zero não é previsão.
    expect(s.porCompetencia.has('11/2026')).toBeFalse();
  });

  it('entrega a projeção ao orçamento no formato YYYY-MM', () => {
    let mapa = new Map<string, number>();
    service.getOrcamentoRendimentos().subscribe(m => (mapa = m));
    http.expectOne(environment.rateioRealizadoUrl).flush(CSV_RATEIO);
    http.expectOne(environment.controleIntegracoesUrl).flush(CSV_CONTROLE);
    // Só nov/2026 está no recorte do teste; o total é a soma dos projetos.
    expect(Math.round(mapa.get('2026-11')! * 100) / 100).toBe(29569.97);
  });

  it('avisa quando a coluna de projeção some', () => {
    const s = carregar(CSV_RATEIO.replace('Registrado / projetado', 'Registrado'));
    expect(s.avisos.some(a => a.includes('Registrado / projetado'))).toBeTrue();
  });

  it('não aceita a página de login de uma aba despublicada', () => {
    const s = carregar('<html><title>Fazer login</title></html>');
    expect(s.competencias).toEqual([]);
    expect(s.avisos.some(a => a.includes('não publicada'))).toBeTrue();
  });
});
