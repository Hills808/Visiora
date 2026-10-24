import test from 'node:test';
import assert from 'node:assert/strict';
const memoryModule =
  process.env.VISIORA_TRACK_MEMORY_MODULE ??
  new URL('../dist/brain/track-memory.js', import.meta.url).href;
const { TrackMemory } = await import(memoryModule);
const { CONFIG } = await import(new URL('../config.js', memoryModule));

const options = {
  minHits: 2,
  minIou: 0.2,
  maxGapMs: 500,
  maxAgeMs: 3000,
  retentionMs: 5000,
  maxTracks: 4,
};
const source = { id: 'test-local', revision: 'fixture-1', simulated: true };
function observation(x = 0.2, label = 'person', width = 0.2) {
  return { label, score: 0.9, verified: true, box: { x, y: 0.2, width, height: 0.4 } };
}
function result(id, time, observations = [observation()], generation = 1) {
  return {
    schemaVersion: 1,
    source: { ...source },
    observations,
    stamp: {
      schemaVersion: 1,
      sessionGeneration: generation,
      frameId: id,
      capturedAtMs: time,
      width: 640,
      height: 480,
      orientation: 'browser-upright',
      mirrored: false,
    },
    transform: { width: 640, height: 480, scaleX: 1, scaleY: 1 },
  };
}
function fixture(overrides = {}) {
  const memory = new TrackMemory({ ...options, ...overrides });
  memory.reset(1);
  const accept = (id, time, observations, now = time, revision = memory.viewRevision) =>
    memory.accept(result(id, time, observations), now, revision);
  return { memory, accept };
}

test('CA-H2/H3: only consecutive distinct recent frames confirm; snapshots preserve provenance', () => {
  const { memory, accept } = fixture();
  assert.equal(accept(1, 100), true);
  const first = memory.snapshot(100)[0];
  assert.equal(first.state, 'candidate');
  assert.equal(accept(2, 200), true);
  const current = memory.snapshot(200)[0];
  assert.equal(current.id, first.id);
  assert.equal(current.state, 'confirmed');
  assert.equal(current.consecutiveHits, 2);
  assert.equal(current.lastObservedAt, 200);
  assert.deepEqual(current.source, source);
  assert.equal(current.stamp.frameId, 2);
  assert.equal(current.sector, 'front');
  assert.equal('distance' in current || 'velocity' in current || 'approaching' in current, false);
  current.box.x = 0.9;
  current.source.revision = 'mutated';
  current.stamp.capturedAtMs = 999;
  assert.equal(memory.snapshot(200)[0].box.x, 0.2);
  assert.equal(memory.snapshot(200)[0].source.revision, source.revision);
  assert.equal(memory.snapshot(200)[0].lastObservedAt, 200);
});

test('CA-H2: replay, out-of-order, stale, future, other generation and malformed boxes do not add hits or misses', () => {
  const { memory, accept } = fixture();
  accept(10, 100);
  const before = memory.snapshot(100);
  const invalid = [
    result(10, 101),
    result(9, 101),
    result(11, 99),
    result(11, 100),
    result(11, 200, undefined, 2),
    result(11, 4001),
    result(11, 101, [observation(0.9)]),
  ];
  for (const frame of invalid) assert.equal(memory.accept(frame, 200, memory.viewRevision), false);
  assert.equal(memory.accept(result(11, 101), 3102, memory.viewRevision), false);
  assert.deepEqual(memory.snapshot(200), before);
  assert.equal(memory.diagnostics(200).rejectedFrames, invalid.length + 1);
  accept(11, 201);
  assert.equal(memory.snapshot(201)[0].state, 'confirmed');
});

test('CA-H2: temporal gap starts new candidates, without transferring an earlier confirmation', () => {
  const { memory, accept } = fixture();
  accept(1, 100);
  const firstId = memory.snapshot(100)[0].id;
  accept(2, 701);
  const tracks = memory.snapshot(701);
  assert.equal(tracks.find((track) => track.id === firstId).state, 'occluded');
  const next = tracks.find((track) => track.id !== firstId);
  assert.equal(next.state, 'candidate');
  assert.equal(next.consecutiveHits, 1);
});

