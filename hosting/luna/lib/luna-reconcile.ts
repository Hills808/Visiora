import { LunaError } from './luna-budget';
import { POLICY } from './luna-policy';

/** Explicit administrative transition. Keeps the entire hold and request ID. */
export async function reconcilePending(db: D1Database, id: string, now: number): Promise<void> {
  const row = await db.prepare('SELECT at, state, error_code FROM requests WHERE id = ?')
    .bind(id).first<{ at: number; state: string; error_code: string | null }>();
  if (!row) throw new LunaError(404, 'request-not-found');
  if (row.state === 'uncertain' && row.error_code === 'operator-reconciled') return;
  if (row.state !== 'pending' || row.at > now - POLICY.reconciliationMinAgeMs)
    throw new LunaError(409, 'not-stale-pending');
  const result = await db.prepare(`UPDATE requests SET state = 'uncertain', error_code = 'operator-reconciled'
    WHERE id = ? AND state = 'pending' AND at <= ?`)
    .bind(id, now - POLICY.reconciliationMinAgeMs).run();
  if (result.meta.changes !== 1) throw new LunaError(409, 'reconcile-conflict');
}
