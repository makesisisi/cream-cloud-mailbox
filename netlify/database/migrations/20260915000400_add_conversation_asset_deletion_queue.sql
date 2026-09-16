CREATE TABLE conversation_asset_deletion_queue (
  storage_key TEXT PRIMARY KEY,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ
);

CREATE INDEX conversation_asset_deletion_queue_age_idx
  ON conversation_asset_deletion_queue (queued_at ASC);
