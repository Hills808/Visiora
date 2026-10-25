import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoAnalysis } from '../dist/vision/auto-analysis.js';
import { VisualMemory } from '../dist/brain/visual-memory.js';
import { CONFIG } from '../dist/config.js';
import { compareViews } from '../dist/vision/view-change.js';
import { snapshotSpeech } from '../dist/brain/snapshot-speech.js';
import { SnapshotView } from '../dist/vision/snapshot-view.js';
import { OnlineSession } from '../dist/vision/online-session.js';

function result(frame = 1, label = 'porta aberta') {
  return {
    schemaVersion: 1,
    source: 'fake',
    stamp: {
      requestId: `auto-${frame}`,
      sessionGeneration: 1,
      frameId: frame,
      capturedAtMs: frame * 1000,
      width: 640,
      height: 480,
      intent: 'describe',
      term: '',
    },
    evidence: {
      scene: { label: 'escritório', support: ['a'] },
      observations: [
        {
          id: 'a',
          kind: 'object',
          label,
          article: 'uma',
          uncertain: false,
          box: { x: 0.8, y: 0.1, width: 0.1, height: 0.5 },
        },
      ],
      relations: [],
      limitations: [],
    },
  };
}

test('CA-F2/F7: one direction per sector, preserving uncertainty and maximum three items', () => {
  const memory = new VisualMemory(),
    snapshot = result();
  snapshot.evidence.scene.label = 'quarto';
  snapshot.evidence.observations = ['janela com veneziana', 'pessoa', 'cama', 'mesa'].map(
    (label, i) => ({
      ...snapshot.evidence.observations[0],
      id: String(i),
      label,
      kind: label === 'pessoa' ? 'person' : 'object',
      box: { x: 0.4, y: 0.1, width: 0.2, height: 0.5 },
    }),
  );
  memory.accept(snapshot, 1500, 1);
  for (const automatic of [false, true]) {
    const utterance = memory.utterance(1500, false, automatic);
    assert.match(
      utterance.text,
      /À frente da câmera, havia uma janela com veneziana, uma pessoa e uma cama\./,
    );
    assert.equal(utterance.text.match(/À frente da câmera/g).length, 1);
    assert.doesNotMatch(utterance.text, /mesa/);
    assert.ok(utterance.text.split(/\s+/).length <= CONFIG.speech.briefingWords);
  }
  assert.equal(
    snapshotSpeech([
      { sector: 'front', noun: 'uma pessoa', mode: 'present' },
      { sector: 'front', noun: 'uma cama', mode: 'uncertain' },
      { sector: 'frontRight', noun: 'uma janela', mode: 'present' },
    ]),
    'À frente da câmera, havia uma pessoa; talvez houvesse uma cama. À frente, à direita da câmera, havia uma janela.',
  );
});

test('CA-F3/F4/P6: broad view change offers aged scene only once, without acknowledging omitted objects', () => {
  const memory = new VisualMemory();
  memory.accept(result(), 1500, 1);
  const context = memory.utterance(1500, false, true, false, true);
  assert.match(context.text, /capturada há 1 segundo: O ambiente parecia escritório\./);
  assert.doesNotMatch(context.text, /porta|À sua/);
  assert.ok(memory.utterance(1600, false, true, false, true)); // Not acknowledged until completed.
  memory.complete(memory.utterance(1700, false, true, false, true).id);
  memory.accept(result(2), 2500, 1);
  assert.equal(memory.utterance(2500, false, true, false, true), null);
  assert.match(memory.utterance(2500, false, true).text, /porta aberta/);
  const unknown = result(3);
  unknown.evidence.scene = null;
  memory.accept(unknown, 3500, 1);
  assert.equal(memory.utterance(3500, false, true, false, true), null);
  assert.equal(memory.utterance(14000, false, true, false, true), null);
});

