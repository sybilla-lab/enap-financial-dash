// GERADO POR sync/gerar-fixture-rateio.js — não editar à mão.
//
// Recorte real da Base de Dados ENAP Financial Dash, com os lançamentos
// agregados por projeto e competência. O rateio consome apenas essa soma, então
// a agregação não altera nenhum resultado.
//
// Extraído em 2026-10-07.

import { EntradaRateio, PROJETOS_SEM_ATRIBUICAO_RENDIMENTOS } from './rateio-rendimentos';

const POR_MES = [
  {
    "mesAno": "12/2023",
    "bruto": 3332.02,
    "imposto": 0,
    "liquido": 3332.02
  },
  {
    "mesAno": "01/2024",
    "bruto": 21676.66,
    "imposto": 0,
    "liquido": 21676.66
  },
  {
    "mesAno": "02/2024",
    "bruto": 17911.9,
    "imposto": 0,
    "liquido": 17911.9
  },
  {
    "mesAno": "03/2024",
    "bruto": 18527.74,
    "imposto": -79.49,
    "liquido": 18448.25
  },
  {
    "mesAno": "04/2024",
    "bruto": 20042.3,
    "imposto": -249.34,
    "liquido": 19792.96
  },
  {
    "mesAno": "05/2024",
    "bruto": 18858.1,
    "imposto": -19893.11,
    "liquido": -1035.01
  },
  {
    "mesAno": "06/2024",
    "bruto": 17957.19,
    "imposto": -135.46,
    "liquido": 17821.73
  },
  {
    "mesAno": "07/2024",
    "bruto": 19187.7,
    "imposto": -528.76,
    "liquido": 18658.94
  },
  {
    "mesAno": "08/2024",
    "bruto": 17027.97,
    "imposto": -462.4,
    "liquido": 16565.57
  },
  {
    "mesAno": "09/2024",
    "bruto": 15797.71,
    "imposto": -592.24,
    "liquido": 15205.47
  },
  {
    "mesAno": "10/2024",
    "bruto": 16364.43,
    "imposto": -1817.22,
    "liquido": 14547.21
  },
  {
    "mesAno": "11/2024",
    "bruto": 12942.12,
    "imposto": -16176.77,
    "liquido": -3234.65
  },
  {
    "mesAno": "12/2024",
    "bruto": 13204.64,
    "imposto": -339.84,
    "liquido": 12864.8
  },
  {
    "mesAno": "01/2025",
    "bruto": 11162.09,
    "imposto": -1219.36,
    "liquido": 9942.73
  },
  {
    "mesAno": "02/2025",
    "bruto": 8345.79,
    "imposto": -339.01,
    "liquido": 8006.78
  },
  {
    "mesAno": "03/2025",
    "bruto": 7391.53,
    "imposto": -699.98,
    "liquido": 6691.55
  },
  {
    "mesAno": "04/2025",
    "bruto": 8039.73,
    "imposto": -1543.76,
    "liquido": 6495.97
  },
  {
    "mesAno": "05/2025",
    "bruto": 7659.84,
    "imposto": -7087.09,
    "liquido": 572.75
  },
  {
    "mesAno": "06/2025",
    "bruto": 8501.93,
    "imposto": -45.97,
    "liquido": 8455.96
  },
  {
    "mesAno": "07/2025",
    "bruto": 10077.63,
    "imposto": -366.44,
    "liquido": 9711.19
  },
  {
    "mesAno": "08/2025",
    "bruto": 8247.55,
    "imposto": -604.71,
    "liquido": 7642.84
  },
  {
    "mesAno": "09/2025",
    "bruto": 6991.19,
    "imposto": -2384.74,
    "liquido": 4606.45
  },
  {
    "mesAno": "10/2025",
    "bruto": 5850.16,
    "imposto": 0,
    "liquido": 5850.16
  },
  {
    "mesAno": "11/2025",
    "bruto": 2245.87,
    "imposto": -4306.8,
    "liquido": -2060.93
  },
  {
    "mesAno": "12/2025",
    "bruto": 64691.85,
    "imposto": 0,
    "liquido": 64691.85
  },
  {
    "mesAno": "01/2026",
    "bruto": 73848.32,
    "imposto": 0,
    "liquido": 73848.32
  },
  {
    "mesAno": "02/2026",
    "bruto": 62348.35,
    "imposto": 0,
    "liquido": 62348.35
  },
  {
    "mesAno": "03/2026",
    "bruto": 73789.82,
    "imposto": 0,
    "liquido": 73789.82
  },
  {
    "mesAno": "04/2026",
    "bruto": 64047.44,
    "imposto": 0,
    "liquido": 64047.44
  },
  {
    "mesAno": "05/2026",
    "bruto": 59281.9,
    "imposto": 0,
    "liquido": 59281.9
  },
  {
    "mesAno": "06/2026",
    "bruto": 60675.34,
    "imposto": 0,
    "liquido": 60675.34
  },
  {
    "mesAno": "07/2026",
    "bruto": 70380.05,
    "imposto": 0,
    "liquido": 70380.05
  },
  {
    "mesAno": "08/2026",
    "bruto": 64710.03,
    "imposto": 0,
    "liquido": 64710.03
  },
  {
    "mesAno": "09/2026",
    "bruto": 57411.36,
    "imposto": 0,
    "liquido": 57411.36
  }
];

