import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  Pressable,
  Animated,
  Platform,
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import BackButton from '../components/BackButton';
import { useThemeColors } from '../theme/useThemeColors';
import { blocsService } from '../services/blocsService';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { BlocItemEstado, LiquidationPreviewResponse, LiquidationTargetType } from '../types/blocs';
import { buscarMonedaPorCodigo } from '../constants/monedas';
import { formatForList, parseNumber } from '../utils/numberFormatter';
import { createIdempotencyKey } from '../utils/idempotency';
import {
  emitBlocsChanged,
  emitSubcuentasChanged,
  emitTransaccionesChanged,
  emitViewerChanged,
} from '../utils/dashboardRefreshBus';
import { authService } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from '../utils/jwtDecode';
import type { DashboardSnapshot } from '../types/dashboardSnapshot';
import { fetchDashboardSnapshot, getCachedDashboardSnapshot } from '../services/dashboardSnapshotService';
import { userProfileService } from '../services/userProfileService';
import { API_BASE_URL } from '../constants/api';
import apiRateLimiter from '../services/apiRateLimiter';

const DEFAULT_RANGE = 'month' as const;
const DEFAULT_RECENT_LIMIT = 15;

type ScreenRoute = RouteProp<RootStackParamList, 'BlocDetail'>;

type QuickEstado = BlocItemEstado; // 'pendiente' | 'parcial' | 'pagado' | 'archivado'

type RowModel = {
  key: string; // stable key for list
  itemId?: string; // backend id when created
  titulo: string;
  monto: string; // user input string
  moneda: string; // default
  estado: QuickEstado;
  categoria: string;
  categoriaSource: 'auto' | 'manual';
  saving?: boolean;
  dirty?: boolean;
  isAdder?: boolean; // last “new row”
  createdAtLocal?: number;
};

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

const ESTADOS = [
  { key: 'pendiente', label: 'Pendiente', icon: 'time-outline' },
  { key: 'parcial', label: 'Parcial', icon: 'ellipsis-horizontal-circle-outline' },
  { key: 'pagado', label: 'Pagado', icon: 'checkmark-circle-outline' },
  { key: 'archivado', label: 'Archivado', icon: 'archive-outline' },
  { key: 'todos', label: 'Todos', icon: 'funnel-outline' },
] as const;

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// “IA predictiva” local (heurística) — puedes reemplazar por endpoint después.
function predictCategory(title: string, knownCategories: string[]) {
  const t = normalizeText(title);

  if (!t) return (knownCategories || []).find((c) => normalizeText(c) === 'general') ?? 'General';

  const tokens = t.split(' ').filter(Boolean);
  const tokenSet = new Set(tokens);

  const scoreIncludes = (needle: string) => {
    const n = normalizeText(needle);
    if (!n) return 0;
    // strong signal if a whole token matches
    if (tokenSet.has(n)) return 3;
    // otherwise substring match
    return t.includes(n) ? 1 : 0;
  };

  const map: Array<{ keys: string[]; cat: string }> = [
    {
      cat: 'Alimentos',
      keys: [
        'cafe',
        'cafeteria',
        'taco',
        'tacos',
        'pizza',
        'burger',
        'hamburguesa',
        'restaurante',
        'comida',
        'super',
        'supermercado',
        'verdura',
        'fruta',
        'camarones',
        'pollo',
        'carne',
        'uber eats',
        'rappi',
        'didi food',
        'cena',
        'desayuno',
        'comedor',
      ],
    },
    {
      cat: 'Transporte',
      keys: [
        'uber',
        'didi',
        'taxi',
        'gas',
        'gasolina',
        'camion',
        'bus',
        'metro',
        'estacionamiento',
        'peaje',
        'caseta',
        'carro',
        'auto',
        'mecanico',
        'servicio',
        'verificacion',
      ],
    },
    { cat: 'Hogar', keys: ['renta', 'alquiler', 'luz', 'cfe', 'agua', 'internet', 'telmex', 'izzi', 'gas lp', 'mantenimiento', 'limpieza'] },
    { cat: 'Salud', keys: ['farmacia', 'doctor', 'medico', 'hospital', 'consulta', 'dentista', 'medicina', 'vitaminas'] },
    { cat: 'Entretenimiento', keys: ['netflix', 'spotify', 'cine', 'juego', 'steam', 'concierto', 'youtube', 'hbo', 'disney'] },
    { cat: 'Compras', keys: ['amazon', 'mercado libre', 'tienda', 'ropa', 'playera', 'zapatos', 'walmart', 'costco', 'sams'] },
    { cat: 'Educacion', keys: ['curso', 'escuela', 'colegiatura', 'libro', 'udemy', 'platzi'] },
    { cat: 'Viajes', keys: ['vuelo', 'hotel', 'airbnb', 'viaje', 'avion', 'aeropuerto', 'maleta'] },
    { cat: 'Servicios', keys: ['suscripcion', 'membresia', 'plan', 'recibo', 'servicio', 'mensualidad'] },
  ];

  let best = '';
  let bestScore = 0;

  for (const group of map) {
    let score = 0;
    for (const k of group.keys) score += scoreIncludes(k);
    if (score > bestScore) {
      bestScore = score;
      best = group.cat;
    }
  }

  // Extra: if any known category name token appears in the title, boost it.
  const known = (knownCategories || []).filter(Boolean);
  for (const cat of known) {
    const cNorm = normalizeText(cat);
    if (!cNorm) continue;
    const cTokens = cNorm.split(' ').filter((x) => x.length >= 3);
    let score = 0;
    for (const ct of cTokens) score += scoreIncludes(ct);
    // Only consider category-name matches when there is at least some signal.
    if (score > bestScore && score >= 3) {
      bestScore = score;
      best = cat;
    }
  }

  const pickKnown = (want: string) => {
    const w = normalizeText(want);
    const direct = known.find((c) => normalizeText(c) === w);
    if (direct) return direct;
    const close = known.find((c) => normalizeText(c).includes(w) || w.includes(normalizeText(c)));
    return close ?? want;
  };

  if (best && bestScore > 0) return pickKnown(best);
  // fallback: if user writes something like "renta depa" and map didn't catch, keep "General"
  return pickKnown('General');
}

function estadoCycle(current: QuickEstado): QuickEstado {
  if (current === 'pendiente') return 'parcial';
  if (current === 'parcial') return 'pagado';
  if (current === 'pagado') return 'pendiente';
  if (current === 'archivado') return 'pendiente';
  return 'pendiente';
}

function estadoStrikeWidth(estado: QuickEstado): string {
  if (estado === 'pagado') return '100%';
  if (estado === 'parcial') return '55%';
  return '0%';
}

function pendingFromRow(row: RowModel): number {
  const amt = parseNumber(row.monto) ?? 0;
  if (row.estado === 'pagado') return 0;
  if (row.estado === 'archivado') return 0;
  if (row.estado === 'parcial') return Math.max(0, amt * 0.5);
  return Math.max(0, amt);
}

function sumByCurrencyRows(rows: RowModel[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.isAdder) continue;
    const cur = (r.moneda || 'MXN').trim().toUpperCase();
    const pending = pendingFromRow(r);
    if (!pending) continue;
    out[cur] = (out[cur] ?? 0) + pending;
  }
  return out;
}

