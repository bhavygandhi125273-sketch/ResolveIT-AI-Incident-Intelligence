CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(160) NOT NULL,
  description text NOT NULL,
  category varchar(40) NOT NULL CHECK (category IN (
    'ACCOUNT_ACCESS', 'COMPUTER_HARDWARE', 'NETWORK_CONNECTIVITY',
    'SOFTWARE_APPLICATIONS', 'EMAIL_COLLABORATION', 'OTHER'
  )),
  status varchar(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED')),
  severity varchar(20) NOT NULL
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  affected_users integer NOT NULL CHECK (affected_users BETWEEN 1 AND 100000),
  business_impact varchar(2000) NOT NULL,
  urgency varchar(20) NOT NULL
    CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents (status);
