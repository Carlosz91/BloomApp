# Specification: Make BloomApp Functionally Complete

## Schema: gentle-ai.sdd-spec/v1

### Core Features

#### 1. Authentication System
- **Register**: POST /auth/register with email, password (bcrypt hashed), nombre, telefono
- **Login**: POST /auth/login with email, password (bcrypt verified), returns JWT token
- **Token Storage**: AsyncSecureStorage (expo-session-store) with token key `@bloomapp/token`
- **Auth Context**: Replace mock login/fetch with real API calls
- **Protected Routes**: All appointment screens require valid JWT in Authorization header
- **Logout**: POST /auth/logout, clear token from storage

#### 2. Services Catalog
- **GET /services**: Fetch all active services (returns nombre, descripcion, precio, duracion_minutos, categoria)
- **Category Filter**: Filter by 'cejas' or 'rostro' via query parameter or client-side filtering
- **Service Details**: Each service has ID, name, description, price (number), duration (minutes)
- **Integration**: HomeScreen useEffect replaces mock fetch with real API call
- **Data Flow**: Backend → JSON → FlatList → ServiceCard → Navigation to Schedule with serviceId

#### 3. Reservation Flow
- **POST /appointments**: Book appointment with body:
  - `user_id`: string (from decoded JWT)
  - `service_id`: string (service selected from catalog)
  - `fecha_hora`: ISO datetime string (user-selected date + time)
  - `motivo_cancelacion`: string (optional, for cancellations)
- **Availability Validation**: Backend checks slot availability, returns 409 if occupied
- **Success Response**: Appointment object with id, user_id, service_id, fecha_hora, estado
- **Error Handling**:
  - 400: Invalid data format
  - 401: Invalid/missing token
  - 403: Insufficient permissions
  - 409: Slot already booked
  - 500: Server error
- **Navigation**: After successful booking, navigate to `/appointments` (My Appointments screen)

#### 4. My Appointments
- **GET /appointments**: Fetch appointments for authenticated user
- **Classification**:
  - `próximas`: appointments with fecha_hora > now and estado != 'cancelled'
  - `historial`: appointments with estado = 'cancelled' or fecha_hora < now
- **Cancel Function**: PUT /appointments/:id with `{ estado: 'cancelled', motivo_cancelacion }`
- **Refresh Logic**: Pull-to-refresh or auto-refetch on screen mount

#### 5. Toast Notifications
- **Install**: `npx expo install expo-toast`
- **Types** (per spec-notifications.md):
  - `success`: Reservation confirmed, profile updated
  - `error`: Invalid credentials, slot occupied, network error
  - `info`: General information messages
  - `warning`: Caution messages (e.g., "You have 3 upcoming appointments")
- **Component**: Reusable Toast component using `expo-toast` API or custom implementation
- **Replacement**: All `alert()` calls replaced with `Toast.show({
  type: 'success'/`error`/`info`/`warning`,
  title: '...',
  description: '...',
  duration: 3000,
  position: 'bottom'
})`
- **Integration**: Used throughout screens for form submissions, API responses, user actions

### API Endpoints (from backend)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/register | No | Register new user |
| POST | /auth/login | No | Login, return JWT |
| POST | /auth/logout | Yes | Logout, clear token |
| GET | /services | Yes | Fetch all services |
| GET | /appointments | Yes | Fetch user's appointments |
| POST | /appointments | Yes | Book new appointment |
| PUT | /appointments/:id | Yes | Cancel/update appointment |

### Data Models

#### User (from db.js seed)
- id: UUID
- email: string (unique)
- password_hash: string (bcrypt)
- nombre: string
- telefono: string
- created_at / updated_at

#### Service (seed data)
- id: integer (1-5)
- nombre: string ('Ceja', 'Rostro', etc.)
- descripcion: string
- precio: number (in currency units)
- duracion_minutos: integer
- categoria: string ('cejas', 'rostro')
- activo: boolean

#### Appointment
- id: UUID
- user_id: UUID (FK → users.id)
- service_id: integer (FK → services.id)
- fecha_hora: datetime
- estado: string ('confirmed', 'cancelled')
- motivo_cancelacion: string (nullable)
- created_at / updated_at

### Frontend Changes by Screen

#### AuthContext.js
- Replace mock token generation with real API calls
- Uncomment and configure AsyncStorage
- Add register function
- Add token persistence (store on login, clear on logout)
- Add authenticateToken helper or use server middleware

