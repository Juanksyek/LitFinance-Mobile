import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { AnalisisTemporal as AnalisisTemporalType } from '../../types/analytics';

interface AnalisisTemporalProps {
  data: AnalisisTemporalType | null;
  isLoading?: boolean;
  error?: string;
}

const AnalisisTemporal: React.FC<AnalisisTemporalProps> = ({
  data,
  isLoading = false,
  error
}) => {
  const formatAmount = (amount: number): string => {
    return `$${amount.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getTendenciaIcon = (tendencia: string): string => {
    switch (tendencia) {
      case 'ascendente': return '📈';
      case 'descendente': return '📉';
      case 'estable': return '➡️';
      default: return '❓';
    }
  };

  const getTendenciaColor = (tendencia: string): string => {
    switch (tendencia) {
      case 'ascendente': return '#10B981';
      case 'descendente': return '#EF4444';
      case 'estable': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getTendenciaText = (tendencia: string): string => {
    switch (tendencia) {
      case 'ascendente': return 'Ascendente';
      case 'descendente': return 'Descendente';
      case 'estable': return 'Estable';
      default: return 'Sin datos';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando análisis temporal...</Text>
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

  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No hay datos disponibles</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Análisis Temporal</Text>
      <Text style={styles.periodo}>Periodo: {data.periodoAnalisis}</Text>
      
      {/* Tendencias */}
      <View style={styles.tendenciasContainer}>
        <Text style={styles.sectionTitle}>Tendencias</Text>
        
        <View style={styles.tendenciaItem}>
          <Text style={styles.tendenciaIcon}>{getTendenciaIcon(data.tendencias.ingresosTendencia)}</Text>
          <Text style={styles.tendenciaLabel}>Ingresos</Text>
          <Text style={[styles.tendenciaValue, { color: getTendenciaColor(data.tendencias.ingresosTendencia) }]}>
            {getTendenciaText(data.tendencias.ingresosTendencia)}
          </Text>
        </View>
        
        <View style={styles.tendenciaItem}>
          <Text style={styles.tendenciaIcon}>{getTendenciaIcon(data.tendencias.gastosTendencia)}</Text>
          <Text style={styles.tendenciaLabel}>Gastos</Text>
          <Text style={[styles.tendenciaValue, { color: getTendenciaColor(data.tendencias.gastosTendencia) }]}>
            {getTendenciaText(data.tendencias.gastosTendencia)}
          </Text>
        </View>
        
        <View style={styles.tendenciaItem}>
          <Text style={styles.tendenciaIcon}>{getTendenciaIcon(data.tendencias.balanceTendencia)}</Text>
          <Text style={styles.tendenciaLabel}>Balance</Text>
          <Text style={[styles.tendenciaValue, { color: getTendenciaColor(data.tendencias.balanceTendencia) }]}>
            {getTendenciaText(data.tendencias.balanceTendencia)}
          </Text>
        </View>
      </View>
      
      {/* Promedios */}
      <View style={styles.promediosContainer}>
        <Text style={styles.sectionTitle}>Promedios</Text>
        
        <View style={styles.promediosGrid}>
          <View style={styles.promedioItem}>
            <Text style={styles.promedioLabel}>Ingreso Promedio</Text>
            <Text style={[styles.promedioValue, styles.incomeText]}>
              {formatAmount(data.promedios.ingresoPromedio)}
            </Text>
          </View>
          
          <View style={styles.promedioItem}>
            <Text style={styles.promedioLabel}>Gasto Promedio</Text>
            <Text style={[styles.promedioValue, styles.expenseText]}>
              {formatAmount(data.promedios.gastoPromedio)}
            </Text>
          </View>
          
          <View style={styles.promedioItem}>
            <Text style={styles.promedioLabel}>Balance Promedio</Text>
            <Text style={[styles.promedioValue, { color: data.promedios.balancePromedio >= 0 ? '#10B981' : '#EF4444' }]}>
              {formatAmount(data.promedios.balancePromedio)}
            </Text>
          </View>
        </View>
      </View>
      
      {/* Datos recientes */}
      {data.datos.length > 0 && (
        <View style={styles.datosRecientesContainer}>
          <Text style={styles.sectionTitle}>Últimos Datos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {data.datos.slice(-7).map((dato, index) => (
              <View key={index} style={styles.datoItem}>
                <Text style={styles.datoFecha}>{new Date(dato.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</Text>
                <Text style={[styles.datoValue, styles.incomeText]}>{formatAmount(dato.ingresos)}</Text>
                <Text style={[styles.datoValue, styles.expenseText]}>{formatAmount(dato.gastos)}</Text>
                <Text style={styles.datoMovimientos}>{dato.cantidadMovimientos} mov.</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
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
    marginBottom: 4,
  },
  periodo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 12,
  },
  tendenciasContainer: {
    marginBottom: 20,
  },
  tendenciaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tendenciaIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  tendenciaLabel: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  tendenciaValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  promediosContainer: {
    marginBottom: 20,
  },
  promediosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  promedioItem: {
    alignItems: 'center',
    flex: 1,
  },
  promedioLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  promedioValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  incomeText: {
    color: '#10B981',
  },
  expenseText: {
    color: '#EF4444',
  },
  datosRecientesContainer: {
    marginTop: 4,
  },
  datoItem: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 60,
  },
  datoFecha: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  datoValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  datoMovimientos: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
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

export default AnalisisTemporal;
