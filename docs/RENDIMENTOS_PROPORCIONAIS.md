# Rendimentos Proporcionais por Projeto

## Contexto

Os rendimentos financeiros da conta da parceria ENAP são gerados pela aplicação do saldo total da conta em CDB/fundo de renda fixa. Como a conta agrega recursos de múltiplos projetos, os extratos bancários registram o rendimento no nível da conta — sem discriminação por projeto.

Este documento descreve a metodologia implementada no sistema para **atribuir proporcionalmente** esses rendimentos a cada projeto. O cálculo é **exclusivamente informativo** e não altera a classificação contábil histórica dos rendimentos.

---

## Localização nos dados

| Aba Google Sheets | Conteúdo |
|---|---|
| `Rendimentos` | Rendimentos brutos, IOF/IR, líquidos e campo `utilizacao` (utilizado/vazio) |
| `Lançamentos` | Entradas e saídas por projeto com campo `projeto` e `mesAno` |
| `Detalhamento de Projetos` | Transferências de saldo encerrado (`SaldoRemanescente`) com data de encerramento por projeto |

---

## Metodologia

### Princípio base

Para cada mês com rendimento, o sistema calcula o **saldo corrente de cada projeto** na conta bancária até aquele mês. O rendimento líquido do mês é distribuído proporcionalmente aos saldos positivos.

```
pct_projeto(mês) = saldo_projeto(mês) / soma_dos_saldos_positivos(mês)
rendimento_atribuido(mês) = rendimento_liquido(mês) × pct_projeto(mês)
```

### Como o saldo por projeto é calculado

O sistema usa os `Lançamentos` (que têm campo `projeto`) para construir um **saldo corrente por projeto** mês a mês:

```
saldo_projeto(mês) = Σ(lançamentos do projeto até o mês inclusive)
```

O rendimento é apurado no **último dia do mês**, portanto os lançamentos do próprio mês **são incluídos** no cálculo do saldo base daquele mês.

### Projetos encerrados

Projetos que foram encerrados e tiveram seus saldos transferidos para Operação Básica (registrados em `Detalhamento de Projetos`) **deixam de contribuir** para a base de cálculo após a data de encerramento:

```
se mc > data_encerramento_projeto: saldo_projeto = 0
```

Isso garante que apenas projetos com recursos ativos na conta recebam atribuição proporcional.

### Reset de período (utilizado → disponível)

A conta passou por duas fases distintas:

| Período | Classificação | Descrição |
|---|---|---|
| Até ago/2025 | **utilizado** | R$ ~230k formalizados via Transferegov para Operação Básica por atraso de aporte |
| Set/2025 em diante | **disponível** | Novo saldo, sem destino definido |

O **acumulado** exibido no sistema **zera ao entrar no período disponível**. Isso evita distorção: o saldo "utilizado" foi consumido pela Operação Básica, não pelos projetos em carteira.

---

## Implementação técnica

### Componentes envolvidos

| Componente | Arquivo | Função |
|---|---|---|
| `RendimentosComponent` | `rendimentos.component.ts` | Tela de Rendimentos — tabela mensal clicável com modal de atribuição por projeto |
| `VisaoProjetoComponent` | `visao-projeto.component.ts` | Visão por Projeto — accordion com tabela mensal para o projeto selecionado |

### Algoritmo (O(meses + lançamentos))

```typescript
const mesKeyNum = (s: string) => { const [m, y] = s.split('/'); return parseInt(y)*100+parseInt(m); };

// 1. Ordena lançamentos cronologicamente
const lancsSorted = [...allLancamentos].filter(l => l.mesAno).sort((a,b) => mesKeyNum(a.mesAno) - mesKeyNum(b.mesAno));

// 2. Para cada mês de rendimento (cronológico)
const runningBalance = new Map<string, number>();
let lIdx = 0;

for (const mes of allMonthsSorted) {
  const mc = mesKeyNum(mes.mesAno);

  // 3. Avança saldo corrente até o final do mês (inclusive)
  while (lIdx < lancsSorted.length && mesKeyNum(lancsSorted[lIdx].mesAno) <= mc) {
    const l = lancsSorted[lIdx++];
    runningBalance.set(l.projeto, (runningBalance.get(l.projeto) ?? 0) + l.valor);
  }

  // 4. Zera projetos encerrados antes deste mês
  projetosEncerrados.forEach((closedMc, proj) => {
    if (mc > closedMc) runningBalance.set(proj, 0);
  });

  // 5. Distribui rendimento proporcionalmente
  const totalPos = Array.from(runningBalance.values()).reduce((s, v) => s + (v > 0 ? v : 0), 0);
  if (totalPos > 0 && mes.liquido > 0) {
    runningBalance.forEach((saldo, proj) => {
      if (saldo > 0) projRendAcum.set(proj, (projRendAcum.get(proj) ?? 0) + mes.liquido * (saldo / totalPos));
    });
  }
}
```

### Fontes de dados (DataService)

| Método | Dados |
|---|---|
| `getRendimentoResumo()` | `{ porMes: [{ mesAno, bruto, imposto, liquido, acumulado }] }` |
| `getRendimentos()` | `Rendimento[]` — campo `utilizacao` determina utilizado vs disponível |
| `getSaldos()` | `SaldoRemanescente[]` — data de encerramento por projeto |
| `lancamentos$` | `Lancamento[]` — saldos por projeto com `mesAno` |

---

## Visão por Projeto

Na tela **Visão por Projeto**, ao selecionar um projeto, o sistema exibe automaticamente um accordion "Rendimentos Proporcionais Atribuídos" quando há dados disponíveis. A tabela mostra:

| Coluna | Descrição |
|---|---|
| Mês/Ano | Mês em que o rendimento foi apurado |
| % Participação | Proporção do saldo do projeto sobre o total positivo da conta |
| Saldo na Conta | Saldo acumulado do projeto até aquele mês |
| Rendimento do Mês | Rendimento líquido atribuído proporcionalmente |
| Acumulado | Soma dos rendimentos atribuídos desde o início do período disponível |

### Exemplo: Alimenta +1000 Cidades

O projeto Alimenta +1000 Cidades entrou na conta em dezembro de 2025, coincidindo com o início do período "disponível". Portanto:

- Aparece nas atribuições a partir de **12/2025**
- O acumulado parte de zero em 12/2025 (reset de período)
- Nos meses seguintes acumula progressivamente
- O cálculo reflete a participação proporcional no contexto de todos os projetos com saldo positivo na conta

---

## Nota importante

> Este cálculo **não tem efeito contábil**. Os rendimentos continuam registrados globalmente na conta da parceria. A atribuição proporcional é uma visão analítica para gestão interna, criada porque as planilhas não dispõem nativamente desta perspectiva por projeto.
