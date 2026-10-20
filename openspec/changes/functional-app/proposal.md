# Proposal: Make BloomApp Functionally Complete

## Intent
Transform the polished BloomApp UI into a functionally complete salon appointment application by connecting the existing backend infrastructure to the frontend, implementing missing features, and ensuring all user flows work end-to-end.

## Scope
- **Authentication**: Real login/register with JWT, token storage, protected routes
- **Services Catalog**: Fetch and display real services from backend, category filtering
- **Reservation Flow**: Book appointments, validate availability, confirmation workflow
- **My Appointments**: View upcoming/historical appointments, cancel functionality
- **Notifications**: Toast notifications for all user actions (success, error, confirmation)
- **Theme**: Maintain 3-palette design system (ciruela/marfil/salvia)

## Approach
1. **Initialize backend database** (`node src/init-db.js`)
2. **Connect Auth**: Replace mock `AuthContext` with real API calls (register/login), uncomment AsyncStorage, store JWT token
3. **Connect Services API**: Replace mock services in HomeScreen with `GET /services` fetch, integrate category filters
4. **Connect Reservations**: Uncomment `POST /appointments` in ScheduleScreen, pass `user_id` from token, add toast notifications
5. **Connect My Appointments**: Uncomment `GET /appointments` in MyAppointmentsScreen, classify into "próximas" vs "historial"
6. **Add Toast Notifications**: Install `expo-toast`, create reusable component, replace `alert()` calls
7. **Final Integration Test**: Complete user flow from register → login → book appointment → view appointments

## Deliverables (in order)
1. `proposal-functional-app.md` - This proposal
2. `spec-functional-app.md` - Detailed specifications
3. `design-functional-app.md` - Technical design & architecture
4. `tasks-functional-app.md` - Implementation tasks broken down
5. Implementation via `sdd-apply` phase
6. Verification via `sdd-verify` phase
7. Archive via `sdd-archive` phase

## Success Criteria
- [ ] User can register and login with real credentials
- [ ] JWT token stored and persists across sessions
- [ ] HomeScreen displays real services from backend
- [ ] Category filters (Cejas/Rostro) work with real data
- [ ] User can book an appointment (date + time) successfully
- [ ] Appointment appears in My Appointments screen
- [ ] Cancel functionality works
- [ ] Toast notifications replace all alerts
- [ ] No console errors from failed API calls
- [ ] Theme palettes remain consistent throughout

## Risks & Mitigations
- **Risk**: Backend not running when testing
  - **Mitigation**: Ensure `node src/server.js` is running before API tests
- **Risk**: SQLite path or table schema issues
  - **Mitigation**: Run `node src/init-db.js` first; verify tables exist
- **Risk**: Token expiration or invalid auth headers
  - **Mitigation**: Test auth flow thoroughly; ensure `authenticateToken` middleware works
- **Risk**: Date/time slot conflicts
  - **Mitigation**: Backend returns 409 for occupied slots; frontend handles gracefully with toast

## References
- Existing specs: `spec-catalog.md`, `spec-reserva.md`, `spec-mis-citas.md`, `spec-notifications.md`, `spec-perfil.md`
- Existing backend: `src/server.js`, `src/db.js`, `src/init-db.js`, `src/auth.js`
- Existing UI: All 6 screens polished, ThemeContext with 3 palettes
- API routes defined in backend (see server.js endpoint list from exploration)

---
*This proposal sets the foundation for making BloomApp functionally complete while preserving the existing UI polish and 3-palette design system.*