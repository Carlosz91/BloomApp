import React, { useState } from 'react';
import { Animated, Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, softShadow } from '../theme/tokens';

// Primary / secondary button with press-scale feedback.
export default function PrimaryButton({ label, onPress, icon, variant = 'primary', style, disabled }) {
  const { palette } = useTheme();
  const scale = useState(() => new Animated.Value(1))[0];
  const isPrimary = variant === 'primary';

  const animate = (to) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  const fg = isPrimary ? palette.onPrimary || '#FFFFFF' : palette.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animate(0.97)}
      onPressOut={() => animate(1)}
      accessibilityRole="button"
    >
      <Animated.View
        style={[
          styles.base,
          isPrimary
            ? { backgroundColor: palette.btnPrimary || palette.primary, ...softShadow(palette) }
            : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: palette.primary },
          disabled && { opacity: 0.5 },
          { transform: [{ scale }] },
          style,
        ]}
      >
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
        {icon ? <Ionicons name={icon} size={18} color={fg} style={styles.icon} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.pill,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: font.semibold, fontSize: 16, letterSpacing: 0.3 },
  icon: { marginLeft: 8 },
});
