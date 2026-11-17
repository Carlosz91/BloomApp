// BloomApp Backend Server - Fase 1: Login y Autenticación
// Arquitectura preparada para phases 2-6 (servicios, citas, dashboard)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool, query, queryOne, queryMany } = require('./db.js');
const mailer = require('./mailer.js');
const { linkGoogleIdentity } = require('./google-link.js');

// Crea/verifica tablas y garantiza el catálogo de servicios en cada arranque (idempotente)
require('./init-db.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Optional reverse-proxy awareness so rate limiting and session IPs use the
// real client address. TRUST_PROXY: number of hops ("1"), "true"/"false", or
// an Express trust-proxy string such as "loopback". Unset keeps the default.
if (process.env.TRUST_PROXY) {
  const raw = process.env.TRUST_PROXY.trim();
  let trust = raw;
  if (/^\d+$/.test(raw)) trust = parseInt(raw, 10);
  else if (raw === 'true') trust = true;
  else if (raw === 'false') trust = false;
  app.set('trust proxy', trust);
}

// JWT secret discipline: refuse to boot in EVERY environment without a
// strong configured secret. There is no development fallback on purpose.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET env var is required and must be at least 32 characters');
  process.exit(1);
}

// Google sign-in (optional at boot): the endpoint degrades to 503 when the
// client ID is not configured instead of taking the whole API down.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
if (!GOOGLE_CLIENT_ID) {
  console.warn('[WARN] GOOGLE_CLIENT_ID not set; Google sign-in disabled');
}

// Session policy (all env-configurable):
// - ACCESS_TTL_SECONDS: lifetime of the short-lived access JWT.
// - SESSION_IDLE_SECONDS: server-enforced inactivity window; a session whose
//   last authenticated/refresh activity is older than this is revoked.
// - SESSION_ABSOLUTE_DAYS: hard cap on a session family's lifetime.
const positiveIntEnv = (name, fallback) => {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const ACCESS_TTL_SECONDS = positiveIntEnv('ACCESS_TTL_SECONDS', 300);
const SESSION_IDLE_SECONDS = positiveIntEnv('SESSION_IDLE_SECONDS', 180);
const SESSION_ABSOLUTE_DAYS = positiveIntEnv('SESSION_ABSOLUTE_DAYS', 30);
const JWT_ISSUER = 'bloomapp';
const JWT_AUDIENCE = 'bloomapp-app';

// Canonical terms version the server is willing to record. Bump when legal
// text changes and re-run the onboarding flow (the client compares versions).
const TERMS_VERSION = 'v1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');

// sid binds the JWT to its server-side session row; sub is the user id.
const signAccessToken = (userId, sessionId) =>
  jwt.sign({ sid: sessionId }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TTL_SECONDS,
    subject: String(userId),
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    jwtid: crypto.randomUUID()
  });

// ---- Password hashing and policy -------------------------------------------
// BCRYPT_SALT_ROUNDS (default 12, clamped to 4..15). Hashes stored with fewer
// rounds still verify and are upgraded transparently on the next login.
const BCRYPT_ROUNDS = Math.min(15, Math.max(4, positiveIntEnv('BCRYPT_SALT_ROUNDS', 12)));
// Dummy hash computed once at boot with the same cost: login for an unknown
// email compares against it so response time does not reveal account existence.
const DUMMY_HASH_PROMISE = bcrypt.hash(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);
DUMMY_HASH_PROMISE.catch(() => {});

// bcrypt silently ignores bytes beyond 72, so longer passwords are rejected
// instead of being truncated. Login caps input length so nobody can make the
// server hash megabytes of data.
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_BYTES = 72;
const LOGIN_PASSWORD_MAX_LENGTH = 1024;
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '1234567890', '12345678910', '0123456789',
  'qwertyuiop', 'qwerty123', 'qwerty1234', 'iloveyou12', 'contrasena', 'contrasena1',
  'contrasena123', 'contraseña', 'contraseña1', 'contraseña123', 'abc1234567', 'abcdefghij',
  '1q2w3e4r5t', '123456789a', 'a123456789', 'bloomapp123', 'bloomapp1234', 'bienvenido1',
  'bienvenido123', 'passw0rd123', 'admin12345', 'letmein1234', 'welcome123', 'asdfghjkl1'
]);

// Returns a Spanish error message, or null when the password is acceptable.
function validateNewPassword(password, email) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return `La contraseña es demasiado larga (máximo ${PASSWORD_MAX_BYTES} bytes)`;
  }
  const lower = password.toLowerCase();
  const localPart = email.split('@')[0];
  if (lower === email || lower === localPart) {
    return 'La contraseña no puede ser igual a tu correo';
  }
  if (COMMON_PASSWORDS.has(lower)) {
    return 'La contraseña es demasiado común. Elegí una más difícil de adivinar';
  }
  return null;
}

// ---- Per-account login throttling ------------------------------------------
// Complements the per-IP limiter against distributed guessing. Keyed by
// sha256(lowercased email) so unknown emails are throttled identically and
// nothing reveals whether an account exists. After LOGIN_LOCK_THRESHOLD
// consecutive failures the key is locked for 1, 2, 4 ... min (cap 15 min).
// Backed by the login_attempts table so it survives restarts.
const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_MAX_SECONDS = 15 * 60;
const accountKey = (email) => sha256Hex(email);

// Seconds left on an active lock for this key, or 0.
async function loginLockRemaining(key) {
  const { row } = await queryOne(
    `SELECT CEIL(EXTRACT(EPOCH FROM (locked_until - now())))::int AS remaining
     FROM login_attempts WHERE key = $1 AND locked_until > now()`,
    [key]
  );
  return row ? Math.max(1, row.remaining) : 0;
}

