# Spec: Design System - 3 Paletas Oficiales de BloomApp

## Overview
Sistema de diseño oficial con 3 paletas de colores (ciruela, marfil, salvia) para uso consistente en todas las pantallas y componentes de la aplicación BloomApp.

## Paleta 1: CIRUELA (Default / Principal)

Esta es la paleta principal, usada por defecto en la versión actual y recomendada para la experiencia completa.

### Colores

| Nombre | HEX | Uso | Comentario |
|--------|-----|-----|------------|
| ciruela-oscuro | #6B3752 | Títulos principales, botones activos | El "purpura" característico |
| ciruela-medio | #8F9B96 | Texto secundario, placeholders, íconos inactivos | Gris con matiz púrpura |
| ciruela-claro | #F5E9DC | Fondos principales, tarjetas, fondo tab bar | "Background cálido" |
| ciruela-very-claro | #F9FAFB | Fondos de inputs, tarjetas secundarias | Muy claro, casi blanco |
| ciruela-accent | #A0522D | Acentos decorativos, badges | Marón-rosa viejo, complementario |
| ciruela-éxito | #4CAF50 | Notificaciones éxito, checkmarks | Verde para estados positivos |
| ciruela-error | #EF4444 | Notificaciones error, alertas | Rojo para estados críticos |

### Tipografía

| Elemento | Tamaño | Peso | Color |
|----------|--------|------|-------|
| Título H1 | 32px | 600 | #6B3752 |
| Título H2 | 24px | 600 | #6B3752 |
| Subtítulo | 14px | 500 | #8F9B96 |
| Texto cuerpo | 16px | 400 | #333333 |
| Texto caption | 12px | 400 | #8F9B96 |
| Texto pequeño | 10px | 400 | #A0522D |

### Componentes y estilos

#### Botón primary
- Fondo: #6B3752 (ciruela-oscuro)
- Texto: #FFFFFF (blanco)
- Fondo hover: #5A2E42 (más oscuro)
- Border: none
- Border radius: 8px
- Padding vertical: 12px, horizontal: 24px
- Elevation: 2
- Shadow: #000 con offset y opacity estándar

#### Botón secondary
- Fondo: transparente o #F5E9DC
- Texto: #6B3752
- Border: 1px #D1D5DB
- Mismos estilos de border-radius y padding

#### Input field
- Fondo: #F9FABG (ciruela-very-claro)
- Borde: 1px #D1D5DB (ciruela-medio)
- Border radius: 8px
- Padding horizontal: 16px, vertical: 14px
- Fuente: inter 16px regular
- Placeholder color: #8F9B96 (ciruela-medio)
- Foco border: 2px #6B3752 (ciruela-oscuro) con shadow

#### Tarjeta (card)
- Fondo: #FFFFFF (blanco puro)
- Borde: 1px #E5E7EB (invisible en light)
- Border radius: 12px
- Elevation: 2
- Shadow color: #000, offset: {width: 0, height: 2}, opacity: 0.05, radius: 4

#### Píldora de filtro (categoría)
- Fondo activo: #6B3752 (ciruela-oscuro), texto #FFFFFF
- Fondo inactivo: #FFFFFF, borde 1px #D1D5DB, texto #8F9B96
- Border radius: 20px
- Padding vertical: 6px, horizontal: 12px
- Fuente: 12px, peso 500

### Uso en pantalla

| Pantalla | Elementos que usan ciruela |
|----------|---------------------------|
| Login | Fondo #F5E9DC, texto #6B3752, slogan #8F9B96 |
| Home | Tarjetas servicio #FFFFFF, filtros activos #6B3752 |
| Schedule | Botón AGENDAR #6B3752, fondos #FFFFFF |
| My Appointments | Tarjetas #FFFFFF, botones cancelar #EF4444 |
| Perfil | Botón Guardar #6B3752, inputs #F9FAFB |

## Paleta 2: MARFIL (Alternativo)

Paleta cálida alternativa para marcas que quieran una identidad diferente a la púrpura principal.

### Colores

| Nombre | HEX | Uso | Comentario |
|--------|-----|-----|------------|
| marfil-oscuro | #8B7355 | Títulos principales, texto | Marón medio-oscuro |
| marific-medio | #A0522D | Texto secundario, placeholders | Similar a ciruela-accent |
| marfil-claro | #F4E8DC | Fondos principales, muy cálido | "Cremoso" en lugar de "púrpura" |
| marifl-very-claro | #FAF9F6 | Fondos de inputs, muy claro | Blanco humeante |
| marfil-accent | #D2B48C | Acentos decorativos | Blanco con matiz marrón |
| marifl-éxito | #8FB973 | Notificaciones éxito | Verde oliva |
| marifl-error | #ED8936 | Notificaciones error | Naranja fuerte |

