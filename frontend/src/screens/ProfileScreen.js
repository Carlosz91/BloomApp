import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { cardStyle, softShadow, font, radius, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';
import { showSuccessToast, showErrorToast } from '../services/Notifications';
import { API_BASE_URL } from '../config/api';

const PREFERENCIAS_STORAGE_KEY = 'bloomapp_preferencias';

// Contacto directo del estudio (WhatsApp de reservas y consultas).
const WHATSAPP_URL = 'https://wa.me/595982143176?text=Hola%20BloomApp%2C%20tengo%20una%20consulta';
// Preferencias de novedades: se persisten localmente (AsyncStorage) para que
// el estado sobreviva a la sesión; son una preferencia de app, no un dato de cuenta.
const PREFERENCIAS_FILAS = [
  { key: 'cejas', titulo: 'Promociones de cejas', texto: 'Descuentos, combos y lanzamientos.' },
  { key: 'rostro', titulo: 'Cuidados para el rostro', texto: 'Tips, novedades y rituales faciales.' },
  { key: 'estudio', titulo: 'Novedades del estudio', texto: 'Noticias y experiencias especiales.' },
];

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
    genero: user?.genero || '',
    creado_en: user?.creado_en || null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({});
  const [preferencias, setPreferencias] = useState({ cejas: true, rostro: true, estudio: false });

  // Cargar preferencias guardadas en el arranque de la pantalla.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PREFERENCIAS_STORAGE_KEY)
      .then((stored) => {
        if (active && stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object') {
              setPreferencias((prev) => ({ ...prev, ...parsed }));
            }
          } catch {
            // JSON corrupto: se mantienen los valores por defecto.
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
              genero: data.user.genero || '',
              creado_en: data.user.creado_en || null,
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
        body: JSON.stringify({ nombre: profile.nombre, telefono: profile.telefono, genero: profile.genero }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.user) {
        setProfile({
          nombre: data.user.nombre || profile.nombre,
          telefono: data.user.telefono || '',
          email: data.user.email || profile.email,
          genero: data.user.genero ?? profile.genero,
          // El backend no modifica creado_en desde /auth/profile: preservamos
          // el valor ya cargado para que "Parte de Bloom desde…" no parpadee
          // al fallback estático después de guardar.
          creado_en: data.user.creado_en ?? profile.creado_en,
        });
        await updateUser({
          nombre: data.user.nombre,
          telefono: data.user.telefono,
          genero: data.user.genero,
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

  // Preferencias se guardan en AsyncStorage: el toast solo se muestra si la
  // escritura real tuvo éxito.
  const guardarPreferencias = async () => {
    try {
      await AsyncStorage.setItem(PREFERENCIAS_STORAGE_KEY, JSON.stringify(preferencias));
      showSuccessToast({
        title: 'Preferencias guardadas',
        description: 'Tus preferencias se guardaron',
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      showErrorToast({
        title: 'Error al guardar',
        description: 'No se pudieron guardar tus preferencias',
      });
    }
  };

  const abrirWhatsApp = () => {
    // Nativo: deep-link directo a la app de WhatsApp con mensaje armado.
    // Web: navegación en la MISMA pestaña — window.open(_blank) deja al
    // usuario varado en el intersticial de api.whatsapp.com ("webhook"),
    // y el botón atrás del navegador es la salida clara de vuelta a la app.
    if (Platform.OS === 'web') {
      window.location.assign(WHATSAPP_URL);
      return;
    }
    Linking.openURL(WHATSAPP_URL).catch(() => {});
  };

  const initial = (profile.nombre || '?').trim().charAt(0).toUpperCase();
  const primerNombre = (profile.nombre || '').trim().split(/\s+/)[0] || '';
  const tituloSaludo = primerNombre ? `Hola, ${primerNombre}` : 'Hola';
  // Membership year comes from the user's signup date in the DB; the static
  // fallback only covers sessions created before the field existed.
  const miembroDesde = profile.creado_en ? new Date(profile.creado_en).getFullYear() : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.pageHeading, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.pageEyebrow}>MI ESPACIO</Text>
        <Text style={styles.pageTitle}>{tituloSaludo}</Text>
        <Text style={styles.pageSubTitle}>Personalizá tus intereses para recibir novedades que realmente te gusten.</Text>
      </View>

      {/* Tarjeta de perfil centrada */}
      <FadeInView delay={60} style={styles.sectionWrap}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.profileNombre}>{profile.nombre}</Text>
          <Text style={styles.profileEmail}>{profile.email}</Text>
          <View style={styles.profileSince}>
            <Ionicons name="heart" size={12} color={paletteColors.rose} />
            <Text style={styles.profileSinceTexto}>
              {miembroDesde ? `Parte de Bloom desde ${miembroDesde}` : 'Parte de Bloom desde 2023'}
            </Text>
          </View>
        </View>
      </FadeInView>

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
          <View style={styles.datosCard}>
            <ProfileRow styles={styles} palette={paletteColors} icon="person-outline" label="Nombre" value={profile.nombre} />
            <ProfileRow styles={styles} palette={paletteColors} icon="call-outline" label="Teléfono" value={profile.telefono} />
            <ProfileRow styles={styles} palette={paletteColors} icon="mail-outline" label="Correo electrónico" value={profile.email} last />
          </View>
          <PrimaryButton
            label="Editar perfil"
            icon="create-outline"
            variant="secondary"
            onPress={() => setEditing(true)}
            style={styles.editButton}
          />

          {/* Preferencias de novedades */}
          <View style={styles.preferenciasCard}>
            <View style={styles.preferenciasHead}>
            <View style={styles.preferenciasHeadInfo}>
              <Text style={styles.preferenciasTitulo}>Tus preferencias</Text>
              <Text style={styles.preferenciasSub}>Elegí qué novedades querés recibir.</Text>
            </View>
          </View>
            {PREFERENCIAS_FILAS.map((row, i) => {
              const esUltima = i === PREFERENCIAS_FILAS.length - 1;
              return (
                <View key={row.key} style={[styles.prefRow, !esUltima && styles.prefRowSeparador]}>
                  <View style={styles.prefInfo}>
                    <Text style={styles.prefTitulo}>{row.titulo}</Text>
                    <Text style={styles.prefTexto}>{row.texto}</Text>
                  </View>
                  <Switch
                    value={preferencias[row.key]}
                    onValueChange={(valor) => setPreferencias((prev) => ({ ...prev, [row.key]: valor }))}
                    trackColor={{ false: '#d6d0cd', true: paletteColors.sage }}
                    thumbColor="#fffdfb"
                  />
                </View>
              );
            })}
            <TouchableOpacity style={styles.guardarButton} onPress={guardarPreferencias}>
              <Text style={styles.guardarButtonText}>Guardar preferencias</Text>
            </TouchableOpacity>
          </View>

          {/* Consulta por WhatsApp */}
          <View style={styles.contactCard}>
            <View style={styles.contactIcono}>
              <Ionicons name="logo-whatsapp" size={20} color={paletteColors.sage} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitulo}>¿Tenés una consulta?</Text>
              <Text style={styles.contactTexto}>Escribinos por WhatsApp y te ayudamos.</Text>
              {/* Número visible: el usuario no adivina a quién va a contactar. */}
              <Text style={styles.contactNumero}>+595 982 143 176</Text>
            </View>
            <TouchableOpacity style={styles.contactButton} onPress={abrirWhatsApp}>
              <Text style={styles.contactButtonText}>Contactar</Text>
            </TouchableOpacity>
          </View>

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
      <Ionicons name={icon} size={16} color={palette.primary} />
    </View>
    <View style={styles.rowText}>
      <Text style={styles.profileLabel}>{label}</Text>
      {/* Dato vacío: se declara explícitamente en vez de dejar la fila muda. */}
      <Text style={[styles.profileValue, !value && styles.profileValueEmpty]}>
        {value || 'Sin agregar'}
      </Text>
    </View>
  </View>
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
        // 16 caracteres: permite '+595' y espacios sin cortar el número.
        maxLength={16}
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
        placeholder="camila@bloomapp.com"
        editable={false}
      />
    </View>

    <View style={styles.fieldRow}>
      <Text style={styles.label}>¿Cómo te saludamos?</Text>
      <View style={styles.genderRow}>
        <TouchableOpacity
          style={[styles.genderChip, profile.genero === 'hombre' && styles.genderChipActive]}
          onPress={() => setProfile({ ...profile, genero: 'hombre' })}
        >
          <Text style={[styles.genderChipText, profile.genero === 'hombre' && styles.genderChipTextActive]}>
            Hombre
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.genderChip, profile.genero === 'mujer' && styles.genderChipActive]}
          onPress={() => setProfile({ ...profile, genero: 'mujer' })}
        >
          <Text style={[styles.genderChipText, profile.genero === 'mujer' && styles.genderChipTextActive]}>
            Mujer
          </Text>
        </TouchableOpacity>
        {/* Sin respuesta: neutralidad expresada como opción, no como vacío. */}
        <TouchableOpacity
          style={[styles.genderChip, profile.genero === '' && styles.genderChipActive]}
          onPress={() => setProfile({ ...profile, genero: '' })}
        >
          <Text style={[styles.genderChipText, profile.genero === '' && styles.genderChipTextActive]}>
            Prefiero no decirlo
          </Text>
        </TouchableOpacity>
      </View>
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
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // 46%: dos por fila; el tercero crece a ancho completo en la segunda línea.
  genderChip: {
    flex: 1,
    flexBasis: '46%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderWidth: 1.5,
    borderColor: paletteColors.line,
    borderRadius: radius.sm,
    backgroundColor: paletteColors.inputBg,
  },
  genderChipActive: {
    borderColor: paletteColors.primary,
  },
  genderChipText: {
    color: paletteColors.textMuted,
    fontFamily: font.regular,
    fontSize: 15,
  },
  genderChipTextActive: {
    color: paletteColors.primary,
    fontFamily: font.semibold,
  },
  // Dato de cuenta sin completar: mismo tamaño, intencionalmente apagado.
  profileValueEmpty: {
    color: paletteColors.textMuted,
    fontStyle: 'italic',
  },
  sectionWrap: {
    paddingHorizontal: spacing.lg,
  },
  pageHeading: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  pageEyebrow: {
    color: paletteColors.eyebrow,
    fontSize: 10,
    fontFamily: font.semibold,
    letterSpacing: 1.7,
    marginBottom: spacing.xs,
  },
  pageTitle: {
    color: paletteColors.heading,
    fontSize: 27,
    lineHeight: 32,
    fontFamily: font.semibold,
    letterSpacing: -0.9,
    marginTop: 2,
  },
  pageSubTitle: {
    color: paletteColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: font.regular,
    marginTop: spacing.xs,
  },
  // Tarjeta de perfil
  profileCard: {
    ...cardStyle(paletteColors),
    alignItems: 'center',
    padding: 22,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: paletteColors.plumSoft,
    borderWidth: 4,
    // Marco clarito del avatar, tomado del mock
    borderColor: '#faf5f7',
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow(paletteColors),
  },
  avatarText: {
    color: paletteColors.primary,
    fontSize: 22,
    fontFamily: font.semibold,
  },
  profileNombre: {
    color: paletteColors.heading,
    fontSize: 18,
    fontFamily: font.semibold,
    marginTop: 12,
  },
  profileEmail: {
    color: paletteColors.textMuted,
    fontSize: 12,
    fontFamily: font.regular,
    marginTop: 2,
  },
  profileSince: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paletteColors.line,
  },
  profileSinceTexto: {
    color: paletteColors.rose,
    fontSize: 11,
    fontFamily: font.semibold,
  },
  profileView: {
    paddingHorizontal: spacing.lg,
  },
  // Filas de datos del perfil
  datosCard: {
    ...cardStyle(paletteColors),
    paddingVertical: spacing.sm,
  },
  profileFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paletteColors.line,
  },
  profileFieldRowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: paletteColors.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  profileLabel: {
    color: paletteColors.textMuted,
    fontSize: 11,
    fontFamily: font.regular,
  },
  profileValue: {
    color: paletteColors.textPrimary,
    fontSize: 14,
    fontFamily: font.semibold,
    marginTop: 2,
  },
  editButton: {
    marginTop: spacing.xl,
  },
  // Preferencias
  preferenciasCard: {
    ...cardStyle(paletteColors),
    marginTop: spacing.lg,
    padding: 22,
  },
  preferenciasHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: paletteColors.line,
  },
  preferenciasHeadInfo: {
    flex: 1,
  },
  preferenciasTitulo: {
    color: paletteColors.heading,
    fontSize: 16,
    fontFamily: font.semibold,
  },
  preferenciasSub: {
    color: paletteColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: font.regular,
    marginTop: 4,
  },
  prefRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  prefRowSeparador: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paletteColors.line,
  },
  prefInfo: {
    flex: 1,
  },
  prefTitulo: {
    color: paletteColors.textPrimary,
    fontSize: 13,
    fontFamily: font.semibold,
  },
  prefTexto: {
    color: paletteColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: font.regular,
    marginTop: 4,
  },
  guardarButton: {
    alignSelf: 'flex-end',
    marginTop: 16,
    minHeight: 39,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    backgroundColor: paletteColors.btnPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardarButtonText: {
    color: paletteColors.onPrimary,
    fontSize: 12,
    fontFamily: font.semibold,
  },
  // Contacto WhatsApp (franja salvia del mock)
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.lg,
    padding: 16,
    borderRadius: 14,
    backgroundColor: paletteColors.sageBg,
  },
  contactIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: paletteColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  // Tonos salvia del mock para los textos de contacto
  contactTitulo: {
    color: '#43594e',
    fontSize: 13,
    fontFamily: font.semibold,
  },
  contactTexto: {
    color: '#718078',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: font.regular,
    marginTop: 4,
  },
  contactNumero: {
    color: '#43594e',
    fontSize: 12,
    fontFamily: font.semibold,
    marginTop: 4,
  },
  contactButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#cddbd3',
    backgroundColor: paletteColors.card,
  },
  contactButtonText: {
    color: '#587064',
    fontSize: 11,
    fontFamily: font.semibold,
  },
  logoutButton: {
    marginTop: spacing.md,
  },
  formContainer: {
    ...cardStyle(paletteColors),
    margin: spacing.lg,
    padding: spacing.xl,
  },
  fieldRow: {
    marginBottom: spacing.xs,
  },
  label: {
    color: paletteColors.textMuted,
    fontSize: 12,
    fontFamily: font.semibold,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: paletteColors.inputBg,
    borderColor: paletteColors.line,
    borderWidth: 1,
    color: paletteColors.textPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    fontSize: 15,
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
    backgroundColor: paletteColors.btnPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
  },
  saveButtonText: {
    color: paletteColors.onPrimary,
    fontSize: 14,
    fontFamily: font.semibold,
  },
  cancelButton: {
    marginRight: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: paletteColors.line,
  },
  cancelButtonText: {
    color: paletteColors.textPrimary,
    fontSize: 14,
    fontFamily: font.semibold,
  },
});