test('CA-F1/L3: activation analyzes once; five static minutes with noise, twelve seeds, do not spend again', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const auto = new AutoAnalysis();
    let calls = 0;
    for (let now = 0; now <= 300000; now += 200) {
      const signature = Array.from(
        { length: 12 },
        (_, i) => 0.5 + Math.sin(seed * now + i) * 0.005,
      );
      if (auto.due(now, signature, true, false)) {
        auto.dispatched(now, signature);
        calls++;
      }
    }
    assert.equal(calls, 1);
  }
});
test('CA-F5/D4/L3: no queue, no dispatch without a fresh frame or while busy, cadence, accumulated change and explicit pause', () => {
  const auto = new AutoAnalysis(),
    gap = CONFIG.online.autoIntervalMs;
  assert.equal(auto.due(0, [], true, false), false);
  assert.equal(auto.due(0, [0], false, false), false);
  assert.equal(auto.due(0, [0], true, true), false);
  auto.dispatched(0, [0]);
  assert.equal(auto.due(gap - 1, [1], true, false), false);
  assert.equal(auto.due(gap, [1], false, false), false);
  assert.equal(auto.due(gap, [1], true, true), false);
  assert.equal(auto.due(gap, [0.02], true, false), false);
  assert.equal(auto.due(gap, [0.05], true, false), true);
  auto.dispatched(gap, [0.05]);
  assert.equal(auto.due(gap * 2, [0.05], true, false), false);
  auto.pause();
  assert.equal(auto.due(gap * 3, [1], true, false), false);
  auto.reset();
  assert.equal(auto.due(gap * 3, [1], true, false), true);
  auto.dispatched(gap * 3, [1]);
  auto.invalidate();
  assert.equal(auto.due(gap * 3 + 1, [1], true, false), false);
  assert.equal(auto.due(gap * 4, [1], true, false), true);
});
test('CA-L4: delivery expiry permits one delayed fresh capture and a second expiry pauses', () => {
  const auto = new AutoAnalysis(),
    gap = CONFIG.online.autoIntervalMs;
  auto.dispatched(0, [0]);
  assert.equal(auto.expiredSnapshot(gap), true);
  assert.equal(auto.isPaused, false);
  assert.equal(auto.due(gap + CONFIG.online.recoveryDelayMs - 1, [0], true, false), false);
  assert.equal(auto.due(gap + CONFIG.online.recoveryDelayMs, [0], true, false), true);
  auto.dispatched(gap + CONFIG.online.recoveryDelayMs, [0]);
  auto.succeeded(); // A completed API response is not an audible delivery.
  assert.equal(auto.expiredSnapshot(gap * 2 + CONFIG.online.recoveryDelayMs), false);
  assert.equal(auto.isPaused, true);
  assert.equal(auto.due(gap * 3 + CONFIG.online.recoveryDelayMs, [1], true, false), false);
  auto.reset();
  auto.dispatched(0, [0]);
  assert.equal(auto.expiredSnapshot(gap), true);
  auto.delivered();
  auto.dispatched(gap + CONFIG.online.recoveryDelayMs, [0]);
  assert.equal(auto.expiredSnapshot(gap * 2 + CONFIG.online.recoveryDelayMs), true);
});
test('CA-F6/L4: Luna speech begun while current may finish after ten seconds without another paid capture', () => {
  const session = Object.create(OnlineSession.prototype);
  const now = performance.now();
  let canceled = 0;
  session.running = true;
  session.generation = 1;
  session.camera = { ready: true, signature: [0] };
  session.observeViews = () => {};
  session.clearReferences = () => {};
  session.hooks = { cancelSpeech: () => canceled++ };
  session.automatic = new AutoAnalysis();
  session.memory = { complete: () => true };
  session.counts = { obsolete: 0, delivered: 0 };
  session.current = {
    id: 'speech-1',
    repeat: false,
    capturedAtMs: now - 5000,
    generation: 1,
    view: { valid: true },
    contextOnly: false,
    expiresAt: now + 3000,
    started: false,
  };
  assert.equal(session.canStart('speech-1'), true);
  assert.equal(session.current.started, true);
  session.current.capturedAtMs = now - CONFIG.online.snapshotMaxAgeMs - 1000;
  session.withdrawDirections();
  assert.equal(canceled, 0);
  assert.equal(session.waiting, undefined);
  assert.equal(session.complete('speech-1'), true);
  assert.equal(session.counts.delivered, 1);
  assert.equal(session.automatic.isPaused, false);
});
test('CA-F6/L4: Luna speech that never started expires into one budgeted recovery, not an immediate pause', () => {
  const session = Object.create(OnlineSession.prototype);
  const old = performance.now() - CONFIG.online.snapshotMaxAgeMs - 1000;
  const messages = [];
  let canceled = 0;
  session.running = true;
  session.generation = 1;
  session.camera = { ready: true, signature: [0] };
  session.observeViews = () => {};
  session.clearReferences = () => {};
  session.hooks = {
    cancelSpeech: () => canceled++,
    canAnalyze: () => true,
    message: (value) => messages.push(value),
    announce: (value) => messages.push(value),
  };
  session.automatic = new AutoAnalysis();
  session.automatic.dispatched(old, [0]);
  session.memory = {
    snapshot: { stamp: { capturedAtMs: old } },
    utterance: () => null,
  };
  session.counts = { obsolete: 0, silent: 0, recoveries: 0 };
  session.resultView = { valid: true };
  session.current = {
    id: 'speech-2',
    repeat: false,
    capturedAtMs: old,
    generation: 1,
    view: session.resultView,
    contextOnly: false,
    expiresAt: performance.now() + 1000,
    started: false,
  };
  session.withdrawDirections();
  assert.equal(canceled, 1);
  assert.equal(session.current, null);
  assert.equal(session.waiting, null); // Recovery is scheduled once when the delivery expires.
  assert.equal(session.automatic.isPaused, false);
  assert.equal(session.automatic.recovering, true);
  assert.equal(session.counts.recoveries, 1);
  assert.equal(session.lastError, 'speech-expired');
  assert.match(messages.join(' '), /captura recente/);
});
test('CA-F6/L4: a voice callback that never finishes pauses without another paid capture', () => {
  const session = Object.create(OnlineSession.prototype);
  const messages = [];
  let canceled = 0;
  session.current = {
    id: 'speech-stalled',
    repeat: false,
    capturedAtMs: performance.now() - CONFIG.online.snapshotMaxAgeMs - 1000,
    generation: 1,
    view: { valid: true },
    contextOnly: false,
    expiresAt: 0,
    started: true,
    startedAtMs: performance.now() - CONFIG.speech.maxOnlineSpeechMs - 1000,
  };
  session.automatic = new AutoAnalysis();
  session.clearReferences = () => {};
  session.hooks = {
    cancelSpeech: () => canceled++,
    message: (value) => messages.push(value),
    announce: (value) => messages.push(value),
  };
  session.withdrawDirections();
  assert.equal(canceled, 1);
  assert.equal(session.current, null);
  assert.equal(session.automatic.isPaused, true);
  assert.equal(session.lastError, 'speech-timeout');
  assert.match(messages.join(' '), /voz demorou demais/);
});
test('CA-L1: localized image changes can schedule without a large global mean change', () => {
  const auto = new AutoAnalysis(),
    baseline = Array(100).fill(0);
  auto.dispatched(0, baseline);
  const localized = baseline.slice();
  localized[0] = localized[1] = 0.2;
  assert.equal(auto.due(CONFIG.online.autoIntervalMs, localized, true, false), true);
});
test('CA-F2/F3/F4/F6/P6: automatic descriptions acknowledge only completed speech and announce new references', () => {
  const memory = new VisualMemory();
  memory.accept(result(), 1500, 1);
  const first = memory.utterance(1500, false, true);
  assert.match(first.text, /escritório.*porta aberta/s);
  assert.match(first.text, /À frente, à direita da câmera/);
  assert.doesNotMatch(first.text, /passos|metros|saída segura|caminho livre/);
  assert.ok(memory.utterance(1600, false, true)); // Not yet acknowledged.
  const finished = memory.utterance(1700, false, true);
  memory.complete(finished.id);
  memory.accept(result(2), 2500, 1);
  assert.equal(memory.utterance(2500, false, true), null);
  const changed = result(3);
  changed.evidence.observations.push({
    ...changed.evidence.observations[0],
    id: 'b',
    label: 'mesa de reunião',
    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.5 },
  });
  memory.accept(changed, 3500, 1);
  const novelty = memory.utterance(3500, false, true);
  assert.match(novelty.text, /mesa de reunião/);
  assert.doesNotMatch(novelty.text, /porta aberta|escritório/);
  memory.complete(novelty.id);
  memory.invalidate();
  assert.equal(memory.snapshot, null);
  assert.match(memory.utterance(5000, true).text, /mesa de reunião/);
  memory.clear();
  assert.equal(memory.utterance(6000, true), null);
});
test('CA-F4/F7/L4: changed person count and direction are described; snapshots stay age-qualified and bounded', () => {
  const memory = new VisualMemory();
  const one = result();
  one.evidence.observations[0].kind = 'person';
  one.evidence.observations[0].label = 'pessoa';
  memory.accept(one, 1500, 1);
  const first = memory.utterance(1500, false, true);
  memory.complete(first.id);
  const two = structuredClone(one);
  two.stamp.frameId = 2;
  two.stamp.capturedAtMs = 2000;
  two.evidence.observations.push({ ...two.evidence.observations[0], id: 'b' });
  memory.accept(two, 2500, 1);
  const next = memory.utterance(2500, false, true);
  assert.match(next.text, /cerca de 2 pessoas/);
  assert.match(next.text, /capturada há 1 segundo/);
  assert.ok(next.text.split(/\s+/).length <= 45);
  memory.complete(next.id);
  const moved = structuredClone(two);
  moved.stamp.frameId = 3;
  moved.stamp.capturedAtMs = 3000;
  moved.evidence.observations.forEach((item) => (item.box.x = 0.05));
  memory.accept(moved, 3500, 1);
  assert.match(memory.utterance(3500, false, true).text, /À frente, à esquerda da câmera/);
});
test('CA-F4/P6: sustained missing references are qualified once; isolated omissions stay silent', () => {
  const memory = new VisualMemory();
  memory.accept(result(), 1500, 1);
  memory.complete(memory.utterance(1500, false, true).id);
  for (const [frame, at] of [
    [2, 2000],
    [3, 6500],
    [4, 11000],
  ]) {
    const empty = result(frame);
    empty.stamp.capturedAtMs = at;
    empty.evidence.observations = [];
    empty.evidence.scene = null;
    memory.accept(empty, at + 100, 1);
    const output = memory.utterance(at + 100, false, true);
    if (frame < 4) assert.equal(output, null);
    else {
      assert.match(output.text, /Não confirmei as referências anteriores nesta captura/);
      assert.doesNotMatch(output.text, /caminho livre|saiu|sumiu/);
      memory.complete(output.id, at + 200);
    }
  }
  const returned = result(5);
  returned.stamp.capturedAtMs = 16000;
  memory.accept(returned, 16100, 1);
  assert.match(memory.utterance(16100, false, true).text, /porta aberta/);
});
test('CA-F9/F4: a confirmed place change in the same view preserves delivered references', () => {
  const memory = new VisualMemory();
  memory.accept(result(), 1500, 1);
  memory.complete(memory.utterance(1500, false, true).id);
  for (const frame of [2, 3]) {
    const changed = result(frame);
    changed.evidence.scene.label = 'biblioteca';
    memory.accept(changed, frame * 1000 + 500, 1);
    const output = memory.utterance(frame * 1000 + 500, false, true);
    if (frame === 2) assert.equal(output, null);
    else {
      assert.match(output.text, /biblioteca/);
      assert.doesNotMatch(output.text, /porta aberta/);
    }
  }
});
test('CA-F4/P6: sustained person non-identification is qualified, not inferred from one missing capture', () => {
  const memory = new VisualMemory();
  const first = result();
  first.evidence.observations.push({
    ...first.evidence.observations[0],
    id: 'p',
    kind: 'person',
    label: 'pessoa',
    box: { x: 0.4, y: 0.1, width: 0.2, height: 0.5 },
  });
  memory.accept(first, 1500, 1);
  memory.complete(memory.utterance(1500, false, true).id);
  for (const [frame, at] of [
    [2, 2000],
    [3, 6500],
    [4, 11000],
  ]) {
    const next = result(frame);
    next.stamp.capturedAtMs = at;
    memory.accept(next, at + 100, 1);
    const absent = memory.utterance(at + 100, false, true);
    if (frame < 4) assert.equal(absent, null);
    else {
      assert.match(absent.text, /Não identifiquei pessoas nesta captura/);
      assert.doesNotMatch(absent.text, /saiu|sumiu|passos|caminho livre/);
      assert.ok(memory.utterance(at + 200, false, true));
      memory.complete(memory.utterance(at + 300, false, true).id, at + 400);
    }
  }
  first.stamp.frameId = 5;
  first.stamp.capturedAtMs = 16000;
  memory.accept(first, 16100, 1);
  assert.match(memory.utterance(16100, false, true).text, /havia uma pessoa/);
});

