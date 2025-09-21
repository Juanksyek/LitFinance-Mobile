import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import type { EstadisticaSubcuenta } from '../../types/analytics';

interface EstadisticasSubcuentaProps {
  data: EstadisticaSubcuenta[];
  isLoading?: boolean;
  error?: string;
}

const EstadisticasSubcuenta: React.FC<EstadisticasSubcuentaProps> = ({
  data,
  isLoading = false,
  error
}) => {
  const formatAmount = (amount: number, currency: string): string => {
    return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const formatPercentage = (percentage: number): string => {
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  const getGrowthColor = (growth: number): string => {
    if (growth > 0) return '#10B981';
    if (growth < 0) return '#EF4444';
    return '#6B7280';
  };

  const renderSubcuentaItem = ({ item }: { item: EstadisticaSubcuenta }) => (
    <View style={styles.subcuentaItem}>
      <View style={styles.subcuentaHeader}>
        <View style={[styles.colorIndicator, { backgroundColor: item.subcuenta.color }]} />
        <View style={styles.subcuentaInfo}>
          <Text style={styles.subcuentaNombre}>{item.subcuenta.nombre}</Text>
          <Text style={styles.subcuentaStatus}>
            {item.subcuenta.activa ? 'Activa' : 'Inactiva'}
          </Text>
        </View>
        <View style={styles.saldoContainer}>
          <Text style={styles.saldoActual}>
            {formatAmount(item.saldoActual, item.subcuenta.simbolo)}
          </Text>
          <Text style={[styles.crecimiento, { color: getGrowthColor(item.crecimientoMensual) }]}>
            {formatPercentage(item.crecimientoMensual)}
          </Text>
        </View>
      </View>
      
      <View style={styles.subcuentaStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Ingresos</Text>
          <Text style={[styles.statValue, styles.incomeText]}>
            {formatAmount(item.totalIngresos, item.subcuenta.simbolo)}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Egresos</Text>
          <Text style={[styles.statValue, styles.expenseText]}>
            {formatAmount(item.totalEgresos, item.subcuenta.simbolo)}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Movimientos</Text>
          <Text style={styles.statValue}>{item.cantidadMovimientos}</Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando subcuentas...</Text>
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Estadísticas por Subcuenta</Text>
      <FlatList
        data={data}
        renderItem={renderSubcuentaItem}
        keyExtractor={(item) => item.subcuenta.id}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  subcuentaItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  subcuentaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorIndicator: {
    width: 4,
    height: 30,
    borderRadius: 2,
    marginRight: 12,
  },
  subcuentaInfo: {
    flex: 1,
  },
  subcuentaNombre: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  subcuentaStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  saldoContainer: {
    alignItems: 'flex-end',
  },
  saldoActual: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  crecimiento: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  subcuentaStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  incomeText: {
    color: '#10B981',
  },
  expenseText: {
    color: '#EF4444',
  },
  loadingText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
  },
  errorText: {
    textAlign: 'center',
    color: '#EF4444',
    fontSize: 14,
  },
});

export default EstadisticasSubcuenta;