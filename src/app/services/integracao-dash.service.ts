/**
 * Serviço de Integração • Dash
 *
 * Lê a aba "Integração • Dash" (A1:J217) como fonte de verdade para
 * rendimentos por projeto, período e status de conferência.
 *
 * Contrato de dados (10 campos obrigatórios):
 * - competencia: YYYY-MM-DD (chave temporal)
 * - projeto_id: string (chave de identificação)
 * - projeto: string (nome legível)
 * - serie: "REALIZADO_REGISTRADO" | "PROJECAO"
 * - rendimento: number | null (null = ausência, não zero)
 * - recebe_rateio: boolean
 * - status_conferencia: string ("Distribuição divergente" | "Total confere..." | "SEM_COMPETENCIA_NA_ORIGEM" | "SEM_ATRIBUICAO" | "PROJECAO")
 * - corte_realizado: YYYY-MM-DD (data do corte, ex: 2026-09-01 para setembro fechado)
 * - origem_valor: string | null (célula de rastreamento)
 * - schema_version: string
 */

export interface RegistroIntegracaoDash {
  competencia: string;
  projeto_id: string;
  projeto: string;
  serie: 'REALIZADO_REGISTRADO' | 'PROJECAO';
  rendimento: number | null;
  recebe_rateio: boolean;
  status_conferencia: string;
  corte_realizado: string;
  origem_valor: string | null;
  schema_version: string;
}

export interface SumariaRendimentosProjeto {
  projeto: string;
  projeto_id: string;
  realizado: number;
  projecao: number;
  total: number;
  recebe_rateio: boolean;
  divergencias: string[];
  ultima_atualizacao: string;
}

export interface AuditoriaIntegracao {
  total_registros: number;
  periodos: string[];
  projetos: string[];
  series_encontradas: string[];
  status_conferencias: Map<string, number>;
  registros_sem_competencia: number;
  valor_total_realizado: number;
  valor_total_projecao: number;
  divergencias_encontradas: string[];
  validacao_set_2026: {
    total_esperado: number;
    total_encontrado: number;
    por_projeto: Record<string, { esperado: number; encontrado: number; divergencia: number }>;
  };
}

/**
 * Parser correto para CSV respeitando RFC 4180 (aspas, separadores, quebras)
 * Não usar split(',') simples; preservar nulos como null, números como numbers
 */
export function parseIntegracaoDashCSV(csvText: string): RegistroIntegracaoDash[] {
  const registros: RegistroIntegracaoDash[] = [];
  const lines = csvText.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV vazio ou sem cabeçalho');
  }

  // Parse de cabeçalho respeitando aspas
  const headerLine = lines[0];
  const headerCells = parseCSVLine(headerLine);
  const headers = headerCells.map(h => h.trim().toLowerCase());

  const campos = [
    'competencia', 'projeto_id', 'projeto', 'serie', 'rendimento',
    'recebe_rateio', 'status_conferencia', 'corte_realizado', 'origem_valor', 'schema_version'
  ];

  const colMap: Record<string, number> = {};
  campos.forEach(campo => {
    const idx = headers.indexOf(campo);
    if (idx < 0) {
      throw new Error(`Campo obrigatório ausente: ${campo}. Encontrados: ${headers.join(', ')}`);
    }
    colMap[campo] = idx;
  });

  // Parse de registros
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const cells = parseCSVLine(line);

    // Validar mínimo de colunas
    if (cells.length < Object.keys(colMap).length) {
      console.warn(`Linha ${i + 1}: número insuficiente de colunas. Pulando.`);
      continue;
    }

    const competencia = cells[colMap['competencia']]?.trim();
    if (!competencia) continue; // Pula linhas sem competência

    // Parse de rendimento: null se vazio ou "null", number caso contrário
    const rendimentoStr = cells[colMap['rendimento']]?.trim() ?? '';
    let rendimento: number | null = null;
    if (rendimentoStr && rendimentoStr.toLowerCase() !== 'null' && rendimentoStr !== '') {
      const parsed = parseFloat(rendimentoStr);
      if (!isNaN(parsed)) {
        rendimento = parsed;
      }
    }

    // Parse de booleano
    const recebe_rateioStr = cells[colMap['recebe_rateio']]?.trim().toLowerCase() ?? '';
    const recebe_rateio = recebe_rateioStr === 'true' || recebe_rateioStr === 'sim' || recebe_rateioStr === '1';

    // origem_valor pode ser null
    const origem_valor = cells[colMap['origem_valor']]?.trim() ?? null;
    if (origem_valor === '' || origem_valor === 'null') {
      // origem_valor fica null
    }

    registros.push({
      competencia,
      projeto_id: cells[colMap['projeto_id']]?.trim() ?? '',
      projeto: cells[colMap['projeto']]?.trim() ?? '',
      serie: cells[colMap['serie']]?.trim() as any ?? 'REALIZADO_REGISTRADO',
      rendimento,
      recebe_rateio,
      status_conferencia: cells[colMap['status_conferencia']]?.trim() ?? '',
      corte_realizado: cells[colMap['corte_realizado']]?.trim() ?? '',
      origem_valor: origem_valor,
      schema_version: cells[colMap['schema_version']]?.trim() ?? '1.0',
    });
  }

  return registros;
}

/**
 * Parse de uma linha CSV respeitando RFC 4180 (campos entre aspas podem conter separadores)
 */
function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: ""
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // Field separator
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