test('CA-H2/H3: occlusion is unknown; reappearance requires confirmation again and never predicts age', () => {
  const { memory, accept } = fixture();
  accept(1, 100);
  accept(2, 200);
  const id = memory.snapshot(200)[0].id;
  accept(3, 300, []);
  const missing = memory.snapshot(300)[0];
  assert.equal(missing.state, 'occluded');
  assert.equal(missing.lastObservedAt, 200);
  assert.equal(missing.misses, 1);
  assert.equal(missing.sector, undefined);
  memory.snapshot(400);
  assert.equal(memory.snapshot(400)[0].lastObservedAt, 200);
  assert.equal(memory.snapshot(400)[0].misses, 1);
  accept(4, 400);
  assert.equal(memory.snapshot(400)[0].id, id);
  assert.equal(memory.snapshot(400)[0].state, 'candidate');
  accept(5, 500);
  assert.equal(memory.snapshot(500)[0].state, 'confirmed');
  assert.deepEqual(memory.snapshot(3501), []);
  assert.equal(memory.diagnostics(3501).retainedTracks, 1);
  assert.equal(memory.diagnostics(5501).retainedTracks, 0);
});

test('CA-H3: same-class crossing ambiguity suspends old associations; separated detections receive new candidates', () => {
  const { memory, accept } = fixture();
  const separate = [observation(0.1, 'person', 0.35), observation(0.5, 'person', 0.35)];
  accept(1, 100, separate);
  accept(2, 200, separate);
  const oldIds = memory.snapshot(200).map((track) => track.id);
  accept(3, 300, [observation(0.3, 'person', 0.35)]);
  assert.equal(memory.snapshot(300).length, 2);
  assert.ok(
    memory
      .snapshot(300)
      .every((track) => track.state === 'occluded' && track.lastObservedAt === 200),
  );
  assert.equal(memory.diagnostics(300).ambiguousObservations, 1);
  accept(4, 400, separate);
  const candidates = memory.snapshot(400).filter((track) => track.state === 'candidate');
  assert.equal(candidates.length, 2);
  assert.ok(candidates.every((track) => !oldIds.includes(track.id)));
});

test('CA-H3: one earlier detection cannot supply confirmation to two overlapping observations', () => {
  const { memory, accept } = fixture();
  accept(1, 100);
  accept(2, 200, [observation(0.18), observation(0.22)]);
  assert.equal(memory.snapshot(200).length, 1);
  assert.equal(memory.snapshot(200)[0].state, 'occluded');
  assert.equal(memory.diagnostics(200).ambiguousObservations, 2);
});

test('CA-H2: class and source changes cannot reuse confirmation from earlier evidence', () => {
  const { memory, accept } = fixture();
  accept(1, 100);
  accept(2, 200, [observation(0.2, 'chair')]);
  assert.ok(memory.snapshot(200).every((track) => track.state !== 'confirmed'));
  const changed = result(3, 300, [observation(0.2, 'chair')]);
  changed.source.revision = 'fixture-2';
  assert.equal(memory.accept(changed, 300, memory.viewRevision), true);
  assert.equal(memory.snapshot(300).length, 1);
  assert.equal(memory.snapshot(300)[0].state, 'candidate');
  assert.equal(memory.snapshot(300)[0].source.revision, 'fixture-2');
});

test('CA-H2/H9: A to B to A and late results never resurrect prior associations', () => {
  const { memory, accept } = fixture();
  accept(1, 100);
  accept(2, 200);
  const before = memory.snapshot(200)[0];
  const aRevision = memory.viewRevision;
  memory.invalidateView();
  assert.equal(memory.viewRevision, aRevision + 1);
  assert.deepEqual(memory.snapshot(210), []);
  assert.equal(accept(3, 220, undefined, 220, aRevision), false);
  accept(4, 230, [observation(0.65)]);
  memory.invalidateView();
  accept(5, 300);
  const after = memory.snapshot(300)[0];
  assert.notEqual(after.id, before.id);
  assert.equal(after.state, 'candidate');
  assert.equal(after.firstObservedAt, 300);
});

