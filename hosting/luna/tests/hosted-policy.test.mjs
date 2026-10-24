import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyLimit } from '../lib/luna-policy.ts';
import { providerFailure } from '../lib/luna-provider-errors.ts';

test('limite hospedado de US$ 10 vale somente em 23/10 no fuso de São Paulo', () => {
  assert.equal(dailyLimit('2', Date.parse('2026-10-23T02:59:59Z')), 2_000_000);
  assert.equal(dailyLimit('2', Date.parse('2026-10-23T03:00:00Z')), 10_000_000);
  assert.equal(dailyLimit('2', Date.parse('2026-10-24T02:59:59Z')), 10_000_000);
  assert.equal(dailyLimit('2', Date.parse('2026-10-24T03:00:00Z')), 2_000_000);
  assert.equal(dailyLimit('0', Date.parse('2026-10-23T12:00:00Z')), 0);
  assert.equal(dailyLimit('10', Date.parse('2026-10-23T12:00:00Z')), 0);
});

test('CA-L3/L4: erros do provedor preservam apenas status HTTP seguro', () => {
  for (const [status, expected] of [
    [500, { status: 503, code: 'provider-http-500' }],
    [503, { status: 503, code: 'provider-http-503' }],
    [520, { status: 503, code: 'provider-http-520' }],
    [530, { status: 503, code: 'provider-http-530' }],
    [401, { status: 401, code: 'provider-auth' }],
    [429, { status: 429, code: 'provider-limit' }],
    [400, { status: 422, code: 'provider-request' }],
  ]) {
    assert.deepEqual(providerFailure(status), expected);
  }
});
