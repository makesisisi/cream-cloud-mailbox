ALTER TABLE conversation_messages
  DROP CONSTRAINT IF EXISTS conversation_messages_body_check;

ALTER TABLE conversation_messages
  ALTER COLUMN body SET DEFAULT '';

ALTER TABLE conversation_messages
  ADD CONSTRAINT conversation_messages_body_check
  CHECK (CHAR_LENGTH(body) BETWEEN 0 AND 4000);

CREATE TABLE conversation_attachments (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  content_type VARCHAR(32) NOT NULL
    CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 4194304),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX conversation_attachments_message_idx
  ON conversation_attachments (message_id);

CREATE INDEX conversation_attachments_conversation_idx
  ON conversation_attachments (conversation_id, created_at ASC);
