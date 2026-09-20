# sync — realizado do dashboard → planilha de orçamento

Scripts de linha de comando que levam o rendimento **realizado** da Base para a
planilha oficial de orçamento. Direção única: a Base é a fonte, a planilha é o
destino. Nada é lido de volta da planilha como realizado.

## Planilhas

**Origem (leitura)** — `1ig0YnBpDncfJZu9Qf6IXzUc2jjKiDEVKLOdLPopwPCM`
"Base de Dados • ENAP Financial Dash". É a mesma planilha que alimenta o
dashboard. Abas usadas: `Principal` (gid 0), `Rendimentos` (gid 2032068393),
`Saldos remanescentes` (gid 86178020), `Status Projetos` (gid 1699326950).

**Destino (escrita)** — `17p7C3t-RwPiS6aI04ihD0vSFNtNCnMQFKH-fS9CGTOM`
"Orçamento e Rendimentos 2026-2028 • Projetos do Convênio ENAP & Impact Hub".
Google Planilha **nativa**.

> ⚠️ Não usar `1fd5ou9MV5tHArxuQnKIn-B6pypxa6Bsn` como destino. É um `.xlsx`
> antigo no Drive, não é a planilha viva. `sincronizar.js` aborta se o destino
> for esse ID.

## Credenciais

Service account em `../.secrets/enap-financial-dash.json`, fora do repositório
(`.gitignore`). A conta precisa de permissão de edição na planilha de destino.
Nenhum script contém chave, token ou senha — todos leem o arquivo por caminho.

## Os dois métodos de rateio — e por que só um vale

O dashboard calcula a atribuição de rendimentos por projeto de duas formas
diferentes, em `src/app/pages/rendimentos/rendimentos.component.ts`:

| | Método | Como distribui |
|---|---|---|
| **A** | `abrirDetalhe()` → campo `rendimentoMes` | Tira uma foto do saldo de cada projeto no mês avaliado e soma `srOutrosProjetos` (o saldo remanescente agregado dos demais projetos) em Operação Básica. |
| **B** | `computarHistoricoPorProjeto()` | Caminha mês a mês com o saldo corrente. A cada mês, projetos encerrados têm o saldo zerado e **transferido para Operação Básica**; o líquido do mês é rateado sobre os saldos positivos resultantes. |

**Método B é a metodologia oficial.** É o que `rateio-dashboard.js` replica e o
que `sincronizar.js` grava. Validado por três critérios independentes:

1. reproduz aos centavos os cinco valores do modal de julho/2026;
2. reproduz jan–jun/2026 exatamente como já estavam na planilha oficial;
3. fecha o checkpoint do Ofício nº 04/2026 com diferença **R$ 0,00**.

O método A produz um rateio parecido mas com Operação Básica subestimada —
foi ele que preencheu julho/2026 por engano, depois corrigido.

> **Nunca valide o algoritmo contra os valores correntes de um mês recém-preenchido
> da planilha.** Se o mês foi preenchido com a fórmula errada, reproduzi-lo só
> confirma o erro. Os critérios válidos são o Ofício e os meses fechados anteriores.

## Checkpoint do Ofício nº 04/2026

Rendimento acumulado por projeto em 31/07/2026, período disponível de 09/2025 a
07/2026 (11 meses). É a **validação obrigatória antes de qualquer gravação**:

| Projeto | Valor |
|---|---|
| Alimenta +1000 Cidades | R$ 387.456,64 |
| CAR DPG | R$ 72.847,81 |
| Operação Básica | R$ 37.476,59 |
| Co.NE | R$ 26.200,66 |
| Parceria MDIC | R$ 13.477,05 |
| **Total** | **R$ 537.458,75** |

```bash
node sync/checkpoint-oficio.js
```

Tolerância total: R$ 0,02. O script sai com código 1 se não fechar — use-o como
porta de entrada do procedimento.

## Mês negativo: a regra de carregamento

**11/2025 tem rendimento líquido negativo: −R$ 2.060,93.**

