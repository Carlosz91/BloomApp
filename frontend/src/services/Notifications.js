/**
 * Sistema de notificaciones visuales para BloomApp
 * Implementa toasts para: éxito reserva, cancelación, perfil actualizado, errores
 * 
 * Modo de uso:
 * import { showSuccessToast, showErrorToast, showInfoToast } from '../services/Notifications';
 * 
 * showSuccessToast({
 *   title: '¡Cita agendada!',
 *   description: 'Tu cita es el 15/11 a las 9:00 AM',
 *   onAction: () => navigation.navigate('MyAppointments'),
 * });
 */

import * as ExpoNotifications from 'expo-notifications';

// Configuración de notificaciones (para futuro - push notifications)
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// expo-toast no está instalado: rechazar para usar el fallback de alert().
// (Un import() dinámico a un paquete ausente rompería el bundle de Metro.)
const loadToast = () => Promise.reject(new Error('expo-toast no instalado'));

// Tipos de notificación con sus colores por palette
const NOTIFICATION_STYLES = {
  success: {
    background: '#FFFFFF',
    iconColor: '#6B3752',     // ciruela
    textColor: '#333333',
    duration: 5000,
  },
  error: {
    background: '#FFF5F5',    // rojo muy claro
    iconColor: '#EF4444',     // rojo fuerte
    textColor: '#333333',
    duration: 6000,
  },
  info: {
    background: '#F5E9DC',    // ciruela muy claro (default)
    iconColor: '#8F9B96',     // salvia
    textColor: '#333333',
    duration: 4000,
  },
};

/**
 * Muestra un Toast de éxito (reserva completada, perfil actualizado)
 * @param {object} options - Opciones del toast
 * @param {string} options.title - Título principal
 * @param {string} options.description - Descripción del mensaje
 * @param {function} [options.onAction] - Callback cuando usuario toca acción
 * @param {object} [options.colors] - Colores personalizados (sobreescribe palette)
 */
export const showSuccessToast = async (options = {}) => {
  const defaultColors = NOTIFICATION_STYLES.success;
  const colors = { ...defaultColors, ...options.colors };
  
  try {
    // Intentar usando expo-toast si está disponible
    const { showAsync } = await loadToast();
    
    await showAsync(options.title, {
      description: options.description,
      duration: colors.duration,
      hideAfter: colors.duration,
      animation: 'flip',
      textAlign: 'center',
      textColor: colors.textColor,
      backgroundColor: colors.background,
      icon: 'checkmark-circle',
      iconColor: colors.iconColor,
      actions: options.onAction ? [
        {
          label: 'Ver',
          onPress: options.onAction,
          textColor: colors.iconColor,
        }
      ] : [],
     skipAndroidTransition: true,
    });
  } catch (e) {
    // Fallback a alert nativo si expo-toast no está configurado
    alert(`${options.title}\n\n${options.description}`);
  }
};

/**
 * Muestra un Toast de error (API fallida, validación inválida)
 * @param {object} options - Opciones del toast
 * @param {string} options.title - Título principal (ej: 'Error')
 * @param {string} options.description - Mensaje descriptivo
 * @param {function} [options.onAction] - Callback "Intentar de nuevo"
 * @param {object} [options.colors] - Colores personalizados
 */
export const showErrorToast = async (options = {}) => {
  const defaultColors = NOTIFICATION_STYLES.error;
  const colors = { ...defaultColors, ...options.colors };
  
  try {
    const { showAsync } = await loadToast();
    
    await showAsync(options.title, {
      description: options.description,
      duration: colors.duration,
      hideAfter: colors.duration,
      animation: 'fade',
      textColor: colors.textColor,
      backgroundColor: colors.background,
      icon: 'alert-circle',
      iconColor: colors.iconColor,
      actions: options.onAction ? [
        {
          label: 'Reintentar',
          onPress: options.onAction,
          textColor: colors.iconColor,
        }
      ] : [],
      skipAndroidTransition: true,
    });
  } catch (e) {
    alert(`${options.title}\n\n${options.description}`);
  }
};

/**
 * Muestra un Toast informativo (cambios de perfil, info general)
 * @param {object} options - Opciones del toast
 * @param {string} options.title - Título principal
 * @param {string} options.description - Mensaje descriptivo
 * @param {object} [options.colors] - Colores personalizados (usa palette info por defecto)
 */
export const showInfoToast = async (options = {}) => {
  const defaultColors = NOTIFICATION_STYLES.info;
  const colors = { ...defaultColors, ...options.colors };
  
  try {
    const { showAsync } = await loadToast();
    
    await showAsync(options.title, {
      description: options.description,
      duration: colors.duration,
      hideAfter: colors.duration,
      animation: 'slide',
      textColor: colors.textColor,
      backgroundColor: colors.background,
      icon: 'information',
      iconColor: colors.iconColor,
      skipAndroidTransition: true,
    });
  } catch (e) {
    alert(`${options.title}\n\n${options.description}`);
  }
};

/**
 * Coordinated notification showing based on event type
 * Centraliza qué tipo de toast mostrar según el evento
 */
export const notify = async (eventType, data = {}) => {
  switch (eventType) {
    case 'reservation_success':
      await showSuccessToast({
        title: '¡Cita agendada!',
        description: data.message || 'Tu cita ha sido agendado exitosamente',
        onAction: () => data.onNavigateToMyAppointments && data.onNavigateToMyAppointments(),
      });
      break;
    
    case 'reservation_error':
      await showErrorToast({
        title: 'Error al agendar',
        description: data.message || 'No fue posible agendar la cita',
        onAction: data.onRetry,
      });
      break;
    
    case 'cancellation_success':
      await showSuccessToast({
        title: 'Cita cancelada',
        description: data.message || 'La cita ha sido cancelada correctamente',
      });
      break;
    
    case 'profile_updated':
      await showInfoToast({
        title: 'Perfil actualizado',
        description: data.message || 'Tus datos han sido guardados',
      });
      break;
    
    case 'auth_error':
      await showErrorToast({
        title: 'Sesión expirada',
        description: data.message || 'Por favor, inicia sesión nuevamente',
      });
      break;
    
    default:
      await showInfoToast({
        title: 'Información',
        description: data.message || 'Acción completada',
      });
  }
};

export default {
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  notify,
};