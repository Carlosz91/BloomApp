import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cardStyle, softShadow, font, radius, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PressableScale from '../components/PressableScale';
import { API_BASE_URL } from '../config/api';
import { formatColones } from '../utils/format';

// Galería verificada (Unsplash/Pexels, hotlink público)
const PROMO_IMAGEN = 'https://images.unsplash.com/photo-1519415387722-a1c3bbef716c?w=800&q=80';
const IMAGEN_NUEVA_1 = 'https://images.pexels.com/photos/6619475/pexels-photo-6619475.jpeg?auto=compress&cs=tinysrgb&w=800';
const IMAGEN_NUEVA_2 = 'https://images.pexels.com/photos/6663368/pexels-photo-6663368.jpeg?auto=compress&cs=tinysrgb&w=800';

// Textos vertidos desde el diseño original
const DESTACADOS_NOMBRES = ['Perfilado de cejas', 'Tinte de cejas', 'Laminado de cejas'];
const DESTACADOS_DESCRIPCIONES = {
  'Perfilado de cejas': 'Diseño personalizado según las facciones de tu rostro.',
  'Tinte de cejas': 'Color y definición para una mirada con más expresión.',
  'Laminado de cejas': 'Alinea, fija y estiliza cada vello con acabado natural.',
};

const NOVEDADES = [
  {
    id: 'n1',
    imagen: IMAGEN_NUEVA_1,
    titulo: 'Piel luminosa',
    texto: 'Limpieza facial profunda más mascarilla hidratante.',
  },
  {
    id: 'n2',
    imagen: IMAGEN_NUEVA_2,
    titulo: 'Lifting + cejas',
    texto: 'El dúo favorito para transformar tu mirada de forma natural.',
  },
];

