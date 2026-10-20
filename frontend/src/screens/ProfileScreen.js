import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { cardStyle, font, radius, softShadow, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';
import { showSuccessToast, showErrorToast } from '../services/Notifications';
import { API_BASE_URL } from '../config/api';

export default function ProfileScreen() {
  const { logout, user, updateUser, token } = useAuth();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const paletteColors = palette;
  const styles = useMemo(() => makeStyles(paletteColors), [paletteColors]);
  const [profile, setProfile] = useState({
    nombre: user?.nombre || '',
    telefono: user?.telefono || '',
    email: user?.email || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({});

  // Refrescar datos del usuario autenticado desde la API
  useEffect(() => {
    if (!token) return;
    let active = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active && data.user) {
            setProfile({
              nombre: data.user.nombre || '',
              telefono: data.user.telefono || '',
              email: data.user.email || '',
            });
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
    return () => {
      active = false;
    };
  }, [token]);

  const validateProfile = () => {
    const errors = {};
    if (profile.nombre && profile.nombre.length < 2) {
      errors.nombre = 'El nombre debe tener al menos 2 caracteres';
    }
    if (profile.telefono) {
      const phoneDigits = profile.telefono.replace(/\D/g, '');
      if (phoneDigits.length < 7 || phoneDigits.length > 12) {
        errors.telefono = 'Teléfono inválido: entre 7 y 12 dígitos';
      }
    }
    if (profile.email && !profile.email.includes('@')) {
      errors.email = 'Correo electrónico no válido';
    }
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateProfile()) return;
    setIsSaving(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre: profile.nombre, telefono: profile.telefono }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.user) {
        setProfile({
          nombre: data.user.nombre || profile.nombre,
          telefono: data.user.telefono || '',
          email: data.user.email || profile.email,
        });
        await updateUser({
          nombre: data.user.nombre,
          telefono: data.user.telefono,
        });
        showSuccessToast({
          title: 'Perfil actualizado',
          description: 'Tus datos fueron actualizados exitosamente',
        });
        setEditing(false);
      } else {
        showErrorToast({
          title: 'Error al guardar',
          description: data?.message || 'No se pudo actualizar el perfil',
        });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      showErrorToast({
        title: 'Error de conexión',
        description: 'Por favor intente de nuevo',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const initial = (profile.nombre || '?').trim().charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <HeaderProfile
        styles={styles}
        topInset={insets.top}
        initial={initial}
        profile={profile}
      />
      {editing ? (
        <FadeInView>
          <EditProfileForm
            styles={styles}
            palette={paletteColors}
            profile={profile}
            setProfile={setProfile}
            onSave={handleSave}
            onCancel={handleCancel}
            errors={errors}
          />
        </FadeInView>) : (
        <FadeInView delay={100} style={styles.profileView}>
          <View style={styles.profileCard}>
            <ProfileRow styles={styles} palette={paletteColors} icon="person-outline" label="Nombre" value={profile.nombre} />
            <ProfileRow styles={styles} palette={paletteColors} icon="call-outline" label="Teléfono" value={profile.telefono} />
            <ProfileRow styles={styles} palette={paletteColors} icon="mail-outline" label="Correo electrónico" value={profile.email} last />
          </View>
          <PrimaryButton
            label="Editar perfil"
            icon="create-outline"
            onPress={() => setEditing(true)}
            style={styles.editButton}
          />
          <PrimaryButton
            label="Cerrar sesión"
            icon="log-out-outline"
            variant="secondary"
            onPress={logout}
            style={styles.logoutButton}
          />
        </FadeInView>
      )}
    </ScrollView>
  );
}

const ProfileRow = ({ styles, palette, icon, label, value, last }) => (
  <View style={[styles.profileFieldRow, last && styles.profileFieldRowLast]}>
    <View style={styles.rowIcon}>
      <Ionicons name={icon} size={18} color={palette.primary} />
    </View>
    <View style={styles.rowText}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  </View>
);

const HeaderProfile = ({ styles, topInset, initial, profile }) => (
  <FadeInView style={[styles.header, { paddingTop: topInset + spacing.lg }]}>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
    <Text style={styles.headerTitle}>{profile.nombre}</Text>
    <Text style={styles.headerSubTitle}>{profile.email}</Text>
  </FadeInView>
);

const EditProfileForm = ({ styles, palette, profile, setProfile, onSave, onCancel, errors }) => (
  <View style={styles.formContainer}>
    <View style={styles.fieldRow}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={palette.textMuted}
        value={profile.nombre}
        onChangeText={n => setProfile({ ...profile, nombre: n })}
        placeholder="Tu nombre completo"
        maxLength={50}
      />
      {errors.nombre && <Text style={styles.errorText}>{errors.nombre}</Text>}
    </View>

    <View style={styles.fieldRow}>
      <Text style={styles.label}>Teléfono</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={palette.textMuted}
        keyboardType="phone-pad"
        value={profile.telefono}
        onChangeText={n => setProfile({ ...profile, telefono: n })}
        placeholder="0981 123 456"
        maxLength={12}
      />
      {errors.telefono && <Text style={styles.errorText}>{errors.telefono}</Text>}
    </View>

    <View style={styles.fieldRow}>
      <Text style={styles.label}>Correo electrónico</Text>
      <TextInput
        style={[styles.input, styles.inputDisabled]}
        placeholderTextColor={palette.textMuted}
        value={profile.email}
        onChangeText={n => setProfile({ ...profile, email: n })}
        placeholder="camila@luminabeauty.com"
        editable={false}
      />
    </View>

    <View style={styles.actions}>
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancelar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveButtonText}>Guardar cambios</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const makeStyles = (paletteColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paletteColors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
    backgroundColor: paletteColors.primary,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: paletteColors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    ...softShadow(paletteColors),
  },
  avatarText: {
    color: paletteColors.primary,
    fontSize: 34,
    fontFamily: font.semibold,
  },
  headerTitle: {
    color: paletteColors.onPrimary,
    fontSize: 22,
    fontFamily: font.semibold,
  },
  headerSubTitle: {
    color: paletteColors.onPrimary,
    opacity: 0.8,
    fontSize: 14,
    fontFamily: font.regular,
    marginTop: 2,
  },
  profileView: {
    padding: spacing.xl,
  },
  profileCard: {
    ...cardStyle(paletteColors),
    paddingVertical: spacing.sm,
  },
  profileFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paletteColors.border,
  },
  profileFieldRowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: paletteColors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  profileLabel: {
    color: paletteColors.textMuted,
    fontSize: 12,
    fontFamily: font.regular,
  },
  profileValue: {
    color: paletteColors.textPrimary,
    fontSize: 16,
    fontFamily: font.semibold,
    marginTop: 2,
  },
  editButton: {
    marginTop: spacing.xl,
  },
  logoutButton: {
    marginTop: spacing.md,
  },
  formContainer: {
    ...cardStyle(paletteColors),
    margin: spacing.xl,
    padding: spacing.xl,
  },
  fieldRow: {
    marginBottom: spacing.xs,
  },
  label: {
    color: paletteColors.textMuted,
    fontSize: 13,
    fontFamily: font.semibold,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: paletteColors.inputBg,
    borderColor: paletteColors.border,
    borderWidth: 1.5,
    color: paletteColors.textPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    fontSize: 16,
    fontFamily: font.regular,
    marginBottom: spacing.lg,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: paletteColors.error,
    fontSize: 12,
    fontFamily: font.regular,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  saveButton: {
    backgroundColor: paletteColors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  saveButtonText: {
    color: paletteColors.onPrimary,
    fontSize: 15,
    fontFamily: font.semibold,
  },
  cancelButton: {
    marginRight: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: paletteColors.border,
  },
  cancelButtonText: {
    color: paletteColors.textPrimary,
    fontSize: 15,
    fontFamily: font.semibold,
  },
});
