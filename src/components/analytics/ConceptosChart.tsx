import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, EstadisticaConcepto, AnalyticsFilters } from '../../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../../services/authService';
import { useThemeColors } from '../../theme/useThemeColors';

interface ConceptosChartProps {
  filters: AnalyticsFilters;
  refreshKey?: number;
}

const ConceptosChart: React.FC<ConceptosChartProps> = ({ filters, refreshKey = 0 }) => {
  const colors = useThemeColors();
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
      
      const token = await authService.getAccessToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await analyticsService.getEstadisticasPorConcepto(filters);
      setData(response);
    } catch (error: any) {
      if (error?.message?.includes('401')) {
        await authService.clearAll();
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
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando datos por concepto...</Text>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="pie-chart-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay datos disponibles</Text>
      </View>
    );
  }

  const maxAmount = getMaxAmount();

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.button + '15' }]}>
          <Ionicons name="pie-chart" size={22} color={colors.button} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Gastos e Ingresos por Concepto</Text>
      </View>
      
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
        >
          {data.map((item, index) => (
            <AnimatedConceptItem 
              key={item.concepto.id} 
              item={item} 
              maxAmount={maxAmount}
              index={index}
              colors={colors}
              formatMoney={formatMoney}
              getMoneda={getMoneda}
            />
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
};

// Componente animado para cada item individual
const AnimatedConceptItem: React.FC<{
  item: EstadisticaConcepto;
  maxAmount: number;
  index: number;
  colors: any;
  formatMoney: (amount: number, moneda: string) => string;
  getMoneda: (item?: any) => string;
}> = ({ item, maxAmount, index, colors, formatMoney, getMoneda }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const barWidthGasto = useRef(new Animated.Value(0)).current;
  const barWidthIngreso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animación de entrada con delay basado en el índice
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Después de la entrada, animar las barras
      Animated.parallel([
        Animated.timing(barWidthGasto, {
          toValue: (item.totalGasto / maxAmount) * 100,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(barWidthIngreso, {
          toValue: (item.totalIngreso / maxAmount) * 100,
          duration: 800,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }, []);

  return (
    <Animated.View 
      style={[
        styles.item, 
        { 
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={styles.conceptInfo}>
          <View style={[styles.iconContainer, { backgroundColor: item.concepto.color + '20' }]}>
            <Text style={styles.icon}>{item.concepto.icono}</Text>
          </View>
          <View style={styles.conceptText}>
            <Text style={[styles.conceptName, { color: colors.text }]}>{item.concepto.nombre}</Text>
            <View style={styles.statsRow}>
              <View style={[styles.badge, { backgroundColor: colors.button + '15' }]}>
                <Ionicons name="analytics" size={12} color={colors.button} />
                <Text style={[styles.conceptStats, { color: colors.button }]}>
                  {item.cantidadMovimientos} mov.
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="pie-chart" size={12} color={colors.success} />
                <Text style={[styles.conceptStats, { color: colors.success }]}>
                  {item.participacionPorcentual.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={[styles.promedioContainer, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.promedioLabel, { color: colors.textSecondary }]}>Promedio</Text>
          <Text style={[styles.promedio, { color: colors.text }]}>
            {formatMoney(item.montoPromedio, getMoneda(item))}
          </Text>
        </View>
      </View>

      <View style={styles.amounts}>
        <View style={styles.amountRow}>
          <View style={styles.labelContainer}>
            <Ionicons name="arrow-up-circle" size={16} color="#ef4444" />
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Gastos</Text>
          </View>
          <View style={[styles.barContainer, { backgroundColor: colors.inputBackground }]}>
            <Animated.View 
              style={[
                styles.bar, 
                styles.expenseBar,
                { 
                  width: barWidthGasto.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  })
                }
              ]} 
            />
          </View>
          <Text style={[styles.amountValue, { color: '#ef4444' }]}>
            {formatMoney(item.totalGasto, getMoneda(item))}
          </Text>
        </View>

        <View style={styles.amountRow}>
          <View style={styles.labelContainer}>
            <Ionicons name="arrow-down-circle" size={16} color="#10b981" />
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Ingresos</Text>
          </View>
          <View style={[styles.barContainer, { backgroundColor: colors.inputBackground }]}>
            <Animated.View 
              style={[
                styles.bar, 
                styles.incomeBar,
                { 
                  width: barWidthIngreso.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  })
                }
              ]} 
            />
          </View>
          <Text style={[styles.amountValue, { color: '#10b981' }]}>
            {formatMoney(item.totalIngreso, getMoneda(item))}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  icon: {
    fontSize: 24,
  },
  conceptText: {
    flex: 1,
  },
  conceptName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  conceptStats: {
    fontSize: 11,
    fontWeight: '600',
  },
  promedioContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  promedioLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  promedio: {
    fontSize: 13,
    fontWeight: '700',
  },
  amounts: {
    gap: 12,
    marginTop: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  barContainer: {
    flex: 1,
    height: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 10,
    minWidth: 4,
  },
  expenseBar: {
    backgroundColor: '#ef4444',
  },
  incomeBar: {
    backgroundColor: '#10b981',
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '700',
    width: 90,
    textAlign: 'right',
  },
});

export default ConceptosChart;