const LANCAMENTOS = [{"projeto":"Ambiente Promotor de Inovação","mesAno":"12/2023","valor":145000},{"projeto":"Datathon","mesAno":"12/2023","valor":105000},{"projeto":"Empreendedoras Tech","mesAno":"12/2023","valor":895000},{"projeto":"Impulso Regional","mesAno":"12/2023","valor":1479048.74},{"projeto":"Operação Básica","mesAno":"12/2023","valor":253332.02},{"projeto":"Operação Básica","mesAno":"01/2024","valor":21676.66},{"projeto":"Ambiente Promotor de Inovação","mesAno":"02/2024","valor":-10300},{"projeto":"Operação Básica","mesAno":"02/2024","valor":17911.9},{"projeto":"Operação Básica","mesAno":"03/2024","valor":11448.25},{"projeto":"Ambiente Promotor de Inovação","mesAno":"04/2024","valor":-55802},{"projeto":"Operação Básica","mesAno":"04/2024","valor":137792.96},{"projeto":"Ambiente Promotor de Inovação","mesAno":"05/2024","valor":-13966},{"projeto":"Datathon","mesAno":"05/2024","valor":-3500},{"projeto":"Impulso Regional","mesAno":"05/2024","valor":-21700},{"projeto":"Operação Básica","mesAno":"05/2024","valor":-83003.15},{"projeto":"Plataforma Desafio 3.0","mesAno":"05/2024","valor":134000},{"projeto":"Ambiente Promotor de Inovação","mesAno":"06/2024","valor":-24401},{"projeto":"Empreendedoras Tech","mesAno":"06/2024","valor":-8961},{"projeto":"Impulso Regional","mesAno":"06/2024","valor":-25286},{"projeto":"Operação Básica","mesAno":"06/2024","valor":-35116.27},{"projeto":"Plataforma Desafio 3.0","mesAno":"06/2024","valor":-37727.7},{"projeto":"Ambiente Promotor de Inovação","mesAno":"07/2024","valor":-24401},{"projeto":"Datathon","mesAno":"07/2024","valor":-65648},{"projeto":"Empreendedoras Tech","mesAno":"07/2024","valor":-29630},{"projeto":"Impulso Regional","mesAno":"07/2024","valor":-31800},{"projeto":"Operação Básica","mesAno":"07/2024","valor":-23246.06},{"projeto":"Plataforma Desafio 3.0","mesAno":"07/2024","valor":-88031.3},{"projeto":"Empreendedoras Tech","mesAno":"08/2024","valor":-48126},{"projeto":"Impulso Regional","mesAno":"08/2024","valor":-26000},{"projeto":"Operação Básica","mesAno":"08/2024","valor":-55723.32},{"projeto":"Plataforma Desafio 3.0","mesAno":"08/2024","valor":-6955.65},{"projeto":"Datathon","mesAno":"09/2024","valor":-825},{"projeto":"Empreendedoras Tech","mesAno":"09/2024","valor":-73580.88},{"projeto":"Feira Reversa","mesAno":"09/2024","valor":-5400},{"projeto":"Impulso Regional","mesAno":"09/2024","valor":-44786},{"projeto":"Operação Básica","mesAno":"09/2024","valor":94935.47},{"projeto":"Plataforma Desafio 3.0","mesAno":"09/2024","valor":-13940},{"projeto":"Ambiente Promotor de Inovação","mesAno":"10/2024","valor":-6472.35},{"projeto":"Datathon","mesAno":"10/2024","valor":-1400},{"projeto":"Empreendedoras Tech","mesAno":"10/2024","valor":-87583.76},{"projeto":"Feira Reversa","mesAno":"10/2024","valor":-5600},{"projeto":"Impulso Regional","mesAno":"10/2024","valor":-37800},{"projeto":"Operação Básica","mesAno":"10/2024","valor":-36252.35},{"projeto":"Plataforma Desafio 3.0","mesAno":"10/2024","valor":-84849},{"projeto":"Datathon","mesAno":"11/2024","valor":-7845},{"projeto":"Empreendedoras Tech","mesAno":"11/2024","valor":-45068},{"projeto":"Feira Reversa","mesAno":"11/2024","valor":-50138.07},{"projeto":"Impulso Regional","mesAno":"11/2024","valor":-73800},{"projeto":"Operação Básica","mesAno":"11/2024","valor":-49156.65},{"projeto":"Plataforma Desafio 3.0","mesAno":"11/2024","valor":139000},{"projeto":"Ambiente Promotor de Inovação","mesAno":"12/2024","valor":-3775},{"projeto":"Datathon","mesAno":"12/2024","valor":-21295},{"projeto":"Empreendedoras Tech","mesAno":"12/2024","valor":-236926.98},{"projeto":"Feira Reversa","mesAno":"12/2024","valor":-40892.5},{"projeto":"Impulso Regional","mesAno":"12/2024","valor":-90200},{"projeto":"Operação Básica","mesAno":"12/2024","valor":-38611.2},{"projeto":"Plataforma Desafio 3.0","mesAno":"12/2024","valor":-41820},{"projeto":"Empreendedoras Tech","mesAno":"01/2025","valor":-365123.38},{"projeto":"Feira Reversa","mesAno":"01/2025","valor":-3342.5},{"projeto":"Impulso Regional","mesAno":"01/2025","valor":-60653.3},{"projeto":"Operação Básica","mesAno":"01/2025","valor":-49547.57},{"projeto":"Ambiente Promotor de Inovação","mesAno":"02/2025","valor":-1775},{"projeto":"Impulso Regional","mesAno":"02/2025","valor":-48275},{"projeto":"Operação Básica","mesAno":"02/2025","valor":-37607.6},{"projeto":"Co.NE","mesAno":"03/2025","valor":-13925},{"projeto":"Feira Reversa","mesAno":"03/2025","valor":150000},{"projeto":"Impulso Regional","mesAno":"03/2025","valor":-81084.39},{"projeto":"Oficina MCTI","mesAno":"03/2025","valor":21000},{"projeto":"Operação Básica","mesAno":"03/2025","valor":-60692.89},{"projeto":"Co.NE","mesAno":"04/2025","valor":-56250},{"projeto":"Impulso Regional","mesAno":"04/2025","valor":-115886.66},{"projeto":"Oficina MCTI","mesAno":"04/2025","valor":-7000},{"projeto":"Operação Básica","mesAno":"04/2025","valor":-38599.28},{"projeto":"Co.NE","mesAno":"05/2025","valor":108107.11},{"projeto":"Impulso Regional","mesAno":"05/2025","valor":-116743.14},{"projeto":"Oficina MCTI","mesAno":"05/2025","valor":-14000},{"projeto":"Operação Básica","mesAno":"05/2025","valor":-61072.5},{"projeto":"Co.NE","mesAno":"06/2025","valor":261464.2},{"projeto":"Impulso Regional","mesAno":"06/2025","valor":-21190.4},{"projeto":"Operação Básica","mesAno":"06/2025","valor":63403.9},{"projeto":"Co.NE","mesAno":"07/2025","valor":-35903.57},{"projeto":"Impulso Regional","mesAno":"07/2025","valor":-60713.89},{"projeto":"Oficina Alimenta Cidades","mesAno":"07/2025","valor":21000},{"projeto":"Operação Básica","mesAno":"07/2025","valor":-46671.06},{"projeto":"Co.NE","mesAno":"08/2025","valor":-40348.43},{"projeto":"Impulso Regional","mesAno":"08/2025","valor":-38471.65},{"projeto":"Operação Básica","mesAno":"08/2025","valor":-46030.6},{"projeto":"Co.NE","mesAno":"09/2025","valor":-53023.03},{"projeto":"Impulso Regional","mesAno":"09/2025","valor":-234798.46},{"projeto":"Operação Básica","mesAno":"09/2025","valor":-51228.66},{"projeto":"Co.NE","mesAno":"10/2025","valor":-31000},{"projeto":"Impulso Regional","mesAno":"10/2025","valor":-186974.46},{"projeto":"Inovação Crédito Fundiário","mesAno":"10/2025","valor":115000},{"projeto":"Operação Básica","mesAno":"10/2025","valor":-39469.25},{"projeto":"Co.NE","mesAno":"11/2025","valor":-35957.58},{"projeto":"Impulso Regional","mesAno":"11/2025","valor":-51866.32},{"projeto":"Operação Básica","mesAno":"11/2025","valor":-58461.86},{"projeto":"Alimenta +1000 Cidades","mesAno":"12/2025","valor":5324316.8},{"projeto":"CAR DPG","mesAno":"12/2025","valor":990007.5},{"projeto":"Co.NE","mesAno":"12/2025","valor":322125.12},{"projeto":"Impulso Regional","mesAno":"12/2025","valor":-18174.29},{"projeto":"Inovação Crédito Fundiário","mesAno":"12/2025","valor":-10350},{"projeto":"Oficina Energias da Floresta","mesAno":"12/2025","valor":21000},{"projeto":"Operação Básica","mesAno":"12/2025","valor":477303.42},{"projeto":"Alimenta +1000 Cidades","mesAno":"01/2026","valor":-42756.19},{"projeto":"CAR DPG","mesAno":"01/2026","valor":-12500},{"projeto":"Co.NE","mesAno":"01/2026","valor":-77998.35},{"projeto":"Operação Básica","mesAno":"01/2026","valor":-36898.06},{"projeto":"Alimenta +1000 Cidades","mesAno":"02/2026","valor":-47277.93},{"projeto":"CAR DPG","mesAno":"02/2026","valor":-1000},{"projeto":"Co.NE","mesAno":"02/2026","valor":-57136.56},{"projeto":"Fundo Gov.Tech","mesAno":"02/2026","valor":452.26},{"projeto":"Operação Básica","mesAno":"02/2026","valor":-63660.26},{"projeto":"Alimenta +1000 Cidades","mesAno":"03/2026","valor":-68595.57},{"projeto":"CAR DPG","mesAno":"03/2026","valor":-16428.57},{"projeto":"Co.NE","mesAno":"03/2026","valor":-51182.02},{"projeto":"Fundo Gov.Tech","mesAno":"03/2026","valor":-28517.76},{"projeto":"Inovação Crédito Fundiário","mesAno":"03/2026","valor":-41400},{"projeto":"Oficina Energias da Floresta","mesAno":"03/2026","valor":-18900},{"projeto":"Operação Básica","mesAno":"03/2026","valor":-63660.26},{"projeto":"Alimenta +1000 Cidades","mesAno":"04/2026","valor":-139163.09},{"projeto":"CAR DPG","mesAno":"04/2026","valor":-23000},{"projeto":"Co.NE","mesAno":"04/2026","valor":-51799.88},{"projeto":"Fundo Gov.Tech","mesAno":"04/2026","valor":30383.65},{"projeto":"Inovação Crédito Fundiário","mesAno":"04/2026","valor":-31050},{"projeto":"Operação Básica","mesAno":"04/2026","valor":-67972.76},{"projeto":"Alimenta +1000 Cidades","mesAno":"05/2026","valor":-317304.85},{"projeto":"CAR DPG","mesAno":"05/2026","valor":-45826.53},{"projeto":"Co.NE","mesAno":"05/2026","valor":-46105.45},{"projeto":"Fundo Gov.Tech","mesAno":"05/2026","valor":-3028.53},{"projeto":"Inovação Crédito Fundiário","mesAno":"05/2026","valor":-20700},{"projeto":"Operação Básica","mesAno":"05/2026","valor":-62526.93},{"projeto":"Alimenta +1000 Cidades","mesAno":"06/2026","valor":-315511.48},{"projeto":"CAR DPG","mesAno":"06/2026","valor":-29564.53},{"projeto":"Co.NE","mesAno":"06/2026","valor":215622.09},{"projeto":"Operação Básica","mesAno":"06/2026","valor":-67906.93},{"projeto":"Alimenta +1000 Cidades","mesAno":"07/2026","valor":-408738.11},{"projeto":"CAR DPG","mesAno":"07/2026","valor":-103442.13},{"projeto":"Co.NE","mesAno":"07/2026","valor":-24219.01},{"projeto":"Operação Básica","mesAno":"07/2026","valor":201316},{"projeto":"Parceria MDIC","mesAno":"07/2026","valor":1293680.76},{"projeto":"Alimenta +1000 Cidades","mesAno":"08/2026","valor":-300307.89},{"projeto":"CAR DPG","mesAno":"08/2026","valor":-112971.63},{"projeto":"Co.NE","mesAno":"08/2026","valor":-75084.37},{"projeto":"Operação Básica","mesAno":"08/2026","valor":-72110.26},{"projeto":"Parceria MDIC","mesAno":"08/2026","valor":-52507.33},{"projeto":"Alimenta +1000 Cidades","mesAno":"09/2026","valor":-334736.26},{"projeto":"CAR DPG","mesAno":"09/2026","valor":-51708.98},{"projeto":"Co.NE","mesAno":"09/2026","valor":-65345.43},{"projeto":"Operação Básica","mesAno":"09/2026","valor":-69376.84},{"projeto":"Parceria MDIC","mesAno":"09/2026","valor":-235560.23},{"projeto":"Plataforma Desafio 3.0","mesAno":"09/2026","valor":-21600},{"projeto":"Alimenta +1000 Cidades","mesAno":"10/2026","valor":-126112.62},{"projeto":"CAR DPG","mesAno":"10/2026","valor":-45773.34},{"projeto":"Co.NE","mesAno":"10/2026","valor":-25000},{"projeto":"Operação Básica","mesAno":"10/2026","valor":-62833.33},{"projeto":"Parceria MDIC","mesAno":"10/2026","valor":-78324.86}];

