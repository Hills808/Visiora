import { POLICY } from './luna-policy.ts';

/** Never return the key, headers, provider body, or image in diagnostics. */
export function transportDiagnostic(error: unknown, secret = ''): { name: string; detail: string } {
  const item = error instanceof Error ? error : new Error('Unknown transport error');
  let detail = item.message;
  if (secret) detail = detail.split(secret).join('[redacted]');
  detail = detail.replace(/Bearer\s+\S+|sk-[A-Za-z0-9_-]+/gi, '[redacted]');
  return { name: item.name.replace(/[^A-Za-z]/g, '').slice(0, 40), detail: detail.slice(0, 240) };
}

export async function checkConnection(apiKey: string | undefined, send: typeof fetch = fetch): Promise<{
  ok: boolean; code: string; httpStatus?: number; transport?: { name: string; detail: string };
}> {
  if (!apiKey) return { ok: false, code: 'missing-key' };
  if (!/^[\x21-\x7e]+$/.test(apiKey)) return { ok: false, code: 'invalid-key-format' };
  try {
    // Model metadata checks connectivity/authentication without inference or images.
    const url = new URL(POLICY.endpoint);
    url.pathname = `/v1/models/${POLICY.model}`;
    const response = await send(url, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(POLICY.timeoutMs),
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    await response.body?.cancel();
    return { ok: response.ok, code: response.ok ? 'connected' : `provider-http-${response.status}`,
      httpStatus: response.status };
  } catch (error) {
    return { ok: false, code: 'provider-network', transport: transportDiagnostic(error, apiKey) };
  }
}
