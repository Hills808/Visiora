import { env } from 'cloudflare:workers';
import { complete, LunaError, recordModel, reserve, uncertain } from '../../../../lib/luna-budget';
import { errorResponse, json, readImage, requireCsrf, requireIdentity, requireSameOrigin } from '../../../../lib/luna-http';
import { dailyLimit, hostedReady, POLICY } from '../../../../lib/luna-policy';
import { analyzeImage, fakeAnalysis } from '../../../../lib/luna-provider';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let reserved: string | null = null;
  try {
    const user = requireIdentity(request);
    requireSameOrigin(request);
    if (!env.DB || !hostedReady(env)) throw new LunaError(503, 'not-configured');
    const fake = env.VISIORA_PROVIDER === 'fake';
    if (!fake && request.headers.get('x-visiora-consent') !== 'cloud-v3-continuity')
      throw new LunaError(403, 'consent');
    await requireCsrf(request, env.DB, user);
    const { stamp, bytes } = await readImage(request);
    const now = Date.now();
    await reserve(env.DB, stamp.requestId, fake ? 0 : dailyLimit(env.VISIORA_DAILY_USD, now),
      fake ? 0 : POLICY.reservationMicros, now);
    reserved = stamp.requestId;
    const result = fake ? fakeAnalysis() : await analyzeImage(bytes, stamp, env.OPENAI_API_KEY!,
      (model) => recordModel(env.DB!, reserved!, model));
    if (fake) await recordModel(env.DB, reserved, POLICY.model);
    await complete(env.DB, reserved, result.usage);
    reserved = null;
    return json(200, { schemaVersion: 1, source: fake ? 'fake' : 'luna', stamp, evidence: result.evidence });
  } catch (error) {
    if (reserved && env.DB) {
      const code = error instanceof LunaError ? error.code : 'internal';
      try { await uncertain(env.DB, reserved, code); }
      catch { return json(503, { error: 'ledger' }); }
    }
    return errorResponse(error);
  }
}
