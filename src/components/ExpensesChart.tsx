import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Animated, StyleProp, ViewStyle } from "react-native";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { analyticsService, AnalyticsFilters } from "../services/analyticsService";
import Toast from "react-native-toast-message";
import { useThemeColors } from "../theme/useThemeColors";
import { dashboardService } from "../services/dashboardService";
import type { DashboardRange, DashboardSnapshot } from "../types/dashboardSnapshot";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;

type PeriodoFiltro = DashboardRange;
type TipoTransaccionFiltro = 'ingreso' | 'egreso' | 'ambos';

const DASHBOARD_RANGES: DashboardRange[] = ['day', 'week', 'month', '3months', '6months', 'year', 'all'];

function isDashboardRange(value: string): value is DashboardRange {
  return (DASHBOARD_RANGES as string[]).includes(value);
}

function rangeChipLabel(rangeKey: string, label?: string) {
  // Keep chip text compact to fit 32px width
  if (rangeKey === 'day') return 'D';
  if (rangeKey === 'week') return 'S';
  if (rangeKey === 'month') return 'M';
  if (rangeKey === 'all') return '∞';
  if (rangeKey === 'year') return 'A';
  if (rangeKey === '3months') return '3M';
  if (rangeKey === '6months') return '6M';
  const trimmed = (label ?? '').trim();
  return trimmed ? trimmed.slice(0, 2).toUpperCase() : '?';
}

interface ExpensesChartProps {
  refreshKey?: number;
  dashboardSnapshot?: DashboardSnapshot | null;
  onRequestRangeChange?: (range: DashboardRange) => void;
  selectedRange?: DashboardRange | null;
}

