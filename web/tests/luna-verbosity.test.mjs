import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualMemory } from '../dist/brain/visual-memory.js';
import { item, snapshot, deliver } from './fixtures/memory-scenarios.mjs';

const profiles = {
  essential: { briefingWords: 25, updateWords: 25, maxItems: 1 },
  balanced: { briefingWords: 32, updateWords: 25, maxItems: 3 },
  detailed: { briefingWords: 45, updateWords: 25, maxItems: 3 },
};
const words = (text) => text.trim().split(/\s+/u).length;
const labels = ['mesa', 'cadeira', 'pessoa'];
const objects = () =>
  labels.map((label) => item(label, { kind: label === 'pessoa' ? 'person' : 'object' }));
const countObjects = (text, names = labels) => names.filter((label) => text.includes(label)).length;
function manual(memory, result, verbosity) {
  const now = result.stamp.capturedAtMs + 500;
  assert.equal(memory.accept(result, now, 1), true);
  return memory.utterance(now, false, false, false, false, verbosity);
}

for (const [verbosity, profile] of Object.entries(profiles)) {
  for (const automatic of [false, true]) {
    test(`CA-F3/F7: ${verbosity} ${automatic ? 'automatic' : 'manual'} briefing uses complete groups within its word budget`, () => {
      const memory = new VisualMemory();
      const result = snapshot(1, objects(), { scene: 'sala' });
      const output = automatic
        ? deliver(memory, result, { verbosity })
        : manual(memory, result, verbosity);
      assert.ok(output);
      assert.ok(words(output.text) <= profile.briefingWords, output.text);
      assert.match(output.text, /Na imagem capturada há 1 segundo:/u);
      assert.match(output.text, /À frente da câmera, havia/u);
      assert.doesNotMatch(output.text, /À sua|passos|metros|…/u);
      assert.equal(countObjects(output.text), profile.maxItems);
      if (verbosity === 'essential') {
        assert.match(output.text, /uma mesa/u);
        assert.doesNotMatch(output.text, /cadeira|pessoa/u);
      } else {
        assert.match(output.text, /uma mesa, uma cadeira e uma pessoa/u);
      }
    });
  }

  test(`CA-F7: ${verbosity} automatic updates keep the separate 25-word limit`, () => {
    const memory = new VisualMemory();
    deliver(memory, snapshot(1, [item('mesa')], { scene: 'sala' }), { verbosity });
    const news = [item('cadeira'), item('pessoa', { kind: 'person' }), item('janela')];
    const output = deliver(memory, snapshot(2, [item('mesa'), ...news], { scene: 'sala' }), {
      verbosity,
    });
    assert.ok(output);
    assert.ok(words(output.text) <= profile.updateWords, output.text);
    assert.doesNotMatch(output.text, /mesa|O ambiente parecia/u);
    assert.equal(countObjects(output.text, ['cadeira', 'pessoa', 'janela']), profile.maxItems);
  });

  test(`CA-F3/F7: ${verbosity} manual ahead response uses update budget and fixed camera sectors`, () => {
    const memory = new VisualMemory();
    const result = snapshot(1, objects(), { scene: 'sala' });
    result.stamp.intent = 'ahead';
    const output = manual(memory, result, verbosity);
    assert.ok(output);
    assert.ok(words(output.text) <= profile.updateWords, output.text);
    assert.match(output.text, /À frente da câmera, havia/u);
    assert.equal(countObjects(output.text), profile.maxItems);
  });
}

test('CA-F3/F7: detailed includes distinct sectors while essential selects one complete directional group', () => {
  const observations = [
    item('mesa'),
    item('cadeira', { bearing: -30 }),
    item('pessoa', { kind: 'person', bearing: 30 }),
  ];
  const essential = manual(
    new VisualMemory(),
    snapshot(1, observations, { scene: 'sala' }),
    'essential',
  );
  const detailed = manual(
    new VisualMemory(),
    snapshot(1, observations, { scene: 'sala' }),
    'detailed',
  );
  assert.equal(countObjects(essential.text), 1);
  assert.match(essential.text, /À frente da câmera, havia uma mesa/u);
  assert.equal(countObjects(detailed.text), 3);
  assert.match(detailed.text, /À frente, à esquerda da câmera, havia uma cadeira/u);
  assert.match(detailed.text, /À frente, à direita da câmera, havia uma pessoa/u);
  assert.ok(words(detailed.text) <= profiles.detailed.briefingWords);
});

