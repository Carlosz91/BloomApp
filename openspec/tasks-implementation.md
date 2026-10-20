# SDD Tasks: Desglose de Implementación - BloomApp

## Dependency Graph
```
proposal → specs → tasks → apply → verify → archive
      ↑
      |
    design
```

## Phase: SDD Tasks (this phase)

### Prioridades por área de negocio

| Área | Prioridad | Dependencias | Estimación |
|------|-----------|-------------|------------|
| Onboarding "para Camila" | Alta | Ninguna (pantalla standalone) | 1 sprint |
| Catálogo servicios + filtros | Alta | API services (backend) | 2 sprints |
| Flujo reserva completo | Alta | Catálogo, API appointments | 2-3 sprints |
| Mis citas + cancelación | Alta | API appointments, reserva | 2 sprints |
| Perfil editable | Media | API profile, auth JWT | 1-2 sprints |
| Navegación inferior | Media | Nueva screens (profile, my-appointments) | 1 sprint |
| 3 paletas de diseño | Media | Design tokens, theme context | 1 sprint |
| Unsplash images + atribución | Media | API Unsplash, cache strategy | 1-2 sprints |
| Notificaciones visuales | Media | Toast system, events flow | 1-2 sprints |

### Lista Completa de Tareas (ordenado por dependencia)

#### T1: Estructura de Project & Configuración Inicial ✅
- [x] Verificar sdd-init completado (hecho)
- [x] Configurar .engram/config.json con project_name=bloomapp ✅
- [x] Build skill-registry .atl/skill-registry.md ✅
- [x] Probar modo hybrid artifacts (openspec + engam) ✅
- [x] Definir palette default = ciruela
- [x] Configurar .env variables básicas (UNSPLASH_KEY placeholder)

#### T2: Onboarding "para Camila" 🟡
- [ ] Crear OnboardingScreen componente React Native
  - [ ] 3 cards secuenciales con imagens Unsplash
  - [ ] Atribución automática debajo de cada imagen
  - [ ] CTA "Empezar" navega a Login/Register
  - [ ] Guardar preferencia de palette en Engram
- [ ] Integrar Engram mem_save onboarding completion
- [ ] Verificar que no muestre onboarding 2da vez (check Engram)
- [ ] Test manual: flujo complete onboarding → login → home

#### T3: Design System - 3 Paletas Oficiales 🟡
- [ ] Finalizar design-system-3-paletas.md con todos tokens
- [ ] Crear ThemeContext React con palette state
- [ ] Implementar getPaletteColors() factory function
- [ ] Aplicar paleta ciruela a screens existentes (Login, Home)
- [ ] Crear toggle palette selector en configuración
- [ ] Persistir elección de palette en Engram topic_key design-palette/bloomapp
- [ ] Testing: cambiar de paleta y verificar que todos los colores actualicen
- [ ] Documentation: reporte comparativo 3 paletas

#### T4: Catálogo de Servicios con Filtros por Categoría 🟡
- [ ] Mejorar HomeScreen con FlatList de servicios
- [ ] Conectar API GET /services desde backend Node/Express
- [ ] Implementar filtros: Todas / Cejas / Rostro
- [ ] Badge categoría en cada tarjeta ServicioCard
- [ ] FlatList responsive: 2 columnas mobile, 3 tablets
- [ ] Tocar tarjeta → navegar a Schedule con serviceId
- [ ] Manejo loading state y error boundary API
- [ ] Testing: filtros funcionan, datos vienen del API real

#### T5: Flujo Completo de Reserva 🟡
- [ ] Modificar ScheduleScreen con nuevos campos
  - [ ] DatePicker con mín/tomáx (hoy + 90 días)
  - [ ] TimeSelector con horarios 9AM-5PM cada hora
  - [ ] Lógica disponibilidad: fin de semana reducido
- [ ] ConfirmationScreen con resumen datos
- [ ] POST /appointments API integration
  - [ ] Envío user_id desde JWT token storage
  - [ ] Manejo errores: 409 conflicto, 401 auth, 400 validación
- [ ] Toast éxito reserva (Tipo 1 del spec-notifications)
- [ ] Toast error handling (Tipo 4 del spec-notifications)
- [ ] Testing: reserva completa flow end-to-end

#### T6: Sección Mis Citas - Próximas + Historial + Cancelación 🟡
- [ ] Modificar MyAppointmentsScreen
- [ ] Clasificar citas: proximas (30 dias) vs historial (antes)
- [ ] CitaCard componente con badge estado visual
- [ ] Botón "[Cancelar]" solo para citas próximas (status booked)
- [ ] PUT /appointments/:id cancel API integration
- [ ] Toast cancelación exitosa (Tipo 2 del spec-notifications)
- [ ] Lista se actualiza automáticamente post-cancelación
- [ ] Testing: crear cita → ver en mis citas → cancelar → historial actualizado

