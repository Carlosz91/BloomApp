// Database initialization script for BloomApp (PostgreSQL version)
// Ejecutar con: node src/init-db.js

const db = require('./db.js');

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

// Insert each service only if it does not exist yet (by name).
// COUNT(*) is cast to int so the comparison stays numeric (bigint arrives
// as a string from node-postgres by default).
async function seedDefaultServices() {
  let inserted = 0;
  for (const s of defaultServices) {
    const result = await db.queryOne('SELECT COUNT(*)::int AS cnt FROM services WHERE nombre = $1', [s.nombre]);
    if (result.row.cnt === 0) {
      await db.query(
        'INSERT INTO services (nombre, descripcion, precio, duracion_minutos, categoria, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
        [s.nombre, s.descripcion, s.precio, s.duracion_minutos, s.categoria]
      );
      inserted += 1;
    }
  }
  return inserted;
}

async function initializeDatabase() {
  // Memoized in db.js: resolves the same promise already kicked off on module
  // load, guaranteeing tables exist before seeding (no duplicate run).
  await db.initializeTables();
  console.log('✅ Tablas verificadas/creadas en PostgreSQL');

  const inserted = await seedDefaultServices();
  console.log(inserted === 0 ? 'ℹ️ Catálogo de servicios completo' : `✅ Catálogo de servicios: ${inserted} servicio(s) insertado(s)`);

  console.log('\n🎉 Base de datos inicializada exitosamente!');
  console.log('Tablas creadas: users, services, appointments');
  console.log('Catálogo: 3 servicios de cejas + 2 de rostro (precios en guaraníes)');
}

initializeDatabase().catch((err) => {
  console.error('ERROR: no se pudo inicializar la base de datos:', err.message);
  process.exit(1);
});
