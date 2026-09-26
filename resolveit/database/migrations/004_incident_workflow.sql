-- Incident workflow: ticket references, assignment, escalation, stored AI results, and an audit timeline.
-- Additive only: existing incidents keep their data (including incidents without a requester).

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS reference_number bigint GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN IF NOT EXISTS additional_context text,
  ADD COLUMN IF NOT EXISTS human_assistance_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS incidents_reference_number_idx ON incidents (reference_number);
CREATE INDEX IF NOT EXISTS incidents_assigned_to_idx ON incidents (assigned_to);
CREATE INDEX IF NOT EXISTS incidents_severity_idx ON incidents (severity);

CREATE TABLE IF NOT EXISTS incident_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL CHECK (status IN ('complete', 'not_configured', 'unavailable')),
  summary text,
  possible_cause text,
  impact text,
  recommended_steps text[] NOT NULL DEFAULT '{}',
  safe_to_resolve boolean NOT NULL DEFAULT false,
  recommended_resolution text,
  requires_human_intervention boolean NOT NULL DEFAULT false,
  human_intervention_reason text,
  missing_information text[] NOT NULL DEFAULT '{}',
  decision_action varchar(40) NOT NULL CHECK (decision_action IN (
    'OFFER_RESOLUTION', 'CREATE_TICKET', 'CREATE_PRIORITIZED_TICKET', 'ESCALATE_TO_HUMAN'
  )),
  decision_explanation text NOT NULL,
  decision_resolution text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incident_investigations_incident_idx
  ON incident_investigations (incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type varchar(30) NOT NULL CHECK (type IN (
    'CREATED', 'INVESTIGATED', 'ESCALATED', 'STATUS_CHANGED', 'ASSIGNED', 'NOTE'
  )),
  from_status varchar(20),
  to_status varchar(20),
  body text,
  -- INTERNAL events (IT notes) are never returned to employees.
  visibility varchar(10) NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'INTERNAL')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incident_events_incident_idx
  ON incident_events (incident_id, created_at);
