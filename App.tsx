import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { ThemeProvider } from './src/theme/ThemeContext';
import { ConnectivityProvider } from './src/connectivity/ConnectivityContext';
import type { RootStackParamList } from './src/navigation/AppNavigator';
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from './src/constants/stripe';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, View, StyleSheet, Keyboard, Linking } from 'react-native';
import { TextInput } from 'react-native';
import { useThemeColors } from './src/theme/useThemeColors';
import { useTheme } from './src/theme/ThemeContext';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { userProfileService } from './src/services/userProfileService';
import UpgradeModal from './src/components/UpgradeModal';
import ForceUpdateModal from './src/components/ForceUpdateModal';
import OfflineBanner from './src/components/OfflineBanner';
import { toastConfig } from './src/components/ThemedToast';
import AppLockGate from './src/components/AppLockGate';
import { assertValidEnvironment } from './src/core/config/env';
import type { MobileAppVersionState } from './src/services/mobileBootstrapService';
import { logger } from './src/shared/monitoring/logger';
import { AppLifecycleProvider } from './src/core/app/AppLifecycleProvider';

assertValidEnvironment();

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [forceUpdateState, setForceUpdateState] = useState<MobileAppVersionState | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | undefined>();

  useEffect(() => {
    // Apply conservative default props to all TextInputs to reduce keyboard suggestion/autofill UI
    try {
      const TextInputAny: any = TextInput as any;
      if (!TextInputAny.defaultProps) TextInputAny.defaultProps = {} as any;
      Object.assign(TextInputAny.defaultProps, {
        autoComplete: 'off',
        autoCorrect: false,
        spellCheck: false,
        textContentType: 'none',
        importantForAutofill: 'no',
        contextMenuHidden: true,
        // disable suggestions and auto-fill as a best-effort
        disableFullscreenUI: true,
      });
    } catch (e) {
      // ignore if environment doesn't support these props
    }

    // Attempt to load expo-clipboard at runtime. We use eval('require') so Metro
    // can't statically analyze the dependency and fail bundling when it's not installed.
    let showSub: { remove: () => void } = { remove: () => {} };
    try {
      const _require: any = eval("require");
      const Clipboard = _require('expo-clipboard');
      if (Clipboard && Clipboard.setStringAsync) {
        const onShow = async () => {
          try {
            // Always clear clipboard while keyboard is visible to prevent
            // Android IME (e.g. Gboard) from showing clipboard suggestions.
            await Clipboard.setStringAsync('');
          } catch {
            // ignore
          }
        };
        showSub = Keyboard.addListener('keyboardDidShow', onShow);
      }
    } catch (e) {
      // expo-clipboard not installed or require blocked: silently ignore
    }

    return () => {
      try {
        showSub.remove();
      } catch {}
    };
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
      logger.error('[App] Error navegando desde notificacion', {
        message: (error as any)?.message,
        tipo: data?.tipo,
      });
    }
  };

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} urlScheme="litfinance">
      <ThemeProvider>
        <ConnectivityProvider>
          <AppLifecycleProvider
            navigationRef={navigationRef}
            onNotificationNavigate={handleNotificationNavigation}
            onUpgradeModalChange={(show, message) => {
              setShowUpgradeModal(show);
              setUpgradeMessage(message);
            }}
            onVersionStateChange={setForceUpdateState}
          >
            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
              <NavigationContainer ref={navigationRef}>
                <AppRootLayout routeName={navigationRef.current?.getCurrentRoute?.()?.name}>
                  <AppNavigator />
                </AppRootLayout>
                <UpgradeModal
                  visible={showUpgradeModal}
                  onClose={() => setShowUpgradeModal(false)}
                  message={upgradeMessage}
                />
                <ForceUpdateModal
                  visible={Boolean(forceUpdateState?.forceUpdate)}
                  build={forceUpdateState?.build ?? null}
                  latestVersion={forceUpdateState?.latestVersion ?? null}
                  message={
                    forceUpdateState?.minVersion
                      ? `Necesitas actualizar la app para continuar. Se requiere al menos la versión ${forceUpdateState.minVersion}.`
                      : undefined
                  }
                  minVersion={forceUpdateState?.minVersion ?? null}
                  storeUrl={forceUpdateState?.storeUrl ?? null}
                />
              </NavigationContainer>
            </SafeAreaProvider>
          </AppLifecycleProvider>
        </ConnectivityProvider>
        <Toast
          config={toastConfig}
        />
      </ThemeProvider>
    </StripeProvider>
  );
}

function AppRootLayout({
  children,
  routeName,
}: {
  children: React.ReactNode;
  routeName?: string;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
    NavigationBar.setBackgroundColorAsync(colors.background).catch(() => {});
    NavigationBar.setBorderColorAsync(colors.background).catch(() => {});
    NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});
  }, [colors.background, isDark]);

  // ✅ Regla:
  // - Android: NO KeyboardAvoidingView global (evita jump)
  // - iOS: sí, PERO NO en Dashboard (evita que el dock “salte” detrás del modal)
  const enableGlobalKAV = Platform.OS === 'ios' && routeName !== 'Dashboard';

  const Container: any = enableGlobalKAV ? KeyboardAvoidingView : View;
  const containerProps: any = enableGlobalKAV ? { behavior: 'padding' } : {};

  return (
    <Container {...containerProps} style={[styles.flex, { backgroundColor: colors.background }]}> 
      <OfflineBanner />
      <View
        style={[
          styles.flex,
          {
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
            backgroundColor: colors.background,
          },
        ]}
      >
        <AppLockGate>{children}</AppLockGate>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
