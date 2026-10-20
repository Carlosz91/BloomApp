# Spec: Flujo funcional de reserva completo

## Overview
Flujo de reserva de extremo a extremo: selección de servicio → fecha y hora → confirmación de solicitud → notificación visual.

## Estados del Flujo

### Estado 1: Selección de Servicio
- Pantalla: `HomeScreen` → tarjeta servicio → o `CatalogScreen` con filtros
- Datos requeridos: `serviceId` (número entero)
- Estado en navegación: `route.params.serviceId`
- Transición: `navigation.navigate('Schedule', { serviceId })`

### Estado 2: Fecha y Hora
- Pantalla: `ScheduleScreen`
- Campos:
  - `selectedDate`: Date object, mínimo = hoy, máximo = 90 días adelante
  - `selectedTime`: string formato "9:00 AM", "2:30 PM", etc.
  - `availableTimes`: array horarios disponibles para la fecha seleccionada
- Lógica de disponibilidad:
  - Horario salón: 9:00 AM a 5:00 PM
  - Intervalos: cada hora (1 hora duración por servicio)
  - Fin de semana: horarios reducidos o deshabilitados
- UI:
  - DatePicker con componente Ionicons calendar
  - TimeSelector con lista scroll de horarios disponibles
  - Texto "Horas disponibles" solo cuando hay horarios

### Estado 3: Confirmación de Solicitud
- Pantalla: `ConfirmationScreen` (o modal dentro de Schedule)
- Datos resumidos:
  - Nombre servicio: string (ej: "Corte de cejas")
  - Precio: currency format (ej: "$45.00")
  - Fecha: date format local (ej: "15/11/2026")
  - Hora: string (ej: "9:00 AM")
- Acciones:
  - Botón "Confirmar" → POST `/appointments` + navegar a `MyAppointments`
  - Botón "Modificar" → volver a Schedule screen
  - Cancelar → regresar a Home

## API Contract

### POST /appointments (crear reserva)

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| user_id | INTEGER | ✅ | FK → users.id, debe existir |
| service_id | INTEGER | ✅ | FK → services.id, debe ser activo |
| fecha_hora | DATETIME | ✅ | Debe ser >= ahora, < 90 días |
| estado | TEXT | opcional | Default: 'booked' |
| motivo_cancelacion | TEXT | opcional | NULL cuando creado |

**Respuesta exitosa (201):**
```json
{
  "id": 12,
  "user_id": 5,
  "service_id": 1,
  "fecha_hora": "2026-11-15T09:00:00.000Z",
  "estado": "booked",
  "motivo_cancelacion": null,
  "service": { nombre: "Corte de cejas", precio: 45 }
}
```

**Errores:**
- 400: servicio inactivo, fecha inválida, hueco lleno
- 401: token inválido/expire
- 409: conflicto de horario (ya otra cita en ese hueco)

### GET /appointments (listar citas user)

**Respuesta 200:**
```json
[
  {
    "id": 12,
    "service": { nombre, precio },
    "fecha_hora": "2026-11-15T09:00:00.000Z",
    "estado": "booked",
    "motivo_cancelacion": null
  }
]
```

## Componentes de UI

### ScheduleScreen (modificado)

Nuevos elementos añadidos a la versión existente:

| Elemento | Descripción | Estado inicial |
|----------|-------------|----------------|
| `serviceName` | Texto título servicio seleccionado | Cargado desde route.params |
| `servicePrice` | Texto precio servicio | Cargado desde route.params |
| `datePicker` | Componente DatePicker expo | `selectedDate` state |
| `timeSelector` | Lista horarios disponibles | `availableTimes` state |
| `bookButton` | "AGENDAR CITA" | `disabled` cuando !date || !time |
| `section` de disponibilidad | Nueva sección debajo de hora | Carga lazy |

### ConfirmationScreen (nueva o modal)

| Campo | Contenido |
|-------|-----------|
| `serviceName` | "Corte de cejas" |
| `servicePrice` | "$45.00" |
| `dateText` | "15/11/2026" |
| `timeText` | "9:00 AM" |
| `bookButton` | "Confirmar" (POST API) |

## Notificaciones Visuales

### Tipo: Reserva exitosa
- Componente: `Toast` o `Snackbar`
- Mensaje: "¡Cita agendada exitosamente!" 
- Duración: 3 segundos
- Acción: "Ver cita" → navegar a MyAppointments
- Icon: Ionicons `checkmark-circle`

### Tipo: Cancelación exitosa
- Mensaje: "Cita cancelada correctamente"
- Acción: "Ver historial" → navegar a MyAppointments
- Icon: Ionicons `trash`

### Tipo: Recordatorio (opcional)
- Si implementar push notifications futurible
- No es MVP p0

## State Flow (Diagrama simplificado)

```
Home/Catalog
    ↓ tap servicio
Schedule (serviceId cargado)
    ↓ select date
    ↓ select time
    ↓ tap "AGENDAR CITA"
    → POST /appointments (API)
    ↓ éxito
Confirmation (datos guardados)
    ↓ navegar
MyAppointments (lista actualizada)
```

## Manejo de Errores

| Escenario | UI Response | Log/Console |
|-----------|-------------|-------------|
| API 409 conflicto horario | Toast "Este horario ya está ocupado" | rg error code |
| API 401 sin auth | RedirectLogin + limpiar storage | "Token inválido" |
| API 400 datos inválidos | FormularioError con mensajes | "Validación falló: ..." |
| User cierra app antes de confirmar | Estado pending → lost | "Cita no guardada" |

## Design Tokens (estilos Schedule)

### Colores sección fecha/hora

```
Fecha texto: #6B3752 (ciruela)
Icono calendar/time: #8F9B96 (salvia)
Fondo dateInput: #F9FAFB (gris muy claro)
Fondo timeSelector: #FFFFFF (blanco)
Borde inputs: #D1D5DB (gris neutral)
Texto placeholder: #8F9B96
Botón bookButton background: #6B3752 (ciruela)
Texto bookButton: #FFFFFF (blanco)
```

## Acceptance Criteria
- [ ] Seleccionar servicio de catálogo navega a Schedule con serviceId
- [ ] DatePicker mínimo hoy, máximo 90 días
- [ ] Horarios disponibles 9AM-5PM, cada hora
- [ ] Fin de semana: horarios deshabilitados o reducidos
- [ ] Botón AGENDAR está disabled cuando faltan campos
- [ ] POST /appointments exitoso crea cita en DB
- [ ] Datos de confirmación mostrados correctamente
- [ ] Navegación a MyAppointments después de confirmar
- [ ] Manejo de error 409 (horario ocupado) muestra Toast
- [ ] Manejo de error 401 redirige login