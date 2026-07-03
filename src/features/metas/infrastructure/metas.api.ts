import { ApiRequestError } from '../../../shared/api/api-errors';
import { httpClient } from '../../../shared/api/api-client';
import { sanitizeObjectStrings } from '../../../utils/fixMojibake';
import type {
  CreateMetaRequest,
  Meta,
  MetaHistorialItem,
  MetaMovimientoRequest,
  MetaOperacionRequest,
  ResolveMetaCompletionRequest,
  ResolveMetaCompletionResponse,
  UpdateMetaRequest,
} from '../domain/metas.types';

const BASE_PATH = '/metas';
const authenticated = { authenticated: true } as const;

function metaPath(metaId: string): string {
  return `${BASE_PATH}/${encodeURIComponent(metaId)}`;
}

function sanitize<T>(value: T): T {
  return sanitizeObjectStrings(value) as T;
}

function unwrap<T>(payload: unknown): T {
  const sanitized = sanitize(payload) as Record<string, unknown>;
  const first = sanitized?.data ?? sanitized;
  if (typeof first === 'object' && first !== null) {
    const record = first as Record<string, unknown>;
    const second = record.data ?? record;
    if (typeof second === 'object' && second !== null) {
      return ((second as Record<string, unknown>).meta ?? record.meta ?? second) as T;
    }
  }
  return first as T;
}

function addIdempotencyHeader(key?: string): HeadersInit | undefined {
  return key ? { 'Idempotency-Key': key } : undefined;
}

async function requestWithFallback<T>(
  paths: string[],
  method: 'POST' | 'PATCH',
  payload?: unknown,
  headers?: HeadersInit,
): Promise<T> {
  let lastError: unknown;

  for (const path of paths) {
    try {
      const result = method === 'POST'
        ? await httpClient.post<T>(path, payload, {
            authenticated: true,
            headers,
          })
        : await httpClient.patch<T>(path, payload, {
            authenticated: true,
            headers,
          });
      return sanitize(result);
    } catch (error) {
      lastError = error;
      if (
        error instanceof ApiRequestError &&
        (error.statusCode === 404 || error.statusCode === 405)
      ) {
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export const metasApi = {
  list(query: string, cacheTtlMs: number): Promise<unknown> {
    return httpClient.get(`${BASE_PATH}${query}`, {
      authenticated: true,
      headers: { 'X-Cache-Ttl': String(cacheTtlMs) },
    }).then(sanitize);
  },

  refreshList(query: string, cacheTtlMs: number): Promise<unknown> {
    return this.list(query, cacheTtlMs);
  },

  getDetail(metaId: string, cacheTtlMs: number): Promise<Meta> {
    return httpClient.get(metaPath(metaId), {
      authenticated: true,
      headers: { 'X-Cache-Ttl': String(cacheTtlMs) },
    }).then(unwrap<Meta>);
  },

  create(payload: CreateMetaRequest): Promise<Meta> {
    return httpClient.post(BASE_PATH, payload, authenticated).then(unwrap<Meta>);
  },

  update(metaId: string, payload: UpdateMetaRequest): Promise<Meta> {
    return httpClient.patch(
      metaPath(metaId),
      payload,
      authenticated,
    ).then(unwrap<Meta>);
  },

  aportar(metaId: string, payload: MetaMovimientoRequest): Promise<Meta> {
    return requestWithFallback(
      [`${metaPath(metaId)}/aporte`, `${metaPath(metaId)}/aportes`],
      'POST',
      payload,
      addIdempotencyHeader(payload.idempotencyKey),
    ).then(unwrap<Meta>);
  },

  retirar(metaId: string, payload: MetaMovimientoRequest): Promise<Meta> {
    return requestWithFallback(
      [`${metaPath(metaId)}/retiro`, `${metaPath(metaId)}/retiros`],
      'POST',
      payload,
      addIdempotencyHeader(payload.idempotencyKey),
    ).then(unwrap<Meta>);
  },

  ingreso(metaId: string, payload: MetaOperacionRequest): Promise<unknown> {
    return httpClient.post(
      `${metaPath(metaId)}/ingreso`,
      payload,
      {
        authenticated: true,
        headers: addIdempotencyHeader(payload.idempotencyKey),
      },
    ).then(unwrap<unknown>);
  },

  egreso(metaId: string, payload: MetaOperacionRequest): Promise<unknown> {
    return httpClient.post(
      `${metaPath(metaId)}/egreso`,
      payload,
      {
        authenticated: true,
        headers: addIdempotencyHeader(payload.idempotencyKey),
      },
    ).then(unwrap<unknown>);
  },

  async getHistorial(
    metaId: string,
    query: string,
    cacheTtlMs: number,
  ): Promise<MetaHistorialItem[]> {
    const response = sanitize(await httpClient.get<unknown>(
      `${metaPath(metaId)}/historial${query}`,
      {
        authenticated: true,
        headers: { 'X-Cache-Ttl': String(cacheTtlMs) },
      },
    ));
    const normalized = unwrap<unknown>(response);
    if (Array.isArray(normalized)) return normalized;
    if (
      typeof normalized === 'object' &&
      normalized !== null &&
      Array.isArray((normalized as { items?: unknown[] }).items)
    ) {
      return (normalized as { items: MetaHistorialItem[] }).items;
    }
    return [];
  },

  cambiarEstado(metaId: string, estado: string): Promise<Meta> {
    return httpClient.put(
      `${metaPath(metaId)}/status`,
      { estado },
      authenticated,
    ).then(unwrap<Meta>);
  },

  async cambiarEstadoPreferido(
    metaId: string,
    action: 'pausar' | 'reanudar' | 'archivar',
  ): Promise<Meta | null> {
    try {
      return unwrap<Meta>(await requestWithFallback(
        [`${metaPath(metaId)}/${action}`],
        'PATCH',
      ));
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        (error.statusCode === 404 || error.statusCode === 405)
      ) {
        return null;
      }
      throw error;
    }
  },

  delete(metaId: string): Promise<any> {
    return httpClient.delete<any>(metaPath(metaId), authenticated).then(sanitize);
  },

  resolveCompletion(
    metaId: string,
    payload: ResolveMetaCompletionRequest,
  ): Promise<ResolveMetaCompletionResponse> {
    return httpClient.post(
      `${metaPath(metaId)}/completion/resolve`,
      payload,
      authenticated,
    ).then(unwrap<ResolveMetaCompletionResponse>);
  },
};
