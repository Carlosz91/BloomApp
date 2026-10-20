# Smoke Tests: BloomApp - Validación Rápida de Flujos Críticos

## Objetivo
Validar los flujos principales de la aplicación después de implementar las features SDD. Estos tests son verificables manualmente en dispositivo/emulador y no requieren configuración de Jest/QUnit.

## Test 1: Onboarding "para Camila" ✓
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Instalar/abrir app por 1ra vez | Onboarding muestra 3 cards secuenciales con imágenes Unsplash |
| 2 | Deslizar/siguiente en tarjetas | Navega de card 1 → card 2 → card 3 |
| 3 | Tocar "Empezar" en card 3 | Navega a LoginScreen, no muestra onboarding 2da vez |
| 4 | Verificar en Engram | Preferencia de palette y onboarding completado guardado |

## Test 2: Catálogo de Servicios con Filtros ✓
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir de Home a Catálogo | Servicios listan con tarjetas y filtros Cejas/Rostro/Todas |
| 2 | Tocar filtro "Cejas" | Solo muestran servicios categoria='cejas' |
| 3 | Tocar filtro "Rostro" | Solo muestran servicios categoria='rostro' |
| 4 | Tocar filtro "Todos" | Muestran todos los servicios activos |
| 5 | Tocar cualquier tarjeta | Navega a Schedule con serviceId correcto |

## Test 3: Flujo de Reserva Completo ✓
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Desde Home/Catalog tocar servicio | Navega a ScheduleScreen con servicio seleccionado |
| 2 | Seleccionar fecha (mín: hoy, máx: 90 días) | DatePicker acepta fecha, rechaza pasada/lejana |
| 3 | Seleccionar hora (9AM-5PM) | Lista de horarios disponibles, tap selecciona hora |
| 4 | Tocar "AGENDAR CITA" | Valida campos, muestra resultado |
| 5 | Simular reserva exitosa | Toast "¡Cita agendada!" y navega a MyAppointments |

## Test 4: Mis Citas - Próximas + Historial + Cancelar ✓
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir a Mis Citas | Muestra pestañas/tab "Próximas" y "Historial" |
| 2 | Ver "Próximas" | Muestra citas con estado bookned, botón Cancelar visible |
| 3 | Ver "Historial" | Muestra citas passadas, sin botón Cancelar |
| 4 | Tocar "Cancelar" (solo próximas) | Ejecuta cancelación, Toast confirmación |
| 5 | Cambiar entre tabs | Lista actualiza filtros automáticamente |

## Test 5: Perfil Editables ✓
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir a Perfil | Muestra datos nombre/email/telefono, email solo lectura |
| 2 | Tocar "Editar" | Cambia a modo edición, inputs becomes editables |
| 3 | Modificar nombre/teléfono | Inputs aceptan cambios, validación en tiempo real |
| 4 | Tocar "Guardar" | Guarda cambios, Toast "Perfil actualizado", vuelve modo view |
| 5 | Cancelar edición | Vuelve a modo view sin guardar cambios |

## Test 6: Navegación Inferior ✓
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ver tab bar móvil | 5 tabs visibles: Home, Agendar, Login, Citas, Perfil |
| 2 | Tocar cada tab | Navega a screen correspondiente, tab se activa |
| 3 | Tabs mantienen state | Datos persisten al cambiar y volver |
| 4 | Rapid tab switching (múltiples toques rápidos) | Debounce 300ms, no navega múltiples veces |
| 5 | Con las 3 paletas (ciruela/marfil/salvia) | Colores cambian consistentemente al cambiar tema |

## Test 7: Notificaciones Visuales ✓
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Completar reserva exitosa | Toast éxito: "¡Cita agendada!" con ícono checkmark |
| 2 | Cancelar cita próxima | Toast cancelación: "Cita cancelada correctamente" |
| 3 | Actualizar perfil | Toast info: "Perfil actualizado" |
| 4 | Error en API | Toast error: mensaje descriptivo, botón "Reintentar" |
| 5 | Con las 3 paletas | Colores del toast cambian con el tema activo |

## Test 8: 3 Paletas de Diseño ✓
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir a Configuración → Tema | Opción para cambiar entre 3 paletas |
| 2 | Seleccionar "Marfil" | Todo el UI cambia a paleta marfil (térmico/crema) |
| 3 | Seleccionar "Salvia" | Todo el UI cambia a paleta salvia (verde-azulado) |
| 3 | Seleccionar "Ciruela" (default) | Regresa a paleta púrpura original |
| 3 | Contraste AA verificado | Mínimo 4.5:1 en todos los textos/backgrounds |

## Ejecutar Validación Manual
1. Abrir app en dispositivo o emulador
2. Ejecutar cada test en secuencia
3. Anotar cualquier fallo en consola
4. Si todos los tests pasan → SDD cycle exitoso
5. Si algún test falla → Revisar spec correspondiente y corregir

## Commands para Validación Rápida
```bash
# Iniciar dev server
npx expo start

# En el simulador/device:
# - Presionar Cmd+M (iOS) o Menu (Android) para menú de dev
# - Navegar por flujos y validar

# Ver logs de errores
# Los errores de runtime aparecerán en la terminal donde se ejecutó npx expo start
```