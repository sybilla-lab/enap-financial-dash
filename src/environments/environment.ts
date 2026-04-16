export const environment = {
  production: true,
  googleSheetsBaseUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTcM2aU8ucv35H649ATmgyUMR6S7pvkVaxPQSwN0p-Hs9DsvAIG5Mm-4PutXobweeZ0vp21mklhYqBM/pub?output=csv",
  features: {
    auditoria: ("__FEATURE_AUDITORIA__" as string) === "true",
  },
};
