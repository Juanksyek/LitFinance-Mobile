import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, EstadisticaConcepto, AnalyticsFilters } from '../../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConceptosChartProps {
  filters: AnalyticsFilters;
}

const ConceptosChart: React.FC<ConceptosChartProps> = ({ filters }) => {
  const [data, setData] = useState<EstadisticaConcepto[]>([]);
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

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
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
    <View style={styles.container}>
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
                Promedio: {formatMoney(item.montoPromedio)}
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
                  {formatMoney(item.totalGasto)}
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
                  {formatMoney(item.totalIngreso)}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
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