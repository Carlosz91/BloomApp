# Spec: Navegación inferior optimizada para móvil

## Overview
Bottom Tabs navegación optimizada para pantallas móviles, con 5 iconos principales, diseño touch-friendly y consistencia con las 3 paletas de color (ciruela, marfil, salvia).

## Navigation Structure (5 tabs)

| Ícono | Ruta (Expo Router) | Etiqueta | Descripción |
|-------|-------------------|----------|-------------|
| 🏠 | `/` | Home | Catálogo de servicios y inicio |
| 📅 | `/schedule` | Agendar | Nueva reserva de cita |
| 👁️ | `/login` | Inicio sesión | Acceso a cuenta |
| 📋 | `/my-appointments` | Mis citas | Ver y gestionar citas |
| 👤 | `/profile` | Perfil | Datos personales y configuración |

## Design Requirements

### 1. Touch Targets
- Altura mínima: 48dp (aprox. 44-48px en CSS RN)
- Espaciado entre íconos: ≥ 24dp horizontalmente
- Área activa total: ícono + etiqueta juntos
- Estados: normal / focado / seleccionado

### 2. Iconografía
- Conjunto: Ionicons (conjunto existente en proyecto)
- Tamaño ícono: 24px (inactivo), 28px (activo)
- Color ícono inactivo: #8F9B96 (salvia - tono medio)
- Color ícono activo: #6B3752 (ciruela - fuerte)
- Color etiqueta inactiva: #8F9B96
- Color etiqueta activa: #6B3752

### 3. Paletas de Color (3 opciones)

#### PALETA CIRUELA (default - usada en demo actual)
- Fondo tab bar: #F5E9DC (warm off-white)
- Fondo tab activo: #FFFFFF (blanco puro)
- Ícono/inactivo: #8F9B96 (salvia medio)
- Ícono/activo: #6B3752 (ciruela fuerte)
- Etiqueta/inactiva: #8F9B96
- Etiqueta/activa: #6B3752
- Divider separador: #D1D5DB

#### PALETA MARFIL (alternativo)
- Fondo tab bar: #F4E8DC (crema)
- Fondo tab activo: #FAF9F6 (muy blanco cálido)
- Ícono/inactivo: #A0522D (marrón rosa viejo)
- Ícono/activo: #8B7355 (marrón medio)
- Etiqueta/inactiva: #A0522D
- Etiqueta/activa: #8B7355

#### PALETA SALVIA (alternativo/accent)
- Fondo tab bar: #E8F0F1 (azul verdoso muy claro)
- Fondo tab activo: #F0F8F7 (agua muy clara)
- Ícono/inactivo: #7B9FAF (cian-verde suave)
- Ícono/activo: #5A9FAF (cian-verde fuerte)
- Etiqueta/inactiva: #7B9FAF
- Etiqueta/activa: #5A9FAF

### 4. Animated Transition

Al cambiar de tab:
- El tab seleccionado escala levemente: transform: scale(1.15)
- El tab anterior desactiva escala
- El color de ícono/etiqueta transita fluido (0.2s)
- Soporte Dark mode no requerido (solo light)

### 5. Accesibilidad

- `accessibilityLabel` en cada TouchableOpacity
- Contraste mínimo 3:1 para íconos (considerando fondo)
- Orden lógico: Home → Agendar → Login → Mis citas → Perfil
- Focus management al navegar con teclado external o screen reader

### 6. Integration with Expo Router

Cada ruta es un archivo `file.js` en `frontend/app/`:
- `app/_layout/_layout.js` - root con BottomTabs
- `app/Home/Home.js` - ruta `/`
- `app/Schedule/Schedule.js` - ruta `/schedule`
- `app/Login/Login.js` - ruta `/login`
- `app/MyAppointments/MyAppointments.js` - ruta `/my-appointments`
- `app/Profile/Profile.js` - ruta `/profile` (nueva pantalla)

### 7. State Management (bottom tabs)

