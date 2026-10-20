import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cardStyle, font, radius, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import { API_BASE_URL } from '../config/api';
import { formatGuaranies } from '../utils/format';

// Contenido de la vitrina (editable aquí; luego puede moverse al backend)
const NOVEDADES = [
  { id: 'n1', badge: 'Nuevo en cejas', title: 'Laminado de cejas', text: 'Efecto peinado y brillo que se mantiene por semanas' },
  { id: 'n2', badge: 'Nuevo en rostro', title: 'Mascarilla facial', text: 'Hidratación profunda para una piel renovada' },
];

const BENEFICIOS = [
  { id: 'b1', icon: 'gift-outline', title: 'Beneficio de cumpleaños', text: 'Durante tu mes, consulta por tu regalo de parte de BloomApp' },
  { id: 'b2', icon: 'heart-outline', title: 'Cliente frecuente', text: 'Cada sesión suma: consulta por tu bonificación en mantenimientos' },
  { id: 'b3', icon: 'chatbubbles-outline', title: 'Asesoría de diseño', text: 'Te recomendamos el diseño de cejas que mejor queda con tu rostro' },
];

const FEATURED_NOMBRES = ['Laminado de cejas', 'Limpieza facial'];

// Tarjeta promocional con icono latiendo (Animated nativo, sin dependencias)
const CategoryPromoCard = ({ paletteColors, styles, icon, titulo, texto, desde, cantidad, onPress, delay }) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <FadeInView delay={delay} style={styles.promoCardWrap}>
      <TouchableOpacity activeOpacity={0.85} style={styles.promoCard} onPress={onPress}>
        <Animated.View style={[styles.promoIcon, { transform: [{ scale: pulse }] }]}>
          <Ionicons name={icon} size={26} color={paletteColors.primary} />
        </Animated.View>
        <Text style={styles.promoTitulo}>{titulo}</Text>
        <Text style={styles.promoTexto}>{texto}</Text>
        <Text style={styles.promoDesde}>
          {cantidad > 0 && desde != null
            ? `${cantidad} ${cantidad === 1 ? 'servicio' : 'servicios'} · Desde ${formatGuaranies(desde)}`
            : 'Sin servicios por ahora'}
        </Text>
      </TouchableOpacity>
    </FadeInView>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const paletteColors = palette;
  const styles = useMemo(() => makeStyles(paletteColors), [paletteColors]);
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();

  // Cargar servicios desde API real
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/services`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar servicios');
        const data = await res.json();
        setServices(data.services || data);
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchServices();
    else setIsLoading(false);
  }, [token]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={paletteColors.primary} />
      </View>
    );
  }

  const minPriceFor = (categoria) => {
    const precios = services
      .filter(s => s.categoria === categoria)
      .map(s => Number(s.precio));
    return precios.length ? Math.min(...precios) : null;
  };

  const countFor = (categoria) =>
    services.filter(s => s.categoria === categoria).length;

  // Destacados: preferencia por nombre, con recorte reserva si el catálogo cambia
  let destacados = FEATURED_NOMBRES
    .map(n => services.find(s => s.nombre === n))
    .filter(Boolean);
  if (destacados.length < 2 && services.length > 0) {
    destacados = services.slice(0, 2);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <FadeInView style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.headerText}>Bienvenida</Text>
        <Text style={styles.headerSubTitle}>Tu vitrina de belleza</Text>
      </FadeInView>

      {/* Promociones: navegan a la pestaña Agenda, donde se agenda */}
      <FadeInView delay={40} style={styles.sectionWrap}>
        <Text style={styles.summaryTitle}>Promociones</Text>
        <View style={styles.summaryCards}>
          <CategoryPromoCard
            paletteColors={paletteColors}
            styles={styles}
            icon="flower-outline"
            titulo="Cejas"
            texto="Perfilado, tinte y laminado para una mirada definida"
            desde={minPriceFor('cejas')}
            cantidad={countFor('cejas')}
            onPress={() => router.push({ pathname: '/schedule' })}
            delay={60}
          />
          <CategoryPromoCard
            paletteColors={paletteColors}
            styles={styles}
            icon="sparkles-outline"
            titulo="Rostro"
            texto="Limpieza facial profunda y mascarillas hidratantes"
            desde={minPriceFor('rostro')}
            cantidad={countFor('rostro')}
            onPress={() => router.push({ pathname: '/schedule' })}
            delay={140}
          />
        </View>
      </FadeInView>

      {/* Servicios destacados: tapan al Agendar con el servicio preseleccionado */}
      <FadeInView delay={80} style={styles.sectionWrap}>
        <Text style={styles.summaryTitle}>Destacados</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featRow}
        >
          {destacados.map((item, i) => (
            <FadeInView key={item.id} delay={100 + i * 80}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.featCard}
                onPress={() => router.push({ pathname: '/schedule', params: { serviceId: String(item.id) } })}
              >
                <View style={styles.promoIcon}>
                  <Ionicons
                    name={item.categoria === 'rostro' ? 'sparkles-outline' : 'flower-outline'}
                    size={22}
                    color={paletteColors.primary}
                  />
                </View>
                <Text style={styles.featName}>{item.nombre}</Text>
                <View style={styles.featPriceRow}>
                  <Text style={styles.servicePrice}>{formatGuaranies(item.precio)}</Text>
                  <View style={styles.dot} />
                  <Text style={styles.serviceDuration}>{item.duracion_minutos} min</Text>
                </View>
                <View style={styles.featGo}>
                  <Ionicons name="arrow-forward" size={15} color={paletteColors.primary} />
                  <Text style={styles.featGoText}>Agendar</Text>
                </View>
              </TouchableOpacity>
            </FadeInView>
          ))}
        </ScrollView>
      </FadeInView>

      {/* Novedades */}
      <FadeInView delay={140} style={styles.sectionWrap}>
        <Text style={styles.summaryTitle}>Novedades</Text>
        {NOVEDADES.map((n) => (
          <View key={n.id} style={styles.novCard}>
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>{n.badge}</Text>
            </View>
            <Text style={styles.novTitle}>{n.title}</Text>
            <Text style={styles.novText}>{n.text}</Text>
          </View>
        ))}
      </FadeInView>

      {/* Beneficios */}
      <FadeInView delay={200} style={styles.sectionWrap}>
        <Text style={styles.summaryTitle}>Beneficios</Text>
        {BENEFICIOS.map((b) => (
          <View key={b.id} style={styles.benRow}>
            <View style={styles.benIcon}>
              <Ionicons name={b.icon} size={18} color={paletteColors.primary} />
            </View>
            <View style={styles.benInfo}>
              <Text style={styles.benTitle}>{b.title}</Text>
              <Text style={styles.benText}>{b.text}</Text>
            </View>
          </View>
        ))}
      </FadeInView>
    </ScrollView>
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
  summaryTitle: {
    color: paletteColors.textPrimary,
    fontSize: 14,
    fontFamily: font.semibold,
    marginBottom: spacing.sm,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  promoCardWrap: {
    flex: 1,
  },
  promoCard: {
    ...cardStyle(paletteColors),
    padding: spacing.lg,
  },
  promoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: paletteColors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  promoTitulo: {
    color: paletteColors.textPrimary,
    fontSize: 16,
    fontFamily: font.semibold,
    marginBottom: 2,
  },
  promoTexto: {
    color: paletteColors.textMuted,
    fontSize: 12,
    fontFamily: font.regular,
    marginBottom: spacing.sm,
  },
  promoDesde: {
    color: paletteColors.primary,
    fontSize: 13,
    fontFamily: font.semibold,
  },
  sectionWrap: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  featRow: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  featCard: {
    ...cardStyle(paletteColors),
    width: 200,
    padding: spacing.lg,
  },
  featName: {
    color: paletteColors.textPrimary,
    fontSize: 15,
    fontFamily: font.semibold,
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  featPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  featGo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featGoText: {
    color: paletteColors.primary,
    fontSize: 12,
    fontFamily: font.semibold,
  },
  novCard: {
    ...cardStyle(paletteColors),
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: paletteColors.primaryTint,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeText: {
    color: paletteColors.primary,
    fontSize: 10,
    fontFamily: font.semibold,
  },
  novTitle: {
    color: paletteColors.textPrimary,
    fontSize: 15,
    fontFamily: font.semibold,
    marginBottom: 2,
  },
  novText: {
    color: paletteColors.textMuted,
    fontSize: 12,
    fontFamily: font.regular,
  },
  benRow: {
    ...cardStyle(paletteColors),
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  benIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: paletteColors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  benInfo: {
    flex: 1,
  },
  benTitle: {
    color: paletteColors.textPrimary,
    fontSize: 14,
    fontFamily: font.semibold,
    marginBottom: 2,
  },
  benText: {
    color: paletteColors.textMuted,
    fontSize: 12,
    fontFamily: font.regular,
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
});

export const options = {
  title: 'Home - BloomApp',
};