import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

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
    if (percentage > 0) return '#10B981';
    if (percentage < 0) return '#EF4444';
    return '#6B7280';
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Cargando resumen...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  const displayData = totalesRapidos || balance;
  const ingresos = totalesRapidos 
    ? { monto: totalesRapidos.totalIngresado, moneda: totalesRapidos.moneda, esPositivo: true }
    : balance.totalIngresos;
  const gastos = totalesRapidos
    ? { monto: totalesRapidos.totalGastado, moneda: totalesRapidos.moneda, esPositivo: false }
    : balance.totalGastos;
  const balanceData = totalesRapidos
    ? { monto: totalesRapidos.balance, moneda: totalesRapidos.moneda, esPositivo: totalesRapidos.balance >= 0 }
    : balance.balance;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resumen Financiero</Text>
      <Text style={styles.period}>{period}</Text>
      
      <View style={styles.metricsContainer}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Balance</Text>
          <Text style={[styles.metricValue, { color: balanceData?.esPositivo ? '#4CAF50' : '#F44336' }]}>
            {formatAmount(balanceData)}
          </Text>
          {showComparison && comparacionPeriodos && (
            <Text style={[styles.comparisonText, { color: getPercentageColor(comparacionPeriodos.cambios.balance.porcentual) }]}>
              {formatPercentage(comparacionPeriodos.cambios.balance.porcentual)}
            </Text>
          )}
        </View>
        
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Ingresos</Text>
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
          <Text style={styles.metricLabel}>Gastos</Text>
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
        <View style={styles.additionalMetrics}>
          <View style={styles.additionalMetricItem}>
            <Text style={styles.additionalMetricLabel}>Subcuentas</Text>
            <Text style={styles.additionalMetricValue}>
              {formatSimpleAmount(totalesRapidos.totalSubcuentas, totalesRapidos.moneda)}
            </Text>
          </View>
          <View style={styles.additionalMetricItem}>
            <Text style={styles.additionalMetricLabel}>Movimientos</Text>
            <Text style={styles.additionalMetricValue}>
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
    backgroundColor: '#FFFFFF',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  period: {
    fontSize: 14,
    color: '#6B7280',
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
    color: '#6B7280',
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
    color: '#6B7280',
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
    borderTopColor: '#E5E7EB',
  },
  additionalMetricItem: {
    alignItems: 'center',
  },
  additionalMetricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  additionalMetricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
});

export default ResumenCard;
