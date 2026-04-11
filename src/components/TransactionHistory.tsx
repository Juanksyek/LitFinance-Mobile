import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { jwtDecode } from "../utils/jwtDecode";
import { API_BASE_URL } from "../constants/api";
import Toast from "react-native-toast-message";
import HistorialDetalleModal from "./HistorialDetalleModal";
import { fixEncoding } from '../utils/fixEncoding';
import SmartNumber from './SmartNumber';
import { useThemeColors } from "../theme/useThemeColors";
import { apiRateLimiter } from "../services/apiRateLimiter";
import type { DashboardSnapshot } from "../types/dashboardSnapshot";
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { emitTransaccionesChanged, dashboardRefreshBus } from "../utils/dashboardRefreshBus";
import { offlineSyncService } from "../services/offlineSyncService";

// use shared fixEncoding helper

type HistorialItem = {
  // En /cuenta-historial, `id` es el identificador del movimiento (movimientoId)
  // y NO necesariamente el id de la transacción.
  id: string;
  movimientoId?: string;
  // Para movimientos que provienen de una transacción, el backend ahora entrega `transaccionId`.
  // Este es el id preferido para PATCH/DELETE /transacciones/:id.
  transaccionId?: string;
  _id?: string;
  descripcion: string;
  monto: number;
  tipo: string;
  fecha: string;
  cuentaId: string;
  subcuentaId?: string;
  detalles?: {
    distintivo?: {
      tipo: 'backdated' | 'edited' | 'deleted' | string;
      label?: string | null;
    };
    side?: 'origen' | 'destino' | string;
    origen?: string;
    destino?: string;
    etiqueta?: string;
    resumen?: string;
    [key: string]: any;
  };
  metadata?: {
    monedaOrigen?: string;
    montoOriginal?: number;
    monedaConvertida?: string;
    montoConvertido?: number;
    monedaDestino?: string;
    monedaCuenta?: string;
    tasaConversion?: number;
    nota?: string;
    conceptoId?: string;
    concepto?: string;
    [key: string]: any;
  };
  motivo?: string;
};

interface JwtPayload {
  cuentaId: string;
  userId?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

const TransactionHistory = ({ refreshKey, dashboardSnapshot }: { refreshKey?: number; dashboardSnapshot?: DashboardSnapshot | null }) => {
  const colors = useThemeColors();
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [snapshotAllItems, setSnapshotAllItems] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState<HistorialItem | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [editItem, setEditItem] = useState<HistorialItem | null>(null);
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editMonto, setEditMonto] = useState('');
  const [editFecha, setEditFecha] = useState(''); // YYYY-MM-DD
  const [editMotivo, setEditMotivo] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [localRefreshTick, setLocalRefreshTick] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Concepto metadata cache (conceptoId -> { nombre, icono?, color? })
  const conceptoLabelCacheRef = useRef<Record<string, { nombre: string; icono?: string; color?: string }>>({});
  const pendingConceptoFetchRef = useRef<Set<string>>(new Set());

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState<HistorialItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 5;

  const snapshotMode = dashboardSnapshot !== undefined;

  const getCuentaIdFromSession = async (): Promise<string | null> => {
    try {
      const token = await authService.getAccessToken();
      if (!token) return null;
      const decoded: JwtPayload = jwtDecode(token);
      const cuentaId = decoded?.cuentaId;
      return cuentaId ? String(cuentaId) : null;
    } catch {
      return null;
    }
  };

  const toTimestamp = (value?: string | null): number => {
    const t = new Date(String(value ?? '')).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const sortChronologicalDesc = (items: HistorialItem[]) => {
    return [...items].sort((a, b) => {
      const aDate = toTimestamp((a as any).fecha ?? (a as any).createdAt);
      const bDate = toTimestamp((b as any).fecha ?? (b as any).createdAt);
      if (bDate !== aDate) return bDate - aDate;
      return String(b.id ?? '').localeCompare(String(a.id ?? ''));
    });
  };

  const formatYYYYMMDD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getTransaccionId = (item: HistorialItem) => {
    const anyItem: any = item as any;
    return uniqueStrings([
      item.transaccionId,
      anyItem?.detalles?.transaccionId,
      anyItem?.metadata?.transaccionId,
      anyItem?.metadata?.audit?.transaccionId,
    ])[0] ?? '';
  };

  const getMovimientoId = (item: HistorialItem) => {
    return String(item.movimientoId ?? item.id ?? '').trim();
  };

  const canEditMovimiento = (item: HistorialItem) => {
    const tipo = String(item.tipo || '').toLowerCase();
    const isIngresoEgreso = tipo === 'ingreso' || tipo === 'egreso';
    // Regla recomendada: solo si viene `transaccionId` desde /cuenta-historial
    return isIngresoEgreso && Boolean(getTransaccionId(item));
  };

  const normalizeHistorialItem = (raw: any, cuentaIdFallback?: string): HistorialItem => {
    // En /cuenta-historial, `id` es movimientoId del historial
    const rawMovimientoId = raw?.id != null ? String(raw.id) : '';
    const rawMongoId = raw?._id != null ? String(raw._id) : undefined;
    const rawTransaccionId = raw?.transaccionId != null ? String(raw.transaccionId) : undefined;
    // Mantener el id como movimientoId si existe; si no, usar fallback
    const id = rawMovimientoId || rawTransaccionId || rawMongoId || '';

    const descripcion = raw?.descripcion ?? raw?.concepto ?? raw?.nombre ?? '';
    const fecha = raw?.fecha ?? raw?.createdAt ?? raw?.registradoEn ?? '';

    const rawConceptoId = raw?.conceptoId ?? raw?.metadata?.conceptoId ?? raw?.datos?.conceptoId ?? undefined;
    const rawConcepto = raw?.concepto ?? raw?.metadata?.concepto ?? raw?.datos?.concepto ?? undefined;
    const mergedDetalles = {
      ...(raw?.detalles ?? {}),
      ...(raw?.datos ?? {}),
    };

    const mergedMetadata = {
      ...(raw?.metadata ?? {}),
      ...(raw?.datos ?? {}),
      ...(rawTransaccionId ? { transaccionId: rawTransaccionId } : {}),
      ...(rawConceptoId ? { conceptoId: String(rawConceptoId) } : {}),
      ...(rawConcepto ? { concepto: String(rawConcepto) } : {}),
    };

    return {
      id,
      movimientoId: rawMovimientoId || undefined,
      transaccionId: rawTransaccionId,
      _id: rawMongoId,
      descripcion: String(descripcion ?? ''),
      motivo: String(raw?.motivo ?? raw?.datos?.motivo ?? raw?.metadata?.nota ?? raw?.detalles?.resumen ?? raw?.datos?.resumen ?? '').trim() || undefined,
      monto: Number(raw?.monto ?? raw?.montoConvertido ?? 0),
      tipo: String(raw?.tipo ?? ''),
      fecha: String(fecha ?? ''),
      cuentaId: String(raw?.cuentaId ?? cuentaIdFallback ?? ''),
      subcuentaId: raw?.subcuentaId != null ? String(raw.subcuentaId) : (raw?.subCuentaId != null ? String(raw.subCuentaId) : (raw?.datos?.subCuentaId != null ? String(raw.datos.subCuentaId) : undefined)),
      detalles: Object.keys(mergedDetalles).length ? (mergedDetalles as any) : undefined,
      metadata: Object.keys(mergedMetadata).length ? (mergedMetadata as any) : undefined,
    };
  };

  function uniqueStrings(values: Array<string | undefined | null>) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
      const s = (v ?? '').trim();
      if (!s) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }

