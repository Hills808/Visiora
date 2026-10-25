/**
 * Small, safe error contract between OpenAI upstream and Visiora.
 * Only HTTP status is kept. Never propagate the provider body, headers or key.
 */
export function providerFailure(status: number): { status: number; code: string } {
  if (status === 429) return { status: 429, code: 'provider-limit' };
  if (status === 401 || status === 403) return { status: 401, code: 'provider-auth' };
  if (status >= 500 && status <= 599)
    return { status: 503, code: `provider-http-${status}` };
  return { status: 422, code: 'provider-request' };
}