// Atomic failure increment; a record idle for 24h starts over.
const recordLoginFailure = (key) =>
  query(
    `INSERT INTO login_attempts (key, failures, first_failure_at, locked_until)
     VALUES ($1, 1, now(), NULL)
     ON CONFLICT (key) DO UPDATE SET
       failures = CASE WHEN login_attempts.first_failure_at < now() - interval '24 hours'
                       THEN 1 ELSE login_attempts.failures + 1 END,
       first_failure_at = CASE WHEN login_attempts.first_failure_at < now() - interval '24 hours'
                               THEN now() ELSE login_attempts.first_failure_at END,
       locked_until = CASE
         WHEN login_attempts.first_failure_at < now() - interval '24 hours' THEN NULL
         WHEN login_attempts.failures + 1 >= $2
           THEN now() + make_interval(secs => LEAST($3::double precision,
                  60 * power(2, LEAST(login_attempts.failures + 1 - $2, 10))))
         ELSE login_attempts.locked_until END`,
    [key, LOGIN_LOCK_THRESHOLD, LOGIN_LOCK_MAX_SECONDS]
  );

const resetLoginFailures = (key) => query('DELETE FROM login_attempts WHERE key = $1', [key]);

// Middlewares
// Security headers (no HTML is served; CSP defaults are harmless for the API).
app.use(helmet());
// CORS: native/mobile clients (and curl) send no Origin header and are always
// allowed. Browser origins are restricted to the CLIENT_ORIGIN allowlist
// (comma-separated https://... values). When CLIENT_ORIGIN is unset it stays
// open in development but FAILS CLOSED in production: every browser Origin is
// rejected until an allowlist is configured.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
if (IS_PRODUCTION && CLIENT_ORIGINS.length === 0) {
  console.warn('[WARN] CLIENT_ORIGIN is not set in production: all browser origins will be rejected by CORS');
}
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (CLIENT_ORIGINS.length === 0) {
      return IS_PRODUCTION ? cb(new Error('Not allowed by CORS')) : cb(null, true);
    }
    return CLIENT_ORIGINS.includes(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '10kb' }));

// Rate limiting: strict on login (brute force) and register (spam accounts),
// lighter on the rest of the API. /auth/me and /auth/profile are NOT limited
// here (they are normal app traffic) - they ride the general api limiter.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: positiveIntEnv('LOGIN_RATE_MAX', 5),
  // Only failed attempts count against the per-IP budget; legitimate logins
  // (e.g. several people behind one NAT) must not exhaust it.
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de inicio de sesión. Probá de nuevo en 15 minutos' }
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados registros. Probá de nuevo más tarde' }
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: positiveIntEnv('FORGOT_RATE_MAX', 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Probá de nuevo más tarde' }
});
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: positiveIntEnv('RESET_RATE_MAX', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Probá de nuevo más tarde' }
});
const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos con Google. Probá de nuevo en 15 minutos' }
});
const googleNonceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: positiveIntEnv('GOOGLE_NONCE_RATE_MAX', 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Probá de nuevo más tarde' }
});
// Keyed by the authenticated user id, so it must run AFTER authenticateToken.
// Falls back to a constant (never to req.ip) if no user is attached.
const appointmentWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: positiveIntEnv('APPOINTMENT_WRITE_RATE_MAX', 30),
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : 'anonymous'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados cambios en tus citas. Probá de nuevo más tarde' }
});
// Per-IP budget for requesting verification codes (plus a per-account cap of
// VERIFY_SENDS_PER_HOUR rows enforced in the handler).
const verifySendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: positiveIntEnv('VERIFY_SEND_RATE_MAX', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Probá de nuevo más tarde' }
});
// Keyed by user id: must run AFTER authenticateToken. The 5-attempt burn per
// code is the real guess limit; this just bounds request volume.
const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: positiveIntEnv('VERIFY_EMAIL_RATE_MAX', 30),
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : 'anonymous'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Probá de nuevo más tarde' }
});
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de renovar la sesión. Probá de nuevo más tarde' }
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes' }
});
app.use(apiLimiter);

// ==========================================
// SESSIONS (access JWT + rotating opaque refresh token)
// ==========================================

const generateRefreshToken = () => crypto.randomBytes(32).toString('base64url');

const clientMeta = (req) => ({
  userAgent: String(req.headers['user-agent'] || '').slice(0, 255) || null,
  ip: String(req.ip || '').slice(0, 64) || null
});

// Inserts a session row. `db` is anything with .query (pool or tx client).
async function insertSession(db, { id, userId, familyId, refreshToken, req }) {
  const { userAgent, ip } = clientMeta(req);
  await db.query(
    `INSERT INTO sessions (id, user_id, family_id, refresh_token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5), $6, $7)`,
    [id, userId, familyId, sha256Hex(refreshToken), SESSION_ABSOLUTE_DAYS, userAgent, ip]
  );
}

// Creates a session and returns the credentials for the client.
async function issueSession(user, req, familyId = crypto.randomUUID()) {
  const sessionId = crypto.randomUUID();
  const refreshToken = generateRefreshToken();
  await insertSession({ query }, { id: sessionId, userId: user.id, familyId, refreshToken, req });
  return {
    token: signAccessToken(user.id, sessionId),
    refreshToken,
    expiresIn: ACCESS_TTL_SECONDS
  };
}

