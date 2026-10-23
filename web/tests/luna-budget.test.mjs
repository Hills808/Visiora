import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Budget } from '../server/budget.mjs';
import { budgetDay, budgetWindow } from '../server/budget-day.mjs';
import { loadConfig, POLICY } from '../server/config.mjs';

test('CA-L3: daily allowance turns at midnight in Sao Paulo, not UTC or the host locale', () => {
  const before = Date.parse('2026-10-19T02:59:59.999Z'),
    after = before + 1;
  assert.equal(budgetDay(before), '2026-10-18');
  assert.equal(budgetDay(after), '2026-10-19');
  assert.deepEqual(budgetWindow(before), {
    day: '2026-10-18',
    start: Date.parse('2026-10-18T03:00:00Z'),
    end: after,
  });
  assert.deepEqual(budgetWindow(after), {
    day: '2026-10-19',
    start: after,
    end: Date.parse('2026-10-20T03:00:00Z'),
  });
  assert.equal(budgetWindow(Date.parse('2026-10-20T00:01:00Z')).day, '2026-10-19');
});

test('CA-L3: previous-day charges and old UTC day labels do not consume today; history and daily enforcement remain', () => {
  let now = Date.parse('2026-10-19T02:59:40Z');
  const b = new Budget(':memory:', { daily: 600000, total: 600000 }, () => now);
  try {
    for (const id of ['yesterday-a', 'yesterday-b']) {
      b.reserve(id);
      b.uncertain(id, 'provider-timeout');
      now += 5000;
    }
    // Old versions labelled these records using the UTC date. Do not rewrite real history to migrate.
    b.db.prepare('UPDATE requests SET day=?').run('2026-10-19');
    now = Date.parse('2026-10-19T03:00:01Z');
    b.reserve('today-a');
    b.uncertain('today-a');
    now += 5000;
    b.reserve('today-b');
    b.uncertain('today-b');
    now += 5000;
    assert.throws(() => b.reserve('today-c'), /budget/);
    assert.equal(b.db.prepare('SELECT COUNT(*) n FROM requests').get().n, 4);
    assert.equal(
      b.db.prepare("SELECT SUM(charge) n FROM requests WHERE id LIKE 'yesterday-%'").get().n,
      600000,
    );
    assert.equal(b.db.prepare('SELECT COUNT(*) n FROM request_failures').get().n, 4);
  } finally {
    b.close();
  }
});

test('CA-L3: midnight never clears a pending request or lets another tab dispatch concurrently', () => {
  let now = Date.parse('2026-10-19T02:59:40Z');
  const b = new Budget(':memory:', { daily: 2000000 }, () => now);
  try {
    b.reserve('pending-yesterday');
    now = Date.parse('2026-10-19T03:00:01Z');
    assert.throws(() => b.reserve('new-day'), /busy/);
    b.uncertain('pending-yesterday', 'provider-timeout');
    b.reserve('new-day');
    assert.equal(b.db.prepare('SELECT COUNT(*) n FROM requests').get().n, 2);
    assert.equal(
      b.db.prepare('SELECT charge FROM requests WHERE id=?').get('pending-yesterday').charge,
      300000,
    );
  } finally {
    b.close();
  }
});

test('CA-L3: configured daily-only cap needs no cumulative setting and cannot exceed authorized US$2', () => {
  const env = {
    OPENAI_API_KEY: 'TEST-ONLY',
    VISIORA_LUNA_ENABLED: '1',
    VISIORA_DAILY_USD: '2',
    VISIORA_PRICING_CONFIRMED: POLICY.pricingRevision,
  };
  assert.equal(loadConfig(env).ready, true);
  assert.equal(loadConfig({ ...env, VISIORA_TOTAL_USD: '0' }).ready, true);
  assert.equal(loadConfig(env).daily, 2000000);
  assert.equal(loadConfig(env).total, undefined);
  assert.throws(() => loadConfig({ ...env, VISIORA_DAILY_USD: '2.01' }), /limite autorizado/);
  assert.equal(loadConfig({ ...env, VISIORA_DAILY_USD: '0' }).ready, false);
});
test('CA-L3: transaction prevents duplicate, concurrent and over-budget dispatch', () => {
  let now = 100000;
  const b = new Budget(':memory:', { daily: 600000, total: 600000 }, () => now);
  try {
    b.reserve('a');
    assert.throws(() => b.reserve('a'), /duplicate/);
    assert.throws(() => b.reserve('b'), /busy/);
    b.uncertain('a');
    now += 10000;
    b.reserve('b');
    b.uncertain('b');
    now += 10000;
    assert.throws(() => b.reserve('c'), /budget/);
  } finally {
    b.close();
  }
});
test('CA-L3: restart/multiple connections preserve uncertain spend and single pending request', () => {
  mkdirSync('artifacts', { recursive: true });
  const dir = mkdtempSync(path.resolve('artifacts/luna-ledger-'));
  const file = path.join(dir, 'budget.sqlite'),
    limits = { daily: 900000, total: 900000 };
  let b = new Budget(file, limits, () => 100000);
  try {
    b.reserve('a');
    const second = new Budget(file, limits, () => 120000);
    try {
      assert.throws(() => second.reserve('b'), /busy/);
    } finally {
      second.close();
    }
    b.close();
    b = new Budget(file, limits, () => 120000);
    assert.throws(() => b.reserve('b'), /busy/);
    assert.throws(() => b.reserve('a'), /duplicate/);
    b.uncertain('a');
    b.reserve('b');
    b.complete('b', { input_tokens: 1000, output_tokens: 100 });
    assert.equal(b.db.prepare('SELECT charge FROM requests WHERE id=?').get('a').charge, 300000);
    assert.equal(b.db.prepare('SELECT charge FROM requests WHERE id=?').get('b').charge, 358);
    assert.deepEqual(
      b.db
        .prepare('PRAGMA table_info(requests)')
        .all()
        .map((c) => c.name),
      ['id', 'at', 'day', 'charge', 'state', 'input', 'output'],
    );
  } finally {
    b.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test('CA-L3: missing usage retains full reservation; zero budget blocks and throttling persists', () => {
  const zero = new Budget(':memory:', { daily: 0, total: 0 });
  try {
    assert.throws(() => zero.reserve('a'), /budget/);
  } finally {
    zero.close();
  }
  let now = 100000;
  const b = new Budget(':memory:', { daily: 1000000, total: 1000000 }, () => now);
  try {
    b.reserve('a');
    b.complete('a', null);
    assert.equal(b.db.prepare('SELECT charge FROM requests').get().charge, 300000);
    assert.throws(() => b.reserve('b'), /rate/);
    now += 10000;
    b.reserve('b');
  } finally {
    b.close();
  }
});
