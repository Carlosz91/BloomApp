const pg = require('pg');
const { Pool, types } = pg;

// PostgreSQL connection string (docker-compose provides it; local dev may
// override DATABASE_URL, otherwise fall back to the local compose defaults).
const connectionString =
  process.env.DATABASE_URL || 'postgres://bloomapp:bloomapp@localhost:5432/bloomapp';

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
async function runMigrations() {
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

  console.log('✅ Tablas de PostgreSQL verificadas/creadas: users, services, appointments');
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

module.exports = { pool, query, queryOne, queryMany, initializeTables };
