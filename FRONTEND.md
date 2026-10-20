# BloomApp — Frontend (Expo / React Native)

Documentación de referencia del frontend al estado actual (octubre 2026).

---

## 1. Stack

| Componente | Versión / elección |
|---|---|
| Expo SDK | `~58.0.16` (Requiere Node >= 22.13 → Docker usa `node:26`) |
| React Native | `0.88.0` (Hermes → sin `Intl` completo) |
| React | `19.3.0` |
| Navegación | `expo-router ~58.0.24` (file-based routing en `src/app/`) |
| Fuentes | `@expo-google-fonts/inter` (Inter 400/600) |
| Iconos | `@expo/vector-icons` (Ionicons) |
| Persistencia local | `@react-native-async-storage/async-storage 2.2.0` |
| Web | `react-native-web 0.21.4` |

**No hay calendario externo ni nuevas dependencias de UI**: todo lo visual se construye con componentes nativos (`Animated`, `ScrollView`, `FlatList`) más el sistema de tokens propio.

---

## 2. Estructura de carpetas

```
frontend/
├── app.json, package.json          ← config Expo
└── src/
    ├── app/                        ← RUTAS (solo routing; la lógica vive en screens/)
    │   ├── _layout.js              ← Stack raíz: redirección por token (index → onboarding/home)
    │   ├── index.js                ← redirect: token ? /home : /onboarding
    │   ├── (auth)/
    │   │   ├── _layout.js
    │   │   ├── onboarding.js       ← carrusel de bienvenida (3 pasos)
    │   │   ├── login.js
    │   │   └── signup.js
    │   └── (tabs)/
    │       ├── _layout.js          ← Tabs inferiores: Home · Agendar · Citas · Perfil
    │       ├── home.js             ← Vitrina (solo lectura, sin acciones de agendado)
    │       ├── schedule.js         ← Agendamiento completo (selector + formulario ⇄ botón atrás)
    │       ├── appointments.js     ← Mis citas (próximas / historial)
    │       └── profile.js
    ├── screens/                    ← Pantallas reales (rutas = wrappers)
    │   ├── HomeScreen.js           ← VITRINA (ver §3)
    │   ├── ScheduleScreen.js       ← Selector por categorías ⇄ formulario de agendado
    │   ├── MyAppointmentsScreen.js ← Citas próximas/historial + cancelación
    │   ├── ProfileScreen.js        ← Perfil real del usuario (GET /auth/me, PUT /auth/profile)
    │   ├── LoginScreen.js          ← Login (marca: solo "BloomApp")
    │   ├── SignupScreen.js
    │   └── OnboardingScreen.js     ← Carrusel animado (Animated nativo)
    ├── components/                 ← Reutilizables
    │   ├── FadeInView.js           ← Animación de entrada (delay prop)
    │   └── PrimaryButton.js        ← Botón primario/secondary (variant prop)
    ├── context/AuthContext.js      ← token + user + updateUser (AsyncStorage)
    ├── theme/
    │   ├── ThemeContext.js         ← paleta (light) + useTheme()
    │   └── tokens.js               ← spacing, radius, font, type, cardStyle(), softShadow()
    ├── services/
    │   ├── Notifications.js        ← Toasts (showSuccessToast / showErrorToast)
    │   └── UnsplashService.js      ← (legacy, no usar en pantallas actuales)
    ├── config/api.js               ← API_BASE_URL (EXPO_PUBLIC_API_URL)
    └── utils/format.js             ← formatGuaranies() (₲ sin Intl)
```

---

## 3. Concepto por pestaña (decisión de producto vigente)

| Pestaña | Rol | Acciones |
|---|---|---|
| **Home** | Vitrina para clientas: Promociones, Destacados, Novedades, Beneficios | **Cero agendamiento.** Tarjeta promos → navegar a Agenda (sin params). Destacado → Agenda con `serviceId`. |
| **Agenda** | Todo el agendamiento | Selector agrupado **Cejas / Rostro** → tap servicio → formulario (calendario + horario + confirmar) ⇄ botón "Ver categorías" |
| **Citas** | Historial | Próximas (`booked` + fecha futura) / Historial (canceladas o pasadas), badges Cancelada/Confirmada/Finalizada, cancelar con motivo |
| **Perfil** | Datos reales del usuario | GET `/auth/me`, PUT `/auth/profile`, logout |

