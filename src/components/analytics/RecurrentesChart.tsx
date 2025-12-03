import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, EstadisticaRecurrente, AnalyticsFilters } from '../../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../../theme/useThemeColors';

interface RecurrentesChartProps {
  filters: AnalyticsFilters;
  refreshKey?: number;
}

const RecurrentesChart: React.FC<RecurrentesChartProps> = ({ filters, refreshKey = 0 }) => {
  const colors = useThemeColors();
  const [data, setData] = useState<EstadisticaRecurrente[]>([]);
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
      
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await analyticsService.getEstadisticasPorRecurrente(filters);
      setData(response);
    } catch (error: any) {
      if (error?.message?.includes('401')) {
        await AsyncStorage.removeItem("authToken");
        console.error('Session expired in RecurrentesChart');
      }
      console.error('Error loading recurrentes data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Usar la moneda del filtro o del recurrente si está disponible
  const getMoneda = (item?: any) => {
    return item?.recurrente?.moneda || filters.monedaBase || userCurrency;
  };
  const formatMoney = (amount: number, moneda?: string) => {
    const safeMoneda = (!moneda || typeof moneda !== 'string' || moneda.trim() === '') 
      ? (filters.monedaBase || userCurrency) 
      : moneda;
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: safeMoneda,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch (e) {
      return `${amount} ${safeMoneda}`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'activo':
        return '#10b981';
      case 'pausado':
        return '#f59e0b';
      case 'cancelado':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'activo':
        return 'checkmark-circle';
      case 'pausado':
        return 'pause-circle';
      case 'cancelado':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando pagos recurrentes...</Text>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="repeat-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay pagos recurrentes</Text>
      </View>
    );
  }

  const totalMensual = data.reduce((sum, item) => sum + item.montoMensual, 0);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={[styles.title, { color: colors.text }]}>Pagos Recurrentes</Text>
      
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total mensual</Text>
        <Text style={styles.summaryValue}>{formatMoney(totalMensual, filters.monedaBase || userCurrency)}</Text>
        <Text style={styles.summarySubtext}>{data.length} suscripciones activas</Text>
      </View>
      
      <ScrollView style={styles.itemsContainer} showsVerticalScrollIndicator={false}>
        {data.map((item) => (
          <View key={item.recurrente.id} style={[styles.item, { backgroundColor: colors.card }]}>
            <View style={styles.itemHeader}>
              <View style={styles.recurrenteInfo}>
                <View style={[
                  styles.plataformaContainer, 
                  { backgroundColor: item.recurrente.plataforma.color + '20' }
                ]}>
                  <Text style={styles.plataformaLetter}>
                    {item.recurrente.plataforma.nombre.charAt(0)}
                  </Text>
                </View>
                <View style={styles.recurrenteText}>
                  <Text style={[styles.recurrenteName, { color: colors.text }]}>{item.recurrente.nombre}</Text>
                  <Text style={[styles.plataformaName, { color: colors.textSecondary }]}>
                    {item.recurrente.plataforma.nombre} • {item.recurrente.plataforma.categoria}
                  </Text>
                </View>
              </View>
              <View style={styles.statusContainer}>
                <Ionicons 
                  name={getStatusIcon(item.estadoActual) as any} 
                  size={16} 
                  color={getStatusColor(item.estadoActual)} 
                />
                <Text style={[styles.status, { color: getStatusColor(item.estadoActual) }]}>
                  {item.estadoActual}
                </Text>
              </View>
            </View>

            <View style={[styles.amountContainer, { backgroundColor: colors.inputBackground }]}>
              <Text style={[styles.montoMensual, { color: colors.text }]}>{formatMoney(item.montoMensual, getMoneda(item))}</Text>
              <Text style={[styles.montoLabel, { color: colors.textSecondary }]}>por mes</Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total ejecutado</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{formatMoney(item.totalEjecutado, getMoneda(item))}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ejecuciones</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{item.cantidadEjecuciones}</Text>
              </View>
            </View>

            <View style={styles.datesContainer}>
              <View style={styles.dateItem}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Última: </Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>
                  {formatDate(item.ultimaEjecucion)}
                </Text>
              </View>
              <View style={styles.dateItem}>
                <Ionicons name="calendar-outline" size={14} color="#6366f1" />
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Próxima: </Text>
                <Text style={[styles.dateValue, { color: '#6366f1' }]}>
                  {formatDate(item.proximaEjecucion)}
                </Text>
              </View>
            </View>

            <Text style={[styles.frecuencia, { color: colors.textSecondary }]}>
              Frecuencia: {item.recurrente.frecuencia}
            </Text>
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
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#e2e8f0',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  summarySubtext: {
    fontSize: 12,
    color: '#c7d2fe',
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
    maxHeight: 350,
  },
  item: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recurrenteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  plataformaContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  plataformaLetter: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  recurrenteText: {
    flex: 1,
  },
  recurrenteName: {
    fontSize: 16,
    fontWeight: '600',
  },
  plataformaName: {
    fontSize: 12,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  montoMensual: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  montoLabel: {
    fontSize: 14,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  datesContainer: {
    gap: 8,
    marginBottom: 8,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 12,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  frecuencia: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default RecurrentesChart;
