import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, EstadisticaSubcuenta, AnalyticsFilters } from '../../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../../services/authService';
import { useThemeColors } from '../../theme/useThemeColors';

interface SubcuentasChartProps {
  filters: AnalyticsFilters;
  refreshKey?: number;
}

const SubcuentasChart: React.FC<SubcuentasChartProps> = ({ filters, refreshKey = 0 }) => {
  const colors = useThemeColors();
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
      
      const token = await authService.getAccessToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await analyticsService.getEstadisticasPorSubcuenta(filters);
      setData(response);
    } catch (error: any) {
      if (error?.message?.includes('401')) {
        await authService.clearAll();
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
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando datos de subcuentas...</Text>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="wallet-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay subcuentas disponibles</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.button + '15' }]}>
          <Ionicons name="wallet" size={22} color={colors.button} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Estado de Subcuentas</Text>
      </View>
      
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
        >
          {data.map((item, index) => (
            <AnimatedSubcuentaItem 
              key={item.subcuenta.id}
              item={item}
              index={index}
              colors={colors}
              formatMoney={formatMoney}
              formatPercentage={formatPercentage}
            />
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
};

// Componente animado para cada subcuenta
const AnimatedSubcuentaItem: React.FC<{
  item: EstadisticaSubcuenta;
  index: number;
  colors: any;
  formatMoney: (amount: number, moneda: string) => string;
  formatPercentage: (value: number) => string;
}> = ({ item, index, colors, formatMoney, formatPercentage }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 120,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 7,
        delay: index * 120,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        delay: index * 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isPositive = item.crecimientoMensual >= 0;

  return (
    <Animated.View 
      style={[
        styles.item,
        { 
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          borderLeftColor: item.subcuenta.activa ? item.subcuenta.color : '#94a3b8',
        },
        !item.subcuenta.activa && { opacity: fadeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.7]
        }) }
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={styles.subcuentaInfo}>
          <View style={[styles.colorIndicator, { 
            backgroundColor: item.subcuenta.color + (item.subcuenta.activa ? '' : '60')
          }]}>
            <Ionicons name="wallet" size={18} color="white" />
          </View>
          <View style={styles.subcuentaText}>
            <Text style={[styles.subcuentaName, { color: colors.text }]}>
              {item.subcuenta.nombre}
            </Text>
            <View style={styles.statsRow}>
              <View style={[styles.statBadge, { backgroundColor: colors.button + '15' }]}>
                <Ionicons name="repeat" size={11} color={colors.button} />
                <Text style={[styles.subcuentaStats, { color: colors.button }]}>
                  {item.cantidadMovimientos} mov.
                </Text>
              </View>
              {!item.subcuenta.activa && (
                <View style={[styles.statBadge, { backgroundColor: '#94a3b8' + '20' }]}>
                  <Ionicons name="pause-circle" size={11} color="#94a3b8" />
                  <Text style={[styles.subcuentaStats, { color: '#94a3b8' }]}>
                    Inactiva
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={[styles.statusContainer, { backgroundColor: (isPositive ? '#10b981' : '#ef4444') + '15' }]}>
          <Ionicons 
            name={isPositive ? 'trending-up' : 'trending-down'} 
            size={18} 
            color={isPositive ? '#10b981' : '#ef4444'} 
          />
          <Text style={[styles.crecimiento, { color: isPositive ? '#10b981' : '#ef4444' }]}>
            {formatPercentage(item.crecimientoMensual)}
          </Text>
        </View>
      </View>

      <View style={[styles.balanceContainer, { backgroundColor: colors.cardSecondary }]}>
        <Text style={[styles.saldoLabel, { color: colors.textSecondary }]}>SALDO ACTUAL</Text>
        <Text style={[styles.saldoValue, { color: colors.text }]}>
          {formatMoney(item.saldoActual, item.subcuenta.moneda)}
        </Text>
      </View>

      <View style={styles.movementsContainer}>
        <View style={[styles.movementItem, { backgroundColor: '#10b981' + '10' }]}>
          <View style={[styles.movementIcon, { backgroundColor: '#10b981' }]}>
            <Ionicons name="arrow-down" size={14} color="white" />
          </View>
          <View style={{flex: 1}}>
            <Text style={[styles.movementLabel, { color: colors.textSecondary }]}>Ingresos</Text>
            <Text style={[styles.movementValue, { color: '#10b981' }]}>
              {formatMoney(item.totalIngresos, item.subcuenta.moneda)}
            </Text>
          </View>
        </View>

        <View style={[styles.movementItem, { backgroundColor: '#ef4444' + '10' }]}>
          <View style={[styles.movementIcon, { backgroundColor: '#ef4444' }]}>
            <Ionicons name="arrow-up" size={14} color="white" />
          </View>
          <View style={{flex: 1}}>
            <Text style={[styles.movementLabel, { color: colors.textSecondary }]}>Egresos</Text>
            <Text style={[styles.movementValue, { color: '#ef4444' }]}>
              {formatMoney(item.totalEgresos, item.subcuenta.moneda)}
            </Text>
          </View>
        </View>
      </View>

      {item.ultimoMovimiento && (
        <View style={[styles.lastMovementContainer, { backgroundColor: colors.inputBackground }]}>
          <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.ultimoMovimiento, { color: colors.textSecondary }]}>
            Último movimiento: {new Date(item.ultimoMovimiento).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    fontSize: 16,
  },
  itemsContainer: {
    maxHeight: 400,
  },
  item: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 5,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subcuentaText: {
    flex: 1,
  },
  subcuentaName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  subcuentaStats: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  crecimiento: {
    fontSize: 15,
    fontWeight: '700',
  },
  balanceContainer: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  saldoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  saldoValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  movementsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  movementItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
  },
  movementIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  movementLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  movementValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  lastMovementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    justifyContent: 'center',
  },
  ultimoMovimiento: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default SubcuentasChart;
