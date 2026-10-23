import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  loadPreferences,
  savePreferences,
  recordHistory,
  history,
  clearData,
} from '../dist/storage.js';
import { CONFIG } from '../dist/config.js';
const storage = () => {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
};
test('CA-S4: history is opt-in and disabled by default', () => {
  const s = storage();
  assert.equal(loadPreferences(s).keepHistory, false);
  recordHistory(s, { text: 'a', time: 'now', source: 'demo' }, DEFAULTS);
  assert.deepEqual(history(s), []);
});
test('preferences accept only documented values and persist locally', () => {
  const s = storage();
  s.setItem(
    CONFIG.storage.preferences,
    JSON.stringify({
      rate: -5,
      theme: 'bogus',
      output: 'remote',
      verbosity: 'unknown',
      keepHistory: true,
    }),
  );
  const p = loadPreferences(s);
  assert.equal(p.rate, 1);
  assert.equal(p.output, 'voice');
  assert.equal(p.keepHistory, true);
  savePreferences(s, { ...p, theme: 'dark' });
  assert.equal(loadPreferences(s).theme, 'dark');
});
test('corrupted and oversized storage is reported, never swallowed', () => {
  const s = storage();
  s.setItem(CONFIG.storage.preferences, '{');
  assert.throws(() => loadPreferences(s));
  s.setItem(CONFIG.storage.preferences, 'x'.repeat(100001));
  assert.throws(() => loadPreferences(s));
  s.setItem(CONFIG.storage.history, '{}');
  assert.throws(() => history(s));
});
test('history is bounded and does not contain frames', () => {
  const s = storage();
  for (let i = 0; i < 60; i++)
    recordHistory(
      s,
      { text: String(i), time: 'now', source: 'camera' },
      { ...DEFAULTS, keepHistory: true },
    );
  const items = history(s);
  assert.equal(items.length, 50);
  assert.equal(items[0].text, '10');
  assert.deepEqual(Object.keys(items[0]).sort(), ['source', 'text', 'time']);
});
test('CA-S4: delete removes owned preferences/history, preserves unrelated storage', async () => {
  const s = storage();
  s.setItem('other-app', 'keep');
  savePreferences(s, DEFAULTS);
  s.setItem(CONFIG.storage.history, '[]');
  await clearData(s);
  assert.equal(s.getItem(CONFIG.storage.preferences), null);
  assert.equal(s.getItem(CONFIG.storage.history), null);
  assert.equal(s.getItem('other-app'), 'keep');
});
