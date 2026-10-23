import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';

const filename = path.resolve('.runtime/luna-budget.sqlite');
// Keep terminal output bounded; full metadata remains in SQLite.
const displayLimit = 20;
if (!existsSync(filename)) {
  console.log('Ainda não há registro local de consultas.');
} else {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const hasAudit = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='model_responses'")
      .get();
    if (!hasAudit) {
      console.log(
        'Este registro ainda não tem a conferência de modelos. Reinicie o servidor atualizado.',
      );
    } else {
      const legacy = db
        .prepare(
          `SELECT COUNT(*) n FROM requests r
        LEFT JOIN model_responses m ON m.request_id=r.id WHERE m.request_id IS NULL`,
        )
        .get().n;
      console.log(
        `Consultas sem metadados de modelo (antigas, simuladas ou sem resposta): ${legacy}`,
      );
      const rows = db
        .prepare(
          `SELECT r.id AS requestId, r.at, m.requested_model AS requestedModel,
        m.returned_model AS returnedModel, m.verification, r.state AS analysisState
        FROM model_responses m JOIN requests r ON r.id=m.request_id ORDER BY r.at DESC, r.id DESC LIMIT ?`,
        )
        .all(displayLimit);
      console.table(rows.map(({ at, ...row }) => ({ utc: new Date(at).toISOString(), ...row })));
      if (!rows.length) console.log('Nenhuma resposta com conferência de modelo registrada ainda.');
    }
    const hasFailures = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='request_failures'")
      .get();
    if (hasFailures) {
      const failures = db
        .prepare(
          `SELECT r.at, r.id AS requestId, f.code, r.state,
        r.charge AS reservedMicros FROM request_failures f JOIN requests r ON r.id=f.request_id
        ORDER BY r.at DESC, r.id DESC LIMIT ?`,
        )
        .all(displayLimit);
      console.log('Falhas registradas (códigos sem imagens ou texto da API):');
      console.table(
        failures.map(({ at, ...row }) => ({ utc: new Date(at).toISOString(), ...row })),
      );
    }
  } finally {
    db.close();
  }
}
