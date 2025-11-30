import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, EstadisticaConcepto, AnalyticsFilters } from '../../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConceptosChartProps {
  filters: AnalyticsFilters;
  refreshKey?: number;
}

const ConceptosChart: React.FC<ConceptosChartProps> = ({ filters, refreshKey = 0 }) => {
  const [data, setData] = useState<EstadisticaConcepto[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCurrency, setUserCurrency] = useState<string>('MXN');
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadUserCurrency();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters, refreshKey]);

  useEffect(() => {
    if (!loading && data.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [loading, data]);

  const loadUserCurrency = async () => {
    try {
      const stored = await AsyncStorage.getItem('monedaPreferencia');
      if (stored) {
        let code = stored;
        try {
          const parsed = JSON.parse(stored);
          if (typeof parsed === 'string') code = parsed;
          else if (parsed?.codigo) code = parsed.codigo;
        } catch {}
        setUserCurrency(code || 'MXN');
      }
    } catch {
      setUserCurrency('MXN');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await analyticsService.getEstadisticasPorConcepto(filters);
      setData(response);
    } catch (error: any) {
      if (error?.message?.includes('401')) {
        await AsyncStorage.removeItem("authToken");
        console.error('Session expired in ConceptosChart');
      }
      console.error('Error loading conceptos data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Usar la moneda del filtro o del item si está disponible
  const getMoneda = (item?: any) => {
    // Si el item tiene moneda y es válida, úsala; si no, usa la del filtro; si no, la del usuario
    const moneda = item?.moneda || filters.monedaBase || userCurrency;
    // Si la moneda es undefined, null o string vacía, usar la del usuario
    if (!moneda || typeof moneda !== 'string' || moneda.trim() === '') return userCurrency;
    return moneda;
  };

  const formatMoney = (amount: number, moneda: string) => {
    // Si la moneda es inválida, usar la del usuario
    const safeMoneda = (!moneda || typeof moneda !== 'string' || moneda.trim() === '') ? userCurrency : moneda;
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: safeMoneda,
        minimumFractionDigits: 0,
      }).format(amount);
    } catch (e) {
      // Si Intl falla, mostrar solo el número y la moneda
      return `${amount} ${safeMoneda}`;
    }
  };

  const getMaxAmount = () => {
    return Math.max(...data.map(item => Math.max(item.totalGasto, item.totalIngreso)));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
        <Text style={styles.loadingText}>Cargando datos por concepto...</Text>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="pie-chart-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyText}>No hay datos disponibles</Text>
      </View>
    );
  }

  const maxAmount = getMaxAmount();

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>Gastos e Ingresos por Concepto</Text>
      
      <ScrollView style={styles.itemsContainer} showsVerticalScrollIndicator={false}>
        {data.map((item, index) => (
          <View key={item.concepto.id} style={styles.item}>
            <View style={styles.itemHeader}>
              <View style={styles.conceptInfo}>
                <View style={[styles.iconContainer, { backgroundColor: item.concepto.color }]}>
                  <Text style={styles.icon}>{item.concepto.icono}</Text>
                </View>
                <View style={styles.conceptText}>
                  <Text style={styles.conceptName}>{item.concepto.nombre}</Text>
                  <Text style={styles.conceptStats}>
                    {item.cantidadMovimientos} movimientos • {item.participacionPorcentual.toFixed(1)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.promedio}>
                Promedio: {formatMoney(item.montoPromedio, getMoneda(item))}
              </Text>
            </View>

            <View style={styles.amounts}>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Gastos</Text>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      styles.expenseBar,
                      { width: `${(item.totalGasto / maxAmount) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={[styles.amountValue, { color: '#ef4444' }]}>
                  {formatMoney(item.totalGasto, getMoneda(item))}
                </Text>
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Ingresos</Text>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      styles.incomeBar,
                      { width: `${(item.totalIngreso / maxAmount) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={[styles.amountValue, { color: '#10b981' }]}>
                  {formatMoney(item.totalIngreso, getMoneda(item))}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  itemsContainer: {
    maxHeight: 400,
  },
  item: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  conceptInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  conceptText: {
    flex: 1,
  },
  conceptName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  conceptStats: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  promedio: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  amounts: {
    gap: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountLabel: {
    fontSize: 12,
    color: '#64748b',
    width: 60,
  },
  barContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
  },
  bar: {
    height: '100%',
    borderRadius: 3,
    minWidth: 2,
  },
  expenseBar: {
    backgroundColor: '#ef4444',
  },
  incomeBar: {
    backgroundColor: '#10b981',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
    width: 80,
    textAlign: 'right',
  },
});

export default ConceptosChart;
