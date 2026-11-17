-- BloomApp: least-privilege runtime role.
--
-- Creates `bloomapp_app` (LOGIN, no DDL rights) for the API at runtime. The
-- owner role (POSTGRES_USER, e.g. `bloomapp`) keeps creating/migrating tables
-- through MIGRATION_DATABASE_URL at boot. Run as the owner/superuser, connected
-- to the application database. Idempotent: safe to re-run (it also rotates the
-- role password and re-grants on tables created since the last run).
--
-- Usage (password never lands in shell history if read from a variable/file):
--   docker exec -i bloomapp-postgres psql -U bloomapp -d bloomapp \
--     -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" < scripts/db-roles.sql
--
-- Then point the backend at it (e.g. in .env) and recreate the backend:
--   APP_DATABASE_URL=postgres://bloomapp_app:<APP_DB_PASSWORD>@postgres:5432/bloomapp
--
-- Use a URL-safe password (letters, digits, - . _ ~) or percent-encode it.

\if :{?app_password}
\else
  \echo 'ERROR: pass the password with -v app_password=...'
  \quit
\endif

SELECT current_database() AS dbname, current_user AS owner_role \gset

-- Role: create if missing, otherwise just (re)set login + password.
SELECT format('CREATE ROLE bloomapp_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bloomapp_app') \gexec
SELECT format('ALTER ROLE bloomapp_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'app_password') \gexec

-- No one but the owner may create objects in the public schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

SELECT format('GRANT CONNECT ON DATABASE %I TO bloomapp_app', :'dbname') \gexec
GRANT USAGE ON SCHEMA public TO bloomapp_app;

-- Existing objects.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bloomapp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bloomapp_app;

-- Objects the owner creates in the future (new migrations).
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bloomapp_app', :'owner_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO bloomapp_app', :'owner_role') \gexec