### Diferencias vs. Ciruela

| Aspecto | Ciruela | Marfil |
|---------|---------|--------|
| tono base | púrpureo/frío | cálido/amarronado |
| asociación | lujo, modernidad | calidez, tradición |
| mejor para | tech, belleza urbana | salones clásicos, artesanal |
| contraste con texto | mejor sobre fondos claros | mejor sobre fondos muy claros |

### Componentes con marfil

| Componente | Estilo marfil |
|------------|---------------|
| Fondo pantalla | #F4E8DC en lugar de #F5E9DC |
| Texto título | #8B7355 en lugar de #6B3752 |
| Texto secundario | #A0522D en lugar de #8F9B96 |
| Input fondo | #FAF9F6 en lugar de #F9FAFB |
| Botón primary | #8B7355 en lugar de #6B3752 |

## Paleta 3: SALVIA (Acente / Alternativa)

Paleta fresca, inspirada en el color salvia (lavanda-verde), para aplicaciones que busquen una estética más natural, relajante o sanitaria.

### Colores

| Nombre | HEX | Uso | Comentario |
|--------|-----|-----|------------|
| salvia-oscuro | #5A9FAF | Títulos principales, acción principal | Cian-verde fuerte |
| salvia-medio | #7B9FAF | Texto secundario, placeholders | Verde-azulado medio |
| salvia-claro | #E8F0F1 | Fondos principales, muy claro | "Agua" o "hielo" |
| salvia-very-claro | #F0F8F7 | Fondos de inputs, light | Casi blanco verdoso |
| salvia-accent | #6C8A98 | Acentos decorativos | Verde-azulado suave |
| salvia-éxito | #4CAF50 | Notificaciones éxito | Similar a otras paletas |
| salvia-error | #EF4444 | Notificaciones error | Rojo (independiente de palette) |

### Diferencias vs. Ciruela y Marfil

| Aspecto | Ciruela | Marfil | Salvia |
|---------|---------|--------|--------|
| familia | púrpura | marrón/crema | verde-azulado |
| sensación | elegante, sofisticado | cálido, artesanal | relajante, natural |
| mejor uso | salón de moda, urbano | salón tradicional, campo | spa, wellness, naturaleza |
| temperatura | fría/neutra | cálida | fresca/aireada |

### Componentes con salvia

| Componente | Estilo salvia |
|------------|---------------|
| Fondo pantalla | #E8F0F1 en lugar de #F5E9DC |
| Texto título | #5A9FAF en lugar de #6B3752 |
| Texto secundario | #7B9FAF en lugar de #8F9B96 |
| Input fondo | #F0F8F7 en lugar de #F9FAFB |
| Botón primary | #5A9FAF en lugar de #6B3752 |
| Badge categoría | #7B9FAF con texto #FFFFFF |

## Sistema de Tema Dinámico

### Implementación técnica

```javascript
// Theme context provider
const ThemeContext = React.createContext({
  palette: 'ciruela', // 'ciruela' | 'marfil' | 'salvia'
  setPalette: (palette: string) => {},
  colors: { /* objecto con todos los tokens */ }
});

// Factory de colores por palette
const getPaletteColors = (palette) => {
  switch (palette) {
    case 'ciruela':
      return { primary: '#6B3752', secondary: '#8F9B96', background: '#F5E9DC' };
    case 'marfil':
      return { primary: '#8B7355', secondary: '#A0522D', background: '#F4E8DC' };
    case 'salvia':
      return { primary: '#5A9FAF', secondary: '#7B9FAF', background: '#E8F0F1' };
    default:
      return getPaletteColors('ciruela');
  }
};

// Uso en componentes
const colors = useContext(ThemeContext);
const [palette, setPalette] = useState('ciruela'); // default

// Persistir elección en Engram
useEffect(() => {
  mem_save({
    content: `Chose palette: ${palette}`,
    topic_key: 'design-palette/bloomapp',
    type: 'decision',
    scope: 'personal',
    title: 'Design Palette Selection'
  });
}, [palette]);
```

### Persistencia de elección

- Al usuario se le pregunta al primer inicio (después de onboarding)
- Elección guardada en Engram topic_key `design-palette/bloomapp`
- Persiste across sessions en modo hybrid
- Puede cambiarse en Configuración → "Tema de colores"
- Default siempre: ciruela (para consistencia con versión existente)

### Intercambio en tiempo de pantalla

Algunos componentes aceptan `palette` prop en lugar de usar context:

```javascript
<Button palette="salvia" variant="primary">
  Agendar Cita
</Button>
```

