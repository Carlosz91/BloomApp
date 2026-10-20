import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { cardStyle, font, radius, spacing } from '../theme/tokens';
import FadeInView from '../components/FadeInView';

export default function MyAppointmentsScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('proximas'); // 'proximas' | 'historial'

  // Cargar citas del usuario desde API
  useEffect(() => {
    // TODO: Descomentar cuando tenga integración backend completa
    // const fetchAppointments = async () => {
    //   const token = await getTokenFromStorage();
    //   const res = await fetch('http://localhost:3000/appointments', {
    //     headers: { Authorization: `Bearer ${token}` }
    //   });
    //   const data = await res.json();
    //   setAppointments(data);
    // };
    // fetchAppointments();

    // Datos mock por ahora
    const mockAppointments = [
      {
        id: 1,
        service: { nombre: 'Corte de cejas', precio: 45.00, categoria: 'cejas' },
        fecha_hora: '2026-11-15T09:00:00.000Z',
        estado: 'booked',
        motivo_cancelacion: null,
      },
      {
        id: 2,
        service: { nombre: 'Limpieza de piel', precio: 55.00, categoria: 'rostro' },
        fecha_hora: '2026-10-01T14:30:00.000Z',
        estado: 'completed',
        motivo_cancelacion: null,
      },
      {
        id: 3,
        service: { nombre: 'Tinte de cejas', precio: 30.00, categoria: 'cejas' },
        fecha_hora: '2026-12-01T11:00:00.000Z',
        estado: 'booked',
        motivo_cancelacion: null,
      },
    ];
    setAppointments(mockAppointments);
  }, []);

  // Filtrar citas basándose en la fecha actual
  const ahora = new Date();
  const citasProximas = appointments.filter(c => {
    const fecha = new Date(c.fecha_hora);
    return fecha >= ahora && fecha < new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  const historial = appointments.filter(c => new Date(c.fecha_hora) < ahora);

  const renderAppointment = ({ item: cita, index }) => {
    const fecha = new Date(cita.fecha_hora);
    const esProxima = cita.estado === 'booked';
    const badgeColor = esProxima ? palette.primary : palette.success;
    const badgeTexto = esProxima ? 'Confirmada' : 'Finalizada';

    return (
      <FadeInView delay={Math.min(index, 8) * 70}>
        <View style={styles.citaCard}>
          <View style={styles.citaInfo}>
            <View style={styles.citaMain}>
              <Text style={styles.serviceName}>{cita.service.nombre}</Text>
              <Text style={styles.servicePrice}>${cita.service.precio}</Text>
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
    // TODO: Descomentar cuando tenga integración backend completa
    // const res = await fetch(`http://localhost:3000/appointments/${citaId}`, {
    //   method: 'PUT',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${await getTokenFromStorage()}`
    //   },
    //   body: JSON.stringify({ estado: 'cancelled', motivo_cancelacion: 'Usuario solicitó cancelación' })
    // });
    //
    // if (res.ok) {
    //   setAppointments(prev => prev.map(c => c.id === citaId ? { ...c, estado: 'cancelled', motivo_cancelacion: 'Usuario solicitó cancelación' } : c));
    //   // Toast cancelación exitosa
    //   alert('Cita cancelada exitosamente');
    // } else {
    //   alert('Error al cancelar la cita');
    // }

    // Por ahora, simular cancelación
    alert('Cita simulada cancelada #' + citaId);
  };

  const listData = filter === 'proximas' ? citasProximas : historial;

  return (
    <View style={styles.container}>
      <FadeInView style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.headerTitle}>Mis citas</Text>
        <Text style={styles.headerSubTitle}>Lúmina Beauty Studio</Text>
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    color: palette.textPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: font.semibold,
  },
  headerSubTitle: {
    color: palette.textMuted,
    fontSize: 14,
    fontFamily: font.regular,
    marginTop: spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.primaryTint,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: palette.primary,
  },
  tabText: {
    color: palette.primary,
    fontSize: 14,
    fontFamily: font.semibold,
  },
  tabTextActive: {
    color: palette.onPrimary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
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
    color: palette.textPrimary,
    fontSize: 16,
    fontFamily: font.semibold,
  },
  servicePrice: {
    color: palette.primary,
    fontSize: 14,
    fontFamily: font.semibold,
    marginTop: 2,
  },
  fechaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  fechaHora: {
    color: palette.textMuted,
    fontSize: 13,
    fontFamily: font.regular,
    marginLeft: spacing.xs + 2,
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
    fontSize: 12,
    fontFamily: font.semibold,
  },
  cancelButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.error,
    alignItems: 'center',
  },
  cancelText: {
    color: palette.error,
    fontSize: 13,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateText: {
    color: palette.textMuted,
    fontSize: 16,
    fontFamily: font.regular,
  },
});
