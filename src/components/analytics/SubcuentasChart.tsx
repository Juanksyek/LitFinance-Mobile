import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, EstadisticaSubcuenta, AnalyticsFilters } from '../../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SubcuentasChartProps {
  filters: AnalyticsFilters;
  refreshKey?: number;
}

const SubcuentasChart: React.FC<SubcuentasChartProps> = ({ filters, refreshKey = 0 }) => {
  const [data, setData] = useState<EstadisticaSubcuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useState(new Animated.Value(0))[0];

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

  const loadData = async () => {
    try {
      setLoading(true);
      
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await analyticsService.getEstadisticasPorSubcuenta(filters);
      setData(response);
    } catch (error: any) {
      if (error?.message?.includes('401')) {
        await AsyncStorage.removeItem("authToken");
        console.error('Session expired in SubcuentasChart');
      }
      console.error('Error loading subcuentas data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Usar la moneda del filtro o del item si está disponible
  const getMoneda = (item?: any) => {
    return item?.subcuenta?.moneda || filters.monedaBase || 'USD';
  };
  const formatMoney = (amount: number, moneda: string) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
        <Text style={styles.loadingText}>Cargando datos de subcuentas...</Text>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="wallet-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyText}>No hay subcuentas disponibles</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.title}>Estado de Subcuentas</Text>
      
      <ScrollView style={styles.itemsContainer} showsVerticalScrollIndicator={false}>
        {data.map((item) => (
          <View key={item.subcuenta.id} style={[
            styles.item,
            !item.subcuenta.activa && styles.inactiveItem
          ]}>
            <View style={styles.itemHeader}>
              <View style={styles.subcuentaInfo}>
                <View style={[styles.colorIndicator, { backgroundColor: item.subcuenta.color }]} />
                <View style={styles.subcuentaText}>
                  <Text style={styles.subcuentaName}>{item.subcuenta.nombre}</Text>
                  <Text style={styles.subcuentaStats}>
                    {item.cantidadMovimientos} movimientos
                    {!item.subcuenta.activa && ' • Inactiva'}
                  </Text>
                </View>
              </View>
              <View style={styles.statusContainer}>
                <Text style={[
                  styles.crecimiento,
                  { color: item.crecimientoMensual >= 0 ? '#10b981' : '#ef4444' }
                ]}>
                  {formatPercentage(item.crecimientoMensual)}
                </Text>
                <Ionicons 
                  name={item.crecimientoMensual >= 0 ? 'trending-up' : 'trending-down'} 
                  size={16} 
                  color={item.crecimientoMensual >= 0 ? '#10b981' : '#ef4444'} 
                />
              </View>
            </View>

            <View style={styles.balanceContainer}>
              <Text style={styles.saldoLabel}>Saldo actual</Text>
              <Text style={styles.saldoValue}>
                {formatMoney(item.saldoActual, item.subcuenta.moneda)}
              </Text>
            </View>

            <View style={styles.movementsContainer}>
              <View style={styles.movementItem}>
                <View style={styles.movementIcon}>
                  <Ionicons name="arrow-down" size={12} color="#10b981" />
                </View>
                <Text style={styles.movementLabel}>Ingresos</Text>
                <Text style={[styles.movementValue, { color: '#10b981' }]}>
                  {formatMoney(item.totalIngresos, item.subcuenta.moneda)}
                </Text>
              </View>

              <View style={styles.movementItem}>
                <View style={styles.movementIcon}>
                  <Ionicons name="arrow-up" size={12} color="#ef4444" />
                </View>
                <Text style={styles.movementLabel}>Egresos</Text>
                <Text style={[styles.movementValue, { color: '#ef4444' }]}>
                  {formatMoney(item.totalEgresos, item.subcuenta.moneda)}
                </Text>
              </View>
            </View>

            {item.ultimoMovimiento && (
              <Text style={styles.ultimoMovimiento}>
                Último movimiento: {new Date(item.ultimoMovimiento).toLocaleDateString()}
              </Text>
            )}
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
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  inactiveItem: {
    opacity: 0.6,
    borderLeftColor: '#94a3b8',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subcuentaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  subcuentaText: {
    flex: 1,
  },
  subcuentaName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  subcuentaStats: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crecimiento: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  saldoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  saldoValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  movementsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  movementItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  movementIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  movementLabel: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  movementValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  ultimoMovimiento: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default SubcuentasChart;
