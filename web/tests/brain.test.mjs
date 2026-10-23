import test from 'node:test';
import assert from 'node:assert/strict';
import { Brain } from '../dist/brain/brain.js';
import { World } from '../dist/brain/world.js';
import { SceneEstimator } from '../dist/brain/scene.js';
import {
  DIRECTIONS,
  SECTORS,
  normAngle,
  sectorOf,
  validDepth,
  quantizeSteps,
  bearingFromX,
  angularDistance,
} from '../dist/brain/geometry.js';
import { LEX, findClass } from '../dist/brain/lexicon.js';
import {
  countPhrase,
  describeGroup,
  oldMemory,
  numberWord,
  distancePhrase,
  words,
} from '../dist/brain/realizer.js';
import { SCENARIOS, scenarioFrame } from '../dist/sim/scenarios.js';
import { CONFIG } from '../dist/config.js';

const pose = { x: 0, y: 0, yaw: 0 };
function observation(t, id, detections, extra = {}) {
  return {
    frameId: id,
    capturedAtMs: t,
    detections: detections.map((d) => ({
      cls: 'chair',
      score: 0.9,
      bearing: 0,
      ...d,
      ...(typeof d.range === 'number'
        ? { depth: { meters: d.range, sigma: 0.1, source: 'metric', frameId: id } }
        : {}),
    })),
    pose,
    yawRate: 0,
    ...extra,
  };
}
function feed(brain, start, end, detections = [{ range: 4 }], extra = {}) {
  for (let t = start; t <= end; t += 200) brain.ingest(observation(t, t, detections, extra), t);
}
function ready(detections = [{ range: 4 }]) {
  const brain = new Brain();
  feed(brain, 0, 4000, detections);
  return brain;
}
function sceneEvidence(time, category = 'classroom', accepted = true) {
  return { category, accepted, source: 'image-model', frameId: time, capturedAtMs: time };
}
function speak(brain, utterance, t) {
  assert.ok(utterance);
  assert.equal(brain.start(utterance.id, t), true);
  assert.equal(brain.confirm(utterance.id, t + 1), true);
}

