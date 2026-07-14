
-- Add MikroTik activation tracking to payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS mikrotik_activated   BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS activation_attempts  INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activation_at   TIMESTAMPTZ;

-- Pending activations queue (Level 3 auto-retry)
CREATE TABLE IF NOT EXISTS pending_activations (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID          REFERENCES payments(id) ON DELETE CASCADE,
  phone             TEXT,
  mac_address       TEXT,
  package_name      TEXT,
  expires_at        TIMESTAMPTZ   NOT NULL,
  attempts          INTEGER       DEFAULT 0,
  last_attempt_at   TIMESTAMPTZ,
  status            TEXT          DEFAULT 'pending'  -- pending | activated | failed | expired
                    CHECK (status IN ('pending','activated','failed','expired')),
  error_message     TEXT,
  created_at        TIMESTAMPTZ   DEFAULT NOW()
);

-- Fast lookups for cron + self-service
CREATE INDEX IF NOT EXISTS idx_pending_activations_status
  ON pending_activations (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_pending_activations_payment_id
  ON pending_activations (payment_id);

-- Only one pending record per payment at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_activations_payment_unique
  ON pending_activations (payment_id)
  WHERE status = 'pending';

-- Enable RLS (admins only via service role; no public access)
ALTER TABLE pending_activations ENABLE ROW LEVEL SECURITY;
