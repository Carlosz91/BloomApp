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
        tabBarInactiveTintColor: palette.textMuted,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 12, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopWidth: 0,
          height: 68 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
          elevation: 12,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="schedule" options={{ title: 'Agendar', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="appointments" options={{ title: 'Citas', tabBarIcon: icon('person', 'person-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('flower', 'flower-outline') }} />
    </Tabs>
  );
}