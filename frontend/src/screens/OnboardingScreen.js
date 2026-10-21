import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { font, softShadow, spacing } from '../theme/tokens';
import PrimaryButton from '../components/PrimaryButton';

const STEPS = [
  {
    key: 'welcome',
    icon: 'flower',
    title: 'Bienvenido a BloomApp',
    subtitle: 'Tu salón de belleza de confianza',
    description: 'Para cejas y tratamientos faciales',
  },
  {
    key: 'care',
    icon: 'sparkles',
    title: 'Cuidado profesional',
    subtitle: 'Para tus cejas',
    description: 'Servicios especializados de diseño y mantenimiento',
  },
  {
    key: 'book',
    icon: 'calendar',
    title: 'Agenda tu cita',
    subtitle: 'Reserva fácil y rápida',
    description: 'Selecciona fecha y hora para tu tratamiento',
  },
];

// --- Términos y condiciones (aceptación obligatoria, por versión) ---
const TERMS_VERSION = 'v1';
const TERMS_DATE = '21 de octubre de 2026';
const TERMS_STORAGE_KEY = 'bloomapp_terms_accept';
const TERMS_STEP = { key: 'terms', type: 'terms' };
// One-shot marker: once set, the intro slides are not replayed on later
// visits; the app goes straight to login (reinstall or cache clear resets it,
// and a new TERMS_VERSION brings the terms step back by itself).
const ONBOARDING_DONE_KEY = 'bloomapp_onboarding_done';

// TODO(product): replace the contact email once the business mailbox exists.
const TERMS_CONTACT = 'soporte@bloomapp.com';

const TERMS_SECTIONS = [
  {
    key: 'intro',
    heading: 'La app',
    body: 'BloomApp es una plataforma para gestionar turnos y reservas de servicios de estética (cejas y tratamientos faciales). Al crear una cuenta o usar la app aceptás estos Términos y Condiciones.',
  },
  {
    key: 'datos',
    heading: 'Uso de tus datos',
    body: 'Para brindarte el servicio tratamos: nombre, correo electrónico y, si usás el acceso con Google, el perfil básico que autorices; más el historial de tus citas. Usamos esa información exclusivamente para crear tu cuenta, gestionar tus reservas (incluyendo cancelaciones y confirmaciones) y comunicaciones operativas del negocio. No vendemos ni cedemos tus datos a terceros con fines publicitarios.',
  },
  {
    key: 'ia',
    heading: 'Uso de Inteligencia Artificial',
    body: 'BloomApp fue desarrollado y se mantiene con ayuda de herramientas basadas en Inteligencia Artificial (generación y revisión de código, pruebas, y redacción de contenidos de la app), siempre bajo supervisión y decisión humana del equipo. Si incorporamos funciones de recomendación automatizada que usen tus datos, te lo avisaremos de forma clara antes de activarlas y tu consentimiento será necesario.',
  },
  {
    key: 'derechos',
    heading: 'Tus derechos',
    body: `Podés solicitar una copia de tus datos, su corrección o la eliminación de tu cuenta escribiendo a ${TERMS_CONTACT}. Atenderemos la solicitud en un plazo razonable conforme a la normativa de protección de datos personal aplicable.`,
  },
  {
    key: 'uso',
    heading: 'Uso responsable',
    body: 'Debés ser mayor de 18 años (o contar con autorización de quien ejerce tu representación legal), mantener la confidencialidad de tus credenciales y usar la app solo con fines de consumo personal y honestos de los servicios ofrecidos. Las reservas están sujetas a la disponibilidad real del calendario del salón y pueden ser reagendadas o canceladas si corresponde.',
  },
  {
    key: 'cambios',
    heading: 'Cambios del acuerdo',
    body: 'Estos términos se identifican con una versión y fecha (v1 del 21 de octubre de 2026). Si los actualizamos, la app te mostrará nuevamente el pedido de aceptación antes de que uses tu cuenta.',
  },
];

const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 28;

