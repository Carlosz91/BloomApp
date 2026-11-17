import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, softShadow, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';

// Completes the redirect window when this page IS the OAuth popup landing
// page; harmless no-op on any other load. Required for web popup flows.
WebBrowser.maybeCompleteAuthSession();

// Google sign-in is web-only in this phase: native builds require a
// development build (custom native code) and are supported by the same
// backend endpoint. The button is rendered only for web + configured client.
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_ENABLED = Platform.OS === 'web' && Boolean(GOOGLE_CLIENT_ID);
// Server nonces live 10 minutes; refresh a little earlier so a user who sits
// on the login screen never submits an expired one.
const GOOGLE_NONCE_REFRESH_MS = 8 * 60 * 1000;
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

// OAuth button for web only. Isolated component keeps the auth hooks alive
// in their own render tree so the main screen stays hook-safe without the
// Google flow.
function GoogleSignInButton({ palette, styles, busy, nonce, onIdToken }) {
  const redirectUri = AuthSession.makeRedirectUri({ preferLocalhost: true });
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      // Implicit (id_token) responses reject PKCE params on Google's side
      // ("code_challenge_method not allowed for this message type").
      usePKCE: false,
      // Google enforces a nonce for id_token implicit flows; the nonce is
      // embedded in the returned token and the backend cross-checks that
      // it matches this exact browser session (anti-replay).
      extraParams: nonce ? { nonce } : {},
      // Force Google's account chooser: without it, Google silently
      // reuses whatever account the browser already remembers.
      prompt: AuthSession.Prompt.SelectAccount,
    },
    GOOGLE_DISCOVERY
  );

  // Submit each id_token exactly once. `onIdToken` changes identity on every
  // parent render, so without this guard the effect re-fires while the Google
  // response is still 'success' and resubmits the same token; the nonce is
  // single-use, so every resubmission after the first would be rejected.
  const submittedTokenRef = useRef('');
  useEffect(() => {
    const idToken = response?.type === 'success' ? response.params?.id_token : '';
    if (!idToken || submittedTokenRef.current === idToken) return;
    submittedTokenRef.current = idToken;
    onIdToken(idToken, nonce);
  }, [response, onIdToken, nonce]);

  const disabled = busy || !request;

  return (
    <TouchableOpacity
      style={[styles.googleButton, disabled && styles.googleButtonDisabled]}
      onPress={() => promptAsync()}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.googleIconWrap}>
        <Ionicons name="logo-google" size={20} color="#DB4437" />
      </View>
      <Text style={styles.googleButtonText}>Continuar con Google</Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleNonce, setGoogleNonce] = useState('');

  // Google requires a nonce for implicit id_token flows. It is issued by the
  // backend (single-use, short-lived) so a captured token cannot be replayed
  // or forged against us. Any failure just keeps the Google button hidden.
  const nonceRequestId = useRef(0);
  const fetchGoogleNonce = useCallback(async () => {
    const requestId = ++nonceRequestId.current;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google/nonce`);
      if (!res.ok) throw new Error('nonce request failed');
      const data = await res.json();
      if (requestId === nonceRequestId.current) {
        setGoogleNonce(typeof data?.nonce === 'string' ? data.nonce : '');
      }
    } catch {
      if (requestId === nonceRequestId.current) setGoogleNonce('');
    }
  }, []);

  useEffect(() => {
    if (!GOOGLE_ENABLED) return undefined;
    const first = setTimeout(fetchGoogleNonce, 0);
    const timer = setInterval(fetchGoogleNonce, GOOGLE_NONCE_REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      nonceRequestId.current += 1; // ignore any in-flight response
    };
  }, [fetchGoogleNonce]);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  // Envía exactamente lo que el usuario escribió; AuthContext valida y
  // muestra el toast de error si algo falla (red, credenciales inválidas).
  const handleLogin = async () => {
    try {
      await login({ email: email.trim(), password });
      router.replace('/home');
    } catch {
      // Error ya notificado al usuario desde AuthContext
    }
  };

  // Recibe el id_token ya emitido por Google junto con el nonce que pidió
  // este flujo, y los intercambia por una sesión BloomApp en el backend
  // (AuthContext maneja errores con toast). El nonce es de un solo uso: se
  // descarta y se pide uno nuevo después de cada intento.
  const handleGoogleIdToken = async (idToken, nonce) => {
    setGoogleBusy(true);
    setGoogleNonce('');
    try {
      await loginWithGoogle({ idToken, nonce });
      router.replace('/home');
    } catch {
      // Error ya notificado al usuario desde AuthContext
    } finally {
      setGoogleBusy(false);
      fetchGoogleNonce();
    }
  };

  const inputBox = (name) => [styles.inputBox, focused === name && styles.inputBoxFocused];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header con logotipo y slogan */}
        <FadeInView style={styles.header}>
          <Text style={styles.welcomeText}>Te damos la bienvenida</Text>
          <View style={styles.logoContainer}>
            <Ionicons name="flower" size={40} color={palette.primary} />
          </View>
          <Text style={styles.logoText}>BloomApp</Text>
        </FadeInView>

        {/* Formulario de login mejorado estéticamente */}
        <FadeInView delay={120} style={styles.formCard}>
          <Text style={styles.formTitle}>Inicia sesión</Text>
          <Text style={styles.formSubtitle}>Ingresá tus datos para continuar</Text>

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
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              style={styles.input}
            />
          </View>

          <View style={inputBox('password')}>
            <Ionicons name="lock-closed-outline" size={20} color={palette.textMuted} style={styles.inputIcon} />
            <TextInput
              placeholder="Contraseña"
              placeholderTextColor={palette.textMuted}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              style={styles.input}
            />
            <TouchableOpacity onPress={togglePasswordVisibility} style={styles.togglePassword} hitSlop={8}>
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={palette.textMuted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotLink}
            onPress={() => router.push('/forgot-password')}
            hitSlop={8}
          >
            <Text style={styles.forgotLinkText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {/* Botón de login */}
          <PrimaryButton
            label="Iniciar sesión"
            onPress={handleLogin}
            style={styles.loginButton}
          />

          {/* Login con Google: solo web con client ID configurado.
              Boolean() es clave: si googleNonce aún es '' (primer render,
              el nonce async no llegó), `&&` devolvería una cadena vacía y
              React la trataría como text node dentro del View card. */}
          {GOOGLE_ENABLED && Boolean(googleNonce) && (
            <View style={styles.googleSection}>
              <View style={styles.orDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.orText}>o</Text>
                <View style={styles.dividerLine} />
              </View>
              <GoogleSignInButton
                key={googleNonce}
                palette={palette}
                styles={styles}
                busy={googleBusy}
                nonce={googleNonce}
                onIdToken={handleGoogleIdToken}
              />
            </View>
          )}
        </FadeInView>

        {/* Enlace de registro */}
        <FadeInView delay={240} style={styles.footer}>
          <Text style={styles.dividerText}>¿Todavía no tenés cuenta?</Text>
          <TouchableOpacity style={styles.signupLink} onPress={() => router.push('/signup')}>
            <Text style={styles.signupLinkText}>Crear cuenta</Text>
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
    header: { alignItems: 'center', marginBottom: spacing.xxl },
    welcomeText: {
      color: palette.textPrimary,
      fontFamily: font.semibold,
      fontSize: 28,
      lineHeight: 34,
      marginBottom: spacing.lg,
    },
    logoContainer: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: palette.card,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
      ...softShadow(palette),
    },
    logoText: {
      color: palette.primary,
      fontSize: 30,
      lineHeight: 36,
      fontFamily: font.semibold,
    },
    formCard: {
      backgroundColor: palette.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      ...softShadow(palette),
    },
    formTitle: {
      fontFamily: font.semibold,
      fontSize: 22,
      lineHeight: 28,
      color: palette.textPrimary,
      textAlign: 'center',
    },
    formSubtitle: {
      fontFamily: font.regular,
      fontSize: 14,
      color: palette.textMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.xl,
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
    togglePassword: { paddingLeft: spacing.sm },
    loginButton: { marginTop: spacing.md },
    forgotLink: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
    forgotLinkText: { color: palette.primary, fontFamily: font.semibold, fontSize: 14 },
    googleSection: { marginTop: spacing.lg },
    orDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: palette.border },
    orText: {
      color: palette.textMuted,
      fontFamily: font.regular,
      fontSize: 13,
      marginHorizontal: spacing.sm,
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: palette.card,
      borderWidth: 1.5,
      borderColor: palette.border,
      paddingHorizontal: spacing.md,
    },
    googleButtonDisabled: { opacity: 0.6 },
    googleIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: palette.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    googleButtonText: {
      color: palette.textPrimary,
      fontFamily: font.semibold,
      fontSize: 15,
    },
    footer: { alignItems: 'center', marginTop: spacing.xl },
    dividerText: { color: palette.textMuted, fontFamily: font.regular, fontSize: 14, textAlign: 'center' },
    signupLink: { marginTop: spacing.sm, padding: spacing.sm, alignItems: 'center' },
    signupLinkText: { color: palette.primary, fontFamily: font.semibold, fontSize: 15, textAlign: 'center' },
  });

export const options = {
  title: 'Login - BloomApp',
};