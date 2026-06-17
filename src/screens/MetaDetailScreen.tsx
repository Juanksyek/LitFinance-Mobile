import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import ConfettiOverlay from '../components/ConfettiOverlay';

import { useThemeColors } from '../theme/useThemeColors';
import metasService from '../services/metasService';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type {
  Meta,
  MetaHistorialItem,
  MetaCompletionMetaAction,
  MetaCompletionMoneyAction,
  ResolveMetaCompletionRequest,
} from '../types/metas';
import SmartNumber from '../components/SmartNumber';
import { buscarMonedaPorCodigo } from '../constants/monedas';
import { useNumericInput } from '../hooks/useNumericInput';
import { createIdempotencyKey } from '../utils/idempotency';

type ScreenRoute = RouteProp<RootStackParamList, 'MetaDetail'>;
type MovimientoKind = 'ingreso' | 'egreso';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const withAlpha = (color: string, alpha: number) => {
  const a = clamp(alpha, 0, 1);
  const c = (color || '').trim();
  if (c.startsWith('#')) {
    const hex = c.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      if ([r, g, b].every((x) => Number.isFinite(x))) return `rgba(${r},${g},${b},${a})`;
    }
  }
  return c;
};

const formatDateTime = (value: any) => {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const MetaDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<ScreenRoute>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // ✅ estabiliza bottom inset para que no cambie con teclado (evita recortes/jumps)
  const [stableBottomInset, setStableBottomInset] = useState(insets.bottom);
  useEffect(() => {
    setStableBottomInset((prev) => Math.max(prev, insets.bottom));
  }, [insets.bottom]);

  const metaId = route.params.metaId;
  const initialRouteMeta = (route.params as any)?.meta;

  const [meta, setMeta] = useState<Meta | null>(null);
    useEffect(() => {
      if (!meta && initialRouteMeta) setMeta(initialRouteMeta);
    }, [initialRouteMeta, meta]);

  const [historial, setHistorial] = useState<MetaHistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Celebration state
  const [confettiVisible, setConfettiVisible] = useState(false);
  const prevCompletionRef = useRef<boolean | null>(null);
  const celebratedOnOpenRef = useRef(false);
  const completionJustHappenedRef = useRef(false);
  const celebrateOnNextLoadRef = useRef(true);

  // Completion decision modal
  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [resolvingDecision, setResolvingDecision] = useState(false);
  const [moneyAction, setMoneyAction] = useState<MetaCompletionMoneyAction>('keep');
  const [metaAction, setMetaAction] = useState<MetaCompletionMetaAction>('none');
  const [moveToMain, setMoveToMain] = useState(true);
  const [motivo, setMotivo] = useState('');
  const decisionAmount = useNumericInput({
    initialValue: 0,
    context: `meta_completion_amount_${metaId}`,
    allowNegative: false,
    allowDecimals: true,
    maxDecimals: 2,
    minValue: 0,
  });
  const resetObjetivoInput = useNumericInput({
    initialValue: 0,
    context: `meta_completion_reset_obj_${metaId}`,
    allowNegative: false,
    allowDecimals: true,
    maxDecimals: 2,
    minValue: 0,
  });
  const [resetFechaObjetivo, setResetFechaObjetivo] = useState('');
  const decisionAutoOpenedRef = useRef(false);
  const decisionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [statusSaving, setStatusSaving] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [movOpen, setMovOpen] = useState<MovimientoKind | null>(null);
  const [savingMov, setSavingMov] = useState(false);
  const movMonto = useNumericInput({
    initialValue: 0,
    context: 'default',
    allowNegative: false,
    allowDecimals: true,
    maxDecimals: 2,
    minValue: 0,
  });
  const [movDesc, setMovDesc] = useState('');

  // Header + sheet anims
  const headerShadow = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const progressAnim = useRef(new Animated.Value(0)).current;

  const sheetAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [enter]);

  const symbol = useMemo(() => {
    const m = meta?.moneda;
    if (!m) return '$';
    return buscarMonedaPorCodigo(m)?.simbolo ?? '$';
  }, [meta?.moneda]);

  const objetivo = useMemo(() => {
    const o = (meta as any)?.objetivo ?? (meta as any)?.objetivoMonto ?? 0;
    return Number(o ?? 0);
  }, [meta]);

  const saldo = useMemo(() => Number(meta?.saldoActual ?? 0), [meta?.saldoActual]);

  const progress = useMemo(() => {
    const p = (meta as any)?.progreso;
    if (typeof p === 'number' && Number.isFinite(p)) return clamp(p, 0, 1);
    if (!meta || !(objetivo > 0)) return 0;
    return clamp(saldo / objetivo, 0, 1);
  }, [meta, objetivo, saldo]);

  const computeIsCompleted = useCallback((value: any) => {
    const completion = value?.completion;
    const completionFlag = completion?.isCompleted;
    if (typeof completionFlag === 'boolean') return completionFlag;
    if (typeof completionFlag === 'number') return completionFlag === 1;
    if (typeof completionFlag === 'string') {
      const s = completionFlag.toLowerCase().trim();
      if (s === 'true' || s === '1' || s === 'yes' || s === 'si') return true;
      if (s === 'false' || s === '0' || s === 'no') return false;
    }

    const e = String(value?.estado ?? '').toLowerCase();
    if (e.includes('cumpl') || e.includes('complet')) return true;

    const o = Number(value?.objetivo ?? value?.objetivoMonto ?? 0);
    const s = Number(value?.saldoActual ?? 0);
    if (o > 0) return s / o >= 1;
    return false;
  }, []);

  const isCompleted = useMemo(() => computeIsCompleted(meta), [computeIsCompleted, meta]);

  const pendingDecision = useMemo(() => {
    const completion = (meta as any)?.completion;
    if (completion && typeof completion.pendingDecision === 'boolean') return !!completion.pendingDecision;
    return false;
  }, [meta]);

  const iconName = useMemo(() => {
    return (meta as any)?.icon || (meta as any)?.icono || (meta as any)?.iconName || 'pricetag-outline';
  }, [meta]);

  const getColorForIcon = useCallback(
    (name: string) => {
      const n = String(name || '').toLowerCase();
      if (n.includes('heart') || n.includes('like') || n.includes('favorite')) return '#ef4444';
      if (n.includes('car') || n.includes('auto') || n.includes('car-sport')) return '#0ea5e9';
      if (n.includes('home') || n.includes('house')) return '#10b981';
      if (n.includes('wallet') || n.includes('cash') || n.includes('card')) return '#7c3aed';
      if (n.includes('restaurant') || n.includes('food') || n.includes('fast-food')) return '#f59e0b';
      if (n.includes('fitness') || n.includes('bicycle') || n.includes('walk')) return '#06b6d4';
      if (n.includes('star')) return '#f97316';
      return colors.button || '#2563eb';
    },
    [colors.button]
  );

  const iconColor = useMemo(() => {
    const metaColor = (meta as any)?.color || (meta as any)?.hexColor;
    return metaColor ? String(metaColor) : getColorForIcon(iconName);
  }, [meta, iconName, getColorForIcon]);

  const iconBgColor = useMemo(() => withAlpha(iconColor, 0.12), [iconColor]);
  const barColor = useMemo(() => iconColor, [iconColor]);

  useEffect(() => {
    // Reset per-meta refs/timers when navigating between metas
    celebratedOnOpenRef.current = false;
    completionJustHappenedRef.current = false;
    celebrateOnNextLoadRef.current = true;
    decisionAutoOpenedRef.current = false;
    if (decisionTimerRef.current) {
      clearTimeout(decisionTimerRef.current);
      decisionTimerRef.current = null;
    }
  }, [metaId]);

  const triggerConfetti = useCallback(() => {
    setConfettiVisible(false);
    setTimeout(() => setConfettiVisible(true), 220);
  }, []);

  useEffect(() => {
    if (prevCompletionRef.current == null) {
      prevCompletionRef.current = isCompleted;
      return;
    }
    if (prevCompletionRef.current === false && isCompleted === true) {
      completionJustHappenedRef.current = true;
      setConfettiVisible(true);
    }
    prevCompletionRef.current = isCompleted;
  }, [isCompleted]);

  const onConfettiDone = useCallback(() => {
    setConfettiVisible(false);
    // Only refresh the metas list automatically when completion *just happened*.
    if (completionJustHappenedRef.current) {
      completionJustHappenedRef.current = false;
      try {
        const EventBus = require('../utils/eventBus').default;
        EventBus.emit('metas:changed');
      } catch {}
    }
  }, []);

  const openDecisionModal = useCallback(() => {
    setMoneyAction('keep');
    setMetaAction('none');
    setMoveToMain(true);
    setMotivo('');
    decisionAmount.clear();
    resetObjetivoInput.clear();
    setResetFechaObjetivo('');
    setDecisionModalVisible(true);
  }, [decisionAmount, resetObjetivoInput]);

  const closeDecisionModal = useCallback(() => {
    setDecisionModalVisible(false);
  }, []);

  const formatMoneyAction = useCallback((v: MetaCompletionMoneyAction) => {
    if (v === 'keep') return 'Mantener en la meta';
    if (v === 'transfer_to_main') return 'Transferir a principal';
    return 'Marcar como usado';
  }, []);

  const formatMetaAction = useCallback((v: MetaCompletionMetaAction) => {
    if (v === 'none') return 'Sin cambios';
    if (v === 'archive') return 'Archivar meta';
    if (v === 'reset') return 'Reiniciar meta';
    return 'Duplicar meta';
  }, []);

  const validateIsoDate = useCallback((s: string) => {
    const v = (s || '').trim();
    if (!v) return true;
    const t = Date.parse(v);
    return Number.isFinite(t);
  }, []);

  useEffect(() => {
    // Auto-open decision modal when the backend says it's needed.
    if (!meta) return;
    if (!pendingDecision) return;
    if (decisionAutoOpenedRef.current) return;

    decisionAutoOpenedRef.current = true;
    const delay = isCompleted ? 1100 : 280;
    decisionTimerRef.current = setTimeout(() => {
      openDecisionModal();
    }, delay);

    return () => {
      if (decisionTimerRef.current) {
        clearTimeout(decisionTimerRef.current);
        decisionTimerRef.current = null;
      }
    };
  }, [isCompleted, meta, openDecisionModal, pendingDecision]);

  useEffect(() => {
    Animated.spring(progressAnim, { toValue: progress, friction: 10, tension: 120, useNativeDriver: false }).start();
  }, [progress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_W - 32 - 28],
  });

  const remaining = useMemo(() => Math.max(0, (objetivo || 0) - (saldo || 0)), [objetivo, saldo]);

  const startDateRaw = useMemo(() => (meta as any)?.fechaInicio ?? meta?.createdAt ?? null, [meta]);
  const endDateRaw = useMemo(() => (meta as any)?.fechaFin ?? (meta as any)?.fechaObjetivo ?? null, [meta]);

  const formatShortDate = useCallback((value: any) => {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      const now = new Date();
      const opts: any = { day: '2-digit', month: 'short' };
      if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
      return d.toLocaleDateString('es-MX', opts);
    } catch {
      return '';
    }
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        if (!opts?.silent) setLoading(true);

        const [detail, hist] = await Promise.all([
          metasService.getMetaDetail(metaId),
          metasService.getHistorial(metaId, { page: 1, limit: 20 }).catch(() => []),
        ]);

        setMeta(detail);
        setHistorial(Array.isArray(hist) ? hist : []);

        // Celebrate once after load when requested (e.g. on focus/open)
        if (celebrateOnNextLoadRef.current) {
          celebrateOnNextLoadRef.current = false;
          if (computeIsCompleted(detail)) {
            celebratedOnOpenRef.current = true;
            triggerConfetti();
          }
        }
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo cargar la meta' });
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [computeIsCompleted, metaId, triggerConfetti]
  );

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Focus refresh: keep callback stable to avoid infinite loops.
      celebrateOnNextLoadRef.current = true;
      celebratedOnOpenRef.current = false;
      setConfettiVisible(false);
      load({ silent: true }).catch(() => null);
      return () => {};
    }, [load])
  );

  const submitDecision = useCallback(async () => {
    if (!meta) return;
    if (resolvingDecision) return;

    if (moneyAction === 'mark_used' && !motivo.trim()) {
      Toast.show({ type: 'error', text1: 'Falta motivo', text2: 'Escribe por qué se marcó como usado.' });
      return;
    }

    if (metaAction === 'reset' && !validateIsoDate(resetFechaObjetivo)) {
      Toast.show({ type: 'error', text1: 'Fecha inválida', text2: 'Usa un formato válido (ej. 2026-09-30).' });
      return;
    }

    const amount = decisionAmount.numericValue;
    if (amount != null && Number.isFinite(amount) && amount < 0) {
      Toast.show({ type: 'error', text1: 'Monto inválido' });
      return;
    }

    const body: ResolveMetaCompletionRequest = {
      moneyAction,
      metaAction,
    };

    if (moneyAction === 'transfer_to_main') {
      if (amount != null && Number.isFinite(amount) && amount > 0) body.amount = amount;
    }

    if (moneyAction === 'mark_used') {
      body.motivo = motivo.trim();
      body.moveToMain = !!moveToMain;
      if (amount != null && Number.isFinite(amount) && amount > 0) body.amount = amount;
    }

    if (metaAction === 'reset') {
      const nextObj = resetObjetivoInput.numericValue;
      if (nextObj != null && Number.isFinite(nextObj) && nextObj > 0) body.resetObjetivo = nextObj;
      const nextFecha = resetFechaObjetivo.trim();
      if (nextFecha) body.resetFechaObjetivo = nextFecha;
    }

    try {
      setResolvingDecision(true);
      const res = await metasService.resolveCompletion(metaId, body);
      Toast.show({ type: 'success', text1: 'Listo', text2: res?.message || 'Decisión guardada.' });
      setDecisionModalVisible(false);
      // Refetch to reflect pendingDecision=false, estado changes, saved decision, etc.
      await load({ silent: true });
      try {
        const EventBus = require('../utils/eventBus').default;
        EventBus.emit('metas:changed');
      } catch {}
    } catch (e: any) {
      const msg = e?.body?.message || e?.message || 'No se pudo guardar la decisión';
      Toast.show({ type: 'error', text1: 'Error', text2: String(msg) });
    } finally {
      setResolvingDecision(false);
    }
  }, [
    decisionAmount.numericValue,
    load,
    meta,
    metaAction,
    metaId,
    moneyAction,
    motivo,
    moveToMain,
    resetFechaObjetivo,
    resetObjetivoInput.numericValue,
    resolvingDecision,
    validateIsoDate,
  ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 800, useNativeDriver: true })).start();

    try {
      await load({ silent: true });
    } finally {
      rotate.stopAnimation(() => rotate.setValue(0));
      setRefreshing(false);
    }
  }, [load, rotate]);

  const openMovimiento = useCallback(
    (kind: MovimientoKind) => {
      if (!meta) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMovOpen(kind);
      movMonto.clear();
      setMovDesc('');

      sheetAnim.setValue(0);
      backdropAnim.setValue(0);
      sheetScale.setValue(0.995);

      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(sheetScale, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    },
    [backdropAnim, meta, movMonto, sheetAnim, sheetScale]
  );

  const closeMovimiento = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetScale, { toValue: 0.995, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMovOpen(null);
      movMonto.clear();
      setMovDesc('');
    });
  }, [backdropAnim, movMonto, sheetAnim, sheetScale]);

  const submitMovimiento = useCallback(async () => {
    const amount = Number(movMonto.numericValue ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      Toast.show({ type: 'error', text1: 'Monto inválido', text2: 'Ingresa un monto mayor a 0' });
      return;
    }
    if (!movOpen) return;

    const idempotencyKey = createIdempotencyKey(`meta_${movOpen}`);

    try {
      setSavingMov(true);

      if (movOpen === 'ingreso') {
        try {
          await metasService.ingreso(metaId, { monto: amount, idempotencyKey, nota: movDesc.trim() || undefined });
        } catch (e: any) {
          if (e?.status === 404 || e?.status === 405) {
            await metasService.aportar(metaId, { monto: amount, descripcion: movDesc.trim() || undefined, idempotencyKey });
          } else throw e;
        }
      } else {
        try {
          await metasService.egreso(metaId, { monto: amount, moneda: meta?.moneda, idempotencyKey, nota: movDesc.trim() || undefined });
        } catch (e: any) {
          if (e?.status === 404 || e?.status === 405) {
            await metasService.retirar(metaId, { monto: amount, descripcion: movDesc.trim() || undefined, idempotencyKey });
          } else throw e;
        }
      }

      await load({ silent: true });
      Toast.show({ type: 'success', text1: movOpen === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado' });
      closeMovimiento();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo guardar el movimiento' });
    } finally {
      setSavingMov(false);
    }
  }, [closeMovimiento, load, meta?.moneda, metaId, movDesc, movMonto.numericValue, movOpen]);

  const changeStatus = useCallback(
    async (action: 'pausar' | 'reanudar') => {
      const doIt = async () => {
        try {
          setStatusSaving(true);
          const next = action === 'pausar' ? await metasService.pausar(metaId) : await metasService.reanudar(metaId);

          setMeta(next);
          Toast.show({ type: 'success', text1: 'Estado actualizado' });

          if (action === 'reanudar') {
            navigation.navigate('Metas', { initialFilter: 'activa', refreshKey: Date.now() });
          }
        } catch (e: any) {
          if (e?.status === 429) {
            Toast.show({ type: 'error', text1: 'Espera un momento', text2: 'Estamos recibiendo muchas solicitudes. Intenta de nuevo en unos segundos.' });
          } else {
            Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo actualizar el estado' });
          }
        } finally {
          setStatusSaving(false);
        }
      };

      doIt();
    },
    [metaId, navigation]
  );

  const confirmDelete = useCallback(async () => {
    if (!meta) return;
    try {
      setDeleting(true);
      const res = await metasService.deleteMeta(metaId);
      Toast.show({ type: 'success', text1: 'Eliminada', text2: (res && (res.message || (res as any).message)) || 'Meta y su historial eliminados' });
      navigation.navigate('Metas', { refreshKey: Date.now() });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo eliminar la meta' });
    } finally {
      setDeleting(false);
      setDeleteModalVisible(false);
    }
  }, [meta, metaId, navigation]);

  const onScroll = useCallback(
    (e: any) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      headerShadow.setValue(clamp(y / 18, 0, 1));
    },
    [headerShadow]
  );

  const headerBgOpacity = headerShadow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const headerBorderOpacity = headerShadow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const refreshRotate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const sheetTranslateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H, 0] });
  const sheetTitle = movOpen === 'ingreso' ? 'Nuevo ingreso' : movOpen === 'egreso' ? 'Nuevo egreso' : '';
  const quickAmounts = useMemo(() => [100, 200, 500, 1000], []);
  const estadoLabel = useMemo(() => String((meta as any)?.estado ?? '—'), [meta]);

  const estadoTone = useMemo(() => {
    const e = String((meta as any)?.estado ?? '').toLowerCase();
    if (e.includes('activa')) return withAlpha(colors.button, 0.12);
    if (e.includes('paus')) return 'rgba(245,158,11,0.14)';
    if (e.includes('arch')) return 'rgba(239,68,68,0.12)';
    return withAlpha(colors.textSecondary, 0.12);
  }, [colors.button, colors.textSecondary, meta]);

  const tipoBadge = useCallback(
    (t: any) => {
      const s = String(t || '').toLowerCase();
      if (s.includes('ingreso') || s.includes('aporta') || s.includes('deposit')) return { icon: 'add', bg: withAlpha(colors.button, 0.12) };
      if (s.includes('egreso') || s.includes('reti') || s.includes('withdraw')) return { icon: 'remove', bg: 'rgba(239,68,68,0.12)' };
      return { icon: 'swap-horizontal', bg: withAlpha(colors.textSecondary, 0.10) };
    },
    [colors.button, colors.textSecondary]
  );

  const renderHistItem = useCallback(
    ({ item }: { item: MetaHistorialItem }) => {
      const badge = tipoBadge((item as any)?.tipo);
      const note = (item as any)?.nota ?? (item as any)?.descripcion ?? '';

      return (
        <View style={[styles.histItem, { borderColor: colors.border }]}>
          <View style={[styles.histBadge, { backgroundColor: badge.bg, borderColor: colors.border }]}>
            <Ionicons name={badge.icon as any} size={16} color={colors.text} />
          </View>

          <View style={styles.histLeft}>
            <Text style={[styles.histType, { color: colors.text }]} numberOfLines={1}>
              {(item as any)?.tipo ?? 'Movimiento'}
            </Text>
            <Text style={[styles.histDate, { color: colors.textSecondary }]} numberOfLines={1}>
              {formatDateTime((item as any)?.createdAt)}
              {note ? ` • ${note}` : ''}
            </Text>
          </View>

          {typeof (item as any)?.monto === 'number' ? (
            <SmartNumber
              value={(item as any)?.monto}
              options={{ context: 'list', currency: (item as any)?.moneda ?? meta?.moneda, symbol }}
              textStyle={[styles.histAmount, { color: colors.text }]}
            />
          ) : (
            <Text style={[styles.histAmount, { color: colors.textSecondary }]}>—</Text>
          )}
        </View>
      );
    },
    [colors.border, colors.text, colors.textSecondary, meta?.moneda, symbol, tipoBadge]
  );

  const Header = (
    <Animated.View style={[styles.headerWrap, { backgroundColor: colors.background }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.headerGlass,
          { backgroundColor: colors.card, borderBottomColor: colors.border, opacity: headerBgOpacity },
        ]}
      />
      <Animated.View pointerEvents="none" style={[styles.headerBorder, { backgroundColor: colors.border, opacity: headerBorderOpacity }]} />

      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            styles.softShadow,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {meta?.nombre ?? 'Meta'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {meta?.moneda ? `${symbol} • ${meta.moneda}` : `${symbol}`}
          </Text>
        </View>

        <Pressable
          onPress={onRefresh}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            styles.softShadow,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate: refreshing ? refreshRotate : '0deg' }] }}>
            <Ionicons name="refresh" size={20} color={colors.button} />
          </Animated.View>
        </Pressable>
      </View>
    </Animated.View>
  );

  // ✅ Wrapper: Android sin KAV, iOS con KAV
  const Wrapper: any = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const wrapperProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  // ✅ Modal wrapper: KAV en ambas plataformas (padding en iOS, height en Android para subir el sheet absoluto)
  const ModalWrapper: any = KeyboardAvoidingView;
  const modalWrapperProps = { behavior: Platform.OS === 'ios' ? 'padding' as const : 'height' as const, keyboardVerticalOffset: 0 };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Wrapper style={[styles.container, { backgroundColor: colors.background }]} {...wrapperProps}>
        {Header}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.button} />
            <Text style={[styles.centerText, { color: colors.textSecondary }]}>Cargando…</Text>
          </View>
        ) : !meta ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.textSecondary} />
            <Text style={[styles.centerText, { color: colors.textSecondary }]}>No se encontró la meta.</Text>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Regresar</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={historial}
            keyExtractor={(it, idx) => String((it as any).historialId ?? `${(it as any).createdAt}-${idx}`)}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={[styles.content, { paddingBottom: 30 + stableBottomInset }]}
            ListHeaderComponent={
              <Animated.View
                style={{
                  opacity: enter,
                  transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                }}
              >
                {/* Summary Card */}
                <View style={[styles.heroCard, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {meta.descripcion ? (
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={3}>
                      {meta.descripcion}
                    </Text>
                  ) : null}

                  <View style={styles.heroTopRow}>
                    <View style={[styles.metaIconWrap, { backgroundColor: iconBgColor, borderColor: colors.border }]}>
                      <Ionicons name={iconName as any} size={28} color={iconColor} />
                    </View>

                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
                        {meta?.nombre ?? 'Meta'}
                      </Text>
                      {(meta as any)?.categoria ? (
                        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {(meta as any).categoria}
                        </Text>
                      ) : null}
                    </View>

                    {(startDateRaw || endDateRaw) ? (
                      <View style={styles.chipsContainer}>
                        {startDateRaw ? (
                          <View style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.chipIcon, { backgroundColor: withAlpha(colors.button, 0.12) }]}>
                              <Ionicons name="calendar" size={16} color={colors.button} />
                            </View>
                            <View style={{ marginLeft: 8 }}>
                              <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Inicio</Text>
                              <Text style={[styles.chipDate, { color: colors.text }]}>{formatShortDate(startDateRaw)}</Text>
                            </View>
                          </View>
                        ) : null}

                        {endDateRaw ? (
                          <View style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.chipIcon, { backgroundColor: withAlpha(colors.button, 0.12) }]}>
                              <Ionicons name="flag" size={16} color={colors.button} />
                            </View>
                            <View style={{ marginLeft: 8 }}>
                              <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Fin</Text>
                              <Text style={[styles.chipDate, { color: colors.text }]}>{formatShortDate(endDateRaw)}</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.kpiRow}>
                    <View style={styles.kpiBlock}>
                      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Ahorrado</Text>
                      <SmartNumber value={saldo} options={{ context: 'detail', currency: meta.moneda, symbol }} textStyle={[styles.kpiValue, { color: colors.text }]} />
                    </View>

                    <View style={styles.kpiDivider} />

                    <View style={styles.kpiBlock}>
                      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Faltante</Text>
                      <SmartNumber value={remaining} options={{ context: 'detail', currency: meta.moneda, symbol }} textStyle={[styles.kpiValue, { color: colors.textSecondary }]} />
                    </View>
                  </View>

                  <View style={styles.progressMetaRow}>
                    <View style={[styles.estadoPill, { backgroundColor: estadoTone, borderColor: colors.border }]}>
                      <Ionicons name="pulse-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.estadoText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {estadoLabel}
                      </Text>
                    </View>
                    <Text style={[styles.progressText, { color: colors.textSecondary }]}>{Math.round(progress * 100)}%</Text>
                  </View>

                  <View style={[styles.progressTrack, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                    <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: barColor }]} />
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable onPress={() => openMovimiento('ingreso')} style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 }]}>
                      <Ionicons name="add" size={18} color="#FFF" />
                      <Text style={styles.primaryActionText}>Ingreso</Text>
                    </Pressable>

                    <Pressable onPress={() => openMovimiento('egreso')} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }]}>
                      <Ionicons name="remove" size={18} color={colors.text} />
                      <Text style={[styles.secondaryActionText, { color: colors.text }]}>Egreso</Text>
                    </Pressable>
                  </View>

                  <View style={styles.statusRow}>
                    <Pressable disabled={statusSaving} onPress={() => changeStatus('pausar')} style={({ pressed }) => [styles.statusBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: pressed || statusSaving ? 0.82 : 1 }]}>
                      <Ionicons name="pause" size={16} color={colors.textSecondary} />
                      <Text style={[styles.statusBtnText, { color: colors.text }]}>Pausar</Text>
                    </Pressable>

                    <Pressable disabled={statusSaving} onPress={() => changeStatus('reanudar')} style={({ pressed }) => [styles.statusBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: pressed || statusSaving ? 0.82 : 1 }]}>
                      <Ionicons name="play" size={16} color={colors.textSecondary} />
                      <Text style={[styles.statusBtnText, { color: colors.text }]}>Reanudar</Text>
                    </Pressable>

                    <Pressable
                      disabled={deleting}
                      onPress={() => setDeleteModalVisible(true)}
                      style={({ pressed }) => [
                        styles.statusBtn,
                        { backgroundColor: '#ef4444', borderColor: '#ef4444', opacity: pressed || deleting ? 0.82 : 1 },
                      ]}
                      accessibilityLabel="Eliminar meta"
                    >
                      <Ionicons name="trash" size={16} color="#FFF" />
                      <Text style={[styles.statusBtnText, { color: '#FFF' }]}>Eliminar</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Historial</Text>
                  <Text style={[styles.sectionHint, { color: colors.textSecondary }]} numberOfLines={1}>
                    Últimos movimientos
                  </Text>
                </View>
              </Animated.View>
            }
            renderItem={renderHistItem}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin movimientos todavía</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Registra tu primer ingreso para empezar a ver el progreso de tu meta.</Text>

                <Pressable onPress={() => openMovimiento('ingreso')} style={({ pressed }) => [styles.emptyCta, { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 }]}>
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.emptyCtaText}>Agregar ingreso</Text>
                </Pressable>
              </View>
            }
          />
        )}

        {/* Bottom-sheet Movimiento */}
        <Modal visible={!!movOpen} transparent animationType="none" onRequestClose={closeMovimiento}>
          <ModalWrapper style={{ flex: 1 }} {...modalWrapperProps}>
            <Animated.View style={[styles.sheetBackdrop, { opacity: backdropAnim }]}>
              <Pressable style={StyleSheet.absoluteFillObject as any} onPress={closeMovimiento} />
            </Animated.View>

            <Animated.View
              style={[
                styles.sheet,
                styles.softShadow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  bottom: 12 + stableBottomInset, // ✅ evita recorte/“salto” al abrir teclado
                  transform: [{ translateY: sheetTranslateY }, { scale: sheetScale }],
                },
              ]}
            >
              <View style={styles.sheetHandleWrap}>
                <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
              </View>

              <View style={styles.sheetHeader}>
                <View style={[styles.sheetBadge, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <Ionicons name={movOpen === 'ingreso' ? 'add' : 'remove'} size={18} color={movOpen === 'ingreso' ? colors.button : colors.text} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                    {sheetTitle}
                  </Text>
                  <Text style={[styles.sheetSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {meta?.nombre ?? 'Meta'} • {symbol}
                  </Text>
                </View>

                <Pressable onPress={closeMovimiento} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.sheetBody}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Monto</Text>
                <View style={[styles.amountField, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <Text style={[styles.amountPrefix, { color: colors.textSecondary }]}>{symbol}</Text>
                  <TextInput
                    style={[styles.amountInput, { color: colors.text }]}
                    editable={!savingMov}
                    placeholderTextColor={colors.placeholder}
                    {...movMonto.textInputProps}
                    placeholder={movMonto.textInputProps?.placeholder ?? '0.00'}
                    onFocus={() => {
                      // ✅ evita que la lista “se reacomode” raro en algunos Android
                      // (solo scrolla al final si hiciera falta)
                    }}
                  />
                </View>

                <View style={styles.quickRow}>
                  {quickAmounts.map((a) => (
                    <Pressable
                      key={a}
                      disabled={savingMov}
                      onPress={() => movMonto.textInputProps?.onChangeText?.(String(a) as any)}
                      style={({ pressed }) => [
                        styles.quickChip,
                        { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                      ]}
                    >
                      <Text style={[styles.quickText, { color: colors.text }]}>
                        {symbol} {a}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>Descripción</Text>
                <TextInput
                  style={[
                    styles.noteInput,
                    { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="Opcional (ej. “Aportación quincenal”)"
                  placeholderTextColor={colors.placeholder}
                  value={movDesc}
                  onChangeText={setMovDesc}
                  editable={!savingMov}
                  maxLength={120}
                  multiline
                />

                <View style={styles.sheetActions}>
                  <Pressable
                    onPress={closeMovimiento}
                    disabled={savingMov}
                    style={({ pressed }) => [
                      styles.sheetBtn,
                      { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    <Text style={[styles.sheetBtnText, { color: colors.text }]}>Cancelar</Text>
                  </Pressable>

                  <Pressable
                    onPress={submitMovimiento}
                    disabled={savingMov}
                    style={({ pressed }) => [styles.sheetBtnPrimary, { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 }]}
                  >
                    {savingMov ? <ActivityIndicator color="#FFF" /> : <Text style={styles.sheetBtnPrimaryText}>Guardar</Text>}
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </ModalWrapper>
        </Modal>

        {/* Completion decision modal (V2) */}
        <Modal
          visible={decisionModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeDecisionModal}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={[styles.decisionBackdrop]}> 
              <Pressable style={StyleSheet.absoluteFillObject as any} onPress={closeDecisionModal} />

              <View style={[styles.decisionCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}> 
                <View style={styles.decisionHeader}>
                  <View style={[styles.decisionBadge, { backgroundColor: withAlpha(colors.button, 0.12), borderColor: withAlpha(colors.button, 0.2) }]}>
                    <Ionicons name="sparkles" size={18} color={withAlpha(colors.button, 0.95)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.decisionTitle, { color: colors.text }]} numberOfLines={1}>
                      Meta completada
                    </Text>
                    <Text style={[styles.decisionSub, { color: colors.textSecondary }]} numberOfLines={2}>
                      Elige qué hacer con el dinero y con la meta.
                    </Text>
                  </View>
                  <Pressable onPress={closeDecisionModal} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.decisionBody}>
                  <Text style={[styles.decisionSection, { color: colors.textSecondary }]}>Dinero</Text>

                  <View style={styles.decisionGrid}>
                    {([
                      { k: 'keep' as const, icon: 'wallet-outline', title: 'Mantener', desc: 'No mover dinero' },
                      { k: 'transfer_to_main' as const, icon: 'swap-horizontal-outline', title: 'Transferir', desc: 'A cuenta principal' },
                      { k: 'mark_used' as const, icon: 'checkmark-done-outline', title: 'Usado', desc: 'Registrar motivo' },
                    ] as const).map((o) => {
                      const active = moneyAction === o.k;
                      return (
                        <Pressable
                          key={o.k}
                          onPress={() => setMoneyAction(o.k)}
                          style={({ pressed }) => [
                            styles.decisionOption,
                            {
                              backgroundColor: active ? withAlpha(colors.button, 0.1) : colors.inputBackground,
                              borderColor: active ? withAlpha(colors.button, 0.32) : colors.border,
                              opacity: pressed ? 0.92 : 1,
                            },
                          ]}
                        >
                          <View style={[styles.decisionOptionIcon, { backgroundColor: withAlpha(colors.button, active ? 0.12 : 0.06), borderColor: withAlpha(colors.button, active ? 0.18 : 0.1) }]}>
                            <Ionicons name={o.icon as any} size={18} color={active ? colors.button : colors.textSecondary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.decisionOptionTitle, { color: colors.text }]}>{o.title}</Text>
                            <Text style={[styles.decisionOptionDesc, { color: colors.textSecondary }]}>{o.desc}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {(moneyAction === 'transfer_to_main' || moneyAction === 'mark_used') && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.decisionFieldLabel, { color: colors.textSecondary }]}>Monto (opcional)</Text>
                      <View style={[styles.decisionAmountField, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}> 
                        <Text style={[styles.decisionAmountPrefix, { color: colors.textSecondary }]}>{symbol}</Text>
                        <TextInput
                          style={[styles.decisionAmountInput, { color: colors.text }]}
                          placeholderTextColor={colors.placeholder}
                          editable={!resolvingDecision}
                          {...decisionAmount.textInputProps}
                        />
                      </View>
                      <Text style={[styles.decisionHint, { color: colors.textTertiary }]}>Si lo dejas vacío, usa el total disponible.</Text>
                    </View>
                  )}

                  {moneyAction === 'mark_used' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.decisionFieldLabel, { color: colors.textSecondary }]}>Motivo</Text>
                      <TextInput
                        style={[styles.decisionTextArea, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                        placeholder="Ej. Compré el producto X"
                        placeholderTextColor={colors.placeholder}
                        value={motivo}
                        onChangeText={setMotivo}
                        editable={!resolvingDecision}
                        maxLength={140}
                        multiline
                      />

                      <View style={styles.decisionToggleRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.decisionToggleTitle, { color: colors.text }]}>También transferir a principal</Text>
                          <Text style={[styles.decisionToggleDesc, { color: colors.textSecondary }]}>Opcional al marcar como usado</Text>
                        </View>
                        <Pressable
                          onPress={() => setMoveToMain((v) => !v)}
                          style={({ pressed }) => [
                            styles.decisionPill,
                            {
                              backgroundColor: moveToMain ? colors.success : colors.cardSecondary,
                              borderColor: moveToMain ? colors.success : colors.border,
                              opacity: pressed ? 0.92 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.decisionPillText, { color: moveToMain ? '#fff' : colors.textSecondary }]}>{moveToMain ? 'Sí' : 'No'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  <View style={{ height: 12 }} />
                  <Text style={[styles.decisionSection, { color: colors.textSecondary }]}>Meta</Text>

                  <View style={styles.decisionGrid}>
                    {([
                      { k: 'none' as const, icon: 'remove-circle-outline', title: 'Nada', desc: 'Dejar como está' },
                      { k: 'archive' as const, icon: 'archive-outline', title: 'Archivar', desc: 'Cerrar la meta' },
                      { k: 'reset' as const, icon: 'refresh-outline', title: 'Reiniciar', desc: 'Volver a activa' },
                      { k: 'duplicate' as const, icon: 'copy-outline', title: 'Duplicar', desc: 'Crear una nueva' },
                    ] as const).map((o) => {
                      const active = metaAction === o.k;
                      return (
                        <Pressable
                          key={o.k}
                          onPress={() => setMetaAction(o.k)}
                          style={({ pressed }) => [
                            styles.decisionOption,
                            {
                              backgroundColor: active ? withAlpha(colors.button, 0.1) : colors.inputBackground,
                              borderColor: active ? withAlpha(colors.button, 0.32) : colors.border,
                              opacity: pressed ? 0.92 : 1,
                            },
                          ]}
                        >
                          <View style={[styles.decisionOptionIcon, { backgroundColor: withAlpha(colors.button, active ? 0.12 : 0.06), borderColor: withAlpha(colors.button, active ? 0.18 : 0.1) }]}>
                            <Ionicons name={o.icon as any} size={18} color={active ? colors.button : colors.textSecondary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.decisionOptionTitle, { color: colors.text }]}>{o.title}</Text>
                            <Text style={[styles.decisionOptionDesc, { color: colors.textSecondary }]}>{o.desc}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {metaAction === 'reset' && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.decisionFieldLabel, { color: colors.textSecondary }]}>Nuevo objetivo (opcional)</Text>
                      <View style={[styles.decisionAmountField, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}> 
                        <Text style={[styles.decisionAmountPrefix, { color: colors.textSecondary }]}>{symbol}</Text>
                        <TextInput
                          style={[styles.decisionAmountInput, { color: colors.text }]}
                          placeholderTextColor={colors.placeholder}
                          editable={!resolvingDecision}
                          {...resetObjetivoInput.textInputProps}
                        />
                      </View>

                      <Text style={[styles.decisionFieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>Nueva fecha objetivo (opcional)</Text>
                      <TextInput
                        style={[styles.decisionInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.placeholder}
                        value={resetFechaObjetivo}
                        onChangeText={setResetFechaObjetivo}
                        editable={!resolvingDecision}
                        autoCapitalize="none"
                      />
                      <Text style={[styles.decisionHint, { color: colors.textTertiary }]}>Puedes usar ISO (ej. 2026-09-30).</Text>
                    </View>
                  )}

                  <View style={styles.decisionSummary}>
                    <Text style={[styles.decisionSummaryTitle, { color: colors.text }]}>Resumen</Text>
                    <Text style={[styles.decisionSummaryLine, { color: colors.textSecondary }]}>Dinero: {formatMoneyAction(moneyAction)}</Text>
                    <Text style={[styles.decisionSummaryLine, { color: colors.textSecondary }]}>Meta: {formatMetaAction(metaAction)}</Text>
                  </View>

                  <View style={styles.decisionActions}>
                    <Pressable
                      onPress={closeDecisionModal}
                      disabled={resolvingDecision}
                      style={({ pressed }) => [
                        styles.decisionBtn,
                        { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                      ]}
                    >
                      <Text style={[styles.decisionBtnText, { color: colors.text }]}>Más tarde</Text>
                    </Pressable>

                    <Pressable
                      onPress={submitDecision}
                      disabled={resolvingDecision}
                      style={({ pressed }) => [
                        styles.decisionBtnPrimary,
                        { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 },
                      ]}
                    >
                      {resolvingDecision ? <ActivityIndicator color="#FFF" /> : <Text style={styles.decisionBtnPrimaryText}>Confirmar</Text>}
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Delete confirmation modal */}
        <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
          <View style={styles.confirmModalWrap}>
            <View style={[styles.confirmModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.confirmModalTitle, { color: colors.text }]}>Eliminar esta meta</Text>
              <Text style={[styles.confirmModalText, { color: colors.textSecondary }]}>
                Esto eliminará la meta y todo su historial. Esta acción no es reversible.
              </Text>

              <View style={styles.confirmModalActions}>
                <Pressable
                  onPress={() => setDeleteModalVisible(false)}
                  style={({ pressed }) => [styles.confirmModalBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
                >
                  <Text style={[styles.confirmModalBtnText, { color: colors.text }]}>Cancelar</Text>
                </Pressable>

                <Pressable
                  onPress={confirmDelete}
                  disabled={deleting}
                  style={({ pressed }) => [styles.confirmModalBtnPrimary, { backgroundColor: '#ef4444', opacity: pressed ? 0.9 : 1 }]}
                >
                  {deleting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmModalBtnPrimaryText}>Eliminar</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <ConfettiOverlay
          visible={confettiVisible}
          colors={colors}
          title={meta?.nombre}
          subtitle={isCompleted ? '¡Meta cumplida!' : undefined}
          onDone={onConfettiDone}
        />
      </Wrapper>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  softShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  headerWrap: {
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingBottom: 8,
    paddingHorizontal: 16,
    position: 'relative',
    zIndex: 10,
  },
  headerGlass: { ...StyleSheet.absoluteFillObject, borderBottomWidth: 1, opacity: 0 },
  headerBorder: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, opacity: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, fontSize: 12, fontWeight: '800' },
  iconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  centerText: { fontSize: 14, textAlign: 'center', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 8 },
  secondaryBtnText: { fontSize: 13, fontWeight: '900' },

  content: { padding: 16 },

  heroCard: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 14 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  metaIconWrap: { width: 56, height: 56, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 15, fontWeight: '900' },
  heroSubtitle: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  subtitle: { fontSize: 13, marginBottom: 10, lineHeight: 18 },

  kpiRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  kpiBlock: { flex: 1 },
  kpiLabel: { fontSize: 12, fontWeight: '800' },
  kpiValue: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  kpiDivider: { width: 1, height: 40, backgroundColor: 'rgba(0,0,0,0.08)' },

  progressMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  estadoPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '72%' },
  estadoText: { fontSize: 12, fontWeight: '900' },
  progressText: { fontSize: 12, fontWeight: '900' },

  progressTrack: { marginTop: 10, borderWidth: 1, borderRadius: 999, height: 10, overflow: 'hidden', padding: 2 },
  progressFill: { height: 6, borderRadius: 999 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryAction: { flex: 1, borderRadius: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryActionText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  secondaryAction: { flex: 1, borderRadius: 16, paddingVertical: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryActionText: { fontSize: 14, fontWeight: '900' },

  statusRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statusBtn: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusBtnText: { fontSize: 13, fontWeight: '900' },

  sectionHeader: { marginTop: 8, marginBottom: 6, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionHint: { fontSize: 12, fontWeight: '800' },

  histItem: { borderTopWidth: 1, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  histBadge: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  histLeft: { flex: 1 },
  histType: { fontSize: 14, fontWeight: '900' },
  histDate: { marginTop: 3, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  histAmount: { fontSize: 14, fontWeight: '900' },

  emptyWrap: { padding: 22, alignItems: 'center', gap: 10, marginTop: 10 },
  emptyIcon: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  emptyText: { fontSize: 12, lineHeight: 16, textAlign: 'center', fontWeight: '700' },
  emptyCta: { marginTop: 8, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyCtaText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, minWidth: 110 },
  chipIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  chipDate: { fontSize: 13, fontWeight: '900', marginTop: 2 },
  chipsContainer: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 12, right: 12, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  sheetHandleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  sheetHandle: { width: 54, height: 5, borderRadius: 99 },

  sheetHeader: { paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetBadge: { width: 40, height: 40, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 15, fontWeight: '900' },
  sheetSub: { marginTop: 2, fontSize: 12, fontWeight: '800' },

  sheetBody: { paddingHorizontal: 14, paddingBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '900', marginBottom: 8 },

  amountField: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountPrefix: { fontSize: 16, fontWeight: '900' },
  amountInput: { flex: 1, fontSize: 18, fontWeight: '900', padding: 0 },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  quickChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 },
  quickText: { fontSize: 12, fontWeight: '900' },

  noteInput: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, fontWeight: '700', minHeight: 54 },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  sheetBtn: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText: { fontSize: 13, fontWeight: '900' },
  sheetBtnPrimary: { flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  sheetBtnPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  deleteBtn: { marginTop: 4, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#ef4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  confirmModalWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  confirmModalCard: { width: '88%', borderRadius: 14, borderWidth: 1, padding: 16 },
  confirmModalTitle: { fontSize: 16, fontWeight: '900', marginBottom: 6 },
  confirmModalText: { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  confirmModalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  confirmModalBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1 },
  confirmModalBtnText: { fontSize: 13, fontWeight: '900' },
  confirmModalBtnPrimary: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  confirmModalBtnPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  decisionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  decisionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    maxHeight: '86%',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  decisionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 },
  decisionBadge: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  decisionTitle: { fontSize: 16, fontWeight: '900' },
  decisionSub: { marginTop: 2, fontSize: 12, fontWeight: '800', lineHeight: 16 },
  decisionBody: { paddingTop: 6 },
  decisionSection: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  decisionGrid: { gap: 10 },
  decisionOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1 },
  decisionOptionIcon: { width: 36, height: 36, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  decisionOptionTitle: { fontSize: 14, fontWeight: '900' },
  decisionOptionDesc: { marginTop: 2, fontSize: 12, fontWeight: '800', lineHeight: 16 },
  decisionFieldLabel: { fontSize: 12, fontWeight: '900', marginBottom: 6 },
  decisionAmountField: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  decisionAmountPrefix: { fontSize: 16, fontWeight: '900', marginRight: 8 },
  decisionAmountInput: { flex: 1, fontSize: 16, fontWeight: '900' },
  decisionHint: { marginTop: 6, fontSize: 11, fontWeight: '800' },
  decisionTextArea: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, minHeight: 74, fontSize: 13, fontWeight: '800' },
  decisionToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  decisionToggleTitle: { fontSize: 13, fontWeight: '900' },
  decisionToggleDesc: { marginTop: 2, fontSize: 11, fontWeight: '800' },
  decisionPill: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, minWidth: 52, alignItems: 'center', justifyContent: 'center' },
  decisionPillText: { fontSize: 12, fontWeight: '900' },
  decisionInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '800' },
  decisionSummary: { marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 12 },
  decisionSummaryTitle: { fontSize: 13, fontWeight: '900', marginBottom: 4 },
  decisionSummaryLine: { fontSize: 12, fontWeight: '800', lineHeight: 16 },
  decisionActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 },
  decisionBtn: { borderRadius: 14, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 12 },
  decisionBtnText: { fontSize: 13, fontWeight: '900' },
  decisionBtnPrimary: { borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  decisionBtnPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
});

export default MetaDetailScreen;