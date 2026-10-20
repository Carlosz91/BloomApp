# Tasks: Make BloomApp Functionally Complete

## Schema: gentle-ai.sdd-tasks/v1

### Task List

#### T1: Initialize Backend Database
- **Description**: Run `node src/init-db.js` to create SQLite tables and seed 5 default services
- **Expected Result**: Database file created at `./database.sqlite` (or path per config), 5 services inserted
- **Dependencies**: None
- **Risk Level**: Low (database schema already defined)
- **Done When**: `database.sqlite` exists and contains `users`, `services`, `appointments` tables with 5 services

#### T2: Configure AuthContext with Real API Calls
- **Description**: Modify `frontend/src/context/AuthContext.js` to replace mock logic with real API calls
- **Sub-tasks**:
  - [ ] Replace `login()` function: POST /auth/login with email/payload, store JWT in AsyncStorage
  - [ ] Replace `register()` function: POST /auth/register with user data, store token
  - [ ] Add `logout()` function: POST /auth/logout, clear token from AsyncStorage
  - [ ] Add `getCurrentUser()`: Retrieve token from AsyncStorage, return user object or null
  - [ ] Add `authenticateToken` logic or use server middleware for protected routes
- **Expected Result**: AuthContext exports login, register, logout, getCurrentUser with real backend integration
- **Dependencies**: Backend server running on port 3000
- **Risk Level**: Medium (auth is critical; test thoroughly)
- **Done When**: User can register/login, token stored, getCurrentUser returns user data

#### T3: Connect Services API in HomeScreen
- **Description**: Replace mock services state with real `GET /services` fetch in HomeScreen
- **Sub-tasks**:
  - [ ] Modify `useEffect` in HomeScreen: fetch from `http://localhost:3000/services` with auth header
  - [ ] Add error handling: show toast on fetch failure
  - [ ] Update state with real services data
  - [ ] Implement category filter state (cebras/rostro/todos)
  - [ ] Pass selected serviceId via navigation to ScheduleScreen
- **Expected Result**: HomeScreen displays real services from backend, category filters work
- **Dependencies**: T2 (AuthContext operational), backend running
- **Risk Level**: Medium (API response shape must match component expectations)
- **Done When**: HomeScreen mounts, services loaded from API, category filter updates list

#### T4: Connect Reservation Flow in ScheduleScreen
- **Description**: Uncomment and implement `POST /appointments` in ScheduleScreen for booking appointments
- **Sub-tasks**:
  - [ ] Modify date/time selection state management
  - [ ] Implement `bookAppointment` function: POST /appointments with body { user_id, service_id, fecha_hora }
  - [ ] Extract user_id from AuthContext getCurrentUser()
  - [ ] Handle success: toast "Cita agendada", navigate to /appointments
  - [ ] Handle 409 conflict: toast "Horario ocupado, por favor elige otro tiempo"
  - [ ] Handle 401 error: toast "Sesión expirada, por favor inicia sesión de nuevo", redirect to /login
  - [ ] Handle other errors: toast genérico con mensaje del servidor
- **Expected Result**: User can book appointment, receives feedback, navigates to my appointments
- **Dependencies**: T3 (HomeScreen connected), T2 (AuthContext), backend running
- **Risk Level**: Medium (time slot validation, conflict handling)
- **Done When**: Appointment books successfully, user redirected to MyAppointments, appropriate toast shown for errors

#### T5: Connect My Appointments Screen
- **Description**: Implement `GET /appointments` fetch in MyAppointmentsScreen and classify into "próximas" vs "historial"
- **Sub-tasks**:
  - [ ] Modify `useEffect` to fetch from `http://localhost:3000/appointments` with auth header
  - [ ] Handle error states and show appropriate feedback
  - [ ] Classify appointments:
    - `próximas`: fecha_hora > ahora AND estado != 'cancelled'
    - `historial`: fecha_hora < ahora OR estado = 'cancelled'
  - [ ] Add swipe/action to cancel appointment → PUT /appointments/:id
  - [ ] Add pull-to-refresh or auto-refetch on mount
  - [ ] Render two sections: "Próximas citas" and "Historial"
- **Expected Result**: MyAppointmentsScreen shows real appointments, correctly classified, cancel works
- **Dependencies**: T2 (AuthContext), T4 (Schedule booking works), backend running
- **Risk Level**: Medium (data classification logic, date comparisons)
- **Done When**: Screen mounts, appointments fetched, correctly split into two sections, cancel functionality works

#### T5a: Add Toast Notifications (expo-toast)
- **Description**: Install and configure expo-toast, replace all alert() calls
- **Sub-tasks**:
  - [ ] `npx expo install expo-toast`
  - [ ] Create reusable Toast component or use expo-toast API directly
  - [ ] Replace all `alert()` calls in:
    - HomeScreen (service selection, error messages)
    - ScheduleScreen (booking success/failure)
    - MyAppointmentsScreen (cancel confirmation, error messages)
    - ProfileScreen (save changes, error messages)
    - AuthContext (login/register errors)
  - [ ] Implement per spec-notifications.md types: success, error, info, warning
- **Expected Result**: Consistent toast notifications throughout the app, no alert() calls
- **Dependencies**: None (standalone package installation)
- **Risk Level**: Low (package installation, simple replacements)
- **Done When**: `expo-toast` installed, all alerts replaced, toast types working

#### T6: Final Integration Test
- **Description**: End-to-end test of complete user flow
- **Sub-tasks**:
  - [ ] Start backend: `node src/server.js`
  - [ ] Start app: `expo start` or run on device/emulator
  - [ ] Full flow test 1: Register → Verify account created → Login → Home shows services
  - [ ] Full flow test 2: Select service → Schedule appointment → Confirmation → My Citas shows it
  - [ ] Full flow test 3: Cancel appointment → Removed from list or marked cancelled
  - [ ] Category filter test: Select "Cejas" → Only ceja services shown
  - [ ] Error handling test: Invalid login → toast error, redirect to register
- **Expected Result**: Complete user journeys work without console errors
- **Dependencies**: T1-T5 all complete
- **Risk Level**: High (integration of multiple components)
- **Done When**: All full flow tests pass, no uncaught errors, UI consistent

### Task Dependencies Graph

```
T1 (init-db)       → T2 (AuthContext) → T3 (HomeScreen services)
     ↘                      ↓
       → T5a (toast) → T6 (integration)
     ↗                      ↓
T4 (Schedule booking) → T5 (My Citas) → T6 (integration)
```

### Success Criteria (Per-Phase)

| Phase | Criteria |
|-------|----------|
| T1-Done | `database.sqlite` exists with 5 services seeded |
| T2-Done | AuthContext.login() returns real JWT, getCurrentUser() returns user |
| T3-Done | HomeScreen renders services from API, category filter functional |
| T4-Done | Appointment books, success toast shown, navigation to /appointments |
| T5-Done | MyAppointmentsScreen shows real appointments, cancel works |
| T5a-Done | All alerts replaced with toast, expo-toast installed and working |
| T6-Done | End-to-end flows work, no console errors from API calls |

### Notes
- All tasks depend on the backend server running (`node src/server.js`)
- T5a (toast) can be done in parallel with other tasks
- T6 (integration) is the final validation of all previous tasks
- The existing UI polish (theme, typography, spacing) should be preserved throughout
- Error handling should match the existing patterns (smooth transitions, proper feedback)