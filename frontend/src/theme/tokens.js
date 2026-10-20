// Shared design tokens: spacing scale, radii, typography and shadow helpers.
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const font = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
};

export const type = {
  title: { fontFamily: font.semibold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: font.semibold, fontSize: 20, lineHeight: 26 },
  subheading: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
};

// Soft card shadow (iOS shadow props + Android elevation).
export const softShadow = (palette) => ({
  shadowColor: palette.shadow || '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 3,
});

export const cardStyle = (palette) => ({
  backgroundColor: palette.card,
  borderRadius: radius.lg,
  padding: spacing.lg,
  ...softShadow(palette),
});