  const getConceptoId = (item: HistorialItem): string => {
    const anyItem: any = item as any;
    return (
      uniqueStrings([
        item?.metadata?.conceptoId,
        anyItem?.conceptoId,
        anyItem?.detalles?.conceptoId,
        anyItem?.metadata?.audit?.conceptoId,
      ])[0] ?? ''
    );
  };

  const getConceptoLabel = (item: HistorialItem): string => {
    const anyItem: any = item as any;
    const direct = uniqueStrings([
      item?.metadata?.concepto,
      anyItem?.concepto,
      anyItem?.detalles?.conceptoNombre,
    ])[0];
    if (direct) return direct;

    const conceptoId = getConceptoId(item);
    if (!conceptoId) return '';
    return String(conceptoLabelCacheRef.current[conceptoId]?.nombre ?? '').trim();
  };

  const getConceptoMeta = (item: HistorialItem) => {
    const conceptoId = getConceptoId(item);
    if (!conceptoId) return null;
    return conceptoLabelCacheRef.current[conceptoId] ?? null;
  };

  const attachConceptoLabel = (item: HistorialItem, conceptoId: string, data: { nombre?: string; icono?: string; color?: string }): HistorialItem => {
    if (!conceptoId || !data?.nombre) return item;
    const meta: any = item.metadata ?? {};
    const itemConceptoId = String(meta?.conceptoId ?? '').trim() || getConceptoId(item);
    if (itemConceptoId !== conceptoId) return item;
    if (String(meta?.concepto ?? '').trim()) return item;
    return {
      ...item,
      metadata: { ...meta, conceptoId, concepto: data.nombre, conceptoIcono: data.icono, conceptoColor: data.color },
    };
  };

  const extractConceptoMeta = (body: any): { nombre?: string; icono?: string; color?: string } => {
    const root = body?.data ?? body?.resultado ?? body?.result ?? body;
    const nombre = root?.nombre ?? root?.name ?? root?.concepto ?? root?.label ?? '';
    const icono = root?.icono ?? root?.icon ?? root?.emoji ?? '';
    const color = root?.color ?? root?.hex ?? '';
    return { nombre: String(nombre ?? '').trim() || undefined, icono: icono ? String(icono) : undefined, color: color ? String(color) : undefined };
  };

