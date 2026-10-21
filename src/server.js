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
const { query, queryOne, queryMany } = require('./db.js');

// Crea/verifica tablas y garantiza el catálogo de servicios en cada arranque (idempotente)
require('./init-db.js');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT secret discipline: refuse to boot in production without a configured
// secret; keep the insecure fallback only for local development.
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_DEV_FALLBACK = 'bloomapp-super-secret-key-change-in-production-32chars';
if (!JWT_SECRET) {
  if (NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET env var is required in production');
    process.exit(1);
  }
  console.warn('[WARN] JWT_SECRET not set; using insecure development fallback');
}

// Google sign-in (optional at boot): the endpoint degrades to 503 when the
// client ID is not configured instead of taking the whole API down.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
if (!GOOGLE_CLIENT_ID) {
  console.warn('[WARN] GOOGLE_CLIENT_ID not set; Google sign-in disabled');
}

// Middlewares
// Security headers (no HTML is served; CSP defaults are harmless for the API).
app.use(helmet());
// CORS: native/mobile clients send no Origin header and are always allowed.
// Browser origins are restricted once CLIENT_ORIGIN=https://... is configured
// (comma-separated allowlist); unset keeps current open behavior.
app.use(cors({
  origin(origin, cb) {
    const allowed = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '10kb' }));

// Rate limiting: strict on login (brute force) and register (spam accounts),
// lighter on the rest of the API. /auth/me and /auth/profile are NOT limited
// here (they are normal app traffic) - they ride the general api limiter.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
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
const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos con Google. Probá de nuevo en 15 minutos' }
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
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar si el usuario ya existe
    const existingResult = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existingResult.row) {
      return res.status(409).json({
        success: false,
        message: 'El correo ya está registrado'
      });
    }

    // Hashear contraseña
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const passwordHash = bcrypt.hashSync(password, saltRounds);

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

    // Generar JWT token
    const token = jwt.sign({ id: newUserId, email }, JWT_SECRET || JWT_DEV_FALLBACK, { expiresIn: '24h' });

    return res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: { id: newUserId, nombre, email, telefono, genero: generoNormalizado }
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

    // Buscar usuario
    const userResult = await queryOne('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.row;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET || JWT_DEV_FALLBACK, { expiresIn: '24h' });

    // Responder sin password_hash
    const { password_hash, ...userWithoutPassword } = user;

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error('[ERROR] Login:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al iniciar sesión'
    });
  }
});

// POST /auth/google - Exchange a Google ID token for a BloomApp session
// Body: { idToken }. Verification runs against Google's tokeninfo endpoint
// and the aud claim must match GOOGLE_CLIENT_ID. Users are upserted by email;
// existing accounts keep their regular password login behavior.
app.post('/auth/google', googleLimiter, async (req, res) => {
  try {
    const idToken = typeof req.body.idToken === 'string' ? req.body.idToken.trim() : '';
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'idToken es obligatorio'
      });
    }
    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false,
        message: 'Login con Google no está configurado'
      });
    }

    // Verify with Google: the endpoint returns claims only for valid,
    // unexpired tokens issued to a client of this project.
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const googleRes = await fetch(verifyUrl);
    if (!googleRes.ok) {
      return res.status(401).json({
        success: false,
        message: 'Token de Google inválido'
      });
    }
    const claims = await googleRes.json();
    if (
      claims.aud !== GOOGLE_CLIENT_ID ||
      String(claims.email_verified).toLowerCase() !== 'true' ||
      !claims.email
    ) {
      return res.status(401).json({
        success: false,
        message: 'Token de Google inválido'
      });
    }

    const email = String(claims.email).trim().toLowerCase();
    const fallbackNombre = email.split('@')[0] || 'Usuario';
    const nombre = String(claims.name || fallbackNombre).trim().slice(0, 60);
    const nombreFinal = nombre.length >= 2 ? nombre : 'Usuario';

    const existingResult = await queryOne('SELECT * FROM users WHERE email = $1', [email]);
    let user;
    if (existingResult.row) {
      user = existingResult.row;
    } else {
      // Store an unguessable random hash so Google-only accounts can never be
      // logged into with a password guess (there is no password to recover).
      const opaque = crypto.randomBytes(32).toString('hex');
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
      const passwordHash = bcrypt.hashSync(opaque, saltRounds);
      const insertResult = await query(
        "INSERT INTO users (nombre, email, password_hash, telefono, genero) VALUES ($1, $2, $3, NULL, '') RETURNING *",
        [nombreFinal, email, passwordHash]
      );
      user = insertResult.rows[0];
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET || JWT_DEV_FALLBACK, { expiresIn: '24h' });

    // Responder sin password_hash
    const { password_hash, ...userWithoutPassword } = user;

    return res.json({
      success: true,
      message: 'Inicio de sesión con Google exitoso',
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error('[ERROR] Google login:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al iniciar sesión con Google'
    });
  }
});

// POST /auth/logout - Cerrar sesión
app.post('/auth/logout', (req, res) => {
  return res.json({
    success: true,
    message: 'Sesión cerrada exitosamente'
  });
});

// GET /auth/me - Devuelve el usuario autenticado (requiere JWT)
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await queryOne(
      'SELECT id, email, nombre, telefono, genero FROM users WHERE id = $1',
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
      'SELECT id, email, nombre, telefono, genero FROM users WHERE id = $1',
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

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token no proporcionado'
    });
  }

  jwt.verify(token, JWT_SECRET || JWT_DEV_FALLBACK, { algorithms: ['HS256'] }, (err, user) => {
    if (err) return res.status(403).json({
      success: false,
      message: 'Token inválido'
    });
    req.user = user;
    next();
  });
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

// POST /appointments - Crear nueva cita (Fase 3+)
// Body: { service_id, fecha_hora }
app.post('/appointments', authenticateToken, async (req, res) => {
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
app.put('/appointments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { nuevo_fecha_hora, motivo_cancelacion } = req.body;

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

    // Si se proporciona nueva fecha, actualizar
    if (nuevo_fecha_hora) {
      await query(
        'UPDATE appointments SET fecha_hora = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2',
        [nuevo_fecha_hora, appointmentId]
      );
    }

    // Si se proporciona motivo de cancelación, marcar como cancelada
    if (motivo_cancelacion) {
      await query(
        'UPDATE appointments SET estado = $1, motivo_cancelacion = $2, actualizado_en = CURRENT_TIMESTAMP WHERE id = $3',
        ['cancelled', motivo_cancelacion, appointmentId]
      );
    }

    const updatedResult = await queryOne('SELECT * FROM appointments WHERE id = $1', [appointmentId]);

    return res.json({
      success: true,
      appointment: updatedResult.row,
      message: 'Cita actualizada exitosamente'
    });
  } catch (err) {
    console.error('[ERROR] Appointments PUT:', err.message);
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
  console.log('  POST /auth/logout    - Cerrar sesión');
  console.log('  GET /health          - Verificar estado');
  console.log('  GET /services        - Listar servicios (Fase 3+)');
  console.log('  GET /appointments    - Ver mis citas (Fase 3+, requiere JWT)');
  console.log('  POST /appointments   - Agendar cita (Fase 3+, requiere JWT)');
  console.log('  PUT /appointments/:id- Actualizar cita (Fase 3+, requiere JWT)');
});
