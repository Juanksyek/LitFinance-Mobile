import { API_BASE_URL } from '../constants/api';
import { apiRateLimiter } from './apiRateLimiter';
import { sanitizeObjectStrings } from '../utils/fixMojibake';
import { getLatestMetasSummary, invalidateLatestMetasSummary } from './dashboardSnapshotService';
import type {
  CreateMetaRequest,
  ListMetasParams,
  ListMetasResponse,
  Meta,
  MetaHistorialItem,
  MetaMovimientoRequest,
  MetaOperacionRequest,
  ResolveMetaCompletionRequest,
  ResolveMetaCompletionResponse,
  UpdateMetaRequest,
} from '../types/metas';

function normalizeEstado(s: any): string {
  if (s == null) return '';
  try {
    const str = String(s).toLowerCase().trim();
    // remove accents
    const noAcc = str.normalize ? str.normalize('NFD').replace(/\p{Diacritic}/gu, '') : str;
    // map common synonyms
    if (noAcc === 'completada' || noAcc === 'completado' || noAcc === 'completa') return 'cumplida';
    return noAcc;
  } catch {
    return String(s).toLowerCase();
  }
}

function matchesEstado(itemEstado: any, filterKey: string | undefined) {
  if (!filterKey) return true;
  const ie = normalizeEstado(itemEstado);
  const fk = normalizeEstado(filterKey);
  if (fk === 'todas' || fk === '') return true;
  if (fk === 'activa' || fk === 'activos' || fk === 'activo') return ie.startsWith('act');
  if (fk === 'pausada' || fk === 'pausado' || fk === 'pausados') return ie.startsWith('paus');
  if (fk === 'cumplida' || fk === 'cumplido') return ie.includes('cumpl') || ie.includes('complet');
  if (fk === 'archivada' || fk === 'archivado' || fk === 'archiv') return ie.startsWith('arch');
  return ie === fk;
}

function normalizeText(s: any): string {
  if (s == null) return '';
  try {
    const str = String(s).toLowerCase().trim();
    return str.normalize ? str.normalize('NFD').replace(/\p{Diacritic}/gu, '') : str;
  } catch {
    return String(s).toLowerCase();
  }
}

function unwrapMetaPayload(payload: any): any {
  if (payload == null) return payload;
  // Common API shapes: { data: Meta }, { data: { meta: Meta } }, { meta: Meta }
  const d1 = payload?.data ?? payload;
  const d2 = d1?.data ?? d1;
  return d2?.meta ?? d1?.meta ?? d2;
}

function summaryToMeta(m: any): Meta {
  const metaId = String(m?.metaId ?? m?.id ?? '');
  // Best-effort mapping from dashboard metasSummary items to Meta shape.
  return {
    metaId,
    nombre: String(m?.nombre ?? ''),
    moneda: String(m?.moneda ?? 'MXN'),
    estado: (m?.estado ?? 'activa') as any,
    mode: m?.mode,
    objetivo: typeof m?.objetivo === 'number' ? m.objetivo : undefined,
    progreso: typeof m?.progreso === 'number' ? m.progreso : undefined,
    saldoActual: typeof m?.saldoActual === 'number' ? m.saldoActual : (typeof m?.saldo === 'number' ? m.saldo : undefined),
    subcuentaId: (m?.legacySubcuentaId ?? m?.subcuentaId ?? undefined) as any,
    updatedAt: m?.updatedAt ?? undefined,
  };
}

function toBackendEstadoParam(estado: any): string | undefined {
  const e = normalizeEstado(estado);
  if (!e || e === 'todas') return undefined;
  // Backend expects `completada` while UI uses `cumplida`.
  if (e === 'cumplida') return 'completada';
  return e;
}

function toListResponse(raw: any): ListMetasResponse {
  // Prefer authoritative pagination shape: { total, page, limit, data }
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.data) && (typeof raw.total === 'number' || typeof raw.page === 'number' || typeof raw.limit === 'number')) {
      return {
        items: raw.data as Meta[],
        total: typeof raw.total === 'number' ? raw.total : undefined,
        page: typeof raw.page === 'number' ? raw.page : undefined,
        limit: typeof raw.limit === 'number' ? raw.limit : undefined,
      };
    }
  }

  const normalized = raw?.data ?? raw;
  if (normalized && typeof normalized === 'object') {
    if (Array.isArray((normalized as any).data) && (typeof (normalized as any).total === 'number' || typeof (normalized as any).page === 'number' || typeof (normalized as any).limit === 'number')) {
      return {
        items: (normalized as any).data as Meta[],
        total: typeof (normalized as any).total === 'number' ? (normalized as any).total : undefined,
        page: typeof (normalized as any).page === 'number' ? (normalized as any).page : undefined,
        limit: typeof (normalized as any).limit === 'number' ? (normalized as any).limit : undefined,
      };
    }
    if (Array.isArray((normalized as any).items)) return normalized as ListMetasResponse;
    if (Array.isArray((normalized as any).metas)) return { items: (normalized as any).metas as Meta[] };
  }

  if (Array.isArray(normalized)) return { items: normalized as Meta[] };
  return { items: [] };
}

