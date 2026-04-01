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
  observacao2: string; // "inflação" ou vazio
}

export interface ProjetoResumo {
  projeto: string;
  entradas: number;
  saidas: number;
  saldo: number;
  execucao: number;
  status?: string; // Ativo, Em encerramento, Finalizado
}

export interface StatusProjeto {
  projeto: string;
  status: string;
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
  aporteRecebido: number;        // Aporte recebido SEM inflação
  aporteInflacao: number;         // Valor da inflação recebida
  aporteRecebidoTotal: number;    // Aporte recebido + inflação
  aportePrevisto: number;         // Aporte previsto futuro
  captacaoRecebida: number;
  captacaoPrevista: number;
  captacaoTotal: number;
  saldoACaptar: number;           // Valor que falta para atingir a meta de captação
  totalRecebido: number;
  totalComPrevisto: number;
}

export interface SaldoRemanescente {
  data: string;
  parceiro: string;
  projeto: string;
  valorTransferido: number;
  valorProjeto: number;
  percentualSobra: number;
}