function makeAdderRow(defaultCurrency: string): RowModel {
  return {
    key: `new_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    isAdder: true,
    titulo: '',
    monto: '',
    moneda: defaultCurrency || 'MXN',
    estado: 'pendiente',
    categoria: '',
    categoriaSource: 'auto',
    saving: false,
    dirty: false,
    createdAtLocal: Date.now(),
  };
}

function ensureAdderRow(nextRows: RowModel[], defaultCurrency: string): RowModel[] {
  const hasAdder = nextRows.some((r) => r.isAdder);
  if (hasAdder) return nextRows;
  return [...nextRows, makeAdderRow(defaultCurrency || 'MXN')];
}

export default function BlocDetailScreen() {
  const colors = useThemeColors();
  const route = useRoute<ScreenRoute>();
  const blocId = route.params.blocId;

  const [showAllCategories, setShowAllCategories] = useState(false);

  // UI anims
  const enter = useRef(new Animated.Value(0)).current;
  const headerShadow = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // data
  const [blocNombre, setBlocNombre] = useState<string>('');
  const [rows, setRows] = useState<RowModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Keep a live reference to rows to avoid stale-closure autosave creating duplicates.
  const rowsRef = useRef<RowModel[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // filters
  const [estado, setEstado] = useState<BlocItemEstado | 'todos'>('pendiente');
  const [categoria, setCategoria] = useState<string>('');

  // selection (for liquidation)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // delete (no modal)
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());

  // liquidate
  const [liquidateOpen, setLiquidateOpen] = useState(false);
  const [targetType, setTargetType] = useState<LiquidationTargetType>('principal');
  const [targetId, setTargetId] = useState<string>('');
  const [liquidateNote, setLiquidateNote] = useState('');
  const [preview, setPreview] = useState<LiquidationPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [mainAccountCacheSaldo, setMainAccountCacheSaldo] = useState<number | null>(null);
  const [mainAccountCacheMoneda, setMainAccountCacheMoneda] = useState<string | null>(null);
  const [subcuentasLoading, setSubcuentasLoading] = useState(false);
  const [subcuentasError, setSubcuentasError] = useState<string | null>(null);

  // focus refs for inputs
  const titleRefs = useRef<Record<string, TextInput | null>>({});
  const amountRefs = useRef<Record<string, TextInput | null>>({});

  // autosave debounce timers
  const saveTimers = useRef<Record<string, any>>({});
  const inFlight = useRef<Record<string, boolean>>({});
  const creating = useRef<Record<string, boolean>>({});

  const cancelAutosaveTimer = useCallback((key: string) => {
    const t = saveTimers.current[key];
    if (t) {
      clearTimeout(t);
      delete saveTimers.current[key];
    }
  }, []);

  // Release create/inFlight locks once the local row reflects an itemId (or disappears).
  useEffect(() => {
    const current = rows;
    for (const k of Object.keys(creating.current)) {
      if (!creating.current[k]) continue;
      const r = current.find((x) => x.key === k);
      if (!r || r.itemId) {
        creating.current[k] = false;
        inFlight.current[k] = false;
      }
    }
  }, [rows]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
      } catch {}
    }
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [enter]);

  // Try to read the balance cache used by BalanceCard so values shown in liquidation match
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('balance_cache');
        if (!raw || !mounted) return;
        const data = JSON.parse(raw);
        const cachedSaldo = Number(data?.saldo ?? data?.balance ?? data?.cantidad ?? NaN);
        const cachedMon = String(data?.moneda ?? data?.monedaCuenta ?? data?.currency ?? '').toUpperCase() || null;
        if (Number.isFinite(cachedSaldo) && mounted) setMainAccountCacheSaldo(cachedSaldo);
        if (cachedMon && mounted) setMainAccountCacheMoneda(cachedMon);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

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

  const defaultCurrency = useMemo(() => {
    // best effort: use currency of first real row, otherwise MXN
    const first = rows.find((r) => !r.isAdder && r.moneda);
    return (first?.moneda || 'MXN').toUpperCase();
  }, [rows]);

  const knownCategories = useMemo(() => {
    const cats = rows
      .filter((r) => !r.isAdder)
      .map((r) => (r.categoria || '').trim())
      .filter(Boolean);
    return Array.from(new Set(cats)).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const categories = useMemo(() => {
    // include AI “General” + known
    const base = ['General', ...knownCategories].filter(Boolean);
    return Array.from(new Set(base)).sort((a, b) => a.localeCompare(b));
  }, [knownCategories]);

  const ensureAdder = useCallback(
    (nextRows: RowModel[]) => {
      return ensureAdderRow(nextRows, defaultCurrency);
    },
    [defaultCurrency]
  );

  const loadSnapshot = useCallback(async () => {
    console.log('[BlocDetail] loadSnapshot start', { selectedCount: selectedIds.size, targetType });
    setSnapshotLoading(true);
    try {
      const token = await authService.getAccessToken();
      console.log('[BlocDetail] loadSnapshot token present?', !!token);
      if (!token) return;
      const decoded: any = jwtDecode(token);
      let userId: string | undefined =
        decoded?.id ?? decoded?.userId ?? decoded?.sub ?? decoded?.cuentaId ?? decoded?.usuarioId ?? decoded?.user?.id;
      console.log('[BlocDetail] loadSnapshot decoded userId (initial)', userId);

      // If token payload didn't include a user id, try cached profile or fetch profile
      if (!userId) {
        try {
          const cachedProf = await userProfileService.getCachedProfile();
          if (cachedProf?.id) {
            userId = String(cachedProf.id);
            console.log('[BlocDetail] loadSnapshot userId from cached profile', userId);
          }
        } catch (e) {
          console.warn('[BlocDetail] loadSnapshot getCachedProfile failed', (e as any)?.message || e);
        }
      }

      if (!userId) {
        try {
          const fetched = await userProfileService.fetchAndUpdateProfile();
          if (fetched?.id) {
            userId = String(fetched.id);
            console.log('[BlocDetail] loadSnapshot userId from fetched profile', userId);
          }
        } catch (e) {
          console.warn('[BlocDetail] loadSnapshot fetchAndUpdateProfile failed', (e as any)?.message || e);
        }
      }

      if (!userId) {
        console.warn('[BlocDetail] loadSnapshot: could not determine userId, subcuentas fallback will be skipped');
        return;
      }

      const cached = await getCachedDashboardSnapshot({
        userId: String(userId),
        range: DEFAULT_RANGE,
        recentLimit: DEFAULT_RECENT_LIMIT,
      });

      const cachedHasSubs = cached?.snapshot ? Array.isArray((cached.snapshot as any)?.subaccountsSummary) : false;
      const cachedHasAccount = cached?.snapshot ? Boolean((cached.snapshot as any)?.accountSummary) : false;
      const shouldFetch = !cached?.snapshot || !cachedHasSubs || !cachedHasAccount;

      if (cached?.snapshot) {
        setSnapshot(cached.snapshot);
      }

      const res = shouldFetch
        ? await fetchDashboardSnapshot({
            range: DEFAULT_RANGE,
            recentLimit: DEFAULT_RECENT_LIMIT,
            // Ensure subaccounts are included even if backend paginates/omits by default.
            subaccountsLimit: 200,
            subaccountsPage: 1,
          })
        : null;

      if (res && res.kind === 'ok') {
        setSnapshot(res.snapshot);
      }

      // Fallback: if snapshot doesn't include subaccountsSummary (or it's empty), fetch the list
      // from the dedicated subcuenta endpoint (same source used by SubaccountList).
      const fetchSubcuentasFallback = async (signal?: AbortSignal) => {
        setSubcuentasLoading(true);
        setSubcuentasError(null);
        try {
          const current = (res && res.kind === 'ok' ? res.snapshot : cached?.snapshot) as any;
          const subs = current?.subaccountsSummary;

          console.log('[BlocDetail] fetchSubcuentasFallback start', {
            userId,
            tokenPresent: !!token,
            cachedSnapshotPresent: !!cached?.snapshot,
            subsType: Object.prototype.toString.call(subs),
            subsLength: Array.isArray(subs) ? subs.length : null,
          });

          if (Array.isArray(subs) && subs.length > 0) {
            console.log('[BlocDetail] fetchSubcuentasFallback: snapshot already has subaccounts, skipping fetch');
            return true;
          }

          const url = `${API_BASE_URL}/subcuenta/${encodeURIComponent(String(userId))}?soloActivas=false&page=1&limit=200`;
          console.log('[BlocDetail] fetchSubcuentasFallback fetching url', url);
          const r = await apiRateLimiter.fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Skip-Cache': '1',
            },
            signal,
          });

          console.log('[BlocDetail] fetchSubcuentasFallback fetch response status', r.status);

          let data = (await r.json().catch(() => null)) as any;
          console.log('[BlocDetail] fetchSubcuentasFallback parsed data length', Array.isArray(data) ? data.length : typeof data);
          if (data && !Array.isArray(data) && Array.isArray(data.data)) data = data.data;
          if (!Array.isArray(data)) {
            setSubcuentasError('Respuesta inesperada del servidor');
            return false;
          }

          const normalized = data
            .map((s: any) => {
              const id = s?.subCuentaId ?? s?.id ?? s?._id;
              if (!id) return null;
              return {
                id: String(id),
                nombre: String(s?.nombre ?? 'Subcuenta'),
                saldo: Number(s?.saldo ?? s?.cantidad ?? 0),
                moneda: String(s?.moneda ?? '').toUpperCase(),
                activa: Boolean(s?.activa ?? true),
                pausadaPorPlan: Boolean(s?.pausadaPorPlan ?? false),
                color: (s?.color ?? null) as any,
                simbolo: (s?.simbolo ?? null) as any,
              };
            })
            .filter(Boolean);

          if (normalized.length === 0) {
            setSubcuentasError('No se encontraron subcuentas');
            return false;
          }

          console.log('[BlocDetail] Fallback subcuentas cargadas:', normalized.length);

          setSnapshot((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              subaccountsSummary: normalized as any,
            };
          });

          return true;
        } catch (err: any) {
          console.warn('[BlocDetail] Error cargando subcuentas fallback:', err?.message || err);
          setSubcuentasError(err?.message || 'Error desconocido');
          return false;
        } finally {
          setSubcuentasLoading(false);
        }
      };

      void fetchSubcuentasFallback();
    } catch {
      // best effort
    } finally {
      setSnapshotLoading(false);
    }
  }, [targetId, targetType]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      try {
        if (mode === 'refresh') setRefreshing(true);

        const detail = await blocsService.getBlocDetail(blocId);
        setBlocNombre(detail.bloc?.nombre ?? 'Bloc');

        const items = Array.isArray(detail.items) ? detail.items : [];
        const baseCurrency = (items.find((x: any) => x?.moneda)?.moneda || 'MXN').toUpperCase();

        const knownCategoriesFromItems = Array.from(
          new Set(
            items
              .map((it: any) => String(it?.categoria ?? '').trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));

        const nextRows: RowModel[] = items.map((it: any) => {
          const titulo = String(it.titulo ?? '');
          const monto =
            it.modo === 'monto'
              ? String(it.monto ?? '')
              : String(Number(it.cantidad ?? 0) * Number(it.precioUnitario ?? 0));

          const hasCat = Boolean((it.categoria ?? '').trim());
          const autoCat = predictCategory(titulo, knownCategoriesFromItems);

          return {
            key: String(it.itemId),
            itemId: String(it.itemId),
            titulo,
            monto,
            moneda: String(it.moneda ?? baseCurrency).toUpperCase(),
            estado: (it.estado ?? 'pendiente') as QuickEstado,
            categoria: hasCat ? String(it.categoria) : autoCat,
            categoriaSource: hasCat ? 'manual' : 'auto',
            saving: false,
            dirty: false,
          };
        });

        // keep selection only on existing ids
        setSelectedIds((prev) => {
          const available = new Set(nextRows.map((r) => r.itemId).filter(Boolean) as string[]);
          const next = new Set<string>();
          for (const id of prev) if (available.has(id)) next.add(id);
          return next;
        });

        setRows(ensureAdderRow(nextRows, baseCurrency));
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo cargar el bloc' });
      } finally {
        setRefreshing(false);
      }
    },
    [blocId]
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
      void loadSnapshot();
    }, [load, loadSnapshot])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 800, useNativeDriver: true })).start();
    try {
      await load('refresh');
    } finally {
      rotate.stopAnimation(() => rotate.setValue(0));
      setRefreshing(false);
    }
  }, [load, rotate]);

  // -------- selection
  const toggleSelect = useCallback(
    (row: RowModel) => {
      if (!row.itemId) return; // can’t select unsaved
      if (row.estado !== 'pendiente' && row.estado !== 'parcial') {
        Toast.show({
          type: 'info',
          text1: 'No seleccionable',
          text2: 'Solo puedes liquidar items en pendiente o parcial',
        });
        return;
      }
      animateLayout();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(row.itemId!)) next.delete(row.itemId!);
        else next.add(row.itemId!);
        return next;
      });
    },
    [animateLayout]
  );

  const clearSelection = useCallback(() => {
    animateLayout();
    setSelectedIds(new Set());
  }, [animateLayout]);

  // -------- filters
  const filteredRows = useMemo(() => {
    const list = rows.filter((r) => !r.isAdder); // existing + created
    return list.filter((r) => {
      if (estado !== 'todos' && r.estado !== estado) return false;
      if (categoria && (r.categoria || '') !== categoria) return false;
      return true;
    });
  }, [categoria, estado, rows]);

  const adderRow = useMemo(() => rows.find((r) => r.isAdder) ?? makeAdderRow(defaultCurrency), [rows, defaultCurrency]);

  // always show adder row (even when filtering)
  const dataRows = useMemo(() => {
    return [...filteredRows, adderRow];
  }, [filteredRows, adderRow]);

  // totals realtime (use ALL non-adder rows, not only filtered, then show filtered totals too)
  const totalsByCurrencyFiltered = useMemo(() => sumByCurrencyRows(filteredRows), [filteredRows]);
  const totalsByCurrencyAll = useMemo(() => sumByCurrencyRows(rows.filter((r) => !r.isAdder)), [rows]);

  const selectedRowModels = useMemo(() => {
    const ids = selectedIds;
    return rows.filter((r) => !!r.itemId && ids.has(r.itemId!));
  }, [rows, selectedIds]);

  const selectedTotals = useMemo(() => sumByCurrencyRows(selectedRowModels), [selectedRowModels]);

  // -------- category auto-update (when stop typing)
  const updateRow = useCallback(
    (key: string, patch: Partial<RowModel>, opts?: { immediateSave?: boolean }) => {
      setRows((prev) => {
        const next = prev.map((r) => {
          if (r.key !== key) return r;

          const merged = { ...r, ...patch, dirty: r.isAdder ? true : true };

          // auto category on title change (only if auto source)
          if (typeof patch.titulo === 'string') {
            const title = patch.titulo;
            if (merged.categoriaSource === 'auto') {
              merged.categoria = predictCategory(title, categories);
            }
          }

          return merged;
        });

        return ensureAdder(next);
      });

      // debounce autosave
      const wait = opts?.immediateSave ? 120 : 650;
      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(() => {
        void autosaveRow(key);
      }, wait);
    },
    [categories, ensureAdder]
  );

  // resolve created id fallback
  const resolveCreatedId = useCallback(
    async (titulo: string, montoNum: number) => {
      try {
        const detail = await blocsService.getBlocDetail(blocId);
        const items = Array.isArray(detail.items) ? detail.items : [];
        // prefer most recent match
        const matches = items.filter((it: any) => {
          const t = String(it.titulo ?? '').trim();
          const m = Number(it.monto ?? 0);
          return t === titulo.trim() && Math.abs(m - montoNum) < 0.0001;
        });
        if (!matches.length) return null;
        const newest = matches.sort((a: any, b: any) => {
          const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bd - ad;
        })[0];
        const newestAny = newest as { itemId?: unknown; _id?: unknown; id?: unknown };
        return String(newestAny.itemId ?? newestAny._id ?? newestAny.id ?? '');
      } catch {
        return null;
      }
    },
    [blocId]
  );

  // autosave logic
  const autosaveRow = useCallback(
    async (key: string) => {
      // prevent parallel in-flight for same row
      if (inFlight.current[key]) return;

      // Prevent double-creation for the same local row key.
      if (creating.current[key]) return;

      // If a debounce timer is pending, cancel it so it can't fire after submit.
      cancelAutosaveTimer(key);

      const row = rowsRef.current.find((r) => r.key === key);
      if (!row) return;

      // If adder row is empty, do nothing
      const titulo = (row.titulo || '').trim();
      const montoNum = parseNumber(row.monto);
      const hasValid = titulo.length > 0 && montoNum !== null && montoNum > 0;

      if (!row.itemId) {
        // New row
        if (!hasValid) return;
        inFlight.current[key] = true;
        creating.current[key] = true;
        let createdOk = false;

        try {
          updateRow(key, { saving: true }, { immediateSave: false });

          const categoriaAuto = row.categoriaSource === 'auto' ? predictCategory(titulo, categories) : row.categoria;
          const monedaVal = (row.moneda || 'MXN').trim().toUpperCase();

          // Use batch upsert endpoint for autosave-friendly creation
          let createdId: string | null = null;
          try {
            const res = await blocsService.patchItems(blocId, {
              upserts: [
                {
                  categoria: categoriaAuto,
                  titulo,
                  descripcion: undefined,
                  moneda: monedaVal,
                  modo: 'monto',
                  monto: montoNum!,
                },
              ],
            });
            createdId = res?.createdItems?.[0]?.itemId ? String(res.createdItems[0].itemId) : null;
          } catch (e: any) {
            // fallback to older endpoint if backend doesn't support batch
            if (e?.status === 404 || e?.status === 405) {
              const created: any = await blocsService.createItem(blocId, {
                categoria: categoriaAuto,
                titulo,
                descripcion: undefined,
                moneda: monedaVal,
                modo: 'monto',
                monto: montoNum!,
              });
              createdId =
                (created as any)?.itemId ?? (created as any)?.id ?? (created as any)?._id ?? (created as any)?.data?.itemId;
              createdId = createdId ? String(createdId) : null;
            } else {
              throw e;
            }
          }

          if (!createdId) {
            // fallback to refresh/match
            const matched = await resolveCreatedId(titulo, montoNum!);
            createdId = matched ? String(matched) : null;
          }

          if (!createdId) {
            throw new Error('No se pudo confirmar el item creado. Desliza para refrescar.');
          }

          animateLayout();
          setRows((prev) => {
            const next = prev.map((r) => {
              if (r.key !== key) return r;
              return {
                ...r,
                isAdder: false,
                itemId: String(createdId),
                categoria: categoriaAuto,
                categoriaSource: r.categoriaSource,
                saving: false,
                dirty: false,
              };
            });

            // always append a fresh adder if current adder was consumed
            const hasAdder = next.some((r) => r.isAdder);
            return hasAdder ? next : [...next, makeAdderRow(monedaVal)];
          });

          createdOk = true;

          emitBlocsChanged();

          // UX: focus title of next adder row
          setTimeout(() => {
            const nextAdder = (Object.values(titleRefs.current) || []).find(() => false);
            // find last adder row key
            const current = rows.find((r) => r.key === key);
            // focus best-effort after state settles:
            setTimeout(() => {
              // locate latest adder in refs
              const keys = Object.keys(titleRefs.current);
              // newest ref likely last mounted; try focusing the one with empty title
              for (let i = keys.length - 1; i >= 0; i--) {
                const ref = titleRefs.current[keys[i]];
                if (ref) {
                  ref.focus();
                  break;
                }
              }
            }, 50);
          }, 0);
        } catch (e: any) {
          Toast.show({
            type: 'error',
            text1: 'No se pudo crear',
            text2: e?.message || 'Intenta de nuevo',
          });
          updateRow(key, { saving: false }, { immediateSave: false });
        } finally {
          // If create failed, make sure locks are released.
          if (!createdOk) {
            if (creating.current[key]) creating.current[key] = false;
            if (inFlight.current[key]) inFlight.current[key] = false;
          }
        }

        return;
      }

      // Existing row updates
      if (!row.dirty) return;
      if (!hasValid) return;

      inFlight.current[key] = true;
      try {
        updateRow(key, { saving: true }, { immediateSave: false });

        const categoriaAuto =
          row.categoriaSource === 'auto' ? predictCategory(titulo, categories) : row.categoria;

        const patch: any = {
          titulo,
          categoria: categoriaAuto,
          moneda: (row.moneda || 'MXN').trim().toUpperCase(),
          modo: 'monto',
          monto: montoNum!,
        };

        // Use batch upsert endpoint for autosave-friendly updates (estado is NOT allowed here)
        try {
          await blocsService.patchItems(blocId, {
            upserts: [{ itemId: row.itemId, ...patch }],
          });
        } catch (e: any) {
          // fallback to older endpoint if backend doesn't support batch
          if (e?.status === 404 || e?.status === 405) {
            await blocsService.updateItem(blocId, row.itemId, patch);
          } else {
            throw e;
          }
        }

        setRows((prev) =>
          prev.map((r) =>
            r.key === key
              ? { ...r, categoria: categoriaAuto, saving: false, dirty: false }
              : r
          )
        );

        emitBlocsChanged();
      } catch {
        updateRow(key, { saving: false }, { immediateSave: false });
      } finally {
        inFlight.current[key] = false;
      }
    },
    [animateLayout, blocId, cancelAutosaveTimer, categories, resolveCreatedId, updateRow]
  );

  // plus behavior: focus adder row title
  const focusAdder = useCallback(() => {
    const adder = rows.find((r) => r.isAdder) ?? adderRow;
    if (!adder) return;
    setTimeout(() => {
      titleRefs.current[adder.key]?.focus?.();
    }, 30);
  }, [adderRow, rows]);

  const deleteRow = useCallback(
    async (row: RowModel) => {
      // prevent double taps
      setDeletingKeys((prev) => {
        if (prev.has(row.key)) return prev;
        const next = new Set(prev);
        next.add(row.key);
        return next;
      });

      try {
        // if not saved, just remove locally
        if (!row.itemId) {
          animateLayout();
          setRows((prev) => ensureAdder(prev.filter((r) => r.key !== row.key)));
          return;
        }

        // Prefer batch delete endpoint; fallback to legacy delete
        try {
          await blocsService.patchItems(blocId, { deleteItemIds: [row.itemId] });
        } catch (e: any) {
          if (e?.status === 404 || e?.status === 405) {
            await blocsService.deleteItem(blocId, row.itemId);
          } else {
            throw e;
          }
        }
        emitBlocsChanged();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(row.itemId!);
          return next;
        });
        animateLayout();
        setRows((prev) => ensureAdder(prev.filter((r) => r.itemId !== row.itemId)));
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo eliminar el item' });
      } finally {
        setDeletingKeys((prev) => {
          if (!prev.has(row.key)) return prev;
          const next = new Set(prev);
          next.delete(row.key);
          return next;
        });
      }
    },
    [animateLayout, blocId, ensureAdder]
  );

  // liquidation
  const openLiquidate = useCallback(() => {
    if (selectedIds.size === 0) {
      Toast.show({ type: 'info', text1: 'Selecciona items', text2: 'Elige uno o más items para liquidar' });
      return;
    }
    // simplest default: principal account
    setTargetType('principal');
    setTargetId('');
    setLiquidateNote('');
    setPreview(null);
    setLiquidateOpen(true);
    // Load snapshot for subcuentas etc. but also fetch authoritative principal balance now
    void loadSnapshot();
    (async () => {
      try {
        const token = await authService.getAccessToken();
        if (!token) return;
        const res = await apiRateLimiter.fetch(`${API_BASE_URL}/cuenta/principal`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store', 'X-Skip-Cache': '1' },
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const payload = data?.data ?? data ?? {};
        const nuevoSaldo = Number(payload.cantidad ?? payload.saldo ?? payload.balance ?? payload.amount ?? NaN);
        const nuevaMoneda = String(payload.moneda ?? payload.currency ?? payload.monedaCuenta ?? '').toUpperCase() || null;
        if (Number.isFinite(nuevoSaldo)) setMainAccountCacheSaldo(nuevoSaldo);
        if (nuevaMoneda) setMainAccountCacheMoneda(nuevaMoneda);
      } catch {
        // ignore fetch errors — we already have snapshot/cache fallback
      }
    })();
  }, [loadSnapshot, selectedIds.size]);

  const doPreview = useCallback(async () => {
    if (targetType === 'subcuenta' && !targetId) {
      Toast.show({ type: 'info', text1: 'Selecciona destino', text2: 'Elige cuenta o subcuenta' });
      return;
    }
    try {
      setPreviewLoading(true);
      const itemIds = Array.from(selectedIds);
      const res = await blocsService.liquidationPreview(blocId, {
        itemIds,
        targetType,
        ...(targetType === 'principal' ? {} : { targetId }),
        porItem: true,
      });
      animateLayout();
      setPreview(res);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo previsualizar' });
    } finally {
      setPreviewLoading(false);
    }
  }, [animateLayout, blocId, selectedIds, targetId, targetType]);

  const targetBalance = useMemo(() => {
    if (!snapshot) return null;

    if (targetType === 'principal') {
      if (!snapshot.accountSummary) return null;
      return {
        currency: String(snapshot.accountSummary.moneda || '').toUpperCase(),
        saldo: Number(snapshot.accountSummary.saldo ?? 0),
        label: 'Cuenta principal',
      };
    }

    if (targetType === 'subcuenta') {
      const sub = (snapshot.subaccountsSummary ?? []).find(
        (s: any) => String(s.subCuentaId ?? s.id ?? s._id) === String(targetId)
      );
      if (!sub) return null;
      return {
        currency: String(sub.moneda || '').toUpperCase(),
        saldo: Number(sub.saldo ?? 0),
        label: sub.nombre || 'Subcuenta',
      };
    }

    return null;
  }, [snapshot, targetId, targetType]);

  const fundsCheck = useMemo(() => {
    if (!preview || !targetBalance) return { canValidate: false, ok: true as const };

    const targetCurrency = String(preview.targetCurrency || '').toUpperCase();
    const balanceCurrency = String(targetBalance.currency || '').toUpperCase();
    if (targetCurrency && balanceCurrency && targetCurrency !== balanceCurrency) {
      return { canValidate: true, ok: false as const, reason: 'currency-mismatch' as const };
    }

    const required = Number(preview.totalConverted ?? 0);
    const available = Number(targetBalance.saldo ?? 0);
    const ok = available + 1e-6 >= required;
    const missing = ok ? 0 : Math.max(0, required - available);
    return { canValidate: true, ok, required, available, missing };
  }, [preview, targetBalance]);

  const confirmDisabled = !preview || commitLoading || (fundsCheck.canValidate && !fundsCheck.ok);

  const doCommit = useCallback(async () => {
    if (targetType === 'subcuenta' && !targetId) return;
    if (fundsCheck.canValidate && !fundsCheck.ok) {
      if ((fundsCheck as any).reason === 'currency-mismatch') {
        Toast.show({ type: 'error', text1: 'Moneda incompatible', text2: 'La moneda del destino no coincide con el preview' });
      } else {
        Toast.show({ type: 'error', text1: 'Saldo insuficiente', text2: 'El destino no tiene saldo suficiente para liquidar' });
      }
      return;
    }
    try {
      setCommitLoading(true);
      const idempotencyKey = createIdempotencyKey(`bloc_${blocId}`);
      await blocsService.liquidationCommit(
        blocId,
        {
          itemIds: Array.from(selectedIds),
          targetType,
          ...(targetType === 'principal' ? {} : { targetId }),
          porItem: true,
          nota: liquidateNote.trim() ? liquidateNote.trim() : undefined,
        },
        { idempotencyKey }
      );

      setLiquidateOpen(false);
      setSelectedIds(new Set());
      setPreview(null);

      emitBlocsChanged();
      emitTransaccionesChanged();
      emitSubcuentasChanged();
      emitViewerChanged();

      void load('refresh');

      Toast.show({ type: 'success', text1: 'Liquidación completada' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo liquidar' });
    } finally {
      setCommitLoading(false);
    }
  }, [blocId, fundsCheck, liquidateNote, load, selectedIds, targetId, targetType]);

  const targetOptions = useMemo(() => {
    const subsRaw = ((snapshot as any)?.subaccountsSummary ??
      (snapshot as any)?.subcuentasSummary ??
      (snapshot as any)?.subcuentas ??
      (snapshot as any)?.subaccounts ??
      []) as any[];

    const subsArr = Array.isArray(subsRaw) ? subsRaw : [];

    const subs = subsArr.map((s: any) => {
      const id = s.subCuentaId ?? s.id ?? s._id;
      const saldo = Number(s?.saldo ?? s?.cantidad ?? 0);
      const monedaCode = String(s?.moneda ?? '').toUpperCase();
      const sym = buscarMonedaPorCodigo(monedaCode)?.simbolo ?? '$';
      const saldoFmt = formatForList(saldo, sym).formatted;
      return {
        type: 'subcuenta' as const,
        id,
        label: `${s.nombre} (${monedaCode}) — ${saldoFmt}`,
      };
    });

    return [...subs].filter((x) => Boolean(x.id));
  }, [snapshot]);

  const statusTone = useCallback(
    (estadoVal: QuickEstado) => {
      const base =
        estadoVal === 'pendiente'
          ? colors.warning
          : estadoVal === 'parcial'
            ? colors.info
            : estadoVal === 'pagado'
              ? colors.success
              : colors.border;

      return {
        bg: withAlpha(base, 0.12),
        bd: withAlpha(base, 0.32),
      };
    },
    [colors.border, colors.info, colors.success, colors.warning]
  );

  const onSubmitTitle = useCallback(
    (key: string) => {
      cancelAutosaveTimer(key);
      amountRefs.current[key]?.focus?.();
      void autosaveRow(key);
    },
    [autosaveRow, cancelAutosaveTimer]
  );

  const onSubmitAmount = useCallback(
    (key: string) => {
      cancelAutosaveTimer(key);
      amountRefs.current[key]?.blur?.();
      void autosaveRow(key);
    },
    [autosaveRow, cancelAutosaveTimer]
  );

  const setRowEstado = useCallback(
    async (row: RowModel, nextEstado: QuickEstado) => {
      const prevEstado = row.estado;
      animateLayout();

      // Update local row state immediately
      setRows((prev) =>
        prev.map((r) =>
          r.key === row.key
            ? {
                ...r,
                estado: nextEstado,
                saving: r.itemId ? true : r.saving,
              }
            : r
        )
      );

      // If it's not saved yet, there's nothing to persist.
      if (!row.itemId) return;

      try {
        await blocsService.updateItem(blocId, row.itemId, { estado: nextEstado } as any);
        emitBlocsChanged();
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: e?.message || 'No se pudo actualizar el estado',
        });
        setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, estado: prevEstado } : r)));
      } finally {
        setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, saving: false } : r)));
      }
    },
    [animateLayout, blocId]
  );

  const headerTotals = useMemo((): { filtered: [string, number][]; all: [string, number][] } => {
    const filtered = Object.entries(totalsByCurrencyFiltered) as [string, number][];
    const all = Object.entries(totalsByCurrencyAll) as [string, number][];
    filtered.sort((a, b) => a[0].localeCompare(b[0]));
    all.sort((a, b) => a[0].localeCompare(b[0]));
    return { filtered, all };
  }, [totalsByCurrencyAll, totalsByCurrencyFiltered]);

  const selectedTotalsEntries = useMemo((): [string, number][] => {
    const entries = Object.entries(selectedTotals) as [string, number][];
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [selectedTotals]);

  const destinationsForType = useMemo(() => {
    if (targetType !== 'subcuenta') return [] as typeof targetOptions;
    return targetOptions;
  }, [targetOptions, targetType]);

  const renderRow = useCallback(
    ({ item, index }: { item: RowModel; index: number }) => {
      const isSelected = !!item.itemId && selectedIds.has(item.itemId);
      const tone = statusTone(item.estado);
      const strikeW = estadoStrikeWidth(item.estado);
      const dim = item.estado === 'archivado' ? 0.65 : 1;
      const symbol = buscarMonedaPorCodigo(item.moneda)?.simbolo ?? '$';
      const remaining = item.estado === 'parcial' ? pendingFromRow(item) : 0;
      const remainingFormatted =
        item.estado === 'parcial' && remaining > 0
          ? formatForList(remaining, symbol).formatted
          : '';

      const isAdder = !!item.isAdder;

      const itemAnimY = enter.interpolate({
        inputRange: [0, 1],
        outputRange: [10 + Math.min(index, 8) * 2, 0],
      });

      return (
        <Animated.View style={{ opacity: enter, transform: [{ translateY: itemAnimY }] }}>
          <View
            style={[
              styles.rowCard,
              styles.softShadow,
              {
                backgroundColor: colors.card,
                borderColor: isAdder ? withAlpha(colors.button, 0.18) : isSelected ? colors.button : colors.border,
                opacity: dim,
              },
            ]}
          >
            {/* left select */}
            <Pressable
              onPress={() => toggleSelect(item)}
              disabled={!item.itemId}
              hitSlop={10}
              style={[
                styles.check,
                {
                  borderColor: item.itemId ? (isSelected ? colors.button : colors.border) : withAlpha(colors.border, 0.25),
                  backgroundColor: isSelected ? withAlpha(colors.button, 0.12) : 'transparent',
                  opacity: item.itemId ? 1 : 0.4,
                },
              ]}
            >
              {isSelected ? <Ionicons name="checkmark" size={16} color={colors.button} /> : null}
            </Pressable>

            {/* main editable */}
            <View style={{ flex: 1 }}>
              <View style={styles.editRow}>
                <View style={styles.titleWrap}>
                  <TextInput
                    ref={(r) => {
                      if (r) titleRefs.current[item.key] = r;
                    }}
                    value={item.titulo}
                    onChangeText={(v) => updateRow(item.key, { titulo: v, categoriaSource: item.categoriaSource }, { immediateSave: false })}
                    placeholder={isAdder ? 'Nuevo item…' : 'Título'}
                    placeholderTextColor={colors.placeholder}
                    returnKeyType="next"
                    onSubmitEditing={() => onSubmitTitle(item.key)}
                    style={[
                      styles.titleInput,
                      {
                        color: colors.text,
                        opacity: item.estado === 'pagado' ? 0.75 : 1,
                      },
                    ]}
                  />
                  {/* strike overlay */}
                  {strikeW !== '0%' ? (
                    <View pointerEvents="none" style={[styles.strike, { width: strikeW, backgroundColor: colors.textSecondary }] as any} />
                  ) : null}
                </View>

                <View style={styles.amountWrap}>
                  <Text
                    pointerEvents="none"
                    style={[
                      styles.amountPrefix,
                      {
                        color: colors.textSecondary,
                        opacity: item.estado === 'pagado' ? 0.6 : 1,
                      },
                    ]}
                  >
                    {(item.moneda || 'MXN').toUpperCase()} {symbol}
                  </Text>
                  <TextInput
                    ref={(r) => {
                      if (r) amountRefs.current[item.key] = r;
                    }}
                    value={item.monto}
                    onChangeText={(v) => updateRow(item.key, { monto: v }, { immediateSave: false })}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                    returnKeyType="done"
                    onSubmitEditing={() => onSubmitAmount(item.key)}
                    style={[
                      styles.amountInput,
                      {
                        color: colors.text,
                        opacity: item.estado === 'pagado' ? 0.75 : 1,
                      },
                    ]}
                  />
                  {strikeW !== '0%' ? (
                    <View pointerEvents="none" style={[styles.strike, { width: strikeW, backgroundColor: colors.textSecondary }] as any} />
                  ) : null}
                </View>
              </View>

              {/* meta row */}
              <View style={styles.metaRow}>
                <View style={[styles.metaPill, { backgroundColor: withAlpha(colors.button, 0.08), borderColor: withAlpha(colors.button, 0.14) }]}>
                  <Ionicons name="sparkles-outline" size={12} color={colors.textSecondary} />
                  <Text style={[styles.metaPillText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.categoria || (item.titulo.trim() ? predictCategory(item.titulo, categories) : 'IA: …')}
                  </Text>
                </View>

                {item.estado === 'parcial' && remainingFormatted ? (
                  <View
                    style={[
                      styles.metaPill,
                      {
                        backgroundColor: withAlpha(colors.warning, 0.08),
                        borderColor: withAlpha(colors.warning, 0.16),
                      },
                    ]}
                  >
                    <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                    <Text style={[styles.metaPillText, { color: colors.textSecondary }]} numberOfLines={1}>
                      Resta {remainingFormatted}
                    </Text>
                  </View>
                ) : null}

                {/* status selector (tap cycle, long press archive) */}
                <Pressable
                  onPress={() => setRowEstado(item, estadoCycle(item.estado))}
                  onLongPress={() => setRowEstado(item, item.estado === 'archivado' ? 'pendiente' : 'archivado')}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.estadoPill,
                    {
                      backgroundColor: tone.bg,
                      borderColor: tone.bd,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.estadoPillText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.estado}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* right controls */}
            <View style={styles.rightCol}>
              {item.saving || deletingKeys.has(item.key) ? (
                <View style={[styles.miniBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    void deleteRow(item);
                  }}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.miniBtn,
                    { backgroundColor: colors.cardSecondary, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      );
    },
    [
      categories,
      colors,
      deleteRow,
      deletingKeys,
      enter,
      onSubmitAmount,
      onSubmitTitle,
      selectedIds,
      setRowEstado,
      statusTone,
      toggleSelect,
      updateRow,
    ]
  );

  // header button actions
  const openLiquidateBtn = (
    <Pressable
      onPress={openLiquidate}
      hitSlop={10}
      style={({ pressed }) => [
        styles.headerBtn,
        { backgroundColor: colors.button, borderColor: colors.button, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <Ionicons name="swap-horizontal" size={18} color={colors.buttonText} />
    </Pressable>
  );

  const totalsCard = (
    <View style={[styles.summary, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.summaryTop}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Totales</Text>

        {selectedIds.size > 0 ? (
          <Pressable
            onPress={clearSelection}
            hitSlop={10}
            style={({ pressed }) => [
              styles.selectedBadge,
              {
                backgroundColor: withAlpha(colors.button, 0.12),
                borderColor: withAlpha(colors.button, 0.18),
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Ionicons name="checkbox-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.selectedBadgeText, { color: colors.textSecondary }]}>{selectedIds.size}</Text>
            <Ionicons name="close" size={14} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={focusAdder}
            hitSlop={10}
            style={({ pressed }) => [
              styles.selectedBadge,
              {
                backgroundColor: withAlpha(colors.button, 0.12),
                borderColor: withAlpha(colors.button, 0.18),
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Ionicons name="add" size={14} color={colors.textSecondary} />
            <Text style={[styles.selectedBadgeText, { color: colors.textSecondary }]}>Nuevo</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.summaryGrid}>
        {headerTotals.filtered.length === 0 ? (
          <Text style={[styles.summaryEmpty, { color: colors.textSecondary }]}>Sin items en este filtro</Text>
        ) : (
          headerTotals.filtered.map(([cur, amount]) => {
            const sym = buscarMonedaPorCodigo(cur)?.simbolo ?? '$';
            return (
              <View key={cur} style={styles.summaryRow}>
                <Text style={[styles.summaryCur, { color: colors.textSecondary }]}>{cur}</Text>
                <Text style={[styles.summaryAmt, { color: colors.text }]}>{formatForList(amount, sym).formatted}</Text>
              </View>
            );
          })
        )}
      </View>

      {selectedIds.size > 0 ? (
        <View style={styles.selectedBox}>
          <Text style={[styles.selectedTitle, { color: colors.textSecondary }]}>Seleccionados</Text>
          {selectedTotalsEntries.map(([cur, amount]) => {
            const sym = buscarMonedaPorCodigo(cur)?.simbolo ?? '$';
            return (
              <View key={cur} style={styles.summaryRow}>
                <Text style={[styles.summaryCur, { color: colors.textSecondary }]}>{cur}</Text>
                <Text style={[styles.summaryAmt, { color: colors.text }]}>{formatForList(amount, sym).formatted}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* BackButton moved into headerRow to avoid overlap */}

      {/* Header / Filters */}
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
          style={[styles.headerBorder, { backgroundColor: colors.border, opacity: headerBorderOpacity }]}
        />

        <View style={styles.headerRow}>
          {!liquidateOpen ? (
            <View style={{ marginRight: 8 }}>
              <BackButton inline />
            </View>
          ) : null}

          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {blocNombre || 'Bloc'}
            </Text>
          </View>

          <Pressable
            onPress={onRefresh}
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Animated.View style={{ transform: [{ rotate: refreshing ? refreshRotate : '0deg' }] }}>
              <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            </Animated.View>
          </Pressable>

          {/* Plus (focus adder) */}
          <Pressable
            onPress={focusAdder}
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>

          {openLiquidateBtn}
        </View>

        {totalsCard}

        {/* Estado filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {ESTADOS.filter((x) => x.key !== 'archivado').map((it) => {
            const active = estado === (it.key as any);
            return (
              <Pressable
                key={it.key}
                onPress={() => {
                  animateLayout();
                  setEstado(it.key as any);
                }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.button : colors.cardSecondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Ionicons name={it.icon as any} size={14} color={active ? colors.buttonText : colors.textSecondary} />
                <Text style={[styles.filterText, { color: active ? colors.buttonText : colors.text }]}>{it.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Category filters */}
        {categories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
            <Pressable
              onPress={() => {
                animateLayout();
                setCategoria('');
                setShowAllCategories(false);
              }}
              style={({ pressed }) => [
                styles.categoryChip,
                {
                  backgroundColor: categoria === '' ? colors.button : colors.cardSecondary,
                  borderColor: colors.border,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Text style={[styles.categoryText, { color: categoria === '' ? colors.buttonText : colors.text }]}>Todos</Text>
            </Pressable>

            {categories.slice(0, 3).map((c) => {
              const active = categoria === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    animateLayout();
                    setCategoria(c);
                  }}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    {
                      backgroundColor: active ? colors.button : colors.cardSecondary,
                      borderColor: colors.border,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.categoryText, { color: active ? colors.buttonText : colors.text }]}>{c}</Text>
                </Pressable>
              );
            })}

            {categories.length > 3 ? (
              <Pressable
                onPress={() => {
                  animateLayout();
                  setShowAllCategories((v) => !v);
                }}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.moreCatsBtn,
                  {
                    backgroundColor: colors.cardSecondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Text style={[styles.moreCatsText, { color: colors.textSecondary }]}>…</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}

        {showAllCategories && categories.length > 3 ? (
          <View style={styles.moreCatsWrap}>
            {categories.slice(3).map((c) => {
              const active = categoria === c;
              return (
                <Pressable
                  key={`more_${c}`}
                  onPress={() => {
                    animateLayout();
                    setCategoria(c);
                  }}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    {
                      backgroundColor: active ? colors.button : colors.cardSecondary,
                      borderColor: colors.border,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.categoryText, { color: active ? colors.buttonText : colors.text }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Animated.View>

      {/* Inline editor list */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={dataRows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.button} />}
        />
      </KeyboardAvoidingView>

      {/* Liquidate sheet (se mantiene) */}
      <Modal visible={liquidateOpen} animationType="slide" transparent onRequestClose={() => setLiquidateOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject as any} onPress={() => setLiquidateOpen(false)} />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
          <View style={[styles.modalCard, { backgroundColor: colors.modalBackground, borderColor: colors.border }]}>
            <View style={styles.modalHandleWrap}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Liquidar</Text>
              <Pressable onPress={() => setLiquidateOpen(false)} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Destino</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetTypeRow}>
              {(
                [
                  { type: 'principal' as const, label: 'Principal' },
                  { type: 'subcuenta' as const, label: 'Subcuenta' },
                ]
              ).map((opt) => {
                const active = targetType === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    onPress={() => {
                      animateLayout();
                      setTargetType(opt.type);
                      if (opt.type === 'principal') setTargetId('');
                      setPreview(null);
                    }}
                    style={({ pressed }) => [
                      styles.targetChip,
                      {
                        backgroundColor: active ? colors.button : colors.cardSecondary,
                        borderColor: colors.border,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.targetText, { color: active ? colors.buttonText : colors.text }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {targetType === 'principal' ? (
              <View style={[styles.destInfo, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
              >
                <Ionicons name="wallet-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.destInfoText, { color: colors.text }]}>Cuenta principal</Text>
                {snapshot?.accountSummary?.moneda ? (
                  <Text style={[styles.destInfoTextMuted, { color: colors.textSecondary }]}>({snapshot.accountSummary.moneda})</Text>
                ) : null}
                {snapshot?.accountSummary || mainAccountCacheSaldo !== null ? (
                  (() => {
                    const saldoNum = mainAccountCacheSaldo !== null ? mainAccountCacheSaldo : Number(snapshot?.accountSummary?.saldo ?? 0);
                    const monedaCode = (mainAccountCacheMoneda || String(snapshot?.accountSummary?.moneda ?? '')).toUpperCase();
                    const sym = buscarMonedaPorCodigo(monedaCode)?.simbolo ?? '$';
                    const saldoFmt = formatForList(saldoNum, sym).formatted;
                    return <Text style={[styles.destInfoText, { color: colors.text, marginLeft: 'auto' }]}>{saldoFmt}</Text>;
                  })()
                ) : null}
              </View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetRow}>
                  {destinationsForType.map((t) => {
                    const active = targetId === t.id;
                    return (
                      <Pressable
                        key={`${t.type}:${t.id}`}
                        onPress={() => {
                          animateLayout();
                          setTargetId(t.id);
                          setPreview(null);
                        }}
                        style={({ pressed }) => [
                          styles.targetChip,
                          {
                            backgroundColor: active ? colors.button : colors.cardSecondary,
                            borderColor: colors.border,
                            opacity: pressed ? 0.92 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.targetText, { color: active ? colors.buttonText : colors.text }]}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {destinationsForType.length === 0 ? (
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}> {snapshotLoading ? 'Cargando destinos…' : 'No hay destinos disponibles.'}</Text>
                ) : null}
              </>
            )}

            {/* simple note */}
            <View style={[styles.noteWrap, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textSecondary} />
              <TextInput
                value={liquidateNote}
                onChangeText={setLiquidateNote}
                placeholder="Nota (opcional)"
                placeholderTextColor={colors.placeholder}
                style={[styles.noteInput, { color: colors.text }]}
              />
            </View>

            <Pressable
              onPress={doPreview}
              disabled={previewLoading}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.cardSecondary, borderColor: colors.border, opacity: previewLoading ? 0.6 : pressed ? 0.92 : 1 },
              ]}
            >
              {previewLoading ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Previsualizar</Text>
              )}
            </Pressable>

            {preview ? (
              <View style={[styles.previewBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.previewTitle, { color: colors.text }]}>Resumen</Text>
                <Text style={[styles.previewBody, { color: colors.textSecondary }]}>Moneda destino: {preview.targetCurrency}</Text>

                {preview.totalOriginalByCurrency ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.previewBody, { color: colors.textSecondary }]}>Totales (moneda original):</Text>
                    {Object.entries(preview.totalOriginalByCurrency as any).map(([cur, amt]) => {
                      const sym = buscarMonedaPorCodigo(cur)?.simbolo ?? '$';
                      return (
                        <View key={cur} style={[styles.summaryRow, { marginTop: 4 }]}>
                          <Text style={[styles.summaryCur, { color: colors.textSecondary }]}>{cur}</Text>
                          <Text style={[styles.summaryAmt, { color: colors.text }]}>{formatForList(Number(amt ?? 0), sym).formatted}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                <Text style={[styles.previewBody, { color: colors.textSecondary }]}>
                  Total convertido:{' '}
                  {
                    formatForList(
                      preview.totalConverted ?? 0,
                      buscarMonedaPorCodigo(preview.targetCurrency)?.simbolo ?? '$'
                    ).formatted
                  }
                </Text>

                {targetBalance ? (
                  <View
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: fundsCheck.canValidate && !fundsCheck.ok ? withAlpha(colors.error, 0.08) : colors.cardSecondary,
                    }}
                  >
                    <Text style={[styles.previewBody, { color: colors.textSecondary }]}>
                      Saldo disponible ({targetBalance.label}):{' '}
                      {fundsCheck.canValidate && (fundsCheck as any).reason === 'currency-mismatch'
                        ? 'No validable (moneda distinta)'
                        : formatForList(
                            targetBalance.saldo ?? 0,
                            buscarMonedaPorCodigo(preview.targetCurrency)?.simbolo ?? '$'
                          ).formatted}
                    </Text>

                    {fundsCheck.canValidate && (fundsCheck as any).reason === 'currency-mismatch' ? (
                      <Text style={[styles.helperText, { color: colors.error, marginTop: 6 }]}>
                        La moneda del destino no coincide con la moneda del preview.
                      </Text>
                    ) : fundsCheck.canValidate && !fundsCheck.ok ? (
                      <Text style={[styles.helperText, { color: colors.error, marginTop: 6 }]}>
                        Saldo insuficiente. Faltan{' '}
                        {formatForList(
                          (fundsCheck as any).missing ?? 0,
                          buscarMonedaPorCodigo(preview.targetCurrency)?.simbolo ?? '$'
                        ).formatted}
                        .
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <Text style={[styles.previewBody, { color: colors.textSecondary }]}>
                  Items: {Array.isArray(preview.items) ? preview.items.length : 0}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={doCommit}
              disabled={confirmDisabled}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.button, opacity: confirmDisabled ? 0.55 : pressed ? 0.92 : 1 },
              ]}
            >
              {commitLoading ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.buttonText }]}>Confirmar liquidación</Text>
              )}
            </Pressable>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 41, 55, 0.45)',
  },

  softShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    position: 'relative',
    zIndex: 10,
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

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerBackWrap: { marginRight: 8 },
  headerSub: { marginTop: 2, fontSize: 12, fontWeight: '800' },

  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  summary: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  summaryTitle: { fontSize: 14, fontWeight: '900' },
  summaryGrid: { gap: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryCur: { fontSize: 12, fontWeight: '800' },
  summaryAmt: { fontSize: 13, fontWeight: '900' },
  summaryEmpty: { fontSize: 13, fontWeight: '700' },

  selectedBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedBadgeText: { fontSize: 12, fontWeight: '900' },

  selectedBox: { marginTop: 10, paddingTop: 10 },
  selectedTitle: { fontSize: 12, fontWeight: '900', marginBottom: 6 },

  filtersRow: { paddingVertical: 6, gap: 10 },
  filterChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  filterText: { fontSize: 13, fontWeight: '900' },

  categoriesRow: { paddingTop: 6, paddingBottom: 10, gap: 10 },
  categoryChip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: { fontSize: 13, fontWeight: '900' },

  moreCatsBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreCatsText: { fontSize: 18, fontWeight: '900', marginTop: -2 },
  moreCatsWrap: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 8 },

  rowCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  check: {
    width: 24,
    height: 24,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  rightCol: { alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2 },

  miniBtn: {
    width: 34,
    height: 34,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleWrap: { flex: 1, position: 'relative' },
  amountWrap: { width: 132, position: 'relative' },

  titleInput: {
    fontSize: 15,
    fontWeight: '900',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  amountInput: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
    paddingVertical: 4,
    paddingHorizontal: 0,
    paddingLeft: 14,
  },

  amountPrefix: {
    position: 'absolute',
    left: 0,
    top: 5,
    fontSize: 10,
    fontWeight: '900',
    opacity: 0.9,
  },

  strike: {
    position: 'absolute',
    left: 0,
    top: 16,
    height: 2,
    opacity: 0.75,
    borderRadius: 999,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  metaPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '78%',
  },
  metaPillText: { fontSize: 11, fontWeight: '900' },

  estadoPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estadoPillText: { fontSize: 11, fontWeight: '900', textTransform: 'capitalize' },

  // modals
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(31, 41, 55, 0.45)',
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    borderWidth: 1,
    maxHeight: '92%',
  },
  modalHandleWrap: { alignItems: 'center', paddingTop: 2, paddingBottom: 10 },
  modalHandle: { width: 54, height: 5, borderRadius: 999 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '900' },

  sectionLabel: { fontSize: 12, fontWeight: '900', marginBottom: 8 },

  targetTypeRow: { gap: 10, paddingBottom: 10 },
  targetRow: { gap: 10, paddingBottom: 10 },
  targetChip: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetText: { fontSize: 12, fontWeight: '900' },

  destInfo: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  destInfoText: { fontSize: 13, fontWeight: '900' },
  destInfoTextMuted: { fontSize: 12, fontWeight: '900' },

  helperText: { fontSize: 12, fontWeight: '800', marginTop: -4, marginBottom: 10 },

  noteWrap: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  noteInput: { flex: 1, fontSize: 14, fontWeight: '800', paddingVertical: 0 },

  primaryBtn: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryBtnText: { fontSize: 15, fontWeight: '900' },

  secondaryBtn: { height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 10 },
  secondaryBtnText: { fontSize: 14, fontWeight: '900' },

  previewBox: { borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 2, marginBottom: 10 },
  previewTitle: { fontSize: 14, fontWeight: '900', marginBottom: 6 },
  previewBody: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
});