  const fetchConceptoMetaById = async (conceptoId: string): Promise<{ nombre?: string; icono?: string; color?: string } | null> => {
    const id = String(conceptoId ?? '').trim();
    if (!id) return null;
    const cached = conceptoLabelCacheRef.current[id];
    if (cached && cached.nombre) return cached;
    if (pendingConceptoFetchRef.current.has(id)) return null;

    pendingConceptoFetchRef.current.add(id);
    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/conceptos/${encodeURIComponent(id)}`);
      const body = await res.json().catch(() => ({}));
      const meta = extractConceptoMeta(body);
      if (meta?.nombre) {
        conceptoLabelCacheRef.current[id] = { nombre: meta.nombre, icono: meta.icono, color: meta.color };
      }
      return meta;
    } catch {
      return null;
    } finally {
      pendingConceptoFetchRef.current.delete(id);
    }
  };

  // Resolve concepto labels when only conceptoId is present.
  useEffect(() => {
    const visibleItems = snapshotMode ? historial : historial;
    const missingIds = uniqueStrings(
      visibleItems
        .map((it) => {
          const hasLabel = Boolean(String((it as any)?.metadata?.concepto ?? '').trim());
          const conceptoId = getConceptoId(it);
          if (!conceptoId || hasLabel) return null;
          const cached = String(conceptoLabelCacheRef.current[conceptoId] ?? '').trim();
          if (cached) return null;
          return conceptoId;
        })
        .filter(Boolean) as any
    );

    if (!missingIds.length) return;

    let cancelled = false;
    (async () => {
      for (const id of missingIds) {
        if (cancelled) return;
        const meta = await fetchConceptoMetaById(id);
        if (cancelled || !meta?.nombre) continue;

        // Patch current UI state so card + modal can show it.
        setHistorial((prev) => prev.map((it) => attachConceptoLabel(it, id, meta)));
        setSnapshotAllItems((prev) => prev.map((it) => attachConceptoLabel(it, id, meta)));
        try {
          if (pagesCacheRef.current?.[page]) {
            pagesCacheRef.current[page] = pagesCacheRef.current[page].map((it) => attachConceptoLabel(it, id, meta));
          }
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [historial, page, snapshotMode]);

  const getEditTargets = (item: HistorialItem) => {
    const transaccionId = getTransaccionId(item);
    const mongoId = String(item._id ?? '').trim();
    const movimientoId = getMovimientoId(item);

    const targets: Array<{ label: string; url: string }> = [];

    // Opción A (recomendada): editar/eliminar por transaccionId
    if (transaccionId) {
      targets.push({
        label: `transaccionId:${transaccionId}`,
        url: `${API_BASE_URL}/transacciones/${encodeURIComponent(transaccionId)}`,
      });
    }

    // Fallback soportado: Mongo _id
    if (mongoId) {
      targets.push({
        label: `_id:${mongoId}`,
        url: `${API_BASE_URL}/transacciones/${encodeURIComponent(mongoId)}`,
      });
    }

    // Compatibilidad: editar/eliminar por movimientoId del historial
    if (movimientoId) {
      targets.push({
        label: `movimientoId:${movimientoId}`,
        url: `${API_BASE_URL}/transacciones/movimiento/${encodeURIComponent(movimientoId)}`,
      });
    }

    return targets;
  };

  // Cache de páginas para evitar refetches al navegar hacia atrás/adelante
  const pagesCacheRef = useRef<Record<number, HistorialItem[]>>({});
  const [requestedPage, setRequestedPage] = useState<number>(1);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs para prevención de memory leaks
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Escuchar eventos globales de refresh para recargar historial
  useEffect(() => {
    const unsubscribe = dashboardRefreshBus.on('transacciones:changed', () => {
      try {
        // Limpiar cache y forzar recarga
        pagesCacheRef.current = {};
      } catch {}
      setRequestedPage(1);
      setPage(1);
      setLocalRefreshTick((x) => x + 1);
      // show loading briefly
      setLoading(true);
    });

    return () => {
      try { unsubscribe(); } catch {};
    };
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('🧹 [TransactionHistory] Limpiando componente...');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const formatAmountPlain = (amount: number) =>
    Math.abs(amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getCurrencySymbol = (currency?: string | null) => {
    const normalized = String(currency ?? '').trim().toUpperCase();
    const symbols: Record<string, string> = {
      MXN: '$',
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CNY: '¥',
      CAD: '$',
      AUD: '$',
      CHF: 'CHF',
    };
    return symbols[normalized] ?? normalized;
  };

  const getOriginalCurrencyAmountText = (item: HistorialItem): string | null => {
    const meta: any = item.metadata ?? {};
    const montoOriginal = meta.montoOriginal ?? meta.montoOrigen;
    const monedaOrigen = meta.monedaOrigen ?? meta.monedaOriginal;
    const montoConvertido = meta.montoConvertido ?? meta.montoDestino ?? item.monto;
    const monedaConvertida = meta.monedaConvertida ?? meta.monedaDestino ?? meta.monedaCuenta;

    if (montoOriginal == null || !monedaOrigen || montoConvertido == null || !monedaConvertida) return null;
    if (String(monedaOrigen).toUpperCase() === String(monedaConvertida).toUpperCase()) return null;

    return `${getCurrencySymbol(monedaOrigen)}${formatAmountPlain(Number(montoOriginal))}`;
  };

  const getConversionLabel = (item: HistorialItem): string | null => {
    const meta: any = item.metadata ?? {};
    const montoOriginal = meta.montoOriginal ?? meta.montoOrigen;
    const monedaOrigen = meta.monedaOrigen ?? meta.monedaOriginal;
    if (montoOriginal == null || !monedaOrigen) return null;

    const montoConvertido = meta.montoConvertido ?? meta.montoDestino ?? item.monto;
    const monedaConvertida = meta.monedaConvertida ?? meta.monedaDestino ?? meta.monedaCuenta;
    if (montoConvertido == null || !monedaConvertida) return null;

    // Only show when it actually looks like a conversion (currency differs)
    if (String(monedaOrigen) === String(monedaConvertida)) return null;

    return `${getCurrencySymbol(monedaOrigen)}${formatAmountPlain(Number(montoOriginal))} ${String(monedaOrigen).toUpperCase()} → ${getCurrencySymbol(monedaConvertida)}${formatAmountPlain(Number(montoConvertido))} ${String(monedaConvertida).toUpperCase()}`;
  };

  // Snapshot mode: prefer recentHistory (unified feed). Fallback to recentTransactions.
  useEffect(() => {
    if (!dashboardSnapshot) return;

    const recentHistoryData = dashboardSnapshot.recentHistory?.data;
    const mapped: HistorialItem[] = Array.isArray(recentHistoryData) && recentHistoryData.length
      ? recentHistoryData.map((h: any) => ({
          id: String(h.id ?? h.transaccionId ?? h._id ?? ''),
          movimientoId: h.id != null ? String(h.id) : undefined,
          transaccionId: h.transaccionId != null ? String(h.transaccionId) : (h?.metadata?.transaccionId != null ? String(h.metadata.transaccionId) : undefined),
          _id: h._id != null ? String(h._id) : undefined,
          descripcion: h.descripcion,
          motivo: String(h.motivo ?? h.metadata?.nota ?? h.detalles?.resumen ?? '').trim() || undefined,
          monto: Number(h.monto || 0),
          tipo: String(h.tipo || ''),
          fecha: h.fecha,
          cuentaId: String(dashboardSnapshot.accountSummary?.cuentaId ?? ''),
          subcuentaId: h.subcuentaId ? String(h.subcuentaId) : undefined,
          detalles: (h.detalles ?? undefined) as any,
          metadata: ((): any => {
            const base = (h.metadata ?? {});
            const conceptoId = h.conceptoId ?? base.conceptoId ?? undefined;
            const concepto = h.concepto ?? base.concepto ?? undefined;
            return Object.keys(base).length || conceptoId || concepto ? { ...base, ...(conceptoId ? { conceptoId: String(conceptoId) } : {}), ...(concepto ? { concepto: String(concepto) } : {}) } : undefined;
          })(),
        }))
      : (dashboardSnapshot.recentTransactions || []).map((t) => {
          const tipo = String(t.tipo || '').toLowerCase();
          const isIngreso = tipo.includes('ingreso');
          const isEgreso = tipo.includes('egreso');

          const registradoEn = (t as any).registradoEn ?? t.createdAt;
          const fechaEfectiva = (t as any).fechaEfectiva ?? null;
          const isBackdated = Boolean((t as any).isBackdated);

          const monedaOrigen = t.moneda;
          const monedaConvertida = t.monedaConvertida ?? null;
          const montoOriginal = t.monto;
          const montoConvertido = t.montoConvertido ?? null;

          return {
            id: t.id,
            movimientoId: undefined,
            transaccionId: String((t as any).transaccionId ?? t.id ?? ''),
            descripcion: t.concepto,
            motivo: String((t as any)?.motivo ?? (t as any)?.metadata?.nota ?? (t as any)?.detalles?.resumen ?? '').trim() || undefined,
            monto: isEgreso ? -Math.abs(Number(montoOriginal || 0)) : Number(montoOriginal || 0),
            tipo: isIngreso ? 'ingreso' : (isEgreso ? 'egreso' : String(t.tipo || '')),
            // Prefer effective date for display when available.
            fecha: fechaEfectiva ?? registradoEn,
            cuentaId: String(t.cuentaId ?? ''),
            subcuentaId: t.subCuentaId ? String(t.subCuentaId) : undefined,
            detalles: isBackdated
              ? { distintivo: { tipo: 'backdated', label: 'Otra fecha' }, registradoEn, fechaEfectiva }
              : { registradoEn, fechaEfectiva },
            metadata: (() => {
              const m: any = {
                monedaOrigen,
                montoOriginal,
                monedaConvertida: monedaConvertida ?? undefined,
                montoConvertido: montoConvertido ?? undefined,
              };
              const conceptoId = (t as any).conceptoId ?? (t as any).metadata?.conceptoId ?? undefined;
              const concepto = (t as any).concepto ?? (t as any).metadata?.concepto ?? undefined;
              if (conceptoId) m.conceptoId = String(conceptoId);
              if (concepto) m.concepto = String(concepto);
              return m;
            })(),
          };
        });

    let canceled = false;
    (async () => {
      try {
        const cuentaId = await getCuentaIdFromSession();
        if (!cuentaId) {
          if (!canceled) {
            setSnapshotAllItems(sortChronologicalDesc(mapped));
            setPage(1);
            setLoading(false);
          }
          return;
        }

        const pending = await offlineSyncService.getPendingHistorialItemsForCuenta(cuentaId);
        const merged = sortChronologicalDesc([...(pending as any), ...mapped]);
        if (!canceled) {
          setSnapshotAllItems(merged);
          setPage(1);
          setLoading(false);
        }
      } catch {
        if (!canceled) {
          setSnapshotAllItems(sortChronologicalDesc(mapped));
          setPage(1);
          setLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [dashboardSnapshot]);

  useEffect(() => {
    if (!snapshotMode) return;

    const q = search.trim().toLowerCase();
    const filtered = q
      ? snapshotAllItems.filter((i) => (i.descripcion || '').toLowerCase().includes(q))
      : snapshotAllItems;

    const start = (page - 1) * limit;
    const slice = filtered.slice(start, start + limit);
    setHistorial(slice);
    setHasMore(start + limit < filtered.length);
    setLoading(false);
  }, [snapshotMode, snapshotAllItems, search, page]);

  useEffect(() => {
    const fetchHistorial = async () => {
      if (snapshotMode) {
        // Local-only mode: avoid network calls on Dashboard
        return;
      }
      // Note: we removed strict global rate-limiting that blocked UX. Instead
      // we use per-page caching + debounce + prefetch to avoid saturating the API.

      if (!isMountedRef.current) {
        console.log('⚠️ [TransactionHistory] Componente desmontado, cancelando fetch');
        return;
      }

      // Cancelar fetch anterior
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      if (isMountedRef.current) {
        setLoading(true);
      }
      
      try {
        const token = await authService.getAccessToken();

        if (!token) {
          if (isMountedRef.current) {
            Toast.show({
              type: "error",
              text1: "Token no encontrado",
              text2: "Por favor inicia sesión nuevamente.",
            });
          }
          return;
        }

        const decoded: JwtPayload = jwtDecode(token);
        const cuentaId = decoded?.cuentaId;

        if (!cuentaId) {
          if (isMountedRef.current) {
            Toast.show({
              type: "error",
              text1: "Cuenta no encontrada",
              text2: "No se pudo obtener el ID de la cuenta.",
            });
          }
          return;
        }

        const url = `${API_BASE_URL}/cuenta-historial?cuentaId=${cuentaId}&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;

        const res = await apiRateLimiter.fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        });

        // Verificar si fue abortado
        if (signal.aborted) {
          console.log('📋 [TransactionHistory] Fetch cancelado');
          return;
        }

        const data = await res.json();

        // Solo actualizar estado si el componente está montado
        if (isMountedRef.current && !signal.aborted) {     
          if (Array.isArray(data?.data)) {
            const normalized = data.data.map((row: any) => normalizeHistorialItem(row, cuentaId));
            const sorted = sortChronologicalDesc(normalized);
            if (page === 1) {
              try {
                const pending = await offlineSyncService.getPendingHistorialItemsForCuenta(String(cuentaId));
                const merged = sortChronologicalDesc([...(pending as any), ...sorted]);
                setHistorial(merged);
              } catch {
                setHistorial(sorted);
              }
            } else {
              setHistorial(sorted);
            }
            setHasMore(sorted.length === limit);
            // Cachear la página para navegación rápida posterior
            try {
              pagesCacheRef.current[page] = sorted;
            } catch (e) {}
            // Prefetch siguiente página con ligero delay para no saturar
            if (sorted.length === limit) {
              const next = page + 1;
              if (!pagesCacheRef.current[next]) {
                setTimeout(async () => {
                  try {
                    const token = await authService.getAccessToken();
                    if (!token) return;
                    const decoded2: JwtPayload = jwtDecode(token);
                    const cuentaId2 = decoded2?.cuentaId;
                    const res2 = await apiRateLimiter.fetch(`${API_BASE_URL}/cuenta-historial?cuentaId=${(jwtDecode(token) as JwtPayload)?.cuentaId}&page=${next}&limit=${limit}&search=${encodeURIComponent(search)}`,
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const d2 = await res2.json();
                    if (Array.isArray(d2?.data)) {
                      const normalized2 = d2.data.map((row: any) => normalizeHistorialItem(row, cuentaId2));
                      pagesCacheRef.current[next] = sortChronologicalDesc(normalized2);
                    }
                  } catch (e) {
                    // ignore prefetch errors
                  }
                }, 600);
              }
            }
          } else {
            if (page === 1) {
              try {
                const pending = await offlineSyncService.getPendingHistorialItemsForCuenta(String(cuentaId));
                setHistorial(sortChronologicalDesc([...(pending as any)]));
              } catch {
                setHistorial([]);
              }
            } else {
              setHistorial([]);
            }
            setHasMore(false);
            Toast.show({
              type: "info",
              text1: "Sin movimientos",
              text2: "No hay historial registrado aún.",
            });
          }
        }
      } catch (err) {
        // Ignorar errores de abort
        // Narrow 'err' safely since catch default type is unknown
        if (signal.aborted || (err as any)?.name === 'AbortError') {
          console.log('📋 [TransactionHistory] Fetch cancelado');
          return;
        }
        
        // Detectar errores de rate limiting
        const errorMsg = (typeof err === 'object' && err !== null && 'message' in err) ? String((err as any).message) : String(err);

        const isOfflineErr =
          errorMsg.toLowerCase().includes('network request failed') ||
          errorMsg.toLowerCase().includes('failed to fetch') ||
          errorMsg.toLowerCase().includes('networkerror');
        
        if (isMountedRef.current) {
          // If offline, still show pending ops on first page.
          if (page === 1) {
            try {
              const pendingCuentaId = await getCuentaIdFromSession();
              if (pendingCuentaId) {
                const pending = await offlineSyncService.getPendingHistorialItemsForCuenta(String(pendingCuentaId));
                setHistorial(sortChronologicalDesc([...(pending as any)]));
              } else {
                setHistorial([]);
              }
            } catch {
              setHistorial([]);
            }
          } else {
            setHistorial([]);
          }

          Toast.show({
            type: isOfflineErr ? 'info' : "error",
            text1: isOfflineErr ? 'Sin conexión' : "Error al cargar historial",
            text2: isOfflineErr ? 'Mostrando movimientos pendientes.' : "Revisa tu conexión o vuelve a intentar.",
          });
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchHistorial();
  }, [refreshKey, search, page, localRefreshTick]);

  // Handler que usa debounce para evitar ráfagas de peticiones cuando el usuario
  // navega rápidamente. Actualiza `requestedPage` y tras 300ms aplica `page`.
  const handleRequestPage = (newPage: number) => {
    if (newPage < 1) return;
    setRequestedPage(newPage);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      // Si ya tenemos la página en cache, úsala localmente sin fetch
      if (pagesCacheRef.current[newPage]) {
        setHistorial(pagesCacheRef.current[newPage]);
        setHasMore(pagesCacheRef.current[newPage].length === limit);
        setPage(newPage);
        return;
      }
      setPage(newPage);
    }, 300);
  };

  // Si el refreshKey o la búsqueda cambian, limpiar cache y regresar a página 1
  useEffect(() => {
    pagesCacheRef.current = {};
    setRequestedPage(1);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setPage(1);
  }, [refreshKey, search]);

  const openEdit = (item: HistorialItem) => {
    if (!canEditMovimiento(item)) {
      Toast.show({
        type: 'info',
        text1: 'No editable',
        text2: 'Solo puedes editar transacciones (ingreso/egreso) con transaccionId.',
      });
      return;
    }

    setEditItem(item);
    setEditDescripcion(fixEncoding(item.descripcion || '').trim());

    const tipo = String(item.tipo || '').toLowerCase();
    const montoAbs = tipo === 'egreso' ? Math.abs(Number(item.monto || 0)) : Number(item.monto || 0);
    setEditMonto(String(Number.isFinite(montoAbs) ? montoAbs : 0));

    const prefFecha = (() => {
      const maybeYMD = String((item as any)?.detalles?.fechaEfectiva ?? '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(maybeYMD)) return maybeYMD;
      const t = toTimestamp(item.fecha);
      if (!t) return '';
      return formatYYYYMMDD(new Date(t));
    })();
    setEditFecha(prefFecha);

    const prefMotivo = String(item.metadata?.nota ?? item.detalles?.resumen ?? item.detalles?.etiqueta ?? '').trim();
    setEditMotivo(fixEncoding(prefMotivo));

    setEditVisible(true);
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditVisible(false);
    setEditItem(null);
    setShowDatePicker(false);
  };

  const openDelete = (item: HistorialItem) => {
    if (!canEditMovimiento(item)) {
      Toast.show({
        type: 'info',
        text1: 'No eliminable',
        text2: 'Solo puedes eliminar transacciones (ingreso/egreso) con transaccionId.',
      });
      return;
    }

    setDeleteItem(item);
    setDeleteVisible(true);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteVisible(false);
    setDeleteItem(null);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    try {
      setDeleting(true);
      const token = await authService.getAccessToken();
      if (!token) throw new Error('Token no encontrado');

      const targets = getEditTargets(deleteItem);
      if (!targets.length) throw new Error('No se pudo determinar el ID para eliminar');

      console.log('🗑️ [TransactionHistory] Delete targets:', targets);

      let lastError: any = null;
      let deletedBy: string | null = null;

      for (const t of targets) {
        try {
          console.log(`📨 [ApiRateLimiter] Intentando DELETE ${t.label}`, { url: t.url });
          const res = await apiRateLimiter.fetch(t.url, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          const body = await res.json().catch(() => ({}));
          console.log(`📝 [ApiRateLimiter] DELETE response ${t.label}:`, { status: res.status, ok: res.ok, body });

          if (res.ok) {
            deletedBy = t.label;
            break;
          }

          lastError = body;
          const msg = String(body?.message ?? '').toLowerCase();
          if (res.status === 404 || msg.includes('no encontrada') || msg.includes('not found')) {
            continue;
          }

          throw new Error(body?.message || 'No se pudo eliminar el movimiento');
        } catch (e) {
          lastError = e;
        }
      }

      if (!deletedBy) {
        throw new Error(lastError?.message || 'No se pudo eliminar el movimiento');
      }

      Toast.show({ type: 'success', text1: 'Movimiento eliminado' });

      emitTransaccionesChanged();

      if (snapshotMode) {
        const deleteKey = deleteItem.id;
        setSnapshotAllItems((prev) => prev.filter((it) => it.id !== deleteKey));
      } else {
        pagesCacheRef.current = {};
        setRequestedPage(1);
        setPage(1);
        setLocalRefreshTick((x) => x + 1);
      }

      closeDelete();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al eliminar',
        text2: err?.message || 'No se pudo eliminar',
      });
    } finally {
      setDeleting(false);
    }
  };

  const onPickDate = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!selected) return;
    setEditFecha(formatYYYYMMDD(selected));
  };

  const saveEdit = async () => {
    if (!editItem) return;

    const descripcion = editDescripcion.trim();
    if (!descripcion) {
      Toast.show({ type: 'error', text1: 'Descripción requerida', text2: 'Escribe una descripción.' });
      return;
    }

    const montoParsed = Number(String(editMonto).replace(/,/g, '').trim());
    if (!Number.isFinite(montoParsed) || montoParsed <= 0) {
      Toast.show({ type: 'error', text1: 'Monto inválido', text2: 'Ingresa un monto válido.' });
      return;
    }

    const fecha = editFecha.trim();
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      Toast.show({ type: 'error', text1: 'Fecha inválida', text2: 'Usa formato YYYY-MM-DD o déjalo vacío.' });
      return;
    }

    try {
      setSavingEdit(true);
      const token = await authService.getAccessToken();
      if (!token) throw new Error('Token no encontrado');

      // Resolver cuentaId desde token si no está presente en el item
      const decodedToken: JwtPayload = jwtDecode(token);
      const cuentaIdFromToken = decodedToken?.cuentaId;
      const tipo = String(editItem.tipo || '').toLowerCase();
      const payload: any = {
        concepto: descripcion,
        motivo: editMotivo.trim(),
        tipo,
        monto: Math.abs(montoParsed),
        ...(fecha ? { fecha } : {}),
        cuentaId: String(editItem.cuentaId ?? cuentaIdFromToken ?? ''),
      };

      const targets = getEditTargets(editItem);
      if (!targets.length) throw new Error('No se pudo determinar el ID del movimiento');

      console.log('🛠️ [TransactionHistory] Edit payload:', payload);
      console.log('🛠️ [TransactionHistory] Edit targets:', targets);

      let lastError: any = null;
      let updatedBy: string | null = null;
      for (const t of targets) {
        try {
          console.log(`📨 [ApiRateLimiter] Intentando PATCH ${t.label}`, { url: t.url, payload });
          const res = await apiRateLimiter.fetch(t.url, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          const body = await res.json().catch(() => ({}));
          console.log(`📝 [ApiRateLimiter] Response for ${t.label}:`, { status: res.status, ok: res.ok, body });

          if (res.ok) {
            updatedBy = t.label;
            break;
          }

          lastError = body;
          const msg = String(body?.message ?? '').toLowerCase();
          if (res.status === 404 || msg.includes('no se pudo encontrar') || msg.includes('not found')) {
            console.log(`🔎 [TransactionHistory] ${t.label} not found, trying next`);
            continue;
          }

          // Otros errores (validación, permisos, etc.) — log y abortar
          console.log(`❗ [TransactionHistory] Non-recoverable error for ${t.label}`, { status: res.status, body });
          throw new Error(body?.message || 'No se pudo editar el movimiento');
        } catch (errInner) {
          // Log network / unexpected errors and continue to next candidate depending on error type
          console.log(`⚠️ [TransactionHistory] Error patching ${t.label}:`, errInner);
          lastError = errInner;
        }
      }

      if (!updatedBy) {
        console.log('❌ [TransactionHistory] No candidate succeeded. Last error:', lastError);
        throw new Error(lastError?.message || 'No se pudo encontrar el movimiento');
      }

      console.log(`✅ [TransactionHistory] Mov. actualizado por: ${updatedBy}`);

      Toast.show({ type: 'success', text1: 'Movimiento actualizado' });

      emitTransaccionesChanged();

      if (snapshotMode) {
        setSnapshotAllItems((prev) =>
          sortChronologicalDesc(
            prev.map((it) =>
              it.id === editItem.id
                ? {
                    ...it,
                    descripcion,
                    monto: tipo === 'egreso' ? -Math.abs(montoParsed) : Math.abs(montoParsed),
                    fecha: fecha ? new Date(fecha).toISOString() : it.fecha,
                    metadata: { ...(it.metadata ?? {}), nota: editMotivo.trim() },
                    detalles: { ...(it.detalles ?? {}), distintivo: { tipo: 'edited', label: 'Editado' }, fechaEfectiva: fecha || (it as any)?.detalles?.fechaEfectiva },
                  }
                : it
            )
          )
        );
      } else {
        pagesCacheRef.current = {};
        setRequestedPage(1);
        setPage(1);
        setLocalRefreshTick((x) => x + 1);
      }

      closeEdit();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al editar',
        text2: err?.message || 'No se pudo editar el movimiento',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const iconByTipo = (tipo: string) => {
    switch (tipo) {
      case "ingreso":
        return <Ionicons name="trending-up" size={20} color="#388e3c" />;
      case "egreso":
        return <Ionicons name="trending-down" size={20} color="#d32f2f" />;
      case "recurrente":
        return <Ionicons name="repeat" size={20} color="#6366f1" />;
      case "ajuste_subcuenta":
        return <Ionicons name="sync-outline" size={20} color="#fbc02d" />;
      case "cambio_moneda":
        return <Ionicons name="swap-horizontal" size={20} color="#7b1fa2" />;
      case "transferencia":
        return <Ionicons name="swap-horizontal" size={20} color="#7b1fa2" />;
      default:
        return <Ionicons name="time-outline" size={20} color="#616161" />;
    }
  };

  const getDistintivo = (item: HistorialItem): { text: string; tone: 'info' | 'warning' | 'error' } | null => {
    const raw = item.detalles?.distintivo;
    if (!raw?.tipo) return null;

    const tipo = String(raw.tipo);
    const label = (raw.label ?? '').trim();

    if (tipo === 'backdated') return { text: label || 'Otra fecha', tone: 'info' };
    if (tipo === 'edited') return { text: label || 'Editado', tone: 'warning' };
    if (tipo === 'deleted') return { text: label || 'Eliminado', tone: 'error' };
    return { text: label || tipo, tone: 'info' };
  };

  const DistintivoPill = ({ text, tone }: { text: string; tone: 'info' | 'warning' | 'error' }) => {
    const colorByTone =
      tone === 'error' ? colors.error : tone === 'warning' ? colors.warning : colors.info;

    return (
      <View style={[styles.distintivoPill, { borderColor: colorByTone, backgroundColor: colors.cardSecondary }]}>
        <Text style={[styles.distintivoText, { color: colorByTone }]}>{text}</Text>
      </View>
    );
  };

  const TransactionItem = ({
    icon,
    title,
    amount,
    date,
    distintivo,
    onPress,
    tipo,
    plataforma,
    canEdit,
    onEdit,
    canDelete,
    onDelete,
    concepto,
    conceptoMeta,
    conceptoId,
  }: {
    icon: React.ReactNode;
    title: string;
    amount: string;
    date: string;
    distintivo?: { text: string; tone: 'info' | 'warning' | 'error' } | null;
    onPress: () => void;
    tipo?: string;
    plataforma?: string;
    canEdit?: boolean;
    onEdit?: () => void;
    canDelete?: boolean;
    onDelete?: () => void;
    concepto?: string | null;
    conceptoMeta?: { nombre?: string; icono?: string; color?: string } | null;
    conceptoId?: string | null;
  }) => (
    <TouchableOpacity style={[styles.transactionItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress}>
      <View style={[styles.transactionIconContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}> 
        {icon}
      </View>
      <View style={styles.transactionDetails}>
        <Text style={[styles.transactionTitle, { color: colors.text }]}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>{date}</Text>
          {!!distintivo && <DistintivoPill text={distintivo.text} tone={distintivo.tone} />}
        </View>
        {conceptoMeta?.nombre ? (
          <View style={{ marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {conceptoMeta.icono ? (
                typeof conceptoMeta.icono === 'string' && conceptoMeta.icono.length <= 2 ? (
                  <Text style={{ fontSize: 14 }}>{conceptoMeta.icono}</Text>
                ) : (
                  <Ionicons name={conceptoMeta.icono as any} size={14} color={conceptoMeta.color ?? colors.button} />
                )
              ) : null}
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{fixEncoding(conceptoMeta.nombre)}</Text>
            </View>
          </View>
        ) : concepto ? (
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{fixEncoding(concepto)}</Text>
        ) : conceptoId ? (
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{fixEncoding(conceptoId)}</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
        <Text style={[styles.transactionAmount, { color: colors.text }]}>{amount}</Text>
        {canEdit && onEdit ? (
          <TouchableOpacity
            onPress={(e) => {
              e?.stopPropagation?.();
              onEdit();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Editar movimiento"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.editPill, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="create-outline" size={15} color={colors.button} />
          </TouchableOpacity>
        ) : null}

        {canDelete && onDelete ? (
          <TouchableOpacity
            onPress={(e) => {
              e?.stopPropagation?.();
              onDelete();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Eliminar movimiento"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.deletePill, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="trash-outline" size={15} color={colors.error} />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.chartBackground, shadowColor: colors.shadow, borderColor: colors.border }]}>
      <Text style={[styles.cardLabel, { color: colors.text }]}>Historial de transacciones</Text>

      <TextInput
        style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
        placeholder="Buscar por descripción..."
        placeholderTextColor={colors.placeholder}
        value={search}
        onChangeText={(text) => {
          setPage(1);
          setSearch(text);
        }}
      />

      { loading ? (
        <ActivityIndicator size="small" color={colors.button} />
      ) : historial.length > 0 ? (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>
            Total: {historial.length} | Recurrentes: {historial.filter(i => i.tipo === 'recurrente').length}
          </Text>
          {historial.map((item, index) => {
            console.log(`🎨 [RENDER ${index}]`, {
              id: item.id || item._id,
              tipo: item.tipo,
              descripcion: fixEncoding(item.descripcion).substring(0, 30),
              monto: item.monto
            });
            let amountText = '';
            let showRegistroBadge = false;
            let registroBadgeText = '';
            let showRecurrenteBadge = false;
            let recurrenteBadgeText = '';
            const conversionLabel = getConversionLabel(item);
            const originalCurrencyAmountText = getOriginalCurrencyAmountText(item);
            // Recurrente de registro (monto 0)
            if (item.tipo === 'recurrente' && item.monto === 0) {
              amountText = 'Registro';
              showRegistroBadge = true;
              if (conversionLabel) {
                registroBadgeText = conversionLabel;
              } else if (item.metadata?.montoOriginal && item.metadata?.monedaOrigen) {
                registroBadgeText = `${getCurrencySymbol(item.metadata.monedaOrigen)}${formatAmountPlain(Number(item.metadata.montoOriginal))} ${String(item.metadata.monedaOrigen).toUpperCase()}`;
              } else {
                registroBadgeText = 'Recurrente';
              }
            } else if (item.tipo === 'recurrente') {
              // Recurrente ejecutado (monto > 0)
              amountText = originalCurrencyAmountText ?? `$${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              showRecurrenteBadge = true;
              if (conversionLabel) {
                recurrenteBadgeText = conversionLabel;
              } else if (item.metadata?.monedaOrigen && item.metadata?.montoOriginal) {
                recurrenteBadgeText = `${getCurrencySymbol(item.metadata.monedaOrigen)}${formatAmountPlain(Number(item.metadata.montoOriginal))} ${String(item.metadata.monedaOrigen).toUpperCase()}`;
              } else {
                recurrenteBadgeText = 'Recurrente';
              }
            } else if (originalCurrencyAmountText) {
              amountText = originalCurrencyAmountText;
            } else if (item.monto >= 1000000) {
              amountText = `$${(item.monto / 1000000).toFixed(1)}M`;
            } else {
              amountText = `$${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            // Usar item.id o item._id como key y fallback para props
            const key = item.id || item._id;
            const distintivo = getDistintivo(item);
            return (
              <View key={key}>
                <TransactionItem
                  icon={iconByTipo(item.tipo)}
                  title={fixEncoding(item.descripcion)}
                  concepto={getConceptoLabel(item) || null}
                  conceptoMeta={getConceptoMeta(item)}
                  conceptoId={getConceptoId(item) || null}
                  amount={amountText}
                  date={new Date(item.fecha).toLocaleDateString()}
                  distintivo={distintivo}
                  tipo={item.tipo}
                  plataforma={item.detalles?.plataforma}
                  canEdit={canEditMovimiento(item)}
                  onEdit={() => openEdit(item)}
                  canDelete={canEditMovimiento(item)}
                  onDelete={() => openDelete(item)}
                  onPress={() => {
                    setItemSeleccionado(item);
                    setModalVisible(true);
                  }}
                />
                {(showRegistroBadge || showRecurrenteBadge) && (registroBadgeText || recurrenteBadgeText || item.metadata?.nota) && (
                  <View style={{ marginBottom: 6, marginLeft: 48 }}>
                    {!!(registroBadgeText || recurrenteBadgeText) && (
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 8 }}>
                        {showRegistroBadge ? registroBadgeText : recurrenteBadgeText}
                      </Text>
                    )}
                    {!!item.metadata?.nota && (
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 8, marginTop: (registroBadgeText || recurrenteBadgeText) ? 2 : 0 }}>
                        {fixEncoding(item.metadata.nota)}
                      </Text>
                    )}
                  </View>
                )}
                {!showRegistroBadge && !showRecurrenteBadge && conversionLabel && (
                  <View style={{ marginBottom: 6, marginLeft: 48 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 8 }}>{conversionLabel}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </>
      ) : (
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>
          No hay movimientos registrados.
        </Text>
      )}

      <View style={styles.pagination}>
        <TouchableOpacity
          disabled={page === 1}
          onPress={() => handleRequestPage(Math.max(page - 1, 1))}
          style={[styles.viewAllButton, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }, page === 1 && { opacity: 0.4 }]}
        >
          <Ionicons name="chevron-back-outline" size={16} color={colors.button} />
          <Text style={[styles.viewAllText, { color: colors.textSecondary }]}>Anterior</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Página {page}</Text>
        </View>

        <TouchableOpacity
          disabled={!hasMore}
          onPress={() => handleRequestPage(page + 1)}
          style={[styles.viewAllButton, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }, !hasMore && { opacity: 0.4 }]}
        >
          <Text style={[styles.viewAllText, { color: colors.textSecondary }]}>Siguiente</Text>
          <Ionicons name="chevron-forward-outline" size={16} color={colors.button} />
        </TouchableOpacity>
      </View>

      <HistorialDetalleModal
        visible={modalVisible}
        historialItem={itemSeleccionado}
        onClose={() => setModalVisible(false)}
      />

      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={closeEdit}>
        <View style={styles.editOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editKeyboard}>
            <View style={[styles.editModal, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.editHeader}>
                <Text style={[styles.editTitle, { color: colors.text }]}>Editar movimiento</Text>
                <TouchableOpacity onPress={closeEdit} disabled={savingEdit}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {!!editItem && (
                <View style={styles.editMetaRow}>
                  <View
                    style={[
                      styles.tipoBadge,
                      {
                        backgroundColor: colors.cardSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={String(editItem.tipo).toLowerCase() === 'egreso' ? 'arrow-up-outline' : 'arrow-down-outline'}
                      size={14}
                      color={String(editItem.tipo).toLowerCase() === 'egreso' ? colors.error : colors.success}
                    />
                    <Text
                      style={[
                        styles.tipoBadgeText,
                        { color: String(editItem.tipo).toLowerCase() === 'egreso' ? colors.error : colors.success },
                      ]}
                    >
                      {String(editItem.tipo).toLowerCase() === 'egreso' ? 'Egreso' : 'Ingreso'}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Concepto</Text>
              <TextInput
                value={editDescripcion}
                onChangeText={setEditDescripcion}
                placeholder="Concepto"
                placeholderTextColor={colors.placeholder}
                style={[styles.editInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
              />

              <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Monto</Text>
              <TextInput
                value={editMonto}
                onChangeText={setEditMonto}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                style={[styles.editInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
              />

              <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Fecha (opcional)</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowDatePicker(true)}
                style={[styles.dateRow, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.dateIcon, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.dateText, { color: editFecha ? colors.inputText : colors.placeholder }]}>
                    {editFecha ? editFecha : 'Sin fecha (usa hoy por defecto)'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {!!editFecha && (
                    <TouchableOpacity
                      onPress={() => setEditFecha('')}
                      activeOpacity={0.85}
                      style={[styles.clearDateBtn, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                    >
                      <Ionicons name="close" size={14} color={colors.textSecondary} />
                      <Text style={[styles.clearDateText, { color: colors.textSecondary }]}>Limpiar</Text>
                    </TouchableOpacity>
                  )}
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>

              {showDatePicker ? (
                <View style={{ marginTop: 10 }}>
                  <DateTimePicker
                    value={editFecha ? new Date(editFecha + 'T12:00:00') : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={onPickDate}
                  />
                  {Platform.OS === 'ios' ? (
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(false)}
                      activeOpacity={0.9}
                      style={[styles.iosDoneBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                    >
                      <Text style={[styles.iosDoneText, { color: colors.text }]}>Listo</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Motivo (opcional)</Text>
              <TextInput
                value={editMotivo}
                onChangeText={setEditMotivo}
                placeholder="Escribe una nota"
                placeholderTextColor={colors.placeholder}
                style={[styles.editInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
              />

              <TouchableOpacity
                onPress={saveEdit}
                disabled={savingEdit}
                activeOpacity={0.9}
                style={[styles.editSaveBtn, { backgroundColor: colors.button, opacity: savingEdit ? 0.7 : 1 }]}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editSaveText}>Guardar cambios</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={deleteVisible} transparent animationType="slide" onRequestClose={closeDelete}>
        <View style={styles.editOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editKeyboard}>
            <View style={[styles.editModal, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.editHeader}>
                <Text style={[styles.editTitle, { color: colors.text }]}>Eliminar movimiento</Text>
                <TouchableOpacity onPress={closeDelete} disabled={deleting}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                Esta acción elimina la transacción y restaura el balance. ¿Deseas continuar?
              </Text>

              <TouchableOpacity
                onPress={confirmDelete}
                disabled={deleting}
                activeOpacity={0.9}
                style={[styles.deleteConfirmBtn, { backgroundColor: colors.error, opacity: deleting ? 0.7 : 1 }]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editSaveText}>Eliminar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={closeDelete}
                disabled={deleting}
                activeOpacity={0.9}
                style={[styles.cancelBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border, opacity: deleting ? 0.7 : 1 }]}
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

export default TransactionHistory;

const styles = StyleSheet.create({
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  transactionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  transactionDetails: {
    flex: 1,
    marginRight: 8,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 10,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 13,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  deletePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "500",
    marginRight: 6,
  },
  searchInput: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 8,
  },
  distintivoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  distintivoText: {
    fontSize: 11,
    fontWeight: '600',
  },
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  editKeyboard: {
    width: '100%',
  },
  editModal: {
    width: '100%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editMetaRow: {
    marginBottom: 6,
  },
  tipoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  tipoBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  editTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  editInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
  },
  clearDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  clearDateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iosDoneBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosDoneText: {
    fontSize: 14,
    fontWeight: '800',
  },
  editSaveBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  deleteConfirmBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  recurrenteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
  },
  recurrenteBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  registroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    marginLeft: 2,
  },
  registroBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
