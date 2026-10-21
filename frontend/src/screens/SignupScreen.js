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
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { font, radius, softShadow, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';

export default function SignupScreen() {
  const { register } = useAuth();
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirm: '', genero: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [errors, setErrors] = useState({});

  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const next = {};
    if (form.nombre.trim().length < 2) next.nombre = 'El nombre debe tener al menos 2 caracteres';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Correo electrónico no válido';
    if (form.password.length < 6) next.password = 'La contraseña debe tener al menos 6 caracteres';
    if (form.confirm !== form.password) next.confirm = 'Las contraseñas no coinciden';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Registro con los campos completos del formulario; AuthContext valida y
  // notifica errores vía toast (credenciales inválidas, problema de red, etc.)
  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await register({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        genero: form.genero,
      });
      router.replace('/home');
    } catch {
      // Error ya notificado al usuario desde AuthContext
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const inputBox = (name) => [
    styles.inputBox,
    focused === name && styles.inputBoxFocused,
    errors[name] && styles.inputBoxError,
  ];

  const field = (name, icon, props, trailing) => (
    <View style={styles.field}>
      <View style={inputBox(name)}>
        <Ionicons name={icon} size={20} color={palette.textMuted} style={styles.inputIcon} />
        <TextInput
          placeholderTextColor={palette.textMuted}
          value={form[name]}
          onChangeText={setField(name)}
          onFocus={() => setFocused(name)}
          onBlur={() => setFocused(null)}
          style={styles.input}
          {...props}
        />
        {trailing}
      </View>
      {errors[name] ? <Text style={styles.errorText}>{errors[name]}</Text> : null}
    </View>
  );

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
            <Ionicons name="flower" size={34} color={palette.primary} />
          </View>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Únete a BloomApp y reserva tu próxima cita</Text>
        </FadeInView>

        <FadeInView delay={120} style={styles.formCard}>
          {field('nombre', 'person-outline', {
            placeholder: 'Nombre completo',
            autoCapitalize: 'words',
            maxLength: 50,
          })}
          {field('email', 'mail-outline', {
            placeholder: 'Correo electrónico',
            autoCapitalize: 'none',
            autoCorrect: false,
            keyboardType: 'email-address',
          })}
          {field(
            'password',
            'lock-closed-outline',
            {
              placeholder: 'Contraseña',
              autoCapitalize: 'none',
              autoCorrect: false,
              secureTextEntry: !showPassword,
            },
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.toggle} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={palette.textMuted} />
            </TouchableOpacity>
          )}
          {field('confirm', 'shield-checkmark-outline', {
            placeholder: 'Confirmar contraseña',
            autoCapitalize: 'none',
            autoCorrect: false,
            secureTextEntry: !showPassword,
          })}

          <View style={styles.genderBlock}>
            <Text style={styles.genderLabel}>¿CÓMO TE SALUDAMOS?</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[styles.genderButton, form.genero === 'hombre' && styles.genderButtonActive]}
                onPress={() => setField('genero')('hombre')}
                accessibilityRole="button"
              >
                <Text style={[styles.genderText, form.genero === 'hombre' && styles.genderTextActive]}>
                  Hombre
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, form.genero === 'mujer' && styles.genderButtonActive]}
                onPress={() => setField('genero')('mujer')}
                accessibilityRole="button"
              >
                <Text style={[styles.genderText, form.genero === 'mujer' && styles.genderTextActive]}>
                  Mujer
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <PrimaryButton label="Crear cuenta" onPress={handleSubmit} style={styles.submit} />
        </FadeInView>

        <FadeInView delay={240} style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tenés cuenta?</Text>
          <TouchableOpacity style={styles.link} onPress={goBack}>
            <Text style={styles.linkText}>Iniciar sesión</Text>
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
      marginBottom: spacing.lg,
      ...softShadow(palette),
    },
    title: { color: palette.textPrimary, fontFamily: font.semibold, fontSize: 28, lineHeight: 34 },
    subtitle: {
      color: palette.textMuted,
      fontFamily: font.regular,
      fontSize: 14,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    formCard: {
      backgroundColor: palette.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      ...softShadow(palette),
    },
    field: { marginBottom: spacing.md },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      borderWidth: 1.5,
      borderColor: 'transparent',
      borderRadius: radius.lg,
      backgroundColor: palette.background,
      paddingHorizontal: spacing.md,
    },
    inputBoxFocused: { borderColor: palette.primary, backgroundColor: palette.card },
    inputBoxError: { borderColor: palette.error },
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
    errorText: {
      color: palette.error,
      fontFamily: font.regular,
      fontSize: 12,
      marginTop: spacing.xs,
      marginLeft: spacing.sm,
    },
    submit: { marginTop: spacing.md },
    genderBlock: { marginBottom: spacing.sm },
    genderLabel: {
      color: palette.textMuted,
      fontFamily: font.semibold,
      fontSize: 12,
      letterSpacing: 0.4,
      marginBottom: spacing.sm,
    },
    genderRow: { flexDirection: 'row', gap: spacing.sm },
    genderButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      borderWidth: 1.5,
      borderColor: 'transparent',
      borderRadius: radius.lg,
      backgroundColor: palette.background,
    },
    genderButtonActive: { borderColor: palette.primary, backgroundColor: palette.card },
    genderText: { color: palette.textMuted, fontFamily: font.regular, fontSize: 15 },
    genderTextActive: { color: palette.primary, fontFamily: font.semibold },
    footer: { alignItems: 'center', marginTop: spacing.xl },
    footerText: { color: palette.textMuted, fontFamily: font.regular, fontSize: 14 },
    link: { marginTop: spacing.sm, padding: spacing.sm },
    linkText: { color: palette.primary, fontFamily: font.semibold, fontSize: 15 },
  });
