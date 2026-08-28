CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  client_id TEXT NOT NULL,
  alias VARCHAR(32) NOT NULL,
  topic VARCHAR(120) NOT NULL,
  need VARCHAR(200) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX one_open_conversation_per_client
  ON conversations (client_id)
  WHERE status <> 'closed';

CREATE INDEX conversations_updated_at_idx
  ON conversations (updated_at DESC);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender VARCHAR(16) NOT NULL CHECK (sender IN ('client', 'admin', 'system')),
  body TEXT NOT NULL CHECK (CHAR_LENGTH(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX conversation_messages_conversation_idx
  ON conversation_messages (conversation_id, created_at ASC);
