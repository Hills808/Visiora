import { env } from 'cloudflare:workers';
import { checkConnection } from '../../../../lib/luna-connection';
import { errorResponse, json, requireIdentity } from '../../../../lib/luna-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    requireIdentity(request);
    return json(200, await checkConnection(env.OPENAI_API_KEY));
  } catch (error) {
    return errorResponse(error);
  }
}
