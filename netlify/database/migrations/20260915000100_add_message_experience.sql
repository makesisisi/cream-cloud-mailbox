ALTER TABLE conversation_messages
  ADD COLUMN reply_to_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
  ADD COLUMN client_message_id UUID,
  ADD COLUMN recalled_at TIMESTAMPTZ;

CREATE UNIQUE INDEX conversation_messages_client_message_idx
  ON conversation_messages (conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX conversation_messages_reply_to_idx
  ON conversation_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;
