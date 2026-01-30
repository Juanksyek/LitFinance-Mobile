import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import Toast, { BaseToast } from 'react-native-toast-message';
import { ThemeProvider } from './src/theme/ThemeContext';
import { setupNotificationListeners } from './src/services/notificationService';
import { authService } from './src/services/authService';
import type { RootStackParamList } from './src/navigation/AppNavigator';
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from './src/constants/stripe';
import { applyStoredAppIconVariant } from './src/services/appIconService';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { useThemeColors } from './src/theme/useThemeColors';
import { useTheme } from './src/theme/ThemeContext';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { userProfileService } from './src/services/userProfileService';
import { apiRateLimiter } from './src/services/apiRateLimiter';
import UpgradeModal from './src/components/UpgradeModal';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | undefined>();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Apply stored launcher icon (Android)
    applyStoredAppIconVariant().catch(() => {});

    // Register upgrade modal controller with apiRateLimiter
    apiRateLimiter.setUpgradeModalController((show: boolean, message?: string) => {
      setShowUpgradeModal(show);
      setUpgradeMessage(message);
    });

    // Refresh user profile on app start
    refreshUserProfile();

    // Listen to app state changes (foreground/background)
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Register logout handler: navigate to Login when session expires
    const unregisterLogout = authService.onLogout(() => {
      console.log('🔐 Sesión expirada, redirigiendo a Login...');
      Toast.show({
        type: 'error',
        text1: 'Sesión expirada',
        text2: 'Por favor inicia sesión nuevamente.',
        visibilityTime: 3000,
      });
      if (navigationRef.current?.isReady()) {
        navigationRef.current.navigate('Login');
      }
    });

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

    return () => {
      cleanup();
      unregisterLogout();
      subscription?.remove();
    };
  }, []);

  const refreshUserProfile = async () => {
    try {
      const token = await authService.getAccessToken();
      if (token) {
        console.log('🔄 [App] Refrescando perfil de usuario...');
        await userProfileService.fetchAndUpdateProfile();
      }
    } catch (error) {
      console.warn('⚠️ [App] Error refrescando perfil:', error);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 [App] App volvió a foreground, refrescando perfil...');
      refreshUserProfile();
    }
    appState.current = nextAppState;
  };

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
          // Check premium before navigating to Analytics
          (async () => {
            try {
              const profile = await userProfileService.getCachedProfile();
              const canSee = userProfileService.canSeeAdvanced(profile);
              if (!canSee) {
                setUpgradeMessage('Las gráficas avanzadas están disponibles solo para usuarios premium. Actualiza tu plan.');
                setShowUpgradeModal(true);
                return;
              }
              navigationRef.current?.navigate('Analytics');
            } catch (e) {
              // Fallback: show modal
              setUpgradeMessage('Acceso a Analytics restringido. Actualiza tu plan para continuar.');
              setShowUpgradeModal(true);
            }
          })();
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
        <SafeAreaProvider>
          <NavigationContainer ref={navigationRef}>
            <AppRootLayout>
              <AppNavigator />
            </AppRootLayout>
            <UpgradeModal
              visible={showUpgradeModal}
              onClose={() => setShowUpgradeModal(false)}
              message={upgradeMessage}
            />
          </NavigationContainer>
        </SafeAreaProvider>
        <Toast
          config={{
            // Provide a simple mapping for 'warning' so older calls don't crash
            warning: (props: any) => (
              <BaseToast
                {...props}
                style={[{ borderLeftColor: '#F59E0B' }, props.style]}
                text1Style={{ fontSize: 14, fontWeight: '700' }}
              />
            ),
          }}
        />
      </ThemeProvider>
    </StripeProvider>
  );
}

function AppRootLayout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // With edge-to-edge enabled, the system navigation bar area can show the
    // default (often white) window background unless we set it explicitly.
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
    NavigationBar.setBackgroundColorAsync(colors.background).catch(() => {});
    NavigationBar.setBorderColorAsync(colors.background).catch(() => {});
    NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});
  }, [colors.background, isDark]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.flex, { backgroundColor: colors.background }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View
        style={[
          styles.flex,
          {
            // Avoid double bottom-inset padding on Android (screens already handle insets where needed).
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
            backgroundColor: colors.background,
          },
        ]}
      >
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});