test('CA-F4/F9: broad structural change reorients the same room; uniform lighting is not a new room', () => {
  const baseline = Array(32 * 24 * 3).fill(0.5);
  const lighting = baseline.map((n) => n + 0.2);
  const different = baseline.map((n, i) => n + (Math.floor(i / 3) % 2 ? 0.3 : -0.3));
  assert.equal(compareViews(baseline, lighting).broad, false);
  assert.equal(compareViews(baseline, different).broad, true);
  const memory = new VisualMemory();
  memory.accept(result(), 1500, 1);
  memory.complete(memory.utterance(1500, false, true).id);
  memory.accept(result(2), 2500, 1);
  assert.equal(memory.utterance(2500, false, true), null);
  assert.match(
    memory.utterance(2500, false, true, true).text,
    /Neste enquadramento.*escritório.*porta aberta/s,
  );
});

test('CA-L1/F5: moderate localized and accumulated slow changes trigger a capture without global motion', () => {
  const baseline = Array(32 * 24 * 3).fill(0.5),
    localized = baseline.slice();
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 8; x++) for (let c = 0; c < 3; c++) localized[(y * 32 + x) * 3 + c] += 0.1;
  const delta = compareViews(baseline, localized);
  assert.ok(delta.mean < CONFIG.online.autoChangeDelta);
  assert.equal(delta.fraction, 0);
  assert.equal(delta.tiles, 2);
  assert.equal(delta.changed, true);
  const auto = new AutoAnalysis();
  auto.dispatched(0, baseline);
  assert.equal(auto.due(CONFIG.online.autoIntervalMs, localized, true, false), true);
});