const METAS_LIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5min
const META_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000; // 5min
const META_HISTORIAL_CACHE_TTL_MS = 5 * 60 * 1000; // 5min

class MetasService {
  // Temporary debug toggle for metas operations
  private DEBUG = false;

  private async tryFetchFirstOk(urls: string[], init: RequestInit): Promise<Response> {
    let lastResponse: Response | null = null;
    for (const url of urls) {
      const res = await apiRateLimiter.fetch(url, init);
      // If endpoint doesn't exist / not allowed, try next.
      if (res.status === 404 || res.status === 405) {
        lastResponse = res;
        continue;
      }
      return res;
    }
    return lastResponse ?? apiRateLimiter.fetch(urls[0], init);
  }
  async listMetas(params: ListMetasParams = {}): Promise<ListMetasResponse> {
    const query = new URLSearchParams();
    const backendEstado = toBackendEstadoParam(params.estado);
    if (backendEstado) query.set('estado', String(backendEstado));
    if (typeof params.page === 'number') query.set('page', String(params.page));
    if (typeof params.limit === 'number') query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);

    const url = `${API_BASE_URL}/metas${query.toString() ? `?${query.toString()}` : ''}`;

    if (this.DEBUG) {
      try {
        console.debug('[MetasService] listMetas -> url:', url, 'params:', params);
      } catch {
        // ignore logging errors
      }
    }

