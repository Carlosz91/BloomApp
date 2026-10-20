# Spec: Perfil de clienta editable

## Overview
Pantalla de perfil donde la clienta puede editar sus datos personales: nombre, número de teléfono, y configuraciones básicas. Guardado en backend con JWT auth.

## Data Model (SQLite - users table existente)

### Tabla `users` (existente)

| Campo | Tipo | Restricciones |
|-------|------|--------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| email | TEXT | UNIQUE, NOT NULL |
| password_hash | TEXT | NOT NULL |
| nombre | TEXT | DEFAULT NULL |
| telefono | TEXT | DEFAULT NULL |
| creado_en | DATETIME | AUTOMÁTICO |
| actualizado_en | DATETIME | AUTOMÁTICO |

## Pantalla Perfil (EditProfileScreen)

### Layout

```
┌─────────────────────────────────────────────┐
|       MI PERFIL LÚMINA BEAUTY STUDIO        │
|  [x] Cerrar                                 │
├─────────────────────────────────────────────┤
│  👤 Nombre                                    │
│  [ --------------------------------------- ] │
│                                              │
│  📱 Teléfono                                  │
│  [ --------------------------------------- ] │
│                                              │
│  ✉️ Correo electrónico (solo lectura)         │
│  usuario@luminabeauty.com                    │
│                                              │
│  🔐 Contraseña (cambiar)                      │
│  [ ******** ]                                 │
│                                              │
│  [ ] Notificaciones push                      │
│  [ ] Aceptar términos y condiciones          │
├─────────────────────────────────────────────┤
|  [Guardar cambios]                            │
└─────────────────────────────────────────────┘
```

### Campos del formulario

| Campo | Tipo | Requerido | Validación | Almacenamiento |
|-------|------|-----------|------------|----------------|
| Nombre | TextInput | No | Mínimo 2 chars, máximo 50 | `users.nombre` |
| Teléfono | TextInput | No | Patrón: solo números, 10 dígitos | `users.telefono` |
| Correo | Display only | N/A | Formato email, sin editar | `users.email` (backend) |
| Contraseña | TextInput + Toggle | No | Mínimo 8 chars, 1 mayúscula, 1 número | `users.password_hash` (hash nuevo) |
| Notificaciones | Switch | No | Estado booleano | `push_notifications` (columna extra o flag) |
| Términos | Checkbox | No | Requerido si API lo exige | flags locales |

### Integración API

#### GET /profile (obtener datos user)

**Headers:** `Authorization: Bearer <token>`

**Respuesta 200:**
```json
{
  "id": 5,
  "email": "usuario@luminabeauty.com",
  "nombre": "Camila",
  "telefono": "5551234567"
}
```

**Errores:**
- 401 → redirect login, limpiar storage token
- 404 → user no encontrado (caso raro)

#### PUT /profile (actualizar datos)

**Headers:** `Authorization: Bearer <token>`

**Cuerpo request:**
```json
{
  "nombre": "Camila Actualizada",
  "telefono": "5557778888"
}
```

**Respuesta 200:**
```json
{
  "id": 5,
  "email": "usuario@luminabeauty.com",
  "nombre": "Camila Actualizada",
  "telefono": "5557778888",
  "actualizado_en": "2026-11-15T20:30:00.000Z"
}
```

**Errores:**
- 400 validación falló (nombre muy corto, teléfono no numérico)
- 401 token inválido
- 403 sin permisos (solo dueña del profile)

#### PUT /password (cambiar contraseña)

**Cuerpo request:**
```json
{
  "current_password": "password_actual",
  "new_password": "nueva_segura_123"
}
```

**Validaciones en backend:**
- current_password debe coincidir con hash almacenado
- new_password: mínimo 8 chars, máximo 64
- password strength: 1 mayúscula, 1 número, 1 minúscula (opcional)

### Integración con Engram (modo hybrid)

Al guardar perfil, además de actualizar backend, también guardar en Engram:

```
topic_key: profile/bloomapp/{userId}
content: { 
  nombre: string, 
  telefono: string, 
  email: string, 
  lastUpdated: ISOString, 
  version: 1 
}
```

Esto permite recovery cross-session sin necesidad de re-fetch profile completo si no cambió.

## Componentes de UI

### PerfilCard (itera campos)

| Sub-componente | Campo | Props |
|----------------|-------|-------|
| `FieldRow` | Nombre/Valor | `label`, `value`, `editable`, `onChangeText` |
| `PhoneInput` | Teléfono | `pattern`, `value`, `onChangeText`, `keyboardType` |
| `SwitchRow` | Notificaciones | `label`, `value`, `onToggle` |
| `SaveButton` | Guardar cambios | `disabled`, `onPress` |