test('CA-F1/F2/F7: six scenes, 12 seeds, five simulated minutes remain quiet after briefing', () => {
  for (const scenario of SCENARIOS)
    for (let seed = 1; seed <= 12; seed++) {
      const brain = new Brain();
      const transcript = [];
      for (let t = 0, id = 0; t <= 300000; t += 200, id++) {
        brain.ingest(scenarioFrame(scenario, t, id, 0, seed), t);
        const u = brain.next(t);
        if (u) {
          transcript.push(u);
          speak(brain, u, t);
        }
      }
      assert.equal(transcript[0].kind, 'briefing');
      assert.ok(transcript[0].createdAt <= 5000);
      assert.ok(transcript.length <= 2, `${scenario.id}/${seed}: ${transcript.length}`);
      for (const u of transcript) {
        assert.doesNotMatch(u.text, /possível obstáculo|objeto não identificado/i);
        assert.ok(words(u.text) <= (u.kind === 'briefing' ? 45 : 25), u.text);
      }
    }
});
test('CA-F3: eight exact fixed directional prefixes', () => {
  const expected = [
    'À sua frente',
    'À sua frente, à direita',
    'À sua direita',
    'Atrás de você, à direita',
    'Atrás de você',
    'Atrás de você, à esquerda',
    'À sua esquerda',
    'À sua frente, à esquerda',
  ];
  SECTORS.forEach((sector, i) => {
    assert.equal(DIRECTIONS[sector], expected[i]);
    const result = describeGroup([{ id: 'a', cls: 'chair', score: 0.9, sector, range: 3.5 }], 0.7);
    assert.ok(result.text.startsWith(expected[i] + ','));
    assert.match(result.text, /cinco passos/);
  });
});
test('CA-P6: depth provenance, frame, finite value and uncertainty are all mandatory', () => {
  const valid = { meters: 3, sigma: 0.2, source: 'metric', frameId: 1 };
  assert.equal(validDepth(valid, 1), true);
  for (const depth of [
    undefined,
    { ...valid, source: 'relative' },
    { ...valid, source: 'size-prior' },
    { ...valid, meters: NaN },
    { ...valid, meters: Infinity },
    { ...valid, meters: -1 },
    { ...valid, frameId: 2 },
    { ...valid, sigma: 2 },
  ])
    assert.equal(validDepth(depth, 1), false);
});
test('CA-P6: entity without scale is retained with direction, no fabricated distance', () => {
  const brain = ready([{ bearing: 25 }]);
  const f = brain.facts(4000)[0];
  assert.equal(f.range, undefined);
  assert.equal(f.sector, 'frontRight');
  const u = brain.next(4000);
  assert.doesNotMatch(u.text, /passo|metro/);
  speak(brain, u, 4000);
  for (const [index, question] of ['ahead', 'describe', 'find'].entries()) {
    brain.ask(question, 'cadeira');
    const answer = brain.next(6000 + index * 800);
    assert.doesNotMatch(answer.text, /passo|metro/);
    speak(brain, answer, 6000 + index * 800);
  }
});
test('CA-D4: stale, duplicated, out-of-order and future observations are rejected', () => {
  const world = new World();
  assert.equal(world.ingest(observation(100, 1, []), 100), true);
  assert.equal(world.ingest(observation(200, 1, []), 200), false);
  assert.equal(world.ingest(observation(50, 2, []), 200), false);
  assert.equal(world.ingest(observation(201, 3, []), 4000), false);
  assert.equal(world.ingest(observation(10000, 4, []), 4000), false);
  assert.equal(world.ingest(observation(NaN, 5, []), 4000), false);
  assert.equal(world.rejectedFrames, 5);
});
test('CA-F4: stable repeated observations do not create duplicate identities', () => {
  const world = new World();
  for (let i = 0; i < 20; i++)
    world.ingest(observation(i * 200, i, [{ bearing: i % 2 ? 1 : -1, range: 4 }]), i * 200);
  assert.equal(world.snapshot(3800).length, 1);
  assert.equal(world.snapshot(3800)[0].confirmed, true);
});
test('CA-F4: two separated chairs stay two entities', () => {
  const brain = ready([
    { bearing: -20, range: 3 },
    { bearing: 20, range: 3 },
  ]);
  assert.equal(brain.facts(4000).length, 2);
});
test('CA-F4: new relevant entity is narrated, unchanged item is not repeated', () => {
  const brain = ready();
  const initial = brain.next(4000);
  speak(brain, initial, 4000);
  feed(brain, 4200, 8000, [{ range: 4 }, { cls: 'door', bearing: 30, range: 4 }]);
  const novelty = brain.next(8000);
  assert.equal(novelty.kind, 'novelty');
  assert.match(novelty.text, /porta/);
  assert.doesNotMatch(novelty.text, /cadeira/);
});
test('CA-F4: 61 percent does not repeat; 60 percent is a material approach', () => {
  const brain = ready();
  speak(brain, brain.next(4000), 4000);
  for (const [t, range] of [
    [5000, 3.5],
    [6000, 3],
    [7000, 2.6],
    [8000, 2.44],
  ])
    brain.ingest(observation(t, t, [{ range }]), t);
  assert.equal(brain.next(8000), null);
  brain.ingest(observation(8200, 8200, [{ range: 2.4 }]), 8200);
  const u = brain.next(8200);
  assert.ok(u);
  assert.match(u.text, /cadeira/);
});
test('CA-F4: explicit repeat is allowed and unknown object name is handled', () => {
  const brain = ready();
  const initial = brain.next(4000);
  speak(brain, initial, 4000);
  brain.ask('repeat');
  assert.equal(brain.next(4300), null);
  const repeat = brain.next(4700);
  assert.equal(repeat.text, initial.text);
  speak(brain, repeat, 4700);
  brain.ask('find', '<script>');
  assert.equal(brain.next(4800), null);
  assert.match(brain.next(5400).text, /Não conheço/);
});
test('CA-F5: all channels including explicit queries are blocked above 15 deg/s', () => {
  for (const rate of [15.1, -30]) {
    const brain = new Brain();
    feed(brain, 0, 6000, [{ range: 4 }], { yawRate: rate });
    brain.ask('ahead');
    assert.equal(brain.next(6000), null);
  }
});
test('CA-F5: boundary at 15 deg/s is accepted after settle, visual motion also blocks', () => {
  const brain = new Brain();
  feed(brain, 0, 4000, [{ range: 4 }], { yawRate: 15 });
  assert.ok(brain.next(4000));
  const moved = new Brain();
  feed(moved, 0, 4000, [{ range: 4 }], { moving: true });
  assert.equal(moved.next(4000), null);
});
test('CA-F5: rotation invalidates confirmation and enforces settling after rotation', () => {
  const brain = ready();
  const u = brain.next(4000);
  brain.start(u.id, 4000);
  brain.ingest(observation(4200, 4200, [{ range: 4 }], { yawRate: 30 }), 4200);
  assert.equal(brain.confirm(u.id, 4300), false);
  brain.drop(u.id);
  feed(brain, 4400, 4800);
  assert.equal(brain.next(4800), null);
  feed(brain, 5000, 6800);
  assert.ok(brain.next(6800));
});
test('CA-F6: planning does not mark spoken; drop re-plans current facts', () => {
  const brain = ready();
  const u = brain.next(4000);
  assert.equal(brain.saidCount, 0);
  assert.equal(brain.confirm(u.id, 4000), false);
  assert.equal(brain.next(4100), null);
  assert.equal(brain.drop('wrong-id'), false);
  assert.equal(brain.drop(u.id), true);
  assert.equal(brain.saidCount, 0);
  const replanned = brain.next(4200);
  assert.notEqual(replanned.id, u.id);
  assert.equal(brain.confirm(u.id, 4200), false);
});
test('CA-F6: expired unstarted speech cannot be confirmed and is re-planned', () => {
  const brain = ready();
  const u = brain.next(4000);
  feed(brain, 4200, 12000);
  assert.equal(brain.start(u.id, 12000), false);
  assert.equal(brain.confirm(u.id, 12000), false);
  const fresh = brain.next(12000);
  assert.notEqual(fresh.id, u.id);
  assert.equal(brain.saidCount, 0);
});
test('CA-F6: a completed long utterance is acknowledged if it began before its TTL', () => {
  const brain = ready();
  const u = brain.next(4000);
  assert.equal(brain.start(u.id, 4000), true);
  feed(brain, 4200, 18000);
  assert.equal(brain.next(18000), null);
  assert.equal(brain.confirm(u.id, 18001), true);
  assert.ok(brain.saidCount > 0);
});
test('CA-F7/F8: entire lexicon has consistent forms and bounded per-sector language', () => {
  assert.ok(Object.keys(LEX).length >= 60);
  for (const [key, lex] of Object.entries(LEX)) {
    assert.equal(countPhrase(key, 1), `${lex.gender === 'f' ? 'uma' : 'um'} ${lex.name}`);
    assert.equal(countPhrase(key, 2), `${lex.gender === 'f' ? 'duas' : 'dois'} ${lex.plural}`);
    const fact = { id: key, cls: key, sector: 'backRight', range: 5, score: 0.6 };
    const result = describeGroup(
      [fact, { ...fact, id: key + 2 }, { ...fact, id: key + 3 }, { ...fact, id: key + 4 }],
      0.7,
    );
    assert.ok(result.facts.length <= 3);
    assert.ok(words(result.text) <= 25);
    assert.match(result.text, /talvez/);
  }
});
test('CA-F8: Portuguese number and alias forms', () => {
  assert.equal(numberWord(1, 'f'), 'uma');
  assert.equal(numberWord(2, 'f'), 'duas');
  assert.equal(numberWord(15), '15');
  assert.equal(findClass('SOFÁ'), 'couch');
  assert.equal(findClass('cadeiras'), 'chair');
  assert.equal(findClass('lousa'), 'whiteboard');
  assert.equal(findClass('dragão'), undefined);
});
test('CA-F9: uncertain room is not confidently named, sufficient evidence stabilizes', () => {
  const scene = new SceneEstimator();
  scene.update(sceneEvidence(0, null, false), 0);
  scene.update(sceneEvidence(4000, null, false), 4000);
  assert.match(scene.describe(), /Não tenho certeza/);
  scene.update(sceneEvidence(5000), 5000);
  assert.equal(scene.room, null);
  scene.update(sceneEvidence(7000), 7000);
  assert.equal(scene.room, 'classroom');
  scene.update(sceneEvidence(8000, 'bathroom'), 8000);
  assert.equal(scene.room, null);
});
test('CA-F9: even a confirmed bed never decides the type of place', () => {
  const brain = ready([{ cls: 'bed', range: 3 }]);
  brain.ask('where');
  assert.match(brain.next(4000).text, /Não tenho certeza/);
  const ambiguous = ready([
    { cls: 'table', range: 3 },
    { cls: 'chair', range: 4, bearing: 20 },
  ]);
  ambiguous.ask('where');
  assert.match(ambiguous.next(4000).text, /Não tenho certeza/);
});
test('CA-P5: scripted person approach is noticed with metric input; pure yaw is not approach', () => {
  const brain = new Brain();
  brain.configure({ alerts: true });
  for (let t = 0; t <= 4000; t += 200)
    brain.ingest(observation(t, t, [{ cls: 'person', range: 6 - t / 2000 }]), t);
  const alert = brain.next(4000);
  assert.equal(alert.kind, 'alert');
  assert.match(alert.text, /experimental/);
  speak(brain, alert, 4000);
  feed(brain, 4200, 4600, [{ cls: 'person', range: 3.9 }]);
  assert.equal(brain.next(4600), null);
  const world = new World();
  for (let i = 0; i < 10; i++)
    world.ingest(
      observation(i * 200, i, [{ cls: 'person', range: 5, bearing: -i * 3 }], {
        pose: { ...pose, yaw: i * 3 },
      }),
      i * 200,
    );
  assert.equal(world.snapshot(1800)[0].approaching, false);
});
test('CA-P5: alert interrupts pending lower priority speech only with material metric evidence', () => {
  const brain = ready();
  brain.configure({ alerts: true });
  const briefing = brain.next(4000);
  feed(brain, 4200, 4800, [{ range: 4 }, { cls: 'person', range: 1, bearing: 10 }]);
  const alert = brain.next(4800);
  assert.equal(alert.kind, 'alert');
  assert.notEqual(alert.id, briefing.id);
  assert.equal(brain.confirm(briefing.id, 4900), false);
});
test('memory outside FOV is labeled old; dynamic memory expires', () => {
  const brain = ready([{ cls: 'door', range: 4 }]);
  feed(brain, 4200, 8000, [], { pose: { ...pose, yaw: 90 } });
  brain.ask('find', 'porta');
  const answer = brain.next(8000);
  assert.match(answer.text, /há uns|pode ter mudado/);
  assert.doesNotMatch(answer.text, /passos/);
  const moving = ready([{ cls: 'person', range: 4 }]);
  assert.equal(moving.facts(8001).length, 0);
});
test('missing object and empty front response never assert a clear path', () => {
  const brain = ready([]);
  brain.ask('ahead');
  const ahead = brain.next(4000);
  assert.match(ahead.text, /não dá para garantir/);
  speak(brain, ahead, 4000);
  brain.ask('find', 'porta');
  assert.equal(brain.next(4100), null);
  assert.match(brain.next(4700).text, /Ainda não vi/);
  const empty = ready([]);
  empty.ask('repeat');
  assert.match(empty.next(4000).text, /Ainda não há/);
});
test('geometry wraps at 180 degrees and converts calibrated FOV symmetrically', () => {
  assert.equal(normAngle(270), -90);
  assert.equal(normAngle(-190), 170);
  assert.equal(sectorOf(180), 'back');
  assert.equal(sectorOf(-45), 'frontLeft');
  assert.equal(bearingFromX(0.5), 0);
  assert.ok(Math.abs(bearingFromX(1) - 35) < 1e-9);
  assert.equal(angularDistance(179, -179), 2);
});
test('distance quantization is honest for unknown and extremes', () => {
  assert.equal(distancePhrase(undefined, 0.7), '');
  assert.equal(distancePhrase(NaN, 0.7), '');
  assert.equal(distancePhrase(0.7, 0.7), 'a um passo');
  assert.equal(distancePhrase(30, 0.7), 'bem longe');
  assert.equal(quantizeSteps(9.3 * 0.7, 0.7), 10);
  assert.equal(quantizeSteps(14 * 0.7, 0.7), 15);
});
test('world ignores unsupported and weak detections and supports reset', () => {
  const world = new World();
  world.ingest(
    observation(0, 0, [{ cls: 'unicorn' }, { cls: 'chair', score: 0.1 }, { bearing: NaN }]),
    0,
  );
  assert.deepEqual(world.snapshot(0), []);
  world.reset();
  assert.equal(world.rejectedFrames, 0);
});
test('grouping never mixes sectors and plural distances refer to nearest member', () => {
  const a = { id: 'a', cls: 'chair', score: 0.9, sector: 'right', range: 3.5 };
  const result = describeGroup(
    [a, { ...a, id: 'b', range: 4 }, { ...a, id: 'c', sector: 'left' }],
    0.7,
  );
  assert.match(result.text, /duas cadeiras a partir de cinco passos/);
  assert.equal(result.facts.length, 2);
  assert.match(oldMemory({ ...a, age: 12000 }, 0.7).text, /12 segundos/);
});
test('essential mode suppresses low-importance automatic novelty, explicit queries still work', () => {
  const brain = ready();
  brain.configure({ verbosity: 'essential' });
  speak(brain, brain.next(4000), 4000);
  feed(brain, 4200, 8000, [{ range: 4 }, { cls: 'book', bearing: -20 }]);
  assert.equal(brain.next(8000), null);
  brain.ask('find', 'livro');
  assert.match(brain.next(8000).text, /livro/);
});
test('auto narration can be disabled for screen reader controlled output', () => {
  const brain = ready();
  brain.configure({ auto: false });
  assert.equal(brain.next(4000), null);
  brain.ask('describe');
  assert.ok(brain.next(4000));
});
test('configuration covers the documented maximum thresholds', () => {
  assert.equal(CONFIG.motion.maxYawRate, 15);
  assert.equal(CONFIG.world.approachRatio, 0.6);
  assert.equal(CONFIG.capture.maxFrameAgeMs, 3000);
});