O método B não rateia mês negativo sobre saldos positivos. O valor fica
carregado (`undistributed`) e entra no **próximo mês distribuível**. Por isso
12/2025 distribui R$ 62.630,92 e não os R$ 64.691,85 do próprio mês:

```
12/2025:  líquido 64.691,85  +  carregado de 11/2025 (−2.060,93)  =  62.630,92 distribuído
```

Consequência prática, e é a pegadinha da rotina: **o alvo de fechamento de um
mês é o valor distribuído, nunca `porMes.liquido`.** Fechar contra o líquido do
próprio mês reinjeta o carregado e infla o acumulado em R$ 2.060,93 — exatamente
o erro que a reconciliação de 09/2026 encontrou. `rateioHistorico()` devolve
`mesLiquido` já com o distribuído, e guarda `liquidoOficial` e `carregado` à
parte para conferência.

Nos meses em que nada é carregado — todos de 12/2025 em diante — distribuído e
líquido coincidem, e o mês fecha contra o próprio total.

## Ajuste de centavos

Coisa distinta do carregamento, e não se misturam. Cada valor por projeto é
arredondado para centavos; se a soma não bater com o valor distribuído do mês, o
resíduo (sempre ±R$ 0,01) vai para **o projeto de maior participação naquele
mês**, que é a mesma regra do dashboard.

Exemplo: agosto/2026 arredondado dá R$ 64.710,04, um centavo acima do líquido
real de R$ 64.710,03 — o −R$ 0,01 é absorvido por Alimenta +1000 Cidades
(38.814,68 → 38.814,67).

Nenhum resíduo vira linha de ajuste técnico na planilha: ele é absorvido dentro
do valor do projeto.

## Estrutura da planilha de destino

- **Linha 4** — marca do mês: `realizado` ou `orçado`.
- **Linha 5** — meses. São datas de verdade; leia com `FORMATTED_VALUE`
  (`"jul./26"`), porque `FORMULA` devolve o serial (`46204`).
- **Linha 8** — Rendimentos nas abas de projeto. **Linha 12** no consolidado.

Cada aba tem um offset de coluna próprio — `parceria • MDIC` começa em jul./26
na coluna C, enquanto as demais começam em jan./26. Por isso todo script mapeia
mês → coluna lendo a linha 5 **de cada aba**, nunca por posição fixa.

Meses realizados guardam valor fixo nas abas de projeto. Meses futuros guardam a
projeção `=MAX(0;AVERAGE(saldo; saldo+entradas+saídas)*0,9597%)`.

**O consolidado (linha 12) permanece fórmula** — `=SUM` das cinco abas de
projeto. Não substituir por valor fixo: ele deve continuar somando o que as abas
de projeto trazem.

A reprojeção dos meses futuros é automática. `Saldo Inicial = Saldo Final do mês
anterior` e `Saldo Final = Resultado + Saldo Inicial`, e o Resultado inclui a
linha de Rendimentos. Fixar um mês como realizado move o saldo e todos os meses
seguintes se recalculam sozinhos.

## Procedimento de sincronização

### 1. Validar o checkpoint

```bash
node sync/checkpoint-oficio.js
```

Só prossiga se fechar.

### 2. Simular

```bash
node sync/sincronizar.js                 # padrão: 07/2026 e 08/2026
node sync/sincronizar.js 09/2026         # um mês específico
```

Sem `--write` nada é gravado. A saída mostra, célula a célula, o valor atual
(indicando se é `valor` fixo ou `projeção`), o valor que entraria, e a contagem
de meses futuros que continuam em fórmula.

### 3. Fazer o backup

```bash
node sync/snapshot.js antes-do-que-for
```

Grava `sync/backups/<timestamp>-<rótulo>.json` com fórmula, valor calculado e
marca de cada célula das linhas 4, 5 e 8/12 das seis abas.

### 4. Gravar

```bash
node sync/sincronizar.js --write
node sync/sincronizar.js 09/2026 --write
```

Guardas ativas: aborta se o destino for o ID proibido, se o mês for anterior a
07/2026, se o mês não existir na aba Rendimentos da Base, se o rateio não fechar
com o líquido, ou se alguma célula cair fora das linhas 4, 8 e 12.

