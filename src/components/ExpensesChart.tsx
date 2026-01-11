import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Animated } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { analyticsService, AnalyticsFilters } from "../services/analyticsService";
import Toast from "react-native-toast-message";
import { useThemeColors } from "../theme/useThemeColors";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;

type PeriodoFiltro = 'dia' | 'semana' | 'mes';
type TipoTransaccionFiltro = 'ingreso' | 'egreso' | 'ambos';

interface ExpensesChartProps {
  refreshKey?: number;
}

const ExpensesChart: React.FC<ExpensesChartProps> = ({ refreshKey = 0 }) => {
  const colors = useThemeColors();
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<PeriodoFiltro>('mes');
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoTransaccionFiltro>('ambos');
  const [loading, setLoading] = useState(true);
  const [analisisTemporalData, setAnalisisTemporalData] = useState<any>(null);
  
  // 🚀 Cargar datos cacheados al montar para mostrar gráfica inmediatamente
  useEffect(() => {
    const loadCached = async () => {
      try {
        const cached = await AsyncStorage.getItem('analytics_temporal_cache');
        if (cached) {
          const data = JSON.parse(cached);
          console.log('⚡ [ExpensesChart] Mostrando datos cacheados');
          setAnalisisTemporalData(data);
          setLoading(false);
        }
      } catch {}
    };
    loadCached();
  }, []);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.95))[0];

  // Refs para prevención de memory leaks
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<number>(0);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('🧹 [ExpensesChart] Limpiando componente...');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [periodoSeleccionado, tipoSeleccionado, refreshKey]);

  useEffect(() => {
    if (!loading && analisisTemporalData) {
      // Animación de entrada suave
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
    }
  }, [loading, analisisTemporalData]);

  const fetchAnalyticsData = async () => {
    const now = Date.now();
    const minInterval = 300; // 300ms para cambios rápidos de filtro
    
    // Solo aplicar cooldown si ya hubo un fetch previo (no bloquear primera carga)
    if (lastFetchRef.current > 0 && now - lastFetchRef.current < minInterval) {
      console.log('📊 [ExpensesChart] Fetch bloqueado: muy pronto desde el último');
      return;
    }

    if (!isMountedRef.current) {
      console.log('⚠️ [ExpensesChart] Componente desmontado, cancelando fetch');
      return;
    }

    // Cancelar fetch anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      lastFetchRef.current = now;
      if (isMountedRef.current) {
        setLoading(true);
      }
      
      const filters: AnalyticsFilters = {
        rangoTiempo: periodoSeleccionado,
        tipoTransaccion: tipoSeleccionado,
      };

      const temporal = await analyticsService.getAnalisisTemporal(filters, signal);

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('📊 [ExpensesChart] Fetch cancelado');
        return;
      }

      // Solo actualizar estado si el componente está montado
      if (isMountedRef.current && !signal.aborted) {
        setAnalisisTemporalData(temporal);
        
        // 💾 Guardar en cache para próxima carga instantánea
        try {
          await AsyncStorage.setItem('analytics_temporal_cache', JSON.stringify(temporal));
        } catch {}
      }
    } catch (error: any) {
      // Ignorar errores de abort
      if (error.name === 'AbortError' || signal.aborted) {
        console.log('📊 [ExpensesChart] Fetch cancelado');
        return;
      }
      console.error('Error fetching analytics:', error);
      if (isMountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Error al cargar análisis',
          text2: 'Verifica tu conexión',
        });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const renderMainChart = () => {
    if (!analisisTemporalData?.datos || analisisTemporalData.datos.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Ionicons name="analytics-outline" size={48} color="#e0e0e0" />
          <Text style={styles.emptyText}>No hay datos para mostrar</Text>
        </View>
      );
    }

    const labels = analisisTemporalData.datos.map((d: any) => {
      const date = new Date(d.fecha);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    const datasets = [];

    if (tipoSeleccionado === 'ingreso' || tipoSeleccionado === 'ambos') {
      datasets.push({
        data: analisisTemporalData.datos.map((d: any) => d.ingresos),
        color: () => '#4CAF50',
        strokeWidth: 2,
      });
    }

    if (tipoSeleccionado === 'egreso' || tipoSeleccionado === 'ambos') {
      datasets.push({
        data: analisisTemporalData.datos.map((d: any) => d.gastos),
        color: () => '#F44336',
        strokeWidth: 2,
      });
    }

    return (
      <View style={styles.chartContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={{
              labels,
              datasets,
              legend: tipoSeleccionado === 'ambos' ? ['Ingresos', 'Egresos'] : undefined,
            }}
            width={Math.max(CHART_WIDTH, labels.length * 50)}
            height={220}
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: colors.chartBackground,
              backgroundGradientTo: colors.chartBackground,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(${colors.text === '#F2F3F5' ? '242, 243, 245' : '51, 51, 51'}, ${opacity * 0.3})`,
              labelColor: (opacity = 1) => `rgba(${colors.text === '#F2F3F5' ? '181, 186, 193' : '51, 51, 51'}, ${opacity})`,
              style: {
                borderRadius: 12,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: colors.card,
              },
              propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: colors.chartLine,
                strokeWidth: 1,
              },
            }}
            bezier
            style={styles.chart}
            withInnerLines={true}
            withOuterLines={false}
            withShadow={false}
            withVerticalLines={false}
            withHorizontalLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            segments={4}
          />
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.chartBackground }]}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.chartBackground, shadowColor: colors.shadow }]}>
      {/* Filtros minimalistas */}
      <View style={styles.filtersRow}>
        <View style={styles.filterGroup}>
          {(['dia', 'semana', 'mes'] as PeriodoFiltro[]).map((periodo) => (
            <TouchableOpacity
              key={periodo}
              style={[
                styles.filterChip,
                { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                periodoSeleccionado === periodo && styles.filterChipActive,
              ]}
              onPress={() => setPeriodoSeleccionado(periodo)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.text },
                  periodoSeleccionado === periodo && styles.filterChipTextActive,
                ]}
              >
                {periodo === 'dia' ? 'D' : periodo === 'semana' ? 'S' : 'M'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filterGroup}>
          {(['ingreso', 'egreso', 'ambos'] as TipoTransaccionFiltro[]).map((tipo) => (
            <TouchableOpacity
              key={tipo}
              style={[
                styles.filterChip,
                { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                tipoSeleccionado === tipo && styles.filterChipActive,
              ]}
              onPress={() => setTipoSeleccionado(tipo)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tipo === 'ingreso' ? 'arrow-up' : tipo === 'egreso' ? 'arrow-down' : 'swap-vertical'}
                size={12}
                color={tipoSeleccionado === tipo ? '#fff' : colors.textTertiary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Gráfica principal con animación */}
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        {renderMainChart()}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    borderRadius: 14,
    padding: 16,
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  filterChipActive: {
    backgroundColor: '#EF7725',
    borderColor: '#EF7725',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  chartContainer: {
    marginTop: 8,
    borderRadius: 12,
    padding: 8,
  },
  chart: {
    borderRadius: 12,
  },
  emptyChart: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
  },
});

export default ExpensesChart;