const ExpensesChart: React.FC<ExpensesChartProps> = ({ refreshKey = 0, dashboardSnapshot, onRequestRangeChange, selectedRange }) => {
  const colors = useThemeColors();
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<PeriodoFiltro>('month');
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoTransaccionFiltro>('ambos');
  const [loading, setLoading] = useState(true);
  const [analisisTemporalData, setAnalisisTemporalData] = useState<any>(null);

  // Dashboard context is indicated by the prop being provided (even if null while loading)
  const isDashboardContext = dashboardSnapshot !== undefined;
  const hasSnapshot = dashboardSnapshot != null;

  const cacheKey = (() => {
    if (!isDashboardContext) return 'analytics_temporal_cache';
    const moneda = String(dashboardSnapshot?.accountSummary?.moneda ?? 'ALL');
    return `dashboard_expenses_chart_${periodoSeleccionado}_${tipoSeleccionado}_${moneda}`;
  })();

  const snapshotMode = isDashboardContext;
  const snapshotRange = (() => {
    const selected = dashboardSnapshot?.meta?.ranges?.selected;
    if (selected && isDashboardRange(String(selected))) {
      return selected as DashboardRange;
    }
    const aggRange = dashboardSnapshot?.chartAggregates?.range;
    if (aggRange && isDashboardRange(String(aggRange))) {
      return aggRange as DashboardRange;
    }
    return null;
  })();
  const snapshotMatchesSelection = snapshotRange !== null && snapshotRange === periodoSeleccionado;
  const canUseSnapshotData = hasSnapshot && !!dashboardSnapshot?.chartAggregates?.points?.length && snapshotMatchesSelection;

  // selectedRange prop is intentionally ignored — ExpensesChart manages its own range state
  // to stay independent from other dashboard components.

  // Manejador inteligente para cambio de tipo
  const handleTipoChange = (nuevoTipo: TipoTransaccionFiltro) => {
    // Si está en 'day' (pastel) y se selecciona ingreso o egreso, cambiar a 'month' automáticamente
    if (periodoSeleccionado === 'day' && nuevoTipo !== 'ambos') {
      setPeriodoSeleccionado('month');
      if (onRequestRangeChange) {
        setLoading(true);
        onRequestRangeChange('month');
      }
    }
    setTipoSeleccionado(nuevoTipo);
  };

  // Manejador para cambio de periodo (corrige error: handlePeriodoChange no definido)
  const handlePeriodoChange = (nuevoPeriodo: PeriodoFiltro) => {
    if (periodoSeleccionado === nuevoPeriodo) return;
    // Si cambiamos a 'day' forzamos tipo 'ambos' porque el pie solo soporta ambos
    if (nuevoPeriodo === 'day' && tipoSeleccionado !== 'ambos') {
      setTipoSeleccionado('ambos');
    }
    setPeriodoSeleccionado(nuevoPeriodo);
    if (onRequestRangeChange) {
      setLoading(true);
      onRequestRangeChange(nuevoPeriodo);
    }
  };
  
  // 🚀 Cargar datos cacheados al montar para mostrar gráfica inmediatamente
  useEffect(() => {
    const loadCached = async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          console.log('⚡ [ExpensesChart] Mostrando datos cacheados');
          setAnalisisTemporalData(data);
          setLoading(false);
        }
      } catch {}
    };
    loadCached();
  }, [cacheKey]);
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
    // Snapshot mode: only skip fetch when snapshot matches current selection
    if (canUseSnapshotData) return;
    fetchAnalyticsData();
  }, [periodoSeleccionado, tipoSeleccionado, refreshKey, canUseSnapshotData]);

  useEffect(() => {
    if (!dashboardSnapshot) return;
    const agg = dashboardSnapshot.chartAggregates;
    if (!agg?.points || !snapshotMatchesSelection) return;

    const datos = agg.points.map((p: any) => ({
      fecha: p.x,
      ingresos: Number(p.in || 0),
      gastos: Number(p.out || 0),
    }));

    setAnalisisTemporalData({ datos });
    setLoading(false);
  }, [dashboardSnapshot, snapshotMatchesSelection]);

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
    const minInterval = 200; // más responsive al alternar filtros
    
    // Solo aplicar cooldown si ya hubo un fetch previo (no bloquear primera carga)
    if (lastFetchRef.current > 0 && now - lastFetchRef.current < minInterval) {
      console.log('📊 [ExpensesChart] Fetch bloqueado: muy pronto desde el último');
      // Reintentar una vez (útil cuando el usuario alterna rápido)
      setTimeout(() => {
        if (isMountedRef.current) fetchAnalyticsData();
      }, minInterval);
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
      
      // Dashboard context: use specialized endpoint GET /dashboard/expenses-chart
      if (isDashboardContext) {
        let fechaInicio: string | undefined;
        let fechaFin: string | undefined;

        // For "day" we request an explicit date range (custom), consistent with previous behavior.
        if (periodoSeleccionado === 'day') {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          const iso = `${yyyy}-${mm}-${dd}`;
          fechaInicio = iso;
          fechaFin = iso;
        }

        const moneda = dashboardSnapshot?.accountSummary?.moneda;

        const chart = await dashboardService.getExpensesChart(
          {
            range: periodoSeleccionado,
            tipoTransaccion: tipoSeleccionado,
            moneda: moneda ? String(moneda) : undefined,
            fechaInicio,
            fechaFin,
          },
          signal
        );

        if (signal.aborted) {
          console.log('📊 [ExpensesChart] Fetch cancelado');
          return;
        }

        const normalized = {
          datos: Array.isArray(chart?.points)
            ? chart.points.map((p: any) => ({
                fecha: p.date,
                ingresos: Number(p.ingreso || 0),
                gastos: Number(p.egreso || 0),
              }))
            : [],
        };

        if (isMountedRef.current && !signal.aborted) {
          setAnalisisTemporalData(normalized);
          try {
            await AsyncStorage.setItem(cacheKey, JSON.stringify(normalized));
          } catch {}
        }

        return;
      }

      // Non-dashboard fallback: use legacy analytics service
      const rangoTiempo: AnalyticsFilters['rangoTiempo'] =
        periodoSeleccionado === 'day'
          ? 'dia'
          : periodoSeleccionado === 'week'
            ? 'semana'
            : periodoSeleccionado === 'month'
              ? 'mes'
              : periodoSeleccionado === '3months'
                ? '3meses'
                : periodoSeleccionado === '6months'
                  ? '6meses'
                  : periodoSeleccionado === 'all'
                    ? 'desdeSiempre'
                  : 'año';

      const filters: AnalyticsFilters = {
        rangoTiempo,
        tipoTransaccion: tipoSeleccionado,
      };

      if (periodoSeleccionado === 'day') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const iso = `${yyyy}-${mm}-${dd}`;
        filters.fechaInicio = iso;
        filters.fechaFin = iso;
      }

      const temporal = await analyticsService.getAnalisisTemporalNormalized(filters, signal);

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('📊 [ExpensesChart] Fetch cancelado');
        return;
      }

      // Normalizar respuesta: soportar nuevo shape { range, points } y legacy { datos }
      let normalized: any = null;
      if (temporal && Array.isArray((temporal as any).points)) {
        normalized = {
          datos: (temporal as any).points.map((p: any) => ({ fecha: p.x, ingresos: Number(p.in || 0), gastos: Number(p.out || 0) })),
        };
      } else if (temporal && Array.isArray((temporal as any).datos)) {
        normalized = temporal;
      } else {
        normalized = temporal;
      }

      // Solo actualizar estado si el componente está montado
      if (isMountedRef.current && !signal.aborted) {
        setAnalisisTemporalData(normalized);
        
        // 💾 Guardar en cache para próxima carga instantánea
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(normalized));
        } catch {}
      }
    } catch (error: any) {
      // Ignorar errores de abort
      if (error.name === 'AbortError' || signal.aborted) {
        console.log('📊 [ExpensesChart] Fetch cancelado');
        return;
      }

      // Friendly rate-limit message for dashboard endpoint
      if (error?.statusCode === 429) {
        const retry = Number(error?.retryAfterSeconds || 0);
        Toast.show({
          type: 'info',
          text1: '⚠️ Demasiadas peticiones',
          text2: retry > 0 ? `Intenta de nuevo en ${retry}s` : 'Espera un momento e intenta de nuevo',
          position: 'bottom',
          visibilityTime: 2500,
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
    if (periodoSeleccionado === 'day') {
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
          <View
            style={[
              styles.chartContainer,
              { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chartBackground },
            ]}
          >
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
        <View
          style={[
            styles.chartContainer,
            { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chartBackground },
          ]}
        >
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
      <View
        style={[
          styles.chartContainer,
          { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chartBackground },
        ]}
      >
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
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor: colors.chartBackground,
            borderWidth: 1,
            borderColor: colors.border,
          },
        ]}
      >
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.chartBackground,
          shadowColor: colors.shadow,
          borderWidth: 1,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Título */}
      <Text style={[styles.chartTitle, { color: colors.text }]}>Gráfico de gastos</Text>

      {/* Filtros: range chips + tipo (flechitas) en la misma fila */}
      <View style={styles.filtersRow}>
        <View style={styles.filterGroup}>
          {([
            { key: 'day',      label: 'Día' },
            { key: 'week',     label: 'Semana' },
            { key: 'month',    label: 'Mes' },
            { key: '3months',  label: '3 meses' },
            { key: '6months',  label: '6 meses' },
          ] as Array<{ key: string; label: string }>).map((opt) => {
            const periodo = opt.key as PeriodoFiltro;
            return (
              <TouchableOpacity
                key={periodo}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                  periodoSeleccionado === periodo && { backgroundColor: colors.button, borderColor: colors.button },
                  loading && { opacity: 0.6 },
                ]}
                onPress={() => handlePeriodoChange(periodo)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.text },
                    periodoSeleccionado === periodo && { color: '#fff' },
                  ]}
                >
                  {rangeChipLabel(opt.key, opt.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterGroup}>
          {(['ingreso', 'egreso', 'ambos'] as TipoTransaccionFiltro[]).map((tipo) => {
            const isDisabled = periodoSeleccionado === 'day' && tipo !== 'ambos';
            return (
              <TouchableOpacity
                key={tipo}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                  tipoSeleccionado === tipo && { backgroundColor: colors.button, borderColor: colors.button },
                  isDisabled && { opacity: 0.3 },
                  loading && { opacity: 0.6 },
                ]}
                onPress={() => !isDisabled && handleTipoChange(tipo)}
                activeOpacity={isDisabled ? 1 : 0.7}
                disabled={isDisabled || loading}
                hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
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
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
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
  tipoSegmented: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 2,
    marginBottom: 8,
  },
  tipoSeg: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  tipoSegText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tipoSegTextActive: {
    color: '#fff',
    fontWeight: '700',
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
