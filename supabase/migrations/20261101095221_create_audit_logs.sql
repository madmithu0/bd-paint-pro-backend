/*
# Create audit_logs table (server-only, append-only)

1. New Tables
- `audit_logs`
  - `id` (bigint identity, primary key)
  - `level` (text, not null): info, warn, error or security
  - `event` (text, not null): short name of what happened
  - `ip` (text): caller IP address when known
  - `details` (jsonb): extra context for the event
  - `created_at` (timestamptz, default now())

2. Security
- Row level security is enabled. No policies are created, so the browser roles (anon, authenticated) cannot read or write the table.
- Only the server (service_role, which bypasses RLS) can insert and read rows.
- No UPDATE or DELETE is granted to any role, so records cannot be changed or removed through the API.

3. Notes
- This table is the durable store for the server's audit and security log.
*/

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  level text NOT NULL,
  event text NOT NULL,
  ip text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON audit_logs TO service_role;
