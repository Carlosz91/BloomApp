# Spec: Catálogo de servicios con filtros por categoría

## Overview
Catálogo profesional de servicios del salón LÚMINA BEAUTY STUDIO, listado con tarjetas responsive, filtros por categoría y conexión al backend API.

## Data Model (SQLite - ya existe)

### Tabla `services` (existente)
| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| nombre | TEXT | NOT NULL |
| descripcion | TEXT | NOT NULL |
| precio | REAL | NOT NULL, >= 0 |
| duracion_minutos | INTEGER | NOT NULL, >= 1 |
| categoria | TEXT | NOT NULL, enum: ['cejas', 'rostro', 'otros'] |
| activo | INTEGER | DEFAULT 1, BOOLEAN |
| timestamps | DATETIME | CREATE_AT, UPDATE_AT |

### Datos de prueba (seed en init-db.js)
| id | nombre | descripcion | precio | duracion | categoria | activo |
|----|--------|-------------|--------|----------|-----------|--------|
| 1 | Corte de cejas | Corte y forma de cejas | 45.00 | 45 | cejas | 1 |
| 2 | Tinte de cejas | Aplicación de tinte para cejas | 30.00 | 30 | cejas | 1 |
| 3 | Laminado de cejas | Laminado y arreglo de cejas | 55.00 | 60 | cejas | 1 |
| 4 | Micropigmentación de cejas | Micropigmentación natural para cejas | 80.00 | 90 | cejas | 1 |
| 5 | Limpieza de piel | Limpieza facial profunda | 55.00 | 60 | rostro | 1 |

## Pantalla Catálogo (Home mejorada)

### Layout

```
┌─────────────────────────────────┐
|       LÚMINA BEAUTY STUDIO       │
|  [Cejas] [Rostro] [Todos]        │  <- pills/filtros
├─────────────────────────────────┤
|  ┌────────────┐  ┌────────────┐   │
|  | Servicio 1 |  | Servicio 2 |   │
|  | $45 - 45min|  | $30 - 30min|   │
|  └────────────┘  └────────────┘   │
|  ┌────────────┐  ┌────────────┐   │
|  | Servicio 3 |  | Servicio 4 |   │
|  | $55 - 60min|  | $80 - 90min|   │
|  └────────────┘  └────────────┘   │
|  ...                              │
└─────────────────────────────────┘
```

### Filtros por categoría

| Filtro | Componente | Behavior |
|--------|------------|----------|
| Todas | Botón activo por defecto | Muestra todos los servicios activos |
| Cejas | Botón pulsable | `services.filter(s => s.categoria === 'cejas' && s.activo)` |
| Rostro | Botón pulsable | `services.filter(s => s.categoria === 'rostro' && s.activo)` |
| Nuevo (futuro) | Posible categoría adicional | Filtro dinámico desde API |

### Componente ServicioCard

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| servicio | object | Datos del servicio (id, nombre, precio, duracion, categoria) |
| onPress | function | Navegar a Schedule con serviceId |
| isFiltered | boolean | Si aplica filtro actual |
| badgeCategoria | string | 'cejas' o 'rostro' para badge visual |

### Navegación
- Tocar cualquier ServicioCard → `navigation.navigate('Schedule', { serviceId: servicio.id })`
- Mantener compatibilidad con route.params.serviceId existente en Schedule screen

## API Endpoints

| Método | Endpoint | Auth | Respuesta | Descripción |
|--------|----------|------|-----------|-------------|
| GET | `/services` | ✅ JWT | `[{id,nombre,descripcion,precio,duracion_minutos,categoria,activo}]` | Listado todos los servicios activos |
| GET | `/services/categorias` | ✅ JWT | `['cejas','rostro']` | Lista de categorías disponibles |

## Design Tokens (integración paletas)

### Colores por categoría

```
CEJAS:
- Tarjeta: #F5E9DC (ciruela claro)
- Título: #6B3752 (ciruela fuerte)
- Precio: #6B3752
- Badge: #A0522D (acento marrón)

ROSTRO:
- Tarjeta: #E8F0F1 (salvia muy claro)
- Título: #5A9FAF (salvia fuerte)
- Precio: #5A9FAF
- Badge: #6C8A98 (acento salvia)
```

### Estados de tarjeta

| Estado | Color de fondo | Borde | Comentario |
|--------|---------------|-------|------------|
| Normal | blanco #FFFFFF | 1px #D1D5DB | Estado por defecto |
| Filtrado activo | color categoría | 2px sólido | Cuando filtro activo |
| Tocado | #F0F0F1 | interno | Efecto press |
| Agotado/inoacto | #F5E9DC | 1px #AAA | `activo=0` |

## State Management

### Filtro state (local en HomeScreen)
```javascript
const [categoriaFilter, setCategoriaFilter] = useState('todos');
const [servicios, setServicios] = useState([]);
const serviciosFiltrados = categoriaFilter === 'todos'
  ? servicios
  : servicios.filter(s => s.categoria === categoriaFilter && s.activo);
```

### Efecto fetch (useEffect)
```javascript
useEffect(() => {
  const fetchServicios = async () => {
    const token = await getToken(); // de storage JWT
    const res = await fetch('http://localhost:3000/services', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setServicios(data.filter(s => s.activo));
  };
  fetchServicios();
}, []);
```

## Performance
- FlatList con keyExtractor del ID
- Virtualized automático de RN
- Imágenes thumbnails (sin imágenes grandes hasta navegar)
- Memoización de ServicioCard con React.memo

## Accessibility
- Textos alternativos en tarjetas
- Contraste mínimo 4.5:1 (verificad con paletas)
- Taps mínimas 44×44dp
- Etiquetas aria-label en botones de filtro

## Acceptance Criteria
- [ ] Catálogo carga servicios desde API backend
- [ ] Filtros Cejas/Rostro/Todos funcionan correctamente
- [ ] Tarjetas son responsive (2 columnas en mobile, 3 en tablet)
- [ ] Tocar card navega a Schedule con serviceId correcto
- [ ] Servicios inactivos no aparecen en listado
- [ ] Badge de categoría visible en cada tarjeta
- [ ] Memoización evita re-renders innecesarios