test('CA-F6: text output may be repeated without confirming that any entity was spoken', () => {
  const brain = ready();
  brain.configure({ auto: false });
  brain.ask('describe');
  const first = brain.next(4000);
  assert.equal(brain.displayText('wrong-id'), false);
  assert.equal(brain.displayText(first.id), true);
  assert.equal(brain.saidCount, 0);
  brain.ask('repeat');
  assert.equal(brain.next(4100).text, first.text);
  assert.equal(brain.saidCount, 0);
});

test('CA-F9: duplicate, stale and unsupported scene samples cannot establish a place', () => {
  const scene = new SceneEstimator();
  scene.update(sceneEvidence(0), 0);
  scene.update(sceneEvidence(0), 2000);
  assert.equal(scene.current(2000), null);
  scene.update(sceneEvidence(2000), 2000);
  assert.equal(scene.current(2000), 'classroom');
  assert.equal(scene.current(9000), null);
  scene.update(sceneEvidence(100, 'office'), 9000);
  scene.update(sceneEvidence(10000, 'made_up_room'), 10000);
  assert.equal(scene.current(10000), null);
});

test('CA-F1/F6/F9: a late scene is announced once and interrupted output is replanned', () => {
  const brain = ready();
  const initial = brain.next(4000);
  speak(brain, initial, 4000);
  brain.ingest(observation(5000, 5000, [{ range: 4 }], { scene: sceneEvidence(5000) }), 5000);
  brain.ingest(observation(7000, 7000, [{ range: 4 }], { scene: sceneEvidence(7000) }), 7000);
  const learned = brain.next(7000);
  assert.match(learned.text, /Parece uma sala de aula/);
  assert.equal(brain.start(learned.id, 7000), true);
  assert.equal(brain.drop(learned.id), true);
  assert.equal(brain.next(7100), null);
  brain.ingest(observation(9600, 9600, [{ range: 4 }], { scene: sceneEvidence(9600) }), 9600);
  const retry = brain.next(9600);
  speak(brain, retry, 9600);
  for (let t = 10000; t < 30000; t += 2000) {
    brain.ingest(observation(t, t, [{ range: 4 }], { scene: sceneEvidence(t) }), t);
    assert.equal(brain.next(t), null);
  }
});

