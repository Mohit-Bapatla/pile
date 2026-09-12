CREATE TABLE IF NOT EXISTS user_preferences (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, body jsonb NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS memory_accounts (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, assistant_id text NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS memory_records (item_id text PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, memory_id text NOT NULL, updated_at text NOT NULL);
CREATE INDEX IF NOT EXISTS sources_fingerprint_idx ON sources(user_id, (body->>'fingerprint'));
CREATE UNIQUE INDEX IF NOT EXISTS sources_unique_fingerprint_idx ON sources(user_id, (body->>'fingerprint')) WHERE body->>'fingerprint' IS NOT NULL;
