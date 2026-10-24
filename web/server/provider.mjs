import { readFile } from 'node:fs/promises';
import { POLICY } from './config.mjs';
import { GatewayError } from './budget.mjs';
import { prepareEvidence } from '../dist/perception/evidence.js';
import { inspectResponseModel } from './response-model.mjs';
const prompt = await readFile(new URL('../prompts/luna-vision-v1.md', import.meta.url), 'utf8');
const schema = JSON.parse(
  await readFile(new URL('../schemas/visual-evidence-v1.json', import.meta.url), 'utf8'),
);
function providerError(status) {
  if (status === 429) return new GatewayError(429, 'provider-limit');
  if (status === 401 || status === 403) return new GatewayError(401, 'provider-auth');
  if (status >= 500) return new GatewayError(503, 'provider-unavailable');
  return new GatewayError(422, 'provider-request');
}
const timeout = (error) => error?.name === 'TimeoutError' || error?.name === 'AbortError';
export async function boundedBody(response, max = POLICY.maxResponseBytes) {
  const chunks = [];
  let size = 0;
  if (!response.body) throw new GatewayError(422, 'empty');
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > max) throw new GatewayError(422, 'too-large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function responseEvidence(data) {
  if (data.status !== 'completed' || !Array.isArray(data.output))
    throw new GatewayError(422, 'incomplete');
  const content = data.output.filter((i) => i.type === 'message').flatMap((i) => i.content || []);
  if (content.some((i) => i.type === 'refusal')) throw new GatewayError(422, 'refused');
  const text = content
    .filter((i) => i.type === 'output_text')
    .map((i) => i.text)
    .join('');
  let evidence;
  try {
    evidence = JSON.parse(text);
  } catch {
    throw new GatewayError(422, 'invalid-json');
  }
  const prepared = prepareEvidence(evidence);
  if (!prepared.ok) throw new GatewayError(422, `invalid-evidence-${prepared.reason}`);
  if (prepared.adjustments.length) console.info(JSON.stringify({ event: 'visual-evidence-normalized', adjustments: prepared.adjustments }));
  return prepared.evidence;
}
export function createProvider(config, fetcher = fetch, recordModel = () => {}) {
  return async (image, stamp) => {
    if (config.provider === 'fake')
      return {
        evidence: {
          scene: null,
          observations: [],
          relations: [],
          limitations: ['Resposta artificial do simulador de integração'],
        },
        usage: null,
      };
    let response;
    try {
      response = await fetcher(POLICY.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(POLICY.timeoutMs),
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: POLICY.model,
          store: false,
          service_tier: 'default',
          reasoning: { effort: 'none' },
          max_output_tokens: POLICY.maxOutputTokens,
          instructions: prompt,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: JSON.stringify({ intent: stamp.intent, term: stamp.term }),
                },
                {
                  type: 'input_image',
                  image_url: `data:image/jpeg;base64,${image.toString('base64')}`,
                  detail: 'high',
                },
              ],
            },
          ],
          text: {
            format: { type: 'json_schema', name: 'visual_evidence_v1', strict: true, schema },
          },
        }),
      });
    } catch (error) {
      throw new GatewayError(
        timeout(error) ? 504 : 503,
        timeout(error) ? 'provider-timeout' : 'provider-network',
      );
    }
    let data;
    try {
      data = JSON.parse(await boundedBody(response));
    } catch (error) {
      recordModel(stamp.requestId, inspectResponseModel(undefined));
      if (!response.ok) throw providerError(response.status);
      if (timeout(error)) throw new GatewayError(504, 'provider-timeout');
      if (error instanceof TypeError) throw new GatewayError(503, 'provider-network');
      throw new GatewayError(422, 'invalid-response');
    }
    const audit = inspectResponseModel(data?.model);
    // Persist before validation: refused, incomplete and mismatched responses also leave metadata.
    recordModel(stamp.requestId, audit);
    if (!response.ok) throw providerError(response.status);
    if (audit.verification !== 'verified') throw new GatewayError(502, 'model-unconfirmed');
    return { evidence: responseEvidence(data), usage: data.usage };
  };
}
