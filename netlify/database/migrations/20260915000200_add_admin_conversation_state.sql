CREATE TABLE admin_conversation_states (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  admin_id TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, admin_id)
);

CREATE INDEX admin_conversation_states_admin_idx
  ON admin_conversation_states (admin_id, is_pinned DESC, updated_at DESC);
