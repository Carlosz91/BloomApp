# BloomApp — Backend (Express + SQLite)

Documentación de referencia del backend al estado actual (octubre 2026).

---

## 1. Stack

| Componente | Elección |
|---|---|
| Node | `node:26` (Debian/glibc, image completa) |
| Framework | Express + `cors` + `express.json()` |
| Driver SQLite | `better-sqlite3` (nativo; **alpine/musl no**, provocaría SIGSEGV 139) |
| Auth | `jsonwebtoken` + `bcryptjs` |
| Config | `dotenv` |

---

## 2. Estructura y ejecución

```
BloomApp/
├── Dockerfile          ← backend (node:26, COPY src/, CMD node src/server.js)
├── docker-compose.yml  ← servicios backend + frontend
└── src/
    ├── server.js       ← API completa (rutas + middleware JWT)
    ├── db.js           ← conexión SQLite, pragmas y definición de tablas
    └── init-db.js      ← verificación idempotente de tablas + semillas del catálogo
```

Arranque: `node src/server.js` (en Docker lo hace el CMD). `server.js` llama `require('./init-db.js')` en el arranque → tablas y catálogo quedan garantizados en cada boot.

---

## 3. Configuración (variables de entorno)

| Variable | Valor en compose | Uso |
|---|---|---|
| `PORT` | `3000` | puerto HTTP |
| `NODE_ENV` | `development` | log de entorno |
| `DATABASE_URL` | `/app/data/database.sqlite` | ruta del archivo SQLite (volumen `bloomapp-db`) |
| `JWT_SECRET` | `bloomapp-super-secret-key-change-in-production-32chars` | firmar/verificar JWT (**cambiar en producción**) |
| `BCRYPT_SALT_ROUNDS` | `10` | hash de contraseñas |

---

## 4. Endpoints

Base: `http://192.168.0.13:3000` (o `localhost:3000` en el PC). Todas las respuestas JSON incluyen `success: true|false` y `message`.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | — | Healthcheck (usado por Docker Compose) |
| `POST` | `/auth/register` | — | `{ nombre, email, password, telefono? }` → `201` con `{ token, user }`; `409` si email repetido |
| `POST` | `/auth/login` | — | `{ email, password }` → `{ token, user }` (sin `password_hash`); `401` credenciales inválidas |
| `POST` | `/auth/logout` | — | Responde éxito (el logout real es cliente: se borra storage local) |
| `GET` | `/auth/me` | JWT | Usuario autenticado `{ id, email, nombre, telefono }` |
| `PUT` | `/auth/profile` | JWT | `{ nombre?, telefono? }` — nombre ≥ 2 chars; teléfono 7–12 dígitos (o vacío → null) |
| `GET` | `/services` | JWT | Catálogo activo: `id, nombre, descripcion, precio, duracion_minutos, categoria` |
| `GET` | `/services/:id` | JWT | Un servicio; `404` si no existe o inactivo |
| `GET` | `/appointments` | JWT | Citas del usuario (JOIN de servicio) ordenadas por `fecha_hora` DESC; respuesta **plana**: `servicio_nombre/servicio_precio/servicio_duracion` |
| `POST` | `/appointments` | JWT | `{ service_id, fecha_hora }` → `201` `{ appointment, message }`; `409` si ya hay cita activa idéntica |
| `PUT` | `/appointments/:id` | JWT | `{ nuevo_fecha_hora? }` reagenda; `{ motivo_cancelacion }` → estado `cancelled` |

**JWT**: payload `{ id, email }`, expira en `24h`. El middleware `authenticateToken` exige cabecera `Authorization: Bearer <token>` (sin token → `401 Token no proporcionado`; inválido → `403 Token inválido`).

Nota: el backend **deriva el `user_id` del JWT** (`req.user.id`); el cliente no lo envía al criar citas.

---

## 5. Base de datos (SQLite)

Archivo: `/app/data/database.sqlite` (volumen nombrado `bloomapp-db`, persiste entre rebuilds).

Pragmas: `journal_mode = WAL`, `foreign_keys = ON`.

```sql
users (
  id INTEGER PK AUTOINCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  telefono VARCHAR(20),
  creado_en / actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

services (
  id, nombre, descripcion, precio DECIMAL(10,2), duracion_minutos,
  categoria VARCHAR(50), activo BOOLEAN DEFAULT 1,
  creado_en / actualizado_en
)

appointments (
  id, user_id → users, service_id → services,
  fecha_hora TIMESTAMP, estado VARCHAR(20) DEFAULT 'booked', motivo_cancelacion,
  creado_en / actualizado_en
)
```

Estados de cita: `booked` (activa) | `cancelled` (baja con motivo). Cancelar es soft-delete.

### Catálogo sembrado (`init-db.js`, idempotente por nombre)

| Servicio | Categoría | Precio (PYG) | Duración |
|---|---|---|---|
| Perfilado de cejas | cejas | 50.000 | 25 min |
| Tinte de cejas | cejas | 60.000 | 30 min |
| Laminado de cejas | cejas | 150.000 | 45 min |
| Limpieza facial | rostro | 120.000 | 60 min |
| Mascarilla facial | rostro | 100.000 | 40 min |

**Cuidado**: los `CREATE TABLE IF NOT EXISTS` de `init-db.js` aún usan columnas `created_at/updated_at`; son no-ops porque `db.js` crea las tablas primero con `creado_en/actualizado_en`. No cambiar el orden de `require` ni depender de esos DDL.

---

## 6. Docker

```yaml
backend (Dockerfile): node:26 → COPY src/ → node -e smoke-test de better-sqlite3 → CMD node src/server.js
ports: 3000:3000
volume: bloomapp-db:/app/data
healthcheck: curl -fsS http://localhost:3000/health (30s interval, 15s start_period)
```

Operación diaria:

```bash
# Reconstruir tras cambiar código backend (el código se copia a la imagen):
docker-compose build backend && docker-compose up -d backend

# Salud y log:
curl http://localhost:3000/health
docker logs -f bloomapp-backend

# Consultar la base sin entrar al contenedor completo (one-liner SQL):
docker exec bloomapp-backend node -e "const db=require('/app/src/db.js');console.log(JSON.stringify(db.prepare('SELECT * FROM appointments').all(),null,2))"

# Backup de la base (archivo del volumen):
docker cp bloomapp-backend:/app/data/database.sqlite ./backup-database.sqlite
```

**Regla crítica**: los cambios de código del backend requieren `docker-compose build backend` (el código queda horneado en la imagen, `COPY src/`), a diferencia del frontend que solo necesita reinicio.

---

## 7. Estado actual y límites conocidos

- **Renderizado sin agendamiento existente**: ya no se crean pantallas nuevas por eso; el agendamiento completo sigue viniendo de `/services`, `/appointments`.
- Objetos de test verificados: `carlos@test.com / 123456` (id 1).
- **No está implementado** (candidatos siguientes): CRUD admin de catálogo (precios se cambian editando semillas + rebuild), promociones/novedades/beneficios persistidas (hoy viven como constantes en el frontend), pasarelas o medios de pago, backups automáticos.
- El POST `/auth/logout` es nominal: la revocación real depende del cliente (borrar storage).
- No hay rate limiting ni rotación de secretos: pre-producción local.
