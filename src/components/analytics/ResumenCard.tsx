import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.text }]}>Resumen Financiero</Text>
      <Text style={[styles.period, { color: colors.textSecondary }]}>{period}</Text>
      
      <View style={styles.metricsContainer}>
        <View style={styles.metricItem}>
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
        
        <View style={styles.metricItem}>
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
        
        <View style={styles.metricItem}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  period: {
    fontSize: 14,
    marginBottom: 16,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
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
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  additionalMetricItem: {
    alignItems: 'center',
  },
  additionalMetricLabel: {
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  additionalMetricValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ResumenCard;