const revokeFamily = (familyId) =>
  query('UPDATE sessions SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [familyId]);

// Housekeeping: purge long-dead sessions hourly (never keeps the process alive).
setInterval(() => {
  query(
    `DELETE FROM sessions
     WHERE expires_at < now() - interval '7 days'
        OR revoked_at < now() - interval '7 days'`
  ).catch((err) => console.error('[ERROR] Session cleanup:', err.message));
  query(
    `DELETE FROM login_attempts
     WHERE first_failure_at < now() - interval '24 hours'
       AND (locked_until IS NULL OR locked_until < now())`
  ).catch((err) => console.error('[ERROR] Login attempts cleanup:', err.message));
  query("DELETE FROM password_resets WHERE created_at < now() - interval '1 day'")
    .catch((err) => console.error('[ERROR] Password resets cleanup:', err.message));
  query("DELETE FROM email_verifications WHERE created_at < now() - interval '1 day'")
    .catch((err) => console.error('[ERROR] Email verifications cleanup:', err.message));
  query('DELETE FROM oauth_nonces WHERE expires_at < now() OR used_at IS NOT NULL')
    .catch((err) => console.error('[ERROR] OAuth nonces cleanup:', err.message));
}, 60 * 60 * 1000).unref();

// ==========================================
// EMAIL VERIFICATION (6-digit code sent by email)
// ==========================================

// User shape returned to clients: never the hash, and the raw timestamp is
// replaced by a plain boolean.
function publicUser(row) {
  const { password_hash, email_verified_at, ...rest } = row;
  return { ...rest, email_verified: Boolean(email_verified_at) };
}

const EMAIL_CODE_TTL_MINUTES = positiveIntEnv('EMAIL_CODE_TTL_MINUTES', 30);
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const VERIFY_SENDS_PER_HOUR = 3; // codes per account per hour (counts all rows)
// When true, POST /appointments needs a verified email. Off by default so the
// rollout does not lock out existing (unverified) users.
const REQUIRE_EMAIL_VERIFICATION = String(process.env.REQUIRE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';
const EMAIL_VERIFY_INVALID_MESSAGE = 'Código inválido o vencido';
// Domain-separated key derived from JWT_SECRET.
const EMAIL_VERIFY_HMAC_KEY = crypto.createHmac('sha256', JWT_SECRET).update('email-verify').digest();
const hashVerifyCode = (code) =>
  crypto.createHmac('sha256', EMAIL_VERIFY_HMAC_KEY).update(code).digest('hex');

// Invalidates previous unused codes, stores a fresh one and mails it.
// Callers that must not wait on SMTP simply do not await the result.
async function issueEmailVerification(userId, email) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE email_verifications SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [userId]
    );
    await client.query(
      `INSERT INTO email_verifications (user_id, code_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [userId, hashVerifyCode(code), EMAIL_CODE_TTL_MINUTES]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await mailer.sendEmailVerificationCode(email, code, EMAIL_CODE_TTL_MINUTES);
}

// ==========================================
// FASE 1: AUTENTICACIÓN (Login/Registro)
// ==========================================

// POST /auth/register - Registrar nuevo cliente
app.post('/auth/register', registerLimiter, async (req, res) => {
  try {
    const { telefono, genero } = req.body;

    // Normalize and validate server-side (the client cannot be trusted).
    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (nombre.length < 2 || nombre.length > 60) {
      return res.status(400).json({
        success: false,
        message: 'El nombre debe tener entre 2 y 60 caracteres'
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }
    const passwordError = validateNewPassword(password, email);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError
      });
    }

    // Verificar si el usuario ya existe.
    // Tradeoff: answering 409 reveals that an email is registered (account
    // enumeration). It is kept for now because the UX needs the feedback and
    // registerLimiter bounds the probing rate; the proper fix is the
    // email-verification flow, where the response is identical either way.
    const existingResult = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existingResult.row) {
      return res.status(409).json({
        success: false,
        message: 'El correo ya está registrado'
      });
    }

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Género opcional para el saludo personalizado (hombre/mujer; vacío = neutro)
    const generoNormalizado =
      typeof genero === 'string' && ['hombre', 'mujer'].includes(genero.trim().toLowerCase())
        ? genero.trim().toLowerCase()
        : '';

    // Insertar usuario
    const result = await query(
      'INSERT INTO users (nombre, email, password_hash, telefono, genero) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [nombre, email, passwordHash, telefono || null, generoNormalizado]
    );
    const newUserId = Number(result.rows[0].id);

    // Crear sesión (access token + refresh token)
    const { token, refreshToken } = await issueSession({ id: newUserId }, req);

    // Verification code: best effort and not awaited, so mail latency or
    // failure never slows down or fails registration.
    issueEmailVerification(newUserId, email).catch((err) =>
      console.error('[ERROR] Register verification code:', err.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      refreshToken,
      user: { id: newUserId, nombre, email, telefono, genero: generoNormalizado, email_verified: false }
    });
  } catch (err) {
    console.error('[ERROR] Register:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al registrar'
    });
  }
});

// POST /auth/login - Iniciar sesión
app.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    // Case-insensitive login: emails are stored lowercased at registration.
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Correo y contraseña son obligatorios'
      });
    }

    // One generic answer for every failure mode (unknown email, wrong
    // password, locked account, oversized input) so nothing leaks which it was.
    const invalidCredentials = () =>
      res.status(401).json({ success: false, message: 'Credenciales inválidas' });

    // Never hash megabytes of attacker-controlled input.
    if (password.length > LOGIN_PASSWORD_MAX_LENGTH) return invalidCredentials();

    // Per-account throttle (applies to unknown emails too).
    const key = accountKey(email);
    const lockedFor = await loginLockRemaining(key);
    if (lockedFor > 0) {
      res.set('Retry-After', String(lockedFor));
      return invalidCredentials();
    }

    // Buscar usuario
    const userResult = await queryOne('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.row;

    // Always run exactly one bcrypt compare (dummy hash when the user does not
    // exist) so timing is the same for known and unknown emails.
    const hashToCheck = user ? user.password_hash : await DUMMY_HASH_PROMISE;
    const passwordMatches = await bcrypt.compare(password, hashToCheck);
    if (!user || !passwordMatches) {
      await recordLoginFailure(key);
      return invalidCredentials();
    }

    await resetLoginFailures(key);

    // Upgrade older, cheaper hashes to the configured cost (best effort).
    try {
      if (bcrypt.getRounds(user.password_hash) < BCRYPT_ROUNDS) {
        const upgraded = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [upgraded, user.id]);
        user.password_hash = upgraded;
      }
    } catch (rehashErr) {
      console.error('[WARN] Password rehash:', rehashErr.message);
    }

    // Crear sesión (access token + refresh token)
    const { token, refreshToken } = await issueSession(user, req);

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      refreshToken,
      user: publicUser(user)
    });
  } catch (err) {
    console.error('[ERROR] Login:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al iniciar sesión'
    });
  }
});

// GET /auth/google/nonce - Issue a single-use, server-generated nonce for the
// Google implicit flow. Only its sha256 is stored; it is consumed atomically
// by POST /auth/google and expires after GOOGLE_NONCE_TTL_MINUTES.
const GOOGLE_NONCE_TTL_MINUTES = 10;
app.get('/auth/google/nonce', googleNonceLimiter, async (req, res) => {
  try {
    const nonce = crypto.randomBytes(24).toString('base64url');
    await query(
      `INSERT INTO oauth_nonces (nonce_hash, expires_at)
       VALUES ($1, now() + make_interval(mins => $2))`,
      [sha256Hex(nonce), GOOGLE_NONCE_TTL_MINUTES]
    );
    res.set('Cache-Control', 'no-store');
    return res.json({ nonce });
  } catch (err) {
    console.error('[ERROR] Google nonce:', err.message);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// POST /auth/google - Exchange a Google ID token for a BloomApp session
// Body: { idToken }. Verification runs against Google's tokeninfo endpoint
// and the aud claim must match GOOGLE_CLIENT_ID. Users are upserted by email;
// existing accounts keep their regular password login behavior.
app.post('/auth/google', googleLimiter, async (req, res) => {
  try {
    const idToken = typeof req.body.idToken === 'string' ? req.body.idToken.trim() : '';
    const nonce = typeof req.body.nonce === 'string' ? req.body.nonce.trim() : '';
    if (!idToken || !nonce) {
      return res.status(400).json({
        success: false,
        message: 'idToken y nonce son obligatorios'
      });
    }
    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false,
        message: 'Login con Google no está configurado'
      });
    }

    // Same response for every rejection (no oracle for clients), but the
    // server logs a coarse reason so operators can diagnose failures.
    const invalidGoogleToken = (reason) => {
      console.warn(`[AUTH] Google login rejected: reason=${reason}`);
      return res.status(401).json({ success: false, message: 'Token de Google inválido' });
    };

    // Consume the server-issued nonce BEFORE trusting or even contacting
    // Google: unknown, expired and already-used nonces are indistinguishable.
    const consumed = await queryOne(
      `UPDATE oauth_nonces SET used_at = now()
       WHERE nonce_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING 1 AS ok`,
      [sha256Hex(nonce)]
    );
    if (!consumed.row) return invalidGoogleToken('nonce_unknown_expired_or_used');

    // Verify with Google: the endpoint returns claims only for valid,
    // unexpired tokens issued to a client of this project.
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    let googleRes;
    try {
      googleRes = await fetch(verifyUrl, { signal: AbortSignal.timeout(5000) });
    } catch (fetchErr) {
      console.error('[ERROR] Google tokeninfo unreachable:', fetchErr.name);
      return res.status(503).json({
        success: false,
        message: 'No se pudo verificar con Google. Probá de nuevo'
      });
    }
    if (!googleRes.ok) return invalidGoogleToken(`tokeninfo_http_${googleRes.status}`);
    const claims = await googleRes.json();
    // Nonce anti-replay: the token must carry the exact nonce this server
    // issued (consumed above), otherwise a captured token could be replayed.
    if (claims.iss !== 'accounts.google.com' && claims.iss !== 'https://accounts.google.com') {
      return invalidGoogleToken('iss_mismatch');
    }
    if (claims.aud !== GOOGLE_CLIENT_ID) return invalidGoogleToken('aud_mismatch');
    if (String(claims.email_verified).toLowerCase() !== 'true' || !claims.email) {
      return invalidGoogleToken('email_not_verified');
    }
    if (String(claims.nonce || '') !== nonce) return invalidGoogleToken('nonce_claim_mismatch');

    const email = String(claims.email).trim().toLowerCase();
    const fallbackNombre = email.split('@')[0] || 'Usuario';
    const nombre = String(claims.name || fallbackNombre).trim().slice(0, 60);
    const nombreFinal = nombre.length >= 2 ? nombre : 'Usuario';

    // Upsert + pre-hijacking protection (see google-link.js): an unverified
    // existing account has its old password killed and sessions revoked
    // before Google marks it verified; new accounts are created verified.
    const { user } = await linkGoogleIdentity(
      pool,
      { email, nombre: nombreFinal },
      { bcryptRounds: BCRYPT_ROUNDS }
    );

    const { token, refreshToken } = await issueSession(user, req);

    return res.json({
      success: true,
      message: 'Inicio de sesión con Google exitoso',
      token,
      refreshToken,
      user: publicUser(user)
    });
  } catch (err) {
    console.error('[ERROR] Google login:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al iniciar sesión con Google'
    });
  }
});

// ==========================================
// PASSWORD RESET (6-digit code sent by email)
// ==========================================

const RESET_CODE_TTL_MINUTES = positiveIntEnv('RESET_CODE_TTL_MINUTES', 15);
const RESET_MAX_ATTEMPTS = 5;
const FORGOT_PER_EMAIL_MAX = 3; // reset requests per account per hour
const FORGOT_MIN_RESPONSE_MS = 300; // pads fast paths so timing does not reveal accounts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Dedicated key derived from JWT_SECRET so the code HMAC is domain-separated.
const RESET_HMAC_KEY = crypto.createHmac('sha256', JWT_SECRET).update('password-reset').digest();
const hashResetCode = (code) => crypto.createHmac('sha256', RESET_HMAC_KEY).update(code).digest('hex');
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FORGOT_GENERIC_MESSAGE =
  'Si el correo está registrado, te enviamos un código para restablecer tu contraseña';
const RESET_INVALID_MESSAGE = 'Código inválido o vencido';

// POST /auth/forgot-password - Body: { email }. Always answers the same 200.
app.post('/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const startedAt = Date.now();
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  try {
    if (email && email.length <= 255 && EMAIL_RE.test(email)) {
      const { row: user } = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
      if (user) {
        // Per-account budget (counts used/invalidated rows too). Beyond it we
        // silently stop sending but still return the generic answer.
        const recent = await queryOne(
          `SELECT COUNT(*)::int AS n FROM password_resets
           WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
          [user.id]
        );
        if (recent.row.n < FORGOT_PER_EMAIL_MAX) {
          const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await client.query(
              'UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
              [user.id]
            );
            await client.query(
              `INSERT INTO password_resets (user_id, code_hash, expires_at)
               VALUES ($1, $2, now() + make_interval(mins => $3))`,
              [user.id, hashResetCode(code), RESET_CODE_TTL_MINUTES]
            );
            await client.query('COMMIT');
          } catch (txErr) {
            await client.query('ROLLBACK').catch(() => {});
            throw txErr;
          } finally {
            client.release();
          }
          // Not awaited: SMTP latency must not reveal that the account exists.
          mailer.sendPasswordResetCode(email, code, RESET_CODE_TTL_MINUTES).catch(() => {});
        }
      }
    }
  } catch (err) {
    // Swallow: an error here must not differ from the generic answer.
    console.error('[ERROR] Forgot password:', err.message);
  }
  const elapsed = Date.now() - startedAt;
  if (elapsed < FORGOT_MIN_RESPONSE_MS) await sleepMs(FORGOT_MIN_RESPONSE_MS - elapsed);
  return res.json({ success: true, message: FORGOT_GENERIC_MESSAGE });
});

