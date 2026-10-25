import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Only billing metadata and short-lived CSRF tokens are stored. Camera frames are never persisted.
export const requests = sqliteTable('requests', {
  id: text('id').primaryKey(),
  at: integer('at').notNull(),
  day: text('day').notNull(),
  charge: integer('charge').notNull(),
  state: text('state').notNull(),
  input: integer('input'),
  output: integer('output'),
  errorCode: text('error_code'),
  returnedModel: text('returned_model'),
  modelVerification: text('model_verification'),
}, (table) => [
  index('requests_day_idx').on(table.day),
  index('requests_state_idx').on(table.state),
  index('requests_at_idx').on(table.at),
]);

export const csrfTokens = sqliteTable('csrf_tokens', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [index('csrf_expires_idx').on(table.expiresAt)]);
