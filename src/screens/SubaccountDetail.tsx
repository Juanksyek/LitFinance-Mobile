import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  findNodeHandle,
  UIManager,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  FlatList,
  Pressable,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { StackNavigationProp } from '@react-navigation/stack';

import EditSubaccountModal from '../components/EditSubaccountModal';
import DeleteModal from '../components/DeleteModal';
import SubaccountDeleteDecisionModal from '../components/SubaccountDeleteDecisionModal';
import ActionButtons from '../components/ActionButtons';
import SubaccountRecurrentesList from '../components/SubaccountRecurrentesList';
import MovimientoDetalleModal from '../components/MovimientoDetalleModal';

import { apiRateLimiter } from '../services/apiRateLimiter';
import { API_BASE_URL } from '../constants/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { emitRecurrentesChanged, emitSubcuentasChanged, emitTransaccionesChanged, emitViewerChanged, dashboardRefreshBus } from '../utils/dashboardRefreshBus';
import { useThemeColors } from '../theme/useThemeColors';
import { fixEncoding } from '../utils/fixEncoding';
import { subcuentasService } from '../services/subcuentasService';
import type { DeleteSubcuentaAction } from '../types/subcuentas';

type Subcuenta = {
  _id: string;
  nombre: string;
  cantidad: number;
  moneda: string;
  simbolo: string;
  color: string;
  afectaCuenta: boolean;
  subCuentaId: string;
  cuentaId: string | null;
  userId: string;
  activa: boolean;
  origenSaldo?: 'cuenta_principal' | 'nuevo';
  createdAt: string;
  updatedAt: string;
  __v: number;
  pausadaPorPlan?: boolean;
};

type RouteParams = {
  SubaccountDetail: {
    subcuenta: Subcuenta;
    onGlobalRefresh?: () => void;
  };
};

type IonName = React.ComponentProps<typeof Ionicons>['name'];

const { width } = Dimensions.get('window');

const SP = 16;
const R = 18;

