import test from 'node:test';
import assert from 'node:assert/strict';
import { Speaker } from '../dist/output/speaker.js';
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};
const local = { lang: 'pt-BR', localService: true, voiceURI: 'local', name: 'Local' };
function driver(voices = [local]) {
  return {
    current: null,
    getVoices: () => voices,
    cancel() {},
    speak(u) {
      this.current = u;
    },
  };
}
const utterance = (id) => ({ id, text: 'Descrição', expiresAt: 5000 });
test('CA-S3: remote and non-Brazilian voices are excluded', () => {
  const d = driver([
    local,
    { ...local, localService: false, voiceURI: 'remote' },
    { ...local, lang: 'pt-PT' },
  ]);
  assert.deepEqual(new Speaker(d).voices(), [local]);
});
test('CA-F6: speaker confirms only after onend, planning/start do not mark completed', () => {
  const d = driver();
  const s = new Speaker(d);
  s.select('local');
  const events = [];
  s.speak(
    utterance('a'),
    {
      start: () => {
        events.push('start');
        return true;
      },
      end: () => events.push('end'),
      drop: () => events.push('drop'),
      error: (m) => events.push(m),
    },
    0,
  );
  assert.deepEqual(events, []);
  d.current.onstart();
  assert.deepEqual(events, ['start']);
  d.current.onend();
  assert.deepEqual(events, ['start', 'end']);
  assert.equal(s.speaking, false);
});
test('CA-F6: late callbacks after cancellation cannot confirm a new utterance', () => {
  const d = driver();
  const s = new Speaker(d);
  s.select('local');
  let ends = 0;
  let drops = 0;
  const hooks = {
    start: () => true,
    end: () => ends++,
    drop: () => drops++,
    error: () => assert.fail(),
  };
  s.speak(utterance('a'), hooks, 0);
  const old = d.current;
  s.speak(utterance('b'), hooks, 0);
  old.onend();
  assert.equal(ends, 0);
  assert.equal(drops, 1);
  d.current.onend();
  assert.equal(ends, 1);
});
test('expired speech is dropped before synthesis', () => {
  const d = driver();
  const s = new Speaker(d);
  s.select('local');
  let drops = 0;
  s.speak(
    utterance('a'),
    {
      start: () => true,
      end: () => assert.fail(),
      drop: () => drops++,
      error: () => assert.fail(),
    },
    6000,
  );
  assert.equal(d.current, null);
  assert.equal(drops, 1);
});
test('missing voice surfaces a clear error and never substitutes a remote voice', () => {
  const d = driver([]);
  const s = new Speaker(d);
  let error = '';
  s.speak(
    utterance('a'),
    {
      start: () => true,
      end: () => assert.fail(),
      drop: () => {},
      error: (m) => {
        error = m;
      },
    },
    0,
  );
  assert.match(error, /Nenhuma voz local/);
  assert.equal(d.current, null);
});
test('speech start rejection cancels the utterance; errors return facts to planner', () => {
  const d = driver();
  const s = new Speaker(d);
  s.select('local');
  let drops = 0;
  let errors = 0;
  const hooks = {
    start: () => false,
    end: () => assert.fail(),
    drop: () => drops++,
    error: () => errors++,
  };
  s.speak(utterance('a'), hooks, 0);
  d.current.onstart();
  assert.equal(drops, 1);
  s.speak(utterance('b'), hooks, 0);
  d.current.onerror({ error: 'synthesis-failed' });
  assert.equal(errors, 1);
  assert.equal(drops, 2);
});
