import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, AnalisisTemporal, AnalyticsFilters } from '../../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TemporalChartProps {
  filters: AnalyticsFilters;
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 80;

const TemporalChart: React.FC<TemporalChartProps> = ({ filters }) => {
  const [data, setData] = useState<AnalisisTemporal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [filters]);

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

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
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
        <Text style={styles.loadingText}>Cargando análisis temporal...</Text>
      </View>
    );
  }

  if (!data || data.datos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trending-up-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyText}>No hay datos temporales disponibles</Text>
      </View>
    );
  }

  const maxValue = Math.max(
    ...data.datos.map(item => Math.max(item.ingresos, Math.abs(item.gastos)))
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Análisis Temporal</Text>
      
      <View style={styles.trendsContainer}>
        <View style={styles.trendItem}>
          <Ionicons 
            name={getTrendIcon(data.tendencias.ingresosTendencia) as any} 
            size={16} 
            color={getTrendColor(data.tendencias.ingresosTendencia)} 
          />
          <Text style={styles.trendLabel}>Ingresos</Text>
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
          <Text style={styles.trendLabel}>Gastos</Text>
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
          <Text style={styles.trendLabel}>Balance</Text>
          <Text style={[styles.trendValue, { color: getTrendColor(data.tendencias.balanceTendencia) }]}>
            {data.tendencias.balanceTendencia}
          </Text>
        </View>
      </View>

      <View style={styles.averagesContainer}>
        <Text style={styles.averagesTitle}>Promedios del período</Text>
        <View style={styles.averageItems}>
          <View style={styles.averageItem}>
            <Text style={styles.averageLabel}>Ingresos</Text>
            <Text style={[styles.averageValue, { color: '#10b981' }]}>
              {formatMoney(data.promedios.ingresoPromedio)}
            </Text>
          </View>
          <View style={styles.averageItem}>
            <Text style={styles.averageLabel}>Gastos</Text>
            <Text style={[styles.averageValue, { color: '#ef4444' }]}>
              {formatMoney(data.promedios.gastoPromedio)}
            </Text>
          </View>
          <View style={styles.averageItem}>
            <Text style={styles.averageLabel}>Balance</Text>
            <Text style={[styles.averageValue, { color: '#6366f1' }]}>
              {formatMoney(data.promedios.balancePromedio)}
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
                <Text style={styles.chartDate}>{formatDate(item.fecha)}</Text>
                <Text style={styles.chartMovements}>{item.cantidadMovimientos}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Ingresos</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Gastos</Text>
        </View>
      </View>
    </View>
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
  trendsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  trendItem: {
    alignItems: 'center',
    flex: 1,
  },
  trendLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  averagesContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  averagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
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
    color: '#64748b',
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
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  chartMovements: {
    fontSize: 9,
    color: '#94a3b8',
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
    color: '#64748b',
  },
});

export default TemporalChart;
