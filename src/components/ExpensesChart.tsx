import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Animated, StyleProp, ViewStyle } from "react-native";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
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

  // Manejador inteligente para cambio de periodo
  const handlePeriodoChange = (nuevoPeriodo: PeriodoFiltro) => {
    setPeriodoSeleccionado(nuevoPeriodo);
    // Si cambia a 'dia', forzar 'ambos' ya que la gráfica de pastel muestra ambos
    if (nuevoPeriodo === 'dia' && tipoSeleccionado !== 'ambos') {
      setTipoSeleccionado('ambos');
    }
  };

  // Manejador inteligente para cambio de tipo
  const handleTipoChange = (nuevoTipo: TipoTransaccionFiltro) => {
    // Si está en 'dia' y se selecciona ingreso o egreso, cambiar a 'semana' automáticamente
    if (periodoSeleccionado === 'dia' && nuevoTipo !== 'ambos') {
      setPeriodoSeleccionado('semana');
    }
    setTipoSeleccionado(nuevoTipo);
  };
  
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

    // Para periodo 'dia' mostraremos una gráfica de pastel con proporción de Ingresos vs Egresos
    if (periodoSeleccionado === 'dia') {
      const ingresos = analisisTemporalData.datos.map((d: any) => Number(d.ingresos || 0));
      const gastos = analisisTemporalData.datos.map((d: any) => Math.abs(Number(d.gastos || 0)));
      const totalIngresos = ingresos.reduce((s: number, v: number) => s + (v || 0), 0);
      const totalGastos = gastos.reduce((s: number, v: number) => s + (v || 0), 0);

      const pieData: any[] = [];
      if ((tipoSeleccionado === 'ambos' || tipoSeleccionado === 'ingreso') && totalIngresos > 0) {
        pieData.push({ name: 'Ingresos', population: totalIngresos, color: '#4CAF50', legendFontColor: colors.text, legendFontSize: 12 });
      }
      if ((tipoSeleccionado === 'ambos' || tipoSeleccionado === 'egreso') && totalGastos > 0) {
        pieData.push({ name: 'Egresos', population: totalGastos, color: '#F44336', legendFontColor: colors.text, legendFontSize: 12 });
      }

      if (pieData.length === 0) {
        return (
          <View style={styles.chartContainer}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>No hay valores para mostrar</Text>
            </View>
            <View style={styles.emptyChart}>
              <Ionicons name="analytics-outline" size={48} color="#e0e0e0" />
              <Text style={styles.emptyText}>No hay datos para mostrar</Text>
            </View>
          </View>
        );
      }

      // calcular anchos para la tarta y la leyenda, evitando recortes
      const legendWidth = Math.min(140, Math.floor(CHART_WIDTH * 0.35));
      const pieWidth = Math.max(160, Math.min(CHART_WIDTH - legendWidth - 24, 300));

      return (
        <View style={styles.chartContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
            <View style={{ width: pieWidth, alignItems: 'center', justifyContent: 'center' }}>
              <PieChart
                data={pieData.map(item => ({ ...item, legendFontColor: 'transparent', legendFontSize: 0 }))}
                width={pieWidth}
                height={220}
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: colors.chartBackground,
                  backgroundGradientTo: colors.chartBackground,
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="50"
                center={[0, 0]}
                absolute
                hasLegend={false}
              />
            </View>

            <View style={{ width: legendWidth, paddingLeft: 12, justifyContent: 'center' }}>
              {pieData.map((item) => (
                <View key={item.name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.color, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{`$${Number(item.population).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      );
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
            style={StyleSheet.flatten(styles.chart) as ViewStyle}
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
              onPress={() => handlePeriodoChange(periodo)}
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
          {(['ingreso', 'egreso', 'ambos'] as TipoTransaccionFiltro[]).map((tipo) => {
            // Deshabilitar ingreso/egreso cuando está en modo 'dia'
            const isDisabled = periodoSeleccionado === 'dia' && tipo !== 'ambos';
            return (
              <TouchableOpacity
                key={tipo}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                  tipoSeleccionado === tipo && styles.filterChipActive,
                  isDisabled && { opacity: 0.3 },
                ]}
                onPress={() => !isDisabled && handleTipoChange(tipo)}
                activeOpacity={isDisabled ? 1 : 0.7}
                disabled={isDisabled}
              >
                <Ionicons
                  name={tipo === 'ingreso' ? 'arrow-up' : tipo === 'egreso' ? 'arrow-down' : 'swap-vertical'}
                  size={12}
                  color={tipoSeleccionado === tipo ? '#fff' : colors.textTertiary}
                />
              </TouchableOpacity>
            );
          })}
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
