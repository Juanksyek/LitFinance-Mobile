import { httpClient } from '../../../shared/api/api-client';
import { authService } from '../../../services/authService';
import type {
  DashboardSnapshot,
  DashboardSnapshotRequest,
  RateLimitedError,
  SnapshotFetchResult,
  UnauthorizedError,
} from '../domain/dashboardSnapshot.types';
import { normalizeDashboardSnapshot } from '../domain/normalizeDashboardSnapshot';

function buildSnapshotPath(params: DashboardSnapshotRequest): string {
  const query = new URLSearchParams();
  const entries: Array<[string, string | number | undefined]> = [
    ['range', params.range],
    ['recentLimit', params.recentLimit],
    ['recentPage', params.recentPage],
    ['subaccountsLimit', params.subaccountsLimit],
    ['subaccountsPage', params.subaccountsPage],
    ['recurrentesLimit', params.recurrentesLimit],
    ['recurrentesPage', params.recurrentesPage],
    ['metasLimit', params.metasLimit],
    ['metasPage', params.metasPage],
  ];
  entries.forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  const serialized = query.toString();
  return `/dashboard/snapshot${serialized ? `?${serialized}` : ''}`;
}

async function performRequest(
  params: DashboardSnapshotRequest,
  accessToken: string,
): Promise<Response> {
  const [refreshToken, deviceId] = await Promise.all([
    authService.getRefreshToken(),
    authService.getOrCreateDeviceId(),
  ]);

  return httpClient.raw(buildSnapshotPath(params), {
    method: 'GET',
    direct: true,
    signal: params.signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(refreshToken ? { 'x-refresh-token': refreshToken } : {}),
      ...(deviceId ? { 'x-device-id': deviceId } : {}),
      ...(params.etag ? { 'If-None-Match': params.etag } : {}),
    },
  });
}

async function persistRotatedSession(response: Response): Promise<void> {
  if (response.headers.get('x-session-refreshed') !== '1') return;

  const authorization =
    response.headers.get('x-access-token') ??
    response.headers.get('authorization');
  const refreshToken = response.headers.get('x-refresh-token')?.trim();
  const accessToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : authorization?.trim();

  if (accessToken) await authService.setAccessToken(accessToken);
  if (refreshToken) await authService.setRefreshToken(refreshToken);
}

function unauthorizedError(): UnauthorizedError {
  return Object.assign(new Error('UNAUTHORIZED'), {
    code: 'UNAUTHORIZED' as const,
  });
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function unwrapSnapshotPayload(payload: any): DashboardSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;

  if (
    'accountSummary' in payload ||
    'subaccountsSummary' in payload ||
    'recurrentesSummary' in payload ||
    'recentTransactions' in payload
  ) {
    return payload as DashboardSnapshot;
  }

  if (payload.data && typeof payload.data === 'object') {
    return payload.data as DashboardSnapshot;
  }

  return null;
}

export const dashboardSnapshotApi = {
  async fetch(
    params: DashboardSnapshotRequest,
  ): Promise<SnapshotFetchResult> {
    let accessToken = await authService.getAccessToken({ allowRefresh: false });
    if (!accessToken) throw unauthorizedError();

    let response = await performRequest(params, accessToken);
    await persistRotatedSession(response);

    if (response.status === 401) {
      try {
        accessToken = await authService.refreshTokens();
        response = await performRequest(params, accessToken);
        await persistRotatedSession(response);
      } catch {
        throw unauthorizedError();
      }
    }

    if (response.status === 304) {
      return { kind: 'not-modified' };
    }

    if (response.status === 429) {
      const body = await safeJson(response);
      const seconds = Number(
        response.headers.get('Retry-After') ??
        body?.retryAfterSeconds ??
        1,
      );
      const error: RateLimitedError = Object.assign(
        new Error('RATE_LIMITED'),
        {
          code: 'RATE_LIMITED' as const,
          retryAfterSeconds:
            Number.isFinite(seconds) && seconds > 0 ? seconds : 1,
        },
      );
      throw error;
    }

    if (response.status === 401) throw unauthorizedError();

    if (!response.ok) {
      const body = await safeJson(response);
      const error = Object.assign(
        new Error(body?.message ?? 'REQUEST_FAILED'),
        {
          code: body?.code,
          status: response.status,
          body,
        },
      );
      throw error;
    }

    const body = await safeJson(response);
    const snapshot = normalizeDashboardSnapshot(unwrapSnapshotPayload(body));

    if (!snapshot) {
      const error = Object.assign(
        new Error('INVALID_DASHBOARD_SNAPSHOT'),
        {
          code: 'INVALID_DASHBOARD_SNAPSHOT',
          status: response.status,
          body,
        },
      );
      throw error;
    }

    return {
      kind: 'ok',
      snapshot,
      etag: response.headers.get('ETag'),
    };
  },
};
