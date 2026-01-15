import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { API_BASE_URL } from "../constants/api";
import AccountSettingsModal from "./AccountSettingsModal";
import SmartNumber from "./SmartNumber";
import Toast from "react-native-toast-message";
import { useThemeColors } from "../theme/useThemeColors";
import apiRateLimiter from "../services/apiRateLimiter"; 

interface Transaccion {
  tipo: 'ingreso' | 'egreso';
  monto: number;
}

interface BalanceCardProps {
  reloadTrigger: number;
  onCurrencyChange?: () => void;
}

interface CuentaData {
  cantidad: number;
  moneda: string;
}

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const BalanceCard: React.FC<BalanceCardProps> = ({ reloadTrigger, onCurrencyChange }) => {
  console.log('🚀 [BalanceCard] Componente inicializado con reloadTrigger:', reloadTrigger);
  const colors = useThemeColors();
  
  const [saldo, setSaldo] = useState(0);
  const [monedaActual, setMonedaActual] = useState('MXN');
  const [ingresos, setIngresos] = useState(0);
  const [egresos, setEgresos] = useState(0);
  const [isLoadingFresh, setIsLoadingFresh] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [periodo, setPeriodo] = useState('mes');
  const [isFetching, setIsFetching] = useState(false);
  const [isChangingCurrency, setIsChangingCurrency] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [refreshPreferences, setRefreshPreferences] = useState(0);
  const [showFullNumbers, setShowFullNumbers] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  
  // Refs para prevención de memory leaks
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const abortTxControllerRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<number>(0);
  const lastTxFetchRef = useRef<number>(0);
  const cuentaRequestIdRef = useRef(0);
  const txRequestIdRef = useRef(0);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    
    // 🚀 Cargar datos cacheados inmediatamente para mostrar algo al usuario
    const loadCachedData = async () => {
      try {
        const cached = await AsyncStorage.getItem('balance_cache');
        if (cached) {
          const data = JSON.parse(cached);
          if (isMountedRef.current && data.saldo !== undefined) {
            console.log('⚡ [BalanceCard] Mostrando datos cacheados inmediatamente');
            setSaldo(data.saldo || 0);
            setMonedaActual(data.moneda || 'MXN');
            setIngresos(data.ingresos || 0);
            setEgresos(data.egresos || 0);
          }
        }
      } catch (err) {
        console.log('⚠️ [BalanceCard] No hay cache disponible, esperando fetch');
      }
    };
    loadCachedData();
    
    return () => {
      console.log('🧹 [BalanceCard] Limpiando componente...');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (abortTxControllerRef.current) {
        abortTxControllerRef.current.abort();
      }
    };
  }, []);

  const FILTER_MAX_HEIGHT = 180; // Ajusta según el contenido

  useEffect(() => {
    const loadNumberPreference = async () => {
      try {
        const preference = await AsyncStorage.getItem('showFullNumbers');
        setShowFullNumbers(preference === 'true');
      } catch (error) {
        console.error('Error cargando preferencia de números:', error);
      }
    };

    loadNumberPreference();
  }, [refreshPreferences]);

  useEffect(() => {
    if (mostrarFiltros) {
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: FILTER_MAX_HEIGHT,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [mostrarFiltros]);


  const etiquetasFiltro: Record<string, string> = {
    dia: 'Día',
    semana: 'Semana',
    mes: 'Mes',
    '3meses': '3 Meses',
    '6meses': '6 Meses',
    año: 'Año',
  };

  const fetchDatosCuenta = async () => {
    const now = Date.now();
    const minInterval = 1000; // Mínimo 1 segundo entre fetches
    
    if (now - lastFetchRef.current < minInterval) {
      console.log('💳 [BalanceCard] Fetch bloqueado: muy pronto desde el último');
      Toast.show({
        type: 'info',
        text1: 'Espera un momento',
        text2: 'Por favor espera antes de actualizar de nuevo',
        position: 'bottom',
        visibilityTime: 2000,
      });
      return;
    }

    console.log('📊 [BalanceCard] Iniciando fetch de datos de cuenta...');
    
    // Cancelar fetch anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const requestId = ++cuentaRequestIdRef.current;
    
    try {
      lastFetchRef.current = now;
      // Mostrar feedback de carga para el saldo principal
      if (isMountedRef.current) setIsLoadingFresh(true);
      const token = await authService.getAccessToken();
      console.log('🔑 [BalanceCard] Token obtenido:', token ? 'Existe' : 'No encontrado');
      
      const url = `${API_BASE_URL}/cuenta/principal`;
      console.log('🌐 [BalanceCard] Realizando petición a:', url);

      if (!token) {
        console.log('⚠️ [BalanceCard] No hay token de autenticación, saltando fetch de cuenta');
        return;
      }

      const resCuenta = await apiRateLimiter.fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-store',
          'X-Skip-Cache': '1',
        },
        signal,
      });

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('💳 [BalanceCard] Fetch cancelado');
        return;
      }
      
      const cuentaData = await resCuenta.json();

      if (!resCuenta.ok) {
        const statusCode = cuentaData?.statusCode ?? resCuenta.status;
        const message = cuentaData?.message || `Error ${resCuenta.status}`;
        const error: any = new Error(message);
        error.statusCode = statusCode;
        throw error;
      }

      // Normalizar payload: algunos endpoints devuelven { data: {...} }
      const payload = cuentaData?.data ?? cuentaData ?? {};

      console.log('📥 [BalanceCard] Respuesta de cuenta recibida (normalizada):', {
        status: resCuenta.status,
        raw: cuentaData,
        payload
      });

      // Aceptar varias claves posibles para saldo/moneda para ser tolerantes a cambios de backend
      const nuevoSaldo = payload.cantidad ?? payload.saldo ?? payload.balance ?? payload.amount ?? 0;
      const nuevaMoneda = payload.moneda ?? payload.currency ?? payload.monedaCuenta ?? 'MXN';
      
      console.log('💰 [BalanceCard] Actualizando estado con datos de cuenta:', {
        saldoAnterior: saldo,
        saldoNuevo: nuevoSaldo,
        monedaAnterior: monedaActual,
        monedaNueva: nuevaMoneda,
        sincronizacionBackend: nuevaMoneda !== monedaActual ? 'Detectado cambio de moneda en backend' : 'Moneda consistente'
      });
      
      // Solo actualizar estado si el componente está montado
      if (isMountedRef.current && !signal.aborted && requestId === cuentaRequestIdRef.current) {
        setSaldo(nuevoSaldo);
        setMonedaActual(nuevaMoneda);
        console.log('✅ [BalanceCard] Datos de cuenta actualizados exitosamente');
        
        // 💾 Guardar en cache para próxima carga instantánea
        try {
          await AsyncStorage.setItem('balance_cache', JSON.stringify({
            saldo: nuevoSaldo,
            moneda: nuevaMoneda,
            timestamp: Date.now()
          }));
        } catch {}
      }
    } catch (err: any) {
      // Ignorar errores de abort
      if (err.name === 'AbortError' || signal.aborted) {
        console.log('💳 [BalanceCard] Fetch cancelado');
        return;
      }
      console.error('❌ [BalanceCard] Error al obtener datos de cuenta:', {
        error: err instanceof Error ? err.message : err,
        statusCode: err?.statusCode,
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      });

      if (!isMountedRef.current) return;

      if (err?.statusCode === 429 || String(err?.message || '').includes('429') || String(err?.message || '').includes('Too Many')) {
        Toast.show({
          type: 'warning',
          text1: '⚠️ Demasiadas peticiones',
          text2: 'Espera 10 segundos e intenta de nuevo',
          position: 'bottom',
          visibilityTime: 4000,
        });
      }
      
    }
    finally {
      if (isMountedRef.current) {
        setIsLoadingFresh(false);
      }
    }
  };

  const fetchTransacciones = async () => {
    if (isFetching) {
      console.log('⏳ [BalanceCard] Fetch de transacciones ya en progreso, saltando...');
      return;
    }

    const now = Date.now();
    const minInterval = 1000; // 1 segundo para permitir refrescos más rápidos
    if (now - lastTxFetchRef.current < minInterval) {
      console.log('💳 [BalanceCard] Fetch de transacciones bloqueado: muy pronto desde el último');
      Toast.show({
        type: 'info',
        text1: 'Espera un momento',
        text2: 'Por favor espera antes de actualizar de nuevo',
        position: 'bottom',
        visibilityTime: 2000,
      });
      return;
    }
    lastTxFetchRef.current = now;
    
    console.log('📋 [BalanceCard] Iniciando fetch de transacciones:', { periodo });
    
    if (!isMountedRef.current) {
      console.log('⚠️ [BalanceCard] Componente desmontado, cancelando fetch de transacciones');
      return;
    }
    
    setIsFetching(true);
    
    // Crear nuevo AbortController para esta petición
    if (abortTxControllerRef.current) {
      abortTxControllerRef.current.abort();
    }
    abortTxControllerRef.current = new AbortController();
    const signal = abortTxControllerRef.current.signal;
    const requestId = ++txRequestIdRef.current;
    
    try {
      const token = await authService.getAccessToken();
      console.log('🔑 [BalanceCard] Token obtenido para transacciones:', token ? 'Existe' : 'No encontrado');
      
      const url = `${API_BASE_URL}/transacciones?rango=${periodo}`;
      console.log('🌐 [BalanceCard] Realizando petición de transacciones a:', url);

      const res = await apiRateLimiter.fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-store',
          'X-Skip-Cache': '1',
        },
        signal,
      });

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('💳 [BalanceCard] Fetch de transacciones cancelado');
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

      const transacciones = Array.isArray(data) ? data : (data?.data || []);

      console.log('📥 [BalanceCard] Respuesta de transacciones recibida:', {
        status: res.status,
        dataLength: transacciones?.length || 0,
        periodo
      });
      console.log('🔍 [BalanceCard] Procesando transacciones:', {
        totalTransacciones: transacciones.length,
        tipos: transacciones.reduce((acc: any, t: Transaccion) => {
          acc[t.tipo] = (acc[t.tipo] || 0) + 1;
          return acc;
        }, {})
      });

      const ingresoTotal: number = transacciones
        .filter((t: Transaccion): t is Transaccion => t.tipo === 'ingreso')
        .reduce((acc: number, t: Transaccion): number => acc + t.monto, 0);
      const egresoTotal: number = transacciones
        .filter((t: Transaccion): t is Transaccion => t.tipo === 'egreso')
        .reduce((acc: number, t: Transaccion): number => acc + t.monto, 0);

      console.log('💹 [BalanceCard] Totales calculados:', {
        ingresosAnteriores: ingresos,
        ingresosNuevos: ingresoTotal,
        egresosAnteriores: egresos,
        egresosNuevos: egresoTotal,
        diferencia: {
          ingresos: ingresoTotal - ingresos,
          egresos: egresoTotal - egresos
        }
      });

      // Solo actualizar estado si el componente está montado
      if (isMountedRef.current && !signal.aborted && requestId === txRequestIdRef.current) {
        setIngresos(ingresoTotal);
        setEgresos(egresoTotal);
        console.log('✅ [BalanceCard] Transacciones actualizadas exitosamente');
        
        // 💾 Actualizar cache con totales de transacciones
        try {
          const current = await AsyncStorage.getItem('balance_cache');
          const data = current ? JSON.parse(current) : {};
          await AsyncStorage.setItem('balance_cache', JSON.stringify({
            ...data,
            ingresos: ingresoTotal,
            egresos: egresoTotal,
            timestamp: Date.now()
          }));
        } catch {}
      }
    } catch (err: any) {
      // Ignorar errores de abort
      if (err.name === 'AbortError' || signal.aborted) {
        console.log('💳 [BalanceCard] Fetch de transacciones cancelado');
        return;
      }
      console.error('❌ [BalanceCard] Error al obtener transacciones:', {
        error: err instanceof Error ? err.message : err,
        statusCode: err?.statusCode,
        stack: err instanceof Error ? err.stack : undefined,
        periodo,
        timestamp: new Date().toISOString()
      });
      
      if (isMountedRef.current) {
        Toast.show({
          type: err?.statusCode === 429 ? 'warning' : 'error',
          text1: err?.statusCode === 429 ? '⚠️ Demasiadas peticiones' : 'Error al obtener transacciones',
          text2: err?.statusCode === 429 ? 'Espera 10 segundos e intenta de nuevo' : undefined,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsFetching(false);
      }
      console.log('🏁 [BalanceCard] Finalizando fetch de transacciones');
    }
  };

  const reloadAllData = async () => {
    console.log('🔄 [BalanceCard] Iniciando recarga completa de datos...');
    try {
      await Promise.all([
        fetchDatosCuenta(),
        fetchTransacciones()
      ]);
      console.log('✅ [BalanceCard] Recarga completa de datos exitosa');
    } catch (error) {
      console.error('❌ [BalanceCard] Error en recarga completa:', error);
    }
  };

  const handleCurrencyChange = async (nuevaMoneda: string) => {
    console.log('🔄 [BalanceCard] === INICIO CAMBIO DE MONEDA ===');
    console.log('🔄 [BalanceCard] Iniciando cambio de moneda:', {
      monedaActual,
      nuevaMoneda,
      saldoActual: saldo,
      ingresosActuales: ingresos,
      egresosActuales: egresos,
      periodo,
      timestamp: new Date().toISOString()
    });

    if (monedaActual === nuevaMoneda) {
      console.log('⚠️ [BalanceCard] La moneda solicitada es igual a la actual, cancelando cambio');
      return;
    }

    setIsChangingCurrency(true);
    
    try {
      console.log('🔄 [BalanceCard] Actualizando moneda local para sincronización visual');
      setMonedaActual(nuevaMoneda);
      
      console.log('🔄 [BalanceCard] Esperando procesamiento del backend...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('🔄 [BalanceCard] Recargando todos los datos...');
      await reloadAllData();
      
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        console.log(`🔍 [BalanceCard] Verificación ${retries + 1}/${maxRetries} de sincronización`);
        
        try {
          const token = await authService.getAccessToken();
          const response = await apiRateLimiter.fetch(`${API_BASE_URL}/cuenta/principal`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-store',
              'X-Skip-Cache': '1',
            },
          });

          const responseData = await response.json();
          const currentBackendCurrency = responseData.moneda;
          console.log('🔍 [BalanceCard] Moneda en backend:', currentBackendCurrency);
          
          if (currentBackendCurrency === nuevaMoneda) {
            console.log('✅ [BalanceCard] Sincronización confirmada');
            setMonedaActual(currentBackendCurrency); // Asegurar sincronización
            break;
          } else {
            console.log('⚠️ [BalanceCard] Moneda aún no sincronizada, reintentando...');
            retries++;
            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              await reloadAllData();
            }
          }
        } catch (verifyError) {
          console.error('❌ [BalanceCard] Error verificando sincronización:', verifyError);
          break;
        }
      }
      
      console.log('✅ [BalanceCard] Cambio de moneda completado exitosamente:', {
        monedaFinal: nuevaMoneda,
        timestamp: new Date().toISOString()
      });
      console.log('🔄 [BalanceCard] === FIN CAMBIO DE MONEDA EXITOSO ===');
      
      // 🆕 Notificar al Dashboard para que actualice todos los componentes
      if (onCurrencyChange) {
        console.log('📢 [BalanceCard] Notificando al Dashboard sobre cambio de moneda');
        onCurrencyChange();
      }
      
      Toast.show({
        type: 'success',
        text1: 'Moneda actualizada',
        text2: `Cuenta convertida a ${nuevaMoneda}`,
      });
    } catch (error) {
      console.error('❌ [BalanceCard] === ERROR EN CAMBIO DE MONEDA ===');
      console.error('❌ [BalanceCard] Error en el proceso de cambio de moneda:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        monedaInicial: monedaActual,
        monedaObjetivo: nuevaMoneda,
        timestamp: new Date().toISOString()
      });
      
      console.log('🔄 [BalanceCard] Revirtiendo cambio y recargando desde backend');
      await reloadAllData();
      
      Toast.show({
        type: 'error',
        text1: 'Error al cambiar moneda',
      });
    } finally {
      setIsChangingCurrency(false);
    }
  };

  const toggleFiltros = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMostrarFiltros(prev => !prev);
  };

  const handleSettingsClose = () => {
    setSettingsVisible(false);
    setRefreshPreferences(prev => prev + 1);
  };

  useEffect(() => {
    console.log('🔄 [BalanceCard] useEffect - reloadTrigger cambió:', reloadTrigger);
    fetchDatosCuenta();
  }, [reloadTrigger]);

  useEffect(() => {
    console.log('🔄 [BalanceCard] useEffect - reloadTrigger o periodo cambió:', { reloadTrigger, periodo });
    fetchTransacciones();
  }, [reloadTrigger, periodo]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow, borderColor: colors.border }]}>
      {/* Header con título y configuración */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Saldo total</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setSettingsVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Contenedor del saldo principal */}
      <View style={styles.balanceWrapper}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SmartNumber
            value={saldo}
            textStyle={[styles.balanceAmount, { color: colors.text }]}
            options={{
              context: 'card',
              currency: monedaActual,
              maxLength: 20
            }}
          />
          {isLoadingFresh && (
            <ActivityIndicator
              style={{ marginLeft: 8 }}
              size="small"
              color={colors.textSecondary}
            />
          )}
        </View>
      </View>

      {/* Contenedor de ingresos y egresos */}
      <View style={styles.statsContainer}>
        <View style={[styles.statItem, { shadowColor: colors.shadow, borderColor: colors.border }]}>
          <View style={styles.statIconWrapper}>
            <Ionicons name="arrow-up" size={14} color="#34C759" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ingreso</Text>
            <SmartNumber
              value={ingresos}
              textStyle={[styles.statValue, { color: colors.text }]}
              options={{
                context: 'list',
                currency: monedaActual,
                maxLength: 15
              }}
            />
          </View>
        </View>

        <View style={[styles.statItem, { shadowColor: colors.shadow, borderColor: colors.border }]}>
          <View style={styles.statIconWrapper}>
            <Ionicons name="arrow-down" size={14} color="#FF3B30" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Egreso</Text>
            <SmartNumber
              value={egresos}
              textStyle={[styles.statValue, { color: colors.text }]}
              options={{
                context: 'list',
                currency: monedaActual,
                maxLength: 15
              }}
            />
          </View>
        </View>
        {isFetching && (
          <View style={{ justifyContent: 'center', marginLeft: 8 }}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
          </View>
        )}
      </View>

      {/* Sección de filtros con animación */}
      <View style={styles.filterSection}>
        <TouchableOpacity 
          style={[styles.filterToggle, { shadowColor: colors.shadow, borderColor: colors.border }]} 
          onPress={toggleFiltros}
          activeOpacity={0.8}
        >
          <View style={styles.filterContent}>
            <View style={styles.filterIconWrapper}>
              <Ionicons name="funnel" size={16} color="#FF9500" />
            </View>
            <Text style={[styles.filterText, { color: colors.text }]}>{etiquetasFiltro[periodo]}</Text>
            <Ionicons 
              name={mostrarFiltros ? 'chevron-up' : 'chevron-down'} 
              size={16} 
              color={colors.textSecondary} 
            />
          </View>
        </TouchableOpacity>

        <Animated.View style={{
          overflow: 'hidden',
          height: animatedHeight,
          opacity: animatedOpacity,
        }}>
          {mostrarFiltros && (
            <View style={[styles.filterOptions, { backgroundColor: colors.cardSecondary, shadowColor: colors.shadow, borderColor: colors.border }]}>
              {Object.entries(etiquetasFiltro).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterOption,
                    periodo === key && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    console.log('📅 [BalanceCard] Cambiando período de filtro:', { from: periodo, to: key });
                    setPeriodo(key);
                    setMostrarFiltros(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterOptionText,
                    { color: colors.textSecondary },
                    periodo === key && styles.filterOptionTextActive
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      </View>

      <AccountSettingsModal visible={settingsVisible} onClose={handleSettingsClose} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    shadowOffset: {
      width: 3,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  settingsButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 1,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  balanceWrapper: {
    marginBottom: 10,
    paddingVertical: 2,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 32,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 1,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statIconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
    shadowColor: "#000",
    shadowOffset: {
      width: 1,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  statTextContainer: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginBottom: 0.5,
    letterSpacing: -0.1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  filterSection: {
    marginTop: 4,
  },
  filterToggle: {
    borderRadius: 12,
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    borderWidth: 1,
  },
  filterContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterIconWrapper: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255, 149, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  filterText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  filterOptions: {
    marginTop: 6,
    borderRadius: 12,
    padding: 4,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    borderWidth: 1,
  },
  filterOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 0.5,
  },
  filterOptionActive: {
    backgroundColor: "rgba(255, 149, 0, 0.15)",
    shadowColor: "rgba(255, 149, 0, 0.3)",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  filterOptionTextActive: {
    color: "#FF9500",
    fontWeight: "600",
  },
});

export default BalanceCard;
// commit