import { env } from 'cloudflare:workers';
import { LunaError } from '../../../../lib/luna-budget';
import { errorResponse, json, requireCsrf, requireIdentity, requireSameOrigin } from '../../../../lib/luna-http';
import { reconcilePending } from '../../../../lib/luna-reconcile';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const user = requireIdentity(request);
    requireSameOrigin(request);
    if (!env.DB) throw new LunaError(503, 'ledger');
    await requireCsrf(request, env.DB, user);
    const id = request.headers.get('x-visiora-reconcile-request') ?? '';
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(id) ||
      request.headers.get('x-visiora-acknowledge-uncertain') !== '1')
      throw new LunaError(400, 'reconcile-acknowledgement');
    await reconcilePending(env.DB, id, Date.now());
    return json(200, { state: 'uncertain', reservationPreserved: true });
  } catch (error) { return errorResponse(error); }
}
