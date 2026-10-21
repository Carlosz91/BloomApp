import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
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

const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 28;

export default function OnboardingScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const listRef = useRef(null);
  const scrollX = useState(() => new Animated.Value(0))[0]; // native driver: transforms / opacity
  const activeAnim = useState(() => new Animated.Value(0))[0]; // JS driver: dot width
  const entrance = useState(() => new Animated.Value(0))[0];
  const float = useState(() => new Animated.Value(0))[0];
  const pulse = useState(() => new Animated.Value(0))[0];
  const [index, setIndex] = useState(0);

  const isLast = index === STEPS.length - 1;
  const heroSize = Math.min(width * 0.62, 260);

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
          setIndex((prev) => (next !== prev && next >= 0 && next < STEPS.length ? next : prev));
        },
      }),
    [scrollX, width]
  );

  useEffect(() => {
    const anim = Animated.spring(activeAnim, { toValue: index, useNativeDriver: false, speed: 18, bounciness: 6 });
    anim.start();
    return () => anim.stop();
  }, [index, activeAnim]);

  const goTo = (target) => {
    listRef.current?.scrollToOffset({ offset: target * width, animated: true });
  };

  const handleNext = () => {
    if (isLast) {
      router.replace('/login');
    } else {
      goTo(index + 1);
    }
  };

  const handleBack = () => {
    if (index > 0) goTo(index - 1);
  };

  const handleSkip = () => router.replace('/login');

  const renderStep = ({ item, index: i }) => {
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
      {/* Top bar: back / skip */}
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
          disabled={isLast}
          hitSlop={12}
          style={[styles.topButton, isLast && styles.hidden]}
          accessibilityLabel="Saltar"
        >
          <Text style={styles.topButtonText}>Saltar</Text>
        </Pressable>
      </View>

      <Animated.FlatList
        ref={listRef}
        data={STEPS}
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
          {STEPS.map((step, i) => {
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
          label={isLast ? 'Empezar' : 'Siguiente'}
          icon={isLast ? 'checkmark' : 'arrow-forward'}
          onPress={handleNext}
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
  });