const UTILIZACAO: [string, string][] = [["12/2023","utilizado"],["01/2024","utilizado"],["02/2024","utilizado"],["03/2024","utilizado"],["04/2024","utilizado"],["05/2024","utilizado"],["06/2024","utilizado"],["07/2024","utilizado"],["08/2024","utilizado"],["09/2024","utilizado"],["10/2024","utilizado"],["11/2024","utilizado"],["12/2024","utilizado"],["01/2025","utilizado"],["02/2025","utilizado"],["03/2025","utilizado"],["04/2025","utilizado"],["05/2025","utilizado"],["06/2025","utilizado"],["07/2025","utilizado"],["08/2025","utilizado"],["09/2025",""],["10/2025",""],["11/2025",""],["12/2025",""],["01/2026",""],["02/2026",""],["03/2026",""],["04/2026",""],["05/2026",""],["06/2026",""],["07/2026",""],["08/2026",""],["09/2026",""]];

const ENCERRADOS: [string, number][] = [["Plataforma Desafio 3.0",202412],["Datathon",202505],["Ambiente Promotor de Inovação",202505],["Feira Reversa",202505],["Impulso Regional",202511],["Inovação Crédito Fundiário",202512],["Oficina Alimenta Cidades",202512],["Fundo Gov.Tech",202604],["Oficina Energias da Floresta",202602]];

