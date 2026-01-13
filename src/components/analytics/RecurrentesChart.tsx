import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsService, EstadisticaRecurrente, AnalyticsFilters } from '../../services/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../../services/authService';
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
      
      const token = await authService.getAccessToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }
      
      const response = await analyticsService.getEstadisticasPorRecurrente(filters);
      setData(response);
    } catch (error: any) {
      if (error?.message?.includes('401')) {
        await authService.clearAll();
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
      return `${amount.toFixed(2)} ${safeMoneda}`;
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
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.button + '15' }]}>
          <Ionicons name="repeat" size={22} color={colors.button} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Pagos Recurrentes</Text>
      </View>
      
      <View style={[styles.summaryCard, { shadowColor: colors.shadow }]}>
        <View style={styles.summaryIcon}>
          <Ionicons name="wallet" size={28} color="white" />
        </View>
        <View style={styles.summaryContent}>
          <Text style={styles.summaryLabel}>TOTAL MENSUAL</Text>
          <Text style={styles.summaryValue}>{formatMoney(totalMensual, filters.monedaBase || userCurrency)}</Text>
          <View style={styles.summaryBadge}>
            <Ionicons name="sync-circle" size={14} color="white" />
            <Text style={styles.summarySubtext}>{data.length} suscripciones activas</Text>
          </View>
        </View>
      </View>
      
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
        >
          {data.map((item, index) => (
            <AnimatedRecurrenteItem
              key={item.recurrente.id}
              item={item}
              index={index}
              colors={colors}
              formatMoney={formatMoney}
              formatDate={formatDate}
              getMoneda={getMoneda}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
            />
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
};

// Componente animado para cada recurrente
const AnimatedRecurrenteItem: React.FC<{
  item: EstadisticaRecurrente;
  index: number;
  colors: any;
  formatMoney: (amount: number, moneda?: string) => string;
  formatDate: (dateString: string) => string;
  getMoneda: (item?: any) => string;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
}> = ({ item, index, colors, formatMoney, formatDate, getMoneda, getStatusColor, getStatusIcon }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
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
        friction: 7,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View 
      style={[
        styles.item,
        { 
          backgroundColor: colors.card,
          shadowColor: colors.shadow,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
        }
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={styles.recurrenteInfo}>
          <View style={[
            styles.plataformaContainer, 
            { backgroundColor: item.recurrente.plataforma.color }
          ]}>
            <Text style={styles.plataformaLetter}>
              {item.recurrente.plataforma.nombre.charAt(0)}
            </Text>
          </View>
          <View style={styles.recurrenteText}>
            <Text style={[styles.recurrenteName, { color: colors.text }]}>
              {item.recurrente.nombre}
            </Text>
            <View style={styles.plataformaRow}>
              <View style={[styles.platBadge, { backgroundColor: colors.cardSecondary }]}>
                <Ionicons name="business" size={11} color={colors.textSecondary} />
                <Text style={[styles.plataformaName, { color: colors.textSecondary }]}>
                  {item.recurrente.plataforma.nombre}
                </Text>
              </View>
              <View style={[styles.platBadge, { backgroundColor: colors.cardSecondary }]}>
                <Ionicons name="pricetag" size={11} color={colors.textSecondary} />
                <Text style={[styles.plataformaName, { color: colors.textSecondary }]}>
                  {item.recurrente.plataforma.categoria}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={[styles.statusContainer, { backgroundColor: getStatusColor(item.estadoActual) + '15' }]}>
          <Ionicons 
            name={getStatusIcon(item.estadoActual) as any} 
            size={18} 
            color={getStatusColor(item.estadoActual)} 
          />
          <Text style={[styles.status, { color: getStatusColor(item.estadoActual) }]}>
            {item.estadoActual}
          </Text>
        </View>
      </View>

      <View style={[styles.amountContainer, { backgroundColor: colors.cardSecondary }]}>
        <Ionicons name="cash" size={24} color={colors.button} />
        <View style={{flex: 1}}>
          <Text style={[styles.montoMensual, { color: colors.text }]}>
            {formatMoney(item.montoMensual, getMoneda(item))}
          </Text>
          <Text style={[styles.montoLabel, { color: colors.textSecondary }]}>por mes</Text>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statItem, { backgroundColor: '#10b981' + '10' }]}>
          <Ionicons name="checkmark-done-circle" size={20} color="#10b981" />
          <View style={{flex: 1}}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total ejecutado</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatMoney(item.totalEjecutado, getMoneda(item))}
            </Text>
          </View>
        </View>
        <View style={[styles.statItem, { backgroundColor: colors.button + '10' }]}>
          <Ionicons name="refresh-circle" size={20} color={colors.button} />
          <View style={{flex: 1}}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ejecuciones</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {item.cantidadEjecuciones}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.datesContainer, { backgroundColor: colors.inputBackground }]}>
        <View style={styles.dateItem}>
          <View style={[styles.dateIconContainer, { backgroundColor: colors.textSecondary + '20' }]}>
            <Ionicons name="time" size={14} color={colors.textSecondary} />
          </View>
          <View>
            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Última</Text>
            <Text style={[styles.dateValue, { color: colors.text }]}>
              {formatDate(item.ultimaEjecucion)}
            </Text>
          </View>
        </View>
        <View style={styles.dateDivider} />
        <View style={styles.dateItem}>
          <View style={[styles.dateIconContainer, { backgroundColor: '#6366f1' + '20' }]}>
            <Ionicons name="calendar" size={14} color="#6366f1" />
          </View>
          <View>
            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Próxima</Text>
            <Text style={[styles.dateValue, { color: '#6366f1' }]}>
              {formatDate(item.proximaEjecucion)}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.frecuenciaContainer, { backgroundColor: colors.success + '10' }]}>
        <Ionicons name="timer" size={14} color={colors.success} />
        <Text style={[styles.frecuencia, { color: colors.success }]}>
          Frecuencia: {item.recurrente.frecuencia}
        </Text>
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
  summaryCard: {
    backgroundColor: '#6366f1',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#e2e8f0',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  summarySubtext: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
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
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
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
  recurrenteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  plataformaContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  plataformaLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
  },
  recurrenteText: {
    flex: 1,
  },
  recurrenteName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  plataformaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  platBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  plataformaName: {
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
  status: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
  },
  montoMensual: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  montoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  datesContainer: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDivider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  frecuenciaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
  },
  frecuencia: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default RecurrentesChart;
