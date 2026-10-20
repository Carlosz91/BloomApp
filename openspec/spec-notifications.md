# Spec: Notificaciones visuales para reservas, cancelaciones y cambios de perfil

## Overview
Sistema de notificaciones visuales (toasts, snackbars, modales) para feedback inmediato al usuario sobre eventos críticos: reservas exitosas, cancelaciones, y actualizaciones de perfil.

## Tipo 1: Notificación de Reserva Exitosa

### Escenario
Usuario completa flujo de reserva (selecciona servicio → fecha/hora → confirma).

### Componente
`Toast` o `Snackbar` nativo de React Native o expo-notifications (versión light).

### Configuración visual

| Propiedad | Valor | Comentario |
|-----------|-------|------------|
| Título | "¡Cita agendada!" | Texto en negrita |
| Mensaje | "Tu cita de [servicio] es el [fecha] a las [hora]" | Dinámico |
| Ícono | Ionicons `checkmark-circle` | Color: #6B3752 (ciruela) |
| Duración | 5 segundos auto-close | O usuario toca "X" para cerrar antes |
| Acción | "Ver cita" (opcional) | Navegar a MyAppointments |
| Posición | Bottom center | 80dp sobre keyboard avoid area |
| Fondo | #FFFFFF (blanco) con sombra | elevation 4 |
| Borde | Ninguno | Opcional: radio 8px |

### Sonido (opcional, desactivado por defecto)
- No implementar en MVP p0
- Podría añadirse configuración en perfil "Sonidos de notificación"

### Integración con API flow

```javascript
const showReservationToast = (citaData) => {
  Toast.show({
    title: "¡Cita agendada!",
    description: `Tu cita de ${citaData.service.nombre} es el ${citaData.fecha.format('DD/MM')} a las ${citaData.hora}`,
    successIcon: "checkmark-circle",
    buttonText: "Ver cita",
    onAction: () => navigation.navigate('MyAppointments'),
    duration: 5000,
  });
};
```

### Trigger points en el código

| Lógica | Componente | Props passadas |
|--------|------------|----------------|
| POST /appointments éxito | ScheduleScreen → ConfirmationScreen | showReservationToast(cita) |
| Datos de cita pasados | ConfirmationScreen | Usar en Toast |

## Tipo 2: Notificación de Cancelación Exitosa

### Escenario
Usuario cancela una cita desde MyAppointments screen.

### Configuración visual

| Propiedad | Valor | Comentario |
|-----------|-------|------------|
| Título | "Cita cancelada" | |
| Mensaje | "Tu cita ha sido cancelada exitosamente" | |
| Ícono | Ionicons `trash` | Color: #EF4444 (rojo alerta) |
| Duración | 4 segundos | Auto-close |
| Acción | "Ver historial" | Navegar a MyAppointments |
| Posición | Bottom center | |

### Trigger points

| Lógica | Componente | Props passadas |
|--------|------------|----------------|
| PUT /appointments/:id cancel success | MyAppointmentsScreen después de cancelar | showCancellationToast() |

## Tipo 3: Notificación de Actualización de Perfil

### Escenario
Usuario edita y guarda sus datos de perfil (nombre, teléfono).

### Configuración visual

| Propiedad | Valor | Comentario |
|-----------|-------|------------|
| Título | "Perfil actualizado" | |
| Mensaje | "Tus datos han sido guardados correctamente" | |
| Ícono | Ionicons `checkmark-circle` | Color: #4CAF50 (verde éxito) |
| Duración | 3 segundos | Auto-close |
| Acción | Ninguna (opcional: "Ver perfil") | |
| Posición | Bottom center | |

### Trigger points

| Lógica | Componente | Props passadas |
|--------|------------|----------------|
| PUT /profile exitoso | EditProfileScreen después de guardar | showProfileUpdateToast() |

## Tipo 4: Notificación de Error

### Escenario
Cualquier operación fallida: API error, validación, conexión.

### Configuración visual

| Propiedad | Valor | Comentario |
|-----------|-------|------------|
| Título | "Ocurrió un error" | Texto negrita |
| Mensaje | Texto descriptivo según error | Dinámico según tipo |
| Ícono | Ionicons `alert-circle` | Color: #EF4444 (rojo) |
| Duración | 6 segundos (larga para leer) | Auto-close |
| Acción | "Intentar de nuevo" | Re-ejecutar operación |
| Posición | Bottom center | |

### Tipos de error y mensajes

| Tipo error | Título | Mensaje | Acción |
|------------|--------|---------|--------|
| Validación form | "Verifique los datos" | "El nombre debe tener al menos 2 caracteres" | Ninguna |
| API 401 (token expirado) | "Sesión expirada" | "Por favor, inicie sesión nuevamente" | Login |
| API 404 (resource) | "No encontrado" | "La cita solicitada no existe" | Regresar home |
| API 500 (server) | "Error del servidor" | "Intentelo más tarde" | Reintentar |
| Sin conexión | "Sin internet" | "Verifique su conexión" | Reintentar |