Reglas de negocio en la UI:
- La vitrina se edita con constantes al inicio de `HomeScreen.js`: `NOVEDADES`, `BENEFICIOS`, `FEATURED_NOMBRES` (destacados se casan por nombre con el catálogo; fallback a los 2 primeros servicios).
- El flujo de Agenda es **autónomo**: funciona por pestaña sin params (`pickedServiceId`) o con params (`params.serviceId` desde Home). `activeServiceId = params.serviceId || pickedServiceId`.
- Botón "Ver categorías" del formulario: `router.setParams({ serviceId: '' })` + `setPickedServiceId(null)` → vuelve al selector.
- Calendario propio inline: lunes primero, navegación por mes, días pasados bloqueados, horizonte de 90 días.
- Horarios: `buildTimeSlots()` 9:00 AM–4:00 PM; `hourFromSlot()` convierte la etiqueta elegida a hora real dentro de `fecha_hora` (ISO con hora, no medianoche).
- Precios: siempre `formatGuaranies(precio)` (agrupación de miles manual, prefijo `₲`).

---

## 4. Estado y autenticación

`AuthContext` expone `{ token, user, login, register, logout, updateUser }`.

- Storage keys: `bloomapp_token`, `bloomapp_user`.
- `updateUser(partial)` fusiona el user en memoria y lo re-persiste (lo usa ProfileScreen tras guardar).
- Guardas de ruta: `_layout.js` raíz redirige según existencia de token; tabs protegidos por la misma lógica.
- Todos los fetch al API van con `Authorization: Bearer ${token}` (el backend exige token también para `/services`).

---

## 5. Sistema visual

- **Paleta**: `useTheme()` desde `ThemeContext` (`palette.primary`, `textMuted`, `card`, `primaryTint`, `border`, `shadow`, `error`, `onPrimary`...).
- **Tokens**: `spacing` (4/8/12/16/24/32), `radius` (8–24 + `pill`), `font` (Inter 400/600), `cardStyle(palette)` para tarjetas uniformes.
- **Animación**: `FadeInView` (entrada), `Animated.loop` (pulsos de iconos en Home), carrusel de onboarding con `useNativeDriver`.
- **Toasts**: `showSuccessToast({ title, description })` / `showErrorToast(...)` de `services/Notifications.js`.

---

## 6. API consumida

Base: `config/api.js` → `EXPO_PUBLIC_API_URL` (inline en el bundle por Metro; **debe ser la IP LAN del PC**, no localhost).

| Endpoint | Uso |
|---|---|
| `POST /auth/login` · `POST /auth/register` | AuthContext |
| `GET /services` | HomeScreen (vitrina + destacados) |
| `GET /services/:id` | ScheduleScreen (servicio activo) |
| `GET /appointments` | MyAppointmentsScreen |
| `POST /appointments` | ScheduleScreen (`bookAppointment`, body `{ service_id, fecha_hora }`) |
| `PUT /appointments/:id` | MyAppointmentsScreen (cancelar) |
| `GET /auth/me` · `PUT /auth/profile` | ProfileScreen |

---

## 7. Docker y workflow de desarrollo

- Servicio `frontend` del `docker-compose.yml` (archivo: `Dockerfile.frontend`): `node:26`, código en `/app` (¡`src/app` debe estar en la raíz del contenedor para que Expo CLI detecte el router!), volumen nombrado `frontend_node_modules` protege `node_modules` del bind `./frontend:/app`.
- Env: `EXPO_PUBLIC_API_URL=http://192.168.0.13:3000`, `REACT_NATIVE_PACKAGER_HOSTNAME=192.168.0.13`.
- **Tras cualquier cambio de código**: `docker-compose restart frontend` (el watcher de Metro vía bind-mount de Windows no detecta ediciones; el restart recarga el bundle).
- **Tras cambiar dependencias**: `docker volume rm bloomapp_frontend_node_modules && docker-compose up -d frontend`.
- URLs: web `http://localhost:8081`, teléfono `exp://192.168.0.13:8081` (Expo Go).
- Verificación rápida del bundle servido: `curl "http://192.168.0.13:8081/node_modules/expo-router/entry.bundle?platform=web&dev=true&transform.routerRoot=src/app"` y buscar marcadores (los acentos llegan como `\xE9/\xED/\xDA` — comparar sin acento).

**Gotchas conocidos**: Hermes no expone `Intl` completo (usar `utils/format.js`); PS 5.1 rompe comandos con comillas anidadas (`[char]39` para apóstrofes); errores con acentos en grep de consola (codepage).