test('CA-F6/F9: speaking an object answer does not mark the current place as spoken', () => {
  const brain = ready();
  speak(brain, brain.next(4000), 4000);
  for (const t of [5000, 7000])
    brain.ingest(observation(t, t, [{ range: 4 }], { scene: sceneEvidence(t) }), t);
  brain.ask('ahead');
  const answer = brain.next(7000);
  assert.equal(answer.sceneCategory, undefined);
  speak(brain, answer, 7000);
  brain.ingest(observation(9600, 9600, [{ range: 4 }], { scene: sceneEvidence(9600) }), 9600);
  assert.match(brain.next(9600).text, /Parece uma sala de aula/);
});

test('CA-F5/D4/F9: independent scene results reject pre-turn, future and stale captures', () => {
  const brain = ready();
  assert.equal(brain.ingestScene(sceneEvidence(4500), 4600), true);
  brain.ingest(observation(5000, 5000, [{ range: 4 }], { yawRate: 30 }), 5000);
  assert.equal(brain.ingestScene(sceneEvidence(4700), 5200), false);
  feed(brain, 5400, 7000);
  assert.equal(brain.ingestScene(sceneEvidence(5300), 7100), false);
  assert.equal(brain.ingestScene(sceneEvidence(12000), 7100), false);
  assert.equal(brain.ingestScene(sceneEvidence(6000), 7100), true);
  assert.equal(brain.ingestScene(sceneEvidence(6000), 7200), false);
  assert.equal(brain.ingestScene(sceneEvidence(8000), 8100), true);
  assert.equal(brain.scene.current(8100), 'classroom');
  assert.equal(brain.ingestScene(sceneEvidence(8200), 12000), false);
});
