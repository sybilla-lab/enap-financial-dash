import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DataService } from './data.service';
import { FotografiaDocumental } from '../models/lancamento.model';
import { environment } from '../../environments/environment';

/**
 * Fotografia documental do Ofício nº 04/2026.
 *
 * O que se trava aqui é que o checkpoint da data-base é LIDO da memória, não
 * recalculado sobre a Base. A Base continua andando — em 09/11/2026 três
 * saldos remanescentes foram regularizados — e o recálculo passou a devolver
 * R$ 73.492,64 para o CAR DPG onde o documento enviado à ENAP diz
 * R$ 72.847,81. Enquanto a memória for lida, o documento se reproduz.
 */

/** Recorte real da aba "Memórias • ENAP": seções C e D, que são as lidas. */
const CSV_MEMORIAS = [
  'MEMÓRIAS PRESERVADAS • ENAP,,,,,,,,,,,,,,,46266',
  ',,,,,,,,,,,,,,,',
  'C. Ofício nº 04/2026 • data-base 31/07/2026; efeito 01/08/2026,,,,,,,,,,,,,,,',
  'Origem,Destino,Valor documental,Tratamento,,,,,,,,,,,,',
  'CAR DPG,Plataforma Desafio 3.0,"72847,81",Transferência interna,,,,,,,,,,,,',
  'Co.NE,Plataforma Desafio 3.0,"26200,66",Transferência interna,,,,,,,,,,,,',
  'Parceria MDIC,Plataforma Desafio 3.0,"13477,05",Transferência interna,,,,,,,,,,,,',
  'Operação Básica,Plataforma Desafio 3.0,"37476,59",Destinação própria; contar uma vez,,,,,,,,,,,,',
  'TOTAL DESTINADO,,"150002,11",,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,',
  'D. Série registrada de rendimentos • jan–set/2026 preservada,,,,,,,,,,,,,,,',
  'Projeto,Acumulado até 12/2025,jan/2026,fev/2026,mar/2026,abr/2026,mai/2026,jun/2026,jul/2026,ago/2026,set/2026,' +
    'Acumulado até 07/2026,Saldo livre até 09/2026,Caixa em 30/09/2026,,',
  'Operação Básica,"12007,9","5482,85","4175,46","4194,52","3148,04","2502,98","1938,3","4026,54","4497,31","1196,13","37476,59","5693,44","153082,55",,',
  'Co.NE,"6952,36","3593,91","2596,41","2613,04","1853,21","1395,03","3733,16","3463,54","2435,33","1853,93","26200,66","4289,26","196329,1",,',
  'CAR DPG,"8486,48","10115,67","8738,16","10497,99","9278,11","8813,73","9018,57","7899,1","6030,01","5821,13","72847,81","11851,14","605416,27",,',
  'Alimenta +1000 Cidades,"45640,79","54655,89","46838,32","56484,27","49768,08","46570,16","45985,31","41513,82","38814,68","37449,02","387456,64","463720,34","3813645,77",,',
  'Parceria MDIC,0,0,0,0,0,0,0,"13477,05","12932,7","11091,15","13477,05","24023,85","1029637,05",,',
].join('\n');

describe('Fotografia documental • Memórias • ENAP', () => {
  let service: DataService;
  let http: HttpTestingController;

  const carregar = (csv: string): FotografiaDocumental[] => {
    let fotos: FotografiaDocumental[] = [];
    service.getFotografiasDocumentais().subscribe(f => (fotos = f));
    http.expectOne(environment.memoriasEnapUrl).flush(csv);
    return fotos;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [DataService] });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);
    // O construtor dispara a carga das abas da Base; nada disso importa aqui.
    http.match(() => true).forEach(r => r.flush(''));
  });

  it('identifica o ofício, a data-base e a competência de efeito', () => {
    const [f] = carregar(CSV_MEMORIAS);
    expect(f.oficio).toBe('Ofício nº 04/2026');
    expect(f.dataBase).toBe('31/07/2026');
    expect(f.competenciaEfeito).toBe('2026-08');
    expect(f.avisos).toEqual([]);
  });

  it('lê o acumulado documental de cada projeto na data-base', () => {
    const [f] = carregar(CSV_MEMORIAS);
    expect(f.projetos.get('CAR DPG')!.acumuladoDocumental).toBe(72847.81);
    expect(f.projetos.get('Co.NE')!.acumuladoDocumental).toBe(26200.66);
    expect(f.projetos.get('Parceria MDIC')!.acumuladoDocumental).toBe(13477.05);
    expect(f.projetos.get('Operação Básica')!.acumuladoDocumental).toBe(37476.59);
    expect(f.projetos.get('Alimenta +1000 Cidades')!.acumuladoDocumental).toBe(387456.64);
  });

  it('fecha o checkpoint do ofício em R$ 537.458,75', () => {
    const [f] = carregar(CSV_MEMORIAS);
    expect(f.total).toBe(537458.75);
  });

  it('preserva a série mensal registrada', () => {
    const [f] = carregar(CSV_MEMORIAS);
    const car = f.projetos.get('CAR DPG')!;
    expect(car.serieMensal.get('01/2026')).toBe(10115.67);
    expect(car.serieMensal.get('07/2026')).toBe(7899.1);
    expect(car.serieMensal.get('09/2026')).toBe(5821.13);
    // Acumulado até 12/2025 mais jan–jul/2026 reconstrói o checkdocumental.
    const ateJulho = ['01', '02', '03', '04', '05', '06', '07']
      .reduce((s, m) => s + (car.serieMensal.get(`${m}/2026`) ?? 0), 8486.48);
    expect(Math.round(ateJulho * 100) / 100).toBe(car.acumuladoDocumental);
  });

  it('lê o saldo livre registrado, que soma os R$ 509.578,03 de setembro', () => {
    const [f] = carregar(CSV_MEMORIAS);
    const soma = Array.from(f.projetos.values())
      .reduce((s, p) => s + (p.saldoLivreRegistrado ?? 0), 0);
    expect(Math.round(soma * 100) / 100).toBe(509578.03);
  });

  it('acha o acumulado pelo texto do cabeçalho, não pela posição da coluna', () => {
    // Uma coluna nova no meio não pode trocar o checkpoint por outro número.
    const comColunaExtra = CSV_MEMORIAS
      .replace('Projeto,Acumulado até 12/2025,', 'Projeto,Revisado em,Acumulado até 12/2025,')
      .replace(/^(Operação Básica|Co\.NE|CAR DPG|Alimenta \+1000 Cidades|Parceria MDIC),/gm, '$1,09/11/2026,');
    const [f] = carregar(comColunaExtra);
    expect(f.projetos.get('CAR DPG')!.acumuladoDocumental).toBe(72847.81);
    expect(f.total).toBe(537458.75);
  });

  it('avisa em vez de inventar quando a coluna da data-base não existe', () => {
    const semColuna = CSV_MEMORIAS.replace('Acumulado até 07/2026', 'Acumulado até 06/2026');
    const [f] = carregar(semColuna);
    expect(f.projetos.size).toBe(0);
    expect(f.avisos.length).toBe(1);
    expect(f.avisos[0]).toContain('Acumulado até 07/2026');
  });

  it('não aceita a página de login de uma aba despublicada', () => {
    const fotos = carregar('<html><head><title>Fazer login</title></head></html>');
    expect(fotos).toEqual([]);
  });
});