### 5. Conferir

```bash
node sync/snapshot.js depois-do-que-for
node sync/conferir.js sync/backups/<snapshot-anterior>.json
```

`conferir.js` relê a planilha do zero e verifica: valores de julho e agosto nas
cinco abas, soma por mês, marca `realizado` nas seis abas, consolidado ainda em
fórmula e com o total certo, meses futuros ainda em fórmula, e a variação das
projeções antes × depois. Sai com código 1 se algo falhar.

## Backup e restauração

Os snapshots ficam em `sync/backups/`, **fora do repositório** (`.gitignore`):
contêm dados financeiros da planilha oficial e são específicos da máquina.
Mantenha-os localmente enquanto a gravação puder precisar de reversão.

Para restaurar, cada entrada do JSON traz o que a célula tinha antes:

```json
"ago./26": {
  "celula": "J8",
  "marca": "orçado",
  "conteudo": "=MAX(0;AVERAGE(J31;J31+J7+J27)*0,9597%)",
  "calculado": 2691.72,
  "ehFormula": true
}
```

Reverter é reescrever `conteudo` na célula indicada (a fórmula original, se
`ehFormula`) e `marca` na linha 4 da mesma coluna. `calculado` serve só de
conferência do que a célula exibia.

## Scripts

| Arquivo | O que faz | Escreve? |
|---|---|---|
| `rateio-dashboard.js` | Réplica fiel dos métodos A e B em Node. Módulo usado pelos demais; rodando direto, compara os dois métodos para os meses pedidos. | não |
| `checkpoint-oficio.js` | Valida o acumulado em 31/07/2026 contra o Ofício nº 04/2026. | não |
| `reconciliar.js` | Reconcilia 09/2025–08/2026 contra o método B e corrige divergências de centavos. | **com `--write`** |
| `movimentacoes.js` | Cria a aba de movimentações e os blocos da carteira autorizada. | **com `--write`** |
| `conferir-carteira.js` | Confere a carteira: não-contaminação, fechamentos, teto, rastreio, proteções. | não |
| `testar-apps-script.js` | Roda o `.gs` real em Node contra a Base e confere o método B. | não |
| `snapshot.js` | Backup das células afetadas, em JSON. | não |
| `sincronizar.js` | Grava o realizado e a marca `realizado`. Simula por padrão. | **com `--write`** |
| `conferir.js` | Releitura e conferência pós-gravação. | não |
| `inspecionar-base.js` | Lista abas e amostras da Base. | não |
| `inspecionar-orcamento.js` | Lista abas, cabeçalhos e fórmulas do orçamento. | não |
| `ler-estruturas.js` | Reconhecimento do layout das abas. | não |
| `fuso-e-abas.js` | Confere fuso horário e nomes de abas. | não |
| `testar-acesso.js` | Testa credencial e acesso às duas planilhas. | não |
| `projecao-movimentacoes.js` | Cria/atualiza a aba técnica "Dashboard • Movimentações Rendimentos", projeção por fórmula dos treze campos do dashboard. | **sim** |
| `testar-atualizacao-automatica.js` | Prova que o dashboard lê a planilha ao vivo: insere uma movimentação de teste, mostra o CSV publicado mudando e remove. | **sim (temporário)** |
| `gerar-fixture-rateio.js` | Gera a fixture do teste de regressão do rateio a partir da Base. | não |
| `exportar-oficio.js` | Gera o **fallback** `public/oficio-04-2026.json`. Não é mais a fonte do dashboard. | não |

## Reconciliação do histórico

`reconciliar.js` percorre todo o período disponível (09/2025–08/2026), recalcula
cada mês pelo método B e compara, célula a célula, com o que está na linha
"Rendimentos" e com a abertura histórica embutida na linha "Saldo acumulado de
rendimentos" (`=45640,79+C8` e equivalentes).

```bash
node sync/reconciliar.js            # tabela completa + lista de divergências
node sync/reconciliar.js --write    # corrige só as células divergentes
```

Trava: recusa qualquer correção acima de R$ 0,02 — diferença maior não é
arredondamento, é metodologia, e não se conserta por aqui. Ao corrigir uma
abertura, reescreve apenas a constante e preserva a fórmula.