const SubaccountDetail = () => {
  const colors = useThemeColors();
  const route = useRoute<RouteProp<RouteParams, 'SubaccountDetail'>>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const handleGlobalRefresh = route.params?.onGlobalRefresh || (() => {});
  const [subcuenta, setSubcuenta] = useState<Subcuenta>(route.params.subcuenta);
  const [loadingSubcuenta, setLoadingSubcuenta] = useState<boolean>(() => !route.params.subcuenta?.cuentaId);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteDecisionVisible, setDeleteDecisionVisible] = useState(false);
  const [deletingSubcuenta, setDeletingSubcuenta] = useState(false);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [historial, setHistorial] = useState<any[]>([]);
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(5);
  const [busqueda, setBusqueda] = useState('');
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [fechaAuto, setFechaAuto] = useState({ desde: '', hasta: '' });
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  const [participacion, setParticipacion] = useState<number | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  const [detalleVisible, setDetalleVisible] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<any>(null);

  // refs
  const isMountedRef = useRef(true);
  const requestRefs = useRef<Record<string, AbortController | null>>({
    subcuenta: null,
    participacion: null,
    historial: null,
    delete: null,
  });

  const scrollRef = useRef<any>(null);
  const searchContainerRef = useRef<View | null>(null);

  // Animations
  const intro = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const cardSecondary = (colors as any).cardSecondary ?? colors.card;
  const success = '#10B981';
  const danger = '#EF4444';
  const warning = '#F59E0B';

  const startRequest = useCallback((key: 'subcuenta' | 'participacion' | 'historial' | 'delete') => {
    try {
      requestRefs.current[key]?.abort();
    } catch {}
    const controller = new AbortController();
    requestRefs.current[key] = controller;
    return controller;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Layout animation on Android
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    Animated.timing(intro, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    return () => {
      isMountedRef.current = false;
      Object.values(requestRefs.current).forEach((c) => {
        try {
          c?.abort();
        } catch {}
      });
    };
  }, [intro]);

  // pulse for loader
  useEffect(() => {
    if (!loadingSubcuenta) return;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [loadingSubcuenta, pulse]);

  useEffect(() => {
    (async () => {
      const storedId = await AsyncStorage.getItem('userId');
      if (storedId) setUserId(storedId);
    })();
  }, []);

  const scrollToSearch = useCallback(() => {
    try {
      const searchNode = findNodeHandle(searchContainerRef.current as any);
      const scrollNode = findNodeHandle(scrollRef.current as any);
      if (searchNode && scrollNode && UIManager.measureLayout) {
        UIManager.measureLayout(
          searchNode,
          scrollNode,
          () => {},
          (_left: number, top: number) => {
            const offset = Math.max(0, top - 14);
            scrollRef.current?.scrollTo({ y: offset, animated: true });
          }
        );
      } else {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    } catch {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }, []);

  const formatCurrency = useCallback((amount?: number) => {
    if (typeof amount !== 'number') return '—';
    return amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  const pickDate = useCallback((item: any): string | null => {
    const candidates = [item?.createdAt, item?.fecha, item?.executedAt, item?.updatedAt, item?.timestamp, item?.date];
    const found = candidates.find((d) => typeof d === 'string' && d.trim().length > 0);
    return found ?? null;
  }, []);

  const pickDescripcion = useCallback((item: any): string => {
    const candidates = [item?.descripcion, item?.concepto, item?.motivo, item?.title, item?.nombre, item?.tipo];
    const found = candidates.find((s) => typeof s === 'string' && s.trim().length > 0);
    return fixEncoding(found ?? 'Movimiento');
  }, []);

  const pickTipo = useCallback((item: any): 'ingreso' | 'egreso' | 'transferencia' | null => {
    const raw = item?.tipo;
    if (raw === 'ingreso' || raw === 'egreso') return raw;
    if (raw === 'transferencia') return raw;
    const raw2 = item?.movimientoTipo;
    if (raw2 === 'ingreso' || raw2 === 'egreso') return raw2;
    if (raw2 === 'transferencia') return raw2;
    return null;
  }, []);

  const pickMonto = useCallback((item: any): number | null => {
    const candidates = [item?.monto, item?.cantidad, item?.importe, item?.amount, item?.total, item?.datos?.monto, item?.datos?.montoOrigen, item?.datos?.montoDestino];
    const found = candidates.find((n) => typeof n === 'number' && Number.isFinite(n));
    return found ?? null;
  }, []);

  const getTransferData = useCallback((item: any) => {
    const data = item?.datos ?? item?.metadata ?? item?.detalles ?? {};
    return {
      side: data?.side,
      origen: data?.origen,
      destino: data?.destino,
      montoOrigen: data?.montoOrigen,
      monedaOrigen: data?.monedaOrigen,
      montoDestino: data?.montoDestino,
      monedaDestino: data?.monedaDestino,
    };
  }, []);

  const fetchSubcuenta = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoadingSubcuenta(true);
    const controller = startRequest('subcuenta');

    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/subcuenta/buscar/${subcuenta?.subCuentaId}`, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const data = await res.json();
      if (res.ok && data && data.subCuentaId && isMountedRef.current && !controller.signal.aborted) {
        setSubcuenta({ ...data });
      } else if (isMountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Error al recuperar la subcuenta',
          text2: 'Inicia sesión de nuevo o inténtalo más tarde',
        });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (isMountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Error al recuperar la subcuenta',
          text2: 'Inicia sesión de nuevo o inténtalo más tarde',
        });
      }
    } finally {
      if (isMountedRef.current) setLoadingSubcuenta(false);
    }
  }, [startRequest, subcuenta?.subCuentaId]);

  const fetchParticipacion = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (!subcuenta?.cuentaId) return;

    const controller = startRequest('participacion');

    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/subcuenta/participacion/${subcuenta.cuentaId}`, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const data = await res.json();
      if (Array.isArray(data) && isMountedRef.current && !controller.signal.aborted) {
        const actual = data.find((item) => item.subsubCuentaId === subcuenta._id);
        if (actual) setParticipacion(actual.porcentaje);
        else setParticipacion(null);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (isMountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Error al obtener participación',
          text2: 'No se pudo calcular la participación de esta subcuenta',
        });
      }
    }
  }, [startRequest, subcuenta?.cuentaId, subcuenta?._id]);

  const fetchHistorial = useCallback(async () => {
    if (!subcuenta?.subCuentaId) return;

    setLoadingHistorial(true);
    const controller = startRequest('historial');

    try {
      const queryParams = new URLSearchParams({
        desde,
        hasta,
        limite: String(limite),
        pagina: String(pagina),
      });

      if (busqueda.trim()) queryParams.append('descripcion', busqueda.trim());

      const url = `${API_BASE_URL}/subcuenta/${subcuenta.subCuentaId}/movimientos?${queryParams.toString()}`;
      const res = await apiRateLimiter.fetch(url, { signal: controller.signal });

      if (controller.signal.aborted) return;

      const data = await res.json();

      // Caso 1: data.data (array)
      if (Array.isArray(data?.data)) {
        const movimientos = [...data.data].sort((a, b) => {
          const da = new Date(a.fecha || a.createdAt || 0).getTime();
          const db = new Date(b.fecha || b.createdAt || 0).getTime();
          return db - da;
        });

        const slice = movimientos.slice((pagina - 1) * limite, pagina * limite);
        if (!controller.signal.aborted && isMountedRef.current) {
          setHistorial(slice);
          setTotalPaginas(Math.max(1, Math.ceil(movimientos.length / limite)));
          if (!desde && !hasta && movimientos.length > 0) {
            const ultimo = movimientos[movimientos.length - 1];
            const fechaInicio = (ultimo.fecha || ultimo.createdAt || '').slice(0, 10);
            const fechaFin = new Date().toISOString().slice(0, 10);
            setDesde(fechaInicio);
            setHasta(fechaFin);
            setFechaAuto({ desde: fechaInicio, hasta: fechaFin });
          }
        }
        return;
      }

      // Caso 2: array directo
      if (Array.isArray(data)) {
        const inicio = (pagina - 1) * limite;
        const fin = inicio + limite;
        if (!controller.signal.aborted && isMountedRef.current) {
          setHistorial(data.slice(inicio, fin));
          setTotalPaginas(Math.max(1, Math.ceil(data.length / limite)));
        }
        return;
      }

      // Caso 3: resultados + totalPaginas
      if (Array.isArray(data?.resultados)) {
        if (!controller.signal.aborted && isMountedRef.current) {
          setHistorial(data.resultados);
          setTotalPaginas(data.totalPaginas || 1);
        }
        return;
      }

      // Caso 4: movimientos (array)
      if (Array.isArray(data?.movimientos)) {
        const inicio = (pagina - 1) * limite;
        const fin = inicio + limite;
        if (!controller.signal.aborted && isMountedRef.current) {
          setHistorial(data.movimientos.slice(inicio, fin));
          setTotalPaginas(Math.max(1, Math.ceil(data.movimientos.length / limite)));
        }
        return;
      }

      throw new Error('Respuesta inválida');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      Toast.show({
        type: 'error',
        text1: 'Error al cargar movimientos',
        text2: 'No se pudieron cargar los movimientos de la subcuenta',
      });
    } finally {
      if (isMountedRef.current) setLoadingHistorial(false);
    }
  }, [startRequest, subcuenta?.subCuentaId, desde, hasta, limite, pagina, busqueda]);

  useEffect(() => {
    fetchSubcuenta();
    fetchParticipacion();
  }, [reloadTrigger, fetchSubcuenta, fetchParticipacion]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  useEffect(() => {
    const offTx = dashboardRefreshBus.on('transacciones:changed', () => {
      fetchSubcuenta();
      fetchHistorial();
    });
    const offSub = dashboardRefreshBus.on('subcuentas:changed', () => {
      fetchSubcuenta();
      fetchHistorial();
    });

    return () => {
      offTx();
      offSub();
    };
  }, [fetchSubcuenta, fetchHistorial]);

  const toggleFiltros = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFiltrosOpen((v) => !v);
  }, []);

  const resetFiltros = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPagina(1);
    setBusqueda('');
    setDesde(fechaAuto.desde || '');
    setHasta(fechaAuto.hasta || '');
  }, [fechaAuto.desde, fechaAuto.hasta]);

  const handleEdit = useCallback(() => setEditVisible(true), []);
  const handleDelete = useCallback(() => {
    const saldo = Number(subcuenta?.cantidad ?? 0);
    if (saldo > 0) {
      setDeleteDecisionVisible(true);
      return;
    }
    setDeleteVisible(true);
  }, [subcuenta?.cantidad]);

  const afterSuccessfulDelete = useCallback(() => {
    emitSubcuentasChanged();
    emitViewerChanged();
    emitTransaccionesChanged();
    emitRecurrentesChanged();
    handleGlobalRefresh();

    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Dashboard', { updated: false } as any);
  }, [handleGlobalRefresh, navigation]);

  const performDelete = useCallback(
    async (action: DeleteSubcuentaAction, note?: string) => {
      if (!isMountedRef.current) return;
      const controller = startRequest('delete');

      try {
        setDeletingSubcuenta(true);

        const res = await subcuentasService.eliminarSubcuenta(subcuenta.subCuentaId, {
          action,
          ...(note ? { note } : {}),
        });

        if (controller.signal.aborted) return;

        const text2 =
          action === 'discard'
            ? 'Se eliminó la subcuenta y se descartó el saldo'
            : 'El saldo fue transferido a tu cuenta principal';

        Toast.show({
          type: 'success',
          text1: res?.message || 'Subcuenta eliminada',
          text2,
        });

        setDeleteVisible(false);
        setDeleteDecisionVisible(false);
        afterSuccessfulDelete();
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        Toast.show({
          type: 'error',
          text1: 'No se pudo eliminar la subcuenta',
          text2: String(err?.message || 'Inicia sesión de nuevo o inténtalo más tarde'),
          visibilityTime: 6000,
        });
        setDeleteVisible(false);
        setDeleteDecisionVisible(false);
      } finally {
        if (isMountedRef.current) setDeletingSubcuenta(false);
      }
    },
    [afterSuccessfulDelete, startRequest, subcuenta?.subCuentaId]
  );

  const confirmDelete = useCallback(async () => {
    // Sin saldo: transfer_to_principal y discard son equivalentes; usamos transfer_to_principal.
    await performDelete('transfer_to_principal');
  }, [performDelete]);

  const toggleEstadoSubcuenta = useCallback(async () => {
    try {
      const endpoint = `${API_BASE_URL}/subcuenta/${subcuenta.subCuentaId}/${subcuenta.activa ? 'desactivar' : 'activar'}`;

      const res = await apiRateLimiter.fetch(endpoint, { method: 'PATCH' });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'No se pudo cambiar el estado');
      }

      Toast.show({
        type: 'success',
        text1: subcuenta.activa ? 'Subcuenta desactivada' : 'Subcuenta activada',
        text2: `La subcuenta fue ${subcuenta.activa ? 'desactivada' : 'activada'} correctamente`,
      });

      setReloadTrigger((p) => p + 1);
      handleGlobalRefresh();
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Error al cambiar estado',
        text2: 'No se pudo actualizar el estado de la subcuenta',
      });
    }
  }, [handleGlobalRefresh, subcuenta?.activa, subcuenta?.subCuentaId]);

  const headerShadow = useMemo(() => {
    return scrollY.interpolate({
      inputRange: [0, 32, 120],
      outputRange: [0, 0.06, 0.12],
      extrapolate: 'clamp',
    });
  }, [scrollY]);

  const introStyle = useMemo(() => {
    const opacity = intro.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const translateY = intro.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
    return { opacity, transform: [{ translateY }] };
  }, [intro]);

  const loadingScale = useMemo(() => {
    return pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  }, [pulse]);

  const saldoLabel = useMemo(() => {
    if (subcuenta?.pausadaPorPlan) return 'Saldo actual (pausada por plan)';
    return 'Saldo actual';
  }, [subcuenta?.pausadaPorPlan]);

  const InfoTile = useCallback(
    ({
      icon,
      label,
      value,
      accent = warning,
      hint,
    }: {
      icon: IonName;
      label: string;
      value: string;
      accent?: string;
      hint?: string;
    }) => {
      return (
        <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <View style={styles.tileTop}>
            <View style={[styles.tileIcon, { backgroundColor: `${accent}14` }]}>
              <Ionicons name={icon} size={18} color={accent} />
            </View>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              {label}
            </Text>
          </View>

          <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>
            {value}
          </Text>

          {!!hint && (
            <Text style={[styles.tileHint, { color: colors.placeholder }]} numberOfLines={2}>
              {hint}
            </Text>
          )}
        </View>
      );
    },
    [colors.card, colors.border, colors.shadow, colors.text, colors.textSecondary, colors.placeholder]
  );

  const Section = useCallback(
    ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => {
      return (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
            {!!right && <View style={styles.sectionRight}>{right}</View>}
          </View>
          <View style={styles.sectionBody}>{children}</View>
        </View>
      );
    },
    [colors.card, colors.border, colors.shadow, colors.text]
  );

  const MotionRow = useCallback(
    ({ item, onPress }: { item: any; onPress: () => void }) => {
      const scale = useRef(new Animated.Value(1)).current;

      const tipo = pickTipo(item);
      const transferData = getTransferData(item);
      const isTransfer = tipo === 'transferencia';
      const transferIsExpense = isTransfer && (transferData.side === 'origen' || Number(item?.monto ?? 0) < 0);
      const isExpense = tipo === 'egreso' || transferIsExpense;
      const accent = isTransfer ? '#7b1fa2' : isExpense ? danger : success;
      const transferFallbackDescription =
        (transferData.side === 'origen' && transferData.destino?.nombre ? `Transferido a ${transferData.destino.nombre}` : '') ||
        (transferData.side === 'destino' && transferData.origen?.nombre ? `Transferido desde ${transferData.origen.nombre}` : '') ||
        pickDescripcion(item);

      const desc = isTransfer
        ? fixEncoding(
            String(
              item?.descripcion ?? item?.datos?.motivo ?? transferFallbackDescription
            )
          )
        : pickDescripcion(item);
      const date = pickDate(item);
      const amount = pickMonto(item);

      const leftIcon: IonName = isTransfer ? 'swap-horizontal' : isExpense ? 'arrow-up-circle' : 'arrow-down-circle';

      const hasMulti =
        item?.montoOriginal != null &&
        item?.moneda &&
        (item?.montoConvertido != null || item?.montoConvertidoCuenta != null || item?.montoConvertidoSubcuenta != null) &&
        (item?.monedaConvertida || item?.monedaConvertidaCuenta || item?.monedaConvertidaSubcuenta);

      const displayAmount = isTransfer && transferData.montoOrigen != null && transferData.monedaOrigen && transferData.montoDestino != null && transferData.monedaDestino
        ? `${transferData.side === 'origen' ? '-' : '+'}${formatCurrency(Number(transferData.side === 'origen' ? transferData.montoOrigen : transferData.montoDestino))} ${String(transferData.side === 'origen' ? transferData.monedaOrigen : transferData.monedaDestino)}`
        : hasMulti
        ? `${isExpense ? '-' : '+'}${formatCurrency(item.montoOriginal)} ${item.moneda} → ${formatCurrency(
            item.montoConvertido ?? item.montoConvertidoCuenta ?? item.montoConvertidoSubcuenta
          )} ${item.monedaConvertida ?? item.monedaConvertidaCuenta ?? item.monedaConvertidaSubcuenta}`
        : amount != null
        ? `${isExpense ? '-' : '+'}${subcuenta.simbolo || ''}${formatCurrency(amount)}`
        : '';

      return (
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 24, bounciness: 0 }).start();
          }}
          onPressOut={() => {
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
          }}
          style={{ marginBottom: 10 }}
        >
          <Animated.View
            style={[
              styles.row,
              {
                transform: [{ scale }],
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: colors.shadow,
                borderLeftColor: accent,
              },
            ]}
          >
            <View style={styles.rowLeft}>
              <Ionicons name={leftIcon} size={26} color={accent} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {desc}
                </Text>

                {!!(item?.motivo || item?.datos?.motivo) && (
                  <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {fixEncoding(item?.motivo ?? item?.datos?.motivo)}
                  </Text>
                )}

                <Text style={[styles.rowMeta, { color: colors.placeholder }]} numberOfLines={1}>
                  {date ? formatDate(date) : '—'}
                </Text>
              </View>
            </View>

            <View style={styles.rowRight}>
              {!!displayAmount && (
                <Text style={[styles.rowAmount, { color: accent }]} numberOfLines={2}>
                  {displayAmount}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          </Animated.View>
        </Pressable>
      );
    },
    [
      colors.card,
      colors.border,
      colors.shadow,
      colors.text,
      colors.textSecondary,
      colors.placeholder,
      danger,
      success,
      formatCurrency,
      formatDate,
      pickDate,
      pickDescripcion,
      getTransferData,
      pickMonto,
      pickTipo,
      subcuenta?.simbolo,
    ]
  );

  // Guard clauses UI
  if (loadingSubcuenta && !subcuenta?.cuentaId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.loaderWrap, { backgroundColor: colors.background }]}>
          <Animated.View style={[styles.loaderCard, { backgroundColor: colors.card, shadowColor: colors.shadow, transform: [{ scale: loadingScale }] }]}>
            <Ionicons name="wallet-outline" size={56} color={warning} />
            <ActivityIndicator size="large" color={colors.text} style={{ marginTop: 14 }} />
          </Animated.View>
          <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Cargando subcuenta…</Text>
        </View>
      </View>
    );
  }

  if (!subcuenta?.cuentaId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={34} color={colors.textSecondary} />
        <Text style={[styles.centerTitle, { color: colors.text }]}>Subcuenta sin cuenta principal</Text>
        <Text style={[styles.centerSub, { color: colors.textSecondary }]}>Vuelve al dashboard y revisa la configuración.</Text>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard', { updated: false } as any))}
          style={[styles.primaryBtn, { backgroundColor: warning }]}
          activeOpacity={0.9}
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Regresar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusBg = subcuenta.activa ? '#FFF7ED' : '#FEF2F2';
  const statusColor = subcuenta.activa ? warning : danger;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background as any} />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            shadowColor: colors.shadow,
            shadowOpacity: headerShadow,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingHorizontal: 10 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {subcuenta.nombre || '—'}
            </Text>

            <View style={[styles.statusPill, { backgroundColor: statusBg, borderColor: colors.border }]}>
              <Ionicons name={subcuenta.activa ? 'checkmark-circle-outline' : 'close-circle-outline'} size={15} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>{subcuenta.activa ? 'Activa' : 'Inactiva'}</Text>
              {subcuenta.pausadaPorPlan ? (
                <View style={[styles.lockMini, { backgroundColor: `${warning}12` }]}>
                  <Ionicons name="lock-closed" size={13} color={warning} />
                  <Text style={[styles.lockMiniText, { color: warning }]}>Plan</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Quick actions */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
              onPress={handleEdit}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={20} color={warning} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
              onPress={handleDelete}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={20} color={danger} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 34 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        <Animated.View style={[{ paddingHorizontal: SP, paddingTop: 14 }, introStyle]}>
          {/* Balance Hero */}
          <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={styles.heroTop}>
              <View style={[styles.colorDot, { backgroundColor: subcuenta.color || '#9CA3AF', borderColor: colors.card }]} />
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>{saldoLabel}</Text>
            </View>

            <View style={styles.heroAmountRow}>
              <Text style={[styles.heroSymbol, { color: colors.text }]}>{subcuenta.simbolo || '—'}</Text>
              <Text style={[styles.heroAmount, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(subcuenta.cantidad)}
              </Text>
              <Text style={[styles.heroCode, { color: colors.textSecondary }]}>{subcuenta.moneda || ''}</Text>
            </View>

            <View style={styles.heroMetaRow}>
              <View style={[styles.metaPill, { backgroundColor: cardSecondary, borderColor: colors.border }]}>
                <Ionicons name="finger-print-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{(subcuenta.subCuentaId || '—').slice(-8)}</Text>
              </View>

              <View style={[styles.metaPill, { backgroundColor: cardSecondary, borderColor: colors.border }]}>
                <Ionicons name={subcuenta.afectaCuenta ? 'trending-up-outline' : 'remove-circle-outline'} size={14} color={subcuenta.afectaCuenta ? warning : colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{subcuenta.afectaCuenta ? 'Afecta cuenta' : 'Independiente'}</Text>
              </View>

              {subcuenta.origenSaldo ? (
                <View style={[styles.metaPill, { backgroundColor: cardSecondary, borderColor: colors.border }]}>
                  <Ionicons name="swap-horizontal-outline" size={14} color={warning} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {subcuenta.origenSaldo === 'cuenta_principal' ? 'Apartado' : 'Nuevo'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Actions */}
          <View style={{ marginTop: 14 }}>
            <ActionButtons
              cuentaId={subcuenta.cuentaId!}
              isSubcuenta
              subcuenta={{
                cuentaPrincipalId: subcuenta.cuentaId!,
                subCuentaId: subcuenta.subCuentaId,
              }}
              fetchSubcuenta={fetchSubcuenta}
              onRefresh={() => {
                fetchSubcuenta();
                fetchHistorial();
                handleGlobalRefresh();
              }}
              userId={userId!}
            />
          </View>

          {/* Recurrentes */}
          <View style={{ marginTop: 14 }}>
            <SubaccountRecurrentesList subcuentaId={subcuenta.subCuentaId} userId={userId!} />
          </View>

          {/* Quick tiles */}
          <View style={styles.grid}>
            <InfoTile
              icon="wallet-outline"
              label="Cuenta principal"
              value={subcuenta.cuentaId?.slice(-8) || '—'}
              accent={warning}
              hint="ID corto"
            />
            <InfoTile
              icon={subcuenta.afectaCuenta ? 'checkmark-circle-outline' : 'close-circle-outline'}
              label="Impacto"
              value={subcuenta.afectaCuenta ? 'Sí afecta' : 'No afecta'}
              accent={subcuenta.afectaCuenta ? warning : colors.textSecondary}
              hint={subcuenta.afectaCuenta ? 'Modifica el saldo principal' : 'Saldo separado'}
            />
            {participacion !== null ? (
              <InfoTile icon="pie-chart-outline" label="Participación" value={`${participacion.toFixed(1)}%`} accent={warning} hint="En el total de subcuentas" />
            ) : (
              <InfoTile icon="calendar-outline" label="Actualizado" value={(subcuenta.updatedAt || '').slice(0, 10) || '—'} accent={warning} hint="Última actualización" />
            )}
            <InfoTile icon="person-outline" label="Usuario" value={subcuenta.userId?.slice(-12) || '—'} accent={warning} hint="ID corto" />
          </View>

          {/* Movimientos */}
          <Section
            title="Movimientos"
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    toggleFiltros();
                    if (!filtrosOpen) setTimeout(scrollToSearch, 50);
                  }}
                  activeOpacity={0.85}
                  style={[styles.chip, { backgroundColor: cardSecondary, borderColor: colors.border }]}
                >
                  <Ionicons name="options-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.chipText, { color: colors.textSecondary }]}>{filtrosOpen ? 'Ocultar' : 'Filtros'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={resetFiltros} activeOpacity={0.85} style={[styles.chip, { backgroundColor: cardSecondary, borderColor: colors.border }]}>
                  <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            }
          >
            <View ref={searchContainerRef} style={[styles.searchWrap, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Buscar en historial…"
                value={busqueda}
                onChangeText={(t) => {
                  setPagina(1);
                  setBusqueda(t);
                }}
                onFocus={scrollToSearch}
                style={[styles.searchInput, { color: colors.text }]}
                placeholderTextColor={colors.placeholder}
                returnKeyType="search"
              />
              {!!busqueda && (
                <TouchableOpacity
                  onPress={() => {
                    setPagina(1);
                    setBusqueda('');
                  }}
                  activeOpacity={0.85}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {filtrosOpen ? (
              <View style={{ marginTop: 12 }}>
                <View style={styles.datesRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Desde</Text>
                    <TextInput
                      style={[styles.dateInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={desde || fechaAuto.desde}
                      onChangeText={(t) => {
                        setPagina(1);
                        setDesde(t);
                      }}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                  <View style={{ width: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Hasta</Text>
                    <TextInput
                      style={[styles.dateInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                      value={hasta || fechaAuto.hasta}
                      onChangeText={(t) => {
                        setPagina(1);
                        setHasta(t);
                      }}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                </View>

                <View style={[styles.tipBox, { backgroundColor: `${warning}10`, borderColor: `${warning}25` }]}>
                  <Ionicons name="information-circle-outline" size={16} color={warning} />
                  <Text style={[styles.tipText, { color: colors.textSecondary }]}>Tip: si dejas vacío, se toma el rango automático.</Text>
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: 14 }}>
              {loadingHistorial ? (
                <View style={[styles.skeletonBox, { backgroundColor: cardSecondary, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={[styles.skeletonText, { color: colors.textSecondary }]}>Cargando movimientos…</Text>
                </View>
              ) : historial.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="document-text-outline" size={44} color={colors.border} />
                  <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Sin movimientos</Text>
                  <Text style={[styles.emptySub, { color: colors.placeholder }]}>Los movimientos aparecerán aquí cuando se registren.</Text>
                </View>
              ) : (
                <FlatList
                  data={historial}
                  keyExtractor={(item, idx) => String(item?._id ?? idx)}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <MotionRow
                      item={item}
                      onPress={() => {
                        setMovimientoSeleccionado(item);
                        setDetalleVisible(true);
                      }}
                    />
                  )}
                />
              )}
            </View>

            {/* Pagination */}
            {historial.length > 0 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  onPress={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  activeOpacity={0.85}
                  style={[
                    styles.pageBtn,
                    {
                      backgroundColor: pagina === 1 ? cardSecondary : warning,
                      borderColor: colors.border,
                      opacity: pagina === 1 ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="chevron-back-outline" size={18} color={pagina === 1 ? colors.placeholder : '#fff'} />
                  <Text style={[styles.pageBtnText, { color: pagina === 1 ? colors.placeholder : '#fff' }]}>Anterior</Text>
                </TouchableOpacity>

                <View style={styles.pageInfo}>
                  <Text style={[styles.pageText, { color: colors.textSecondary }]}>
                    {pagina} / {totalPaginas}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setPagina((p) => (p < totalPaginas ? p + 1 : p))}
                  disabled={pagina === totalPaginas}
                  activeOpacity={0.85}
                  style={[
                    styles.pageBtn,
                    {
                      backgroundColor: pagina === totalPaginas ? cardSecondary : warning,
                      borderColor: colors.border,
                      opacity: pagina === totalPaginas ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.pageBtnText, { color: pagina === totalPaginas ? colors.placeholder : '#fff' }]}>Siguiente</Text>
                  <Ionicons name="chevron-forward-outline" size={18} color={pagina === totalPaginas ? colors.placeholder : '#fff'} />
                </TouchableOpacity>
              </View>
            ) : null}
          </Section>

          {/* Bottom actions */}
          <Section title="Acciones">
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: warning, shadowColor: colors.shadow }]}
                onPress={handleEdit}
                activeOpacity={0.9}
              >
                <Ionicons name="create-outline" size={18} color={warning} />
                <Text style={[styles.actionText, { color: warning }]}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: danger, shadowColor: colors.shadow }]}
                onPress={handleDelete}
                activeOpacity={0.9}
              >
                <Ionicons name="trash-outline" size={18} color={danger} />
                <Text style={[styles.actionText, { color: danger }]}>Eliminar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: subcuenta.pausadaPorPlan ? warning : subcuenta.activa ? danger : success,
                    shadowColor: colors.shadow,
                    opacity: subcuenta.pausadaPorPlan ? 0.6 : 1,
                  },
                ]}
                activeOpacity={0.9}
                disabled={subcuenta.pausadaPorPlan}
                onPress={() => {
                  if (subcuenta.pausadaPorPlan) {
                    Toast.show({
                      type: 'info',
                      text1: '🔒 Pausada automáticamente',
                      text2: 'Actualiza a Premium para reactivarla y crear subcuentas ilimitadas.',
                      visibilityTime: 5000,
                    });
                    return;
                  }
                  toggleEstadoSubcuenta();
                }}
              >
                <Ionicons
                  name={subcuenta.pausadaPorPlan ? 'lock-closed' : subcuenta.activa ? 'pause-circle-outline' : 'play-circle-outline'}
                  size={18}
                  color={subcuenta.pausadaPorPlan ? warning : subcuenta.activa ? danger : success}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: subcuenta.pausadaPorPlan ? warning : subcuenta.activa ? danger : success, fontSize: 13 },
                  ]}
                  numberOfLines={1}
                >
                  {subcuenta.pausadaPorPlan ? 'Requiere Premium' : subcuenta.activa ? 'Desactivar' : 'Activar'}
                </Text>
              </TouchableOpacity>
            </View>
          </Section>
        </Animated.View>
      </Animated.ScrollView>

      {/* Modals */}
      <MovimientoDetalleModal visible={detalleVisible} onClose={() => setDetalleVisible(false)} movimiento={movimientoSeleccionado} simbolo={subcuenta.simbolo} />

      <EditSubaccountModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        subcuenta={subcuenta}
        onSuccess={() => {
          setEditVisible(false);
          fetchSubcuenta();
          emitSubcuentasChanged();
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Dashboard', { updated: false } as any);
        }}
      />

      <DeleteModal
        visible={deleteVisible}
        onCancel={() => setDeleteVisible(false)}
        onConfirm={confirmDelete}
        title="Eliminar Subcuenta"
        message="¿Estás seguro de que deseas eliminar esta Subcuenta? Esta acción no se puede deshacer."
      />

      <SubaccountDeleteDecisionModal
        visible={deleteDecisionVisible}
        onCancel={() => setDeleteDecisionVisible(false)}
        onSubmit={(action, note) => performDelete(action, note)}
        nombre={subcuenta.nombre}
        saldo={Number(subcuenta.cantidad || 0)}
        simbolo={subcuenta.simbolo}
        loading={deletingSubcuenta}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: SP,
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusPill: {
    marginTop: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  lockMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 6,
  },
  lockMiniText: {
    fontSize: 11,
    fontWeight: '800',
  },

  hero: {
    borderRadius: R + 6,
    borderWidth: 1,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroAmountRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
  },
  heroSymbol: {
    fontSize: 24,
    fontWeight: '900',
    marginRight: 4,
  },
  heroAmount: {
    fontSize: Math.min(44, Math.max(34, width * 0.11)),
    fontWeight: '900',
    letterSpacing: -1.2,
    flexShrink: 1,
  },
  heroCode: {
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  heroMetaRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '800',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 3,
  },

  grid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '48%',
    borderRadius: R,
    borderWidth: 1,
    padding: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  tileValue: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  tileHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },

  section: {
    marginTop: 14,
    borderRadius: R + 2,
    borderWidth: 1,
    padding: 14,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionBody: {
    marginTop: 12,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
  },
  clearBtn: {
    marginLeft: 8,
  },

  datesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  dateInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '700',
  },

  tipBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  skeletonBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skeletonText: {
    fontSize: 13,
    fontWeight: '800',
  },

  row: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderLeftWidth: 5,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  rowAmount: {
    fontSize: 13,
    fontWeight: '900',
    maxWidth: 200,
    textAlign: 'right',
  },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 10,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '900',
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },

  pagination: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  pageInfo: {
    flex: 1,
    alignItems: 'center',
  },
  pageText: {
    fontSize: 12,
    fontWeight: '900',
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '900',
  },

  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loaderCard: {
    width: 210,
    height: 210,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 10,
  },
  loaderText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '900',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  centerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  centerSub: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
  primaryBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});

export default SubaccountDetail;