test('CA-L3/D4: only one delayed recovery; repeated failure pauses; success resets streak and stop cancels retry', () => {
  const auto = new AutoAnalysis(),
    view = [0.5];
  auto.dispatched(0, view);
  assert.equal(auto.failed(1000, true), true);
  assert.equal(auto.recovering, true);
  auto.invalidate(); // Camera motion cannot bypass the recovery delay.
  assert.equal(auto.due(15999, view, true, false), false);
  assert.equal(auto.due(16000, view, true, false), true);
  auto.dispatched(16000, view);
  assert.equal(auto.failed(17000, true), false);
  assert.equal(auto.due(100000, view, true, false), false);
  auto.reset();
  auto.dispatched(100000, view);
  auto.failed(101000, true);
  auto.dispatched(116000, view);
  auto.succeeded();
  assert.equal(auto.failed(117000, true), true);
  auto.pause();
  assert.equal(auto.recovering, false);
  assert.equal(auto.due(200000, view, true, false), false);
  auto.reset();
  assert.equal(auto.failed(201000, false), false); // Budget, consent, model/contract errors never retry.
});

test('CA-F4/L3: delivered A, broad B, return A still requires one replacement at cadence; small view change preserves result', () => {
  const session = Object.create(OnlineSession.prototype);
  const baseline = Array(32 * 24 * 3).fill(0.5);
  const broad = baseline.map((n, i) => n + (Math.floor(i / 3) % 2 ? 0.3 : -0.3));
  const auto = new AutoAnalysis();
  auto.dispatched(0, baseline);
  auto.delivered();
  let forgotten = 0;
  session.automatic = auto;
  session.camera = { signature: baseline };
  session.memory = { forgetDirections: () => forgotten++ };
  session.clearReferences = () => {};
  session.resultView = new SnapshotView(baseline);
  session.observeViews();
  session.camera.signature = baseline.map((n) => n + 0.01);
  session.observeViews();
  assert.equal(session.resultView.valid, true);
  assert.equal(forgotten, 0);
  session.camera.signature = broad;
  session.observeViews();
  session.camera.signature = baseline;
  session.observeViews();
  assert.equal(session.resultView.valid, false);
  assert.equal(forgotten, 1);
  const gap = CONFIG.online.autoIntervalMs;
  assert.equal(auto.due(gap - 1, baseline, true, false), false);
  assert.equal(auto.due(gap, baseline, true, false), true);
  auto.dispatched(gap, baseline);
  assert.equal(auto.due(gap * 2, baseline, true, false), false);
  auto.invalidate();
  auto.failed(gap * 2, true);
  assert.equal(auto.due(gap * 2 + CONFIG.online.recoveryDelayMs - 1, baseline, true, false), false);
  auto.pause();
  assert.equal(auto.due(100000, baseline, true, false), false);
});

