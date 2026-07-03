import React, { useEffect, useRef } from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';
import { AppState, type AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { authService } from '../../services/authService';
import { mobileBootstrapService, type MobileAppVersionState } from '../../services/mobileBootstrapService';
import { mobileSyncService } from '../../services/mobileSyncService';
import { offlineSyncService } from '../../services/offlineSyncService';
import { setupNotificationListeners } from '../../services/notificationService';
import { syncStatusService } from '../../services/syncStatusService';
import { userProfileService } from '../../services/userProfileService';
import { applyStoredAppIconVariant } from '../../services/appIconService';
import { apiRateLimiter } from '../../services/apiRateLimiter';
import { logger } from '../../shared/monitoring/logger';
import { LITE_SYNC_POLICY } from '../../config/liteSyncPolicy';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { liteMobileBootstrapService } from '../../services/lite/liteMobileBootstrap.service';
import { liteSyncPullService } from '../../services/lite/liteSyncPull.service';
import { liteSyncPushService } from '../../services/lite/liteSyncPush.service';

const APP_START_TIMESTAMP = Date.now();
const BOOTSTRAP_TTL_MS = 2 * 60 * 1000;
const PROFILE_REFRESH_TTL_MS = 5 * 60 * 1000;
const FOREGROUND_RESUME_MIN_INTERVAL_MS = 30 * 1000;

type AppLifecycleProviderProps = {
  children: React.ReactNode;
  enableLegacyMobileRuntime?: boolean;
  enablePushNotifications?: boolean;
  enableUpgradePrompts?: boolean;
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
  onNotificationNavigate: (data: any) => void;
  onVersionStateChange: (versionState: MobileAppVersionState | null) => void;
  onUpgradeModalChange: (show: boolean, message?: string) => void;
};

export function AppLifecycleProvider({
  children,
  enableLegacyMobileRuntime = true,
  enablePushNotifications = true,
  enableUpgradePrompts = true,
  navigationRef,
  onNotificationNavigate,
  onUpgradeModalChange,
  onVersionStateChange,
}: AppLifecycleProviderProps) {
  const appState = useRef(AppState.currentState);
  const shownUpdateBannerRef = useRef(false);
  const lastForegroundResumeAtRef = useRef(0);
  const lastProfileRefreshAtRef = useRef(0);
  const notificationNavigateRef = useRef(onNotificationNavigate);
  const upgradeModalChangeRef = useRef(onUpgradeModalChange);

  notificationNavigateRef.current = onNotificationNavigate;
  upgradeModalChangeRef.current = onUpgradeModalChange;

  const applyVersionState = (versionState: MobileAppVersionState | null) => {
    onVersionStateChange(versionState?.forceUpdate ? versionState : null);

    if (versionState?.updateAvailable && !versionState.forceUpdate && !shownUpdateBannerRef.current) {
      shownUpdateBannerRef.current = true;
      Toast.show({
        type: 'info',
        text1: 'Nueva versión disponible',
        text2: versionState.latestVersion
          ? `Actualiza a la versión ${versionState.latestVersion} cuando te sea posible.`
          : 'Hay una actualización disponible.',
      });
    }
  };

  const primeCachedBootstrapState = async () => {
    try {
      const cached = await mobileBootstrapService.getCached();
      const hasCachedData = Boolean(cached?.data);
      if (cached?.data?.app) {
        applyVersionState(cached.data.app);
      }
      return hasCachedData;
    } catch {
      return false;
    }
  };

  const runMobileBootstrap = async (opts?: { force?: boolean }) => {
    const bootstrapStartedAt = Date.now();
    syncStatusService.markBootstrapStart();
    try {
      const shouldRefresh = opts?.force
        ? true
        : await mobileBootstrapService.shouldRefresh(BOOTSTRAP_TTL_MS);
      if (!shouldRefresh) {
        syncStatusService.markBootstrapSuccess(Date.now() - bootstrapStartedAt);
        logger.info('[App] Bootstrap omitido; cache vigente');
        return;
      }

      const token = await authService.getAccessToken({ allowRefresh: false });
      if (!token) {
        syncStatusService.markBootstrapError('No hay sesión activa.', Date.now() - bootstrapStartedAt);
        return;
      }

      const { version } = await mobileBootstrapService.fetchAndPersist();
      applyVersionState(version);
      syncStatusService.markBootstrapSuccess(Date.now() - bootstrapStartedAt);
    } catch (error: any) {
      if (error?.code === 'APP_VERSION_UNSUPPORTED') {
        applyVersionState({
          build: error?.details?.build ?? null,
          forceUpdate: true,
          latestVersion: error?.details?.latestVersion ?? null,
          minVersion: error?.details?.minRequiredVersion ?? null,
          storeUrl: error?.details?.storeUrl ?? null,
        });
        syncStatusService.markBootstrapSuccess(Date.now() - bootstrapStartedAt);
        return;
      }

      const hasCache = await primeCachedBootstrapState();
      if (!hasCache) {
        Toast.show({
          type: 'error',
          text1: 'No se pudo inicializar la app',
          text2: 'Intenta nuevamente cuando tengas conexión.',
        });
      }
      syncStatusService.markBootstrapError(error?.message || 'No se pudo ejecutar bootstrap.', Date.now() - bootstrapStartedAt);
    }
  };

  const refreshUserProfile = async (opts?: { force?: boolean }) => {
    try {
      if (!opts?.force && Date.now() - lastProfileRefreshAtRef.current < PROFILE_REFRESH_TTL_MS) {
        logger.info('[App] Refresh de perfil omitido por TTL');
        return;
      }
      const token = await authService.getAccessToken({ allowRefresh: false });
      if (token) {
        logger.info('[App] Refrescando perfil de usuario');
        await userProfileService.fetchAndUpdateProfile();
        lastProfileRefreshAtRef.current = Date.now();
      }
    } catch (error) {
      logger.warn('[App] Error refrescando perfil', {
        message: (error as any)?.message,
      });
    }
  };

  const bootstrapSession = async (opts?: {
    forceBootstrap?: boolean;
    forceProfile?: boolean;
    syncReason?: string;
  }) => {
    try {
      await primeCachedBootstrapState();
      await authService.getAccessToken({ allowRefresh: false });
    } catch (error) {
      logger.warn('[App] Error bootstrapping session', {
        message: (error as any)?.message,
      });
    } finally {
      if (enableLegacyMobileRuntime) {
        await refreshUserProfile({ force: opts?.forceProfile });
        await runMobileBootstrap({ force: opts?.forceBootstrap });
      } else if (LITE_SYNC_POLICY.autoBootstrapOnAppStart) {
        await liteMobileBootstrapService.run().catch((error) => {
          logger.warn('[App] Error ejecutando bootstrap Lite', {
            message: (error as any)?.message,
          });
        });
      }

      if (opts?.syncReason && enableLegacyMobileRuntime) {
        await mobileSyncService.syncNow(opts.syncReason).catch(() => {});
      } else if (opts?.syncReason && !LITE_SYNC_POLICY.manualSyncOnly) {
        await liteSyncPushService.tryPushIfOnline().catch(() => {});
        await liteSyncPullService.pull().catch(() => {});
      }
      if (opts?.syncReason === 'session_bootstrap') {
        syncStatusService.markAppStartupComplete(Date.now() - APP_START_TIMESTAMP);
      }
    }
  };

  const handleForegroundResume = async () => {
    const now = Date.now();
    if (now - lastForegroundResumeAtRef.current < FOREGROUND_RESUME_MIN_INTERVAL_MS) {
      logger.info('[App] Foreground resume omitido por cooldown');
      return;
    }

    lastForegroundResumeAtRef.current = now;
    if (enableLegacyMobileRuntime) {
      await refreshUserProfile({ force: false });
      await runMobileBootstrap({ force: false });
      await mobileSyncService.syncNow('foreground').catch(() => {});
      return;
    }

    if (!LITE_SYNC_POLICY.manualSyncOnly && LITE_SYNC_POLICY.autoPullOnResume) {
      await liteSyncPushService.tryPushIfOnline().catch(() => {});
      await liteSyncPullService.pull().catch(() => {});
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      logger.info('[App] App volvio a foreground; evaluando refresh ligero');
      void handleForegroundResume();
    }
    appState.current = nextAppState;
  };

  useEffect(() => {
    applyStoredAppIconVariant().catch(() => {});

    if (enableUpgradePrompts) {
      apiRateLimiter.setUpgradeModalController((show: boolean, message?: string) => {
        upgradeModalChangeRef.current(show, message);
      });
    } else {
      apiRateLimiter.setUpgradeModalController(() => {});
    }

    void bootstrapSession({
      forceBootstrap: true,
      forceProfile: true,
      syncReason: 'session_bootstrap',
    });

    if (enableLegacyMobileRuntime) {
      offlineSyncService.init();
      mobileSyncService.init();
    }

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    const unregisterLogout = authService.onLogout(() => {
      logger.warn('[App] Sesion expirada; redirigiendo a Login');
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

    const notificationsCleanup = enablePushNotifications ? setupNotificationListeners(
      (notification) => {
        const data = notification.request.content.data as any;
        logger.info('[App] Notificacion recibida', {
          hasBody: Boolean(notification.request.content.body),
          hasTitle: Boolean(notification.request.content.title),
          tipo: data?.tipo,
        });

        Toast.show({
          type: data?.tipo === 'error' ? 'error' : 'info',
          text1: notification.request.content.title as string,
          text2: notification.request.content.body as string,
          visibilityTime: 4000,
          onPress: () => {
            notificationNavigateRef.current(data);
          },
        });
      },
      (response) => {
        const data = response.notification.request.content.data as any;
        logger.info('[App] Notificacion abierta', {
          ticketId: data?.ticketId,
          tipo: data?.tipo,
        });
        notificationNavigateRef.current(data);
      },
    ) : () => {};

    return () => {
      notificationsCleanup();
      unregisterLogout();
      appStateSubscription.remove();
      if (enableLegacyMobileRuntime) {
        offlineSyncService.stop();
        mobileSyncService.stop();
      }
    };
  }, [enableLegacyMobileRuntime, enablePushNotifications, enableUpgradePrompts, navigationRef]);

  return <>{children}</>;
}