Em 20/09/2026 corrigiu 4 células (jan, fev e jun/2026 e a abertura da aba
Alimenta, ±R$ 0,01 cada). Hoje acusa **0 divergências**: os doze meses fecham ao
centavo e os acumulados das cinco abas batem com o consolidado.

## Carteira autorizada — Ofício nº 04/2026

A aba **"Movimentações de Rendimentos"** é um **livro memorando**: ela classifica
rendimento que já existe, não movimenta dinheiro. A garantia é estrutural —
nenhuma fórmula de Rendimentos, TOTAL, Resultado, Saldo Inicial ou Saldo Final
referencia essa aba, e `conferir-carteira.js` relê a planilha para provar isso.

16 colunas: as 13 originais mais `valor_com_sinal`, `status` (`vigente` /
`cancelada` — revogar não apaga linha) e `competencia_data`. Esta última guarda
a competência como **data**, e não texto, para o `SUMIFS` comparar direto com o
cabeçalho da linha 5: evita `TEXT(...;"yyyy-mm")`, cujo código de formato depende
do idioma da planilha.

Validação de lista em `tipo`, `status` e `projeto_origem`. Proteção do tipo
**aviso** nas colunas derivadas (`id_movimentacao`, `atualizado_em`,
`valor_com_sinal`, `competencia_data`) e nos blocos de carteira — avisa ao editar
sem travar o dono da planilha nem impedir novos lançamentos.

### Regra de consumo

`projeto_origem` é **obrigatório e nunca inferido**: é a cota de rendimento
autorizada que financia o pagamento. Pode coincidir com o projeto do pagamento,
como no caso do 10647074, mas não se deduz um do outro. Não há rateio
proporcional, ordem automática nem fallback para outra cota — utilização acima da
cota disponível **aborta a gravação**. Usar saldo autorizado de outro projeto
exige uma movimentação nova, escrita explicitamente, com id próprio.

### Blocos nas abas

Ancorados na linha "Saldo acumulado de rendimentos", que já existia em cada aba:

```
L<acum>    Saldo acumulado de rendimentos        [existente, intocado]
L<acum+1>  (−) Total autorizado · Ofício 04/2026
L<acum+2>  (=) Rendimento livre / não autorizado
L<acum+3>  Carteira autorizada · total autorizado
L<acum+4>  (−) Utilizado da carteira autorizada
L<acum+5>  (=) Autorizado disponível
```

O livre usa o **total originalmente autorizado**, nunca o disponível — subtrair o
disponível devolveria ao saldo livre um valor já pago.

O consolidado tem mais três linhas: saldo financeiro remanescente e duas
conferências que devem dar zero (identidade da carteira, e soma das cinco abas
contra o consolidado).

**O saldo financeiro remanescente é ancorado no último mês realizado**
(`=$J$31+…`, com J = ago./26), não na coluna corrente: misturar projeção de meses
futuros com uma utilização que já aconteceu produziria número sem sentido. O
script descobre essa coluna pela marca "realizado" da linha 4 — rodar de novo
depois de fechar um mês reancora sozinho.

```bash
node sync/movimentacoes.js               # simula
node sync/movimentacoes.js --write       # grava (idempotente)
node sync/conferir-carteira.js --antes   # salva o estado das linhas de caixa
node sync/conferir-carteira.js           # confere tudo
```

Dez testes bloqueiam a gravação, entre eles o rastreio reverso (todo
`numero_pagamento` de utilização tem de existir na Base com mesmo valor, projeto
e competência), o teto por projeto, e a conferência de que cada autorização é
igual ao acumulado daquele projeto em 31/07/2026 pelo método B.

## Como o dashboard lê as movimentações (fonte ao vivo)

O dashboard **não** depende mais de exportar JSON à mão. A aba
**"Movimentações de Rendimentos"** da planilha de Orçamento está publicada na
web em CSV, e o `DataService` a lê a cada carregamento:

```
environment.movimentacoesRendimentosUrls   →  DataService.getMovimentacoesRendimentos()
```

