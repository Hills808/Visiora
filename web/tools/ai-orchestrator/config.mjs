// Ferramenta de desenvolvimento isolada do gateway e do orçamento do Visiora.
// Preços Standard, texto, contexto curto, conferidos em 22/10/2026:
// https://developers.openai.com/api/docs/pricing
export const MODELS = Object.freeze({
  luna: { id: 'gpt-6-luna', inputPerMillion: 0.1, outputPerMillion: 0.5 },
  sol: { id: 'gpt-6.1-sol', inputPerMillion: 2, outputPerMillion: 10 },
  astra: { id: 'gpt-6-astra', inputPerMillion: 10, outputPerMillion: 50 },
});

export const LIMITS = Object.freeze({
  // Evitam que planejamento excessivo e contexto bruto multipliquem chamadas.
  maxRequestChars: 8000,
  maxTasks: 4,
  maxTaskChars: 1200,
  maxResponseBytes: 200000,
  plannerOutputTokens: 1100,
  workerOutputTokens: 1800,
  reviewerOutputTokens: 900,
  timeoutMs: 90000,
  // Folga para metadados do protocolo no cálculo conservador por bytes UTF-8.
  inputOverheadTokens: 1024,
});
