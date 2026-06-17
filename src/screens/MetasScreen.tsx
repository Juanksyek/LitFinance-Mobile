import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { useThemeColors } from '../theme/useThemeColors';
import metasService from '../services/metasService';
import EventBus from '../utils/eventBus';
import type { Meta } from '../types/metas';
import SmartNumber from '../components/SmartNumber';
import { buscarMonedaPorCodigo } from '../constants/monedas';
import type { RootStackParamList } from '../navigation/AppNavigator';

const DEFAULT_ESTADO = 'activa';
const { width: SCREEN_W } = Dimensions.get('window');

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

const formatFin = (value: any) => {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
};

const MetasScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Metas'>>();
  const colors = useThemeColors();

  const [items, setItems] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expand per item
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const animsRef = useRef<Record<string, Animated.Value>>({});
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});

  // Pagination / filters
  const filterDebounceRef = useRef<any>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const latestRequestIdRef = useRef(0);

  const [selectedFilter, setSelectedFilter] = useState<'activa' | 'pausada' | 'cumplida' | 'todas'>('activa');
  const FILTERS = [
    { key: 'activa', label: 'Activas' },
    { key: 'pausada', label: 'Pausadas' },
    { key: 'cumplida', label: 'Cumplidas' },
    { key: 'todas', label: 'Todas' },
  ] as const;

  // Animations
  const enter = useRef(new Animated.Value(0)).current;
  const headerShadow = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
        filterDebounceRef.current = null;
      }
    };
  }, [enter]);



  const load = useCallback(
    async (opts?: { silent?: boolean; page?: number; append?: boolean }) => {
      const requestedPage = opts?.page ?? 1;
      try {
        if (requestedPage > 1) setLoadingMore(true);
        else if (!opts?.silent) setLoading(true);

        setError(null);

        const params: any = { page: requestedPage, limit };
        if (search) params.search = search;
        if (selectedFilter !== 'todas') params.estado = selectedFilter;

        const reqId = ++latestRequestIdRef.current;
        // Primary fetch: ask backend for the requested estado (if any)
        const res = await metasService.listMetas(params);

        // If the user requested 'cumplida' (terminadas), also include metas
        // that are marked completed via the new completion flow but still have
        // estado != 'completada' on the server. We do a lightweight extra fetch
        // (first N items) and merge any items with completion.isCompleted === true.
        let mergedItems: any[] = [];
        if (selectedFilter === 'cumplida') {
          try {
            const extra = await metasService.listMetas({ page: 1, limit: Math.max(50, limit) });
            const aItems = (extra as any)?.items ?? [];
            const primary = (res as any)?.items ?? [];

            const isCompletedMeta = (it: any) => {
              const e = String(it?.estado ?? '').toLowerCase();
              if (e.includes('cumpl') || e.includes('complet')) return true;
              if (it?.completion && typeof it.completion.isCompleted === 'boolean') return !!it.completion.isCompleted;
              if (it?.completion && typeof it.completion.isCompleted === 'number') return it.completion.isCompleted === 1;
              if (it?.completion && typeof it.completion.isCompleted === 'string') {
                const s = String(it.completion.isCompleted).toLowerCase().trim();
                if (s === 'true' || s === '1' || s === 'yes' || s === 'si') return true;
              }

              const p = Number(it?.progreso);
              if (Number.isFinite(p) && p >= 1) return true;
              const objetivo = Number(it?.objetivo ?? it?.objetivoMonto ?? 0);
              const saldo = Number(it?.saldoActual ?? it?.saldo ?? 0);
              if (objetivo > 0 && Number.isFinite(saldo) && saldo >= objetivo) return true;
              return false;
            };

            const map = new Map<string, any>();
            // include primary results first
            for (const it of primary) {
              map.set(String((it as any).metaId ?? (it as any).id ?? ''), it);
            }
            // merge extra items that are completed via completion block
            for (const it of aItems) {
              const id = String((it as any).metaId ?? (it as any).id ?? '');
              if (map.has(id)) continue;
              if (isCompletedMeta(it)) {
                map.set(id, it);
              }
            }

            mergedItems = Array.from(map.values());
          } catch (e) {
            // fallback to primary
            mergedItems = (res as any)?.items ?? [];
          }
        }

        const isNotModified = !!(
          res &&
          ((res as any).status === 304 ||
            (res as any).statusCode === 304 ||
            (res as any).notModified === true ||
            (res as any).notModified === 'true')
        );

        if (reqId !== latestRequestIdRef.current) return;

        const responseData = (mergedItems && mergedItems.length > 0)
          ? mergedItems
          : (res as any)?.data ?? (res as any)?.items ?? [];
        if (isNotModified && requestedPage === 1) {
          const totalRes304 = typeof (res as any)?.total === 'number' ? (res as any).total : null;
          if (typeof totalRes304 === 'number') setTotal(totalRes304);
          setPage(requestedPage);
          return;
        }

        const next = Array.isArray(responseData) ? responseData : [];
        const totalRes = typeof (res as any)?.total === 'number' ? (res as any).total : null;

        next.sort((a: Meta, b: Meta) => {
          const ad = (a as any).updatedAt ? new Date((a as any).updatedAt).getTime() : 0;
          const bd = (b as any).updatedAt ? new Date((b as any).updatedAt).getTime() : 0;
          return bd - ad;
        });

        if (opts?.append) setItems((p) => [...p, ...next]);
        else setItems(next);

        if (typeof totalRes === 'number') {
          setTotal(totalRes);
        } else if (!opts?.append && next.length < limit) {
          setTotal(next.length);
        } else if (opts?.append && next.length < limit) {
          setTotal((prev) => (prev ?? items.length) + next.length);
        }

        setPage(requestedPage);
      } catch (e: any) {
        const msg = e?.message || 'No se pudieron cargar las metas';
        setError(msg);
        if (!opts?.silent) Toast.show({ type: 'error', text1: 'Error', text2: msg });
      } finally {
        if (requestedPage > 1) setLoadingMore(false);
        else if (!opts?.silent) setLoading(false);
      }
    },
    [selectedFilter, limit, search] // eslint-disable-line react-hooks/exhaustive-deps
  );

    // Listen to external changes (e.g., confetti finish / other screens) to refresh list
    useEffect(() => {
      const handler = () => {
        try {
          load({ page: 1, append: false });
        } catch {}
      };
      EventBus.on('metas:changed', handler);
      return () => EventBus.off('metas:changed', handler);
    }, [load]);

  // Apply navigation params
  const lastRefreshKeyRef = useRef<number | null>(null);
  useEffect(() => {
    const initialFilter = route.params?.initialFilter;
    if (initialFilter && initialFilter !== selectedFilter) {
      setSelectedFilter(initialFilter);
      try {
        navigation.setParams({ initialFilter: undefined } as any);
      } catch {}
      return;
    }

    const rk = typeof route.params?.refreshKey === 'number' ? route.params!.refreshKey! : null;
    if (rk != null && rk !== lastRefreshKeyRef.current) {
      lastRefreshKeyRef.current = rk;
      load({ page: 1, append: false });
      try {
        navigation.setParams({ refreshKey: undefined } as any);
      } catch {}
    }
  }, [load, navigation, route.params?.initialFilter, route.params?.refreshKey, selectedFilter]);

  // Debounced reload when filter/search changes
  const didMountFilterEffectRef = useRef(false);
  useEffect(() => {
    if (!didMountFilterEffectRef.current) {
      didMountFilterEffectRef.current = true;
      return;
    }

    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);

    setError(null);
    setTotal(null);
    setPage(1);
    setLoading(true);

    filterDebounceRef.current = setTimeout(() => {
      load({ page: 1, append: false });
      filterDebounceRef.current = null;
    }, 320);

    return () => {
      if (filterDebounceRef.current) {
        clearTimeout(filterDebounceRef.current);
        filterDebounceRef.current = null;
      }
    };
  }, [selectedFilter, search, load]);

  useFocusEffect(
    useCallback(() => {
      const initialFilter = route.params?.initialFilter;
      if (initialFilter && initialFilter !== selectedFilter) return;

      const rk = typeof route.params?.refreshKey === 'number' ? route.params!.refreshKey! : null;
      if (rk != null && rk !== lastRefreshKeyRef.current) return;

      load({ page: 1, append: false });
      return () => {};
    }, [load, route.params?.initialFilter, route.params?.refreshKey, selectedFilter])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 800, useNativeDriver: true })).start();
    try {
      await load({ silent: true, page: 1, append: false });
    } finally {
      rotate.stopAnimation(() => rotate.setValue(0));
      setRefreshing(false);
    }
  }, [load, rotate]);

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

  const toggleExpand = useCallback(
    (metaId: string) => {
      if (!animsRef.current[metaId]) animsRef.current[metaId] = new Animated.Value(expanded[metaId] ? 1 : 0);
      const anim = animsRef.current[metaId];

      setExpanded((prev) => {
        const nextOpen = !prev[metaId];
        Animated.timing(anim, { toValue: nextOpen ? 1 : 0, duration: 220, useNativeDriver: false }).start();
        return { ...prev, [metaId]: nextOpen };
      });
    },
    [expanded]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Meta; index: number }) => {
      const metaId = String((item as any).metaId ?? index);

      if (!animsRef.current[metaId]) animsRef.current[metaId] = new Animated.Value(expanded[metaId] ? 1 : 0);
      const anim = animsRef.current[metaId];

      const symbol = buscarMonedaPorCodigo((item as any).moneda)?.simbolo ?? '$';

      const backendProgress = (item as any)?.progreso;
      const objetivo = Number((item as any)?.objetivo ?? (item as any)?.objetivoMonto ?? 0);
      const saldo = Number((item as any)?.saldoActual ?? (item as any)?.saldo ?? 0);
      const computed = objetivo > 0 ? clamp(saldo / objetivo, 0, 1) : 0;
      const progress =
        typeof backendProgress === 'number' && Number.isFinite(backendProgress) ? clamp(backendProgress, 0, 1) : computed;

      const pct = Math.round(progress * 100);

      const accent = (item as any)?.color ?? colors.button;
      const estado = String((item as any)?.estado ?? '—');
      const fin = (item as any)?.fechaObjetivo ? formatFin((item as any).fechaObjetivo) : null;

      // Stagger entrance
      const itemAnim = enter.interpolate({
        inputRange: [0, 1],
        outputRange: [12 + Math.min(index, 6) * 2, 0],
      });

      // Progress fill width (compact)
      const trackW = SCREEN_W - 32 - 26; // list padding + card padding
      const fillW = Math.max(0, Math.min(trackW, trackW * progress));

      // Expand panel animation
      const measured = contentHeights[metaId] ?? 120;
      const expandedHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, measured] });
      const expandedOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
      const chevronRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

      const icono = (item as any)?.icono;
      const iconIsEmoji = icono && String(icono).length <= 2;

      const buildTip = () => {
        try {
          if (!fin || !(objetivo > 0)) return null;
          const now = new Date();
          const target = new Date((item as any).fechaObjetivo);
          const ms = target.getTime() - now.getTime();
          const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
          const weeks = Math.max(1, Math.ceil(days / 7));
          const months = Math.max(1, Math.ceil(days / 30.44));
          const remaining = Math.max(0, objetivo - saldo);
          const perMonth = remaining / months;
          const perWeek = remaining / weeks;
          const fmt = (n: number) => {
            try {
              return new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: String((item as any).moneda || 'MXN'),
                maximumFractionDigits: 2,
              }).format(n);
            } catch {
              return `${symbol} ${n.toFixed(2)}`;
            }
          };
          return `${fmt(perMonth)} / mes  ·  ${fmt(perWeek)} / semana`;
        } catch {
          return null;
        }
      };

      const tip = buildTip();

      // Hidden measurer: render the expand content off-screen (opacity:0) so we can measure
      // its full height even when the visible panel is collapsed (height:0). This prevents
      // the common issue where onLayout reports 0 because the parent has zero height.
      const hiddenMeasurer = (
        <View
          style={{ position: 'absolute', left: -10000, top: -10000, opacity: 0 }}
          pointerEvents="none"
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (!contentHeights[metaId] || contentHeights[metaId] !== h) {
              setContentHeights((p) => {
                const next = { ...p, [metaId]: h };
                try {
                  const anim = animsRef.current[metaId];
                  if (expanded[metaId] && anim) {
                    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
                  }
                } catch {}
                return next;
              });
            }
          }}
        >
          <View style={styles.expandContent}>
            {tip ? (
              <View
                style={[
                  styles.tipBox,
                  {
                    backgroundColor: withAlpha(colors.button, 0.1),
                    borderColor: withAlpha(colors.button, 0.18),
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="bulb-outline" size={16} color={withAlpha(colors.button, 0.95)} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tipTitle, { color: colors.text }]} numberOfLines={1}>
                      Tip de aportación
                    </Text>
                    <Text style={[styles.tipText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {tip}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => navigation.navigate('MetaDetail', { metaId: (item as any).metaId, openAportar: true })}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.tipCta,
                    { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 },
                  ]}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.noTip, { color: colors.textSecondary }]}>Agrega una fecha límite para ver un tip de aportación.</Text>
            )}
          </View>
        </View>
      );

      return (
        <Animated.View style={{ opacity: enter, transform: [{ translateY: itemAnim }] }}>
          <Pressable
            onPress={() => navigation.navigate('MetaDetail', { metaId: (item as any).metaId })}
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <View style={[styles.card, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Decorative blob (subtle) */}
              <View
                pointerEvents="none"
                style={[
                  styles.blob,
                  { backgroundColor: withAlpha(accent, 0.10) },
                ]}
              />

              {/* Top row */}
              <View style={styles.topRow}>
                <View style={styles.leftTop}>
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: withAlpha(accent, 0.14),
                        borderColor: withAlpha(accent, 0.22),
                      },
                    ]}
                  >
                    {icono ? (
                      iconIsEmoji ? (
                        <Text style={styles.emoji}>{String(icono)}</Text>
                      ) : (
                        <Ionicons name={String(icono) as any} size={18} color={accent} />
                      )
                    ) : (
                      <Ionicons name="sparkles-outline" size={18} color={colors.textSecondary} />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                      {(item as any).nombre}
                    </Text>
                    {fin ? (
                      <Text style={[styles.fin, { color: colors.textSecondary }]} numberOfLines={1}>
                        Fin: {fin}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.rightTop}>
                  <View
                    style={[
                      styles.estadoPill,
                      {
                        backgroundColor: withAlpha(colors.button, 0.10),
                        borderColor: withAlpha(colors.button, 0.18),
                      },
                    ]}
                  >
                    <Ionicons name="pulse-outline" size={12} color={colors.textSecondary} />
                    <Text style={[styles.estadoText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {estado}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => navigation.navigate('CreateMeta' as any, { meta: item })}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.iconMiniBtn,
                      {
                        backgroundColor: withAlpha(colors.button, 0.08),
                        borderColor: withAlpha(colors.button, 0.16),
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                  </Pressable>

                  <Pressable
                    onPress={() => navigation.navigate('MetaDetail', { metaId: (item as any).metaId })}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.iconMiniBtn,
                      {
                        backgroundColor: withAlpha(colors.button, 0.06),
                        borderColor: withAlpha(colors.button, 0.14),
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              {/* Optional description (compact) */}
              {(item as any).descripcion ? (
                <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
                  {(item as any).descripcion}
                </Text>
              ) : null}

              {/* Amounts (compact, right-aligned) */}
              <View style={styles.kpis}>
                <View style={styles.kpiRow}>
                  <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Ahorrado</Text>
                  <SmartNumber
                    value={(item as any).saldoActual ?? (item as any).saldo ?? 0}
                    options={{ context: 'list', currency: (item as any).moneda, symbol }}
                    textStyle={[styles.kpiValue, { color: colors.text }]}
                    allowTooltip
                  />
                </View>

                <View style={styles.kpiRow}>
                  <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Objetivo</Text>
                  <SmartNumber
                    value={(item as any)?.objetivo ?? (item as any)?.objetivoMonto}
                    options={{ context: 'list', currency: (item as any).moneda, symbol }}
                    textStyle={[styles.kpiValueMuted, { color: colors.textSecondary }]}
                    allowTooltip
                  />
                </View>
              </View>

              {/* Progress */}
              <View style={[styles.progressTrack, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <Animated.View style={[styles.progressFill, { width: fillW, backgroundColor: accent }]} />
              </View>

              {/* Bottom meta row */}
              <View style={styles.bottomRow}>
                <Text style={[styles.pct, { color: colors.textSecondary }]}>{pct}%</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={1}>
                  Toca para ver detalles
                </Text>

                <Pressable
                  onPress={() => toggleExpand(metaId)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.expandBtn,
                    {
                      backgroundColor: withAlpha(colors.button, 0.08),
                      borderColor: withAlpha(colors.button, 0.16),
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                  </Animated.View>
                </Pressable>
              </View>

              {/* Expand panel */}
              <Animated.View
                style={[
                  styles.expandPanel,
                  {
                    height: expandedHeight,
                    opacity: expandedOpacity,
                    borderTopColor: withAlpha(colors.border, 0.55),
                  },
                ]}
                pointerEvents={expanded[metaId] ? 'auto' : 'none'}
              >
                <View
                  style={styles.expandContent}
                  onLayout={(e) => {
                    const h = Math.round(e.nativeEvent.layout.height);
                    if (!contentHeights[metaId] || contentHeights[metaId] !== h) {
                      setContentHeights((p) => {
                        const next = { ...p, [metaId]: h };
                        // If the panel is already expanded, re-run the animation so it grows to the newly measured height
                        try {
                          const anim = animsRef.current[metaId];
                          if (expanded[metaId] && anim) {
                            Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
                          }
                        } catch {}
                        return next;
                      });
                    }
                  }}
                >
                  {tip ? (
                    <View
                      style={[
                        styles.tipBox,
                        {
                          backgroundColor: withAlpha(colors.button, 0.10),
                          borderColor: withAlpha(colors.button, 0.18),
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Ionicons name="bulb-outline" size={16} color={withAlpha(colors.button, 0.95)} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.tipTitle, { color: colors.text }]} numberOfLines={1}>
                            Tip de aportación
                          </Text>
                          <Text style={[styles.tipText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {tip}
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={() => navigation.navigate('MetaDetail', { metaId: (item as any).metaId, openAportar: true })}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.tipCta,
                          { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 },
                        ]}
                      >
                        <Ionicons name="add" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={[styles.noTip, { color: colors.textSecondary }]}>
                      Agrega una fecha límite para ver un tip de aportación.
                    </Text>
                  )}
                </View>
              </Animated.View>
            </View>
          </Pressable>
        </Animated.View>
      );
    },
    [colors, contentHeights, enter, expanded, navigation, toggleExpand]
  );

  const empty = useMemo(() => {
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <Ionicons name="flag-outline" size={22} color={colors.textSecondary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin metas</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Crea una meta para empezar a ahorrar.
        </Text>

        <Pressable
          onPress={() => navigation.navigate('CreateMeta')}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.primaryButtonText}>Crear meta</Text>
        </Pressable>
      </View>
    );
  }, [colors, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View style={[styles.headerWrap, { backgroundColor: colors.background }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerGlass,
            { backgroundColor: colors.card, borderBottomColor: colors.border, opacity: headerBgOpacity },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerBorder,
            { backgroundColor: colors.border, opacity: headerBorderOpacity },
          ]}
        />

        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 58 : 46 }]}>
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
              Metas
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {items.length > 0 ? `${items.length} ${selectedFilter === 'todas' ? 'en total' : 'activas'}` : 'Crea tu primera meta'}
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('CreateMeta')}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.softShadow,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="add" size={22} color={colors.button} />
          </Pressable>
        </View>

        {/* Filters (compact pills) */}
        <View style={styles.filtersWrap}>
          <View style={styles.filtersRow}>
            {FILTERS.map((f) => {
              const active = selectedFilter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    if (selectedFilter === f.key) return;
                    if (filterDebounceRef.current) {
                      clearTimeout(filterDebounceRef.current);
                      filterDebounceRef.current = null;
                    }
                    setSelectedFilter(f.key as any);
                  }}
                  style={({ pressed }) => [
                    styles.filterPill,
                    {
                      borderColor: active ? withAlpha(colors.button, 0.28) : withAlpha(colors.border, 0.20),
                      backgroundColor: active ? withAlpha(colors.button, 0.12) : 'transparent',
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: active ? colors.text : colors.textSecondary, fontWeight: active ? '900' : '800' }}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Animated.View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.button} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando metas…</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.textSecondary} />
          </View>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{error}</Text>

          <Pressable
            onPress={() => load()}
            style={({ pressed }) => [
              styles.secondaryButton,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String((it as any).metaId)}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, items.length === 0 && styles.listContentEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.button} />}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={empty}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (loadingMore || loading) return;
            if (total !== null && items.length >= total) return;
            load({ page: page + 1, append: true });
          }}
          ListFooterComponent={() =>
            loadingMore ? (
              <View style={{ padding: 14, alignItems: 'center' }}>
                <ActivityIndicator color={colors.button} />
              </View>
            ) : null
          }
        />
      )}

      {/* Compact floating refresh */}
      {!loading && !error && items.length > 0 ? (
        <Pressable
          onPress={onRefresh}
          hitSlop={12}
          style={({ pressed }) => [
            styles.fab,
            styles.softShadow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate: refreshing ? refreshRotate : '0deg' }] }}>
            <Ionicons name="refresh" size={18} color={colors.textSecondary} />
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
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

  // Header
  headerWrap: {
    position: 'relative',
    zIndex: 10,
    paddingBottom: 10,
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: 1,
    opacity: 0,
  },
  headerBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    opacity: 0,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, fontSize: 12, fontWeight: '800' },

  filtersWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  filtersRow: { flexDirection: 'row', gap: 8 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },

  // Loading / Error
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  loadingText: { fontSize: 14, textAlign: 'center', fontWeight: '700' },
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryButtonText: { fontSize: 13, fontWeight: '900' },

  // List
  listContent: { padding: 16, paddingBottom: 40 },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },

  // Card (compact & pretty)
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    right: -130,
    top: -140,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  leftTop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18 },

  title: { fontSize: 16, fontWeight: '900' },
  fin: { marginTop: 3, fontSize: 12, fontWeight: '700' },

  rightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  estadoPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 120,
  },
  estadoText: { fontSize: 11, fontWeight: '900' },

  iconMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  desc: { marginTop: 10, fontSize: 12, lineHeight: 16, fontWeight: '700' },

  kpis: { marginTop: 10, gap: 8 },
  kpiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kpiLabel: { fontSize: 12, fontWeight: '800' },
  kpiValue: { fontSize: 14, fontWeight: '900' },
  kpiValueMuted: { fontSize: 14, fontWeight: '900' },

  progressTrack: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
    padding: 2,
  },
  progressFill: { height: 6, borderRadius: 999 },

  bottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pct: { fontSize: 12, fontWeight: '900' },
  hint: { flex: 1, fontSize: 12, fontWeight: '800', textAlign: 'right' },

  expandBtn: {
    width: 44,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  expandPanel: {
    marginTop: 10,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  expandContent: {
    paddingTop: 10,
  },

  tipBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tipTitle: { fontSize: 13, fontWeight: '900' },
  tipText: { marginTop: 3, fontSize: 12, fontWeight: '800' },
  tipCta: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTip: { fontSize: 12, fontWeight: '800', lineHeight: 16 },

  // Empty
  emptyWrap: { alignItems: 'center', padding: 24, gap: 10 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '900' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', fontWeight: '700', lineHeight: 18 },

  primaryButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  primaryButtonText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MetasScreen;