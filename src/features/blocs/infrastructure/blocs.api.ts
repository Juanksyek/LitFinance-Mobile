import { ApiRequestError } from '../../../shared/api/api-errors';
import { httpClient } from '../../../shared/api/api-client';
import { CACHE_TTLS } from '../../../shared/query';
import { sanitizeObjectStrings } from '../../../utils/fixMojibake';
import type {
  Bloc,
  BlocDetailResponse,
  CreateBlocItemRequest,
  CreateBlocRequest,
  LiquidationCommitRequest,
  LiquidationCommitResponse,
  LiquidationPreviewRequest,
  LiquidationPreviewResponse,
  ListLiquidacionesResponse,
  PatchBlocItemsRequest,
  PatchBlocItemsResponse,
  PatchBlocRequest,
  UpdateBlocItemRequest,
} from '../domain/blocs.types';

const BASE_PATH = '/blocs';
const cacheHeaders = { 'X-Cache-Ttl': String(CACHE_TTLS.blocs) };
const authenticated = { authenticated: true } as const;

function blocPath(blocId: string): string {
  return `${BASE_PATH}/${encodeURIComponent(blocId)}`;
}

function unwrapData<T>(data: unknown): T {
  const sanitized = sanitizeObjectStrings(data) as Record<string, unknown>;
  return ((sanitized?.data ?? sanitized) as T);
}

function withLegacyErrorShape(error: unknown): never {
  if (error instanceof ApiRequestError) {
    const compatible = error as ApiRequestError & {
      status?: number;
      body?: unknown;
    };
    compatible.status = error.statusCode;
    compatible.body = error.details;
  }
  throw error;
}

async function postWithFallback<T>(
  paths: string[],
  payload: unknown,
  headers?: HeadersInit,
): Promise<T> {
  let lastError: unknown;

  for (const path of paths) {
    try {
      return await httpClient.post<T>(path, payload, {
        authenticated: true,
        headers,
      });
    } catch (error) {
      lastError = error;
      if (
        error instanceof ApiRequestError &&
        (error.statusCode === 404 || error.statusCode === 405)
      ) {
        continue;
      }
      withLegacyErrorShape(error);
    }
  }

  withLegacyErrorShape(lastError);
}

export const blocsApi = {
  async list(): Promise<Bloc[]> {
    const data = unwrapData<unknown>(await httpClient.get(BASE_PATH, {
      ...authenticated,
      headers: cacheHeaders,
    }));
    if (Array.isArray(data)) return data as Bloc[];
    const record = data as { items?: Bloc[] };
    return Array.isArray(record?.items) ? record.items : [];
  },

  async create(payload: CreateBlocRequest): Promise<Bloc> {
    return unwrapData(await httpClient.post(
      BASE_PATH,
      payload,
      authenticated,
    ));
  },

  async patch(blocId: string, payload: PatchBlocRequest): Promise<Bloc | undefined> {
    const response = await httpClient.patch<Bloc | { data: Bloc } | undefined>(
      blocPath(blocId),
      payload,
      authenticated,
    );
    return response === undefined ? undefined : unwrapData<Bloc>(response);
  },

  async getDetail(blocId: string): Promise<BlocDetailResponse> {
    return unwrapData(await httpClient.get(
      blocPath(blocId),
      { ...authenticated, headers: cacheHeaders },
    ));
  },

  async createItem(
    blocId: string,
    payload:
      | CreateBlocItemRequest
      | CreateBlocItemRequest[]
      | { items: CreateBlocItemRequest[] },
  ): Promise<unknown> {
    return unwrapData(await httpClient.post(
      `${blocPath(blocId)}/items`,
      payload,
      authenticated,
    ));
  },

  async patchItems(
    blocId: string,
    payload: PatchBlocItemsRequest,
  ): Promise<PatchBlocItemsResponse | undefined> {
    try {
      const response = await httpClient.patch<
        PatchBlocItemsResponse | { data: PatchBlocItemsResponse } | undefined
      >(`${blocPath(blocId)}/items`, payload, authenticated);
      return response === undefined
        ? undefined
        : unwrapData<PatchBlocItemsResponse>(response);
    } catch (error) {
      withLegacyErrorShape(error);
    }
  },

  async updateItem(
    blocId: string,
    itemId: string,
    payload: UpdateBlocItemRequest,
  ): Promise<unknown> {
    return unwrapData(await httpClient.patch(
      `${blocPath(blocId)}/items/${encodeURIComponent(itemId)}`,
      payload,
      authenticated,
    ));
  },

  async deleteItem(blocId: string, itemId: string): Promise<void> {
    const itemPath = `${blocPath(blocId)}/items/${encodeURIComponent(itemId)}`;
    const candidates = [
      { method: 'DELETE' as const, path: itemPath },
      { method: 'POST' as const, path: `${itemPath}/eliminar` },
      {
        method: 'POST' as const,
        path: `${BASE_PATH}/items/${encodeURIComponent(itemId)}/eliminar`,
      },
    ];

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        if (candidate.method === 'DELETE') {
          await httpClient.delete(candidate.path, authenticated);
        } else {
          await httpClient.post(candidate.path, {}, authenticated);
        }
        return;
      } catch (error) {
        lastError = error;
        if (
          error instanceof ApiRequestError &&
          (error.statusCode === 404 || error.statusCode === 405)
        ) {
          continue;
        }
        withLegacyErrorShape(error);
      }
    }

    withLegacyErrorShape(lastError);
  },

  liquidationPreview(
    blocId: string,
    payload: LiquidationPreviewRequest,
  ): Promise<LiquidationPreviewResponse> {
    return postWithFallback(
      [
        `${blocPath(blocId)}/liquidar/preview`,
        `${blocPath(blocId)}/liquidaciones/preview`,
      ],
      payload,
    ).then(unwrapData<LiquidationPreviewResponse>);
  },

  liquidationCommit(
    blocId: string,
    payload: LiquidationCommitRequest,
    idempotencyKey?: string,
  ): Promise<LiquidationCommitResponse> {
    return postWithFallback(
      [
        `${blocPath(blocId)}/liquidar`,
        `${blocPath(blocId)}/liquidaciones/commit`,
      ],
      payload,
      idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    ).then(unwrapData<LiquidationCommitResponse>);
  },

  async listLiquidaciones(blocId: string): Promise<ListLiquidacionesResponse> {
    return unwrapData(await httpClient.get(
      `${blocPath(blocId)}/liquidaciones`,
      { ...authenticated, headers: cacheHeaders },
    ));
  },
};