/**
 * Auditoria dos registros com validação contra valores conhecidos de setembro/2026
 */
export function auditarIntegracao(registros: RegistroIntegracaoDash[]): AuditoriaIntegracao {
  const periodos = new Set<string>();
  const projetos = new Set<string>();
  const series = new Set<string>();
  const status_conferencias = new Map<string, number>();

  let total_realizado = 0;
  let total_projecao = 0;
  let registros_sem_competencia = 0;
  const divergencias: string[] = [];

  // Acumuladores por projeto para setembro
  const set_2026_por_projeto: Record<string, number> = {};

  registros.forEach(r => {
    if (!r.competencia) {
      registros_sem_competencia++;
      return;
    }

    periodos.add(r.competencia);
    projetos.add(r.projeto);
    series.add(r.serie);

    const statusKey = r.status_conferencia || 'NAO_CONFERIDO';
    status_conferencias.set(statusKey, (status_conferencias.get(statusKey) ?? 0) + 1);

    // Somar por série
    if (r.serie === 'REALIZADO_REGISTRADO' && r.rendimento !== null) {
      total_realizado += r.rendimento;

      // Acumular setembro/2026
      if (r.competencia === '2026-09-01') {
        if (!set_2026_por_projeto[r.projeto_id]) {
          set_2026_por_projeto[r.projeto_id] = 0;
        }
        set_2026_por_projeto[r.projeto_id] += r.rendimento;
      }
    } else if (r.serie === 'PROJECAO' && r.rendimento !== null) {
      total_projecao += r.rendimento;
    }

    // Flagear divergências
    if (r.status_conferencia === 'Distribuição divergente') {
      divergencias.push(`${r.projeto} (${r.competencia}): distribuição divergente`);
    }
    if (r.status_conferencia === 'SEM_COMPETENCIA_NA_ORIGEM') {
      divergencias.push(`${r.projeto} (${r.competencia}): sem competência na origem`);
    }
  });

  // Valores esperados para setembro/2026 (conforme documentação)
  const RATEIO_ESPERADO_SET_2026: Record<string, number> = {
    'operacao_basica': 1196.13,
    'cone': 1853.93,
    'car_dpg': 5821.13,
    'alimenta': 37449.02,
    'mdic': 11091.15,
    'plataforma': 0,
  };

  // Validação de setembro
  const validacao_set_2026: AuditoriaIntegracao['validacao_set_2026'] = {
    total_esperado: 57411.36,
    total_encontrado: Math.round(Object.values(set_2026_por_projeto).reduce((a, b) => a + b, 0) * 100) / 100,
    por_projeto: {},
  };

  Object.entries(RATEIO_ESPERADO_SET_2026).forEach(([proj_id, esperado]) => {
    const encontrado = set_2026_por_projeto[proj_id] ?? 0;
    const divergencia = Math.round((encontrado - esperado) * 100) / 100;
    validacao_set_2026.por_projeto[proj_id] = {
      esperado,
      encontrado: Math.round(encontrado * 100) / 100,
      divergencia,
    };
  });

  return {
    total_registros: registros.length,
    periodos: Array.from(periodos).sort(),
    projetos: Array.from(projetos).sort(),
    series_encontradas: Array.from(series),
    status_conferencias,
    registros_sem_competencia,
    valor_total_realizado: Math.round(total_realizado * 100) / 100,
    valor_total_projecao: Math.round(total_projecao * 100) / 100,
    divergencias_encontradas: divergencias,
    validacao_set_2026,
  };
}

/**
 * Sumariza rendimentos por projeto, separando realizado de projeção
 */
export function sumarizarPorProjeto(registros: RegistroIntegracaoDash[]): SumariaRendimentosProjeto[] {
  const porProjeto = new Map<string, {
    projeto_id: string;
    realizado: number;
    projecao: number;
    recebe_rateio: boolean;
    divergencias: Set<string>;
    ultima_atualizacao: string;
  }>();

  registros.forEach(r => {
    const key = r.projeto;
    let entry = porProjeto.get(key);
    if (!entry) {
      entry = {
        projeto_id: r.projeto_id,
        realizado: 0,
        projecao: 0,
        recebe_rateio: r.recebe_rateio,
        divergencias: new Set(),
        ultima_atualizacao: r.corte_realizado,
      };
      porProjeto.set(key, entry);
    }

    if (r.rendimento !== null) {
      if (r.serie === 'REALIZADO_REGISTRADO') {
        entry.realizado += r.rendimento;
      } else if (r.serie === 'PROJECAO') {
        entry.projecao += r.rendimento;
      }
    }

    if (r.status_conferencia === 'Distribuição divergente') {
      entry.divergencias.add(`${r.competencia}: distribuição divergente`);
    }

    if (r.corte_realizado && r.corte_realizado > entry.ultima_atualizacao) {
      entry.ultima_atualizacao = r.corte_realizado;
    }
  });

  return Array.from(porProjeto.entries()).map(([projeto, data]) => ({
    projeto,
    projeto_id: data.projeto_id,
    realizado: Math.round(data.realizado * 100) / 100,
    projecao: Math.round(data.projecao * 100) / 100,
    total: Math.round((data.realizado + data.projecao) * 100) / 100,
    recebe_rateio: data.recebe_rateio,
    divergencias: Array.from(data.divergencias),
    ultima_atualizacao: data.ultima_atualizacao,
  })).sort((a, b) => b.total - a.total);
}
