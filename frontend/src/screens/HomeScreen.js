import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { cardStyle, font, radius, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';

export default function HomeScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const paletteColors = palette;
  const styles = useMemo(() => makeStyles(paletteColors), [paletteColors]);
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar servicios - en producción llamada a API GET /services con JWT
  // Por ahora usar mock data estructurada con colores de la palette
  useEffect(() => {
    const mockServices = [
      { id: 1, nombre: 'Corte de cejas', descripcion: 'Corte y forma de cejas', precio: 45.00, duracion_minutos: 45, categoria: 'cejas', activo: true },
      { id: 2, nombre: 'Tinte de cejas', descripcion: 'Aplicación de tinte para cejas', precio: 30.00, duracion_minutos: 30, categoria: 'cejas', activo: true },
      { id: 3, nombre: 'Laminado de cejas', descripcion: 'Laminado y arreglo de cejas', precio: 60.00, duracion_minutos: 60, categoria: 'cejas', activo: true },
      { id: 4, nombre: 'Micropigmentación de cejas', descripcion: 'Micropigmentación natural para cejas', precio: 80.00, duracion_minutos: 90, categoria: 'cejas', activo: true },
      { id: 5, nombre: 'Limpieza de piel', descripcion: 'Limpieza facial profunda', precio: 55.00, duracion_minutos: 60, categoria: 'rostro', activo: true },
    ];
    setServices(mockServices);
    setFilteredServices(mockServices);
    setIsLoading(false);
  }, [palette]);

  const renderService = ({ item, index }) => (
    <FadeInView delay={Math.min(index, 8) * 70}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.serviceCard}
        onPress={() => router.push({ pathname: '/schedule', params: { serviceId: String(item.id) } })}
      >
        <View style={styles.serviceIcon}>
          <Ionicons
            name={item.categoria === 'rostro' ? 'sparkles-outline' : 'flower-outline'}
            size={22}
            color={paletteColors.primary}
          />
        </View>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{item.nombre}</Text>
          <Text style={styles.serviceDescription} numberOfLines={1}>{item.descripcion}</Text>
          <View style={styles.serviceDetails}>
            <Text style={styles.servicePrice}>${item.precio.toFixed(2)}</Text>
            <View style={styles.dot} />
            <Ionicons name="time-outline" size={13} color={paletteColors.textMuted} />
            <Text style={styles.serviceDuration}>{item.duracion_minutos} min</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={paletteColors.textMuted} style={styles.chevron} />
      </TouchableOpacity>
    </FadeInView>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={paletteColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FadeInView style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.headerText}>Bienvenida</Text>
        <Text style={styles.headerSubTitle}>Agenda tu cita de cejas</Text>
      </FadeInView>

      {/* Categorías filtradas */}
      <FadeInView delay={80} style={styles.categories}>
        <Text style={styles.categoriesText}>Categorías</Text>
        <View style={styles.categoryPills}>
          <TouchableOpacity style={styles.categoryButton} onPress={() => setFilteredServices(services.filter(s => s.categoria === 'cejas'))}>
            <Text style={styles.categoryButtonText}>Cejas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryButton} onPress={() => setFilteredServices(services.filter(s => s.categoria === 'rostro'))}>
            <Text style={styles.categoryButtonText}>Rostro</Text>
          </TouchableOpacity>
        </View>
      </FadeInView>

      <FlatList
        data={filteredServices}
        renderItem={renderService}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="flower-outline" size={40} color={paletteColors.border} />
            <Text style={styles.emptyStateText}>No hay servicios disponibles</Text>
          </View>
        }
      />
    </View>
  );
}

const makeStyles = (paletteColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paletteColors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerText: {
    color: paletteColors.textPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: font.semibold,
  },
  headerSubTitle: {
    color: paletteColors.textMuted,
    fontSize: 15,
    fontFamily: font.regular,
    marginTop: spacing.xs,
  },
  categories: {
    paddingHorizontal: spacing.xl,
    marginBottom: 0,
  },
  categoriesText: {
    color: paletteColors.textPrimary,
    fontSize: 14,
    fontFamily: font.semibold,
    marginBottom: spacing.xxs,
  },
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  categoryButton: {
    backgroundColor: paletteColors.card,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: paletteColors.border,
    marginBottom: 0,
  },
  categoryButtonText: {
    color: paletteColors.primary,
    fontSize: 11,
    fontFamily: font.semibold,
  },
  listContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  serviceCard: {
    ...cardStyle(paletteColors),
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: paletteColors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    color: paletteColors.textPrimary,
    fontSize: 16,
    fontFamily: font.semibold,
    numberOfLines: 1,
  },
  serviceDescription: {
    color: paletteColors.textMuted,
    fontSize: 13,
    fontFamily: font.regular,
    marginTop: 2,
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  servicePrice: {
    color: paletteColors.primary,
    fontSize: 14,
    fontFamily: font.semibold,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: paletteColors.border,
    marginHorizontal: spacing.sm,
  },
  serviceDuration: {
    color: paletteColors.textMuted,
    fontSize: 12,
    fontFamily: font.regular,
    marginLeft: 4,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyStateText: {
    color: paletteColors.textMuted,
    fontSize: 15,
    fontFamily: font.regular,
    marginTop: spacing.md,
  },
});

export const options = {
  title: 'Home - BloomApp',
};