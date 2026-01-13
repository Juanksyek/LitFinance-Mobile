import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform, RefreshControl, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { analyticsService, ResumenFinanciero, AnalyticsFilters } from '../services/analyticsService';
import AnalyticsFiltersComponent from '../components/analytics/AnalyticsFilters';
import ResumenCard from '../components/analytics/ResumenCard';
import ChartSelector from '../components/analytics/ChartSelector';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/authService';
import { useThemeColors } from '../theme/useThemeColors';

interface AnalyticsScreenProps {
  navigation: any;
  route?: any;
}

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 700;
const isAndroid = Platform.OS === 'android';
const HEADER_H = isTablet ? 110 : (Platform.OS === 'ios' ? 96 : 84);

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ navigation, route }) => {
  // Si viene subcuentaId por params, filtrar solo esa subcuenta
  const subcuentaId = route?.params?.subcuentaId;
  const colors = useThemeColors();
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshAnim = useRef(new Animated.Value(0)).current;
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    rangoTiempo: 'mes',
    tipoTransaccion: 'ambos',
    ...(subcuentaId ? { subcuentas: [subcuentaId] } : {}),
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs para prevención de memory leaks
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<number>(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('🧹 [AnalyticsScreen] Limpiando componente...');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const rangoLabel = useMemo(() => {
    const map: Record<string, string> = {
      dia: 'Día',
      semana: 'Semana',
      mes: 'Mes',
      anio: 'Año',
      año: 'Año',
    };
    // @ts-ignore
    return map[filters.rangoTiempo] ?? 'Rango';
  }, [filters.rangoTiempo]);

  useEffect(() => {
    const checkAnalyticsAllowed = async () => {
      const planConfigService = await import('../services/planConfigService');
      const gate = await planConfigService.canPerform('grafica');
      if (gate.allowed === false) {
        const isConfigError = gate.message?.includes('Configuración de plan no disponible');
        setErrorMsg(
          isConfigError 
            ? 'No se pudo verificar tu plan. Por favor, contacta a soporte.'
            : gate.message || 'Las gráficas avanzadas están disponibles solo para usuarios premium'
        );
        setLoading(false);
        return;
      }
      loadResumenFinanciero();
    };
    checkAnalyticsAllowed();
  }, [filters]);

  // Recargar datos cuando vuelves a esta pantalla
  useFocusEffect(
    useCallback(() => {
      loadResumenFinanciero();
    }, [filters])
  );

  const loadResumenFinanciero = async (isPullRefresh = false) => {
    const now = Date.now();
    const minInterval = 2000; // Mínimo 2 segundos entre refreshes
    
    if (now - lastFetchRef.current < minInterval) {
      console.log('📊 [AnalyticsScreen] Carga bloqueada: muy pronto desde el último');
      if (isMountedRef.current) {
        setRefreshing(false);
      }
      return;
    }

    if (!isMountedRef.current) {
      console.log('⚠️ [AnalyticsScreen] Componente desmontado, cancelando carga');
      return;
    }

    // Cancelar fetch anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      lastFetchRef.current = now;
      if (isMountedRef.current) {
        setLoading(true);
        setErrorMsg(null);
      }

      const token = await authService.getAccessToken();
      if (!token) {
        if (isMountedRef.current && !signal.aborted) {
          setErrorMsg('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
          setResumen(null);
          setLoading(false);
        }
        return;
      }

      const data = await analyticsService.getResumenFinanciero(filters);

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('📊 [AnalyticsScreen] Carga cancelada');
        return;
      }

      // Solo actualizar estado si el componente está montado
      if (isMountedRef.current && !signal.aborted) {
        setResumen(data);
        setRefreshKey(prev => prev + 1); // Incrementar key para refrescar gráficas
      }
    } catch (error: any) {
      // Ignorar errores de abort
      if (error.name === 'AbortError' || signal.aborted) {
        console.log('📊 [AnalyticsScreen] Carga cancelada');
        return;
      }
      
      if (isMountedRef.current && !signal.aborted) {
        if (error?.response?.status === 401) {
          await authService.clearAll();
          setErrorMsg('Tu sesión ha expirado. Redirigiendo al login...');
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
          }
          refreshTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }
          }, 1600);
        } else {
          setErrorMsg('Error cargando analytics. Intenta de nuevo.');
        }
        console.error('Error loading resumen financiero:', error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const onRefresh = useCallback(() => {
    if (!isMountedRef.current || refreshing) {
      console.log('🔄 [AnalyticsScreen] Refresh bloqueado');
      return;
    }
    
    setRefreshing(true);
    Animated.timing(refreshAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      if (isMountedRef.current) {
        refreshAnim.setValue(0);
      }
    });
    loadResumenFinanciero(true);
  }, [filters, refreshing]);

  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
    // Si es subcuenta, forzar el filtro de subcuentaId
    if (subcuentaId) {
      setFilters({ ...newFilters, subcuentas: [subcuentaId] });
    } else {
      setFilters(newFilters);
    }
    setShowFilters(false);
  };

  const handleRetry = () => loadResumenFinanciero();

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }] }>
        <View style={[styles.headerWrap, { backgroundColor: colors.background }] }>
          <View style={[styles.headerBar, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }] }>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerIconBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }] }>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: colors.text } ]}>Analytics</Text>

            <TouchableOpacity onPress={() => setShowFilters(true)} style={[styles.headerChip, { backgroundColor: colors.cardSecondary, borderColor: colors.border }] }>
              <Ionicons name="funnel-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.headerChipText, { color: colors.text } ]}>{rangoLabel}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.headerHandle, { backgroundColor: colors.border }] } />
        </View>

        <View style={[styles.loadingContainer, { paddingTop: HEADER_H + 8 }] }>
          <ActivityIndicator size="small" color={colors.button} />
          <Text style={[styles.muted, { color: colors.textSecondary }] }>Cargando analytics…</Text>
          {errorMsg && <Text style={[styles.errorText, { color: colors.error }] }>{errorMsg}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }] }>
      <View style={[styles.headerWrap, { backgroundColor: colors.background }] }>
        <View style={[styles.headerBar, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }] }>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerIconBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }] }>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Ionicons name="flame" size={18} color={colors.button} style={{ marginRight: 6 }} />
            <Text style={[styles.headerTitle, { color: colors.text } ]}>Analytics</Text>
          </View>

          <TouchableOpacity onPress={() => setShowFilters(true)} style={[styles.headerChip, { backgroundColor: colors.cardSecondary, borderColor: colors.border }] } activeOpacity={0.9}>
            <Ionicons name="funnel-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.headerChipText, { color: colors.text } ]}>{rangoLabel}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.headerHandle, { backgroundColor: colors.border }] } />
      </View>

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }] }
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.button}
            colors={[colors.button]}
            progressViewOffset={-30}
            progressBackgroundColor={colors.cardSecondary}
            // Custom refresh indicator
            // Not all platforms support custom indicator, so we animate an icon above
          />
        }
      >
        {/* Animated refresh icon overlay */}
        {refreshing && (
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Animated.View style={{
              transform: [{ rotate: refreshAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
              }) }],
            }}>
              <Ionicons name="refresh" size={28} color={colors.button} />
            </Animated.View>
          </View>
        )}
        {!!errorMsg && (
          <View style={[styles.alertCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.warning }] }>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={[styles.alertText, { color: colors.error }] }>{errorMsg}</Text>
            {!errorMsg.includes('expirado') && (
              <TouchableOpacity onPress={handleRetry} style={[styles.retryGhost, { backgroundColor: colors.cardSecondary, borderColor: colors.border }] }>
                <Text style={[styles.retryGhostText, { color: colors.text, fontWeight: '800', fontSize: 12 }] }>Reintentar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {resumen && (
          <>
            <View style={styles.cardWrap}>
              <ResumenCard
                balance={{
                  balance: resumen.balance,
                  totalIngresos: {
                    monto: resumen.totalIngresado?.monto || resumen.ingresos || 0,
                    moneda: resumen.totalIngresado?.moneda || resumen.balance?.moneda || 'USD',
                    esPositivo: (resumen.totalIngresado?.monto || resumen.ingresos || 0) >= 0,
                  },
                  totalGastos: {
                    monto: resumen.totalGastado?.monto || resumen.gastos || 0,
                    moneda: resumen.totalGastado?.moneda || resumen.balance?.moneda || 'USD',
                    esPositivo: (resumen.totalGastado?.monto || resumen.gastos || 0) >= 0,
                  },
                }}
              />
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }] }>
              <ChartSelector filters={filters} refreshKey={refreshKey} />
            </View>
          </>
        )}
      </ScrollView>

      {showFilters && (
        <AnalyticsFiltersComponent
          filters={filters}
          onApply={handleFiltersChange}
          onClose={() => setShowFilters(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  headerWrap: {
    position: 'absolute',
    top: 45, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 10 : 6,
    zIndex: 100,
  },
  headerBar: {
    marginHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOffset: { width: 3, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerIconBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerChipText: { fontSize: 12, fontWeight: '800' },
  headerHandle: {
    alignSelf: 'center',
    marginTop: 8,
    width: 90,
    height: 6,
    borderRadius: 999,
  },

  container: {
    flex: 1,
    paddingTop: HEADER_H + 8,
    paddingHorizontal: 14,
  },

  cardWrap: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 12,
  },

  // Loading
  loadingContainer: { alignItems: 'center', gap: 8, flex: 1 },
  muted: { fontSize: 13 },

  // Alert sutil
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  alertText: { fontWeight: '700', flex: 1 },

  retryGhost: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  retryGhostText: {},

  // Error directo (pantalla de loading)
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
});

export default AnalyticsScreen;
