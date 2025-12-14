import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

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
  try {
    // Verificar que sea dispositivo físico
    if (!Device.isDevice) {
      console.warn('Las notificaciones push solo funcionan en dispositivos físicos');
      return null;
    }

    // Solicitar permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permisos de notificación denegados');
      return null;
    }

    // Obtener token EXPO
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID || 'litfinance-app',
    });
    
    const expoPushToken = tokenData.data;
    console.log('Token EXPO obtenido:', expoPushToken);

    // Verificar si el token ya fue registrado
    const storedToken = await AsyncStorage.getItem('expoPushToken');
    
    if (storedToken !== expoPushToken) {
      // Obtener el token de autenticación
      const authToken = await AsyncStorage.getItem('authToken');
      
      if (!authToken) {
        console.warn('No hay token de autenticación para registrar notificaciones');
        return null;
      }

      // Registrar token en el servidor
      await axios.post(
        `${API_BASE_URL}/notificaciones/expo/registrar`,
        { expoPushToken },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Guardar token localmente
      await AsyncStorage.setItem('expoPushToken', expoPushToken);
      console.log('✅ Token registrado en servidor');
    }

    // Configurar canal de notificaciones (Android)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return expoPushToken;
  } catch (error) {
    console.error('Error registrando notificaciones:', error);
    return null;
  }
};

/**
 * Eliminar token de notificaciones (al hacer logout)
 */
export const unregisterPushNotifications = async () => {
  try {
    const expoPushToken = await AsyncStorage.getItem('expoPushToken');
    const authToken = await AsyncStorage.getItem('authToken');
    
    if (expoPushToken && authToken) {
      await axios.delete(`${API_BASE_URL}/notificaciones/expo/eliminar`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        data: { expoPushToken },
      });
      
      await AsyncStorage.removeItem('expoPushToken');
      console.log('✅ Token eliminado del servidor');
    }
  } catch (error) {
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
      onNotificationReceived?.(notification);
    }
  );

  // Usuario tapea la notificación
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('👆 Notificación tapeada:', response);
      onNotificationTapped?.(response);
      
      // Puedes navegar a una pantalla específica según el tipo
      const data = response.notification.request.content.data;
      if (data?.tipo === 'recurrente') {
        // navigation.navigate('Recurrentes');
      }
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
