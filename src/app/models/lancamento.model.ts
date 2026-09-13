export interface Lancamento {
  categoria: string;
  observacao: string;
  projeto: string;
  mesAno: string;
  valor: number;
  numPag: string;
  fornecedor?: string;
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
  saldoRemanescente?: number;
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
  /**
   * Aporte + correção pelo IPCA. Decisão de 13/09/2026: a correção integra o
   * total financeiro recebido da Enap (houve entrada do recurso), mas NÃO conta
   * como parcela da meta original de aporte — por isso fica em campo próprio.
   */
  totalRecebidoEnap: number;
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

export interface Rendimento {
  categoria: string;
  data: string;
  mesAno: string;  // derivado de data
  valor: number;
  utilizacao: string; // preenchido = utilizado; vazio = disponível
}

/**
 * Item oficial do Glossário de Categorias Orçamentárias.
 * Fonte única: aba "Glossário de Categorias" da Base de Dados ENAP Financial Dash.
 */
export interface CategoriaGlossario {
  codigo: string;      // "1.2.2"
  nome: string;        // "Serviços de especialistas" (grafia oficial, sem o código)
  rotulo: string;      // "1.2.2 Serviços de especialistas"
  meta: string;        // "1" | "2" | "3" | "4"
  etapa: string;
  descricao: string;
}

/**
 * Resultado da normalização de uma categoria bruta da base contra o Glossário.
 * A base nunca é alterada — `original` preserva o texto como foi lançado.
 */
export interface CategoriaNormalizada {
  original: string;               // texto exatamente como está na planilha
  codigo: string;                 // código extraído ("1.1.9")
  oficial: CategoriaGlossario | null;
  rotulo: string;                 // nome oficial quando houver; senão o original
  natureza: 'despesa' | 'receita';
  mapeado: boolean;
  /** Preenchido quando o lançamento foi remapeado para outro código (ex.: Tarifas → 1.1.8). */
  observacaoAuditoria?: string;
}
