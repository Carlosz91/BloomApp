import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, softShadow, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';
import { API_BASE_URL } from '../config/api';
import { showErrorToast, showInfoToast, showSuccessToast } from '../services/Notifications';

const RESEND_COOLDOWN_SECONDS = 60;

// Email ownership check: 6-digit code sent by the backend. Never forced; the
// user can skip it and verify later from the profile screen.
export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user, updateUser } = useAuth();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const fromRegister = (Array.isArray(params.from) ? params.from[0] : params.from) === 'register';
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  // Right after registering the backend already sent the first code.
  const [cooldown, setCooldown] = useState(fromRegister ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const goHome = () => router.replace('/home');
  const goBack = () => (router.canGoBack() ? router.back() : goHome());

  const post = async (path, body) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      const { ok, data } = await post('/auth/verify-email/send');
      if (!ok) {
        showErrorToast({ title: 'No pudimos enviar el código', description: data.message || 'Probá más tarde' });
        return;
      }
      if (data.already_verified) {
        await updateUser({ email_verified: true });
        showSuccessToast({ title: 'Correo verificado', description: 'Tu correo ya estaba verificado' });
        goHome();
        return;
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      showInfoToast({ title: 'Código enviado', description: 'Revisá tu correo' });
    } catch {
      showErrorToast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor' });
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      showErrorToast({ title: 'Código incompleto', description: 'Ingresá el código de 6 dígitos' });
      return;
    }
    setBusy(true);
    try {
      const { ok, data } = await post('/auth/verify-email', { code });
      if (!ok) {
        showErrorToast({
          title: 'No se pudo verificar',
          description: data.message || 'Código inválido o vencido',
        });
        return;
      }
      await updateUser({ email_verified: true });
      showSuccessToast({ title: 'Correo verificado', description: 'Gracias por confirmar tu correo' });
      goHome();
    } catch {
      showErrorToast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={palette.textPrimary} />
        </TouchableOpacity>

        <FadeInView style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="mail-open-outline" size={34} color={palette.primary} />
          </View>
          <Text style={styles.title}>Verificá tu correo</Text>
          <Text style={styles.subtitle}>
            {user?.email
              ? `Ingresá el código de 6 dígitos que enviamos a ${user.email}`
              : 'Ingresá el código de 6 dígitos que te enviamos'}
          </Text>
        </FadeInView>

        <FadeInView delay={120} style={styles.formCard}>
          <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
            <Ionicons name="keypad-outline" size={20} color={palette.textMuted} style={styles.inputIcon} />
            <TextInput
              placeholder="Código de 6 dígitos"
              placeholderTextColor={palette.textMuted}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoCorrect={false}
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              style={styles.input}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>

          <PrimaryButton
            label={busy ? 'Verificando...' : 'Verificar'}
            onPress={handleVerify}
            disabled={busy}
            style={styles.button}
          />
        </FadeInView>

        <FadeInView delay={240} style={styles.footer}>
          <TouchableOpacity style={styles.link} onPress={handleResend} disabled={cooldown > 0}>
            <Text style={[styles.linkText, cooldown > 0 && styles.linkTextDisabled]}>
              {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={goHome}>
            <Text style={styles.skipText}>Omitir por ahora</Text>
          </TouchableOpacity>
        </FadeInView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (palette) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: palette.background },
    container: { flex: 1, backgroundColor: palette.background },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
    backButton: { position: 'absolute', left: spacing.lg, top: spacing.xl, padding: spacing.sm, zIndex: 1 },
    header: { alignItems: 'center', marginBottom: spacing.xl, marginTop: spacing.xxl },
    logoContainer: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: palette.card,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
      ...softShadow(palette),
    },
    title: {
      fontFamily: font.semibold,
      fontSize: 24,
      lineHeight: 30,
      color: palette.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: font.regular,
      fontSize: 14,
      color: palette.textMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    formCard: {
      backgroundColor: palette.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      ...softShadow(palette),
    },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      borderWidth: 1.5,
      borderColor: 'transparent',
      borderRadius: radius.lg,
      backgroundColor: palette.background,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    inputBoxFocused: { borderColor: palette.primary, backgroundColor: palette.card },
    inputIcon: { marginRight: spacing.sm, opacity: 0.7 },
    input: {
      flex: 1,
      height: '100%',
      fontSize: 16,
      fontFamily: font.regular,
      color: palette.textPrimary,
      backgroundColor: 'transparent',
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
    },
    button: { marginTop: spacing.sm },
    footer: { alignItems: 'center', marginTop: spacing.xl },
    link: { padding: spacing.sm, alignItems: 'center' },
    linkText: { color: palette.primary, fontFamily: font.semibold, fontSize: 15, textAlign: 'center' },
    linkTextDisabled: { color: palette.textMuted },
    skipText: { color: palette.textMuted, fontFamily: font.regular, fontSize: 14, textAlign: 'center' },
  });
