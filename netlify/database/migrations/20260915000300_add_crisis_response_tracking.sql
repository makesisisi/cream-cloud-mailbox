ALTER TABLE admin_conversation_states
  ADD COLUMN crisis_status VARCHAR(16) NOT NULL DEFAULT 'unreviewed'
    CHECK (crisis_status IN ('unreviewed', 'reviewing', 'escalated', 'resolved')),
  ADD COLUMN crisis_steps JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE conversation_crisis_actions (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  admin_id TEXT NOT NULL,
  action_key VARCHAR(48) NOT NULL,
  completed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX conversation_crisis_actions_lookup_idx
  ON conversation_crisis_actions (conversation_id, admin_id, created_at DESC);
