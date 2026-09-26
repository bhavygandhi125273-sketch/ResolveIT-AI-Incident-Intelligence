-- Vapi phone channel: phone-sourced incidents, caller identification, and call-level idempotency.
-- Additive only; existing rows are unchanged.

-- Employees are identified on phone calls by caller ID (E.164, e.g. +14155550100).
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number varchar(20);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_idx ON users (phone_number) WHERE phone_number IS NOT NULL;

-- One incident per Vapi call; the transcript is attached to it when the call ends.
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS vapi_call_id varchar(100),
  ADD COLUMN IF NOT EXISTS caller_phone varchar(20);
CREATE UNIQUE INDEX IF NOT EXISTS incidents_vapi_call_id_idx ON incidents (vapi_call_id) WHERE vapi_call_id IS NOT NULL;

-- 'voice' is the browser assistant; 'phone' is the Vapi phone line.
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_source_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_source_check CHECK (source IN ('manual', 'voice', 'phone'));

ALTER TABLE incident_events DROP CONSTRAINT IF EXISTS incident_events_type_check;
ALTER TABLE incident_events ADD CONSTRAINT incident_events_type_check CHECK (type IN (
  'CREATED', 'INVESTIGATED', 'ESCALATED', 'STATUS_CHANGED', 'ASSIGNED', 'NOTE', 'CALL_TRANSFERRED'
));
