import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/useThemeColors';

interface MetricasPeriodo {
  ingresos: number;
  gastos: number;
  balance: number;
  movimientos: number;
}

interface Cambio {
  absoluto: number;
  porcentual: number;
}

interface ComparacionPeriodos {
  periodoActual: MetricasPeriodo & {
    fechaInicio: string;
    fechaFin: string;
  };
  periodoAnterior: MetricasPeriodo & {
    fechaInicio: string;
    fechaFin: string;
  };
  cambios: {
    ingresos: Cambio;
    gastos: Cambio;
    balance: Cambio;
    movimientos: Cambio;
  };
}

interface TotalesRapidos {
  totalIngresado: number;
  totalGastado: number;
  balance: number;
  totalSubcuentas: number;
  totalMovimientos: number;
  moneda: string;
}

interface ResumenCardProps {
  balance?: {
    balance: { monto: number; moneda: string; esPositivo: boolean };
    totalIngresos: { monto: number; moneda: string; esPositivo: boolean };
    totalGastos: { monto: number; moneda: string; esPositivo: boolean };
  };
  period?: string;
  comparacionPeriodos?: ComparacionPeriodos;
  totalesRapidos?: TotalesRapidos;
  showComparison?: boolean;
  isLoading?: boolean;
  error?: string;
}

