import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { StatusBar } from "expo-status-bar";
import DashboardHeader from "../components/DashboardHeader";
import BalanceCard from "../components/BalanceCard";
import ActionButtons from "../components/ActionButtons";
import ExpensesChart from "../components/ExpensesChart";
import TransactionHistory from "../components/TransactionHistory";
import SubaccountsList from "../components/SubaccountList";
import RecurrentesList from "../components/RecurrenteList";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { API_BASE_URL } from "../constants/api";
import { useFocusEffect, useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useThemeColors } from "../theme/useThemeColors";
import { useTheme } from "../theme/ThemeContext";
import { useSafeApi } from "../hooks/useSafeApi";
import apiRateLimiter from "../services/apiRateLimiter";
import { jwtDecode } from "../utils/jwtDecode";
import { dashboardRefreshBus } from "../utils/dashboardRefreshBus";

export default function DashboardScreen() {
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [recurrentesRefreshKey, setRecurrentesRefreshKey] = useState(Date.now());
  const [subcuentasRefreshKey, setSubcuentasRefreshKey] = useState(Date.now());
  const route = useRoute<RouteProp<RootStackParamList, "Dashboard">>();
  const navigation = useNavigation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const isMountedRef = useRef(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      setRecurrentesRefreshKey(Date.now());
    });
    const offSub = dashboardRefreshBus.on('subcuentas:changed', () => {
      setSubcuentasRefreshKey(Date.now());
    });
    return () => {
      offRec();
      offSub();
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

  const fetchCuentaId = async (signal?: AbortSignal) => {
    try {
      console.log('[Dashboard] Obteniendo datos de cuenta principal...');
      const token = await authService.getAccessToken();
      
      if (!token) {
        throw new Error('No hay token de autenticación');
      }
      
      // Cancelar petición anterior si existe
      if (abortControllerRef.current && !signal) {
        abortControllerRef.current.abort();
      }

      // Crear nuevo AbortController si no se proporcionó uno
      const controller = signal ? null : new AbortController();
      if (controller) {
        abortControllerRef.current = controller;
      }
      const fetchSignal = signal || controller?.signal;

      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/cuenta/principal`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-store',
          'X-Skip-Cache': '1',
        },
        signal: fetchSignal,
      });

      if (fetchSignal?.aborted) {
        console.log('[Dashboard] Petición cancelada');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        const statusCode = data?.statusCode ?? res.status;
        const message = data?.message || `Error ${res.status}`;
        const error: any = new Error(message);
        error.statusCode = statusCode;
        throw error;
      }
      
      // Solo actualizar estado si el componente está montado y no fue abortado
      if (isMountedRef.current && !fetchSignal?.aborted) {
        const nextCuentaId = data?.id || data?._id || data?.cuentaId || data?.cuentaPrincipalId || null;
        const nextUserId = data?.userId || data?.usuarioId || data?.user?.id || null;
        if (nextCuentaId) setCuentaId(nextCuentaId);
        if (nextUserId) setUserId(nextUserId);
        console.log('[Dashboard] Datos de cuenta obtenidos exitosamente');
      }
    } catch (err: any) {
      // Ignorar errores de abort
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        console.log('[Dashboard] Petición cancelada');
        return;
      }

      console.error('[Dashboard] Error fetching cuenta:', err);
      
      // Solo mostrar toast si el componente está montado
      if (!isMountedRef.current) return;

      let errorMessage = "Inicia sesión de nuevo o inténtalo más tarde";
      
      if (err.statusCode === 429 || err.message?.includes('Rate limit') || err.message?.includes('429') || err.message?.includes('Too Many')) {
        errorMessage = "⚠️ Demasiadas peticiones. Espera 10 segundos e intenta de nuevo";
        // Pausar todas las peticiones por 10 segundos
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else if (err.statusCode === 401) {
        errorMessage = "Sesión expirada. Inicia sesión nuevamente";
      }
      
      Toast.show({
        type: "error",
        text1: "Error al recuperar la cuenta principal",
        text2: errorMessage,
      });
    }
  };

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
        // Llamada de verificación en background para sincronizar con backend.
        // Reintentar unos segundos si el token aún no está listo justo después del login.
        const maxAttempts = 8;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const token = await authService.getAccessToken();
            if (!token) {
              await new Promise(r => setTimeout(r, 250));
              continue;
            }
            await fetchCuentaId();
            break;
          } catch {
            await new Promise(r => setTimeout(r, 350));
          }
        }
        // No forzar refresh global aquí: evita recargar todos los widgets al mismo tiempo.
      }
    })();
  }, []);

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
      
      await fetchCuentaId();
      
      if (isMountedRef.current) {
        const t = Date.now();
        setReloadTrigger(t);
        setRefreshKey(t);
        // También disparar refresh dirigidos para listas específicas
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

  // Nota: removimos auto-refresh en focus y el refresh automático por `route.params.updated`
  // para evitar múltiples fetches y recargas costosas. El refresh queda en:
  // - Pull-to-refresh (manual)
  // - Cambio de moneda (handleCurrencyChange)

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.topHeaderContainer, { backgroundColor: colors.background }]}>
        <DashboardHeader />
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >

        <BalanceCard reloadTrigger={reloadTrigger} onCurrencyChange={handleCurrencyChange} />

        <ActionButtons 
          cuentaId={cuentaId || undefined} 
          userId={userId || undefined} 
          onRefresh={handleRefresh} 
        />

        {userId && (
          <RecurrentesList userId={userId} refreshKey={recurrentesRefreshKey} />
        )}

        {userId && (
          <SubaccountsList userId={userId} refreshKey={subcuentasRefreshKey} />
        )}

        <ExpensesChart refreshKey={refreshKey} />
        <TransactionHistory refreshKey={refreshKey} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
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
