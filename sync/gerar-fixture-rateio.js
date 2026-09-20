/**
 * Gera a fixture do teste de regressão do rateio.
 *
 * Os lançamentos saem agregados por projeto e competência: o rateio só usa a
 * soma por (projeto, mês), então 2.400 linhas viram ~120 sem mudar um centavo
 * do resultado — e a fixture cabe num arquivo que dá para ler.
 *
 * Rodar de novo só quando a série histórica mudar de forma legítima. Se o
 * teste quebrar sem que ninguém tenha mexido no período, é regressão no
 * cálculo, não fixture velha.
 *
 *   node sync/gerar-fixture-rateio.js
 */
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const R = require('./rateio-dashboard.js');

const KEY = path.resolve(__dirname, '..', '.secrets', 'enap-financial-dash.json');
const SAIDA = path.resolve(__dirname, '..', 'src', 'app', 'services', 'rateio-rendimentos.fixture.ts');

async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const base = await R.carregar(sheets);
  const ctx = R.contexto({ ...base, transferencias: [] });

  // Lançamentos agregados por projeto + mês.
  const agregado = new Map();
  ctx.lancamentos.forEach(l => {
    if (!l.projeto || !l.mesAno) return;
    const k = l.projeto + '|' + l.mesAno;
    agregado.set(k, (agregado.get(k) ?? 0) + l.valor);
  });
  const lancamentos = Array.from(agregado.entries())
    .map(([k, valor]) => {
      const [projeto, mesAno] = k.split('|');
      return { projeto, mesAno, valor: Math.round(valor * 100) / 100 };
    })
    .sort((a, b) => R.mesKey(a.mesAno) - R.mesKey(b.mesAno) || a.projeto.localeCompare(b.projeto));

  // `acumulado` é só apresentação e nem sempre existe no contexto; fica fora
  // da fixture em vez de virar um zero que não corresponde a nada.
  const porMes = ctx.porMes.map(m => ({
    mesAno: m.mesAno,
    bruto: R.cent(m.bruto), imposto: R.cent(m.imposto),
    liquido: R.cent(m.liquido),
  })).sort((a, b) => R.mesKey(a.mesAno) - R.mesKey(b.mesAno));

  const utilizacao = Array.from(ctx.utilizacaoPorMes.entries())
    .sort((a, b) => R.mesKey(a[0]) - R.mesKey(b[0]));
  const encerrados = Array.from(ctx.projetosEncerrados.entries());
  const inativos = Array.from(ctx.projetosInativos ?? []);

  const ts = `// GERADO POR sync/gerar-fixture-rateio.js — não editar à mão.
//
// Recorte real da Base de Dados ENAP Financial Dash, com os lançamentos
// agregados por projeto e competência. O rateio consome apenas essa soma, então
// a agregação não altera nenhum resultado.
//
// Extraído em ${new Date().toISOString().slice(0, 10)}.

import { EntradaRateio } from './rateio-rendimentos';

const POR_MES = ${JSON.stringify(porMes, null, 2)};

const LANCAMENTOS = ${JSON.stringify(lancamentos)};

const UTILIZACAO: [string, string][] = ${JSON.stringify(utilizacao)};

const ENCERRADOS: [string, number][] = ${JSON.stringify(encerrados)};

const INATIVOS: string[] = ${JSON.stringify(inativos)};

/** Transferências do Ofício nº 04/2026, com efeito na abertura de 08/2026. */
export const TRANSFERENCIAS_OFICIO = [
  { mesAno: '08/2026', projeto: 'CAR DPG', valor: -72847.81 },
  { mesAno: '08/2026', projeto: 'Operação Básica', valor: 72847.81 },
  { mesAno: '08/2026', projeto: 'Co.NE', valor: -26200.66 },
  { mesAno: '08/2026', projeto: 'Operação Básica', valor: 26200.66 },
  { mesAno: '08/2026', projeto: 'Parceria MDIC', valor: -13477.05 },
  { mesAno: '08/2026', projeto: 'Operação Básica', valor: 13477.05 },
];

export function entradaDeTeste(comTransferencias = true): EntradaRateio {
  return {
    porMes: POR_MES,
    lancamentos: comTransferencias ? [...LANCAMENTOS, ...TRANSFERENCIAS_OFICIO] : [...LANCAMENTOS],
    utilizacaoPorMes: new Map(UTILIZACAO),
    projetosEncerrados: new Map(ENCERRADOS),
    projetosInativos: new Set(INATIVOS),
  };
}
`;

  fs.writeFileSync(SAIDA, ts, 'utf8');
  console.log(`fixture escrita em ${SAIDA}`);
  console.log(`  meses: ${porMes.length}  ·  lançamentos agregados: ${lancamentos.length}`);
  console.log(`  utilização: ${utilizacao.length}  ·  encerrados: ${encerrados.length}  ·  inativos: ${inativos.length}`);
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
