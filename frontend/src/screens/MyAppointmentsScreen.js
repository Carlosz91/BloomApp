import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cardStyle, font, radius, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';
import { showSuccessToast, showErrorToast } from '../services/Notifications';
import { API_BASE_URL } from '../config/api';
import { formatColones } from '../utils/format';

export default function MyAppointmentsScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('proximas'); // 'proximas' | 'historial'
  const { token } = useAuth();

  // Cargar citas del usuario desde API
  useEffect(() => {
    let cancelled = false;

    const fetchAppointments = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/appointments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error al cargar citas');
        const data = await res.json();
        // El backend devuelve servicio_nombre/servicio_precio/servicio_duracion planos:
        // se normalizan a la forma anidada que renderiza la pantalla.
        const mapped = (data.appointments || data).map((a) => ({
          ...a,
          service: {
            nombre: a.servicio_nombre,
            precio: a.servicio_precio,
            duracion_minutos: a.servicio_duracion,
          },
        }));
        if (!cancelled) setAppointments(mapped);
      } catch (error) {
        console.error('Error fetching appointments:', error);
      }
    };

    // Carga dentro de una función interna: evita setState síncrono en el
    // cuerpo del effect (react-hooks/set-state-in-effect).
    const loadAppointments = () => {
      if (token) {
        fetchAppointments();
      } else {
        setAppointments([]);
      }
    };

    loadAppointments();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Filtrar citas basándose en la fecha actual
  const ahora = new Date();
  // Próximas: citas activas desde ahora en adelante (sin límite de 30 días)
  const citasProximas = appointments.filter(
    c => c.estado === 'booked' && new Date(c.fecha_hora) >= ahora
  );
  // Historial: citas pasadas o canceladas
  const historial = appointments.filter(
    c => c.estado === 'cancelled' || new Date(c.fecha_hora) < ahora
  );

  const renderAppointment = ({ item: cita, index }) => {
    const fecha = new Date(cita.fecha_hora);
    const estaCancelada = cita.estado === 'cancelled';
    const esProxima = !estaCancelada && new Date(cita.fecha_hora) >= ahora;
    const badgeColor = estaCancelada ? palette.error : esProxima ? palette.primary : palette.success;
    const badgeTexto = estaCancelada ? 'Cancelada' : esProxima ? 'Confirmada' : 'Finalizada';

    return (
      <FadeInView delay={Math.min(index, 8) * 70}>
        <View style={styles.citaCard}>
          <View style={styles.citaInfo}>
            <View style={styles.citaMain}>
              <Text style={styles.serviceName}>{cita.service.nombre}</Text>
              <Text style={styles.servicePrice}>{formatColones(cita.service.precio)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: badgeColor + '1F' }]}>
              <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} />
              <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeTexto}</Text>
            </View>
          </View>
          <View style={styles.fechaRow}>
            <Ionicons name="calendar-outline" size={15} color={palette.textMuted} />
            <Text style={styles.fechaHora}>
              {fecha.toLocaleDateString()} {fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {esProxima && (
            <TouchableOpacity style={styles.cancelButton} onPress={() => cancelarCita(cita.id)}>
              <Text style={styles.cancelText}>Cancelar cita</Text>
            </TouchableOpacity>
          )}
        </View>
      </FadeInView>
    );
  };

  const cancelarCita = async (citaId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/appointments/${citaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estado: 'cancelled', motivo_cancelacion: 'Usuario solicitó cancelación' }),
      });

      if (res.ok) {
        setAppointments(prev => prev.map(c => c.id === citaId ? { ...c, estado: 'cancelled', motivo_cancelacion: 'Usuario solicitó cancelación' } : c));
        // Toast cancelación exitosa
        showSuccessToast({
          title: 'Cita cancelada',
          description: 'La cita ha sido cancelada exitosamente',
        });
      } else {
        // Toast error
        showErrorToast({
          title: 'Error al cancelar',
          description: 'No se pudo cancelar la cita',
        });
      }
    } catch (error) {
      console.error('Error canceling appointment:', error);
      // Toast error de conexión
      showErrorToast({
        title: 'Error de conexión',
        description: 'Por favor intente de nuevo',
      });
    }
  };

  const listData = filter === 'proximas' ? citasProximas : historial;

  return (
    <View style={styles.container}>
      <FadeInView style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.headerTitle}>Mis citas</Text>
      </FadeInView>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, filter === 'proximas' && styles.tabButtonActive]}
          onPress={() => setFilter('proximas')}
        >
          <Text style={[styles.tabText, filter === 'proximas' && styles.tabTextActive]}>Próximas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, filter === 'historial' && styles.tabButtonActive]}
          onPress={() => setFilter('historial')}
        >
          <Text style={[styles.tabText, filter === 'historial' && styles.tabTextActive]}>Historial</Text>
        </TouchableOpacity>
      </View>

      {listData.length > 0 ? (
        <FlatList
          key={filter}
          data={listData}
          renderItem={renderAppointment}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-clear-outline" size={36} color={palette.primary} />
          </View>
          <Text style={styles.emptyStateText}>{filter === 'proximas' ? 'No hay citas próximas' : 'Aún no hay historial'}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    color: palette.heading,
    fontSize: 27,
    lineHeight: 32,
    fontFamily: font.semibold,
    letterSpacing: -0.9,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  // Pestañas píldora del mock: activa ciruela, inactiva blanca con borde
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  tabText: {
    color: palette.textMuted,
    fontSize: 12,
    fontFamily: font.medium,
  },
  tabTextActive: {
    color: palette.onPrimary,
    fontFamily: font.semibold,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  citaCard: {
    ...cardStyle(palette),
    marginBottom: spacing.md,
  },
  citaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  citaMain: {
    flex: 1,
    marginRight: spacing.md,
  },
  serviceName: {
    color: palette.heading,
    fontSize: 15,
    fontFamily: font.semibold,
  },
  servicePrice: {
    color: palette.primary,
    fontSize: 13,
    fontFamily: font.semibold,
    marginTop: 2,
  },
  fechaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  fechaHora: {
    color: palette.textMuted,
    fontSize: 12,
    fontFamily: font.regular,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: font.semibold,
  },
  cancelButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.error,
    alignItems: 'center',
  },
  cancelText: {
    color: palette.error,
    fontSize: 12,
    fontFamily: font.semibold,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    paddingBottom: spacing.xxl * 2,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateText: {
    color: palette.textMuted,
    fontSize: 14,
    fontFamily: font.regular,
  },
});
