import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import type { EstadisticaConcepto } from '../../types/analytics';

interface EstadisticasConceptoProps {
  data: EstadisticaConcepto[];
  isLoading?: boolean;
  error?: string;
}

const EstadisticasConcepto: React.FC<EstadisticasConceptoProps> = ({
  data,
  isLoading = false,
  error
}) => {
  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderConceptoItem = ({ item }: { item: EstadisticaConcepto }) => (
    <View style={styles.conceptoItem}>
      <View style={styles.conceptoHeader}>
        <View style={[styles.colorIndicator, { backgroundColor: item.concepto.color }]} />
        <Text style={styles.conceptoIcon}>{item.concepto.icono}</Text>
        <Text style={styles.conceptoNombre}>{item.concepto.nombre}</Text>
        <Text style={styles.participacion}>{item.participacionPorcentual.toFixed(1)}%</Text>
      </View>
      
      <View style={styles.conceptoStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Ingresos</Text>
          <Text style={[styles.statValue, styles.incomeText]}>
            ${formatAmount(item.totalIngreso)}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Gastos</Text>
          <Text style={[styles.statValue, styles.expenseText]}>
            ${formatAmount(item.totalGasto)}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Movimientos</Text>
          <Text style={styles.statValue}>{item.cantidadMovimientos}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Promedio</Text>
          <Text style={styles.statValue}>${formatAmount(item.montoPromedio)}</Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
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
      <Text style={styles.title}>Estadísticas por Concepto</Text>
      <FlatList
        data={data}
        renderItem={renderConceptoItem}
        keyExtractor={(item) => item.concepto.id}
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
  conceptoItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  conceptoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 8,
  },
  conceptoIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  conceptoNombre: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  participacion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  conceptoStats: {
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

export default EstadisticasConcepto;
