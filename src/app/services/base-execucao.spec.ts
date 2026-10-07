import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DataService } from './data.service';
import { ProjetoResumo } from '../models/lancamento.model';
import { environment } from '../../environments/environment';

/**
 * Base de execução por projeto.
 *
 * A execução da Plataforma Desafio 3.0 marcava 108% e a da Operação Básica
 * 105,8% porque as despesas pagas com rendimento destinado entravam no
 * numerador sem o recurso correspondente no denominador. O que se trava aqui é
 * a identidade que corrige isso — e, junto, o limite dela: um projeto SEM
 * destinação e com saldo negativo continua acima de 100%, porque é pendência
 * real a apurar e não pode ser dissolvida alargando a base.
 */

/** Recorte mínimo da aba principal: cabeçalho + lançamentos de três projetos. */
const CSV_PRINCIPAL = [
  'a,b,data,numpag,valor,f,g,fornecedor,categoria,obs,projeto,mesano,valorM',
  // Plataforma: R$ 273.000,00 do Termo, R$ 294.923,65 executados.
  'x,x,02/05/2024,1,"134.000,00",x,x,ENAP,0.0.0 Recurso,,Plataforma Desafio 3.0,05/2024,"134.000,00"',
  'x,x,02/11/2024,2,"139.000,00",x,x,ENAP,0.0.0 Recurso,,Plataforma Desafio 3.0,11/2024,"139.000,00"',
  'x,x,02/06/2024,3,"273.323,65",x,x,MESA,2.3.2 Servico,,Plataforma Desafio 3.0,06/2024,"(273.323,65)"',
  'x,x,02/09/2026,4,"21.600,00",x,x,GSGUMIER,3.1.1 Plataforma,,Plataforma Desafio 3.0,09/2026,"(21.600,00)"',
  // Projeto sem destinação e com saldo negativo — a pendência que deve sobreviver.
  'x,x,02/03/2025,5,"100.000,00",x,x,ENAP,0.0.0 Recurso,,Fundo GovTech,03/2025,"100.000,00"',
  'x,x,02/04/2025,6,"100.710,38",x,x,FORN,2.1.1 Servico,,Fundo GovTech,04/2025,"(100.710,38)"',
].join('\n');

/** Bloco J:L da aba Rendimentos: a destinação de 2026 à Plataforma. */
const CSV_RENDIMENTOS = [
  'categoria,data,valor,,,data,saldo do mes,,,utilizacao,valor,projeto',
  '0.0.0 Recurso,12/2023,"3.332,02",,,12/2023,"3.332,02",,,2026,"150.002,11",Plataforma Desafio 3.0',
].join('\n');

const CSV_VAZIO = 'a,b,c,d,e,f,g,h,i,j,k,l\n';

describe('base de execução por projeto', () => {
  let service: DataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DataService],
    });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);

    const base = environment.googleSheetsBaseUrl;
    const responder = (gid: string, corpo: string) =>
      http.expectOne(`${base}&gid=${gid}`).flush(corpo);

    responder('0', CSV_PRINCIPAL);
    responder('595659211', CSV_VAZIO);
    responder('1699326950', 'projeto,status\n');
    responder('86178020', CSV_VAZIO);
    responder('2032068393', CSV_RENDIMENTOS);
    responder('806545379', CSV_VAZIO);
  });

  afterEach(() => http.verify());

  function resumo(projeto: string): ProjetoResumo {
    let achado: ProjetoResumo | undefined;
    service.getProjetoResumos().subscribe(rs => { achado = rs.find(r => r.projeto === projeto); });
    expect(achado).withContext(`projeto "${projeto}" ausente nos resumos`).toBeDefined();
    return achado!;
  }

  it('compõe as entradas como recurso do Termo mais rendimentos destinados', () => {
    const p = resumo('Plataforma Desafio 3.0');
    expect(p.recursoTermo).toBe(273000);
    expect(p.rendimentosDestinados).toBe(150002.11);
    expect(p.entradas).toBe(423002.11);
  });

  it('tira a Plataforma Desafio 3.0 de 108% ao reconhecer a destinação de 2026', () => {
    const p = resumo('Plataforma Desafio 3.0');
    expect(p.saidas).toBe(294923.65);
    // Sem a destinação: 294.923,65 / 273.000,00 = 108,03%.
    expect(p.saidas / p.recursoTermo * 100).toBeGreaterThan(100);
    expect(p.execucao).toBeCloseTo(69.72, 2);
    expect(p.saldo).toBe(128078.46);
  });

  it('mantém acima de 100% o projeto sem destinação cujo saldo é negativo', () => {
    const f = resumo('Fundo GovTech');
    expect(f.rendimentosDestinados).toBe(0);
    expect(f.execucao).toBeGreaterThan(100);
    expect(f.saldo).toBe(-710.38);
  });

  it('mantém saldo = entradas - saídas em todos os projetos', () => {
    service.getProjetoResumos().subscribe(rs => {
      expect(rs.length).toBeGreaterThan(0);
      rs.forEach(r => {
        expect(r.entradas).toBe(Math.round((r.recursoTermo + r.rendimentosDestinados) * 100) / 100);
        expect(r.saldo).toBe(Math.round((r.entradas - r.saidas) * 100) / 100);
      });
    });
  });
});