const ResumenCard: React.FC<ResumenCardProps> = ({
  balance = {
    balance: { monto: 0, moneda: 'USD', esPositivo: true },
    totalIngresos: { monto: 0, moneda: 'USD', esPositivo: true },
    totalGastos: { monto: 0, moneda: 'USD', esPositivo: true },
  },
  period = 'Este mes',
  comparacionPeriodos,
  totalesRapidos,
  showComparison = false,
  isLoading = false,
  error
}) => {
  const colors = useThemeColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!isLoading && !error) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading, error]);

  const formatAmount = (amount?: { monto?: number; moneda?: string; esPositivo?: boolean }): string => {
    if (!amount || typeof amount.monto !== 'number' || !amount.moneda) {
      return 'N/A';
    }
    return `${amount.esPositivo ? '' : '-'}${amount.monto.toLocaleString()} ${amount.moneda}`;
  };

  const formatSimpleAmount = (amount: number, currency: string = 'USD'): string => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  const formatPercentage = (percentage: number): string => {
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  const getPercentageColor = (percentage: number): string => {
    if (percentage > 0) return '#4CAF50';
    if (percentage < 0) return '#EF4444';
    return '#6B7280';
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando resumen...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card }]}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  // Always provide valid objects for ingresos/gastos/balance
  const ingresos = totalesRapidos && typeof totalesRapidos.totalIngresado === 'number'
    ? { monto: totalesRapidos.totalIngresado, moneda: totalesRapidos.moneda || 'USD', esPositivo: totalesRapidos.totalIngresado >= 0 }
    : (balance?.totalIngresos || { monto: 0, moneda: 'USD', esPositivo: true });
  const gastos = totalesRapidos && typeof totalesRapidos.totalGastado === 'number'
    ? { monto: totalesRapidos.totalGastado, moneda: totalesRapidos.moneda || 'USD', esPositivo: totalesRapidos.totalGastado >= 0 }
    : (balance?.totalGastos || { monto: 0, moneda: 'USD', esPositivo: false });
  const balanceData = totalesRapidos && typeof totalesRapidos.balance === 'number'
    ? { monto: totalesRapidos.balance, moneda: totalesRapidos.moneda || 'USD', esPositivo: totalesRapidos.balance >= 0 }
    : (balance?.balance || { monto: 0, moneda: 'USD', esPositivo: true });

  return (
    <Animated.View style={[
      styles.container,
      { 
        backgroundColor: colors.card,
        shadowColor: colors.shadow,
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }, { translateY: slideAnim }]
      }
    ]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Resumen Financiero</Text>
          <Text style={[styles.period, { color: colors.textSecondary }]}>{period}</Text>
        </View>
        <View style={[styles.iconBadge, { backgroundColor: colors.button + '15' }]}>
          <Ionicons name="stats-chart" size={24} color={colors.button} />
        </View>
      </View>
      
      <View style={styles.metricsContainer}>
        <View style={[styles.metricItem, { backgroundColor: colors.cardSecondary, shadowColor: colors.shadow }]}>
          <View style={[styles.metricIconContainer, { backgroundColor: balanceData?.esPositivo ? '#4CAF5020' : '#EF444420' }]}>
            <Ionicons 
              name={balanceData?.esPositivo ? "trending-up" : "trending-down"} 
              size={20} 
              color={balanceData?.esPositivo ? '#4CAF50' : '#EF4444'} 
            />
          </View>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Balance</Text>
          <Text style={[styles.metricValue, { color: balanceData?.esPositivo ? '#4CAF50' : '#EF4444' }]}>
            {formatAmount(balanceData)}
          </Text>
          {showComparison && comparacionPeriodos && (
            <Text style={[styles.comparisonText, { color: getPercentageColor(comparacionPeriodos.cambios.balance.porcentual) }]}>
              {formatPercentage(comparacionPeriodos.cambios.balance.porcentual)}
            </Text>
          )}
        </View>
        
        <View style={[styles.metricItem, { backgroundColor: colors.cardSecondary, shadowColor: colors.shadow }]}>
          <View style={[styles.metricIconContainer, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="arrow-down-circle" size={20} color="#10B981" />
          </View>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Ingresos</Text>
          <Text style={[styles.metricValue, styles.incomeText]}>
            {formatAmount(ingresos)}
          </Text>
          {showComparison && comparacionPeriodos && (
            <Text style={[styles.comparisonText, { color: getPercentageColor(comparacionPeriodos.cambios.ingresos.porcentual) }]}>
              {formatPercentage(comparacionPeriodos.cambios.ingresos.porcentual)}
            </Text>
          )}
        </View>
        
        <View style={[styles.metricItem, { backgroundColor: colors.cardSecondary, shadowColor: colors.shadow }]}>
          <View style={[styles.metricIconContainer, { backgroundColor: '#EF444420' }]}>
            <Ionicons name="arrow-up-circle" size={20} color="#EF4444" />
          </View>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Gastos</Text>
          <Text style={[styles.metricValue, styles.expenseText]}>
            {formatAmount(gastos)}
          </Text>
          {showComparison && comparacionPeriodos && (
            <Text style={[styles.comparisonText, { color: getPercentageColor(comparacionPeriodos.cambios.gastos.porcentual) }]}>
              {formatPercentage(comparacionPeriodos.cambios.gastos.porcentual)}
            </Text>
          )}
        </View>
      </View>

      {totalesRapidos && (
        <View style={[styles.additionalMetrics, { borderTopColor: colors.border }]}>
          <View style={styles.additionalMetricItem}>
            <Text style={[styles.additionalMetricLabel, { color: colors.textSecondary }]}>Subcuentas</Text>
            <Text style={[styles.additionalMetricValue, { color: colors.text }]}>
              {formatSimpleAmount(totalesRapidos.totalSubcuentas, totalesRapidos.moneda)}
            </Text>
          </View>
          <View style={styles.additionalMetricItem}>
            <Text style={[styles.additionalMetricLabel, { color: colors.textSecondary }]}>Movimientos</Text>
            <Text style={[styles.additionalMetricValue, { color: colors.text }]}>
              {totalesRapidos.totalMovimientos}
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  period: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.7,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  incomeText: {
    color: '#10B981',
  },
  expenseText: {
    color: '#EF4444',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  comparisonText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  additionalMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  additionalMetricItem: {
    alignItems: 'center',
  },
  additionalMetricLabel: {
    fontSize: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.8,
    opacity: 0.6,
  },
  additionalMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default ResumenCard;
