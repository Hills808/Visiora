import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualMemory } from '../dist/brain/visual-memory.js';
import { CONFIG } from '../dist/config.js';
import { SnapshotView } from '../dist/vision/snapshot-view.js';
import { CAPTURE_DIRECTIONS, snapshotSpeech } from '../dist/brain/snapshot-speech.js';
import { item, snapshot, deliver, memoryTranscripts } from './fixtures/memory-scenarios.mjs';

test('CA-L4/F3: a six-second snapshot and a one-minute replay keep past tense and camera-relative directions', () => {
  const memory = new VisualMemory();
  const result = snapshot(1, [item('cadeira', { bearing: 30 })], { at: 0 });
  assert.equal(memory.accept(result, 6000, 1), true);
  const utterance = memory.utterance(6000, false, true);
  assert.match(utterance.text, /capturada há 6 segundos:.*O ambiente parecia/);
  assert.match(utterance.text, /À frente, à direita da câmera, havia uma cadeira/);
  assert.doesNotMatch(utterance.text, /À sua|Atrás de você|há uma|talvez haja|ambiente parece/);
  assert.equal(memory.complete(utterance.id, 7000), true);
  memory.forgetDirections();
  const replay = memory.utterance(60000, true);
  assert.match(replay.text, /capturada há 60 segundos/);
  assert.match(replay.text, /da câmera, havia uma cadeira/);
  assert.doesNotMatch(replay.text, /À sua|há uma|caminho livre/);
});

test('CA-F3/F7: snapshot sectors use a fixed historical phrase without changing the local lexicon', () => {
  for (const [sector, direction] of Object.entries(CAPTURE_DIRECTIONS)) {
    const text = snapshotSpeech([
      { sector, noun: 'uma cadeira', mode: 'present' },
      { sector, noun: 'uma mesa', mode: 'uncertain' },
    ]);
    assert.equal(text, `${direction}, havia uma cadeira; talvez houvesse uma mesa.`);
    assert.ok(text.split(/\s+/).length <= CONFIG.speech.maxWords);
  }
});

