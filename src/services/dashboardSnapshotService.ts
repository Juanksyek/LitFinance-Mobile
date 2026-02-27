import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';
import { authService } from './authService';
import type { DashboardRange, DashboardSnapshot, SnapshotFetchResult, RateLimitedError, UnauthorizedError } from '../types/dashboardSnapshot';

const memoryCache = new Map<string, { snapshot: DashboardSnapshot; etag: string | null }>();
// Store latest metasSummary globally to help other services avoid empty-list UX
let latestMetasSummary: DashboardSnapshot['metasSummary'] | null = null;

export function getLatestMetasSummary() {
  return latestMetasSummary;
}

export async function invalidateLatestMetasSummary(): Promise<void> {
  latestMetasSummary = null;
  try {
    await AsyncStorage.removeItem('metasSummary:latest');
  } catch {
    // ignore
  }
}

function cacheKey(params: { userId: string; range: DashboardRange; recentLimit: number }): string {
  return `dashboardSnapshot:${params.userId}:${params.range}:${params.recentLimit}`;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function getCachedDashboardSnapshot(params: {
  userId: string;
  range: DashboardRange;
  recentLimit: number;
}): Promise<{ snapshot: DashboardSnapshot; etag: string | null } | null> {
  const key = cacheKey(params);
  const inMem = memoryCache.get(key);
  if (inMem) return inMem;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.snapshot) return null;
    const value = { snapshot: parsed.snapshot as DashboardSnapshot, etag: (parsed.etag ?? null) as string | null };
    memoryCache.set(key, value);
    return value;
  } catch {
    return null;
  }
}

export async function setCachedDashboardSnapshot(params: {
  userId: string;
  range: DashboardRange;
  recentLimit: number;
  snapshot: DashboardSnapshot;
  etag: string | null;
}): Promise<void> {
  const key = cacheKey(params);
  const value = { snapshot: params.snapshot, etag: params.etag };
  memoryCache.set(key, value);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    // also persist metasSummary (if present) to a global key for quick access
    try {
      const metas = params.snapshot?.metasSummary ?? null;
      if (metas) {
        latestMetasSummary = metas;
        await AsyncStorage.setItem(`${key}:metasSummary`, JSON.stringify(metas));
        // also keep a short global key for fastest lookup across screens
        await AsyncStorage.setItem('metasSummary:latest', JSON.stringify(metas));
      }
    } catch {
      // ignore
    }
  } catch {
    // ignore storage failures
  }
}

export async function clearCachedDashboardSnapshot(params: {
  userId: string;
  range: DashboardRange;
  recentLimit: number;
}): Promise<void> {
  const key = cacheKey(params);
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function fetchDashboardSnapshot(params: {
  etag?: string;
  range?: DashboardRange;
  recentLimit?: number;
  recentPage?: number;
  subaccountsLimit?: number;
  subaccountsPage?: number;
  recurrentesLimit?: number;
  recurrentesPage?: number;
  metasLimit?: number;
  metasPage?: number;
  signal?: AbortSignal;
}): Promise<SnapshotFetchResult> {
  const url = new URL('/dashboard/snapshot', API_BASE_URL);
  if (params.range) url.searchParams.set('range', params.range);
  if (typeof params.recentLimit === 'number') url.searchParams.set('recentLimit', String(params.recentLimit));
  if (typeof params.recentPage === 'number') url.searchParams.set('recentPage', String(params.recentPage));
  if (typeof params.subaccountsLimit === 'number') url.searchParams.set('subaccountsLimit', String(params.subaccountsLimit));
  if (typeof params.subaccountsPage === 'number') url.searchParams.set('subaccountsPage', String(params.subaccountsPage));
  if (typeof params.recurrentesLimit === 'number') url.searchParams.set('recurrentesLimit', String(params.recurrentesLimit));
  if (typeof params.recurrentesPage === 'number') url.searchParams.set('recurrentesPage', String(params.recurrentesPage));
  if (typeof params.metasLimit === 'number') url.searchParams.set('metasLimit', String(params.metasLimit));
  if (typeof params.metasPage === 'number') url.searchParams.set('metasPage', String(params.metasPage));

  const doFetch = async (accessToken: string): Promise<Response> => {
    // Best-effort session refresh headers for /dashboard/snapshot
    // Backend may rotate tokens when access token is near expiry.
    const [refreshToken, deviceId] = await Promise.all([
      authService.getRefreshToken(),
      authService.getOrCreateDeviceId(),
    ]);

    return fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(refreshToken ? { 'x-refresh-token': refreshToken } : {}),
        ...(deviceId ? { 'x-device-id': deviceId } : {}),
        ...(params.etag ? { 'If-None-Match': params.etag } : {}),
      },
      signal: params.signal,
    });
  };

  const persistRefreshedSessionIfAny = async (res: Response): Promise<void> => {
    try {
      const refreshed = res.headers.get('x-session-refreshed');
      if (refreshed !== '1') return;

      // Prefer explicit headers, fall back to Authorization bearer.
      const headerAccess = res.headers.get('x-access-token') || res.headers.get('authorization') || res.headers.get('Authorization');
      const headerRefresh = res.headers.get('x-refresh-token');

      const nextAccess = headerAccess?.startsWith('Bearer ')
        ? headerAccess.slice('Bearer '.length).trim()
        : headerAccess?.trim();
      const nextRefresh = headerRefresh?.trim();

      if (nextAccess) {
        await authService.setAccessToken(nextAccess);
      }
      if (nextRefresh) {
        await authService.setRefreshToken(nextRefresh);
      }
    } catch {
      // best-effort
    }
  };

  let token = await authService.getAccessToken();
  if (!token) {
    const err: UnauthorizedError = Object.assign(new Error('UNAUTHORIZED'), { code: 'UNAUTHORIZED' as const });
    throw err;
  }

  let res = await doFetch(token);

  // Best-effort persist refreshed tokens if server rotated them
  await persistRefreshedSessionIfAny(res);

  // If unauthorized, attempt refresh once
  if (res.status === 401) {
    try {
      const newToken = await authService.refreshTokens();
      if (!newToken) {
        const err: UnauthorizedError = Object.assign(new Error('UNAUTHORIZED'), { code: 'UNAUTHORIZED' as const });
        throw err;
      }
      token = newToken;
      res = await doFetch(token);

      await persistRefreshedSessionIfAny(res);
    } catch {
      const err: UnauthorizedError = Object.assign(new Error('UNAUTHORIZED'), { code: 'UNAUTHORIZED' as const });
      throw err;
    }
  }

  if (res.status === 304) {
    return { kind: 'not-modified' };
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const body = await safeJson(res);
    const seconds = retryAfter ? Number(retryAfter) : Number(body?.retryAfterSeconds ?? 1);
    const err: RateLimitedError = Object.assign(new Error('RATE_LIMITED'), {
      code: 'RATE_LIMITED' as const,
      retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 1,
    });
    throw err;
  }

  if (res.status === 401) {
    const err: UnauthorizedError = Object.assign(new Error('UNAUTHORIZED'), { code: 'UNAUTHORIZED' as const });
    throw err;
  }

  if (!res.ok) {
    const body = await safeJson(res);
    const e: any = new Error(body?.message ?? 'REQUEST_FAILED');
    e.code = body?.code;
    e.status = res.status;
    e.body = body;
    throw e;
  }

  const snapshot = (await res.json()) as DashboardSnapshot;
  const etag = res.headers.get('ETag');
  return { kind: 'ok', snapshot, etag };
}
