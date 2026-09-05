-- Read-only Postgres role for the voice/text assistant.
--
-- The assistant writes its own SQL from natural language, so the prompt cannot
-- be the thing that keeps it read-only. This role can SELECT and nothing else:
-- no INSERT/UPDATE/DELETE, no DDL, no temp tables, and every transaction it
-- opens is READ ONLY by default. Even a fully jailbroken model cannot change a
-- row through it.
--
-- Apply with:  pnpm assistant:grant     (see scripts/assistant-readonly.sh)
-- Re-run it after any `prisma migrate`, so new tables are covered.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dealflow_readonly') THEN
    CREATE ROLE dealflow_readonly LOGIN PASSWORD 'dealflow_readonly';
  END IF;
END
$$;

-- Reads only, and never inside a writable transaction.
ALTER ROLE dealflow_readonly SET default_transaction_read_only = on;
-- A runaway analytical query gets killed rather than pinning a connection.
ALTER ROLE dealflow_readonly SET statement_timeout = '15s';
ALTER ROLE dealflow_readonly SET idle_in_transaction_session_timeout = '30s';
-- Keep it off the search path games: it resolves public only.
ALTER ROLE dealflow_readonly SET search_path = 'public';

-- CONNECT on whichever database this script is run against.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO dealflow_readonly', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO dealflow_readonly;

-- Existing objects.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dealflow_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO dealflow_readonly;

-- Anything a future migration creates, for whichever role runs migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO dealflow_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO dealflow_readonly;

-- A SELECT-only role can still create objects if public.CREATE is left open,
-- which is the default on Postgres < 15. Withhold it explicitly.
REVOKE CREATE ON SCHEMA public FROM dealflow_readonly;

-- information_schema stays readable: the agent builds its schema digest from it.
