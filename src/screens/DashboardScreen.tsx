import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Platform } from "react-native";
import { useStableSafeInsets } from '../hooks/useStableSafeInsets';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from "expo-status-bar";
import DashboardHeader from "../components/DashboardHeader";
import BalanceCard from "../components/BalanceCard";
import ActionButtons from "../components/ActionButtons";
import ExpensesChart from "../components/ExpensesChart";
import TransactionHistory from "../components/TransactionHistory";
import SubaccountsList from "../components/SubaccountList";
import RecurrentesList from "../components/RecurrenteList";
import MetasCard from "../components/MetasCard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { API_BASE_URL } from "../constants/api";
import { useFocusEffect, useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useThemeColors } from "../theme/useThemeColors";
import { useTheme } from "../theme/ThemeContext";
import { useSafeApi } from "../hooks/useSafeApi";
import { jwtDecode } from "../utils/jwtDecode";
import { dashboardRefreshBus } from "../utils/dashboardRefreshBus";
import { userProfileService } from "../services/userProfileService";
import type { DashboardRange, DashboardSnapshot } from "../types/dashboardSnapshot";
import { fetchDashboardSnapshot, getCachedDashboardSnapshot, setCachedDashboardSnapshot } from "../services/dashboardSnapshotService";
import DashboardBottomDock, { DASHBOARD_DOCK_APPROX_HEIGHT } from "../components/DashboardBottomDock";
import ScanActionModal from "../components/ScanActionModal";
import { getPlanTypeFromStorage } from '../services/planConfigService';

