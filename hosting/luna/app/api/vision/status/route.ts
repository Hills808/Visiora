import { env } from 'cloudflare:workers';
import { errorResponse, json, requireIdentity } from '../../../../lib/luna-http';
import { hostedReady, POLICY } from '../../../../lib/luna-policy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const user = requireIdentity(request);
    if (!env.DB) return json(503, { error: 'ledger' });
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),
      (byte) => byte.toString(16).padStart(2, '0')).join('');
    const now = Date.now();
    await env.DB.prepare('DELETE FROM csrf_tokens WHERE expires_at < ?').bind(now).run();
    await env.DB.prepare('INSERT INTO csrf_tokens(token,user_id,expires_at) VALUES(?,?,?)')
      .bind(token, user, now + POLICY.csrfLifetimeMs).run();
    const ready = hostedReady(env);
    return json(200, {
      ready,
      provider: env.VISIORA_PROVIDER === 'fake' ? 'fake' : 'luna',
      csrfToken: token,
      message: ready
        ? 'Luna configurado. Imagens autorizadas podem ser enviadas à OpenAI e gerar cobrança.'
        : 'Luna aguarda configuração do servidor. O modo local continua disponível.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
