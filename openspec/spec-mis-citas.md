# Spec: Sección Mis citas - próximas, historial y cancelación

## Overview
Pantalla `MyAppointments` que muestra las citas de la usuaria, dividido en tres secciones: Próximas, Historial y acción de cancelación.

## States (3 secciones)

### 1. Próximas Citas
- Servicios próximos en el futuro (a partir de hoy)
- Estado: `booked` o `confirmed`
- UI: Lista tarjetas con servicio, fecha, hora, estado visual
- Acción: "Reprogramar" o detalles

### 2. Historial
- Servicios pasados (fecha < hoy)
- Estado: `completed`, `cancelled`, `no-show`
- UI: Lista solo lectura, maybe con opción "Calificar servicio"
- Acción: Ninguna (solo lectura)

### 3. Cancelación
- Formulario sencillo para cancelar una cita próxima
- Campos: motivo_cancelacion (textarea opcional)
- Botón "Cancelar cita" → PUT `/appointments/:id` con estado='cancelled'

## Data Flow

### API GET /appointments (user's appointments)

**Respuesta 200:**
```json
[
  // Cita próxima (dentro de los próximos 30 días)
  {
    "id": 12,
    "service_id": 1,
    "fecha_hora": "2026-11-15T09:00:00.000Z",
    "estado": "booked",
    "motivo_cancelacion": null,
    "service": { "nombre": "Corte de cejas", "precio": 45.00, "categoria": "cejas" }
  },
  // Cita pasada (historial)
  {
    "id": 7,
    "service_id": 5,
    "fecha_hora": "2026-10-01T14:30:00.000Z",
    "estado": "completed",
    "motivo_cancelacion": null,
    "service": { "nombre": "Limpieza de piel", "precio": 55.00, "categoria": "rostro" }
  }
]
```

### Lógica de clasificación client-side

```javascript
const ahora = new Date();
const citasProximas = servicios.filter(s => new Date(s.fecha_hora) >= ahora && new Date(s.fecha_hora) < ahora + 30dias);
const historial = servicios.filter(s => new Date(s.fecha_hora) < ahora);
```

### API PUT /appointments/:id (cancelar)

**Cuerpo request:**
```json
{
  "estado": "cancelled",
  "motivo_cancelacion": "Ya no puedo asistir"
}
```

**Respuesta 200:**
```json
{
  "id": 12,
  "estado": "cancelled",
  "motivo_cancelacion": "Ya no puedo asistir"
}
```

## Pantalla MyAppointments (componentes)

### Layout general

```
┌─────────────────────────────────────────────┐
|       MIS CITAS LÚMINA BEAUTY STUDIO        │
|  [Próximas] [Historial]                      │  <- segmented control o tabs
├─────────────────────────────────────────────┤
│  ╔═════════════════════════════════════════════════════════╗ │
│  ║  Próximas Citas                              ║ │
│  ║                                              ║ │
│  ║  • Corte de cejas - $45 - 15/11 9:00 AM     ║ │
│  ║    Estado: Confirmada                        ║ │
│  ║    [Cancelar]                                ║ │
│  ╚════════════════════════════════════════════════════════╝ │
│  ╔═════════════════════════════════════════════════════════╗ │
│  ║  Historial                                   ║ │
│  ║                                              ║ │
│  ║  • Limpieza de piel - $55 - 01/10 finalizada║ │
│  ║    [Ya no disponible]                        ║ │
│  ╚════════════════════════════════════════════════════════╝ │
└─────────────────────────────────────────────┘
```

### Componente CitaCard (reutilizable)

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| cita | object | Datos completos de la cita (id, service, fecha_hora, estado) |
| showCancel | boolean | Mostrar botón cancelar (solo para próximas) |
| onCancel | function | Callback al tocar cancelar |
| isPast | boolean | Si la cita es del pasado (ocultar cancel) |

### Estados visuales por tipo de cita