const INATIVOS: string[] = ["Ambiente Promotor de Inovação","Datathon","Empreendedoras Tech","Feira Reversa","Fundo Gov.Tech","Impulso Regional","Inovação Crédito Fundiário","Oficina Alimenta Cidades","Oficina Energias da Floresta","Oficina MCTI"];

/** Transferências do Ofício nº 04/2026, com efeito na abertura de 08/2026. */
export const TRANSFERENCIAS_OFICIO = [
  { mesAno: '08/2026', projeto: 'CAR DPG', valor: -72847.81 },
  { mesAno: '08/2026', projeto: 'Plataforma Desafio 3.0', valor: 72847.81 },
  { mesAno: '08/2026', projeto: 'Co.NE', valor: -26200.66 },
  { mesAno: '08/2026', projeto: 'Plataforma Desafio 3.0', valor: 26200.66 },
  { mesAno: '08/2026', projeto: 'Parceria MDIC', valor: -13477.05 },
  { mesAno: '08/2026', projeto: 'Plataforma Desafio 3.0', valor: 13477.05 },
  // Destinação própria: sai da Operação Básica e entra na Plataforma.
  { mesAno: '08/2026', projeto: 'Operação Básica', valor: -37476.59 },
  { mesAno: '08/2026', projeto: 'Plataforma Desafio 3.0', valor: 37476.59 },
];

export function entradaDeTeste(comTransferencias = true): EntradaRateio {
  return {
    porMes: POR_MES,
    lancamentos: comTransferencias ? [...LANCAMENTOS, ...TRANSFERENCIAS_OFICIO] : [...LANCAMENTOS],
    utilizacaoPorMes: new Map(UTILIZACAO),
    projetosEncerrados: new Map(ENCERRADOS),
    projetosInativos: new Set(INATIVOS),
    projetosSemAtribuicao: PROJETOS_SEM_ATRIBUICAO_RENDIMENTOS,
  };
}
