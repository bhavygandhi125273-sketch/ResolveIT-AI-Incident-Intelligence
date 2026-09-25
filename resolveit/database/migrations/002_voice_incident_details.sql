ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS affected_system varchar(200),
  ADD COLUMN IF NOT EXISTS symptoms text,
  ADD COLUMN IF NOT EXISTS started_at varchar(100),
  ADD COLUMN IF NOT EXISTS currently_affected boolean,
  ADD COLUMN IF NOT EXISTS error_messages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS troubleshooting_attempted text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transcript text;

DO $$ BEGIN
  ALTER TABLE incidents ADD CONSTRAINT incidents_source_check CHECK (source IN ('manual', 'voice'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