export default function DashboardScreen() {
  const colors = useThemeColors();
  const insets = useStableSafeInsets();
  const { isDark } = useTheme();
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [recurrentesRefreshKey, setRecurrentesRefreshKey] = useState(Date.now());
  const [subcuentasRefreshKey, setSubcuentasRefreshKey] = useState(Date.now());
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const route = useRoute<RouteProp<RootStackParamList, "Dashboard">>();
  const navigation = useNavigation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const isMountedRef = useRef(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousPremiumStatusRef = useRef<boolean | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const actionButtonsYRef = useRef<number>(0);

  const [snapshotRange, setSnapshotRange] = useState<DashboardRange>('month');
  const [snapshotRecentLimit, setSnapshotRecentLimit] = useState<number>(15);
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot | null>(null);
  const [dashboardEtag, setDashboardEtag] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState<boolean>(false);
  const snapshotFetchInFlightRef = useRef(false);
  const snapshotRefreshQueuedRef = useRef<{ force?: boolean; silent?: boolean } | null>(null);

  const [isPremium, setIsPremium] = useState<boolean>(false);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Refrescos dirigidos: solo la sección afectada
  useEffect(() => {
    const offRec = dashboardRefreshBus.on('recurrentes:changed', () => {
      // Con snapshot: refrescamos el snapshot completo (1 request), no cada widget.
      setRecurrentesRefreshKey(Date.now());
      void refreshSnapshot({ force: true });
    });
    const offSub = dashboardRefreshBus.on('subcuentas:changed', () => {
      setSubcuentasRefreshKey(Date.now());
      void refreshSnapshot({ force: true });
    });
    const offTx = dashboardRefreshBus.on('transacciones:changed', () => {
      const t = Date.now();
      setRefreshKey(t);
      setReloadTrigger(t);
      void refreshSnapshot({ force: true });
    });
    const offViewer = dashboardRefreshBus.on('viewer:changed', () => {
      void refreshSnapshot({ force: true });
    });
    return () => {
      offRec();
      offSub();
      offTx();
      offViewer();
    };
  }, []);

  const handleCurrencyChange = useCallback(() => {
    console.log('💱 [DashboardScreen] === INICIO ACTUALIZACIÓN POR CAMBIO DE MONEDA ===');
    console.log('💱 [DashboardScreen] Actualizando todos los componentes por cambio de moneda');
    const newTrigger = Date.now();
    console.log('💱 [DashboardScreen] Nuevos triggers:', {
      reloadTrigger: newTrigger,
      refreshKey: newTrigger,
      timestamp: new Date().toISOString()
    });
    setReloadTrigger(newTrigger);
    setRefreshKey(newTrigger);
    console.log('💱 [DashboardScreen] === FIN ACTUALIZACIÓN POR CAMBIO DE MONEDA ===');
  }, []);

  const checkPremiumStatusChange = useCallback(async () => {
    try {
      const profile = await userProfileService.getCachedProfile();
      if (!profile) return;

      const currentIsPremium = profile.planType === 'premium_plan' || profile.isPremium === true;
      const previousIsPremium = previousPremiumStatusRef.current;

      // Primera vez que checamos, solo guardar el estado sin notificar
      if (previousIsPremium === null) {
        previousPremiumStatusRef.current = currentIsPremium;
        return;
      }

      // Detectar cambio de premium a free
      if (previousIsPremium && !currentIsPremium) {
        Toast.show({
          type: 'info',
          text1: '🚨 Plan actualizado a Free',
          text2: 'Tus recursos (subcuentas y recurrentes) han sido pausados automáticamente. Se reactivarán cuando actualices a Premium.',
          visibilityTime: 10000,
          onPress: () => {
            navigation.navigate('Settings' as never);
          },
        });
        // Refrescar listas después de que el backend procese el auto-pause
        setTimeout(() => {
          const t = Date.now();
          setSubcuentasRefreshKey(t);
          setRecurrentesRefreshKey(t);
          setRefreshKey(t);
          setReloadTrigger(t);
          console.log('🔄 [Dashboard] Refrescando UI después de pérdida de premium');
        }, 1500); // 1.5 segundos para dar tiempo al backend
      }

      // Detectar cambio de free a premium
      if (!previousIsPremium && currentIsPremium) {
        Toast.show({
          type: 'success',
          text1: '✨ ¡Bienvenido a Premium!',
          text2: 'Tus recursos han sido reactivados automáticamente. Ahora puedes crear subcuentas y recurrentes ilimitados.',
          visibilityTime: 8000,
        });
        // Refrescar listas después de que el backend procese el auto-resume
        setTimeout(() => {
          const t = Date.now();
          setSubcuentasRefreshKey(t);
          setRecurrentesRefreshKey(t);
          setRefreshKey(t);
          setReloadTrigger(t);
          console.log('🔄 [Dashboard] Refrescando UI después de recuperación de premium');
        }, 1500); // 1.5 segundos para dar tiempo al backend
      }

      // Actualizar el estado anterior
      previousPremiumStatusRef.current = currentIsPremium;
    } catch (error) {
      console.warn('[Dashboard] Error checking premium status:', error);
    }
  }, [navigation]);

  const refreshSnapshot = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    if (snapshotFetchInFlightRef.current) {
      // No perder refreshes (p. ej. al crear movimiento mientras hay un fetch en curso)
      const prev = snapshotRefreshQueuedRef.current;
      snapshotRefreshQueuedRef.current = {
        force: Boolean(prev?.force || opts?.force),
        silent: Boolean(prev?.silent && opts?.silent),
      };
      return;
    }
    snapshotFetchInFlightRef.current = true;

    // Cancelar petición anterior si existe (solo para snapshot)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      if (!opts?.silent) setSnapshotLoading(true);

      const res = await fetchDashboardSnapshot({
        etag: opts?.force ? undefined : (dashboardEtag ?? undefined),
        range: snapshotRange,
        recentLimit: snapshotRecentLimit,
        signal,
      });

      if (signal.aborted) return;

      if (res.kind === 'not-modified') {
        return;
      }

      setDashboardSnapshot(res.snapshot);
      setDashboardEtag(res.etag);
      setCuentaId(res.snapshot?.accountSummary?.cuentaId ?? null);

      // Si el backend provee límites administrativos actualizados, sincronizarlos
      const newRecentLimitFromMeta = res.snapshot?.meta?.limits?.historicoLimitadoDias ??
        (res.snapshot?.meta?.limitsV2?.items?.find((it: any) => it.key === 'historicoLimitadoDias')?.limit ?? null);
      const newRecentLimit = typeof newRecentLimitFromMeta === 'number' && newRecentLimitFromMeta > 0 ? Number(newRecentLimitFromMeta) : snapshotRecentLimit;
      if (newRecentLimit !== snapshotRecentLimit) {
        setSnapshotRecentLimit(newRecentLimit);
      }

      // Cache local por user/range/recentLimit (usar el límite provisto por el servidor si existe)
      if (userId) {
        await setCachedDashboardSnapshot({
          userId,
          range: snapshotRange,
          recentLimit: newRecentLimit,
          snapshot: res.snapshot,
          etag: res.etag,
        });
      }

      // Sincronizar referencia de premium para toasts
      if (typeof res.snapshot?.meta?.plan?.isPremium === 'boolean' && previousPremiumStatusRef.current === null) {
        previousPremiumStatusRef.current = res.snapshot.meta.plan.isPremium;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
      if (!isMountedRef.current) return;

      if (err?.code === 'RATE_LIMITED' && typeof err?.retryAfterSeconds === 'number') {
        Toast.show({
          type: 'warning',
          text1: '⚠️ Demasiadas peticiones',
          text2: `Espera ${Math.max(1, Math.round(err.retryAfterSeconds))}s e intenta de nuevo`,
          visibilityTime: 4000,
        });
        return;
      }

      if (err?.code === 'UNAUTHORIZED') {
        Toast.show({
          type: 'error',
          text1: 'Sesión expirada',
          text2: 'Inicia sesión nuevamente',
          visibilityTime: 4000,
        });
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Error cargando dashboard',
        text2: 'Intenta de nuevo en unos segundos',
      });
    } finally {
      snapshotFetchInFlightRef.current = false;
      if (!opts?.silent) setSnapshotLoading(false);

      const queued = snapshotRefreshQueuedRef.current;
      snapshotRefreshQueuedRef.current = null;
      if (queued) {
        setTimeout(() => {
          void refreshSnapshot({ force: queued.force, silent: queued.silent });
        }, 0);
      }
    }
  }, [dashboardEtag, snapshotRange, snapshotRecentLimit, userId]);

  useEffect(() => {
    // Intentar inicializar `userId` y `cuentaId` desde el token inmediatamente
    (async () => {
      try {
        // También leer keys directas guardadas en LoginScreen (más confiable para render inmediato)
        try {
          const [storedUserId, storedCuentaId] = await Promise.all([
            AsyncStorage.getItem('userId'),
            AsyncStorage.getItem('cuentaId'),
          ]);
          if (storedUserId) setUserId(storedUserId);
          if (storedCuentaId) setCuentaId(storedCuentaId);
        } catch {
          // ignore
        }

        // Primero intentar leer userData guardado por LoginScreen para mostrar hijos inmediatamente
        try {
          const raw = await AsyncStorage.getItem('userData');
          if (raw) {
            const u = JSON.parse(raw);
            if (u?.id) setUserId(u.id);
            if (u?.cuentaId) setCuentaId(u.cuentaId);
            console.log('[Dashboard] userData cargado desde AsyncStorage');
          }
        } catch (stErr) {
          // ignore
        }

        // Luego intentar obtener token y decodificar si es posible
        try {
          const token = await authService.getAccessToken();
          if (token) {
            try {
              const decoded = jwtDecode(token as any);
              if (decoded?.userId) setUserId(decoded.userId);
              if (decoded?.cuentaId) setCuentaId(decoded.cuentaId);
            } catch (decErr) {
              // ignore decode errors
            }
          }
        } catch (e) {
          console.warn('[Dashboard] No se pudo obtener token en inicio:', e);
        }
      } catch (e) {
        console.warn('[Dashboard] Error inicializando ids:', e);
      } finally {
        // Con snapshot: cargar cache local primero (stale-while-revalidate)
        try {
          const token = await authService.getAccessToken();
          if (token) {
            const decoded = jwtDecode(token as any);
            const uid = decoded?.userId;
            if (uid) {
              const cached = await getCachedDashboardSnapshot({
                userId: uid,
                range: snapshotRange,
                recentLimit: snapshotRecentLimit,
              });
              if (cached?.snapshot) {
                setDashboardSnapshot(cached.snapshot);
                setDashboardEtag(cached.etag);
                setCuentaId(cached.snapshot?.accountSummary?.cuentaId ?? null);
              }
            }
          }
        } catch {
          // ignore cache miss
        }

        // Revalidar en background (1 request)
        void refreshSnapshot({ silent: true });
      }
    })();
  }, [refreshSnapshot, snapshotRange, snapshotRecentLimit]);

  useEffect(() => {
    const fromSnapshot = dashboardSnapshot?.meta?.plan?.isPremium;
    if (typeof fromSnapshot === 'boolean') {
      setIsPremium(fromSnapshot);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const plan = await getPlanTypeFromStorage();
        if (!cancelled) setIsPremium(plan === 'premium_plan');
      } catch {
        if (!cancelled) setIsPremium(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dashboardSnapshot]);

  // Removido: `route.params.updated` ya no dispara recargas globales

  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    const minInterval = 2000; // 2 segundos entre refreshes manuales
    
    if (now - lastRefreshTime < minInterval) {
      console.log('[Dashboard] ⛔ Refresh bloqueado: muy pronto desde el último refresh');
      Toast.show({
        type: 'info',
        text1: 'Espera un momento',
        text2: 'Por favor espera antes de actualizar de nuevo',
        visibilityTime: 2000,
      });
      return;
    }
    
    if (isRefreshing) {
      console.log('[Dashboard] Refresh ya en progreso, ignorando');
      return;
    }

    if (!isMountedRef.current) {
      console.log('[Dashboard] Componente desmontado, cancelando refresh');
      return;
    }

    setIsRefreshing(true);
    setLastRefreshTime(now);
    
    try {
      console.log('[Dashboard] Iniciando refresh de datos...');

      await refreshSnapshot({ force: true });
      
      if (isMountedRef.current) {
        const t = Date.now();
        setReloadTrigger(t);
        setRefreshKey(t);
        setRecurrentesRefreshKey(t);
        setSubcuentasRefreshKey(t);
        
        console.log('[Dashboard] Refresh completado exitosamente');
        Toast.show({
          type: "success",
          text1: "Datos actualizados",
          text2: "La información se ha refrescado correctamente",
        });
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      
      console.error('[Dashboard] Error al refrescar:', error);
      Toast.show({
        type: "error",
        text1: "Error al recargar",
        text2: "No se pudieron actualizar los datos.",
      });
    } finally {
      // Usar timeout para asegurar que el spinner se muestre por al menos 500ms
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
      }, 500);
    }
  }, [lastRefreshTime, isRefreshing]);

  // Use stable insets that don't change with keyboard/modals
  const dockInset = insets.bottom + (Platform.OS === 'android' ? 2 : 0);

  // Nota: removimos auto-refresh en focus y el refresh automático por `route.params.updated`
  // para evitar múltiples fetches y recargas costosas. El refresh queda en:
  // - Pull-to-refresh (manual)
  // - Cambio de moneda (handleCurrencyChange)

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.topHeaderContainer, { backgroundColor: colors.background }]}>
        <DashboardHeader dashboardSnapshot={dashboardSnapshot} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingBottom: 20 + dockInset + DASHBOARD_DOCK_APPROX_HEIGHT,
            backgroundColor: colors.background,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >

        <BalanceCard reloadTrigger={reloadTrigger} onCurrencyChange={handleCurrencyChange} dashboardSnapshot={dashboardSnapshot} />

        <View
          onLayout={(e) => {
            actionButtonsYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <ActionButtons 
            cuentaId={cuentaId || undefined} 
            userId={userId || undefined} 
            onRefresh={handleRefresh} 
            dashboardSnapshot={dashboardSnapshot}
          />
        </View>

        {userId && (
          <RecurrentesList userId={userId} refreshKey={recurrentesRefreshKey} dashboardSnapshot={dashboardSnapshot} />
        )}

        <MetasCard onPress={() => navigation.navigate('Metas' as never)} />

        {userId && (
          <SubaccountsList userId={userId} refreshKey={subcuentasRefreshKey} dashboardSnapshot={dashboardSnapshot} />
        )}

        <ExpensesChart refreshKey={refreshKey} dashboardSnapshot={dashboardSnapshot} selectedRange={snapshotRange} onRequestRangeChange={(r) => { setSnapshotRange(r); void refreshSnapshot({ force: true }); }} />
        <TransactionHistory refreshKey={refreshKey} dashboardSnapshot={dashboardSnapshot} />
      </ScrollView>

      {/* Bottom fade to hide clipped content when scrolling near nav bar */}
      <LinearGradient
        colors={[
          'transparent',
          `${colors.background}33`,
          `${colors.background}99`,
          colors.background,
        ]}
        locations={[0, 0.45, 0.82, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: dockInset + DASHBOARD_DOCK_APPROX_HEIGHT,
        }}
      />

      <DashboardBottomDock
        active="home"
        onPressHome={() => {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }}
        onPressBloc={() => {
          // @ts-ignore
          navigation.navigate('BlocCuentas' as never);
        }}
        onPressReports={() => {
          // Always navigate to ReportesExport screen; the screen will perform
          // a server-side profile sync and show clear guidance if the server
          // still rejects the request. This avoids duplicate gating logic.
          // @ts-ignore
          navigation.navigate('ReportesExport' as never);
        }}
        onPressShared={() => {
          // @ts-ignore
          navigation.navigate('SharedSpaces' as never);
        }}
        onPressCenter={() => setScanModalVisible(true)}
        reportsLocked={!isPremium}
      />
      <ScanActionModal
        visible={scanModalVisible}
        onClose={() => setScanModalVisible(false)}
        onScanCamera={() => {
          // @ts-ignore
          navigation.navigate('TicketScan', { source: 'camera' });
        }}
        onScanGallery={() => {
          // @ts-ignore
          navigation.navigate('TicketScan', { source: 'gallery' });
        }}
        onManualEntry={() => {
          // @ts-ignore
          navigation.navigate('TicketManual');
        }}
        onViewHistory={() => {
          // @ts-ignore
          navigation.navigate('TicketScanHistory');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
  },
  topHeaderContainer: {
    width: "100%",
    paddingHorizontal: 0,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
});
