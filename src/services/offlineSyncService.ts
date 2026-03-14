import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoSubscription } from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import { API_BASE_URL } from '../constants/api';
import { apiRateLimiter } from './apiRateLimiter';
import { authService } from './authService';
import { emitTransaccionesChanged } from '../utils/dashboardRefreshBus';

type OfflineOpStatus = 'pending' | 'syncing' | 'failed';

type OfflineOpBase = {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: OfflineOpStatus;
  lastError?: string;
};

type PostTransaccionPayload = {
  tipo: string;
  monto: number;
  concepto?: string;
  motivo?: string;
  fecha?: string;
  moneda?: string;
  cuentaId: string;
  afectaCuenta?: boolean;
  subCuentaId?: string;
  // allow backend extensions without breaking
  [key: string]: any;
};

type OfflineOp =
  | (OfflineOpBase & {
      kind: 'post_transaccion';
      payload: PostTransaccionPayload;
    });

export type OfflinePendingHistorialItem = {
  id: string;
  movimientoId?: string;
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
      tipo: string;
      label?: string | null;
    };
    [key: string]: any;
  };
  metadata?: {
    [key: string]: any;
  };
};

const STORAGE_KEY = 'offline_ops_v1';

const makeId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const safeJsonParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const normalizeOps = (ops: any): OfflineOp[] => {
  if (!Array.isArray(ops)) return [];
  return ops
    .filter(Boolean)
    .map((op: any) => {
      const kind = String(op?.kind ?? '');
      if (kind !== 'post_transaccion') return null;

      const payload = op?.payload as PostTransaccionPayload | undefined;
      const cuentaId = String(payload?.cuentaId ?? '');
      if (!cuentaId) return null;

      const id = String(op?.id ?? makeId());
      const createdAt = Number(op?.createdAt ?? Date.now());
      const updatedAt = Number(op?.updatedAt ?? createdAt);
      const statusRaw = String(op?.status ?? 'pending') as OfflineOpStatus;
      const status: OfflineOpStatus =
        statusRaw === 'syncing' || statusRaw === 'failed' || statusRaw === 'pending' ? statusRaw : 'pending';

      const lastError = typeof op?.lastError === 'string' ? op.lastError : undefined;

      return {
        id,
        createdAt,
        updatedAt,
        status,
        lastError,
        kind: 'post_transaccion',
        payload,
      } as OfflineOp;
    })
    .filter(Boolean) as OfflineOp[];
};

const loadOps = async (): Promise<OfflineOp[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed = safeJsonParse<any>(raw, []);
  return normalizeOps(parsed);
};