test('CA-F4/L4: automatic invalid view skips historical speech; manual context and Repeat remain available', () => {
  const session = Object.create(OnlineSession.prototype);
  session.running = true;
  session.camera = { ready: true };
  session.resultView = { valid: false };
  session.automatic = new AutoAnalysis();
  session.automatic.dispatched(0, [0]);
  let prepared = 0,
    presented = 0;
  session.memory = {
    pendingCapturedAt: performance.now(),
    utterance: () => {
      prepared++;
      return { id: 'test', expiresAt: performance.now() + 5000 };
    },
  };
  session.hooks = { canAnalyze: () => true, present: () => presented++ };
  session.clearReferences = () => {};
  const previous = globalThis.document;
  globalThis.document = { querySelector: () => null };
  try {
    session.present(false, true);
    assert.equal(prepared, 0);
    assert.equal(presented, 0);
    assert.equal(session.automatic.due(CONFIG.online.autoIntervalMs, [0], true, false), true);
    session.present(false, false);
    session.present(true, false);
    assert.equal(presented, 2);
  } finally {
    globalThis.document = previous;
  }
});

test('CA-L4/F4: obsolete notice is short and deduplicated; only fresh delivered content clears the streak', () => {
  const session = Object.create(OnlineSession.prototype);
  const notices = [];
  session.hooks = { announce: (value) => notices.push(value) };
  session.unusableResponses = 0;
  session.sceneNoticeAnnounced = false;
  for (let i = 0; i < CONFIG.online.obsoleteNoticeAfter + 2; i++) session.noteUnusableResponse();
  assert.equal(notices.length, 1);
  assert.ok(notices[0].split(/\s+/).length <= CONFIG.speech.maxWords);
  assert.doesNotMatch(notices[0], /vou|nova captura|caminho livre/i);
  session.observeViews = () => {};
  session.withdrawDirections = () => {};
  session.running = true;
  session.generation = 1;
  session.memory = { complete: () => true };
  session.counts = { delivered: 0 };
  session.automatic = new AutoAnalysis();
  function deliver(repeat, contextOnly) {
    session.current = {
      id: 'one',
      started: true,
      generation: 1,
      repeat,
      contextOnly,
      startedAtMs: null,
    };
    assert.equal(session.complete('one'), true);
  }
  deliver(true, false);
  assert.ok(session.unusableResponses > 0);
  deliver(false, true);
  assert.ok(session.unusableResponses > 0);
  deliver(false, false);
  assert.equal(session.unusableResponses, 0);
  assert.equal(session.sceneNoticeAnnounced, false);
});