test('CA-H9: reset/stop removes state; previous generation and revision stay rejected', () => {
  const { memory, accept } = fixture();
  accept(1, 100);
  const revision = memory.viewRevision;
  memory.reset(2);
  assert.deepEqual(memory.snapshot(200), []);
  assert.equal(memory.accept(result(2, 200), 200, revision), false);
  assert.equal(memory.accept(result(2, 200), 200, memory.viewRevision), false);
  assert.equal(memory.accept(result(1, 200, undefined, 2), 200, memory.viewRevision), true);
  assert.equal(memory.snapshot(200)[0].state, 'candidate');
  memory.setGeneration(3);
  assert.deepEqual(memory.snapshot(300), []);
});

test('CA-H9: retained association storage is bounded and diagnostics export numbers only', () => {
  const { memory, accept } = fixture({ maxTracks: 2 });
  for (let frame = 1; frame <= 100; frame++) {
    accept(frame, frame * 50, [observation(0.2, `item${frame}`)]);
    assert.ok(memory.diagnostics(frame * 50).retainedTracks <= 2);
  }
  const diagnostic = memory.diagnostics(5000);
  assert.equal(diagnostic.pendingFrames, 0);
  assert.ok(diagnostic.evictedTracks > 0);
  assert.ok(
    Object.values(diagnostic).every((value) => typeof value === 'number' && Number.isFinite(value)),
  );
  assert.doesNotMatch(JSON.stringify(diagnostic), /item100|fixture|box|label|local-|frameId/);
  assert.throws(() => new TrackMemory({ ...options, minHits: 0 }), /options/);
  assert.throws(() => new TrackMemory({ ...options, maxAgeMs: 3001 }), /options/);
});

test('CA-H2: observation and source buffers cannot mutate stored evidence after acceptance', () => {
  const { memory } = fixture();
  const input = result(1, 100);
  memory.accept(input, 100, memory.viewRevision);
  input.observations[0].box.x = 0.7;
  input.source.id = 'mutated';
  input.stamp.frameId = 999;
  const track = memory.snapshot(100)[0];
  assert.equal(track.box.x, 0.2);
  assert.equal(track.source.id, source.id);
  assert.equal(track.stamp.frameId, 1);
});

test('CA-H2: arbitrary observation attributes never become tracking facts', () => {
  const { memory } = fixture();
  const input = result(1, 100);
  Object.assign(input.observations[0], { distance: 2, approaching: true, identity: 'person-name' });
  memory.accept(input, 100, memory.viewRevision);
  const track = memory.snapshot(100)[0];
  assert.equal('distance' in track || 'approaching' in track || 'identity' in track, false);
});

test('CA-H2: limited capacity drops additional candidates and accepts configured single-hit mode', () => {
  const { memory, accept } = fixture({ minHits: 1, maxTracks: 1 });
  accept(1, 100, [observation(), observation(0.7, 'chair')]);
  assert.equal(memory.snapshot(100).length, 1);
  assert.equal(memory.snapshot(100)[0].state, 'confirmed');
  assert.equal(memory.diagnostics(100).capacityDrops, 1);
});

test('CA-H2: a small sector boundary oscillation may retain camera-sector wording, not geometry', () => {
  const { memory, accept } = fixture({ sectorHysteresisDegrees: 3 });
  const boxAtBearing = (degrees) => {
    const center =
      (1 + Math.tan((degrees * Math.PI) / 180) / Math.tan((CONFIG.space.fov * Math.PI) / 360)) / 2;
    return observation(center - 0.05, 'chair', 0.1);
  };
  accept(1, 100, [boxAtBearing(22)]);
  const before = memory.snapshot(100)[0];
  accept(2, 200, [boxAtBearing(23)]);
  const after = memory.snapshot(200)[0];
  assert.equal(after.id, before.id);
  assert.equal(after.sector, before.sector);
  assert.notEqual(after.box.x, before.box.x);
});
