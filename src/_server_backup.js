require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db.js');

console.log('[SERVER] Starting...');

// Debug: list routes after they are defined
const Express = require('express');
const fs = require('fs');
const content = fs.readFileSync('src/server.js', 'utf8');

// Check for route patterns
const routes = ['/auth/register', '/auth/login', '/services', '/appointments'];

console.log('[SERVER] Checking routes:\n');
routes.forEach(route => {
  const found = content.includes(\`app.post('\${route}')\` || content.includes(\`app.get('\${route}')\`));
  console.log(\`- \${route}: \${found ? '✅ DEFINED' : '❌ NOT DEFINED'}\`);
});

const app = express();
console.log('[SERVER] Express initialized');

// Logging de todas las peticiones
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

app.use(cors());
app.use(express.json());

// ===========================================
// AUTH ROUTES
// ===========================================

function handleRegister(req, res) {
  try {
    const { nombre, email, password, telefono } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ message: 'Nombre, correo y contraseña son obligatorios' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const passwordHash = bcrypt.hashSync(password, saltRounds);

    const stmt = db.prepare('INSERT INTO users (nombre, email, password_hash, telefono) VALUES (?, ?, ?, ?)');
    const result = stmt.run(nombre, email, passwordHash, telefono || null);

    const jwtSecret = process.env.JWT_SECRET || 'bloomapp-super-secret-key-change-in-production-32chars';
    const token = jwt.sign({ id: result.lastID, email }, jwtSecret, { expiresIn: '24h' });

    res.json({ token, user: { id: result.lastID, nombre, email, telefono } });
  } catch (err) {
    console.error('[ROUTE-ERROR] Register:', err.message);
    res.status(500).json({ message: 'Error en el servidor al registrar' });
  }
}

function handleLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'bloomapp-super-secret-key-change-in-production-32chars';
    const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '24h' });

    const { password_hash, ...userWithoutPassword } = user;

    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('[ROUTE-ERROR] Login:', err.message);
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión' });
  }
}

// Apply routes
app.post('/auth/register', handleRegister);
app.post('/auth/login', handleLogin);

// POST /auth/logout - User logout
app.post('/auth/logout', (req, res) => {
  res.json({ message: 'Sesión cerrada exitosamente', success: true });
});

// ===========================================
// JWT AUTH MIDDLEWARE
// ===========================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(410).json({ message: 'Token no proporcionado' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'bloomapp-super-secret-key-change-in-production-32chars', (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
}

// ===========================================
// SERVICES ROUTES
// ===========================================

app.get('/services', (req, res) => {
  try {
    console.log('[HTTP] GET /services');
    const services = db.prepare('SELECT id, nombre, descripcion, precio, duracion_minutos, categoria, activo FROM services WHERE activo = 1').all();
    res.json({ services });
  } catch (err) {
    console.error('[ROUTE-ERROR] Services GET:', err.message);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.get('/services/:id', (req, res) => {
  try {
    const service = db.prepare('SELECT id, nombre, descripcion, precio, duracion_minutos, categoria, activo FROM services WHERE id = ? AND activo = 1').get(req.params.id);

    if (!service) {
      return res.status(404).json({ message: 'Servicio no encontrado' });
    }

    res.json({ service });
  } catch (err) {
    console.error('[ROUTE-ERROR] Services GET:id:', err.message);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ===========================================
// APPOINTMENTS ROUTES (protected)
// ===========================================

app.get('/appointments', authenticateToken, (req, res) => {
  try {
    const appointments = db.prepare(`
      SELECT a.id, a.fecha_hora, a.estado, a.motivo_cancelacion,
             s.nombre AS servicio_nombre, s.precio AS servicio_precio, s.duracion_minutos AS servicio_duracion
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.user_id = ?
      ORDER BY a.fecha_hora DESC
    `, [req.user.id]).all();

    res.json({ appointments });
  } catch (err) {
    console.error('[ROUTE-ERROR] Appointments GET:', err.message);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// POST /appointments - Create new appointment
app.post('/appointments', authenticateToken, (req, res) => {
  const { service_id, fecha_hora } = req.body;

  if (!service_id || !fecha_hora) {
    return res.status(400).json({ message: 'service_id y fecha_hora son obligatorios' });
  }

  try {
    const service = db.prepare('SELECT id, nombre, precio, duracion_minutos FROM services WHERE id = ? AND activo = 1').get(service_id);

    if (!service) {
      return res.status(404).json({ message: 'Servicio no encontrado o inactivo' });
    }

    const stmt = db.prepare('INSERT INTO appointments (user_id, service_id, fecha_hora, estado) VALUES (?, ?, ?, ?)');
    const result = stmt.run(req.user.id, service_id, fecha_hora, 'booked');

    const appointment = db.prepare(`
      SELECT a.id, a.fecha_hora, a.estado, a.motivo_cancelacion,
             s.nombre AS servicio_nombre, s.precio AS servicio_precio, s.duracion_minutos AS servicio_duracion
      FROM appointments a
      JOIN services s ON a.service_id = s.id
      WHERE a.id = ?
    `, [result.lastID]).get();

    res.status(201).json({ appointment, message: 'Cita agendada exitosamente' });
  } catch (err) {
    console.error('[ROUTE-ERROR] Appointments POST:', err.message);
    res.status(500).json({ message: 'Error en el servidor al agendar cita' });
  }
});

// PUT /appointments/:id - Update/cancel appointment
app.put('/appointments/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { nuevo_fecha_hora, motivo_cancelacion } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ?').get(id, req.user.id);

    if (!existing) {
      return res.status(404).json({ message: 'Cita no encontrada' });
    }

    if (nuevo_fecha_hora) {
      const stmt = db.prepare('UPDATE appointments SET fecha_hora = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(nuevo_fecha_hora, id);
    }

    if (motivo_cancelacion) {
      const stmt2 = db.prepare('UPDATE appointments SET estado = ?, motivo_cancelacion = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      stmt2.run('cancelled', motivo_cancelacion, id);
    }

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);

    res.json({ appointment: updated, message: 'Cita actualizada exitosamente' });
  } catch (err) {
    console.error('[ROUTE-ERROR] Appointments PUT:', err.message);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🌸 Servidor BloomApp corriendo en puerto ${PORT}`);
  console.log('Rutas disponibles:');
  console.log('  GET /health');
  console.log('  POST /auth/register');
  console.log('  POST /auth/login');
  console.log('  GET /services');
  console.log('  GET /services/:id');
  console.log('  GET /appointments (auth)');
  console.log('  POST /appointments (auth)');
  console.log('  PUT /appointments/:id (auth)');
});