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
  assert.match(next.text, /À frente, à direita da câmera, havia uma mesa\./);
  assert.doesNotMatch(next.text, /pessoas|à esquerda|saiu|sumiu|passos|metros/);
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

test('CA-F1/F4/F9: correcting the place preserves delivered objects and bounds repeated renaming', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira');
  deliver(memory, snapshot(1, [chair]));
  assert.equal(deliver(memory, snapshot(2, [chair], { scene: 'biblioteca' })), null);
  const corrected = deliver(memory, snapshot(3, [chair], { scene: 'biblioteca' }));
  assert.match(corrected.text, /biblioteca/);
  assert.doesNotMatch(corrected.text, /cadeira/);
  for (let frame = 4; frame < 12; frame++)
    assert.equal(deliver(memory, snapshot(frame, [chair], { scene: 'sala' })), null);
  assert.match(deliver(memory, snapshot(12, [chair, item('janela')])).text, /janela/);
});

test('CA-F1/F4/L4: isolated omissions and missing boxes do not erase delivered presence or invent old positions', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira'),
    person = item('pessoa', { kind: 'person' });
  deliver(memory, snapshot(1, [chair, person]));
  assert.equal(deliver(memory, snapshot(2, [chair])), null);
  assert.equal(deliver(memory, snapshot(3, [chair, person])), null);
  assert.equal(deliver(memory, snapshot(4, [chair, { ...person, box: null }])), null);
  assert.equal(deliver(memory, snapshot(5, [chair, person])), null);
  const manual = snapshot(6, [{ ...person, box: null }]);
  assert.equal(memory.accept(manual, manual.stamp.capturedAtMs + 100, 1), true);
  assert.doesNotMatch(
    memory.utterance(manual.stamp.capturedAtMs + 100).text,
    /havia uma pessoa|pessoas nesta/,
  );
});

test('CA-F4/F6: absence requires distinct recent captures over the configured span and actual delivery', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira'),
    person = item('pessoa', { kind: 'person' });
  deliver(memory, snapshot(1, [chair, person]));
  assert.equal(deliver(memory, snapshot(2, [chair])), null);
  assert.equal(deliver(memory, snapshot(3, [chair])), null);
  const absence = deliver(memory, snapshot(4, [chair]), { complete: false });
  assert.match(absence.text, /Não identifiquei pessoas nesta captura/);
  assert.doesNotMatch(absence.text, /saiu|sumiu|da câmera/);
  const again = memory.utterance(18500, false, true);
  assert.match(again.text, /Não identifiquei pessoas/);
  assert.equal(memory.complete(again.id, 18600), true);
  assert.equal(deliver(memory, snapshot(5, [chair])), null);
  assert.match(deliver(memory, snapshot(6, [chair, person])).text, /havia uma pessoa/);
});

test('CA-F1/F4: bounded qualified labels are silent only with strong unique geometric overlap', () => {
  const memory = new VisualMemory();
  deliver(memory, snapshot(1, [item('cadeira')]));
  assert.equal(deliver(memory, snapshot(2, [item('cadeira gamer')])), null);
  assert.equal(deliver(memory, snapshot(3, [item('cadeira de escritório')])), null);
  assert.match(deliver(memory, snapshot(4, [item('cadeira de rodas')])).text, /cadeira de rodas/);
  const shifted = new VisualMemory();
  deliver(shifted, snapshot(1, [item('cadeira')]));
  assert.match(
    deliver(shifted, snapshot(2, [item('cadeira gamer', { bearing: 10 })])).text,
    /cadeira gamer/,
  );
  const ambiguous = new VisualMemory();
  deliver(ambiguous, snapshot(1, [item('cadeira')]));
  assert.match(
    deliver(ambiguous, snapshot(2, [item('cadeira'), item('cadeira gamer')])).text,
    /cadeira gamer/,
  );
  assert.equal(deliver(ambiguous, snapshot(3, [item('cadeira'), item('cadeira gamer')])), null);
});

test('CA-F1/F4: lower person counts do not reset delivered quantity; additional presence remains news', () => {
  const memory = new VisualMemory(),
    person = item('pessoa', { kind: 'person' });
  deliver(memory, snapshot(1, [person]));
  assert.match(deliver(memory, snapshot(2, [person, person])).text, /2 pessoas/);
  for (let frame = 3; frame < 20; frame++)
    assert.equal(deliver(memory, snapshot(frame, frame % 2 ? [person] : [person, person])), null);
  assert.match(deliver(memory, snapshot(20, [person, person, person])).text, /3 pessoas/);
});

test('CA-F1/F4: five-minute stationary variation preserves silence after one place correction and explicit replay works', () => {
  const memory = new VisualMemory(),
    person = item('pessoa', { kind: 'person' });
  let outputs = [];
  for (let frame = 1; frame <= 61; frame++) {
    const observations = [item(frame % 2 ? 'cadeira gamer' : 'cadeira de escritório')];
    if (frame % 3 !== 0) observations.push(frame % 4 === 0 ? { ...person, box: null } : person);
    const output = deliver(
      memory,
      snapshot(frame, observations, {
        at: frame * 5000,
        scene: frame < 4 ? 'escritório' : Math.floor(frame / 3) % 2 ? 'sala' : 'quarto',
      }),
    );
    if (output) outputs.push(output.text);
  }
  assert.equal(outputs.length, 2);
  assert.match(outputs[0], /cadeira/);
  assert.doesNotMatch(outputs[1], /cadeira|pessoa/);
  assert.match(memory.utterance(310000, true).text, /capturada há/);
});

test('CA-F6/L4: same-frame questions cannot confirm absence or acknowledge an interrupted correction', () => {
  const memory = new VisualMemory(),
    chair = item('cadeira'),
    person = item('pessoa', { kind: 'person' });
  deliver(memory, snapshot(1, [chair, person]));
  const missing = snapshot(2, [chair]);
  for (let question = 0; question < 4; question++) {
    const query = structuredClone(missing);
    query.stamp.requestId += `-${question}`;
    assert.equal(memory.accept(query, query.stamp.capturedAtMs + 500, 1), true);
    assert.equal(memory.utterance(query.stamp.capturedAtMs + 500, false, true), null);
  }
  assert.equal(deliver(memory, snapshot(3, [chair, person])), null);
  const correction = snapshot(4, [chair, person], { scene: 'sala' });
  assert.equal(deliver(memory, correction), null);
  const pending = deliver(memory, snapshot(5, [chair, person], { scene: 'sala' }), {
    complete: false,
  });
  assert.match(pending.text, /sala/);
  const retry = memory.utterance(23000, false, true);
  assert.match(retry.text, /sala/);
  assert.equal(memory.complete(pending.id, 23100), false);
  assert.equal(memory.complete(retry.id, 23200), true);
  assert.equal(deliver(memory, snapshot(6, [chair, person], { scene: 'sala' })), null);
});

test('CA-F1/F4: mixed certainty within a known person quantity does not split and repeat the group', () => {
  const memory = new VisualMemory(),
    person = item('pessoa', { kind: 'person' });
  deliver(memory, snapshot(1, [person, person]));
  for (let frame = 2; frame < 10; frame++)
    assert.equal(
      deliver(memory, snapshot(frame, [person, { ...person, uncertain: frame % 2 === 0 }])),
      null,
    );
});
