const sqlite3 = require('better-sqlite3');

// Ruta de la base de datos SQLite (se creará automáticamente en la misma carpeta)
const databasePath = process.env.DATABASE_URL || './database.sqlite';
const db = sqlite3(databasePath);

// Habilitar claves foráneas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Función para inicializar las tablas
function initializeTables() {
  // Tabla users - almacenar credenciales de login
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      telefono VARCHAR(20),
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabla services - catálogo de servicios (Fase 3+)
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      precio DECIMAL(10, 2) NOT NULL,
      duracion_minutos INTEGER NOT NULL,
      categoria VARCHAR(50),
      activo BOOLEAN DEFAULT 1,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabla appointments - citas programadas (Fase 3+)
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  console.log('✅ Tablas de SQLite verificadas/creadas: users, services, appointments');
}

// Ejecutar inicialización al cargar el módulo
initializeTables();

// Exportar db para usar en otros módulos
module.exports = db;