import { API_BASE_URL } from '../constants/api';
import { apiRateLimiter } from './apiRateLimiter';
import { sanitizeObjectStrings } from '../utils/fixMojibake';
import type {
  Bloc,
  BlocDetailResponse,
  CreateBlocRequest,
  CreateBlocItemRequest,
  PatchBlocRequest,
  LiquidationCommitRequest,
  LiquidationCommitResponse,
  LiquidationPreviewRequest,
  LiquidationPreviewResponse,
  ListLiquidacionesResponse,
  PatchBlocItemsRequest,
  PatchBlocItemsResponse,
  UpdateBlocItemRequest,
} from '../types/blocs';

function unwrapData<T>(data: any): T {
  return ((data as any)?.data ?? data) as T;
}

async function readErrorMessage(res: Response): Promise<string> {
  let parsed: any = null;
  let textBody: string | null = null;
  try {
    parsed = await res.json().catch(() => null);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    try {
      textBody = await res.text();
    } catch {
      textBody = null;
    }
  }

  const data = sanitizeObjectStrings(parsed ?? {});
  return (
    (data && ((data as any).message || (data as any).msg)) ||
    textBody ||
    `HTTP ${res.status}`
  );
}

class BlocsService {
  async listBlocs(): Promise<Bloc[]> {
    const url = `${API_BASE_URL}/blocs`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: {
        // List should update quickly when creating items; allow short caching.
        'X-Cache-Ttl': String(10_000),
      },
    });

    const raw = await res.json().catch(() => ([]));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      throw new Error((data as any)?.message || 'Error al obtener blocs');
    }

    const normalized = unwrapData<any>(data);
    if (Array.isArray(normalized)) return normalized as Bloc[];
    if (Array.isArray((normalized as any)?.items)) return (normalized as any).items as Bloc[];
    return [];
  }

  async createBloc(payload: CreateBlocRequest): Promise<Bloc> {
    const url = `${API_BASE_URL}/blocs`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await res.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      throw new Error((data as any)?.message || 'Error al crear bloc');
    }

    return unwrapData<Bloc>(data);
  }

  async patchBloc(blocId: string, payload: PatchBlocRequest): Promise<Bloc> {
    const url = `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 204) {
      const detail = await this.getBlocDetail(blocId);
      return detail.bloc;
    }

    const raw = await res.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      throw new Error((data as any)?.message || 'Error al actualizar bloc');
    }

    return unwrapData<Bloc>(data);
  }

  async getBlocDetail(blocId: string): Promise<BlocDetailResponse> {
    const url = `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: {
        'X-Cache-Ttl': String(10_000),
      },
    });

    const raw = await res.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      throw new Error((data as any)?.message || 'Error al obtener detalle del bloc');
    }

    return unwrapData<BlocDetailResponse>(data);
  }

  async createItem(
    blocId: string,
    payload: CreateBlocItemRequest | CreateBlocItemRequest[] | { items: CreateBlocItemRequest[] }
  ): Promise<any> {
    const url = `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}/items`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await res.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      throw new Error((data as any)?.message || 'Error al crear item');
    }

    return unwrapData<any>(data);
  }

  async patchItems(blocId: string, payload: PatchBlocItemsRequest): Promise<PatchBlocItemsResponse> {
    const url = `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}/items`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 204) {
      return { deletedCount: 0, updatedCount: 0, createdCount: 0 };
    }

    const raw = await res.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      const msg = (data as any)?.message || (data as any)?.msg || 'Error al guardar items';
      const err: any = new Error(String(msg));
      err.status = res.status;
      err.body = data;
      throw err;
    }

    return unwrapData<PatchBlocItemsResponse>(data);
  }

  async updateItem(blocId: string, itemId: string, payload: UpdateBlocItemRequest): Promise<any> {
    const url = `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}/items/${encodeURIComponent(itemId)}`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await res.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      throw new Error((data as any)?.message || 'Error al actualizar item');
    }

    return unwrapData<any>(data);
  }

  async deleteItem(blocId: string, itemId: string): Promise<void> {
    const primaryUrl = `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}/items/${encodeURIComponent(itemId)}`;
    const candidates: Array<{ method: 'DELETE' | 'POST'; url: string; body?: any }> = [
      { method: 'DELETE', url: primaryUrl },
      // Fallbacks for older backends that don’t support DELETE
      { method: 'POST', url: `${primaryUrl}/eliminar`, body: {} },
      { method: 'POST', url: `${API_BASE_URL}/blocs/items/${encodeURIComponent(itemId)}/eliminar`, body: {} },
    ];

    let lastRes: Response | null = null;
    for (const c of candidates) {
      const res = await apiRateLimiter.fetch(c.url, {
        method: c.method,
        headers: c.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: c.method === 'POST' ? JSON.stringify(c.body ?? {}) : undefined,
      });

      lastRes = res;
      if (res.ok || res.status === 204) return;

      // If method/route not supported, try the next candidate
      if (res.status === 404 || res.status === 405) continue;

      const msg = await readErrorMessage(res);
      const err: any = new Error(String(msg));
      err.status = res.status;
      throw err;
    }

    if (lastRes) {
      const msg = await readErrorMessage(lastRes);
      const err: any = new Error(String(msg));
      err.status = lastRes.status;
      throw err;
    }

    throw new Error('Error al eliminar item');
  }

  async liquidationPreview(blocId: string, payload: LiquidationPreviewRequest): Promise<LiquidationPreviewResponse> {
    const urls = [
      `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}/liquidar/preview`,
      // backward-compat
      `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}/liquidaciones/preview`,
    ];

    let res: Response | null = null;
    for (const url of urls) {
      const r = await apiRateLimiter.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      res = r;
      if (r.status === 404 || r.status === 405) continue;
      break;
    }

    if (!res) throw new Error('Error al previsualizar liquidación');

    const raw = await res.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      const msg = (data as any)?.message || 'Error al previsualizar liquidación';
      const err: any = new Error(String(msg));
      err.status = res.status;
      err.body = data;
      throw err;
    }

    return unwrapData<LiquidationPreviewResponse>(data);
  }

  async liquidationCommit(blocId: string, payload: LiquidationCommitRequest, opts?: { idempotencyKey?: string }): Promise<LiquidationCommitResponse> {
    const urls = [
      `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}/liquidar`,
      // backward-compat
      `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}/liquidaciones/commit`,
    ];

    let res: Response | null = null;
    for (const url of urls) {
      const r = await apiRateLimiter.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(opts?.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        },
        body: JSON.stringify(payload),
      });
      res = r;
      if (r.status === 404 || r.status === 405) continue;
      break;
    }

    if (!res) throw new Error('Error al confirmar liquidación');

    const raw = await res.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      const msg = (data as any)?.message || 'Error al confirmar liquidación';
      const err: any = new Error(String(msg));
      err.status = res.status;
      err.body = data;
      throw err;
    }

    return unwrapData<LiquidationCommitResponse>(data);
  }

  async listLiquidaciones(blocId: string): Promise<ListLiquidacionesResponse> {
    const url = `${API_BASE_URL}/blocs/${encodeURIComponent(blocId)}/liquidaciones`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: {
        'X-Cache-Ttl': String(10_000),
      },
    });

    const raw = await res.json().catch(() => ([]));
    const data = sanitizeObjectStrings(raw);

    if (!res.ok) {
      throw new Error((data as any)?.message || 'Error al obtener liquidaciones');
    }

    return unwrapData<ListLiquidacionesResponse>(data);
  }
}

export const blocsService = new BlocsService();