### Trigger points

| Lógica | Componente | Props passadas |
|--------|------------|----------------|
| Cualquier fetch API error | UseEffect hooks | showErrorToast(errorMessage) |
| Validación form submit | Form components | showValidationErrors(errors) |

## Sistema Técnico de Notificaciones

### Opción 1: Expo Toast (recomendado para MVP)

```javascript
import * as Toast from 'expo-toast';

// Ejemplo
Toast.show('¡Cita agendada!', {
  duration: 5000,
  font: {
    fontFamily: 'inter_600',
    fontSize: 16,
  },
  hideAfter: Toast.durations.longs,
  animation: 'flip',
  textAlign: 'center',
  showCloseButton: true,
  closeButtonContent: 'X',
  actions: [
    { 
      label: 'Ver cita', 
      onPress: () => navigation.navigate('MyAppointments'),
      textColor: '#6B3752',
    },
  ],
  actionTextColor: '#6B3752',
});
```

### Opción 2: react-native-toastify

```javascript
import Toast from 'react-native-toastify';

Toast.show('¡Cita agendada!', {
  duration: Toast.durations.SHORT,
  position: Toast.positions.BOTTOM,
  backgroundColor: '#FFFFFF',
  textColor: '#333333',
  iconColor: '#6B3752',
});
```

### Opción 3: Sistema custom con Animated

Para máximo control visual consistente con las 3 paletas:

```javascript
const Notification = ({ type, message, onAction }) => {
  const colors = {
    success: { bg: '#FFFFFF', icon: '#6B3752', text: '#333333' },
    error: { bg: '#FFF5F5', icon: '#EF4444', text: '#333333' },
    info: { bg: '#F5E9DC', icon: '#8F9B96', text: '#333333' },
  };
  
  const style = colors[type] || colors.info;
  
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={iconMap[type]} size={20} color={style.icon} />
      </View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};
```

## Porcentaje de uso por tipo (estimado)

| Tipo | % Uso estimado | Prioridad |
|------|---------------|-----------|
| Éxito reserva | 40% | Alta (p0) |
| Éxito perfil | 20% | Media (p1) |
| Cancelación | 20% | Alta (p0) |
| Error general | 20% | Alta (p0) |

## Accessibility

- Contraste mínimo 4.5:1 para texto de mensaje
- Tiempo suficiente para leer (mínimo 3 segundos)
- Botón de acción accesible con VoiceOver/TalkBack
- Para usuarios con discapacidad visual, considerar notificación sonora (opcional)
- `accessibilityLabel` en todos los componentes Toast

## Design Tokens (notifications summary)

```json
{
  "success": {
    "background": "#FFFFFF",
    "iconColor": "#6B3752",      // ciruela
    "textColor": "#333333",
    "duration": 5000
  },
  "error": {
    "background": "#FFF5F5",      // rojo muy claro
    "iconColor": "#EF4444",      // rojo fuerte
    "textColor": "#333333",
    "duration": 6000
  },
  "info": {
    "background": "#F5E9DC",      // ciruela muy claro (usado por defecto)
    "iconColor": "#8F9B96",      // salvia
    "textColor": "#333333",
    "duration": 4000
  },
  "positions": {
    "bottomCenter": "bottom: 80dp, left: 50%, transform: [{ translateX: -50% }]",
    "topCenter": "top: 80dp, left: 50%, transform: [{ translateX: -50% }]"
  }
}
```

## Integration Priority

1. **P0 (MVP)**: Toast de éxito reserva, Toast de error genérico
2. **P1**: Toast de cancelación, Toast de perfil actualizado
3. **P2**: Sonidos opcionales, notificaciones persistentes (expo-notifications)

## Acceptance Criteria
- [ ] Toast éxito reserva muestra con ícono checkmark, duración 5s, acción "Ver cita" funcional
- [ ] Toast error muestra mensaje descriptivo, duración 6s, acción "Intentar de nuevo"
- [ ] Toast cancelación muestra ícono trash, duración 4s, acción "Ver historial" funcional
- [ ] Toast perfil actualizado muestra ícono check verde, duración 3s
- [ ] Todos los Toast tienen `accessibilityLabel` en español
- [ ] Colores consistentes con paleta ciruela (#6B3752), salvia (#8F9B96), fondo (#F5E9DC)
- [ ] Los Toast no se superponen cuando múltiples aparecen seguidas (queue system)
- [ ] Toast no interfiere con inputs visibles ni keyboard
- [ ] Error types mapeados correctamente a tipos visuales (success/error/info)
- [ ] Fallback cuando expo-toast no disponible: componente custom renderizable