test('CA-L3/L4: late voice start followed by UI drop respects delayed recovery and pauses after second expiration', () => {
  const session = Object.create(OnlineSession.prototype);
  const now = performance.now();
  session.running = true;
  session.generation = 1;
  session.camera = { ready: true, signature: [0.5] };
  session.automatic = new AutoAnalysis();
  session.counts = { obsolete: 0, recoveries: 0 };
  session.clearReferences = () => {};
  session.observeViews = () => {};
  session.hooks = {
    cancelSpeech: () => session.interrupted('late'),
    message: () => {},
    announce: () => {},
  };
  const output = () => ({
    id: 'late',
    generation: 1,
    started: false,
    repeat: false,
    contextOnly: false,
    capturedAtMs: now - 6000,
    expiresAt: now - 500,
    view: { valid: true },
    automatic: true,
  });
  session.automatic.dispatched(now - 6000, [0.5]);
  session.current = output();
  assert.equal(session.canStart('late'), false);
  session.interrupted('late');
  assert.equal(session.current, null);
  assert.equal(session.automatic.recovering, true);
  assert.equal(
    session.automatic.due(now + CONFIG.online.recoveryDelayMs - 1, [0.5], true, false),
    false,
  );
  assert.equal(session.counts.recoveries, 1);
  session.automatic.dispatched(now + CONFIG.online.recoveryDelayMs, [0.5]);
  session.automatic.succeeded();
  session.current = output();
  assert.equal(session.canStart('late'), false);
  session.interrupted('late');
  assert.equal(session.automatic.isPaused, true);
  assert.equal(session.automatic.due(now + 99999, [0.5], true, false), false);
  assert.equal(session.counts.recoveries, 1);
});

