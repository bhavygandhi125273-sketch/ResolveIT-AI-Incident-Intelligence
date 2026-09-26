CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role varchar(20) NOT NULL
    CHECK (role IN ('EMPLOYEE', 'IT_ADMIN')),
  display_name varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS requester_id uuid;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_requester_id_fkey
  FOREIGN KEY (requester_id)
  REFERENCES users(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_email_idx
  ON users (email);

CREATE INDEX IF NOT EXISTS incidents_requester_id_idx
  ON incidents (requester_id);