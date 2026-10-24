import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { POLICY } from './config.mjs';
import { budgetWindow } from './budget-day.mjs';
import { EVIDENCE_ISSUES } from '../dist/perception/evidence.js';
export class GatewayError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}
const failureCodes = new Set([
  'budget',
  'rate',
  'consent',
  'not-configured',
  'csrf',
  'origin',
  'host',
  'provider-timeout',
  'provider-network',
  'provider-unavailable',
  'provider-limit',
  'provider-auth',
  'provider-request',
  'incomplete',
  'refused',
  'invalid-json',
  'invalid-evidence',
  ...EVIDENCE_ISSUES.map((reason) => `invalid-evidence-${reason}`),
  'invalid-response',
  'model-unconfirmed',
  'pricing',
  'model-audit',
]);
export function failureCode(error) {
  return error instanceof GatewayError && failureCodes.has(error.message)
    ? error.message
    : 'internal';
}
/** Transactions coordinate tabs/processes. Crashed/unknown requests remain reserved. No image/text stored. */
export class Budget {
  constructor(filename, limits, now = () => Date.now()) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.now = now;
    this.limits = limits;
    this.db.exec(`PRAGMA busy_timeout=1000;
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY, at INTEGER NOT NULL, day TEXT NOT NULL,
        charge INTEGER NOT NULL, state TEXT NOT NULL, input INTEGER, output INTEGER
      );`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS model_responses (
      request_id TEXT PRIMARY KEY REFERENCES requests(id),
      requested_model TEXT NOT NULL, returned_model TEXT,
      verification TEXT NOT NULL CHECK (verification IN ('verified','mismatch','missing','invalid'))
    );`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS request_failures (
      request_id TEXT PRIMARY KEY REFERENCES requests(id), code TEXT NOT NULL
    );`);
  }
  recordModel(id, audit) {
    const saved = this.db
      .prepare(
        `INSERT INTO model_responses
      (request_id,requested_model,returned_model,verification)
      SELECT id,?,?,? FROM requests WHERE id=? AND state='pending'`,
      )
      .run(audit.requestedModel, audit.returnedModel, audit.verification, id);
    if (saved.changes !== 1) throw new GatewayError(503, 'model-audit');
  }
  reserve(id, charge = POLICY.reservationMicros) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const now = this.now(),
        { day, start, end } = budgetWindow(now);
      if (this.db.prepare('SELECT id FROM requests WHERE id=?').get(id))
        throw new GatewayError(409, 'duplicate');
      if (this.db.prepare("SELECT id FROM requests WHERE state='pending' LIMIT 1").get())
        throw new GatewayError(409, 'busy');
      const recent = this.db
        .prepare('SELECT COUNT(*) n, MAX(at) last FROM requests WHERE at>?')
        .get(now - 60000);
      if (
        recent.n >= POLICY.requestsPerMinute ||
        (recent.last !== null && now - recent.last < POLICY.cooldownMs)
      )
        throw new GatewayError(429, 'rate');
      const today = this.db
        .prepare('SELECT COALESCE(SUM(charge),0) n FROM requests WHERE at>=? AND at<?')
        .get(start, end).n;
      // Evaluate on every reservation: the exception expires even if the process stays running.
      const dailyLimit = day === this.limits.presentationDay
        ? Math.max(this.limits.daily, this.limits.presentationDaily)
        : this.limits.daily;
      if (today + charge > dailyLimit) throw new GatewayError(429, 'budget');
      this.db
        .prepare("INSERT INTO requests(id,at,day,charge,state) VALUES(?,?,?,?,'pending')")
        .run(id, now, day, charge);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  complete(id, usage) {
    // Worst applicable input tariff (cache writes + long context), no cache discount assumption.
    const valid =
      usage &&
      Number.isSafeInteger(usage.input_tokens) &&
      usage.input_tokens >= 0 &&
      usage.input_tokens <= 1050000 &&
      Number.isSafeInteger(usage.output_tokens) &&
      usage.output_tokens >= 0 &&
      usage.output_tokens <= POLICY.maxOutputTokens;
    const upper = valid
      ? Math.ceil((usage.input_tokens * 0.25 + usage.output_tokens * 0.75) * 1.1)
      : POLICY.reservationMicros;
    if (upper > POLICY.reservationMicros) {
      this.uncertain(id);
      throw new GatewayError(503, 'pricing');
    }
    this.db
      .prepare(
        "UPDATE requests SET state='complete', charge=?, input=?, output=? WHERE id=? AND state='pending'",
      )
      .run(upper, valid ? usage.input_tokens : null, valid ? usage.output_tokens : null, id);
  }
  uncertain(id, code = 'unknown') {
    this.db.prepare("UPDATE requests SET state='uncertain' WHERE id=? AND state='pending'").run(id);
    this.db
      .prepare(
        'INSERT INTO request_failures(request_id,code) VALUES(?,?) ON CONFLICT(request_id) DO UPDATE SET code=excluded.code',
      )
      .run(id, code);
  }
  close() {
    this.db.close();
  }
}
