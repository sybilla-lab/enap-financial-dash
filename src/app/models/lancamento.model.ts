export interface Lancamento {
  categoria: string;
  observacao: string;
  projeto: string;
  mesAno: string;
  valor: number;
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
}

export interface ProjetoResumo {
  projeto: string;
  entradas: number;
  saidas: number;
  saldo: number;
  execucao: number;
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
  aporteRecebido: number;
  captacaoRecebida: number;
  captacaoPrevista: number;
  captacaoTotal: number;
  totalRecebido: number;
  totalComPrevisto: number;
}
