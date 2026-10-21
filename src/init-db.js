// Database initialization script for BloomApp (SQLite version)
// Ejecutar con: node src/init-db.js

const db = require('./db.js');

// Initialize tables
function initializeDatabase() {
  // Tabla users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      telefono VARCHAR(20),
      genero VARCHAR(10) NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Tabla "users" creada/verificada');

  // Migración para DBs existentes: columna genero para el saludo personalizado
  try {
    db.exec("ALTER TABLE users ADD COLUMN genero VARCHAR(10) NOT NULL DEFAULT ''");
  } catch (e) {
    // La columna ya existe (DB creada con esta versión)
  }

  // Tabla services
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      precio DECIMAL(10, 2) NOT NULL,
      duracion_minutos INTEGER NOT NULL,
      categoria VARCHAR(50),
      activo BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Tabla "services" creada/verificada');

  // Tabla appointments
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      fecha_hora TIMESTAMP NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'booked',
      motivo_cancelacion TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    );
  `);
  console.log('✅ Tabla "appointments" creada/verificada');

  // Catálogo base del salón. Precios enteros en guaraníes (PYG).
  // Idempotente: inserta cada servicio solo si aún no existe por nombre.
  const defaultServices = [
    // Cejas (3)
    { nombre: 'Perfilado de cejas', descripcion: 'Perfilado y definición de la forma de las cejas', precio: 50000, duracion_minutos: 25, categoria: 'cejas' },
    { nombre: 'Tinte de cejas', descripcion: 'Tinte para dar densidad y color a las cejas', precio: 60000, duracion_minutos: 30, categoria: 'cejas' },
    { nombre: 'Laminado de cejas', descripcion: 'Laminado para alinear, fijar y volumizar las cejas', precio: 150000, duracion_minutos: 45, categoria: 'cejas' },
    // Rostro (2)
    { nombre: 'Limpieza facial', descripcion: 'Limpieza facial profunda con extracción de puntos negros', precio: 120000, duracion_minutos: 60, categoria: 'rostro' },
    { nombre: 'Mascarilla facial', descripcion: 'Mascarilla hidratante y revitalizante del rostro', precio: 100000, duracion_minutos: 40, categoria: 'rostro' },
  ];

  const insertService = db.prepare(
    'INSERT INTO services (nombre, descripcion, precio, duracion_minutos, categoria, activo) VALUES (?, ?, ?, ?, ?, 1)'
  );
  const serviceExists = db.prepare('SELECT COUNT(*) AS cnt FROM services WHERE nombre = ?');
  let inserted = 0;
  for (const s of defaultServices) {
    if (serviceExists.get(s.nombre).cnt === 0) {
      insertService.run(s.nombre, s.descripcion, s.precio, s.duracion_minutos, s.categoria);
      inserted += 1;
    }
  }
  console.log(inserted === 0 ? 'ℹ️ Catálogo de servicios completo' : `✅ Catálogo de servicios: ${inserted} servicio(s) insertado(s)`);

  console.log('\n🎉 Base de datos inicializada exitosamente!');
  console.log('Tablas creadas: users, services, appointments');
  console.log('Catálogo: 3 servicios de cejas + 2 de rostro (precios en guaraníes)');
}

initializeDatabase();