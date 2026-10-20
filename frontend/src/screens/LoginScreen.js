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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, softShadow, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

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
          <Text style={styles.welcomeText}>Bienvenido</Text>
          <View style={styles.logoContainer}>
            <Ionicons name="flower" size={40} color={palette.primary} />
          </View>
          <Text style={styles.logoText}>BloomApp</Text>
          <Text style={styles.sloganText}>LÚMINA BEAUTY STUDIO</Text>
        </FadeInView>

        {/* Formulario de login mejorado estéticamente */}
        <FadeInView delay={120} style={styles.formCard}>
          <Text style={styles.formTitle}>Inicia sesión</Text>
          <Text style={styles.formSubtitle}>Ingresa tus datos para continuar</Text>

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

          {/* Botón de login */}
          <PrimaryButton
            label="Iniciar sesión"
            onPress={() => login({ nombre: email.split('@')[0] || 'Camila' })}
            style={styles.loginButton}
          />
        </FadeInView>

        {/* Enlace de registro */}
        <FadeInView delay={240} style={styles.footer}>
          <Text style={styles.dividerText}>¿Aún no tienes cuenta?</Text>
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
    sloganText: {
      color: palette.textMuted,
      fontFamily: font.regular,
      fontSize: 12,
      letterSpacing: 1.6,
      marginTop: spacing.xs,
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
    footer: { alignItems: 'center', marginTop: spacing.xl },
    dividerText: { color: palette.textMuted, fontFamily: font.regular, fontSize: 14, textAlign: 'center' },
    signupLink: { marginTop: spacing.sm, padding: spacing.sm, alignItems: 'center' },
    signupLinkText: { color: palette.primary, fontFamily: font.semibold, fontSize: 15, textAlign: 'center' },
  });

export const options = {
  title: 'Login - BloomApp',
};