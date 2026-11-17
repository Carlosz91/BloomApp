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
import { useTheme } from '../theme/ThemeContext';
import { font, radius, softShadow, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';
import { API_BASE_URL } from '../config/api';
import { showErrorToast, showInfoToast, showSuccessToast } from '../services/Notifications';

const RESEND_COOLDOWN_SECONDS = 60;
const PASSWORD_MIN_LENGTH = 10;

// Step 2 of the password recovery flow: code + new password. Nothing here is
// persisted; the email travels only as a navigation param.
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const paramEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const [email, setEmail] = useState(paramEmail || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [busy, setBusy] = useState(false);
  // Arriving from "Enviar código" means a code was just requested.
  const [cooldown, setCooldown] = useState(paramEmail ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const post = async (path, body) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const handleResend = async () => {
    const cleanEmail = email.trim();
    if (cooldown > 0) return;
    if (!cleanEmail) {
      showErrorToast({ title: 'Falta el correo', description: 'Ingresá tu correo electrónico' });
      return;
    }
    try {
      const { ok, data } = await post('/auth/forgot-password', { email: cleanEmail });
      if (!ok) {
        showErrorToast({ title: 'No pudimos reenviar el código', description: data.message || 'Probá más tarde' });
        return;
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      showInfoToast({ title: 'Código enviado', description: data.message || 'Revisá tu correo' });
    } catch {
      showErrorToast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor' });
    }
  };

  const handleReset = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^\d{6}$/.test(code)) {
      showErrorToast({ title: 'Datos incompletos', description: 'Ingresá tu correo y el código de 6 dígitos' });
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      showErrorToast({
        title: 'Contraseña muy corta',
        description: `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
      });
      return;
    }
    if (password !== confirm) {
      showErrorToast({ title: 'Las contraseñas no coinciden', description: 'Revisá que sean iguales' });
      return;
    }
    setBusy(true);
    try {
      const { ok, data } = await post('/auth/reset-password', {
        email: cleanEmail,
        code,
        newPassword: password,
      });
      if (!ok) {
        showErrorToast({
          title: 'No se pudo cambiar la contraseña',
          description: data.message || 'Código inválido o vencido',
        });
        return;
      }
      showSuccessToast({
        title: 'Contraseña actualizada',
        description: data.message || 'Ya podés iniciar sesión con tu nueva contraseña',
      });
      router.replace('/login');
    } catch {
      showErrorToast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor' });
    } finally {
      setBusy(false);
    }
  };

  const inputBox = (name) => [styles.inputBox, focused === name && styles.inputBoxFocused];
  const focusProps = (name) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  });

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
            <Ionicons name="shield-checkmark-outline" size={34} color={palette.primary} />
          </View>
          <Text style={styles.title}>Nueva contraseña</Text>
          <Text style={styles.subtitle}>Ingresá el código que te enviamos y elegí tu nueva contraseña</Text>
        </FadeInView>

        <FadeInView delay={120} style={styles.formCard}>
          {!paramEmail && (
            <View style={inputBox('email')}>
              <Ionicons name="mail-outline" size={20} color={palette.textMuted} style={styles.inputIcon} />
              <TextInput
                placeholder="Correo electrónico"
                placeholderTextColor={palette.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                style={styles.input}
                {...focusProps('email')}
              />
            </View>
          )}

          <View style={inputBox('code')}>
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
              {...focusProps('code')}
            />
          </View>

          <View style={inputBox('password')}>
            <Ionicons name="lock-closed-outline" size={20} color={palette.textMuted} style={styles.inputIcon} />
            <TextInput
              placeholder="Nueva contraseña"
              placeholderTextColor={palette.textMuted}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              style={styles.input}
              {...focusProps('password')}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.toggle} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={palette.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Mínimo {PASSWORD_MIN_LENGTH} caracteres</Text>

          <View style={inputBox('confirm')}>
            <Ionicons name="lock-closed-outline" size={20} color={palette.textMuted} style={styles.inputIcon} />
            <TextInput
              placeholder="Confirmar contraseña"
              placeholderTextColor={palette.textMuted}
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              style={styles.input}
              {...focusProps('confirm')}
            />
          </View>

          <PrimaryButton
            label={busy ? 'Guardando...' : 'Cambiar contraseña'}
            onPress={handleReset}
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
    toggle: { paddingLeft: spacing.sm },
    hint: {
      color: palette.textMuted,
      fontFamily: font.regular,
      fontSize: 12,
      marginTop: -spacing.sm,
      marginBottom: spacing.md,
      marginLeft: spacing.xs,
    },
    button: { marginTop: spacing.sm },
    footer: { alignItems: 'center', marginTop: spacing.xl },
    link: { padding: spacing.sm, alignItems: 'center' },
    linkText: { color: palette.primary, fontFamily: font.semibold, fontSize: 15, textAlign: 'center' },
    linkTextDisabled: { color: palette.textMuted },
  });
