import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyLimit } from '../lib/luna-policy.ts';

test('limite hospedado de US$ 10 vale somente em 23/10 no fuso de São Paulo', () => {
  assert.equal(dailyLimit('2', Date.parse('2026-10-23T02:59:59Z')), 2_000_000);
  assert.equal(dailyLimit('2', Date.parse('2026-10-23T03:00:00Z')), 10_000_000);
  assert.equal(dailyLimit('2', Date.parse('2026-10-24T02:59:59Z')), 10_000_000);
  assert.equal(dailyLimit('2', Date.parse('2026-10-24T03:00:00Z')), 2_000_000);
  assert.equal(dailyLimit('0', Date.parse('2026-10-23T12:00:00Z')), 0);
  assert.equal(dailyLimit('10', Date.parse('2026-10-23T12:00:00Z')), 0);
});