test('CA-F7: essential selects a certain central reference ahead of provider order and an uncertain central reference', () => {
  const observations = [
    item('mesa', { bearing: 30 }),
    item('cadeira', { uncertain: true }),
    item('pessoa', { kind: 'person' }),
  ];
  for (const automatic of [false, true]) {
    const memory = new VisualMemory();
    const result = snapshot(1, observations, { scene: 'sala' });
    const output = automatic
      ? deliver(memory, result, { verbosity: 'essential' })
      : manual(memory, result, 'essential');
    assert.ok(output);
    assert.match(output.text, /À frente da câmera, havia uma pessoa/u);
    assert.doesNotMatch(output.text, /mesa|cadeira|talvez/u);
    assert.ok(words(output.text) <= 25);
  }
});

test('CA-F7: a label that cannot fit essential is omitted whole and manual detailed preserves it intact', () => {
  const memory = new VisualMemory();
  const label = 'passagem com placa de saída para o corredor do andar superior';
  const observation = item(label);
  const short = deliver(memory, snapshot(1, [observation], { scene: 'sala' }), {
    verbosity: 'essential',
  });
  if (short) {
    assert.ok(words(short.text) <= profiles.essential.briefingWords, short.text);
    assert.doesNotMatch(short.text, /passagem|corredor|superior|…/u);
  }
  const detailed = manual(memory, snapshot(2, [observation], { scene: 'sala' }), 'detailed');
  assert.ok(detailed);
  assert.ok(detailed.text.includes(label), detailed.text);
  assert.match(detailed.text, /À frente da câmera/u);
  assert.ok(words(detailed.text) <= profiles.detailed.briefingWords);
});

test('CA-F4/F6: changing essential to balanced delivers omitted groups without repeating delivered groups', () => {
  const memory = new VisualMemory();
  const first = deliver(memory, snapshot(1, objects(), { scene: 'sala' }), {
    verbosity: 'essential',
  });
  assert.match(first.text, /uma mesa/u);
  assert.doesNotMatch(first.text, /cadeira|pessoa/u);
  const expanded = deliver(memory, snapshot(2, objects(), { scene: 'sala' }), {
    verbosity: 'balanced',
  });
  assert.ok(expanded);
  assert.doesNotMatch(expanded.text, /mesa/u);
  assert.match(expanded.text, /uma cadeira e uma pessoa/u);
  assert.ok(words(expanded.text) <= 25);
  assert.equal(
    deliver(memory, snapshot(3, objects(), { scene: 'sala' }), { verbosity: 'detailed' }),
    null,
  );
  assert.equal(
    deliver(memory, snapshot(4, objects(), { scene: 'sala' }), { verbosity: 'essential' }),
    null,
  );
});

test('CA-F6: preparing essential speech without delivery does not acknowledge its selected group', () => {
  const memory = new VisualMemory();
  const pending = deliver(memory, snapshot(1, [item('cadeira')], { scene: 'sala' }), {
    verbosity: 'essential',
    complete: false,
  });
  assert.ok(pending);
  const retried = deliver(memory, snapshot(2, [item('cadeira')], { scene: 'sala' }), {
    verbosity: 'essential',
  });
  assert.ok(retried);
  assert.match(retried.text, /uma cadeira/u);
});

test('CA-L4/F3: Repeat keeps delivered detailed content and old camera directions after choosing essential', () => {
  const memory = new VisualMemory();
  const result = snapshot(1, objects(), { at: 0, scene: 'sala' });
  const delivered = manual(memory, result, 'detailed');
  assert.ok(delivered);
  assert.equal(memory.complete(delivered.id, 600), true);
  memory.forgetDirections();
  const newer = snapshot(2, [item('janela')], { at: 4500, scene: 'biblioteca' });
  assert.equal(memory.accept(newer, 5000, 1), true);
  const repeated = memory.utterance(60000, true, false, false, false, 'essential');
  assert.ok(repeated);
  assert.match(repeated.text, /capturada há 60 segundos:/u);
  assert.equal(repeated.text.split(/segundos?: /u)[1], delivered.text.split(/segundos?: /u)[1]);
  assert.equal(countObjects(repeated.text), 3);
  assert.doesNotMatch(repeated.text, /janela|biblioteca|À sua|passos|metros/u);
});