const BENEFICIOS = [
  {
    id: 'b1',
    icon: 'gift-outline',
    titulo: 'Un detalle en tu cumpleaños',
    texto: 'Durante tu mes, consultá por tu regalo especial.',
  },
  {
    id: 'b2',
    icon: 'heart-outline',
    titulo: 'Beneficios por recomendar',
    texto: 'Compartí Bloom con una amiga y disfruten juntas.',
  },
  {
    id: 'b3',
    icon: 'chatbubbles-outline',
    titulo: 'Asesoría personalizada',
    texto: 'Te orientamos para encontrar el ritual ideal para vos.',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const paletteColors = palette;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(paletteColors), [paletteColors]);
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token, user } = useAuth();

  // Cargar servicios desde API real
  useEffect(() => {
    let cancelled = false;
    const fetchServices = async () => {
      try {
        if (!token) return; // sin sesión no hay catálogo que cargar
        const res = await fetch(`${API_BASE_URL}/services`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar servicios');
        const data = await res.json();
        if (!cancelled) setServices(data.services || data);
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchServices();
    return () => { cancelled = true; };
  }, [token]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={paletteColors.primary} />
      </View>
    );
  }

  // Saludo personalizado con el primer nombre y género de la sesión
  const primerNombre = String(user?.nombre || '').trim().split(/\s+/)[0] || '';
  const palabraBienvenida =
    user?.genero === 'hombre' ? 'Bienvenido' : user?.genero === 'mujer' ? 'Bienvenida' : 'Bienvenidx';
  const saludo = primerNombre ? `${palabraBienvenida}, ${primerNombre}` : palabraBienvenida;

  // Destacados: preferencia por nombre, con recorte reserva si el catálogo cambia
  let destacados = DESTACADOS_NOMBRES
    .map((nombre) => services.find((s) => s.nombre === nombre))
    .filter(Boolean);
  if (destacados.length < 3 && services.length > 0) {
    const yaElegidos = new Set(destacados.map((s) => s.id));
    for (const extra of services) {
      if (destacados.length >= 3) break;
      if (!yaElegidos.has(extra.id)) {
        destacados.push(extra);
        yaElegidos.add(extra.id);
      }
    }
  }

  const categoriaLegible = (categoria) => (categoria === 'rostro' ? 'Rostro' : 'Cejas');

  // Icono por categoría en las filas de servicio (cejas/rostro)
  const iconoPorCategoria = (categoria) => (categoria === 'rostro' ? 'sparkles-outline' : 'flower-outline');

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ---------- Encabezado con saludo ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLogo}>
            <Ionicons name="flower" size={22} color={paletteColors.primary} />
          </View>
          <View style={styles.headerHeadline}>
            <Text style={styles.eyebrow}>TU ESPACIO DE BELLEZA</Text>
            <Text style={styles.headerText}>{saludo}</Text>
          </View>
        </View>
        <Text style={styles.headerSubTitle}>Inspiración, cuidados y beneficios pensados para vos.</Text>
      </View>

      {/* ---------- Promo del mes ---------- */}
      <FadeInView delay={40} style={styles.sectionWrap}>
        <PressableScale style={styles.promoCard} onPress={() => router.push({ pathname: '/schedule' })}>
          <ImageBackground source={{ uri: PROMO_IMAGEN }} style={styles.promoImagen}>
            {/* Overlay 0deg del mock móvil: oscuro abajo, claro arriba */}
            <LinearGradient
              colors={['rgba(43,27,37,0.94)', 'rgba(54,34,47,0.25)']}
              locations={[0, 0.75]}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={styles.promoOverlay}
            />
            <View style={styles.promoContent}>
              <Text style={styles.promoEyebrow}>PROMO DEL MES</Text>
              <View style={styles.promoPill}>
                <Text style={styles.promoPillTexto}>20% OFF</Text>
              </View>
              <Text style={styles.promoTitulo}>Tu mejor versión empieza con una mirada.</Text>
              <Text style={styles.promoTexto}>
                Diseño, perfilado y tinte para unas cejas que enmarcan tu esencia.
              </Text>
              <View style={styles.promoCta}>
                <Text style={styles.promoCtaTexto}>Conocer promo</Text>
                <Ionicons name="arrow-forward" size={14} color={paletteColors.primary} />
              </View>
            </View>
            <Text style={styles.promoAtribucion}>Foto: Rune Enstad / Unsplash</Text>
          </ImageBackground>
        </PressableScale>
      </FadeInView>

      {/* ---------- Explorá a tu manera ---------- */}
      <FadeInView delay={80} style={styles.sectionWrap}>
        <Text style={styles.sectionEyebrow}>EXPLORÁ A TU MANERA</Text>
        <Text style={styles.sectionTitle}>¿Qué te gustaría descubrir?</Text>
        <View style={styles.exploreRow}>
          {[
            { key: 'cejas', titulo: 'Cejas', texto: 'Diseño y definición para una mirada única.', icon: 'flower-outline' },
            { key: 'rostro', titulo: 'Rostro', texto: 'Rituales para una piel fresca y luminosa.', icon: 'sparkles-outline' },
          ].map((cat, i) => (
            <FadeInView key={cat.key} delay={120 + i * 80} style={styles.fill}>
              <PressableScale
                containerStyle={styles.fill}
                style={[styles.categoryCard, styles.fill]}
                onPress={() => router.push({ pathname: '/schedule' })}
              >
                <View style={styles.categoryIcon}>
                  <Ionicons name={cat.icon} size={22} color={paletteColors.primary} />
                </View>
                <View style={styles.categoryBody}>
                  <Text style={styles.categoryTitulo}>{cat.titulo}</Text>
                  <Text style={styles.categoryTexto}>{cat.texto}</Text>
                  <View style={styles.linkRow}>
                    <Text style={styles.linkTexto}>Descubrir servicios</Text>
                    <Ionicons name="chevron-forward" size={13} color={paletteColors.primary} />
                  </View>
                </View>
              </PressableScale>
            </FadeInView>
          ))}
        </View>
      </FadeInView>

      {/* ---------- Elegidos para vos ---------- */}
      <FadeInView delay={120} style={styles.sectionWrap}>
        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>ELEGIDOS PARA VOS</Text>
            <Text style={styles.sectionTitle}>Favoritos de la comunidad</Text>
          </View>
          <PressableScale
            style={styles.sectionLink}
            onPress={() => router.push({ pathname: '/schedule' })}
          >
            <Text style={styles.linkTexto}>Ver todos</Text>
            <Ionicons name="chevron-forward" size={13} color={paletteColors.primary} />
          </PressableScale>
        </View>
        <View style={styles.serviceList}>
          {destacados.map((item, i) => {
            const esLaminado = String(item.nombre || '').includes('Laminado');
            const etiqueta = i === 0 ? 'Favorito' : esLaminado ? 'Tendencia' : null;
            const descripcion = DESTACADOS_DESCRIPCIONES[item.nombre] || `${item.duracion_minutos} min`;
            return (
              <FadeInView key={item.id} delay={160 + i * 80} distance={24}>
                <PressableScale
                  style={styles.serviceRow}
                  onPress={() => router.push({ pathname: '/schedule', params: { serviceId: String(item.id) } })}
                >
                  <View style={styles.serviceIcon}>
                    <Ionicons name={iconoPorCategoria(item.categoria)} size={20} color={paletteColors.primary} />
                  </View>
                  <View style={styles.serviceBody}>
                    <View style={styles.serviceMetaRow}>
                      <Text style={styles.serviceCategoria}>{categoriaLegible(item.categoria)}</Text>
                      {etiqueta && (
                        <View style={styles.serviceTag}>
                          <Text style={styles.serviceTagTexto}>{etiqueta}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.serviceNombre} numberOfLines={1}>{item.nombre}</Text>
                    <Text style={styles.serviceTexto} numberOfLines={2}>{descripcion}</Text>
                    <Text style={styles.servicePrecio}>Desde {formatColones(item.precio)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={paletteColors.primary} />
                </PressableScale>
              </FadeInView>
            );
          })}
        </View>
      </FadeInView>

      {/* ---------- Recién llegado ---------- */}
      <FadeInView delay={160} style={styles.sectionWrap}>
        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionEyebrow}>RECIÉN LLEGADO</Text>
            <Text style={styles.sectionTitle}>Novedades para descubrir</Text>
          </View>
          <PressableScale
            style={styles.sectionLink}
            onPress={() => router.push({ pathname: '/schedule' })}
          >
            <Text style={styles.linkTexto}>Explorar</Text>
            <Ionicons name="chevron-forward" size={13} color={paletteColors.primary} />
          </PressableScale>
        </View>
        <View style={styles.newsList}>
          {NOVEDADES.map((n, i) => (
            <FadeInView key={n.id} delay={200 + i * 90} distance={24}>
              <PressableScale
                style={styles.newsCard}
                onPress={() => router.push({ pathname: '/schedule' })}
              >
                <Image source={{ uri: n.imagen }} style={styles.newsImagen} />
                <View style={styles.newsBody}>
                  <Text style={styles.newsLabel}>NUEVO EN BLOOM</Text>
                  <Text style={styles.newsTitulo}>{n.titulo}</Text>
                  <Text style={styles.newsTexto} numberOfLines={2}>{n.texto}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={paletteColors.primary} />
              </PressableScale>
            </FadeInView>
          ))}
        </View>
      </FadeInView>

      {/* ---------- Más cerca de vos ---------- */}
      <FadeInView delay={200} style={styles.sectionWrap}>
        <Text style={styles.sectionEyebrow}>MÁS CERCA DE VOS</Text>
        <Text style={styles.sectionTitle}>Beneficios Bloom</Text>
        {BENEFICIOS.map((b, i) => (
          <FadeInView key={b.id} delay={240 + i * 90} distance={24}>
            <View style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name={b.icon} size={18} color={paletteColors.primary} />
              </View>
              <View style={styles.benefitInfo}>
                <Text style={styles.benefitTitulo}>{b.titulo}</Text>
                <Text style={styles.benefitTexto}>{b.texto}</Text>
              </View>
            </View>
          </FadeInView>
        ))}
      </FadeInView>

      {/* ---------- Consejo Bloom ---------- */}
      <FadeInView delay={280} style={styles.sectionWrap}>
        <View style={styles.careBanner}>
          <View style={styles.careIcono}>
            <Ionicons name="sparkles-outline" size={20} color={paletteColors.sage} />
          </View>
          <View style={styles.careInfo}>
            <Text style={styles.careEyebrow}>CONSEJO BLOOM</Text>
            <Text style={styles.careTitulo}>Tu rutina también puede ser un ritual.</Text>
            <Text style={styles.careTexto}>Pequeños cuidados diarios hacen una gran diferencia.</Text>
          </View>
          <PressableScale style={styles.careAction} onPress={() => router.push({ pathname: '/schedule' })}>
            <Ionicons name="chevron-forward" size={16} color={paletteColors.sage} />
          </PressableScale>
        </View>
      </FadeInView>

      <View style={{ height: spacing.xl }} />
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
  fill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: paletteColors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...softShadow(paletteColors),
  },
  headerHeadline: {
    flex: 1,
  },
  eyebrow: {
    color: paletteColors.eyebrow,
    fontSize: 10,
    fontFamily: font.semibold,
    letterSpacing: 1.7,
    marginBottom: spacing.xs,
  },
  headerText: {
    color: paletteColors.heading,
    fontSize: 28,
    lineHeight: 33,
    fontFamily: font.semibold,
    letterSpacing: -1,
  },
  headerSubTitle: {
    color: paletteColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: font.regular,
    marginTop: spacing.xs,
  },
  sectionWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionEyebrow: {
    color: paletteColors.eyebrow,
    fontSize: 10,
    fontFamily: font.semibold,
    letterSpacing: 1.7,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: paletteColors.heading,
    fontSize: 18,
    fontFamily: font.semibold,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.xs,
  },
  linkTexto: {
    color: paletteColors.primary,
    fontSize: 11,
    fontFamily: font.medium,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.sm,
  },
  // Promo del mes (tarjeta hero del mock móvil)
  promoCard: {
    height: 380,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: paletteColors.heading,
    ...softShadow(paletteColors),
  },
  promoImagen: {
    flex: 1,
  },
  promoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  promoContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: 28,
  },
  promoEyebrow: {
    color: paletteColors.badge,
    fontSize: 10,
    fontFamily: font.semibold,
    letterSpacing: 1.8,
  },
  promoPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  promoPillTexto: {
    color: paletteColors.onPrimary,
    fontSize: 10,
    fontFamily: font.medium,
  },
  promoTitulo: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 33,
    fontFamily: font.display,
    marginTop: 10,
  },
  promoTexto: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: font.regular,
    marginTop: 4,
  },
  promoCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: spacing.lg,
  },
  promoCtaTexto: {
    color: paletteColors.primary,
    fontSize: 11,
    fontFamily: font.semibold,
  },
  promoAtribucion: {
    position: 'absolute',
    right: 12,
    bottom: 9,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontFamily: font.regular,
  },
  // Explorá a tu manera
  exploreRow: {
    flexDirection: 'row',
    gap: 9,
  },
  categoryCard: {
    ...cardStyle(paletteColors),
    alignItems: 'flex-start',
    gap: 13,
    padding: 16,
    minHeight: 178,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: paletteColors.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBody: {
    flex: 1,
  },
  categoryTitulo: {
    color: paletteColors.heading,
    fontSize: 16,
    fontFamily: font.semibold,
    letterSpacing: -0.4,
  },
  categoryTexto: {
    color: paletteColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: font.regular,
    marginTop: 4,
    minHeight: 30,
  },
  // Elegidos para vos (filas de servicio del mock)
  serviceList: {
    gap: 10,
  },
  serviceRow: {
    ...cardStyle(paletteColors),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  serviceIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: paletteColors.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceBody: {
    flex: 1,
    minWidth: 0,
  },
  serviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  serviceCategoria: {
    color: paletteColors.eyebrow,
    fontSize: 9,
    fontFamily: font.semibold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  serviceTag: {
    backgroundColor: paletteColors.plumSoft,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  serviceTagTexto: {
    color: paletteColors.primary,
    fontSize: 9,
    fontFamily: font.semibold,
    letterSpacing: 0.5,
  },
  serviceNombre: {
    color: paletteColors.textPrimary,
    fontSize: 14,
    fontFamily: font.semibold,
    marginTop: 4,
  },
  serviceTexto: {
    color: paletteColors.textMuted,
    fontSize: 11,
    fontFamily: font.regular,
    marginTop: 2,
  },
  servicePrecio: {
    color: paletteColors.primary,
    fontSize: 11,
    fontFamily: font.semibold,
    marginTop: 6,
  },
  // Recién llegado
  newsList: {
    gap: 10,
  },
  newsCard: {
    ...cardStyle(paletteColors),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 11,
    paddingRight: 14,
  },
  newsImagen: {
    width: 92,
    height: 106,
    borderRadius: 12,
    backgroundColor: paletteColors.plumSoft,
  },
  newsBody: {
    flex: 1,
    minWidth: 0,
  },
  newsLabel: {
    color: paletteColors.eyebrow,
    fontSize: 9,
    fontFamily: font.semibold,
    letterSpacing: 1.1,
  },
  newsTitulo: {
    color: paletteColors.heading,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: font.semibold,
    marginTop: 6,
  },
  newsTexto: {
    color: paletteColors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    fontFamily: font.regular,
    marginTop: 2,
  },
  // Más cerca de vos
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    marginBottom: 9,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: paletteColors.line,
    backgroundColor: paletteColors.card,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: paletteColors.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitInfo: {
    flex: 1,
  },
  benefitTitulo: {
    color: paletteColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: font.semibold,
  },
  benefitTexto: {
    color: paletteColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: font.regular,
    marginTop: 4,
  },
  // Consejo Bloom (banner salvia del mock)
  careBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    backgroundColor: paletteColors.sageBg,
    padding: 18,
  },
  careIcono: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: paletteColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  careInfo: {
    flex: 1,
  },
  careEyebrow: {
    color: paletteColors.sage,
    fontSize: 9,
    fontFamily: font.semibold,
    letterSpacing: 1.4,
  },
  // Colores salvia oscuros del banner, tomados del mock de referencia
  careTitulo: {
    color: '#40584c',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: font.semibold,
    marginTop: 4,
  },
  careTexto: {
    color: '#718078',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: font.regular,
    marginTop: 2,
  },
  careAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: paletteColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const options = {
  title: 'Home - BloomApp',
};
