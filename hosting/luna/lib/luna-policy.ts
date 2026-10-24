export const POLICY = Object.freeze({
  model: 'gpt-6-luna',
  endpoint: 'https://api.openai.com/v1/responses',
  promptVersion: 'visual-v1.1-auto',
  pricingRevision: '2026-10-23',
  // User-authorized maximum. The configured hosted amount can be lower.
  maxDailyMicros: 2_000_000,
  presentationDay: '2026-10-23',
  presentationDailyMicros: 10_000_000,
  // Conservative per-request hold until actual usage is known.
  reservationMicros: 300_000,
  maxOutputTokens: 1_200,
  maxImageBytes: 1_000_000,
  maxBodyBytes: 1_050_000,
  maxResponseBytes: 1_000_000,
  maxImageSide: 1_280,
  timeoutMs: 12_000,
  requestsPerMinute: 15,
  cooldownMs: 4_000,
  csrfLifetimeMs: 60 * 60_000,
  // Explicit operator reconciliation only; never auto-refund a possibly billed request.
  reconciliationMinAgeMs: 5 * 60_000,
  budgetTimeZone: 'America/Sao_Paulo',
});

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: POLICY.budgetTimeZone,
  year: 'numeric', month: '2-digit', day: '2-digit',
});

export function budgetDay(at: number): string {
  const parts = Object.fromEntries(formatter.formatToParts(at).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dailyLimit(raw: string | undefined, at = Date.now()): number {
  if (!raw || !/^\d+(\.\d{1,6})?$/.test(raw)) return 0;
  const micros = Math.round(Number(raw) * 1_000_000);
  if (!Number.isSafeInteger(micros) || micros > POLICY.maxDailyMicros) return 0;
  return micros > 0 && budgetDay(at) === POLICY.presentationDay
    ? POLICY.presentationDailyMicros : micros;
}

export function hostedReady(env: Cloudflare.Env): boolean {
  return env.VISIORA_PROVIDER === 'fake' || (
    Boolean(env.OPENAI_API_KEY) &&
    env.VISIORA_LUNA_ENABLED === '1' &&
    env.VISIORA_PRICING_CONFIRMED === POLICY.pricingRevision &&
    dailyLimit(env.VISIORA_DAILY_USD) > 0
  );
}
