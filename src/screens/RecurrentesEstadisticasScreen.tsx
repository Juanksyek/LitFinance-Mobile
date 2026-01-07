import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Dimensions, Platform, StatusBar, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { recurrentesService, FiltroEstadisticas, EstadisticasRecurrentes } from '../services/recurrentesService';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../theme/useThemeColors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const RecurrentesEstadisticasScreen = () => {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const [filtro, setFiltro] = useState<FiltroEstadisticas>('mes');
  const [estadisticas, setEstadisticas] = useState<EstadisticasRecurrentes | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCurrency, setUserCurrency] = useState<string>('MXN');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadUserCurrency();
  }, []);

  useEffect(() => {
    cargarEstadisticas();
  }, [filtro]);

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

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      const data = await recurrentesService.obtenerEstadisticas(filtro);
      setEstadisticas(data);
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number, moneda?: string) => {
    const safeMoneda = moneda || userCurrency;
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
      year: 'numeric',
    });
  };

  const getFiltroLabel = (f: FiltroEstadisticas) => {
    const labels = {
      'semana': 'Semana',
      'quincena': 'Quincena',
      'mes': 'Mes',
      'año': 'Año',
    };
    return labels[f];
  };

  const FiltroButton = ({ filtroValue, label }: { filtroValue: FiltroEstadisticas; label: string }) => {
    const isActive = filtro === filtroValue;
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
      Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
    };

    const onPressOut = () => {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    };

    return (
      <TouchableOpacity
        onPress={() => setFiltro(filtroValue)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.8}
        style={{ flex: 1 }}
      >
        <Animated.View
          style={[
            styles.filtroBtn,
            {
              backgroundColor: isActive ? colors.button : colors.card,
              borderColor: isActive ? colors.button : colors.border,
              transform: [{ scale }],
            },
          ]}
        >
          <Text style={[styles.filtroBtnText, { color: isActive ? '#fff' : colors.text }]}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.button} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando estadísticas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!estadisticas) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay estadísticas disponibles</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.title, { color: colors.text }]}>Estadísticas</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Pagos Recurrentes</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Filtros */}
            <View style={styles.filtros}>
              <FiltroButton filtroValue="semana" label="Semana" />
              <FiltroButton filtroValue="quincena" label="Quincena" />
              <FiltroButton filtroValue="mes" label="Mes" />
              <FiltroButton filtroValue="año" label="Año" />
            </View>

            {/* Total Cobrado */}
            <View style={[styles.card, styles.totalCard, { shadowColor: colors.shadow }]}>
              <View style={styles.totalIcon}>
                <Ionicons name="wallet" size={32} color="white" />
              </View>
              <View style={styles.totalContent}>
                <Text style={styles.totalLabel}>TOTAL COBRADO</Text>
                <Text style={styles.totalValue}>{formatMoney(estadisticas.totalCobrado, userCurrency)}</Text>
                <View style={styles.totalBadge}>
                  <Ionicons name="sync-circle" size={14} color="white" />
                  <Text style={styles.totalSubtext}>{estadisticas.cantidadEjecuciones} ejecuciones</Text>
                </View>
              </View>
            </View>

            {/* Periodo */}
            <View style={[styles.periodoCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.periodoText, { color: colors.textSecondary }]}>
                {formatDate(estadisticas.periodo.inicio)} - {formatDate(estadisticas.periodo.fin)}
              </Text>
            </View>

            {/* Por Recurrente */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: colors.button + '15' }]}>
                  <Ionicons name="list" size={20} color={colors.button} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Detalle por Recurrente</Text>
              </View>

              {estadisticas.porRecurrente.length === 0 ? (
                <View style={styles.emptyRecurrentes}>
                  <Ionicons name="information-circle-outline" size={32} color={colors.textSecondary} />
                  <Text style={[styles.emptyRecurrentesText, { color: colors.textSecondary }]}>
                    No hay recurrentes en este periodo
                  </Text>
                </View>
              ) : (
                estadisticas.porRecurrente.map((item, index) => (
                  <RecurrenteItem
                    key={index}
                    item={item}
                    index={index}
                    colors={colors}
                    formatMoney={formatMoney}
                    totalGeneral={estadisticas.totalCobrado}
                  />
                ))
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const RecurrenteItem: React.FC<{
  item: { nombre: string; total: number; cantidad: number; plataforma?: string; moneda?: string };
  index: number;
  colors: any;
  formatMoney: (amount: number, moneda?: string) => string;
  totalGeneral: number;
}> = ({ item, index, colors, formatMoney, totalGeneral }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const porcentaje = totalGeneral > 0 ? ((item.total / totalGeneral) * 100).toFixed(1) : '0';

  return (
    <Animated.View
      style={[
        styles.recurrenteItem,
        {
          backgroundColor: colors.inputBackground,
          borderColor: colors.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.recurrenteLeft}>
        <View style={[styles.recurrenteIcon, { backgroundColor: colors.button + '20' }]}>
          <Text style={[styles.recurrenteIconText, { color: colors.button }]}>
            {item.nombre.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.recurrenteInfo}>
          <Text style={[styles.recurrenteNombre, { color: colors.text }]} numberOfLines={1}>
            {item.nombre}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.cantidadBadge, { backgroundColor: colors.button + '15' }]}>
              <Ionicons name="repeat" size={12} color={colors.button} />
              <Text style={[styles.cantidadText, { color: colors.button }]}>{item.cantidad}x</Text>
            </View>
            {item.plataforma && (
              <View style={[styles.plataformaBadge, { backgroundColor: colors.cardSecondary }]}>
                <Ionicons name="business" size={10} color={colors.textSecondary} />
                <Text style={[styles.plataformaText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.plataforma}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.recurrenteRight}>
        <Text style={[styles.recurrenteTotal, { color: colors.text }]}>
          {formatMoney(item.total, item.moneda)}
        </Text>
        <Text style={[styles.recurrentePorcentaje, { color: colors.textSecondary }]}>{porcentaje}%</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 + 12 : 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  filtros: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  filtroBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  filtroBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  totalCard: {
    backgroundColor: '#6366f1',
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  totalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalContent: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: '#e2e8f0',
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  totalSubtext: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  periodoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  periodoText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyRecurrentes: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyRecurrentesText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  recurrenteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  recurrenteLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  recurrenteIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recurrenteIconText: {
    fontSize: 20,
    fontWeight: '800',
  },
  recurrenteInfo: {
    flex: 1,
  },
  recurrenteNombre: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  cantidadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cantidadText: {
    fontSize: 11,
    fontWeight: '700',
  },
  plataformaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: 100,
  },
  plataformaText: {
    fontSize: 10,
    fontWeight: '600',
  },
  recurrenteRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  recurrenteTotal: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  recurrentePorcentaje: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default RecurrentesEstadisticasScreen;