export default function OnboardingScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const listRef = useRef(null);
  const scrollX = useState(() => new Animated.Value(0))[0]; // native driver: transforms / opacity
  const activeAnim = useState(() => new Animated.Value(0))[0]; // JS driver: dot width
  const entrance = useState(() => new Animated.Value(0))[0];
  const float = useState(() => new Animated.Value(0))[0];
  const pulse = useState(() => new Animated.Value(0))[0];
  const [index, setIndex] = useState(0);
  const [termsChecked, setTermsChecked] = useState(false);
  // Whether the legal terms step is required for this visit. While we read
  // AsyncStorage the value stays 'loading' and the CTA stays disabled.
  const [termsState, setTermsState] = useState('loading');
  // Entry decision: 'loading' -> 'show' (first run or pending terms) or
  // 'skip' (returning visit with consent already recorded and no new legal
  // version to accept).
  const [entry, setEntry] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(TERMS_STORAGE_KEY),
      AsyncStorage.getItem(ONBOARDING_DONE_KEY),
    ])
      .then(([stored, doneStored]) => {
        if (cancelled) return;
        let accepted = false;
        if (stored) {
          try {
            accepted = JSON.parse(stored).version === TERMS_VERSION;
          } catch {
            accepted = false;
          }
        }
        setTermsState(accepted ? 'accepted' : 'needed');
        if (doneStored && accepted) {
          // Returning user, nothing legally pending: straight to login.
          setEntry('skip');
        } else {
          setEntry('show');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTermsState('needed');
          setEntry('show');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (entry === 'skip') router.replace('/login');
  }, [entry, router]);

  // The legal step is appended only when consent is still missing so users
  // go through it once per terms version.
  const effectiveSteps = termsState === 'needed' ? [...STEPS, TERMS_STEP] : STEPS;
  const currentStep = effectiveSteps[Math.min(index, effectiveSteps.length - 1)];
  const isTerms = currentStep.type === 'terms';

  const isLast = index === effectiveSteps.length - 1;
  const termsUnresolved = termsState === 'loading';
  const ctaDisabled = termsUnresolved || (isTerms && !termsChecked);

  const heroSize = Math.min(width * 0.62, 260);
  // Explicit bounded height for the terms scroller: nested flex:1 inside a
  // horizontal FlatList item does not reliably constrain on web, leaving the
  // panel with zero overflow (nothing to scroll). Window-derived explicit
  // height makes the scrollable region deterministic on every viewport. The
  // checkbox lives inside the scroll so short viewports never clip it out.
  const termsScrollHeight = Math.max(240, Math.min(560, height - 360));

  // Entrance + ambient loops (floating icon, pulsing halo)
  useEffect(() => {
    const enter = Animated.timing(entrance, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    enter.start();
    floatLoop.start();
    pulseLoop.start();
    return () => {
      enter.stop();
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [entrance, float, pulse]);

  // Keep the current index in sync with the scroll position (swipe or button).
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex((prev) => (next !== prev && next >= 0 && next < effectiveSteps.length ? next : prev));
        },
      }),
    [scrollX, width, effectiveSteps.length]
  );

  useEffect(() => {
    const anim = Animated.spring(activeAnim, { toValue: index, useNativeDriver: false, speed: 18, bounciness: 6 });
    anim.start();
    return () => anim.stop();
  }, [index, activeAnim]);

  const goTo = (target) => {
    listRef.current?.scrollToOffset({ offset: target * width, animated: true });
  };

  // One-shot completion marker: any finished (or deliberately skipped)
  // onboarding means later visits land directly on login.
  const markOnboardingDone = () => {
    AsyncStorage.setItem(
      ONBOARDING_DONE_KEY,
      JSON.stringify({ doneAt: new Date().toISOString() })
    ).catch(() => {});
  };

  const handleNext = () => {
    if (isTerms) {
      if (!termsChecked) return;
      // Consent is recorded first; navigation proceeds even if storage
      // fails because the accepted version is already known in memory.
      AsyncStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({ version: TERMS_VERSION, acceptedAt: new Date().toISOString() })
      ).catch(() => {});
      markOnboardingDone();
      router.replace('/login');
      return;
    }
    if (isLast) {
      markOnboardingDone();
      router.replace('/login');
    } else {
      goTo(index + 1);
    }
  };

  const handleBack = () => {
    if (index > 0) goTo(index - 1);
  };

  // Skipping must never bypass the legal gate; the button is also hidden.
  const handleSkip = () => {
    if (isTerms) return;
    markOnboardingDone();
    router.replace('/login');
  };

  const renderStep = ({ item, index: i }) => {
    // Legal consent step: long-form scrollable terms with a required
    // explicit acceptance checkbox. Replaces the intro-page layout.
    if (item.type === 'terms') {
      return (
        <View style={[styles.page, { width }]}>
          <Text style={[styles.eyebrow, styles.termsEyebrow]}>LEGAL</Text>
          <Text style={styles.title}>Términos y condiciones</Text>
          {/* On short windows the tagline would push the scroller below the
              visible area: hide it when the viewport is compact. */}
          {height >= 640 && (
            <Text style={styles.description}>
              Necesitamos tu consentimiento explícito antes de continuar.
            </Text>
          )}
          <ScrollView
            style={[styles.termsScroll, { height: termsScrollHeight, maxWidth: 560 }]}
            contentContainerStyle={styles.termsScrollInner}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {TERMS_SECTIONS.map((section) => (
              <View key={section.key} style={styles.termsSection}>
                <Text style={styles.termsHeading}>{section.heading}</Text>
                <Text style={styles.termsBody}>{section.body}</Text>
              </View>
            ))}
            <Text style={styles.termsFootnote}>BloomApp · Términos {TERMS_VERSION} · {TERMS_DATE}</Text>
            {/* The checkbox lives INSIDE the scroller so it can never be
                clipped out of reach on short viewports: reaching the end of
                the terms always exposes the acceptance control. */}
            <Pressable
              onPress={() => setTermsChecked((checked) => !checked)}
              style={[styles.termsCheckboxRow, termsChecked && styles.termsCheckboxRowActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsChecked }}
            >
              <Ionicons
                name={termsChecked ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={termsChecked ? palette.primary : palette.textMuted}
              />
              <Text style={styles.termsCheckboxLabel}>
                He leído y acepto los Términos y Condiciones, el uso de mis datos según lo descrito y el empleo de
                herramientas de Inteligencia Artificial en la app.
              </Text>
            </Pressable>
            <View style={styles.termsScrollTrail} />
          </ScrollView>
        </View>
      );
    }

    const range = [(i - 1) * width, i * width, (i + 1) * width];
    const heroScale = scrollX.interpolate({ inputRange: range, outputRange: [0.65, 1, 0.65], extrapolate: 'clamp' });
    const heroOpacity = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
    const heroShift = scrollX.interpolate({ inputRange: range, outputRange: [width * 0.25, 0, -width * 0.25], extrapolate: 'clamp' });
    const textOpacity = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
    const textShift = scrollX.interpolate({ inputRange: range, outputRange: [width * 0.12, 0, -width * 0.12], extrapolate: 'clamp' });
    const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] });
    const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
    const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

    return (
      <View style={[styles.page, { width }]}>
        <Animated.View
          style={[
            styles.heroWrap,
            { width: heroSize, height: heroSize, opacity: heroOpacity, transform: [{ translateX: heroShift }, { scale: heroScale }] },
          ]}
        >
          <Animated.View
            style={[
              styles.halo,
              { width: heroSize, height: heroSize, borderRadius: heroSize / 2, opacity: haloOpacity, transform: [{ scale: haloScale }] },
            ]}
          />
          <View style={[styles.heroTint, { width: heroSize, height: heroSize, borderRadius: heroSize / 2 }]}>
            <Animated.View
              style={[
                styles.heroInner,
                { width: heroSize * 0.62, height: heroSize * 0.62, borderRadius: (heroSize * 0.62) / 2, transform: [{ translateY: floatY }] },
              ]}
            >
              <Ionicons name={item.icon} size={heroSize * 0.3} color={palette.primary} />
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: textOpacity, transform: [{ translateX: textShift }] }]}>
          <Text style={styles.eyebrow}>{item.subtitle.toUpperCase()}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  // Skipping users never see this screen: while 'loading' nothing is painted
  // (brief hold), and once 'skip' the navigation already replaced the route.
  if (entry !== 'show') return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm,
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
    >
      {/* Top bar: back / skip. Skip is removed on the legal step: consent
          must be explicit, there is no way to bypass the acceptance. */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          disabled={index === 0}
          hitSlop={12}
          style={[styles.topButton, index === 0 && styles.hidden]}
          accessibilityLabel="Atrás"
        >
          <Ionicons name="chevron-back" size={22} color={palette.textMuted} />
          <Text style={styles.topButtonText}>Atrás</Text>
        </Pressable>
        <Pressable
          onPress={handleSkip}
          disabled={isLast || isTerms}
          hitSlop={12}
          style={[styles.topButton, (isLast || isTerms) && styles.hidden]}
          accessibilityLabel="Saltar"
        >
          <Text style={styles.topButtonText}>Saltar</Text>
        </Pressable>
      </View>

      <Animated.FlatList
        ref={listRef}
        data={effectiveSteps}
        keyExtractor={(item) => item.key}
        renderItem={renderStep}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={styles.list}
      />

      {/* Pagination + CTA */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {effectiveSteps.map((step, i) => {
            const dotWidth = activeAnim.interpolate({
              inputRange: [i - 1, i, i + 1],
              outputRange: [DOT_SIZE, DOT_ACTIVE_WIDTH, DOT_SIZE],
              extrapolate: 'clamp',
            });
            const dotOpacity = activeAnim.interpolate({
              inputRange: [i - 1, i, i + 1],
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={step.key}
                style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: palette.primary }]}
              />
            );
          })}
        </View>
        <PrimaryButton
          // Siguiente avanza entre slides; el paso legal requiere aceptar
          // (disabled hasta marcar), y el último sin términos inicia login.
          label={isTerms ? 'Aceptar y continuar' : isLast ? 'Empezar' : 'Siguiente'}
          icon={isTerms || isLast ? 'checkmark' : 'arrow-forward'}
          onPress={handleNext}
          disabled={ctaDisabled}
        />
      </View>
    </Animated.View>
  );
}