```javascript
const [selectedTab, setSelectedTab] = useState('home');
const tabs = [
  { key: 'home', label: 'Home', icon: 'home', screen: HomeScreen },
  { key: 'schedule', label: 'Agendar', icon: 'calendar', screen: ScheduleScreen },
  { key: 'login', label: 'Login', icon: 'log-in', screen: LoginScreen },
  { key: 'appointments', label: 'Citas', icon: 'calendar', screen: MyAppointmentsScreen },
  { key: 'profile', label: 'Perfil', icon: 'person', screen: ProfileScreen },
];
```

### 9. Navigation Controllers

| Acción | Comportamiento |
|--------|----------------|
| Tocar tab activo | No hacer nada (ya estamos ahí) |
| Tabs con navegar a screen nueva | Animación push/slide automática de Expo Router |
| Tabs con login requerido | Si token JWT inválido → mostrar Login tab resaltado |
| Rapid tab switching | Debounce 300ms para evitar navigación múltiple |

### 10. Design Tokens (resumen completo)

```json
{
  "tabBar": {
    "backgroundColor": "#F5E9DC",       // ciruela default
    "activeBackground": "#FFFFFF",      // tab seleccionado
    "inactiveIcon": "#8F9B96",          // salvia
    "activeIcon": "#6B3752",            // ciruela
    "inactiveLabel": "#8F9B96",         // salvia
    "activeLabel": "#6B3752",           // ciruela
    "dividerColor": "#D1D5DB"           // gris neutral
  },
  "states": {
    "focused": {
      "transform": "scale(1.15)",
      "transition": { "duration": 200 }
    }
  }
}
```

## Component BottonTabNavigator

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| selectedIndex | number | 0 | Índice tab actualmente seleccionado |
| onSelect | function | - | Callback al tocar un tab |
| inactiveIconColor | string | #8F9B96 | Color ícono cuando no seleccionado |
| activeIconColor | string | #6B3752 | Color ícono cuando seleccionado |
| inactiveLabelColor | string | #8F9B96 | Color etiqueta cuando no seleccionado |
| activeLabelColor | string | #6B3752 | Color etiqueta cuando seleccionado |
| barColor | string | #F5E9DC | Color fondo del tab bar |
| barActiveItemColor | string | #FFFFFF | Fondo del tab activo |
| style | View | - | Estilos adicionales |

### Renderizado (código resumido)

```javascript
<BottomTabNavigator
  selectedIndex={selectedTab}
  onSelect={setSelectedTab}
  inactiveIconColor={colors.inactiveIcon}
  activeIconColor={colors.activeIcon}
  inactiveLabelColor={colors.inactiveLabel}
  activeLabelColor={colors.activeLabel}
>
  {tabs.map(tab => (
    <Tab key={tab.key} 
      icon={tab.icon}
      label={tab.label}
      onPress={() => onSelect(tab.key)}
    />
  ))}
</BottomTabNavigator>
```

### 13. Error Boundaries

- Si un screen del tab falla loader → mostrar estado error en ese tab específico
- No derribar toda la navegación
- Opción "Reintentar" para recargar el screen fallido

## Acceptance Criteria
- [ ] 5 tabs visibles simultáneamente en mobile (no scroll horizontal necesario)
- [ ] Touch targets mínimo 48×48dp para cada ícono+etiqueta
- [ ] Color ícono/inactivo: #8F9B96 (salvia), activo: #6B3752 (ciruela)
- [ ] Color etiqueta/inactiva: #8F9B96, activo: #6B3752
- [ ] Fondo tab bar: #F5E9DC (ciruela) por defecto
- [ ] Transición fluida al cambiar de tab (0.2s)
- [ ] `accessibilityLabel` set en todos los elementos táctiles
- [ ] Integración con Expo Router: cada ruta mapea a un tab
- [ ] Cambiar tab actual no recarga el screen (mantiene state)
- [ ] Rapid tab switching debounce 300ms mínimo
- [ ] AccesibilityLabel en español para screen readers
- [ ] Los 3 paletas (ciruela/marfil/salvia) son intercambiables via props/tokens