### FieldRow componente

```javascript
const FieldRow = ({ label, value, editable, onChangeText }) => (
  <View style={styles.fieldRow}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputContainer}>
      {editable ? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
        />
      ) : (
        <Text style={styles.valueDisplay}>{value}</Text>
      )}
    </View>
  </View>
);
```

### Validation Feedback

| Error type | UI Message | ClassName añadida |
|------------|------------|-------------------|
| nombre muy corto (< 2) | "Nombre debe tener al menos 2 caracteres" | inputError |
| teléfono inválido (no 10 dígitos) | "Teléfono inválido: 10 dígitos requeridos" | inputError |
| email no válido (si se edita) | "Correo electrónico no válido" | inputError |
| éxito | Ningún mensaje | successBorder (verde) |

## Design Tokens (estilos perfil)

### Colores y fondos

```
Fondo pantalla: #F5E9DC (ciruela muy claro)
Fondo sección: #FFFFFF (blanco)
Fondo input: #F9FAFB (gris muy claro)
Borde input normal: #D1D5DB (gris neutral)
Borde input focused: #6B3752 (ciruela fuerte)
Borde input error: #EF4444 (rojo)
Texto label: #6B3752 (ciruela)
Texto valor display: #333333 (gris oscuro)
Texto placeholder: #8F9B96 (salvia)
Botón Guardar background: #6B3752 (ciruela)
Botón Guardar texto: #FFFFFF (blanco)
Switch onToggle: #6B3752 (ciruela)
Texto "Cerrar": #8F9B96 (salvia)
```

### Estados de input

| Estado | Borde | Texto placeholder | Comentario |
|--------|-------|-------------------|------------|
| Normal | #D1D5DB | #8F9B96 | Estado por defecto |
| Focado (tap) | #6B3752 (ciruela) | N/A | Usuario tocando |
| Con error | #EF4444 (rojo) | Mensaje error | Validación falló |
| Successfully saved | #4CAF50 (verde) | "Guardado" 1s | Toast luego |

### Íconos por campo

| Campo | Ionicons name | Color |
|-------|--------------|-------|
| Nombre | `person` | #6B3752 |
| Teléfono | `call` | #6B3752 |
| Correo | `mail` | #8F9B96 |
| Contraseña | `lock` | #6B3752 |
| Notificaciones | `notifications` | #6B3752 |

## State Management

```javascript
const [profile, setProfile] = useState({
  nombre: '',
  telefono: '',
  email: '' // readonly
});
const [editing, setEditing] = useState(false);
const [errors, setErrors] = useState({});

const camposEditable = {
  nombre: true,
  telefono: true,
  email: false, // siempre readonly
  password: false // opcional, toggle
};
```

### Lógica save

```javascript
const handleSave = async () => {
  // 1. Validar campos localmente
  const valid = validateProfile(profile);
  if (!valid) {
    setErrors(valid.errors);
    return;
  }
  
  // 2. POST /profile al backend
  const token = await getTokenFromStorage();
  const res = await fetch('http://localhost:3000/profile', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ nombre: profile.nombre, telefono: profile.telefono })
  });
  
  // 3. Manejar respuesta
  if (res.ok) {
    const data = await res.json();
    setProfile(data); // actualizar state local
    saveToEngram('profile/bloomapp/${data.id}', data); // persistence hybrid
    Toast.show('Perfil actualizado'); // visual notification
    setEditing(false); // volver a modo view
  } else {
    const errData = await res.json();
    setErrors(errData.errors || { generic: 'Error al guardar' });
  }
};
```

## API Contract Summary

| Endpoint | Method | Auth | Body | Response |
|----------|--------|------|------|----------|
| GET /profile | GET | ✅ JWT | - | {id, email, nombre, telefono} |
| PUT /profile | PUT | ✅ JWT | {nombre?, telefono?} | {id, email, nombre, telefono, actualizado_en} |
| PUT /password | PUT | ✅ JWT | {current_password, new_password} | {success: true} |

## Acceptance Criteria
- [ ] GET /profile retorna datos user correctamente con auth token
- [ ] Formulario muestra nombre y teléfono actuales
- [ ] Correo electrónico es solo lectura (display only)
- [ ] Inputs validan formato al salir (onBlur)
- [ ] Botón "Guardar cambios" deshabilitado cuando no hay cambios
- [ ] PUT /profile exitoso actualiza datos en backend y Engram
- [ ] Toast confirma "Perfil actualizado" después de save
- [ ] setEditing false vuelve pantalla a modo view-only
- [ ] Errores de validación muestran mensajes claros en inputs
- [ ] Campo teléfono acepta solo números y valida 10 dígitos
- [ ] Botón Cerrar (x) cancela edición y vuelve sin guardar