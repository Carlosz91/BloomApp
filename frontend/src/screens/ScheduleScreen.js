import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cardStyle, font, radius, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';
import { showSuccessToast, showErrorToast } from '../services/Notifications';
import { API_BASE_URL } from '../config/api';
import { formatColones } from '../utils/format';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEK_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const CATEGORY_TABS = ['Todos', 'Cejas', 'Rostro'];

// Horarios de atención 9:00 - 16:00, etiquetados como meridiam correctos.
const buildTimeSlots = () => {
  const slots = [];
  for (let h = 9; h < 17; h++) {
    const meridiem = h < 12 ? 'AM' : 'PM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    slots.push(`${hh}:00 ${meridiem}`);
  }
  return slots;
};

// Convierte "9:00 AM" / "12:00 PM" a hora en formato 24h.
const hourFromSlot = (label) => {
  const m = /^(\d{1,2}):00 (\w{2})$/.exec(String(label || ''));
  if (!m) return 9;
  let h = parseInt(m[1], 10);
  if (m[2] === 'PM' && h < 12) h += 12;
  if (m[2] === 'AM' && h === 12) h = 0;
  return h;
};

export default function ScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [service, setService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('9:00 AM');
  const [availableTimes, setAvailableTimes] = useState(buildTimeSlots());
  const [isLoading, setIsLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(true);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [dateError, setDateError] = useState(null);
  const [pickedServiceId, setPickedServiceId] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState('Todos');
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // El servicio puede venir por params (clic desde Home) o elegirse acá (pestaña Agenda)
  const activeServiceId = params.serviceId ? String(params.serviceId) : pickedServiceId;

  // Catálogo filtrado por la pestaña activa del selector
  const catalogVisible = useMemo(() => {
    if (catalogFilter === 'Todos') return catalog;
    return catalog.filter((s) => s.categoria === (catalogFilter === 'Rostro' ? 'rostro' : 'cejas'));
  }, [catalog, catalogFilter]);

  // Cargar servicio seleccionado desde el catálogo real
  useEffect(() => {
    let cancelled = false;

    const fetchService = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/services/${activeServiceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Servicio no disponible');
        const data = await res.json();
        if (!cancelled) setService(data.service);
      } catch (error) {
        console.error('Error fetching service:', error);
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // Transiciones de carga dentro de una función interna: evita setState
    // síncrono en el cuerpo del effect y respeta la bandera cancelled.
    const loadService = () => {
      if (!activeServiceId) {
        setIsLoading(false);
        setService(null);
        setLoadFailed(false);
        return;
      }
      setIsLoading(true);
      setLoadFailed(false);
      setService(null);
      fetchService();
      setAvailableTimes(buildTimeSlots());
    };

    loadService();

    return () => {
      cancelled = true;
    };
  }, [activeServiceId, token, reloadKey]);

  // Catálogo para la entrada directa por pestaña (sin servicio preseleccionado)
  useEffect(() => {
    if (activeServiceId || !token) return;

    let cancelled = false;

    const fetchCatalog = async () => {
      setCatalogLoading(true);
      setCatalog([]);
      try {
        const res = await fetch(`${API_BASE_URL}/services`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error al cargar servicios');
        const data = await res.json();
        if (!cancelled) setCatalog(data.services || data);
      } catch (error) {
        console.error('Error loading service catalog:', error);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };

    fetchCatalog();

    return () => {
      cancelled = true;
    };
  }, [activeServiceId, token, reloadKey]);

  const retryLoad = () => setReloadKey(k => k + 1);

  // Volver al selector de categorías desde el formulario de agendado
  const regresarACategorias = () => {
    router.setParams({ serviceId: '' });
    setPickedServiceId(null);
  };

  const handleDateChange = (date) => {
    const selected = new Date(date);
    const now = new Date();

    // Mínimo: hoy, Máximo: 90 días
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 90);

    if (selected < now) {
      setDateError('No puedes seleccionar una fecha pasada');
      setShowDatePicker(false);
      return;
    }

    if (selected > maxDate) {
      setDateError('La fecha máxima es 90 días a partir de hoy');
      setShowDatePicker(false);
      return;
    }

    setDateError(null);
    setSelectedDate(selected);
    // Actualizar horarios disponibles para la fecha seleccionada
    setAvailableTimes(buildTimeSlots());
    setShowDatePicker(false);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    setShowTimePicker(false);
  };

const bookAppointment = async () => {
    // Validaciones
    if (!service) {
      setDateError('Por favor seleccione un servicio');
      return;
    }

    if (dateError) {
      return;
    }

    if (!selectedDate) {
      setDateError('Por favor seleccione una fecha');
      return;
    }

    if (!selectedTime) {
      setDateError('Por favor seleccione una hora');
      return;
    }

    // El backend depende del JWT para user_id y el estado por defecto es 'booked'
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hourFromSlot(selectedTime), 0, 0, 0);
    const appointmentData = {
      service_id: service.id,
      fecha_hora: slotDate.toISOString(),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(appointmentData),
      });

      if (res.ok) {
        const data = await res.json();
        // Toast éxito reserva
        showSuccessToast({
          title: 'Cita agendada',
          description: 'Tu cita ha sido confirmada exitosamente',
        });
        router.push('/appointments');
      } else {
        const err = await res.json();
        // Toast error
        showErrorToast({
          title: 'Error al agendar',
          description: err.message || 'Intente de nuevo',
        });
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      // Toast error de conexión
      showErrorToast({
        title: 'Error de conexión',
        description: 'Por favor intente de nuevo',
      });
    }
  };

  // ---- Calendario (rejilla lunes a domingo) ----
  const hoy = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const fechaLimite = useMemo(() => { const d = new Date(hoy); d.setDate(d.getDate() + 90); return d; }, [hoy]);
  const calYear = visibleMonth.getFullYear();
  const calMonth = visibleMonth.getMonth();
  const firstWeekday = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calendarCells = [];
  for (let i = 0; i < firstWeekday; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calYear, calMonth, d);
    calendarCells.push({ date, day: d, enabled: date >= hoy && date <= fechaLimite });
  }
  const esMesActual = calMonth === hoy.getMonth() && calYear === hoy.getFullYear();
  const esMesLimite = calMonth === fechaLimite.getMonth() && calYear === fechaLimite.getFullYear();
  const mismaFecha = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  // Entrada directa por pestaña (sin servicio preseleccionado): selector de catálogo
  if (!activeServiceId) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>NUESTROS RITUALES</Text>
        <Text style={styles.screenTitle}>Agendar cita</Text>
        <Text style={styles.pickerSubTitle}>Elige el servicio que quieras reservar</Text>
        {catalogLoading ? (
          <View style={styles.centeredLoading}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : catalog.length === 0 ? (
          <View style={styles.pickEmpty}>
            <Ionicons name="flower-outline" size={40} color={palette.plumSoft} />
            <Text style={styles.pickEmptyText}>No hay servicios disponibles</Text>
            <PrimaryButton
              label="Reintentar"
              variant="secondary"
              onPress={retryLoad}
              style={styles.pickEmptyButton}
            />
          </View>
        ) : (
          <>
            <View style={styles.filterTabs}>
              {CATEGORY_TABS.map((tab) => {
                const active = catalogFilter === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.filterTab, active && styles.filterTabActive]}
                    onPress={() => setCatalogFilter(tab)}
                  >
                    <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{tab}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.serviceList}>
              {catalogVisible.map((item, index) => (
                <FadeInView key={item.id} delay={Math.min(index, 8) * 70}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.serviceRow}
                    onPress={() => setPickedServiceId(item.id)}
                  >
                    <View style={styles.serviceIcon}>
                      <Ionicons
                        name={item.categoria === 'rostro' ? 'sparkles-outline' : 'flower-outline'}
                        size={20}
                        color={palette.primary}
                      />
                    </View>
                    <View style={styles.serviceBody}>
                      <Text style={styles.serviceCategoria}>
                        {item.categoria === 'rostro' ? 'Rostro' : 'Cejas'}
                      </Text>
                      <Text style={styles.serviceNombre} numberOfLines={1}>{item.nombre}</Text>
                      <Text style={styles.serviceTexto}>{item.duracion_minutos} min</Text>
                      <Text style={styles.servicePrecio}>Desde {formatColones(item.precio)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={palette.primary} />
                  </TouchableOpacity>
                </FadeInView>
              ))}
            </View>
            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={16} color={palette.textMuted} />
              <Text style={styles.infoNoteText}>
                Los valores publicados son referenciales y pueden variar según la evaluación personalizada de cada servicio.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  // El servicio se eligió pero no se pudo cargar (404, red, sesión vencida)
  if (loadFailed || !service) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={36} color={palette.error} />
        </View>
        <Text style={styles.errorText}>Servicio no encontrado</Text>
        <PrimaryButton
          label="Reintentar"
          onPress={retryLoad}
          style={styles.backButton}
        />
        <PrimaryButton
          label="Volver a Home"
          variant="secondary"
          onPress={() => router.replace('/home')}
          style={styles.backButton}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backRow} onPress={regresarACategorias}>
        <Ionicons name="chevron-back" size={16} color={palette.primary} />
        <Text style={styles.backRowText}>Ver categorías</Text>
      </TouchableOpacity>
      <Text style={styles.screenTitle}>Agendar cita</Text>

      {/* Resumen del servicio */}
      <FadeInView style={styles.serviceSummary}>
        <View style={styles.summaryIcon}>
          <Ionicons
            name={service.categoria === 'rostro' ? 'sparkles-outline' : 'flower-outline'}
            size={22}
            color={palette.primary}
          />
        </View>
        <View style={styles.summaryInfo}>
          <Text style={styles.serviceName}>{service.nombre}</Text>
          <Text style={styles.serviceResume}>
            Desde {formatColones(service.precio)} · {service.duracion_minutos} min
          </Text>
        </View>
      </FadeInView>

      {/* Fecha */}
      <FadeInView delay={80} style={styles.section}>
        <Text style={styles.sectionTitle}>Selecciona una fecha</Text>
        <TouchableOpacity activeOpacity={0.8} style={styles.dateInput} onPress={() => setShowDatePicker(v => !v)}>
          <Ionicons name="calendar-outline" size={20} color={palette.primary} style={styles.fieldIcon} />
          <Text style={styles.dateText}>{selectedDate.toLocaleDateString()}</Text>
          <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textMuted} />
        </TouchableOpacity>
        {dateError && (
          <Text style={styles.errorMessage}>{dateError}</Text>
        )}
        {showDatePicker && (
          <FadeInView delay={40}>
            <View style={[styles.dateInput, styles.calendar]}>
              <View style={styles.calHeader}>
                <TouchableOpacity
                  disabled={esMesActual}
                  style={[styles.calNav, esMesActual && styles.calNavDisabled]}
                  onPress={() => setVisibleMonth(new Date(calYear, calMonth - 1, 1))}
                >
                  <Ionicons name="chevron-back" size={18} color={palette.primary} />
                </TouchableOpacity>
                <Text style={styles.calTitle}>{MONTH_NAMES[calMonth]} {calYear}</Text>
                <TouchableOpacity
                  disabled={esMesLimite}
                  style={[styles.calNav, esMesLimite && styles.calNavDisabled]}
                  onPress={() => setVisibleMonth(new Date(calYear, calMonth + 1, 1))}
                >
                  <Ionicons name="chevron-forward" size={18} color={palette.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.calWeek}>
                {WEEK_HEADERS.map((d, i) => (
                  <Text key={`w-${i}`} style={styles.calWeekText}>{d}</Text>
                ))}
              </View>
              <View style={styles.calGrid}>
                {calendarCells.map((cell, i) => (
                  cell ? (
                    <TouchableOpacity
                      key={`d-${i}`}
                      disabled={!cell.enabled}
                      style={[styles.calDay, cell.enabled && styles.calDayEnabled, mismaFecha(cell.date, selectedDate) && styles.calDaySelected]}
                      onPress={() => handleDateChange(cell.date)}
                    >
                      <Text
                        style={[
                          styles.calDayText,
                          cell.enabled && styles.calDayTextEnabled,
                          mismaFecha(cell.date, selectedDate) && styles.calDayTextSelected,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View key={`e-${i}`} style={styles.calDay} />
                  )
                ))}
              </View>
            </View>
          </FadeInView>
        )}
      </FadeInView>

      {/* Hora */}
      <FadeInView delay={160} style={styles.section}>
        <Text style={styles.sectionTitle}>Selecciona una hora</Text>
        <TouchableOpacity activeOpacity={0.8} style={styles.dateInput} onPress={() => setShowTimePicker(v => !v)}>
          <Ionicons name="time-outline" size={20} color={palette.primary} style={styles.fieldIcon} />
          <Text style={styles.dateText}>{selectedTime}</Text>
          <Ionicons name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textMuted} />
        </TouchableOpacity>
        {showTimePicker && (
          <FadeInView delay={80} style={styles.availableTimes}>
            <View style={styles.timesContainer}>
              {availableTimes.map((time, index) => {
                const active = time === selectedTime;
                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.8}
                    style={[styles.timeButton, active && styles.timeButtonActive]}
                    onPress={() => handleTimeSelect(time)}
                  >
                    <Text style={[styles.timeButtonText, active && styles.timeButtonTextActive]}>{time}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FadeInView>
        )}
      </FadeInView>

      {/* Botón agendar */}
      <FadeInView delay={320}>
        <PrimaryButton label="Agendar cita" icon="checkmark" onPress={bookAppointment} style={styles.bookButton} />
      </FadeInView>
    </ScrollView>
  );
}

const makeStyles = (palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  eyebrow: {
    color: palette.eyebrow,
    fontFamily: font.semibold,
    fontSize: 10,
    letterSpacing: 1.7,
    marginBottom: spacing.xs,
  },
  screenTitle: {
    color: palette.heading,
    fontFamily: font.semibold,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.9,
    marginBottom: spacing.xs,
  },
  backRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.plumSoft,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  backRowText: {
    color: palette.primary,
    fontFamily: font.semibold,
    fontSize: 12,
  },
  pickerSubTitle: {
    color: palette.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  filterTab: {
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterTabText: {
    color: palette.textMuted,
    fontFamily: font.medium,
    fontSize: 11,
  },
  filterTabTextActive: {
    color: palette.onPrimary,
    fontFamily: font.semibold,
  },
  // Filas de servicio (mismo lenguaje visual que Home)
  serviceList: {
    gap: 10,
  },
  serviceRow: {
    ...cardStyle(palette),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  serviceIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: palette.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceBody: {
    flex: 1,
    minWidth: 0,
  },
  serviceCategoria: {
    color: palette.eyebrow,
    fontFamily: font.semibold,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  serviceNombre: {
    color: palette.textPrimary,
    fontFamily: font.semibold,
    fontSize: 14,
    marginTop: 3,
  },
  serviceTexto: {
    color: palette.textMuted,
    fontFamily: font.regular,
    fontSize: 11,
    marginTop: 2,
  },
  servicePrecio: {
    color: palette.primary,
    fontFamily: font.semibold,
    fontSize: 11,
    marginTop: 5,
  },
  infoNote: {
    backgroundColor: palette.inputBg,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: spacing.lg,
  },
  infoNoteText: {
    flex: 1,
    color: palette.textMuted,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  centeredLoading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  pickEmpty: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  pickEmptyText: {
    color: palette.textMuted,
    fontFamily: font.regular,
    fontSize: 15,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  pickEmptyButton: {
    minWidth: 180,
  },
  serviceSummary: {
    ...cardStyle(palette),
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  summaryIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: palette.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  summaryInfo: { flex: 1 },
  serviceName: {
    color: palette.textPrimary,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  serviceResume: {
    color: palette.primary,
    fontFamily: font.semibold,
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: palette.heading,
    fontFamily: font.semibold,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  dateInput: {
    ...cardStyle(palette),
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIcon: {
    marginRight: spacing.md,
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    fontFamily: font.regular,
    color: palette.textPrimary,
  },
  availableTimes: {
    marginTop: spacing.sm,
  },
  timesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeButton: {
    backgroundColor: palette.card,
    // 14px vertical ≈ 44px de target con el texto de 12px (hig. táctil).
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  timeButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  timeButtonText: {
    color: palette.primary,
    fontFamily: font.semibold,
    fontSize: 12,
  },
  timeButtonTextActive: {
    color: palette.onPrimary,
  },
  calendar: {
    flexDirection: 'column',
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  calNav: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  calNavDisabled: {
    opacity: 0.35,
  },
  calTitle: {
    color: palette.heading,
    fontFamily: font.semibold,
    fontSize: 13,
  },
  calWeek: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  calWeekText: {
    flex: 1,
    textAlign: 'center',
    color: palette.textMuted,
    fontSize: 11,
    fontFamily: font.semibold,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDay: {
    width: '14.28%',
    aspectRatio: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayEnabled: {
    borderRadius: 99,
  },
  calDaySelected: {
    backgroundColor: palette.primary,
  },
  calDayText: {
    color: palette.textMuted,
    fontSize: 13,
    fontFamily: font.regular,
  },
  calDayTextEnabled: {
    color: palette.textPrimary,
  },
  calDayTextSelected: {
    color: palette.onPrimary,
    fontFamily: font.semibold,
  },
  bookButton: {
    marginTop: spacing.xl,
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorText: {
    color: palette.heading,
    fontFamily: font.semibold,
    fontSize: 18,
    textAlign: 'center',
  },
  backButton: {
    marginTop: spacing.xl,
  },
  errorMessage: {
    color: palette.error,
    fontFamily: font.regular,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});

export const options = {
  title: 'Agendar Cita - BloomApp',
};