// POST /auth/reset-password - Body: { email, code, newPassword }.
app.post('/auth/reset-password', resetPasswordLimiter, async (req, res) => {
  const invalid = () => res.status(400).json({ success: false, message: RESET_INVALID_MESSAGE });
  let client;
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!EMAIL_RE.test(email) || email.length > 255 || !/^\d{6}$/.test(code)) return invalid();
    // Same policy as register. Checked before the code so a typo in the new
    // password does not burn one of the code's attempts.
    const passwordError = validateNewPassword(newPassword, email);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const { row: user } = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (!user) return invalid();

    // Atomically spend one attempt on the latest live reset; concurrent
    // guesses cannot exceed RESET_MAX_ATTEMPTS in total.
    const claimed = await queryOne(
      `UPDATE password_resets SET attempts = attempts + 1
       WHERE id = (
         SELECT id FROM password_resets
         WHERE user_id = $1 AND used_at IS NULL AND expires_at > now() AND attempts < $2
         ORDER BY created_at DESC LIMIT 1
       ) AND used_at IS NULL AND attempts < $2
       RETURNING id, code_hash, attempts`,
      [user.id, RESET_MAX_ATTEMPTS]
    );
    const reset = claimed.row;
    if (!reset) return invalid();

    const expected = Buffer.from(reset.code_hash, 'hex');
    const presented = Buffer.from(hashResetCode(code), 'hex');
    const codeOk = expected.length === presented.length && crypto.timingSafeEqual(expected, presented);
    if (!codeOk) {
      if (reset.attempts >= RESET_MAX_ATTEMPTS) {
        await query('UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL', [reset.id]);
      }
      return invalid();
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    client = await pool.connect();
    await client.query('BEGIN');
    const burned = await client.query(
      'UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id',
      [reset.id]
    );
    if (burned.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return invalid();
    }
    await client.query(
      // A valid reset code proves control of the mailbox, so it also verifies the email.
      `UPDATE users SET password_hash = $1, actualizado_en = CURRENT_TIMESTAMP,
              email_verified_at = COALESCE(email_verified_at, now())
       WHERE id = $2`,
      [passwordHash, user.id]
    );
    await client.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
    await client.query('DELETE FROM login_attempts WHERE key = $1', [accountKey(email)]);
    await client.query('COMMIT');
    client.release();
    client = null;

    // Best-effort notification; never fails the request.
    mailer.sendPasswordChangedNotice(email).catch(() => {});

    return res.json({ success: true, message: 'Contraseña actualizada. Ya podés iniciar sesión' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    console.error('[ERROR] Reset password:', err.message);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// POST /auth/verify-email/send - (Re)send a verification code to the
// authenticated user. Always the same 200 once past the per-IP limiter; beyond
// VERIFY_SENDS_PER_HOUR codes per account it silently stops sending.
app.post('/auth/verify-email/send', authenticateToken, verifySendLimiter, async (req, res) => {
  try {
    const { row: user } = await queryOne(
      'SELECT id, email, email_verified_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (user.email_verified_at) {
      return res.json({ success: true, already_verified: true, message: 'Tu correo ya está verificado' });
    }
    const recent = await queryOne(
      `SELECT COUNT(*)::int AS n FROM email_verifications
       WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
      [user.id]
    );
    if (recent.row.n < VERIFY_SENDS_PER_HOUR) {
      // Not awaited: SMTP latency must not hold the response.
      issueEmailVerification(user.id, user.email).catch((err) =>
        console.error('[ERROR] Verify email send:', err.message)
      );
    }
    return res.json({ success: true, message: 'Si corresponde, te enviamos un código a tu correo' });
  } catch (err) {
    console.error('[ERROR] Verify email send:', err.message);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// POST /auth/verify-email - Body: { code }. Same burn-after-5-attempts policy
// as password reset; every failure is the same generic 400.
app.post('/auth/verify-email', authenticateToken, verifyEmailLimiter, async (req, res) => {
  const invalid = () => res.status(400).json({ success: false, message: EMAIL_VERIFY_INVALID_MESSAGE });
  let client;
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) return invalid();

    // Spend one attempt atomically BEFORE comparing, so concurrent guesses
    // cannot exceed EMAIL_CODE_MAX_ATTEMPTS in total.
    const claimed = await queryOne(
      `UPDATE email_verifications SET attempts = attempts + 1
       WHERE id = (
         SELECT id FROM email_verifications
         WHERE user_id = $1 AND used_at IS NULL AND expires_at > now() AND attempts < $2
         ORDER BY created_at DESC LIMIT 1
       ) AND used_at IS NULL AND attempts < $2
       RETURNING id, code_hash, attempts`,
      [req.user.id, EMAIL_CODE_MAX_ATTEMPTS]
    );
    const verification = claimed.row;
    if (!verification) return invalid();

    const expected = Buffer.from(verification.code_hash, 'hex');
    const presented = Buffer.from(hashVerifyCode(code), 'hex');
    const codeOk = expected.length === presented.length && crypto.timingSafeEqual(expected, presented);
    if (!codeOk) {
      if (verification.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
        await query('UPDATE email_verifications SET used_at = now() WHERE id = $1 AND used_at IS NULL', [verification.id]);
      }
      return invalid();
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const burned = await client.query(
      'UPDATE email_verifications SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id',
      [verification.id]
    );
    if (burned.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return invalid();
    }
    await client.query(
      'UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1',
      [req.user.id]
    );
    await client.query('COMMIT');
    client.release();
    client = null;

    return res.json({ success: true, message: 'Correo verificado', email_verified: true });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    console.error('[ERROR] Verify email:', err.message);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// POST /auth/refresh - Rotate a refresh token for a new access/refresh pair.
// Body: { refreshToken }. Reuse of a retired token revokes the whole family.
app.post('/auth/refresh', refreshLimiter, async (req, res) => {
  const invalid = () => res.status(401).json({
    success: false,
    code: 'session_invalid',
    message: 'Sesión inválida'
  });
  const presented = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
  if (!presented || presented.length > 200) return invalid();

  let client;
  try {
    const found = await queryOne(
      `SELECT id, user_id, family_id, revoked_at,
              expires_at <= now() AS absolute_expired,
              last_used_at <= now() - make_interval(secs => $2) AS idle_expired
       FROM sessions WHERE refresh_token_hash = $1`,
      [sha256Hex(presented), SESSION_IDLE_SECONDS]
    );
    const session = found.row;
    if (!session) return invalid();

    // Reuse of an already revoked/rotated token: assume theft, kill the family.
    if (session.revoked_at) {
      await revokeFamily(session.family_id);
      return invalid();
    }
    if (session.absolute_expired || session.idle_expired) {
      await query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [session.id]);
      return invalid();
    }

    const newSessionId = crypto.randomUUID();
    const nextRefreshToken = generateRefreshToken();
    client = await pool.connect();
    await client.query('BEGIN');
    // Atomic claim: only one concurrent request can retire this row.
    const claimed = await client.query(
      `UPDATE sessions SET revoked_at = now(), replaced_by = $2
       WHERE id = $1 AND revoked_at IS NULL RETURNING id`,
      [session.id, newSessionId]
    );
    if (claimed.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      await revokeFamily(session.family_id);
      return invalid();
    }
    await insertSession(client, {
      id: newSessionId,
      userId: session.user_id,
      familyId: session.family_id,
      refreshToken: nextRefreshToken,
      req
    });
    await client.query('COMMIT');
    client.release();
    client = null;

    return res.json({
      success: true,
      token: signAccessToken(session.user_id, newSessionId),
      refreshToken: nextRefreshToken,
      expiresIn: ACCESS_TTL_SECONDS
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    console.error('[ERROR] Refresh:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// POST /auth/logout - Cerrar sesión (revokes the current session)
app.post('/auth/logout', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [req.sessionId]);
    return res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  } catch (err) {
    console.error('[ERROR] Logout:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// POST /auth/logout-all - Revoke every active session of the user
app.post('/auth/logout-all', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [req.user.id]);
    return res.json({
      success: true,
      message: 'Todas las sesiones fueron cerradas exitosamente'
    });
  } catch (err) {
    console.error('[ERROR] Logout all:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// GET /auth/me - Devuelve el usuario autenticado (requiere JWT)
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await queryOne(
      `SELECT id, email, nombre, telefono, genero, creado_en, terms_accepted_at, terms_version,
              (email_verified_at IS NOT NULL) AS email_verified
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!userResult.row) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    return res.json({ success: true, user: userResult.row });
  } catch (err) {
    console.error('[ERROR] Auth ME:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// POST /auth/terms-accept - Registra la aceptación legal de términos en la BD.
// El cliente la sube una vez tras el primer login posterior al onboarding
// (donde se aceptó localmente). La copia del dispositivo es solo caché de UX;
// este registro es la prueba duradera de aceptación con fecha y versión.
app.post('/auth/terms-accept', authenticateToken, async (req, res) => {
  try {
    const version = typeof req.body?.version === 'string' ? req.body.version.trim() : TERMS_VERSION;
    if (version !== TERMS_VERSION) {
      return res.status(400).json({
        success: false,
        message: 'Versión de términos inválida'
      });
    }
    const updated = await queryOne(
      'UPDATE users SET terms_accepted_at = CURRENT_TIMESTAMP, terms_version = $1 WHERE id = $2 RETURNING terms_accepted_at, terms_version',
      [version, req.user.id]
    );
    if (!updated.row) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    return res.json({
      success: true,
      message: 'Aceptación de términos registrada',
      terms_accepted_at: updated.row.terms_accepted_at,
      terms_version: updated.row.terms_version
    });
  } catch (err) {
    console.error('[ERROR] Terms accept:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// PUT /auth/profile - Actualizar perfil del usuario autenticado (nombre, telefono, genero)
app.put('/auth/profile', authenticateToken, async (req, res) => {
  const { nombre, telefono, genero } = req.body || {};

  try {
    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || nombre.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El nombre debe tener al menos 2 caracteres'
        });
      }
    }

    if (telefono !== undefined) {
      const digits = String(telefono ?? '').replace(/\D/g, '');
      if (digits.length !== 0 && (digits.length < 7 || digits.length > 12)) {
        return res.status(400).json({
          success: false,
          message: 'Teléfono inválido: debe tener entre 7 y 12 dígitos'
        });
      }
    }

    if (genero !== undefined) {
      const g = String(genero).trim().toLowerCase();
      if (!['hombre', 'mujer', ''].includes(g)) {
        return res.status(400).json({
          success: false,
          message: 'Género inválido'
        });
      }
    }

    const updates = [];
    const values = [];
    if (nombre !== undefined) {
      values.push(nombre.trim());
      updates.push(`nombre = $${values.length}`);
    }
    if (telefono !== undefined) {
      const t = String(telefono ?? '').trim();
      values.push(t === '' ? null : t);
      updates.push(`telefono = $${values.length}`);
    }
    if (genero !== undefined) {
      values.push(String(genero).trim().toLowerCase());
      updates.push(`genero = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    updates.push('actualizado_en = CURRENT_TIMESTAMP');
    values.push(req.user.id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values);

    const userResult = await queryOne(
      'SELECT id, email, nombre, telefono, genero, (email_verified_at IS NOT NULL) AS email_verified FROM users WHERE id = $1',
      [req.user.id]
    );
    return res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: userResult.row
    });
  } catch (err) {
    console.error('[ERROR] Profile PUT:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al actualizar el perfil'
    });
  }
});

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN JWT
// ==========================================

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  const reject = (code, message) => res.status(401).json({ success: false, code, message });

  if (!token) return reject('session_invalid', 'Token no proporcionado');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
  } catch (err) {
    // An expired but validly signed token is recoverable via /auth/refresh.
    if (err && err.name === 'TokenExpiredError') return reject('token_expired', 'Token expirado');
    return reject('session_invalid', 'Token inválido');
  }

  const userId = Number(payload.sub);
  const sid = payload.sid;
  if (!Number.isInteger(userId) || typeof sid !== 'string' || !UUID_RE.test(sid)) {
    return reject('session_invalid', 'Token inválido');
  }

  try {
    // One atomic statement: the session must be live, within both the absolute
    // and idle windows, and its user must still exist; activity is recorded.
    const touched = await queryOne(
      `UPDATE sessions SET last_used_at = now()
       WHERE id = $1 AND user_id = $2
         AND revoked_at IS NULL
         AND expires_at > now()
         AND last_used_at > now() - make_interval(secs => $3)
         AND EXISTS (SELECT 1 FROM users WHERE id = $2)
       RETURNING id`,
      [sid, userId, SESSION_IDLE_SECONDS]
    );
    if (!touched.row) {
      // Retire the session if it simply went idle, so it cannot be refreshed.
      await query(
        `UPDATE sessions SET revoked_at = now()
         WHERE id = $1 AND revoked_at IS NULL
           AND last_used_at <= now() - make_interval(secs => $2)`,
        [sid, SESSION_IDLE_SECONDS]
      );
      return reject('session_invalid', 'Sesión inválida o expirada');
    }
  } catch (err) {
    console.error('[ERROR] Auth middleware:', err.message);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }

  req.user = { id: userId };
  req.sessionId = sid;
  return next();
}

// ==========================================
// FASES 2-6: ENDPOINTS PREPARADOS (Servicios, Citas, Dashboard)
// ==========================================

// GET /health - Health check
app.get('/health', (req, res) => {
  return res.json({
    success: true,
    status: 'ok',
    message: 'BloomApp API funcionando'
  });
});

// GET /services - Listar servicios (catálogo)
// Fase 3+: Devuelve lista de servicios disponibles
app.get('/services', authenticateToken, async (req, res) => {
  try {
    const services = await queryMany(`
      SELECT id, nombre, descripcion, precio, duracion_minutos, categoria, activo
      FROM services WHERE activo = TRUE
    `);
    return res.json({
      success: true,
      services
    });
  } catch (err) {
    console.error('[ERROR] Services GET:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// GET /services/:id - Obtener servicio específico
app.get('/services/:id', authenticateToken, async (req, res) => {
  try {
    // SQLite comparaba el id textual sin error; en PostgreSQL un id no numérico
    // lanzaría un error de cast, así que se resuelve como "no encontrado" (404).
    const serviceId = Number(req.params.id);
    if (!Number.isInteger(serviceId)) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado'
      });
    }

    const serviceResult = await queryOne(`
      SELECT id, nombre, descripcion, precio, duracion_minutos, categoria, activo
      FROM services WHERE id = $1 AND activo = TRUE
    `, [serviceId]);
    const service = serviceResult.row;

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado'
      });
    }
    return res.json({ success: true, service });
  } catch (err) {
    console.error('[ERROR] Services GET:id:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// GET /appointments - Listar citas del usuario (Fase 3+)
// Protegido: requiere JWT token en header
app.get('/appointments', authenticateToken, async (req, res) => {
  try {
    const appointments = await queryMany(`
      SELECT a.id, a.fecha_hora, a.estado, a.motivo_cancelacion,
             s.nombre AS servicio_nombre, s.precio AS servicio_precio, s.duracion_minutos AS servicio_duracion
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.user_id = $1
      ORDER BY a.fecha_hora DESC
    `, [req.user.id]);

    return res.json({
      success: true,
      appointments
    });
  } catch (err) {
    console.error('[ERROR] Appointments GET:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

const MAX_ACTIVE_APPOINTMENTS = positiveIntEnv('MAX_ACTIVE_APPOINTMENTS', 5);

// POST /appointments - Crear nueva cita (Fase 3+)
// Body: { service_id, fecha_hora }
// Optional gate (REQUIRE_EMAIL_VERIFICATION=true): only creating bookings needs
// a verified email; changing/cancelling existing ones stays allowed.
async function requireVerifiedEmail(req, res, next) {
  if (!REQUIRE_EMAIL_VERIFICATION) return next();
  try {
    const { row } = await queryOne('SELECT email_verified_at FROM users WHERE id = $1', [req.user.id]);
    if (row && row.email_verified_at) return next();
    return res.status(403).json({
      success: false,
      code: 'email_unverified',
      message: 'Verificá tu correo para agendar citas'
    });
  } catch (err) {
    console.error('[ERROR] Email verification gate:', err.message);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
}

app.post('/appointments', authenticateToken, requireVerifiedEmail, appointmentWriteLimiter, async (req, res) => {
  const { service_id, fecha_hora } = req.body;

  if (!service_id || !fecha_hora) {
    return res.status(400).json({
      success: false,
      message: 'service_id y fecha_hora son obligatorios'
    });
  }

  // fecha_hora must parse as a real date strictly in the future.
  const slotDate = new Date(fecha_hora);
  if (Number.isNaN(slotDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'fecha_hora inválida'
    });
  }
  if (slotDate.getTime() <= Date.now()) {
    return res.status(400).json({
      success: false,
      message: 'La fecha debe ser futura'
    });
  }

  try {
    // SQLite comparaba service_id sin error; en PostgreSQL un valor no entero
    // lanzaría un error de cast, así que se resuelve como "no encontrado" (404).
    const serviceId = Number(service_id);
    if (!Number.isInteger(serviceId)) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado o inactivo'
      });
    }

    // Verificar que el servicio existe y está activo
    const serviceResult = await queryOne(
      'SELECT id, nombre, precio, duracion_minutos FROM services WHERE id = $1 AND activo = TRUE',
      [serviceId]
    );
    const service = serviceResult.row;

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Servicio no encontrado o inactivo'
      });
    }

    // Cap on active future bookings per user
    const activeCount = await queryOne(
      "SELECT COUNT(*)::int AS n FROM appointments WHERE user_id = $1 AND estado = 'booked' AND fecha_hora > now()",
      [req.user.id]
    );
    if (activeCount.row.n >= MAX_ACTIVE_APPOINTMENTS) {
      return res.status(409).json({
        success: false,
        message: `Alcanzaste el máximo de ${MAX_ACTIVE_APPOINTMENTS} citas activas. Cancelá una para agendar otra`
      });
    }

    // Verificar cita duplicada: mismo usuario, servicio y horario activo
    const existingSlotResult = await queryOne(
      "SELECT id FROM appointments WHERE user_id = $1 AND service_id = $2 AND fecha_hora = $3 AND estado = 'booked'",
      [req.user.id, serviceId, fecha_hora]
    );

    if (existingSlotResult.row) {
      return res.status(409).json({
        success: false,
        message: 'Ya tienes una cita para ese servicio en ese horario'
      });
    }

    // Insertar cita con estado 'booked'
    const insertResult = await query(
      "INSERT INTO appointments (user_id, service_id, fecha_hora, estado) VALUES ($1, $2, $3, 'booked') RETURNING id",
      [req.user.id, serviceId, fecha_hora]
    );
    const newAppointmentId = Number(insertResult.rows[0].id);

    // Obtener cita con detalles del servicio
    const appointmentResult = await queryOne(`
      SELECT a.id, a.fecha_hora, a.estado, a.motivo_cancelacion,
             s.nombre AS servicio_nombre, s.precio AS servicio_precio, s.duracion_minutos AS servicio_duracion
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.id = $1
    `, [newAppointmentId]);
    const appointment = appointmentResult.row;

    return res.status(201).json({
      success: true,
      appointment,
      message: 'Cita agendada exitosamente'
    });
  } catch (err) {
    console.error('[ERROR] Appointments POST:', err.message);
    // Unique partial index (ux_appointments_active_slot) rejected the insert:
    // someone already holds an active booking for that slot.
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Ese horario ya está reservado'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al agendar cita'
    });
  }
});

// PUT /appointments/:id - Actualizar/cancelar cita (Fase 3+)
// Body: { nuevo_fecha_hora, motivo_cancelacion }
app.put('/appointments/:id', authenticateToken, appointmentWriteLimiter, async (req, res) => {
  const { id } = req.params;
  const { nuevo_fecha_hora, motivo_cancelacion } = req.body || {};

  // Validate inputs first (same rules as POST for the date).
  let newDate = null;
  if (nuevo_fecha_hora !== undefined && nuevo_fecha_hora !== null && nuevo_fecha_hora !== '') {
    const parsed = new Date(nuevo_fecha_hora);
    if (typeof nuevo_fecha_hora !== 'string' || Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ success: false, message: 'fecha_hora inválida' });
    }
    if (parsed.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'La fecha debe ser futura' });
    }
    newDate = nuevo_fecha_hora;
  }
  let motivo = null;
  if (motivo_cancelacion !== undefined && motivo_cancelacion !== null) {
    motivo = typeof motivo_cancelacion === 'string' ? motivo_cancelacion.trim() : '';
    if (motivo.length < 1 || motivo.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'El motivo de cancelación debe tener entre 1 y 500 caracteres'
      });
    }
  }

  try {
    // SQLite comparaba el id textual sin error; en PostgreSQL un id no numérico
    // lanzaría un error de cast, así que se resuelve como "no encontrada" (404).
    const appointmentId = Number(id);
    if (!Number.isInteger(appointmentId)) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    // Verificar que la cita existe y pertenece al usuario
    const existingResult = await queryOne(
      'SELECT * FROM appointments WHERE id = $1 AND user_id = $2',
      [appointmentId, req.user.id]
    );
    const existing = existingResult.row;

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    const alreadyClosed = () => res.status(409).json({
      success: false,
      message: 'La cita ya fue cancelada'
    });
    if (existing.estado !== 'booked') return alreadyClosed();

    if (newDate === null && motivo === null) {
      return res.json({
        success: true,
        appointment: existing,
        message: 'Cita actualizada exitosamente'
      });
    }

    // One atomic statement: date change and cancellation apply together or not
    // at all. The estado guard also protects against a concurrent cancellation.
    const updatedResult = await queryOne(
      `UPDATE appointments SET
         fecha_hora = COALESCE($1::timestamp, fecha_hora),
         estado = CASE WHEN $2::text IS NOT NULL THEN 'cancelled' ELSE estado END,
         motivo_cancelacion = COALESCE($2::text, motivo_cancelacion),
         actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4 AND estado = 'booked'
       RETURNING *`,
      [newDate, motivo, appointmentId, req.user.id]
    );
    if (!updatedResult.row) return alreadyClosed();

    return res.json({
      success: true,
      appointment: updatedResult.row,
      message: 'Cita actualizada exitosamente'
    });
  } catch (err) {
    console.error('[ERROR] Appointments PUT:', err.message);
    // Unique partial index rejected the new slot: already actively booked.
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Ese horario ya está reservado'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

// Keeps every unhandled error inside the JSON contract and prevents the
// Express default dev-mode handler from leaking stack traces as HTML.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const isParseError = err.type === 'entity.parse.failed' || err instanceof SyntaxError;
  const status = isParseError ? 400 : (err.status || err.statusCode || 500);
  if (status >= 500) console.error('[ERROR] Unhandled:', err.message);
  return res.status(status).json({
    success: false,
    message: status < 500 ? 'Solicitud inválida' : 'Error en el servidor'
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`=== BloomApp Server Iniciado ===`);
  console.log(`Puerto: ${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================`);
  console.log('Rutas disponibles:');
  console.log('  POST /auth/register  - Registrar usuario (Fase 1)');
  console.log('  POST /auth/login     - Iniciar sesión (Fase 1)');
  console.log('  POST /auth/forgot-password - Pedir código de recuperación');
  console.log('  POST /auth/reset-password  - Cambiar contraseña con código');
  console.log('  POST /auth/verify-email[/send] - Verificar correo (requiere JWT)');
  console.log('  POST /auth/refresh   - Renovar sesión (refresh token)');
  console.log('  POST /auth/logout    - Cerrar sesión (requiere JWT)');
  console.log('  POST /auth/logout-all - Cerrar todas las sesiones (requiere JWT)');
  console.log('  POST /auth/terms-accept - Registrar aceptación de términos (requiere JWT)');
  console.log('  GET /auth/google/nonce - Nonce de un solo uso para Google');
  console.log('  GET /health          - Verificar estado');
  console.log('  GET /services        - Listar servicios (Fase 3+)');
  console.log('  GET /appointments    - Ver mis citas (Fase 3+, requiere JWT)');
  console.log('  POST /appointments   - Agendar cita (Fase 3+, requiere JWT)');
  console.log('  PUT /appointments/:id- Actualizar cita (Fase 3+, requiere JWT)');
});
