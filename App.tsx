import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { ThemeProvider } from './src/theme/ThemeContext';
import { setupNotificationListeners } from './src/services/notificationService';
import type { RootStackParamList } from './src/navigation/AppNavigator';
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from './src/constants/stripe';
import { applyStoredAppIconVariant } from './src/services/appIconService';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    // Apply stored launcher icon (Android)
    applyStoredAppIconVariant().catch(() => {});

    // Setup listeners para notificaciones
    const cleanup = setupNotificationListeners(
      // Cuando llega notificación (app abierta)
      (notification) => {
        console.log('📩 Nueva notificación:', notification.request.content);
        const data = notification.request.content.data as any;
        
        // Mostrar toast con la notificación
        Toast.show({
          type: data?.tipo === 'error' ? 'error' : 'info',
          text1: notification.request.content.title as string,
          text2: notification.request.content.body as string,
          visibilityTime: 4000,
          onPress: () => {
            // Si el usuario tapea el toast, navegar
            handleNotificationNavigation(data);
          },
        });
      },
      // Cuando usuario tapea notificación
      (response) => {
        const data = response.notification.request.content.data as any;
        console.log('👆 Usuario tapeó notificación con data:', data);
        handleNotificationNavigation(data);
      }
    );

    return cleanup;
  }, []);

  // Manejar navegación según tipo de notificación
  const handleNotificationNavigation = (data: any) => {
    if (!navigationRef.current || !data?.tipo) return;

    try {
      switch (data.tipo) {
        case 'recurrente':
        case 'recordatorio':
          // Navegar a Dashboard donde se muestran los recurrentes
          navigationRef.current.navigate('Dashboard');
          break;

        case 'recurrente_detalle':
          // Si incluye recurrenteId, navegar al detalle
          if (data.recurrenteId) {
            navigationRef.current.navigate('Dashboard');
            // Nota: Necesitarías pasar el recurrenteId para abrir el modal
          }
          break;

        case 'inactividad':
        case 'registrar_gastos':
          // Navegar a Dashboard para que registre gastos
          navigationRef.current.navigate('Dashboard');
          break;

        case 'meta_completada':
          // Futura funcionalidad de metas
          navigationRef.current.navigate('Dashboard');
          break;

        case 'analytics':
          // Navegar a Analytics
          navigationRef.current.navigate('Analytics');
          break;

        case 'soporte':
          // Navegar a Soporte
          if (navigationRef.current.isReady()) {
            navigationRef.current.navigate('Support');
          }
          break;

        case 'ticket':
          // Si incluye ticketId, navegar al detalle
          if (data.ticketId) {
            navigationRef.current.navigate('TicketDetail', { ticketId: data.ticketId });
          } else {
            navigationRef.current.navigate('Support');
          }
          break;

        default:
          // Tipo desconocido, ir a Dashboard
          navigationRef.current.navigate('Dashboard');
      }
    } catch (error) {
      console.error('Error navegando desde notificación:', error);
    }
  };

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <ThemeProvider>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
        <Toast />
      </ThemeProvider>
    </StripeProvider>
  );
}