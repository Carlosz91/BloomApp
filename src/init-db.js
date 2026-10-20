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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Tabla "users" creada/verificada');

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

  // Insertar servicios por defecto (solo si la tabla está vacía)
  const servicesCount = db.prepare('SELECT COUNT(*) FROM services').get().cnt;
  if (servicesCount === 0) {
    db.prepare('INSERT INTO services (nombre, descripcion, precio, duracion_minutos, categoria, activo) VALUES (?, ?, ?, ?, ?, ?)').run
      ('Corte de cejas', 'Corte y forma de cejas', 45.00, 45, 'cejas', 1);
    db.prepare('INSERT INTO services (nombre, descripcion, precio, duracion_minutos, categoria, activo) VALUES (?, ?, ?, ?, ?, ?)').run
      ('Tinte de cejas', 'Aplicación de tinte para cejas', 30.00, 30, 'cejas', 1);
    db.prepare('INSERT INTO services (nombre, descripcion, precio, duracion_minutos, categoria, activo) VALUES (?, ?, ?, ?, ?, ?)').run
      ('Laminado de cejas', 'Laminado y arreglo de cejas', 60.00, 60, 'cejas', 1);
    db.prepare('INSERT INTO services (nombre, descripcion, precio, duracion_minutos, categoria, activo) VALUES (?, ?, ?, ?, ?, ?)').run
      ('Micropigmentación de cejas', 'Micropigmentación natural para cejas', 80.00, 90, 'cejas', 1);
    console.log('✅ Servicios por defecto insertados');
  } else {
    console.log('ℹ️ Servicios ya existían, no se insertaron duplicados');
  }

  console.log('\n🎉 Base de datos inicializada exitosamente!');
  console.log('Tablas creadas: users, services, appointments');
  console.log('Servicios de ejemplo insertados para desarrollo');
}

initializeDatabase();