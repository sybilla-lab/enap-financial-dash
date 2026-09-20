/**
 * Movimentações de rendimentos — planilha "Orçamento e Rendimentos 2026-2028".
 *
 * Tentadas em série; a primeira que responder com o cabeçalho esperado vence.
 * A aba oficial está na frente por ser a publicada hoje. Publicar a projeção
 * técnica e despublicar a oficial migra a leitura sem deploy nenhum — ver
 * sync/README.md, "Publicar a projeção técnica".
 */
const ORCAMENTO_PUB =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGQCBmyCjdHlexSVhN0wzJ2i6r6QUlj3oACbKd-gJEa81sCIO5UxI24LYRoVHrUHwTtearktC4Jb5a/pub";
const MOVIMENTACOES_URLS = [
  `${ORCAMENTO_PUB}?gid=185205069&single=true&output=csv`,  // Movimentações de Rendimentos (oficial)
  `${ORCAMENTO_PUB}?gid=96584928&single=true&output=csv`,   // Dashboard • Movimentações Rendimentos
];

export const environment = {
  production: true,
  googleSheetsBaseUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTcM2aU8ucv35H649ATmgyUMR6S7pvkVaxPQSwN0p-Hs9DsvAIG5Mm-4PutXobweeZ0vp21mklhYqBM/pub?output=csv",
  movimentacoesRendimentosUrls: MOVIMENTACOES_URLS,
  features: {
    auditoria: ("__FEATURE_AUDITORIA__" as string) === "true",
  },
  google: {
    clientId: "591136537189-82mno6s31ef54r8t5lt8qvksijs6vmc1.apps.googleusercontent.com",
    allowedEmails: ["mrclima.dev@gmail.com", "fernanda.kleinschmidt@impacthub.net", "fernandakdt@gmail.com"],
    allowedDomains: [] as string[],
  },
};
