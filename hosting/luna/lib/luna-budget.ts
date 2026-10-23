import { budgetDay, POLICY } from './luna-policy';

export class LunaError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

export async function reserve(db: D1Database, id: string, daily: number, charge: number, now: number): Promise<void> {
  // A single conditional SQLite write is atomic across Worker instances and devices.
  const result = await db.prepare(`
    INSERT OR IGNORE INTO requests(id, at, day, charge, state)
    SELECT ?, ?, ?, ?, 'pending'
    WHERE NOT EXISTS (SELECT 1 FROM requests WHERE state = 'pending')
      AND (SELECT COUNT(*) FROM requests WHERE at > ?) < ?
      AND COALESCE((SELECT MAX(at) FROM requests), 0) <= ?
      AND (SELECT COALESCE(SUM(charge), 0) FROM requests WHERE day = ?) + ? <= ?
  `).bind(id, now, budgetDay(now), charge, now - 60_000, POLICY.requestsPerMinute,
    now - POLICY.cooldownMs, budgetDay(now), charge, daily).run();
  if (result.meta.changes === 1) return;
  const existing = await db.prepare('SELECT id FROM requests WHERE id = ?').bind(id).first();
  if (existing) throw new LunaError(409, 'duplicate');
  const pending = await db.prepare("SELECT id FROM requests WHERE state = 'pending' LIMIT 1").first();
  if (pending) throw new LunaError(409, 'busy');
  const spent = await db.prepare('SELECT COALESCE(SUM(charge),0) AS amount FROM requests WHERE day = ?')
    .bind(budgetDay(now)).first<{ amount: number }>();
  if ((spent?.amount ?? 0) + charge > daily) throw new LunaError(429, 'budget');
  throw new LunaError(429, 'rate');
}

export async function recordModel(db: D1Database, id: string, model: unknown): Promise<boolean> {
  const valid = typeof model === 'string' && model.length <= 128 &&
    /^[a-z0-9][a-z0-9._-]*$/.test(model) && model.trim() === model;
  const verification = model == null ? 'missing' : !valid ? 'invalid' :
    model === POLICY.model ? 'verified' : 'mismatch';
  const result = await db.prepare(`UPDATE requests SET returned_model = ?, model_verification = ?
    WHERE id = ? AND state = 'pending'`).bind(valid ? model : null, verification, id).run();
  if (result.meta.changes !== 1) throw new LunaError(503, 'model-audit');
  return verification === 'verified';
}

export async function complete(db: D1Database, id: string, usage: unknown): Promise<void> {
  const item = usage as Record<string, unknown> | null;
  const input = item?.input_tokens;
  const output = item?.output_tokens;
  const valid = Number.isSafeInteger(input) && Number(input) >= 0 && Number(input) <= 1_050_000 &&
    Number.isSafeInteger(output) && Number(output) >= 0 && Number(output) <= POLICY.maxOutputTokens;
  // Upper bound includes long-context/cache-write pricing and possible regional premium.
  const charge = valid ? Math.ceil((Number(input) * 0.25 + Number(output) * 0.75) * 1.1) : POLICY.reservationMicros;
  if (charge > POLICY.reservationMicros) throw new LunaError(503, 'pricing');
  const result = await db.prepare(`UPDATE requests SET state = 'complete', charge = ?, input = ?, output = ?
    WHERE id = ? AND state = 'pending'`).bind(charge, valid ? input : null, valid ? output : null, id).run();
  if (result.meta.changes !== 1) throw new LunaError(503, 'ledger');
}

export async function uncertain(db: D1Database, id: string, code: string): Promise<void> {
  await db.prepare("UPDATE requests SET state = 'uncertain', error_code = ? WHERE id = ? AND state = 'pending'")
    .bind(code, id).run();
}
