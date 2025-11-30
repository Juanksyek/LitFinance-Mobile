import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import type { EstadisticaRecurrente } from '../../types/analytics';

interface EstadisticasRecurrentesProps {
  data: EstadisticaRecurrente[];
  isLoading?: boolean;
  error?: string;
}

const EstadisticasRecurrentes: React.FC<EstadisticasRecurrentesProps> = ({
  data,
  isLoading = false,
  error
}) => {
  const [userCurrency, setUserCurrency] = useState<string>('MXN');

  useEffect(() => {
    // Obtener la moneda preferida del usuario desde AsyncStorage
    (async () => {
      try {
        const stored = await (await import('@react-native-async-storage/async-storage')).default.getItem('monedaPreferencia');
        if (stored) {
          let code = stored;
          // Si está guardado como objeto JSON
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
    })();
  }, []);

  // Usar la moneda del recurrente si existe, si no la del usuario, si no MXN
  const formatAmount = (amount: number, moneda?: string): string => {
    let safeMoneda = 'MXN';
    if (moneda && typeof moneda === 'string' && moneda.trim() !== '') {
      safeMoneda = moneda;
    } else if (userCurrency && typeof userCurrency === 'string' && userCurrency.trim() !== '') {
      safeMoneda = userCurrency;
    }
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: safeMoneda,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (e) {
      return `${amount} ${safeMoneda}`;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'activo': return '#10B981';
      case 'pausado': return '#F59E0B';
      case 'cancelado': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'activo': return 'Activo';
      case 'pausado': return 'Pausado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  const renderRecurrenteItem = ({ item }: { item: EstadisticaRecurrente }) => (
    <View style={styles.recurrenteItem}>
      <View style={styles.recurrenteHeader}>
        <View style={[styles.plataformaIndicator, { backgroundColor: item.recurrente.plataforma.color }]} />
        <View style={styles.recurrenteInfo}>
          <Text style={styles.recurrenteNombre}>{item.recurrente.nombre}</Text>
          <Text style={styles.plataformaNombre}>{item.recurrente.plataforma.nombre}</Text>
          <Text style={styles.categoria}>{item.recurrente.plataforma.categoria}</Text>
        </View>
        <View style={styles.statusContainer}>
          <Text style={[styles.status, { color: getStatusColor(item.estadoActual) }]}> 
            {getStatusText(item.estadoActual)}
          </Text>
          <Text style={styles.montoMensual}>{formatAmount(item.montoMensual, item.recurrente.moneda)}/mes</Text>
        </View>
      </View>

      <View style={styles.recurrenteStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Ejecutado</Text>
          <Text style={styles.statValue}>{formatAmount(item.totalEjecutado, item.recurrente.moneda)}</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Ejecuciones</Text>
          <Text style={styles.statValue}>{item.cantidadEjecuciones}</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Próxima</Text>
          <Text style={styles.statValue}>{formatDate(item.proximaEjecucion)}</Text>
        </View>
      </View>

      <Text style={styles.frecuencia}>Frecuencia: {item.recurrente.frecuencia}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando recurrentes...</Text>
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
      <Text style={styles.title}>Estadísticas de Recurrentes</Text>
      <FlatList
        data={data}
        renderItem={renderRecurrenteItem}
        keyExtractor={(item) => item.recurrente.id}
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
  recurrenteItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  recurrenteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  plataformaIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  recurrenteInfo: {
    flex: 1,
  },
  recurrenteNombre: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  plataformaNombre: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  categoria: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  montoMensual: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 4,
  },
  recurrenteStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  frecuencia: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
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

export default EstadisticasRecurrentes;
