import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo/router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cardStyle, font, radius, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import PrimaryButton from '../components/PrimaryButton';
import { Toast } from 'expo-toast';

export default function ScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [service, setService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('9:00 AM');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [, setIsLoading] = useState(true);
  const [, setShowDatePicker] = useState(false);
  const [, setShowTimePicker] = useState(false);
  const [dateError, setDateError] = useState(null);

  const serviceId = params.serviceId;

  // Cargar servicio seleccionado
  useEffect(() => {
    if (serviceId) {
      const mockService = {
        id: serviceId,
        nombre: 'Corte de cejas',
        descripcion: 'Corte y forma de cejas',
        precio: 45.00,
        duracion_minutos: 45,
        categoria: 'cejas',
      };
      setService(mockService);

      // Generar horarios disponibles basados en la duración del servicio
      const times = [];
      const startHour = 9;
      const endHour = 17;

      for (let h = startHour; h < endHour; h++) {
        // Solo mostrar horarios que tengan suficiente espacio
        times.push(`${h}:00 AM`);
        if (h < 12) times.push(`${h + 12}:00 PM`);
      }
      setAvailableTimes(times);
      setIsLoading(false);
    }
  }, [serviceId]);

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
    const times = [];
    for (let h = 9; h < 17; h++) {
      times.push(`${h}:00 AM`);
      if (h < 12) times.push(`${h + 12}:00 PM`);
    }
    setAvailableTimes(times);
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

    // En producción: POST /appointments con los datos abajo
    const appointmentData = {
      user_id: token?.id || 1,
      service_id: service.id,
      fecha_hora: new Date(selectedDate).toISOString(),
      estado: 'booked',
    };

    try {
      const res = await fetch('http://localhost:3000/appointments', {
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
        Toast.show({
          title: 'Cita agendada',
          description: 'Tu cita ha sido confirmada exitosamente',
          type: 'success',
          duration: 3000,
        });
        router.push('/appointments');
      } else {
        const err = await res.json();
        // Toast error
        Toast.show({
          title: 'Error al agendar',
          description: err.detail || 'Intente de nuevo',
          type: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      // Toast error de conexión
      Toast.show({
        title: 'Error de conexión',
        description: 'Por favor intente de nuevo',
        type: 'error',
        duration: 3000,
      });
    }
  };

  if (!service) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={36} color={palette.error} />
        </View>
        <Text style={styles.errorText}>Servicio no encontrado</Text>
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
        { paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Agendar cita</Text>

      {/* Resumen del servicio */}
      <FadeInView style={styles.serviceSummary}>
        <View style={styles.summaryIcon}>
          <Ionicons name="flower-outline" size={24} color={palette.onPrimary} />
        </View>
        <View style={styles.summaryInfo}>
          <Text style={styles.serviceName}>{service.nombre}</Text>
          <Text style={styles.servicePrice}>${service.precio.toFixed(2)} - {service.duracion_minutos} min</Text>
        </View>
      </FadeInView>

      {/* Fecha */}
      <FadeInView delay={80} style={styles.section}>
        <Text style={styles.sectionTitle}>Selecciona una fecha</Text>
        <TouchableOpacity activeOpacity={0.8} style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
          <Ionicons name="calendar-outline" size={20} color={palette.primary} style={styles.fieldIcon} />
          <Text style={styles.dateText}>{selectedDate.toLocaleDateString()}</Text>
        </TouchableOpacity>
        {dateError && (
          <Text style={styles.errorMessage}>{dateError}</Text>
        )}
      </FadeInView>

      {/* Hora */}
      <FadeInView delay={160} style={styles.section}>
        <Text style={styles.sectionTitle}>Selecciona una hora</Text>
        <TouchableOpacity activeOpacity={0.8} style={styles.dateInput} onPress={() => setShowTimePicker(true)}>
          <Ionicons name="time-outline" size={20} color={palette.primary} style={styles.fieldIcon} />
          <Text style={styles.dateText}>{selectedTime}</Text>
        </TouchableOpacity>
      </FadeInView>

      {/* Horas disponibles */}
      <FadeInView delay={240} style={styles.availableTimes}>
        <Text style={styles.sectionTitle}>Horas disponibles</Text>
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
    paddingHorizontal: spacing.xl,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  screenTitle: {
    color: palette.textPrimary,
    fontFamily: font.semibold,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: spacing.lg,
  },
  serviceSummary: {
    backgroundColor: palette.primary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  summaryInfo: { flex: 1 },
  serviceName: {
    color: palette.onPrimary,
    fontFamily: font.semibold,
    fontSize: 18,
  },
  servicePrice: {
    color: palette.onPrimary,
    opacity: 0.85,
    fontFamily: font.regular,
    fontSize: 14,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontFamily: font.semibold,
    fontSize: 15,
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
    fontSize: 16,
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
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
    fontSize: 13,
  },
  timeButtonTextActive: {
    color: palette.onPrimary,
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
    color: palette.textPrimary,
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