test('CA-F3/F4/F7: visible novelty precedes absence; no old direction is assigned to a missing person', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira');
  deliver(memory, snapshot(1, [chair, item('pessoa', { kind: 'person', bearing: -30 })]));
  const next = deliver(memory, snapshot(2, [chair, item('mesa', { bearing: 30 })]));
  assert.match(
    next.text,
    /À frente, à direita da câmera, havia uma mesa\. Não identifiquei pessoas nesta captura\./,
  );
  assert.doesNotMatch(next.text, /à esquerda|saiu|sumiu|passos|metros/);
  assert.ok(next.text.split(/\s+/).length <= CONFIG.speech.maxWords);
});
test('CA-F4/F7: current confirmed references precede hypotheses, with at most three items', () => {
  const memory = new VisualMemory();
  const output = deliver(
    memory,
    snapshot(1, [
      item('cama', { uncertain: true }),
      item('cadeira'),
      item('pessoa', { kind: 'person' }),
      item('mesa'),
    ]),
  );
  assert.match(output.text, /havia uma cadeira, uma pessoa e uma mesa/);
  assert.doesNotMatch(output.text, /cama|talvez/);
});
test('CA-F7: a long useful novelty fits the exact source/age budget before any absence', () => {
  const memory = new VisualMemory();
  deliver(memory, snapshot(1, [item('cadeira')]));
  const output = deliver(
    memory,
    snapshot(2, [item('passagem com placa de saída', { bearing: -30, uncertain: true })]),
  );
  assert.match(output.text, /talvez houvesse uma passagem com placa de saída/);
  assert.doesNotMatch(output.text, /cadeira/);
  assert.ok(output.text.split(/\s+/).length <= CONFIG.speech.maxWords);
  assert.equal(
    deliver(
      memory,
      snapshot(3, [item('passagem com placa de saída', { bearing: -30, uncertain: true })]),
    ),
    null,
  );
});
test('CA-F4/F8: repeated object groups use a natural quantity without repeating every small count change', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira');
  assert.match(deliver(memory, snapshot(1, [chair, chair])).text, /mais de uma cadeira/);
  assert.equal(deliver(memory, snapshot(2, [chair, chair, chair])), null);
});
test('CA-F4: box noise across a sector edge stays silent until a material sector change', () => {
  const memory = new VisualMemory();
  const results = [22.4, 22.6, 23, 22, 29].map((bearing, i) =>
    deliver(memory, snapshot(i + 1, [item('cadeira', { bearing })])),
  );
  assert.ok(results[0]);
  assert.deepEqual(results.slice(1, 4), [null, null, null]);
  assert.match(results[4].text, /À frente, à direita da câmera/);
});
test('CA-F1/F4: five minutes of fresh identical references and label case/spacing noise stay silent', () => {
  const memory = new VisualMemory();
  let spoken = 0;
  for (let frame = 1; frame <= 151; frame++) {
    const output = deliver(
      memory,
      snapshot(frame, [item(frame % 2 ? 'Mesa de reunião' : 'mesa  de reunião')], {
        at: frame * 2000,
      }),
    );
    if (output) spoken++;
  }
  assert.equal(spoken, 1);
});
test('CA-F4: uncertainty flicker does not repeat a known reference; later confirmation of an uncertain one does', () => {
  const memory = new VisualMemory();
  deliver(memory, snapshot(1, [item('cadeira')]));
  for (let frame = 2; frame <= 10; frame++)
    assert.equal(
      deliver(memory, snapshot(frame, [item('cadeira', { uncertain: frame % 2 === 0 })])),
      null,
    );
  const uncertain = new VisualMemory();
  assert.match(
    deliver(uncertain, snapshot(1, [item('cadeira', { uncertain: true })])).text,
    /talvez houvesse/,
  );
  assert.match(deliver(uncertain, snapshot(2, [item('cadeira')])).text, /havia uma cadeira/);
  assert.equal(deliver(uncertain, snapshot(3, [item('cadeira')])), null);
});
test('CA-F9/F4: place-name oscillation does not repeat briefings; two distinct recent captures confirm a change', () => {
  const transcript = memoryTranscripts().find(
    (value) => value.id === 'oscilacao-de-lugar',
  ).transcript;
  assert.ok(transcript[0].text);
  assert.deepEqual(
    transcript.slice(1, 4).map((value) => value.text),
    [null, null, null],
  );
  assert.match(transcript[4].text, /biblioteca/);
});
test('CA-L4/F9: another question on the same frame cannot confirm a new place', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira');
  deliver(memory, snapshot(1, [chair]));
  const changed = snapshot(2, [chair], { scene: 'biblioteca' });
  assert.equal(deliver(memory, changed), null);
  const secondQuestion = structuredClone(changed);
  secondQuestion.stamp.requestId = 'another-question';
  assert.equal(deliver(memory, secondQuestion), null);
  assert.match(deliver(memory, snapshot(3, [chair], { scene: 'biblioteca' })).text, /biblioteca/);
});
test('CA-L4/F9: widely separated place hypotheses cannot accumulate confirmation', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira');
  deliver(memory, snapshot(1, [chair]));
  assert.equal(deliver(memory, snapshot(2, [chair], { scene: 'biblioteca' })), null);
  assert.equal(deliver(memory, snapshot(3, [chair], { scene: 'biblioteca', at: 50000 })), null);
});
test('CA-F4/L4: an old unseen reference expires without an irrelevant absence report', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira');
  deliver(memory, snapshot(1, [chair, item('pessoa', { kind: 'person' })]));
  assert.equal(deliver(memory, snapshot(2, [chair], { at: 40000 })), null);
  assert.match(
    deliver(memory, snapshot(3, [chair, item('pessoa', { kind: 'person' })], { at: 45000 })).text,
    /havia uma pessoa/,
  );
});
test('CA-F6/L4: withdrawing a view rejects late completion and does not turn omitted objects into delivered facts', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira');
  const pending = deliver(memory, snapshot(1, [chair]), { complete: false });
  memory.forgetDirections();
  assert.equal(memory.complete(pending.id), false);
  assert.equal(memory.utterance(5000, true), null);
  const context = memory.utterance(5000, false, true);
  assert.match(context.text, /O ambiente parecia escritório/);
  assert.doesNotMatch(context.text, /cadeira|câmera/);
  memory.complete(context.id, 5100);
  assert.match(deliver(memory, snapshot(2, [chair])).text, /cadeira/);
});
test('CA-L4/F6: a new query on the invalidated frame cannot restore positions; explicit repeat remains historical', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira');
  const first = snapshot(1, [chair]);
  deliver(memory, first);
  memory.forgetDirections();
  const query = structuredClone(first);
  query.stamp.requestId = 'same-frame-new-question';
  memory.accept(query, 5000, 1);
  assert.equal(memory.utterance(5000, false, true), null);
  assert.match(memory.utterance(30000, true).text, /capturada há 26 segundos/);
  assert.match(deliver(memory, snapshot(2, [chair])).text, /cadeira/);
});
test('CA-F6/F7: references outside the word/item budget are not acknowledged as spoken', () => {
  const memory = new VisualMemory(),
    items = ['cadeira', 'mesa', 'cama', 'janela'].map((label) => item(label));
  assert.doesNotMatch(deliver(memory, snapshot(1, items)).text, /janela/);
  const next = deliver(memory, snapshot(2, items));
  assert.match(next.text, /janela/);
  assert.doesNotMatch(next.text, /cadeira|mesa|cama/);
  assert.ok(next.text.split(/\s+/).length <= CONFIG.speech.maxWords);
  assert.equal(deliver(memory, snapshot(3, items)), null);
});
test('CA-L4/H2: broad change followed by matching pixels cannot revive an earlier capture view', () => {
  const baseline = Array(32 * 24 * 3).fill(0.5),
    broad = baseline.map((n, i) => n + (Math.floor(i / 3) % 2 ? 0.3 : -0.3));
  const view = new SnapshotView(baseline);
  assert.equal(view.observe(broad), true);
  assert.equal(view.valid, false);
  assert.equal(view.observe(baseline), false);
  assert.equal(view.valid, false);
  assert.equal(new SnapshotView(baseline).valid, true);
  const lighting = new SnapshotView(baseline);
  assert.equal(lighting.observe(baseline.map((n) => n + 0.2)), false);
  assert.equal(lighting.valid, true);
});