Oppure en configuración global:

```javascript
<ThemeProvider palette="marfil">
  <App />
</ThemeProvider>
```

## Marca y Consistency Rules

### Regla 1: Una paleta por sesión
- El usuario elige UNA paleta al iniciar
- No mezclar tokens de paletas diferentes en una misma pantalla
- La consistencia visual es más importante que la personalización

### Regla 2: Paleta principal en flujos críticos
- Onboarding, login, registro → siempre ciruela (para consistencia con versión actual)
- Flujos de reserva y confirmación → ciruela por defecto, pero user puede cambiar
- Perfil y configuraciones → user puede escoger cualquier paleta

### Regla 3: ICC Accessibility
- Minimum contrast ratio: 4.5:1 para texto normal, 3:1 para texto grande
- Las 3 paletas cumplen este requisito por diseño
- Never use text color with less than 70% brightness contrast against background

### Regla 4: ICC Color blind safe
- Ninguna paleta depende exclusivamente de rojo/verde distinción
- Los estados de error/success usan íconos + color, no color solo
- Testing con simuladores color blindness recomendado antes de release

## Variable CSS (para desarrollo web o React Native Web)

```css
:root {
  --palette: ciruela;
}

:root[palette="ciruela"] {
  --color-primary: #6B3752;
  --color-secondary: #8F9B96;
  --color-background: #F5E9DC;
  --color-card: #FFFFFF;
  --color-input-bg: #F9FAFB;
  --color-border: #D1D5DB;
  --color-btn-primary: #6B3752;
  --color-btn-primary-hover: #5A2E42;
  --color-success: #4CAF50;
  --color-error: #EF4444;
}

:root[palette="marfil"] {
  --color-primary: #8B7355;
  --color-secondary: #A0522D;
  --color-background: #F4E8DC;
  --color-card: #FFFFFF;
  --color-input-bg: #FAF9F6;
  --color-border: #C9ADA1;
  --color-btn-primary: #8B7355;
  --color-btn-primary-hover: #705A43;
  --color-success: #8FB973;
  --color-error: #ED8936;
}

:root[palette="salvia"] {
  --color-primary: #5A9FAF;
  --color-secondary: #7B9FAF;
  --color-background: #E8F0F1;
  --color-card: #FFFFFF;
  --color-input-bg: #F0F8F7;
  --color-border: #A3C4BC;
  --color-btn-primary: #5A9FAF;
  --color-btn-primary-hover: #407D87;
  --color-success: #4CAF50;
  --color-error: #EF4444;
}
```

## Uso en React Native (StyleSheet)

```javascript
const styles = StyleSheet.create({
  // Ejemplo responsivo a palette
  container: {
    backgroundColor: colors.background, // del tema context
  },
  title: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
    color: colors.primary, // texto dentro del input
  },
  buttonPrimary: {
    backgroundColor: colors.btnPrimary,
    setTitleColor: colors.btnPrimaryText,
  },
});

// Con default ciruela si no hay contexto
const defaultColors = {
  primary: '#6B3752',
  secondary: '#8F9B96', 
  background: '#F5E9DC',
  inputBg: '#F9FAFB',
  border: '#D1D5DB',
  btnPrimary: '#6B3752',
};
```

## Lineamiento de Migración

### De ciruela a marfil/salvia

1. User toca "Cambiar tema" en configuración perfil
2. Se guarda `palette: 'marfil'` o `'salvia'` en Engram
3. Reinicializar todos los estilos con los nuevos tokens
4. Toast notifications usan la palette activa
5. Fondo screens actualizan al instante
6. Inputs, buttons, cards actualizan al re-render

### Volver a ciruela

1. User selecciona ciruela en configuración
2. Engram actualiza `palette: 'ciruela'`
3. Mismo proceso inverso - todos los tokens vuelven al default
4. Sin pérdida de datos, solo cambio visual

## Acceptance Criteria

- [ ] Las 3 paletas definidas completamente con todos los tokens de color
- [ ] Paleta ciruela es el default y usada en screens nuevas
- [ ] User puede cambiar de paleta en configuración y se persiste
- [ ] Cambio de paleta afecta todos los componentes UI consistemente
- [ ] No se mezclan tokens de paletas diferentes en una misma pantalla
- [ ] Todas las paletas cumplen contraste AA (4.5:1) mínimo
- [ ] Los íconos y estados usan colores que son safe para colorblind
- [ ] El sistema de tema es opt-in, no forzado al usuario
- [ ] Documentación incluye ejemplos de CSS y React Native StyleSheet
- [ ] Los 3 paletas nombradas y referenciadas como "ciruela", "marfil", "salvia"