const makeStyles = (palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.onboardingBackground || palette.background },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      height: 44,
    },
    topButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
    topButtonText: { fontFamily: font.semibold, fontSize: 15, color: palette.textMuted },
    hidden: { opacity: 0 },
    list: { flex: 1 },
    page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
    heroWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl + spacing.md },
    halo: { position: 'absolute', backgroundColor: palette.primary },
    heroTint: { backgroundColor: palette.primaryTint, alignItems: 'center', justifyContent: 'center' },
    heroInner: {
      backgroundColor: palette.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...softShadow(palette),
    },
    textBlock: { alignItems: 'center', maxWidth: 340 },
    eyebrow: {
      fontFamily: font.semibold,
      fontSize: 12,
      letterSpacing: 1.4,
      color: palette.primary,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    title: {
      fontFamily: font.semibold,
      fontSize: 30,
      lineHeight: 37,
      color: palette.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    description: {
      fontFamily: font.regular,
      fontSize: 16,
      lineHeight: 24,
      color: palette.textMuted,
      textAlign: 'center',
    },
    footer: { paddingHorizontal: spacing.xl, alignItems: 'stretch' },
    dots: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', height: 12, marginBottom: spacing.xl },
    dot: { height: DOT_SIZE, borderRadius: DOT_SIZE / 2, marginHorizontal: 4 },
    termsEyebrow: { marginTop: spacing.md },
    termsScroll: {
      backgroundColor: palette.card,
      borderRadius: 20,
      marginTop: spacing.md,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    termsScrollInner: { paddingVertical: spacing.lg },
    termsSection: { marginBottom: spacing.md },
    termsHeading: {
      fontFamily: font.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: palette.heading || palette.textPrimary,
      marginBottom: 4,
    },
    termsBody: {
      fontFamily: font.regular,
      fontSize: 13,
      lineHeight: 20,
      color: palette.textMuted,
    },
    termsFootnote: {
      fontFamily: font.medium || font.regular,
      fontSize: 12,
      color: palette.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    termsCheckboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: palette.line || palette.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: palette.card,
      marginBottom: spacing.md,
    },
    termsCheckboxRowActive: {
      borderColor: palette.primary,
    },
    termsCheckboxLabel: {
      flex: 1,
      marginLeft: spacing.sm,
      fontFamily: font.regular,
      fontSize: 13,
      lineHeight: 18,
      color: palette.textPrimary,
    },
    termsScrollTrail: { height: spacing.md },
  });
