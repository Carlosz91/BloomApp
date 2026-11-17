import React, { useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, softShadow, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';
import { API_BASE_URL } from '../config/api';
import { showErrorToast, showInfoToast } from '../services/Notifications';

// Step 1 of the password recovery flow: asks for the email and requests a
// 6-digit code. The server answers the same generic message whether or not
// the account exists, so this screen never reveals it either.
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const handleSend = async () => {
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showErrorToast({ title: 'Email inválido', description: 'Ingresá un correo electrónico válido' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showErrorToast({
          title: 'No pudimos enviar el código',
          description: data.message || 'Probá de nuevo en unos minutos',
        });
        return;
      }
      showInfoToast({
        title: 'Revisá tu correo',
        description: data.message || 'Si el correo está registrado, te enviamos un código',
      });
      router.push({ pathname: '/reset-password', params: { email: cleanEmail } });
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
            <Ionicons name="key-outline" size={34} color={palette.primary} />
          </View>
          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresá tu correo y te enviamos un código de 6 dígitos
          </Text>
        </FadeInView>

        <FadeInView delay={120} style={styles.formCard}>
          <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
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
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={styles.input}
            />
          </View>
          <PrimaryButton
            label={busy ? 'Enviando...' : 'Enviar código'}
            onPress={handleSend}
            disabled={busy}
            style={styles.button}
          />
        </FadeInView>

        <FadeInView delay={240} style={styles.footer}>
          <TouchableOpacity
            style={styles.link}
            onPress={() => router.push({ pathname: '/reset-password', params: { email: email.trim() } })}
          >
            <Text style={styles.linkText}>Ya tengo un código</Text>
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
  });
