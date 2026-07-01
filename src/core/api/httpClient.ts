import { apiRateLimiter } from '../../services/apiRateLimiter';
import NetInfo from '@react-native-community/netinfo';
import { tokenManager } from '../auth/tokenManager';
import { env } from '../config/env';
import { buildMobileHeaders } from '../mobile/appInfo';
import { setLatestResponseMeta } from '../mobile/responseMetaStore';
import { apiObservabilityService } from '../../services/apiObservabilityService';
import {
  ApiRequestError,
  normalizeApiError,
  normalizeResponseError,
} from './errorHandler';

export type HttpRequestOptions = RequestInit & {
  authenticated?: boolean;
  direct?: boolean;
  skipCache?: boolean;
};

type EnvelopePayload<T = unknown> = {
  data?: T;
  error?: {
    code?: string;
    details?: unknown;
    message?: string;
    requestId?: string;
    retryable?: boolean;
  };
  meta?: {
    nextCursor?: string | null;
    requestId?: string;
    retryAfterSeconds?: number;
    serverTime?: string;
  };
  success?: boolean;
};

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${env.API_BASE_URL}${normalizedPath}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await parseBody(response);
  const envelope = isEnvelopePayload(payload) ? payload : null;

  if (envelope) {
    setLatestResponseMeta({
      nextCursor: envelope.meta?.nextCursor ?? null,
      requestId:
        envelope.meta?.requestId ??
        envelope.error?.requestId ??
        response.headers.get('x-request-id') ??
        undefined,
      retryAfterSeconds:
        envelope.meta?.retryAfterSeconds ??
        getRetryAfterHeader(response) ??
        undefined,
      serverTime:
        envelope.meta?.serverTime ??
        response.headers.get('date') ??
        undefined,
    });

    if (envelope.success === false) {
      throw new ApiRequestError(normalizeResponseError(response, payload));
    }
  } else {
    setLatestResponseMeta({
      requestId: response.headers.get('x-request-id') ?? undefined,
      retryAfterSeconds: getRetryAfterHeader(response) ?? undefined,
      serverTime: response.headers.get('date') ?? undefined,
    });
  }

  if (!response.ok) {
    throw new ApiRequestError(normalizeResponseError(response, payload));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (envelope) {
    return envelope.data as T;
  }

  return payload as T;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function withJsonHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers || {});
  if (!result.has('Content-Type')) {
    result.set('Content-Type', 'application/json');
  }
  return result;
}

export const httpClient = {
  async raw(path: string, options: HttpRequestOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers || {});
    const { authenticated, direct, skipCache, ...requestOptions } = options;
    const requestId = headers.get('X-Request-ID') || headers.get('x-request-id') || undefined;

    const mobileHeaders = await buildMobileHeaders({ requestId });
    Object.entries(mobileHeaders).forEach(([key, value]) => {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    });

    if (authenticated && !headers.has('Authorization')) {
      const token = await tokenManager.getAccessToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    if (skipCache) {
      headers.set('X-Skip-Cache', '1');
      headers.set('Cache-Control', 'no-store');
    }

    try {
      const netState = await NetInfo.fetch().catch(() => null);
      if (netState && netState.isConnected === false) {
        throw new ApiRequestError({
          type: 'NETWORK',
          message: 'No hay conexion a internet.',
          retryable: true,
        });
      }

      const { signal, ...restRequestOptions } = requestOptions;
      const timeoutSignal = createTimeoutSignal(signal, 15000);
      const request = {
        ...restRequestOptions,
        headers,
        signal: timeoutSignal.signal,
      };
      const response = direct
        ? await fetch(buildUrl(path), request)
        : await apiRateLimiter.fetch(buildUrl(path), request);
      timeoutSignal.cleanup();
      return response;
    } catch (error) {
      throw new ApiRequestError(normalizeApiError(error));
    }
  },

  async request<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    const startedAt = Date.now();
    const method = String(options.method || 'GET').toUpperCase();
    let response: Response | undefined;

    try {
      response = await this.raw(path, options);
      const data = await parseResponse<T>(response);
      recordRequestObservability({
        durationMs: Date.now() - startedAt,
        method,
        path,
        requestId: response.headers.get('x-request-id') ?? undefined,
        statusCode: response.status,
      });
      return data;
    } catch (error) {
      const normalizedError =
        error instanceof ApiRequestError
          ? error
          : new ApiRequestError(normalizeApiError(error));

      recordRequestObservability({
        durationMs: Date.now() - startedAt,
        method,
        path,
        requestId:
          normalizedError.requestId ??
          response?.headers.get('x-request-id') ??
          undefined,
        statusCode: normalizedError.statusCode ?? response?.status,
      });
      apiObservabilityService.recordEndpointError({
        method,
        pathOrUrl: path,
        requestId:
          normalizedError.requestId ??
          response?.headers.get('x-request-id') ??
          undefined,
        statusCode: normalizedError.statusCode ?? response?.status,
      });
      throw normalizedError;
    }
  },

  get<T>(path: string, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  },

  post<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      headers: withJsonHeaders(options?.headers),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  patch<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      headers: withJsonHeaders(options?.headers),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  put<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      headers: withJsonHeaders(options?.headers),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },

  delete<T>(path: string, options?: HttpRequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  },
};

const SLOW_REQUEST_THRESHOLD_MS = 1200;

function recordRequestObservability(input: {
  durationMs: number;
  method: string;
  path: string;
  requestId?: string;
  statusCode?: number;
}): void {
  if (input.durationMs < SLOW_REQUEST_THRESHOLD_MS) return;
  apiObservabilityService.recordSlowRequest({
    durationMs: input.durationMs,
    method: input.method,
    pathOrUrl: input.path,
    requestId: input.requestId,
    statusCode: input.statusCode,
  });
}

function createTimeoutSignal(
  sourceSignal: AbortSignal | null | undefined,
  timeoutMs: number,
): {
  cleanup: () => void;
  signal: AbortSignal;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error('Request timeout'));
  }, timeoutMs);

  const abortFromSource = () => {
    controller.abort();
  };

  if (sourceSignal) {
    if (sourceSignal.aborted) {
      controller.abort();
    } else {
      sourceSignal.addEventListener('abort', abortFromSource, { once: true });
    }
  }

  return {
    cleanup: () => {
      clearTimeout(timeout);
      if (sourceSignal) {
        sourceSignal.removeEventListener('abort', abortFromSource);
      }
    },
    signal: controller.signal,
  };
}

function getRetryAfterHeader(response: Response): number | undefined {
  const headerValue = Number(response.headers.get('Retry-After'));
  return Number.isFinite(headerValue) && headerValue > 0 ? headerValue : undefined;
}

function isEnvelopePayload(value: unknown): value is EnvelopePayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as EnvelopePayload;
  return (
    typeof candidate.success === 'boolean' ||
    typeof candidate.meta === 'object' ||
    typeof candidate.error === 'object'
  );
}
