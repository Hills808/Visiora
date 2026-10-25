import { Buffer } from 'node:buffer';
import prompt from '../web/prompts/luna-vision-v1.md?raw';
import schema from '../web/schemas/visual-evidence-v1.json';
import { prepareEvidence, type VisualEvidence, type CaptureStamp } from '../web/src/perception/evidence';
import { LunaError } from './luna-budget';
import { POLICY } from './luna-policy';
import { providerFailure } from './luna-provider-errors';

async function boundedText(response: Response): Promise<string> {
  if (!response.body) throw new LunaError(422, 'invalid-response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > POLICY.maxResponseBytes) {
      await reader.cancel();
      throw new LunaError(422, 'invalid-response');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function providerError(status: number): LunaError {
  const failure = providerFailure(status);
  return new LunaError(failure.status, failure.code);
}

export async function analyzeImage(image: Uint8Array, stamp: CaptureStamp, apiKey: string,
  auditModel: (model: unknown) => Promise<boolean>): Promise<{
  evidence: VisualEvidence; usage: unknown;
}> {
  let response: Response;
  try {
    response = await fetch(POLICY.endpoint, {
      method: 'POST',
      // Workerd supports manual/follow only. Never follow redirects with the key.
      redirect: 'manual',
      signal: AbortSignal.timeout(POLICY.timeoutMs),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: POLICY.model,
        store: false,
        service_tier: 'default',
        reasoning: { effort: 'none' },
        max_output_tokens: POLICY.maxOutputTokens,
        instructions: prompt,
        input: [{ role: 'user', content: [
          { type: 'input_text', text: JSON.stringify({ intent: stamp.intent, term: stamp.term }) },
          { type: 'input_image', image_url: `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}`, detail: 'high' },
        ] }],
        text: { format: { type: 'json_schema', name: 'visual_evidence_v1', strict: true, schema } },
      }),
    });
  } catch (error) {
    const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    throw new LunaError(timedOut ? 504 : 503, timedOut ? 'provider-timeout' : 'provider-network');
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(await boundedText(response)) as Record<string, unknown>;
  } catch (error) {
    await auditModel(undefined);
    if (!response.ok) throw providerError(response.status);
    if (error instanceof LunaError) throw error;
    throw new LunaError(422, 'invalid-response');
  }
  const verified = await auditModel(data.model);
  if (!response.ok) throw providerError(response.status);
  if (!verified) throw new LunaError(502, 'model-unconfirmed');
  if (data.status !== 'completed' || !Array.isArray(data.output)) throw new LunaError(422, 'incomplete');
  const content = data.output.filter((item: { type?: string }) => item.type === 'message')
    .flatMap((item: { content?: unknown[] }) => item.content ?? []) as { type?: string; text?: string }[];
  if (content.some((item) => item.type === 'refusal')) throw new LunaError(422, 'refused');
  let evidence: unknown;
  try {
    evidence = JSON.parse(content.filter((item) => item.type === 'output_text').map((item) => item.text).join(''));
  } catch {
    throw new LunaError(422, 'invalid-json');
  }
  const prepared = prepareEvidence(evidence);
  if (!prepared.ok) throw new LunaError(422, `invalid-evidence-${prepared.reason}`);
  if (prepared.adjustments.length) console.info(JSON.stringify({ event: 'visual-evidence-normalized', adjustments: prepared.adjustments }));
  return { evidence: prepared.evidence, usage: data.usage };
}

export function fakeAnalysis(): { evidence: VisualEvidence; usage: { input_tokens: number; output_tokens: number }; model: string } {
  return { evidence: { scene: null, observations: [], relations: [], limitations: ['Resposta artificial do simulador de integração'] },
    usage: { input_tokens: 0, output_tokens: 0 }, model: POLICY.model };
}