    // If we have a cached metasSummary from the dashboard snapshot and this is the first page,
    // return it immediately to avoid empty-list UX and rate-limit spikes.
    // IMPORTANT: only return cached data if it matches the filter/search and has content.
    try {
      if ((params.page ?? 1) === 1) {
        const cached = getLatestMetasSummary();
        if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
          const searchNeedle = normalizeText(params.search);
          const filtered = cached.data
            .filter((m: any) => {
              if (!params.estado) return true;
              const wanted = normalizeEstado(params.estado);
              if (wanted === 'cumplida') {
                // Include completion-based metas even if estado isn't updated yet.
                const c = (m as any)?.completion?.isCompleted;
                const completionDone = c === true || c === 1 || String(c).toLowerCase() === 'true' || String(c) === '1';
                if (completionDone) return true;
              }
              return matchesEstado((m as any).estado, String(params.estado));
            })
            .filter((m: any) => {
              if (!searchNeedle) return true;
              return normalizeText((m as any).nombre).includes(searchNeedle);
            });

          // Only return cached immediate response if it has content. Otherwise fall back to network.
          if (filtered.length > 0) {
            const usingSubset = !!params.estado || !!params.search;
            const resp: ListMetasResponse = {
              items: filtered.map(summaryToMeta),
              page: 1,
              limit: params.limit ?? cached.limit ?? 10,
              // If we're returning a subset (filtered/search), we *must not* reuse cached.total
              // or pagination will keep requesting more pages incorrectly.
              total: usingSubset ? filtered.length : (cached.total ?? filtered.length),
            };

            // Best-effort background refresh (doesn't update UI directly, but refreshes rateLimiter cache)
            (async () => {
              try {
                await apiRateLimiter.fetch(url, {
                  method: 'GET',
                  headers: { 'X-Cache-Ttl': String(METAS_LIST_CACHE_TTL_MS) } as any,
                });
              } catch {
                // ignore
              }
            })();

            return resp;
          }
        }
      }
    } catch (e) {
      // ignore cache-read errors and continue to network fetch
      try { console.debug('[MetasService] failed reading latest metasSummary cache', e); } catch {}
    }

    const fetchList = async (fetchUrl: string) => {
      const response = await apiRateLimiter.fetch(fetchUrl, {
        method: 'GET',
        headers: {
          // Cache para mitigar 429; se invalida automáticamente tras mutaciones (/metas*)
          'X-Cache-Ttl': String(METAS_LIST_CACHE_TTL_MS),
        },
      });

      const raw = await response.json().catch(() => ({}));
      const data = sanitizeObjectStrings(raw);

      return { response, data };
    };

    let { response, data } = await fetchList(url);

    if (this.DEBUG) {
      try {
        console.debug(
          '[MetasService] listMetas response status:',
          response.status,
          'bodyKeys:',
          data && typeof data === 'object' ? Object.keys(data) : typeof data,
          'itemsLength:',
          Array.isArray((data as any)?.items) ? (data as any).items.length : Array.isArray(data) ? data.length : 0
        );
      } catch {
        // ignore
      }
    }

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Error al obtener metas');
    }

    // Some backends expect `estado=cumplida` instead of `completada`.
    // If the user requested completed metas and the server returns an empty list,
    // retry with the alternate estado to avoid a blank completed tab.
    try {
      if (backendEstado === 'completada') {
        const parsed = toListResponse(data);
        const hasItems = Array.isArray(parsed.items) && parsed.items.length > 0;
        if (!hasItems) {
          const altQuery = new URLSearchParams(query.toString());
          altQuery.set('estado', 'cumplida');
          const altUrl = `${API_BASE_URL}/metas${altQuery.toString() ? `?${altQuery.toString()}` : ''}`;
          const alt = await fetchList(altUrl);
          if (alt.response.ok) {
            const altParsed = toListResponse(alt.data);
            if (Array.isArray(altParsed.items) && altParsed.items.length > 0) {
              response = alt.response;
              data = alt.data;
            }
          }
        }
      }
    } catch {
      // ignore fallback errors
    }

    return toListResponse(data);
  }

  async getMetaDetail(metaId: string): Promise<Meta> {
    const url = `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}`;

    const response = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: {
        'X-Cache-Ttl': String(META_DETAIL_CACHE_TTL_MS),
      },
    });

    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Error al obtener detalle de meta');
    }

    return unwrapMetaPayload(data) as Meta;
  }

  async createMeta(payload: CreateMetaRequest): Promise<Meta> {
    if (this.DEBUG) {
      try {
        console.debug('[MetasService] createMeta payload:', JSON.stringify(payload));
      } catch {
        console.debug('[MetasService] createMeta payload (unserializable)');
      }
    }
    const url = `${API_BASE_URL}/metas`;

    const response = await apiRateLimiter.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await response.json().catch(() => ({}));
    if (this.DEBUG) {
      try {
        console.debug('[MetasService] createMeta response status:', response.status);
        console.debug('[MetasService] createMeta response body:', JSON.stringify(raw));
      } catch {
        console.debug('[MetasService] createMeta response (unserializable)');
      }
    }
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Error al crear meta');
    }

    // Snapshot metasSummary cache is now stale
    invalidateLatestMetasSummary().catch(() => null);

    return unwrapMetaPayload(data) as Meta;
  }

  async updateMeta(metaId: string, payload: UpdateMetaRequest): Promise<Meta> {
    const url = `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}`;

    const response = await apiRateLimiter.fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Error al actualizar meta');
    }

    invalidateLatestMetasSummary().catch(() => null);

    return unwrapMetaPayload(data) as Meta;
  }

  async aportar(metaId: string, payload: MetaMovimientoRequest): Promise<Meta> {
    // Prefer legacy compatibility endpoint names (backend may expose either singular or plural).
    const urls = [
      `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/aporte`,
      `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/aportes`,
    ];

    const response = await this.tryFetchFirstOk(urls, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Error al aportar');
    }

    invalidateLatestMetasSummary().catch(() => null);

    return unwrapMetaPayload(data) as Meta;
  }

  async retirar(metaId: string, payload: MetaMovimientoRequest): Promise<Meta> {
    const urls = [
      `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/retiro`,
      `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/retiros`,
    ];

    const response = await this.tryFetchFirstOk(urls, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Error al retirar');
    }

    invalidateLatestMetasSummary().catch(() => null);

    return unwrapMetaPayload(data) as Meta;
  }

  // New preferred endpoints: ingreso / egreso
  async ingreso(metaId: string, payload: MetaOperacionRequest): Promise<any> {
    const url = `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/ingreso`;

    const response = await apiRateLimiter.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      const err: any = new Error((data as any)?.message || 'Error al realizar ingreso');
      err.status = response.status;
      err.body = data;
      throw err;
    }

    invalidateLatestMetasSummary().catch(() => null);

    return ((data as any)?.data ?? data);
  }

  async egreso(metaId: string, payload: MetaOperacionRequest): Promise<any> {
    const url = `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/egreso`;

    const response = await apiRateLimiter.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      const err: any = new Error((data as any)?.message || 'Error al realizar egreso');
      err.status = response.status;
      err.body = data;
      throw err;
    }

    invalidateLatestMetasSummary().catch(() => null);

    return ((data as any)?.data ?? data);
  }

  async getHistorial(metaId: string, params?: { page?: number; limit?: number }): Promise<MetaHistorialItem[]> {
    const query = new URLSearchParams();
    if (typeof params?.page === 'number') query.set('page', String(params.page));
    if (typeof params?.limit === 'number') query.set('limit', String(params.limit));
    const url = `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/historial${query.toString() ? `?${query.toString()}` : ''}`;

    const response = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: {
        'X-Cache-Ttl': String(META_HISTORIAL_CACHE_TTL_MS),
      },
    });

    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Error al obtener historial');
    }

    const normalized = (data as any)?.data ?? data;
    if (Array.isArray(normalized)) return normalized as MetaHistorialItem[];
    if (Array.isArray(normalized?.items)) return normalized.items as MetaHistorialItem[];
    return [];
  }

  async cambiarEstado(metaId: string, estado: string): Promise<Meta> {
    // Mirrors support-tickets status style.
    const url = `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/status`;

    const response = await apiRateLimiter.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });

    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      throw new Error((data as any)?.message || 'Error al actualizar estado');
    }

    invalidateLatestMetasSummary().catch(() => null);

    return ((data as any)?.data ?? data) as Meta;
  }

  // New preferred status endpoints (with fallback to legacy /status)
  async pausar(metaId: string): Promise<Meta> {
    const urls = [
      `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/pausar`,
    ];
    const response = await this.tryFetchFirstOk(urls, { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
    if (response.status === 404 || response.status === 405) {
      return this.cambiarEstado(metaId, 'pausada');
    }
    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);
    if (!response.ok) throw new Error((data as any)?.message || 'Error al pausar');
    invalidateLatestMetasSummary().catch(() => null);
    return ((data as any)?.data ?? data) as Meta;
  }

  async reanudar(metaId: string): Promise<Meta> {
    const urls = [
      `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/reanudar`,
    ];
    const response = await this.tryFetchFirstOk(urls, { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
    if (response.status === 404 || response.status === 405) {
      return this.cambiarEstado(metaId, 'activa');
    }
    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);
    if (!response.ok) throw new Error((data as any)?.message || 'Error al reanudar');
    invalidateLatestMetasSummary().catch(() => null);
    return ((data as any)?.data ?? data) as Meta;
  }

  async archivar(metaId: string): Promise<Meta> {
    const urls = [
      `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/archivar`,
    ];
    const response = await this.tryFetchFirstOk(urls, { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
    if (response.status === 404 || response.status === 405) {
      // Best-effort fallback for older backends
      return this.cambiarEstado(metaId, 'archivada');
    }
    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);
    if (!response.ok) throw new Error((data as any)?.message || 'Error al archivar');
    invalidateLatestMetasSummary().catch(() => null);
    return ((data as any)?.data ?? data) as Meta;
  }

  async deleteMeta(metaId: string): Promise<any> {
    // Spec: DELETE /metas/:metaId
    const url = `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}`;

    const response = await apiRateLimiter.fetch(url, {
      method: 'DELETE',
    });

    // Try JSON first, otherwise text (Express default 404s sometimes return plain text)
    let parsed: any = null;
    let textBody: string | null = null;
    try { parsed = await response.json().catch(() => null); } catch { parsed = null; }
    if (!parsed) {
      try { textBody = await response.text(); } catch { textBody = null; }
    }

    const data = sanitizeObjectStrings(parsed ?? {});
    if (!response.ok) {
      const serverMessage = (data && (data.message || (data as any).msg)) || textBody || `HTTP ${response.status}`;
      const err: any = new Error(String(serverMessage));
      err.status = response.status;
      throw err;
    }

    invalidateLatestMetasSummary().catch(() => null);
    return ((data as any)?.data ?? parsed ?? { message: textBody });
  }

  async resolveCompletion(metaId: string, payload: ResolveMetaCompletionRequest): Promise<ResolveMetaCompletionResponse> {
    const url = `${API_BASE_URL}/metas/${encodeURIComponent(metaId)}/completion/resolve`;

    const response = await apiRateLimiter.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await response.json().catch(() => ({}));
    const data = sanitizeObjectStrings(raw);

    if (!response.ok) {
      const err: any = new Error((data as any)?.message || 'No se pudo resolver la decisión');
      err.status = response.status;
      err.body = data;
      throw err;
    }

    invalidateLatestMetasSummary().catch(() => null);
    return ((data as any)?.data ?? data) as ResolveMetaCompletionResponse;
  }
}

export const metasService = new MetasService();
export default metasService;
