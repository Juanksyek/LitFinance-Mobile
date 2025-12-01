import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { analyticsService, ResumenFinanciero, AnalyticsFilters } from '../services/analyticsService';
import AnalyticsFiltersComponent from '../components/analytics/AnalyticsFilters';
import ResumenCard from '../components/analytics/ResumenCard';
import ChartSelector from '../components/analytics/ChartSelector';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../theme/useThemeColors';

interface AnalyticsScreenProps {
  navigation: any;
}

const HEADER_H = Platform.OS === 'ios' ? 96 : 84;

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ navigation }) => {
  const colors = useThemeColors();
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    rangoTiempo: 'mes',
    tipoTransaccion: 'ambos',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    loadResumenFinanciero();
  }, [filters]);

  // Recargar datos cuando vuelves a esta pantalla
  useFocusEffect(
    useCallback(() => {
      loadResumenFinanciero();
    }, [filters])
  );

  const loadResumenFinanciero = async (isPullRefresh = false) => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setErrorMsg('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        setResumen(null);
        setLoading(false);
        return;
      }

      const data = await analyticsService.getResumenFinanciero(filters);
      setResumen(data);
      setRefreshKey(prev => prev + 1); // Incrementar key para refrescar gráficas
    } catch (error: any) {
      if (error?.response?.status === 401) {
        await AsyncStorage.removeItem('authToken');
        setErrorMsg('Tu sesión ha expirado. Redirigiendo al login...');
        setTimeout(() => {
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }, 1600);
      } else {
        setErrorMsg('Error cargando analytics. Intenta de nuevo.');
      }
      console.error('Error loading resumen financiero:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    loadResumenFinanciero(true);
  }, [filters]);

  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
    setFilters(newFilters);
    setShowFilters(false);
  };

  const handleRetry = () => loadResumenFinanciero();

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.headerWrap}>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn}>
              <Ionicons name="chevron-back" size={20} color="#0f172a" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Analytics</Text>

            <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.headerChip}>
              <Ionicons name="funnel-outline" size={14} color="#0f172a" />
              <Text style={styles.headerChipText}>{rangoLabel}</Text>
              <Ionicons name="chevron-down" size={12} color="#0f172a" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerHandle} />
        </View>

        <View style={[styles.loadingContainer, { paddingTop: HEADER_H + 8 }]}>
          <ActivityIndicator size="small" />
          <Text style={styles.muted}>Cargando analytics…</Text>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.headerWrap}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn}>
            <Ionicons name="chevron-back" size={20} color="#0f172a" />
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Ionicons name="flame" size={18} color="#fb923c" style={{ marginRight: 6 }} />
            <Text style={styles.headerTitle}>Analytics</Text>
          </View>

          <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.headerChip} activeOpacity={0.9}>
            <Ionicons name="funnel-outline" size={14} color="#0f172a" />
            <Text style={styles.headerChipText}>{rangoLabel}</Text>
            <Ionicons name="chevron-down" size={12} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerHandle} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
            colors={['#6366f1']}
          />
        }
      >
        {!!errorMsg && (
          <View style={styles.alertCard}>
            <Ionicons name="warning-outline" size={18} color="#b45309" />
            <Text style={styles.alertText}>{errorMsg}</Text>
            {!errorMsg.includes('expirado') && (
              <TouchableOpacity onPress={handleRetry} style={styles.retryGhost}>
                <Text style={styles.retryGhostText}>Reintentar</Text>
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
                    monto: resumen.ingresos,
                    moneda: '$',
                    esPositivo: resumen.ingresos >= 0,
                  },
                  totalGastos: {
                    monto: resumen.gastos,
                    moneda: '$',
                    esPositivo: resumen.gastos >= 0,
                  },
                }}
              />
            </View>

            <View style={styles.card}>
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
    backgroundColor: '#f6f7fb',
  },

  headerWrap: {
    position: 'absolute',
    top: 45, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 10 : 6,
    backgroundColor: '#f6f7fb',
    zIndex: 100,
  },
  headerBar: {
    marginHorizontal: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 3, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerIconBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerChipText: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  headerHandle: {
    alignSelf: 'center',
    marginTop: 8,
    width: 90,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8ecf2',
    padding: 12,
    shadowColor: '#111827',
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 12,
  },

  // Loading
  loadingContainer: { alignItems: 'center', gap: 8, flex: 1 },
  muted: { fontSize: 13, color: '#64748b' },

  // Alert sutil
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  alertText: { color: '#7c2d12', fontWeight: '700', flex: 1 },

  retryGhost: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  retryGhostText: { color: '#0f172a', fontWeight: '800', fontSize: 12 },

  // Error directo (pantalla de loading)
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
});

export default AnalyticsScreen;
