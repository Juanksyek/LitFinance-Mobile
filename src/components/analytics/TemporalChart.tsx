import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, AnalisisTemporal, AnalyticsFilters } from '../../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../../theme/useThemeColors';

interface TemporalChartProps {
  filters: AnalyticsFilters;
  refreshKey?: number;
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 80;

const TemporalChart: React.FC<TemporalChartProps> = ({ filters, refreshKey = 0 }) => {
  const colors = useThemeColors();
  const [data, setData] = useState<AnalisisTemporal | null>(null);
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
    if (!loading && data) {
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
      
      const response = await analyticsService.getAnalisisTemporal(filters);
      setData(response);
    } catch (error: any) {
      if (error?.message?.includes('401')) {
        await AsyncStorage.removeItem("authToken");
        console.error('Session expired in TemporalChart');
      }
      console.error('Error loading temporal data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Usar la moneda del filtro si está disponible
  const getMoneda = () => filters.monedaBase || userCurrency;
  const formatMoney = (amount: number, moneda: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'ascendente':
        return 'trending-up';
      case 'descendente':
        return 'trending-down';
      default:
        return 'remove';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'ascendente':
        return '#10b981';
      case 'descendente':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando análisis temporal...</Text>
      </View>
    );
  }

  if (!data || data.datos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trending-up-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay datos temporales disponibles</Text>
      </View>
    );
  }

  const maxValue = Math.max(
    ...data.datos.map(item => Math.max(item.ingresos, Math.abs(item.gastos)))
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={[styles.title, { color: colors.text }]}>Análisis Temporal</Text>
      
      <View style={[styles.trendsContainer, { backgroundColor: colors.card }]}>
        <View style={styles.trendItem}>
          <Ionicons 
            name={getTrendIcon(data.tendencias.ingresosTendencia) as any} 
            size={16} 
            color={getTrendColor(data.tendencias.ingresosTendencia)} 
          />
          <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Ingresos</Text>
          <Text style={[styles.trendValue, { color: getTrendColor(data.tendencias.ingresosTendencia) }]}>
            {data.tendencias.ingresosTendencia}
          </Text>
        </View>

        <View style={styles.trendItem}>
          <Ionicons 
            name={getTrendIcon(data.tendencias.gastosTendencia) as any} 
            size={16} 
            color={getTrendColor(data.tendencias.gastosTendencia)} 
          />
          <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Gastos</Text>
          <Text style={[styles.trendValue, { color: getTrendColor(data.tendencias.gastosTendencia) }]}>
            {data.tendencias.gastosTendencia}
          </Text>
        </View>

        <View style={styles.trendItem}>
          <Ionicons 
            name={getTrendIcon(data.tendencias.balanceTendencia) as any} 
            size={16} 
            color={getTrendColor(data.tendencias.balanceTendencia)} 
          />
          <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Balance</Text>
          <Text style={[styles.trendValue, { color: getTrendColor(data.tendencias.balanceTendencia) }]}>
            {data.tendencias.balanceTendencia}
          </Text>
        </View>
      </View>

      <View style={[styles.averagesContainer, { backgroundColor: colors.inputBackground }]}>
        <Text style={[styles.averagesTitle, { color: colors.text }]}>Promedios del período</Text>
        <View style={styles.averageItems}>
          <View style={styles.averageItem}>
            <Text style={[styles.averageLabel, { color: colors.textSecondary }]}>Ingresos</Text>
            <Text style={[styles.averageValue, { color: '#10b981' }]}>
              {formatMoney(data.promedios.ingresoPromedio, getMoneda())}
            </Text>
          </View>
          <View style={styles.averageItem}>
            <Text style={[styles.averageLabel, { color: colors.textSecondary }]}>Gastos</Text>
            <Text style={[styles.averageValue, { color: '#ef4444' }]}>
              {formatMoney(data.promedios.gastoPromedio, getMoneda())}
            </Text>
          </View>
          <View style={styles.averageItem}>
            <Text style={[styles.averageLabel, { color: colors.textSecondary }]}>Balance</Text>
            <Text style={[styles.averageValue, { color: '#6366f1' }]}>
              {formatMoney(data.promedios.balancePromedio, getMoneda())}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.chartScrollContainer}
      >
        <View style={[styles.chartContainer, { width: Math.max(chartWidth, data.datos.length * 60) }]}>
          {data.datos.map((item, index) => {
            const incomeHeight = (item.ingresos / maxValue) * 100;
            const expenseHeight = (Math.abs(item.gastos) / maxValue) * 100;
            
            return (
              <View key={index} style={styles.chartItem}>
                <View style={styles.barsContainer}>
                  <View 
                    style={[styles.incomeBar, { height: incomeHeight }]}
                  />
                  <View 
                    style={[styles.expenseBar, { height: expenseHeight }]}
                  />
                </View>
                <Text style={[styles.chartDate, { color: colors.textSecondary }]}>{formatDate(item.fecha)}</Text>
                <Text style={[styles.chartMovements, { color: colors.textSecondary }]}>{item.cantidadMovimientos}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#10b981' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Ingresos</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Gastos</Text>
        </View>
      </View>
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
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  trendsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderRadius: 12,
    padding: 12,
  },
  trendItem: {
    alignItems: 'center',
    flex: 1,
  },
  trendLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  averagesContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  averagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  averageItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  averageItem: {
    alignItems: 'center',
    flex: 1,
  },
  averageLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  averageValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartScrollContainer: {
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    paddingHorizontal: 8,
  },
  chartItem: {
    alignItems: 'center',
    marginHorizontal: 4,
    flex: 1,
    minWidth: 50,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 2,
  },
  incomeBar: {
    width: 8,
    backgroundColor: '#10b981',
    borderRadius: 4,
    minHeight: 2,
  },
  expenseBar: {
    width: 8,
    backgroundColor: '#ef4444',
    borderRadius: 4,
    minHeight: 2,
  },
  chartDate: {
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
  chartMovements: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
  },
});

export default TemporalChart;
// commit