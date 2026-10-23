import path from 'node:path';
export const POLICY = Object.freeze({
  model: 'gpt-6-luna',
  // Only the exact documented response alias is accepted; new snapshots require review.
  maxModelIdLength: 128,
  endpoint: 'https://api.openai.com/v1/responses',
  promptVersion: 'visual-v1.1-auto',
  maxOutputTokens: 1200,
  timeoutMs: 12000,
  maxBodyBytes: 1050000,
  maxResponseBytes: 1000000,
  maxImageBytes: 1000000,
  maxImageSide: 1280,
  requestsPerMinute: 15,
  cooldownMs: 4000,
  budgetTimeZone: 'America/Sao_Paulo', // The authorized daily allowance follows the user's calendar, not the host timezone.
  maxDailyMicros: 2000000, // US$2/day authorized by the user; no cumulative US$2 pilot cap.
  // Conservative reservation: entire 1.05M context at long-context cache-write rate,
  // plus capped output, plus 10% regional premium. Standard tier only. USD in micros.
  reservationMicros: 300000,
  pricingRevision: '2026-10-18',
});
function publicOrigin(value = '') {
  if (!value) return '';
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Origem pública inválida.');
  }
  // Only one exact HTTPS origin is allowed; paths and wildcard hosts are rejected.
  if (url.protocol !== 'https:' || url.origin !== value || !/^[a-z0-9.-]+$/i.test(url.hostname))
    throw new Error('A origem pública deve ser uma origem HTTPS exata, sem caminho ou barra final.');
  return url.origin;
}
function money(value = '0') {
  if (!/^\d+(\.\d{1,6})?$/.test(value))
    throw new Error('Orçamento inválido; use USD com ponto decimal.');
  const micros = Math.round(Number(value) * 1000000);
  if (!Number.isSafeInteger(micros)) throw new Error('Orçamento fora do limite.');
  return micros;
}
export function loadConfig(env = process.env) {
  const provider = env.VISIORA_PROVIDER === 'fake' ? 'fake' : 'luna';
  const daily = money(env.VISIORA_DAILY_USD);
  if (daily > POLICY.maxDailyMicros) throw new Error('O limite autorizado é de US$ 2 por dia.');
  const port = Number(env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta inválida.');
  const ready =
    provider === 'fake' ||
    (env.VISIORA_LUNA_ENABLED === '1' &&
      Boolean(env.OPENAI_API_KEY) &&
      daily > 0 &&
      env.VISIORA_PRICING_CONFIRMED === POLICY.pricingRevision);
  return {
    provider,
    daily,
    port,
    publicOrigin: publicOrigin(env.VISIORA_PUBLIC_ORIGIN),
    ready,
    apiKey: env.OPENAI_API_KEY || '',
    root: path.resolve('dist'),
    ledger: path.resolve('.runtime/luna-budget.sqlite'),
    message:
      provider === 'fake'
        ? 'Simulador de integração: respostas artificiais, sem chamada à OpenAI.'
        : ready
          ? 'Luna configurado. O acompanhamento automático e perguntas podem enviar imagens à OpenAI e gerar cobrança.'
          : 'Luna aguarda chave, ativação, orçamento e conferência da tarifa no servidor.',
  };
}
