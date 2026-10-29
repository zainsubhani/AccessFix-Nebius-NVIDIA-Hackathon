-- Apply once with a database owner. Re-running never resets spent reservations.
-- Five cents per attempt is deliberately conservative: one model, <=8 KiB
-- prompt text and 1,200 output tokens. Failed requests also retain their slot.
CREATE TABLE IF NOT EXISTS firststep_coach_budget (
  id text PRIMARY KEY,
  model text NOT NULL,
  limit_cents integer NOT NULL CHECK (limit_cents BETWEEN 0 AND 500),
  reserved_cents integer NOT NULL CHECK (reserved_cents BETWEEN 0 AND limit_cents),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Includes the first authorized live verification, made before this ledger existed.
INSERT INTO firststep_coach_budget (id, model, limit_cents, reserved_cents, expires_at)
VALUES ('firststep-2026', 'nvidia/nemotron-3-super-120b-a12b', 500, 5, '2026-12-16T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
