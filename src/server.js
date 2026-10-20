// BloomApp Backend Server - Fase 1: Login y Autenticación
// Arquitectura preparada para phases 2-6 (servicios, citas, dashboard)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db.js');

// Crea/verifica tablas y garantiza el catálogo de servicios en cada arranque (idempotente)
require('./init-db.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// ==========================================
// FASE 1: AUTENTICACIÓN (Login/Registro)
// ==========================================

// POST /auth/register - Registrar nuevo cliente
app.post('/auth/register', (req, res) => {
  try {
    const { nombre, email, password, telefono } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre, correo y contraseña son obligatorios' 
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'El correo ya está registrado' 
      });
    }

    // Hashear contraseña
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const passwordHash = bcrypt.hashSync(password, saltRounds);

    // Insertar usuario
    const stmt = db.prepare(
      'INSERT INTO users (nombre, email, password_hash, telefono) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(nombre, email, passwordHash, telefono || null);

    // Generar JWT token
    const jwtSecret = process.env.JWT_SECRET || 'bloomapp-super-secret-key-change-in-production-32chars';
    const token = jwt.sign({ id: Number(result.lastInsertRowid), email }, jwtSecret, { expiresIn: '24h' });

    return res.status(201).json({ 
      success: true, 
      message: 'Usuario registrado exitosamente',
      token,
      user: { id: Number(result.lastInsertRowid), nombre, email, telefono }
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
app.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Correo y contraseña son obligatorios' 
      });
    }

    // Buscar usuario
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

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
    const jwtSecret = process.env.JWT_SECRET || 'bloomapp-super-secret-key-change-in-production-32chars';
    const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '24h' });

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

// POST /auth/logout - Cerrar sesión
app.post('/auth/logout', (req, res) => {
  return res.json({ 
    success: true, 
    message: 'Sesión cerrada exitosamente' 
  });
});

// GET /auth/me - Devuelve el usuario autenticado (requiere JWT)
app.get('/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, nombre, telefono FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    return res.json({ success: true, user });
  } catch (err) {
    console.error('[ERROR] Auth ME:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
});

// PUT /auth/profile - Actualizar perfil del usuario autenticado (nombre, telefono)
app.put('/auth/profile', authenticateToken, (req, res) => {
  const { nombre, telefono } = req.body || {};

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

    const updates = [];
    const values = [];
    if (nombre !== undefined) {
      updates.push('nombre = ?');
      values.push(nombre.trim());
    }
    if (telefono !== undefined) {
      updates.push('telefono = ?');
      const t = String(telefono ?? '').trim();
      values.push(t === '' ? null : t);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    updates.push('actualizado_en = CURRENT_TIMESTAMP');
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values, req.user.id);

    const user = db.prepare('SELECT id, email, nombre, telefono FROM users WHERE id = ?').get(req.user.id);
    return res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user
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

  jwt.verify(token, process.env.JWT_SECRET || 'bloomapp-super-secret-key-change-in-production-32chars', (err, user) => {
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
app.get('/services', authenticateToken, (req, res) => {
  try {
    const services = db.prepare(`
      SELECT id, nombre, descripcion, precio, duracion_minutos, categoria, activo 
      FROM services WHERE activo = 1
    `).all();
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
app.get('/services/:id', authenticateToken, (req, res) => {
  try {
    const service = db.prepare(`
      SELECT id, nombre, descripcion, precio, duracion_minutos, categoria, activo 
      FROM services WHERE id = ? AND activo = 1
    `).get(req.params.id);

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
app.get('/appointments', authenticateToken, (req, res) => {
  try {
    const appointments = db.prepare(`
      SELECT a.id, a.fecha_hora, a.estado, a.motivo_cancelacion,
             s.nombre AS servicio_nombre, s.precio AS servicio_precio, s.duracion_minutos AS servicio_duracion
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.user_id = ?
      ORDER BY a.fecha_hora DESC
    `).all(req.user.id);

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
app.post('/appointments', authenticateToken, (req, res) => {
  const { service_id, fecha_hora } = req.body;

  if (!service_id || !fecha_hora) {
    return res.status(400).json({ 
      success: false, 
      message: 'service_id y fecha_hora son obligatorios' 
    });
  }

  try {
    // Verificar que el servicio existe y está activo
    const service = db.prepare('SELECT id, nombre, precio, duracion_minutos FROM services WHERE id = ? AND activo = 1').get(service_id);

    if (!service) {
      return res.status(404).json({ 
        success: false, 
        message: 'Servicio no encontrado o inactivo' 
      });
    }

    // Verificar cita duplicada: mismo usuario, servicio y horario activo
    const existingSlot = db.prepare(
      "SELECT id FROM appointments WHERE user_id = ? AND service_id = ? AND fecha_hora = ? AND estado = 'booked'"
    ).get(req.user.id, service_id, fecha_hora);

    if (existingSlot) {
      return res.status(409).json({
        success: false,
        message: 'Ya tienes una cita para ese servicio en ese horario'
      });
    }

    // Insertar cita con estado 'booked'
    const stmt = db.prepare(
      'INSERT INTO appointments (user_id, service_id, fecha_hora, estado) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(req.user.id, service_id, fecha_hora, 'booked');

    // Obtener cita con detalles del servicio
    const appointment = db.prepare(`
      SELECT a.id, a.fecha_hora, a.estado, a.motivo_cancelacion,
             s.nombre AS servicio_nombre, s.precio AS servicio_precio, s.duracion_minutos AS servicio_duracion
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.id = ?
    `).get(Number(result.lastInsertRowid));

    return res.status(201).json({ 
      success: true, 
      appointment,
      message: 'Cita agendada exitosamente'
    });
  } catch (err) {
    console.error('[ERROR] Appointments POST:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor al agendar cita' 
    });
  }
});

// PUT /appointments/:id - Actualizar/cancelar cita (Fase 3+)
// Body: { nuevo_fecha_hora, motivo_cancelacion }
app.put('/appointments/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { nuevo_fecha_hora, motivo_cancelacion } = req.body;

  try {
    // Verificar que la cita existe y pertenece al usuario
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ?').get(id, req.user.id);

    if (!existing) {
      return res.status(404).json({ 
        success: false, 
        message: 'Cita no encontrada' 
      });
    }

    // Si se proporciona nueva fecha, actualizar
    if (nuevo_fecha_hora) {
      const stmt = db.prepare('UPDATE appointments SET fecha_hora = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(nuevo_fecha_hora, id);
    }

    // Si se proporciona motivo de cancelación, marcar como cancelada
    if (motivo_cancelacion) {
      const stmt2 = db.prepare('UPDATE appointments SET estado = ?, motivo_cancelacion = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?');
      stmt2.run('cancelled', motivo_cancelacion, id);
    }

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);

    return res.json({ 
      success: true, 
      appointment: updated,
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