É o mesmo mecanismo das abas da Base — CSV publicado + Papa.parse. Registrou uma
nova utilização da carteira na planilha? Ela aparece no dashboard no próximo
carregamento, em cerca de um minuto (o CSV publicado tem cache curto do lado do
Google). Nenhum script, nenhum deploy.

**Comprovação.** `node sync/testar-atualizacao-automatica.js` insere uma
movimentação de teste, mostra o CSV publicado mudando e remove a linha. Feito em
20/09/2026: o utilizado foi de R$ 21.600,00 para R$ 22.834,56 e o disponível de
R$ 128.402,11 para R$ 127.167,55 na tela, com o JSON local intocado — e voltou
ao original quando a linha saiu.

### A ordem das fontes

`environment.ts` lista as fontes; são tentadas **em série** e a primeira que
responder com o cabeçalho esperado vence:

1. aba oficial "Movimentações de Rendimentos" (gid `185205069`) — a publicada hoje;
2. aba técnica "Dashboard • Movimentações Rendimentos" (gid `96584928`);
3. `public/oficio-04-2026.json` — fallback local.

Em série, e não em paralelo, porque uma aba não publicada responde com
redirecionamento para o login do Google: em paralelo isso vira um erro de CORS
no console a cada carregamento, mesmo quando outra fonte atendeu.

### Publicar a projeção técnica (recomendado, 2 cliques)

`node sync/projecao-movimentacoes.js` já criou a aba **"Dashboard •
Movimentações Rendimentos"** na planilha de Orçamento. Ela é uma projeção só por
fórmula da aba oficial, com **apenas os treze campos** que o dashboard usa —
sem `categoria`, `fornecedor` nem a observação interna de cada lançamento.
Qualquer edição na aba oficial aparece nela no mesmo instante.

Hoje o que está público é a aba oficial, com todas as colunas. Para reduzir o
que fica exposto:

1. na planilha de Orçamento: **Arquivo › Compartilhar › Publicar na web**;
2. trocar a aba publicada de "Movimentações de Rendimentos" para
   **"Dashboard • Movimentações Rendimentos"**, formato **CSV**.

Não é preciso mexer em código nem publicar o dashboard: a primeira fonte passa a
falhar, a segunda responde e a leitura migra sozinha.

> A aba técnica **não** pôde ser criada na "Base de Dados • ENAP Financial
> Dash", como seria o natural: a service account tem leitura na Base, não
> escrita (`batchUpdate` devolve "The caller does not have permission"), e
> IMPORTRANGE entre as duas planilhas exigiria a autorização de par
> origem→destino, que só existe pelo botão "Permitir acesso" da interface. Ficar
> na própria planilha de Orçamento dispensa IMPORTRANGE — é referência direta
> entre abas — e evita uma segunda cópia dos dados.

### Instalar os Apps Script corrigidos

Os dois arquivos em `apps-script/` estão corrigidos no repositório mas **ainda
não instalados** — o acesso ao editor de scripts não está disponível por aqui.

**Até a substituição, não use o menu antigo da planilha.** O
`calcularAtribuicao_` da versão instalada ainda reproduz o método A, que
diverge do método B oficial.

Para substituir (na planilha de Orçamento):

1. **Extensões › Apps Script**;
2. abrir o arquivo `SyncRendimentos.gs`, selecionar tudo e colar o conteúdo de
   `apps-script/SyncRendimentos.gs` deste repositório;
3. fazer o mesmo com `SyncExecucao.gs` e `apps-script/SyncExecucao.gs`;
4. **Salvar** (Ctrl+S) e recarregar a planilha, para o menu ser recriado;
5. conferir com `node sync/testar-apps-script.js`, que roda o `.gs` real contra
   a Base e compara com o método B — tem de fechar sem divergência.

## Pendências técnicas conhecidas

**Julho/2026 no consolidado (I12) é valor fixo**, enquanto agosto (J12) é
fórmula. Os dois estão corretos — R$ 70.380,05 e R$ 64.710,03. **Decisão: manter
como está**, sem mexer por uniformidade visual.