#### T7: Perfil de Clienta Editables 🟡
- [ ] Crear EditProfileScreen
- [ ] Campos: nombre (edit), teléfono (edit), email (solo lectura)
- [ ] GET /profile API integration (con JWT auth)
- [ ] PUT /profile API integration
- [ ] Validación local: nombre ≥2 chars, teléfono 10 dígitos
- [ ] Toast perfil actualizado (Tipo 3 del spec-notifications)
- [ ] Volver a modo view-only post-save
- [ ] Testing: editar perfil → guardar → ver cambios reflejados

#### T8: Navegación Inferior Optimizada para Móvil 🟡
- [ ] Crear BottomTabNavigator con 5 tabs
  - [ ] Home (inicio)
  - [ ] Agendar (nueva reserva)
  - [ ] Login (acceso cuenta)
  - [ ] Mis Citas (ver/gestionar)
  - [ ] Perfil (editar datos)
- [ ] Íconos Ionicons + etiquetas texto
- [ ] Touch targets ≥ 48×48dp
- [ ] Colores por paleta activa (ciruela default)
- [ ] Animation transition al cambiar tab (0.2s)
- [ ] Debounce 300ms rapid tab switching
- [ ] AccessibilityLabel en español todos elementos
- [ ] Testing: navegar todos tabs, tab activo mantiene state

#### T9: Integración Unsplash Images con Atribución 🟡
- [ ] Configurar UNSPLASH_KEY en .env (placeholder)
- [ ] Crear UnsplashImage componente reutilizable
- [ ] Fetch random image por query (onboarding, home, services)
- [ ] Atribución "Foto de {username} en Unsplash" debajo
- [ ] Fallback local cuando API falla/quota agotado
- [ ] Cache en Engram por query para evitar requests redundantes
- [ ] Rate limiting: máximo 8 calls/hora aprox
- [ ] Testing: cargar 3 imágenes onboarding sin bloqueo

#### T10: Notificaciones Visuales del Sistema 🟡
- [ ] Implementar Toast system (expo-toast o custom)
- [ ] 4 tipos: éxito reserva, error, cancelación, perfil actualizado
- [ ] Colores consistentes con paleta activa
- [ ] accesibilityLabel en español
- [ ] Queue system: múltiples toast no se superponen
- [ ] Timeout automáticos (3-6 seg según tipo)
- [ ] Acción "Ver cita/Historial" funcional
- [ ] Testing: disparar cada tipo de toast y verificar UI

#### T11: Integración Backend-Frontend JWT Auth 🟡
- [ ] Verificar flujo auth: register → login → storage token
- [ ] GET /profile con token válido
- [ ] GET /services con token válido
- [ ] GET /appointments con token válido
- [ ] PUT /appointments/:id cancel con token válido
- [ ] PUT /profile update con token válido
- [ ] Manejo 401 → redirect login + limpiar storage
- [ ] Testing: ciclo auth completo mantenido en todas screens

#### T12: Testing Básico & Smoke Tests 🟢
- [ ] Configurar scripts npm test básicos
- [ ] Smoke test: flujo onboarding → login → catalog → reserve → my appointments
- [ ] Verificación visual: 3 paletas togglables
- [ ] Test manual en dispositivo/emulador
- [ ] Reportes de bugs encontrados

#### T13: Preparación Archive & Cierre 🟢
- [ ] Ejecutar sdd-archive fase final
- [ ] Generar archive-report.md con resumen completado
- [ ] Persistir todos los learnings en Engram
- [ ] Cerrar cambio SDD cycle completo
- [ ] Revisar size PR forecast vs auto-chain strategy

### Estimación de Esfuerzo Total

| Categoría | Sprints | Story Points |
|-----------|---------|--------------|
| Onboarding + Paletas | 2 sprints | 16 pts |
| Catálogo + Filtros | 2 sprints | 16 pts |
| Flujo Reserva + Mis Citas | 3-4 sprints | 24 pts |
| Perfil + Navegación + Notificaciones | 2-3 sprints | 20 pts |
| Unsplash + Auth integration | 2 sprints | 16 pts |
| Testing & Smoke Tests | 1 sprint | 8 pts |
| **Total estimado** | **12-15 sprints** | **92-94 pts** |

### Riesgos y Mitigaciones (del spec proposal)

| Riesgo | Mitigación |
|--------|-----------|
| API async backend | Feature flags, fallback a mock data |
| Performance imágenes Unsplash | Cache engam, lazy load, thumbnails first |
| State management navegación | Expo Router + context global, debounce changes |
| Design 3 paletas | Variables CSS/JS tokens, testing en device real |
| Cancelaciones consistentes | Tests de borde, PUT API validation |
| Rate limit Unsplash | Cache fuerte, fallback local, quota monitoring |

### Próximo Paso Recomendado
Proceed with `/sdd-apply` phase - implementar las tareas T1-T13 en orden dependencial, comenzando por la estructura de proyecto y onboarding.

## Skill Resolution
- `skill_resolution: paths-injected` - skill paths loaded from `.atl/skill-registry.md`
- Project: bloomapp
- Artifact store: hybrid (Engram + openspec)
- Pace: automatic
- PR strategy: auto-chain (cuando forecast > 400 lines)