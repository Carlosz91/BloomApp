import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { font } from '../../theme/tokens';

const icon = (focusedName, outlineName) =>
  function TabIcon({ color, size, focused }) {
    return <Ionicons name={focused ? focusedName : outlineName} size={size} color={color} />;
  };

export default function TabsLayout() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        // Gris inactivo del nav móvil del mock (no hay llave de paleta para él).
        tabBarInactiveTintColor: '#91868c',
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11, marginTop: 2 },
        tabBarStyle: {
          // Barra móvil del mock: blanco casi opaco + borde superior de línea.
          backgroundColor: 'rgba(255,253,251,0.97)',
          borderTopWidth: 1,
          borderTopColor: palette.line,
          height: 68 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="schedule" options={{ title: 'Agendar', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      {/* Citas es un registro de reservas (clipboard); Perfil es la persona. */}
      <Tabs.Screen name="appointments" options={{ title: 'Citas', tabBarIcon: icon('clipboard', 'clipboard-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}