| Tipo | Color badge | Borde | Acciones |
|------|-------------|-------|----------|
| Próxima (booked) | #6B3752 (ciruela) | 2px #6B3752 | [Cancelar] |
| Completa | #4CAF50 (verde) | 1px #4CAF50 | Ninguna |
| Cancelada | #F57C00 (naranja) | 1px #F57C00 | Ninguna (ver detalle) |
| No-show | #EF4444 (rojo) | 2px #EF4444 | Ninguna |

### Botón Cancelar (cuando applicable)

| Propiedad | Valor |
|-----------|-------|
| Texto | "Cancelar" |
| Color fondo | #EF4444 (rojo claro) o #6B3752 (ciruela) |
| Texto color | #FFFFFF (blanco) |
| OnPress → Ejecutar PUT /appointments/:id |

## State Management

```javascript
const [citas, setCitas] = useState([]);
const [vistaActual, setVistaActual] = useState('proximas'); // 'proximas' | 'historial'

useEffect(() => {
  fetch('http://localhost:3000/appointments', {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(setCitas)
  .catch(err => console.error);
}, [token]);
```

### Filtrado en render

```javascript
const citasProximas = citas.filter(c => {
  const fecha = new Date(c.fecha_hora);
  return fecha >= new Date() && fecha < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
});

const historialCitas = citas.filter(c => new Date(c.fecha_hora) < new Date());
```

## Design Tokens (estilos MyAppointments)

### Colores por sección

```
Tab activo: #6B3752 (ciruela) - fondo botón
Tab inactivo: #8F9B96 (salvia) - texto gris
Badge estado proximo: #6B3752 (círculo pequeño)
Badge estado completado: #4CAF50 (verde pequeño)
Texto "Cancelar": #EF4444 (fondo rojo, texto blanco)
Fondo card cita próxima: #FFFFFF (blanco puro)
Fondo card cita pasado: #F5E9DC (ciruela muy claro)
```

### Tipografía y espaciado

- Margen vertical entre citas: 12px
- Altura tarjeta cita: 80px (mobile) o 120px (tablet)
- Radio border: 8px
- Sombra ligera: elevation 1

## Integration with Schedule

### Datos compartidos

| Dato | Origen | Uso en MyAppointments |
|------|--------|----------------------|
| `service.id` | API /services | Mostrar nombre servicio |
| `service.precio` | API /services | Mostrar precio formato |
| `fecha_hora` | API appointments | Formatear para display |
| `estado` | API appointments | Color badge + acciones disponibles |

### Flujo cancelación → Schedule

1. Tocar "[Cancelar]" en MyAppointments card
2. Mostrar modal con textarea "Motivo" + botón "Confirmar Cancelar"
3. Ejecutar PUT `/appointments/:id` con estado cancelado
4. Toast "Cita cancelada exitosamente"
5. Volver a refrescar lista (refetch API GET /appointments)
6. Si la cita era la próxima, desaparecer de "Próximas" y aparecer en "Historial"

## Error Handling

| Error | UI Response |
|-------|-------------|
| PUT 401 sin token | Login requerida, limpiar storage |
| PUT 404 cita inexistente | "Error: cita no encontrada" |
| PUT 403 sin permisos | "No tienes permiso para cancelar esta cita" |
| Éxito POST/Toast | "Cita cancelada" + navigación implícita |

## Acceptance Criteria
- [ ] API GET /appointments retorna lista de citas user
- [ ] Se clasifican automáticamente en "Próximas" vs "Historial"
- [ ] Cards muestran nombre servicio + precio + fecha/hora formateada
- [ ] Botón "[Cancelar]" solo aparece para citas próximas (status booked)
- [ ] Tocar cancelar ejecuta PUT /appointments/:id con estado='cancelled'
- [ ] Toast confirma cancelación exitosa
- [ ] Lista se actualiza automáticamente después de cancelar
- [ ] Historial muestra citas pasadas con badge "finalizada"
- [ ] Estados visuales (badges) son consistentes con paleta ciruela/salvia