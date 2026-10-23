import test from 'node:test';
import assert from 'node:assert/strict';
import { validEvidence, validStamp, parseResult } from '../dist/perception/evidence.js';
import { VisualMemory } from '../dist/brain/visual-memory.js';
import { LunaClient } from '../dist/vision/luna-client.js';
import { responseEvidence, createProvider } from '../server/provider.mjs';
import { loadConfig, POLICY } from '../server/config.mjs';

export const evidence = {
  scene: { label: 'laboratório de cerâmica', support: ['a'] },
  observations: [
    {
      id: 'a',
      kind: 'object',
      label: 'torno de cerâmica',
      article: 'um',
      uncertain: false,
      box: { x: 0.05, y: 0.1, width: 0.2, height: 0.5 },
    },
    {
      id: 'b',
      kind: 'person',
      label: 'pessoa',
      article: 'uma',
      uncertain: true,
      box: { x: 0.65, y: 0.1, width: 0.2, height: 0.6 },
    },
  ],
  relations: [],
  limitations: [],
};
export const stamp = {
  requestId: '00000000-0000-4000-a000-000000000001',
  sessionGeneration: 1,
  frameId: 1,
  capturedAtMs: 1000,
  width: 640,
  height: 480,
  intent: 'describe',
  term: '',
};
const result = (extra = {}) => ({
  schemaVersion: 1,
  source: 'fake',
  stamp: { ...stamp },
  evidence: structuredClone(evidence),
  ...extra,
});
test('CA-L1: open scene/items accepted without catalog hints; original stamp required', () => {
  assert.ok(validEvidence(evidence));
  assert.ok(validStamp(stamp));
  assert.deepEqual(parseResult(result(), stamp), result());
  assert.throws(() => parseResult(result({ stamp: { ...stamp, frameId: 2 } }), stamp));
});
test('CA-L1/P6: malformed boxes, hallucinated references, extra depth, HTML and duplicate IDs rejected', () => {
  const changes = [
    (e) => (e.observations[0].box.x = 1.1),
    (e) => (e.observations[0].box.width = 0),
    (e) => (e.observations[0].box.x = 0.99),
    (e) => (e.observations[0].depth = 3),
    (e) => (e.observations[0].label = '<script>alert(1)</script>'),
    (e) => (e.observations[1].id = 'a'),
    (e) => (e.scene.support = ['missing']),
    (e) => (e.relations = [{ subject: 'a', object: 'missing', description: 'ao lado' }]),
    (e) => (e.limitations = Array(7).fill('pouca luz')),
    (e) => (e.observations = Array(13).fill(e.observations[0])),
  ];
  for (const change of changes) {
    const e = structuredClone(evidence);
    change(e);
    assert.equal(validEvidence(e), false);
  }
});
test('CA-L4: old/generation-mismatched/reordered results do not enter snapshot memory', () => {
  const memory = new VisualMemory();
  assert.equal(memory.accept(result(), 11001, 1), false);
  assert.equal(memory.accept(result(), 1500, 2), false);
  assert.equal(memory.accept(result(), 999, 1), false);
  assert.ok(memory.accept(result(), 1500, 1));
  assert.equal(memory.accept(result(), 1600, 1), false);
  assert.equal(memory.utterance(11001), null);
});
test('CA-L1/L4: a new question on the same fresh frame preserves age and rejects replay or altered frame stamps', () => {
  const memory = new VisualMemory();
  assert.equal(memory.accept(result(), 1500, 1), true);
  const question = result({
    stamp: { ...stamp, requestId: 'second-question', intent: 'find', term: 'torno' },
  });
  assert.equal(memory.accept(question, 1600, 1), true);
  assert.match(memory.utterance(5000).text, /capturada há 4 segundos:.*torno de cerâmica/);
  assert.equal(memory.accept(question, 1700, 1), false);
  assert.equal(memory.accept(result(), 1800, 1), false);
  for (const change of [{ capturedAtMs: 1700 }, { width: 800 }, { height: 600 }])
    assert.equal(
      memory.accept(result({ stamp: { ...stamp, requestId: 'altered', ...change } }), 1800, 1),
      false,
    );
  assert.equal(
    memory.accept(result({ stamp: { ...stamp, requestId: 'expired' } }), 11001, 1),
    false,
  );
  assert.equal(
    memory.accept(
      result({ stamp: { ...stamp, requestId: 'next-frame', frameId: 2, capturedAtMs: 2000 } }),
      2100,
      1,
    ),
    true,
  );
  assert.equal(memory.accept(question, 2200, 1), false);
});
test('CA-F2/F3/F6/P6/L4: local rendering, camera direction, no distance, explicit age and completed repeat', () => {
  const memory = new VisualMemory();
  memory.accept(result(), 1500, 1);
  assert.equal(memory.utterance(1500, true), null);
  const spoken = memory.utterance(5000);
  assert.match(spoken.text, /capturada há 4 segundos/);
  assert.match(spoken.text, /laboratório de cerâmica/);
  assert.match(spoken.text, /torno de cerâmica/);
  assert.match(spoken.text, /À sua frente, à esquerda/);
  assert.doesNotMatch(spoken.text, /passos|metros/);
  assert.deepEqual(spoken.facts, []); // Not inserted into live World.
  memory.complete('other');
  assert.equal(memory.utterance(6000, true), null);
  memory.complete(spoken.id);
  assert.match(memory.utterance(31000, true).text, /capturada há 30 segundos/);
  memory.clear();
  assert.equal(memory.utterance(31000, true), null);
});
test('CA-L1: find/ahead/where accept open vocabulary; no box means no directional speech', () => {
  for (const [intent, term, expected] of [
    ['find', 'torno', /torno/],
    ['where', '', /laboratório/],
    ['ahead', '', /pessoa/],
  ]) {
    const memory = new VisualMemory();
    memory.accept(result({ stamp: { ...stamp, intent, term } }), 1500, 1);
    assert.match(memory.utterance(1500).text, expected);
  }
  const memory = new VisualMemory();
  const r = result();
  r.evidence.observations.forEach((i) => (i.box = null));
  memory.accept(r, 1500, 1);
  assert.doesNotMatch(memory.utterance(1500).text, /há torno|há uma pessoa/);
});
test('CA-L1: refusal, incomplete and malformed Responses payload are explicit failures', () => {
  for (const data of [
    { status: 'incomplete', output: [] },
    {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }],
    },
    {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }],
    },
  ])
    assert.throws(() => responseEvidence(data));
});
test('CA-L2: provider fixes model/endpoint, sends pixels, disables storage and tools; no retries', async () => {
  let calls = 0;
  const provider = createProvider({ provider: 'luna', apiKey: 'TEST-ONLY' }, async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'gpt-6-luna');
    assert.equal(body.store, false);
    assert.equal(body.service_tier, 'default');
    assert.equal(body.max_output_tokens, 1200);
    assert.equal(body.tools, undefined);
    assert.equal(body.previous_response_id, undefined);
    assert.match(body.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
    assert.equal(body.text.format.strict, true);
    assert.doesNotMatch(body.instructions, /laboratório de cerâmica|torno/);
    return Response.json({
      model: 'gpt-6-luna',
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(evidence) }] },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
  });
  assert.deepEqual((await provider(Buffer.from([1, 2]), stamp)).evidence, evidence);
  assert.equal(calls, 1);
  const bad = createProvider({ provider: 'luna', apiKey: 'TEST-ONLY' }, async () => {
    calls++;
    return new Response('', { status: 429 });
  });
  await assert.rejects(bad(Buffer.from([]), stamp));
  assert.equal(calls, 2);
});
test('CA-L3: default configuration cannot make paid calls; malformed budgets fail closed', () => {
  assert.equal(loadConfig({}).ready, false);
  assert.equal(
    loadConfig({
      OPENAI_API_KEY: 'TEST',
      VISIORA_LUNA_ENABLED: '1',
      VISIORA_DAILY_USD: '2',
      VISIORA_TOTAL_USD: '2',
    }).ready,
    false,
  );
  assert.throws(() => loadConfig({ VISIORA_DAILY_USD: 'NaN' }));
  assert.equal(loadConfig({ VISIORA_PROVIDER: 'fake' }).ready, true);
  assert.equal(POLICY.reservationMicros, 300000);
});
test('CA-L4: canceled client response cannot be adopted; only one active request', async () => {
  const original = globalThis.fetch;
  let finish;
  globalThis.fetch = () => new Promise((resolve) => (finish = resolve));
  try {
    const client = new LunaClient(),
      status = { ready: true, provider: 'fake', csrfToken: 'x' };
    const pending = client.analyze(new Blob(['fake']), stamp, status, false);
    await assert.rejects(client.analyze(new Blob(), stamp, status, false), /Aguarde/);
    client.cancel();
    finish(Response.json(result()));
    assert.equal(await pending, null);
  } finally {
    globalThis.fetch = original;
  }
});

test('CA-F7/F8: source/age qualification fits word limits; long open labels do not overflow speech', () => {
  for (const intent of ['describe', 'ahead', 'find', 'where']) {
    const memory = new VisualMemory(),
      r = result();
    r.stamp.intent = intent;
    r.stamp.term = intent === 'find' ? 'a' : '';
    r.evidence.scene.label = Array(28).fill('a').join(' ');
    r.evidence.observations[0].label = Array(28).fill('a').join(' ');
    memory.accept(r, 1500, 1);
    const value = memory.utterance(1500);
    assert.ok(value.text.trim().split(/\s+/).length <= (intent === 'describe' ? 45 : 25));
    assert.match(value.text, /há 1 segundo:/);
  }
});
