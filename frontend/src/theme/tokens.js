// Shared design tokens: spacing scale, radii, typography and shadow helpers.
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

// Branch móvil del mock de referencia: DM Sans 400/500/700 para cuerpo y
// títulos; Playfair Display 600 (+ itálica 600) reservado para el título
// display de la promo. Constantes verificadas contra los exports reales de
// @expo-google-fonts/dm-sans y @expo-google-fonts/playfair-display.
export const font = {
  regular: 'DMSans_400Regular',
  semibold: 'DMSans_700Bold',
  medium: 'DMSans_500Medium',
  display: 'PlayfairDisplay_600SemiBold',
  displayItalic: 'PlayfairDisplay_600SemiBold_Italic',
};

export const type = {
  title: { fontFamily: font.semibold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: font.semibold, fontSize: 20, lineHeight: 26 },
  subheading: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
};

// Soft plum card shadow (iOS shadow props + Android elevation).
export const softShadow = (palette) => ({
  shadowColor: palette.shadow || '#462d3a',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.09,
  shadowRadius: 30,
  elevation: 4,
});

export const cardStyle = (palette) => ({
  backgroundColor: palette.card,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.border,
  padding: spacing.lg,
  ...softShadow(palette),
});
