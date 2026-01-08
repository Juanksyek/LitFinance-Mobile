import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './authService';
import { apiRateLimiter } from './apiRateLimiter';
import { API_BASE_URL } from '../constants/api';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';

// Configurar comportamiento de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registrar dispositivo para recibir notificaciones push
 * LLAMAR DESPUÉS DE LOGIN EXITOSO
 */
export const registerForPushNotifications = async () => {
  let debugLog = '';
  const appendLog = (line: string) => {
    debugLog += `${line}\n`;
  };
  const persistLog = async () => {
    try {
      await AsyncStorage.setItem('expoPushDebugLog', debugLog);
    } catch {}
  };

  try {
    appendLog(`=== registerForPushNotifications ${new Date().toISOString()} ===`);
    appendLog(`Device.isDevice=${String(Device.isDevice)} Platform=${Platform.OS}`);

    let expoPushToken: string | null = null;

    if (!Device.isDevice) {
      expoPushToken = 'ExponentPushToken[FAKE-EMULATOR]';
      appendLog(`⚠️ Usando token mock para pruebas en emulador: ${expoPushToken}`);
      console.warn('⚠️ Usando token mock para pruebas en emulador:', expoPushToken);
    } else {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      appendLog(`Permission(existing)=${existingStatus}`);

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        appendLog(`Permission(request)=${status}`);
      }

      if (finalStatus !== 'granted') {
        appendLog('Permisos de notificación denegados');
        console.warn('Permisos de notificación denegados');
        Toast.show({
          type: 'info',
          text1: 'Notificaciones desactivadas',
          text2: 'Activa permisos para recibir notificaciones.',
        });
        await persistLog();
        return null;
      }

      const projectId =
        (Constants as any)?.easConfig?.projectId ||
        Constants.expoConfig?.extra?.eas?.projectId ||
        (Constants as any)?.manifest2?.extra?.eas?.projectId ||
        (Constants as any)?.manifest?.extra?.eas?.projectId ||
        null;

      appendLog(`projectId=${projectId ?? 'null'}`);
      if (!projectId) {
        appendLog('[notifications] Missing EAS projectId. Token may fail in standalone builds.');
        console.warn('[notifications] Missing EAS projectId. Token may fail in standalone builds.');
      }

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        expoPushToken = tokenData.data;
        appendLog(`Token EXPO obtenido: ${expoPushToken}`);
        console.log('Token EXPO obtenido:', expoPushToken);
      } catch (e: any) {
        appendLog(`Error obteniendo ExpoPushToken: ${e?.message ?? String(e)}`);
        if (e?.stack) appendLog(String(e.stack));
        await persistLog();
        return null;
      }
    }

    if (!expoPushToken) {
      appendLog('[notifications] No se pudo obtener expoPushToken');
      await persistLog();
      return null;
    }

    await AsyncStorage.setItem('expoPushToken', expoPushToken);
    appendLog('expoPushToken guardado localmente');

    const authToken = await authService.getAccessToken();
    if (!authToken) {
      appendLog('No hay token de autenticación; se omite registro en backend');
      await persistLog();
      return expoPushToken;
    }

    try {
      const response = await apiRateLimiter.fetch(
        `${API_BASE_URL}/notificaciones/expo/registrar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expoPushToken }),
        }
      );
      if (response.ok) {
        appendLog('✅ Token registrado en backend (/notificaciones/expo/registrar)');
      } else {
        const errorData = await response.json().catch(() => ({}));
        appendLog(`[notifications] Falló /notificaciones/expo/registrar: ${response.status} - ${errorData.message ?? ''}`);
      }
    } catch (e: any) {
      appendLog(`[notifications] Error en /notificaciones/expo/registrar: ${e?.message ?? String(e)}`);
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      appendLog('Android channel configured: default');
    }

    await persistLog();
    return expoPushToken;
  } catch (error: any) {
    appendLog(`Error registrando notificaciones (catch): ${error?.message ?? String(error)}`);
    if (error?.stack) appendLog(String(error.stack));
    await persistLog();
    console.error('Error registrando notificaciones:', error);
    return null;
  }
};

/**
 * Eliminar token de notificaciones (al hacer logout)
 */
export const unregisterPushNotifications = async () => {
  let debugLog = '';
  const appendLog = (line: string) => {
    debugLog += `${line}\n`;
  };
  const persistLog = async () => {
    try {
      await AsyncStorage.setItem('expoPushDebugLog', debugLog);
    } catch {}
  };

  try {
    appendLog(`=== unregisterPushNotifications ${new Date().toISOString()} ===`);

    const expoPushToken = await AsyncStorage.getItem('expoPushToken');
    const authToken = await authService.getAccessToken();

    if (!expoPushToken) {
      appendLog('No hay expoPushToken local; nada que eliminar');
      await persistLog();
      return;
    }

    await AsyncStorage.removeItem('expoPushToken');
    appendLog('expoPushToken eliminado localmente');

    if (!authToken) {
      appendLog('No hay authToken; se omite eliminación en backend');
      await persistLog();
      return;
    }

    try {
      const response = await apiRateLimiter.fetch(`${API_BASE_URL}/notificaciones/expo/eliminar`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expoPushToken }),
      });
      if (response.ok) {
        appendLog('✅ Token eliminado del backend (/notificaciones/expo/eliminar)');
      } else {
        appendLog(`[notifications] Falló /notificaciones/expo/eliminar: ${response.status}`);
      }
    } catch (e: any) {
      appendLog(`[notifications] Error en /notificaciones/expo/eliminar: ${e?.message ?? String(e)}`);
    }

    await persistLog();
  } catch (error: any) {
    appendLog(`Error eliminando token (catch): ${error?.message ?? String(error)}`);
    if (error?.stack) appendLog(String(error.stack));
    await persistLog();
    console.error('Error eliminando token:', error);
  }
};

/**
 * Listener para notificaciones recibidas mientras app está abierta
 */
export const setupNotificationListeners = (
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) => {
  // Notificación recibida con app en primer plano
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('📩 Notificación recibida:', notification);
      // Mostrar el título y body
      if (notification?.request?.content?.title && notification?.request?.content?.body) {
        // Aquí podrías mostrar un Toast personalizado
        Toast.show({
          type: 'info',
          text1: notification.request.content.title,
          text2: notification.request.content.body,
        });
      }
      // Usar data para navegación o detalles
      if (notification?.request?.content?.data) {
        // Ejemplo: abrir pantalla según tipo
        // if (notification.request.content.data.tipo === 'recurrente_cobrado') { ... }
      }
      onNotificationReceived?.(notification);
    }
  );

  // Usuario tapea la notificación
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('👆 Notificación tapeada:', response);
      // Usar data para navegación
      const data = response.notification.request.content.data;
      if (data?.tipo) {
        // Ejemplo: abrir pantalla según tipo
        // if (data.tipo === 'recurrente_cobrado') { ... }
      }
      onNotificationTapped?.(response);
    }
  );

  // Cleanup
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
};

/**
 * Enviar notificación local de prueba
 */
export const sendTestNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🎉 Prueba de Notificación",
      body: "Esta es una notificación de prueba",
      data: { tipo: 'test' },
    },
    trigger: { seconds: 2 } as Notifications.TimeIntervalTriggerInput, // En 2 segundos
  });
};