test('CA-F6/L3: historical output without a start callback expires without buying a replacement', () => {
  for (const [repeat, contextOnly] of [
    [true, false],
    [false, true],
  ]) {
    const session = Object.create(OnlineSession.prototype);
    const now = performance.now();
    session.automatic = new AutoAnalysis();
    session.automatic.dispatched(now - 6000, [0.5]);
    session.current = {
      id: 'history',
      repeat,
      contextOnly,
      started: false,
      startedAtMs: null,
      expiresAt: now - 1,
    };
    session.hooks = { cancelSpeech: () => session.interrupted('history') };
    session.withdrawDirections();
    assert.equal(session.current, null);
    assert.equal(session.waiting, null);
    assert.equal(session.automatic.isPaused, false);
    assert.equal(session.automatic.due(now, [0.5], true, false), false);
  }
});
test('CA-L3/L4: completing historical output cannot renew the single fresh-expiration recovery', () => {
  for (const [repeat, contextOnly] of [
    [true, false],
    [false, true],
  ]) {
    const session = Object.create(OnlineSession.prototype);
    const now = performance.now();
    session.running = true;
    session.generation = 1;
    session.observeViews = () => {};
    session.withdrawDirections = () => {};
    session.memory = { complete: () => true };
    session.counts = { delivered: 0 };
    session.automatic = new AutoAnalysis();
    session.automatic.dispatched(now, [0.5]);
    assert.equal(session.automatic.expiredSnapshot(now), true);
    session.current = {
      id: 'history',
      repeat,
      contextOnly,
      started: true,
      generation: 1,
      startedAtMs: null,
    };
    assert.equal(session.complete('history'), true);
    session.automatic.dispatched(now + CONFIG.online.recoveryDelayMs, [0.5]);
    session.automatic.succeeded();
    assert.equal(session.automatic.expiredSnapshot(now + CONFIG.online.recoveryDelayMs), false);
    assert.equal(session.automatic.isPaused, true);
  }
});
