import test from 'node:test';
import assert from 'node:assert/strict';
import { Brain } from '../dist/brain/brain.js';
import { RecognitionTrace } from '../dist/diagnostics.js';
const frame = (id, time, detections) => ({
  frameId: id,
  capturedAtMs: time,
  detections,
  pose: { x: 0, y: 0, yaw: 0 },
  yawRate: 0,
});
function ready() {
  const brain = new Brain();
  for (let t = 0; t <= 4000; t += 200)
    brain.ingest(frame(t, t, [{ cls: 'chair', score: 0.9, bearing: 0 }]), t);
  return brain;
}

test('queued current object description cannot start after the object disappears', () => {
  const brain = ready();
  brain.ask('ahead');
  const pending = brain.next(4000);
  assert.match(pending.text, /cadeira/);
  brain.ingest(frame(4200, 4200, []), 4200);
  assert.equal(brain.start(pending.id, 4200), false);
  assert.equal(brain.saidCount, 0);
  brain.drop(pending.id);
  const replanned = brain.next(4200);
  assert.match(replanned.text, /Não identifiquei/);
  assert.equal(brain.start(replanned.id, 4200), true);
});
test('queued directions are re-evaluated after an object changes sector', () => {
  const brain = new Brain();
  for (let t = 0; t <= 4000; t += 200)
    brain.ingest(frame(t, t, [{ cls: 'chair', score: 0.9, bearing: 20 }]), t);
  brain.ask('ahead');
  const pending = brain.next(4000);
  brain.ingest(frame(4200, 4200, [{ cls: 'chair', score: 0.9, bearing: 28 }]), 4200);
  assert.equal(brain.facts(4200)[0].id, pending.facts[0].id);
  assert.notEqual(brain.facts(4200)[0].sector, pending.facts[0].sector);
  assert.equal(brain.start(pending.id, 4200), false);
});
test('a place withdrawn before voice starts is replanned as uncertainty', () => {
  const brain = ready();
  for (const t of [2000, 4000])
    brain.ingestScene(
      { frameId: t, capturedAtMs: t, source: 'image-model', accepted: true, category: 'bedroom' },
      t,
    );
  brain.ask('where');
  const pending = brain.next(4000);
  assert.match(pending.text, /quarto/);
  brain.ingestScene(
    { frameId: 4200, capturedAtMs: 4200, source: 'image-model', accepted: false, category: null },
    4200,
  );
  assert.equal(brain.start(pending.id, 4200), false);
  brain.drop(pending.id);
  const next = brain.next(4200);
  assert.match(next.text, /Não tenho certeza/);
  assert.equal(brain.start(next.id, 4200), true);
});
test('explicit old-memory answers remain labelled and can start', () => {
  const brain = ready();
  brain.ingest(frame(4200, 4200, []), 4200);
  brain.ask('find', 'cadeira');
  const answer = brain.next(4200);
  assert.match(answer.text, /Vi há/);
  assert.equal(brain.start(answer.id, 4200), true);
});
test('object evidence retains its actual capture frame; diagnostics omit images and descriptions', () => {
  const brain = ready();
  brain.ask('ahead');
  const answer = brain.next(4000);
  assert.equal(answer.facts[0].frameId, 4000);
  assert.equal(answer.facts[0].observedAtMs, 4000);
  const trace = new RecognitionTrace();
  trace.recordObjects({ frameId: 4000, capturedAtMs: 4000 });
  trace.recordDescription(answer);
  assert.equal(trace.label(6000), 'Última descrição · há 2 s');
  const snapshot = trace.snapshot();
  assert.deepEqual(snapshot.lastDescription.objectFrames, [4000]);
  assert.equal(snapshot.lastDescription.oldestEvidenceAtMs, 4000);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /cadeira|chair|image|rgba/);
  trace.clear();
  assert.equal(trace.label(9000), '');
  assert.equal(trace.snapshot().lastDescription, null);
});