const saveOps = async (ops: OfflineOp[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
};

const isLikelyOfflineError = (err: unknown): boolean => {
  const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : String(err);
  return (
    msg.toLowerCase().includes('network request failed') ||
    msg.toLowerCase().includes('failed to fetch') ||
    msg.toLowerCase().includes('networkerror')
  );
};

const toPendingHistorialItem = (op: OfflineOp): OfflinePendingHistorialItem | null => {
  if (op.kind !== 'post_transaccion') return null;

  const p = op.payload;
  const nowIso = new Date(op.createdAt).toISOString();
  const fecha = String(p.fecha ?? nowIso);

  const distintivoLabel =
    op.status === 'failed' ? 'Error al sincronizar' : op.status === 'syncing' ? 'Sincronizando…' : 'Pendiente';

  return {
    id: `offline:${op.id}`,
    movimientoId: undefined,
    transaccionId: undefined,
    _id: undefined,
    descripcion: String(p.concepto ?? p.motivo ?? 'Movimiento'),
    monto: Number(p.monto ?? 0),
    tipo: String(p.tipo ?? ''),
    fecha,
    cuentaId: String(p.cuentaId),
    subcuentaId: p.subCuentaId ? String(p.subCuentaId) : undefined,
    detalles: {
      distintivo: {
        tipo: 'offline',
        label: distintivoLabel,
      },
    },
    metadata: {
      moneda: p.moneda,
      motivo: p.motivo,
      offlineOpId: op.id,
    },
  };
};

let initialized = false;
let unsubscribeNetInfo: NetInfoSubscription | null = null;
let syncing = false;

const syncNow = async (reason: string = 'manual'): Promise<void> => {
  if (syncing) return;

  syncing = true;
  try {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    // Ensure we have a token and try to refresh if needed while online.
    const token = await authService.getAccessToken({ allowRefresh: true }).catch(() => null);
    if (!token) return;

    let ops = await loadOps();
    if (!ops.length) return;

    // oldest first
    ops = [...ops].sort((a, b) => a.createdAt - b.createdAt);

    for (const op of ops) {
      // re-check connectivity between ops
      const cur = await NetInfo.fetch();
      if (!cur.isConnected) return;

      if (op.kind !== 'post_transaccion') continue;

      // mark syncing
      const now = Date.now();
      const nextOps1 = ops.map((x) => (x.id === op.id ? { ...x, status: 'syncing' as const, updatedAt: now } : x));
      await saveOps(nextOps1);
      ops = nextOps1;
      emitTransaccionesChanged();

      try {
        const res = await apiRateLimiter.fetch(`${API_BASE_URL}/transacciones`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': op.id,
            'X-Offline-Op': '1',
          },
          body: JSON.stringify(op.payload),
        });

        if (res.ok) {
          const nextOps2 = ops.filter((x) => x.id !== op.id);
          await saveOps(nextOps2);
          ops = nextOps2;
          emitTransaccionesChanged();
          continue;
        }

        const body = await res.json().catch(() => ({}));
        const message = String(body?.message ?? res.statusText ?? 'Error al sincronizar');

        // Minimal conflict prompting (ask user)
        if (res.status === 409) {
          await new Promise<void>((resolve) => {
            Alert.alert(
              'Conflicto al sincronizar',
              message || 'No se pudo sincronizar un movimiento guardado offline.',
              [
                {
                  text: 'Mantener pendiente',
                  style: 'cancel',
                  onPress: () => resolve(),
                },
                {
                  text: 'Descartar',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const latest = await loadOps();
                      await saveOps(latest.filter((x) => x.id !== op.id));
                      emitTransaccionesChanged();
                    } catch {
                      // ignore
                    }
                    resolve();
                  },
                },
              ]
            );
          });
          // keep going to next op
          continue;
        }

        // Mark failed but keep queued (retry later)
        const now2 = Date.now();
        const nextOps3 = ops.map((x) =>
          x.id === op.id ? { ...x, status: 'failed' as const, updatedAt: now2, lastError: message } : x
        );
        await saveOps(nextOps3);
        ops = nextOps3;

        emitTransaccionesChanged();

        // avoid hammering backend; stop after first non-offline failure
        return;
      } catch (err) {
        // network issues: revert to pending and stop
        const now3 = Date.now();
        const nextOps4 = ops.map((x) =>
          x.id === op.id
            ? {
                ...x,
                status: 'pending' as const,
                updatedAt: now3,
                lastError: isLikelyOfflineError(err) ? undefined : String((err as any)?.message ?? err),
              }
            : x
        );
        await saveOps(nextOps4);
        ops = nextOps4;
        emitTransaccionesChanged();
        return;
      }
    }
  } finally {
    syncing = false;
  }
};

const init = (): void => {
  if (initialized) return;
  initialized = true;

  // Kick a sync on app start (best-effort)
  syncNow('app_start').catch(() => {});

  // Listen for reconnects
  try {
    let lastConnected: boolean | null = null;
    unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected;
      if (lastConnected === null) {
        lastConnected = connected;
        return;
      }
      if (!lastConnected && connected) {
        syncNow('reconnect').catch(() => {});
      }
      lastConnected = connected;
    });
  } catch {
    // ignore
  }
};

const stop = (): void => {
  try {
    unsubscribeNetInfo?.();
  } catch {
    // ignore
  }
  unsubscribeNetInfo = null;
  initialized = false;
};

const enqueueTransaccion = async (payload: PostTransaccionPayload): Promise<{ opId: string }> => {
  const opId = makeId();
  const now = Date.now();

  const op: OfflineOp = {
    id: opId,
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    kind: 'post_transaccion',
    payload,
  };

  const ops = await loadOps();
  await saveOps([op, ...ops]);

  // ask sync in case connectivity is actually back
  syncNow('enqueue').catch(() => {});
  emitTransaccionesChanged();

  return { opId };
};

const getPendingHistorialItemsForCuenta = async (cuentaId: string): Promise<OfflinePendingHistorialItem[]> => {
  const ops = await loadOps();
  const items = ops
    .filter((op) => op.kind === 'post_transaccion')
    .filter((op) => String((op as any).payload?.cuentaId ?? '') === String(cuentaId))
    .map((op) => toPendingHistorialItem(op))
    .filter(Boolean) as OfflinePendingHistorialItem[];

  // Most-recent first
  return items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
};

export const offlineSyncService = {
  init,
  stop,
  syncNow,
  enqueueTransaccion,
  getPendingHistorialItemsForCuenta,
};