#### HomeScreen.js
- Replace mock `useEffect` that sets services state
- Fetch from `GET /services` with auth token header
- Implement category filter state (cejas/rostro/todos)
- Pass selected serviceId to Schedule navigation

#### ScheduleScreen.js
- Uncomment `POST /appointments` fetch block
- Construct body with `user_id` from AuthContext token
- Construct `fecha_hora` from datepicker + timeselector values
- Handle response: toast success, navigate to /appointments
- Handle errors: 409 → toast "Horario ocupado", 401 → redirect to login, others → toast error

#### MyAppointmentsScreen.js
- Uncomment `GET /appointments` fetch with auth token
- Classify into "próximas" vs "historial" based on fecha_hora and estado
- Add cancel button → PUT /appointments/:id with cancellation reason
- Pull-to-refresh or auto-refetch on mount

#### ProfileScreen.js
- Uncomment fetchProfile useEffect
- Display user datos (nombre, telefono, email)
- Add actualizar perfil functionality (PUT /profile)
- Add cambiar contraseña functionality (PUT /password)

#### Bottom Tabs Navigation
- Maintain existing tab structure
- Ensure auth state flows correctly between tabs
- Login tab for unauthenticated state, other tabs hidden or disabled

### Toast Notification Implementation

```javascript
// Example installation
npx expo install expo-toast

// Example usage replacing alert()
import { Toast } from 'expo-toast';

// Success
Toast.show({
  title: 'Cita agendada',
  description: 'Tu cita ha sido confirmada exitosamente',
  type: 'success',
  duration: 3000,
});

// Error
Toast.show({
  title: 'Error',
  description: 'El horario ya está ocupado, por favor elige otro tiempo',
  type: 'error',
  duration: 3000,
});
```

### Success Criteria (Testable)

| Criterion | Test |
|-----------|------|
| User registers with valid email/password | POST /auth/register returns 201 + user object (no password_hash) |
| User login returns valid JWT | POST /auth/login returns 200 + token |
| Token stored and persists | AsyncStorage has @bloomapp/token after login |
| Protected routes reject without token | Accessing /schedule without token redirects to /login |
| Home shows real services | HomeScreen mounts, useEffect fetches, FlatList renders service cards |
| Category filter works | Selecting "Cejas" filters services to cejas category only |
| Book appointment succeeds | Fill form, press Agendar, toast success, navigate to My Citas |
| Appointment appears in list | MyAppointmentsScreen mounts, GET /appointments shows the new appointment |
| Cancel works | Swipe/press cancel, PUT /appointments/:id, toast success, removed from list or marked cancelled |
| No console API errors | All fetch calls have proper error handling, no uncaught 401/500 |

### Dependencies
- **Backend**: `node src/init-db.js` then `node src/server.js` (running on port 3000)
- **Frontend packages**: `expo-toast` (install: `npx expo install expo-toast`)
- **Existing**: ThemeContext, AuthContext (to be modified), Expo Router navigation, SQLite database

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Backend not running during testing | Document requirement: always have `node src/server.js` running; use `--experimental-json-export` flag if needed |
| SQLite database not initialized | Run `node src/init-db.js` before starting server; verify tables in db file |
| JWT token mismatch between client/server | Ensure same secret key used; store decoded token payload for debugging |
| Date/time format inconsistencies | Use ISO 8601 format throughout; validate on both client and server |
| Category filter case sensitivity | Normalize to lowercase on both backend and frontend; use enum values |

### Definition of Done
- [ ] `spec-functional-app.md` reviewed and approved
- [ ] Backend database initialized (`node src/init-db.js`)
- [ ] Backend server running (`node src/server.js`)
- [ ] AuthContext: real register/login/logout with token storage
- [ ] HomeScreen: real services fetch, category filters functional
- [ ] ScheduleScreen: real appointment booking with validation
- [ ] MyAppointmentsScreen: fetch and classify appointments, cancel functionality
- [ ] All alerts replaced with toast notifications
- [ ] Theme palettes consistent across all screens
- [ ] No console errors from failed API calls
- [ ] End-to-end flow: Register → Login → Book → View → Cancel

---
*Specification connects the existing polished UI to the backend infrastructure, implementing the missing functional pieces while preserving the 3-palette design system and overall user experience.*