# Spec: Onboarding "para Camila"

## Overview
Pantalla de bienvenida inicial para nueva usuaria Camila, presentando la app BloomApp y sus servicios principales antes de acceder al catálogo completo.

## Target User
- Nombre: Camila (o cualquier nueva clienta)
- Contexto: Primera vez usando la app, sin cuenta previa o creando cuenta

## Flow

### Estado A (No autenticado)
1. App inicia en `OnboardingScreen`
2. Presentar secuencia de 3 cards con:
   - Card 1: "Bienvenidx a LÚMINA BEAUTY STUDIO" + imagen Unsplash editora
   - Card 2: "Selecciona tus servicios favoritos" + filtros visuales
   - Card 3: "Agenda tu primera cita" + CTA "Empezar"
3. Al tocar "Empezar" → navegar a `LoginScreen` o `RegisterScreen`

### Estado B (Ya tiene cuenta)
1. Si token JWT válido en storage → verificar `gentle-ai review status`
2. Si sesión activa → navegar directo a `HomeScreen`
3. Si sesión expirada → mostrar `LoginScreen`

## Pantalla Onboarding (detalle)

### Componentes

| Componente | Descripción | Props |
|------------|-------------|-------|
| `OnboardingCard` | Card con título, imagen, descripción | `title`, `subtitle`, `imageUrl`, `index` |
| `OnboardingImage` | Imagen Unsplash editora (300×300) | `source`, `alt` |
| `CTAButton` | Botón principal "Empezar" | `onPress`, `disabled` |
| `SkipButton` | Opcional "Saltar" (solo 1ra vez) | `onPress` |

### Design Tokens (3 paletas)

```
PALETA CIRUELA (principal - usada por defecto):
- Fondo: #F5E9DC
- Primario: #6B3752
- Texto secundario: #8F9B96
- Acento: #A0522D (marrón rosa viejo)

PALETA MARFIL (alternativo):
- Fondo: #F4E8DC
- Primario: #8B7355
- Texto secundario: #A0522D
- Acento: #D2B48C

PALETA SALVIA (accent/alternativo):
- Fondo: #E8F0F1
- Primario: #5A9FAF
- Texto secundario: #7B9FA0
- Acento: #6C8A98
```

### Integración Unsplash
- 3 imágenes editoras pre-seleccionadas desde Unsplash API
- Cada imagen requiere atribución automática
- Formato: `Foto de {unsplash_name} en Unsplash`
- Almacenamiento: Engram topic_key `unsplash-onboarding-images`

### Guardado de preferencia
- Al completar onboarding, guardar en Engram:
  ```
  topic_key: onboarding/bloomapp/camila
  content: { completed: true, palette: 'ciruela', date: ISO-string }
  ```
- Persiste para sesiones futuras (modo hybrid)

## API Contract (ninguna - cliente-only)

## Dependencies
- `@expo-google-fonts/inter`
- `react-native-vector-icons/Ionicons`
- Engram: `mem_search`, `mem_save` para persistencia de preferencia

## Acceptance Criteria
- [ ] Onboarding muestra 3 cards secuenciales
- [ ] Imágenes Unsplash con atribución visible
- [ ] CTA "Empezar" navega a login/registro
- [ ] Preferencia de paleta guardada en Engram
- [ ] Retorno a Home si ya tiene sesión activa
- [ ] No muestra onboarding segunda vez (verifica Engram)