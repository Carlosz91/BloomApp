require('dotenv').config();
const pg = require('pg');
const { Pool, types } = pg;

// PostgreSQL connection string. Required in every environment: there is no
// credentials fallback, so a missing config fails fast instead of silently
// connecting with a guessable password.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[FATAL] DATABASE_URL env var is required (see .env.example)');
  process.exit(1);
}

const pool = new Pool({ connectionString });

// Response-shape compatibility with the previous SQLite backend:
// - NUMERIC (DECIMAL columns) is parsed as Number so `precio` stays a JSON
//   number like it was in SQLite (node-postgres returns NUMERIC as string).
// - TIMESTAMP/TIMESTAMPTZ values are kept as raw strings instead of being
//   parsed into Date objects, so fecha_hora/creado_en serialize exactly as
//   stored rather than being re-formatted to ISO 8601 UTC.
types.setTypeParser(types.builtins.NUMERIC, (val) => parseFloat(val));
types.setTypeParser(types.builtins.TIMESTAMP, (val) => val);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => val);

// Create/verify tables. Idempotent; safe to call multiple times (memoized).
// DDL runs on a dedicated short-lived pool built from MIGRATION_DATABASE_URL
// (owner role) so the runtime pool (DATABASE_URL) can be a least-privilege
// role with no DDL rights. Falls back to DATABASE_URL when unset.
async function withMigrationPool(fn) {
  const migrationPool = new Pool({
    connectionString: process.env.MIGRATION_DATABASE_URL || connectionString,
    max: 1
  });
  try {
    return await fn(migrationPool);
  } finally {
    await migrationPool.end().catch(() => {});
  }
}

async function runMigrations() {
  await withMigrationPool(applyMigrations);
}

async function applyMigrations(pool) {
  // Table users - login credentials
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      telefono VARCHAR(20),
      genero VARCHAR(10) NOT NULL DEFAULT '',
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration for existing PostgreSQL databases: `genero` column for the
  // personalized greeting. Equivalent to the old try/catch SQLite migration.
  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE users ADD COLUMN genero VARCHAR(10) NOT NULL DEFAULT '';
    EXCEPTION
      WHEN duplicate_column THEN NULL;
    END $$;
  `);

  // Migration: server-side terms acceptance audit. The device copy of the
  // acceptance (AsyncStorage) is only a UX cache for the pre-login onboarding
  // step; the DB columns are the durable legal proof of who accepted v1 and
  // when. Idempotent: PostgreSQL supports ADD COLUMN IF NOT EXISTS since 9.6.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(10)`);

  // Table services - service catalog (Fase 3+)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      precio DECIMAL(10, 2) NOT NULL,
      duracion_minutos INTEGER NOT NULL,
      categoria VARCHAR(50),
      activo BOOLEAN DEFAULT TRUE,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Table appointments - scheduled bookings (Fase 3+)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      fecha_hora TIMESTAMP NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'booked',
      motivo_cancelacion TEXT,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    );
  `);

  // DB-enforced guard against double bookings. The application-level SELECT
  // pre-check cannot prevent race conditions (two concurrent requests both
  // passing the check); this unique partial index closes that window for any
  // two active bookings sharing the exact same slot, regardless of user.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_active_slot
    ON appointments (fecha_hora)
    WHERE estado = 'booked';
  `);

  // Table sessions - server-side sessions backing access/refresh tokens.
  // Refresh tokens are stored only as sha256 hex hashes. A rotation chain
  // shares one family_id so reuse of a retired token can revoke the family.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      family_id UUID NOT NULL,
      refresh_token_hash CHAR(64) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now(),
      last_used_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      replaced_by UUID,
      user_agent VARCHAR(255),
      ip VARCHAR(64)
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS ix_sessions_user_id ON sessions (user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS ix_sessions_family_id ON sessions (family_id)');

  // Table login_attempts - per-account brute-force throttle. `key` is
  // sha256(lowercased email) so unknown emails are tracked without storing PII.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      key CHAR(64) PRIMARY KEY,
      failures INTEGER NOT NULL DEFAULT 0,
      first_failure_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      locked_until TIMESTAMPTZ
    );
  `);

  // Table password_resets - one-time 6-digit codes for "forgot password".
  // Only an HMAC of the code is stored, never the code itself.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash CHAR(64) NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS ix_password_resets_user_id ON password_resets (user_id)');

  // Email ownership proof. NULL = unverified. Existing users are deliberately
  // NOT grandfathered as verified: nobody has proven control of their mailbox.
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ');

  // Table email_verifications - one-time 6-digit codes proving mailbox control.
  // Mirrors password_resets: only an HMAC of the code is stored.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash CHAR(64) NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS ix_email_verifications_user_id ON email_verifications (user_id)');

  // Table oauth_nonces - server-issued, single-use nonces for Google sign-in.
  // Only the sha256 of the nonce is stored.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_nonces (
      nonce_hash CHAR(64) PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    );
  `);

  console.log('✅ Tablas de PostgreSQL verificadas/creadas: users, services, appointments, sessions, login_attempts, password_resets, email_verifications, oauth_nonces');
}

let initPromise = null;

function initializeTables() {
  if (!initPromise) {
    initPromise = runMigrations().catch((err) => {
      // Reset so a later call (init-db.js, tests) can retry after a failure.
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

// Run initialization on module load (non-blocking await); fail fast on boot
// if the database is unreachable or the schema cannot be created.
initializeTables().catch((err) => {
  console.error('FATAL: no se pudieron crear tablas:', err.message);
  process.exit(1);
});

// Shared query helpers used across the app.
async function query(text, params) {
  return pool.query(text, params);
}

// Single-row helper: { row: first row or null, rowCount }.
async function queryOne(text, params) {
  const result = await pool.query(text, params);
  return { row: result.rows[0] ?? null, rowCount: result.rowCount };
}

// Multi-row helper: returns the rows array directly.
async function queryMany(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

module.exports = { pool, query, queryOne, queryMany, initializeTables, withMigrationPool };
