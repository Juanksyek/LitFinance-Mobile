import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRateLimiter } from './apiRateLimiter';
import { API_BASE_URL } from '../constants/api';
import { getLatestSharedSpacesSummary, getLatestSharedSpacesSummaryFromStorage } from './dashboardSnapshotService';
import { userProfileService } from './userProfileService';
import type {
  SharedSpace,
  SharedSpaceMember,
  SharedInvitation,
  SharedMovement,
  SharedMovementDetail,
  SharedCategory,
  SharedSplitRule,
  SharedNotification,
  SpaceAnalyticsSummary,
  MemberAnalytics,
  CategoryAnalytics,
  SpaceBalance,
  TrendPoint,
  AccountImpactResult,
  PaginatedResponse,
  CreateSpaceDTO,
  UpdateSpaceDTO,
  CreateMovementDTO,
  InviteMemberDTO,
  CreateCategoryDTO,
  CreateRuleDTO,
} from '../types/sharedSpaces';

const SHARED_BASE = `${API_BASE_URL}/shared`;
async function getSharedSpacesCacheKey(): Promise<string> {
  try {
    const profile = await userProfileService.getCachedProfile();
    const userId = profile?.id ?? 'anon';
    return `sharedSpaces:latest:${userId}`;
  } catch {
    return `sharedSpaces:latest:anon`;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.message ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function saveSpacesCache(spaces: SharedSpace[]): Promise<void> {
  try {
    const key = await getSharedSpacesCacheKey();
    await AsyncStorage.setItem(key, JSON.stringify(spaces));
  } catch {
    // ignore cache failures
  }
}

async function getSpacesCache(): Promise<SharedSpace[]> {
  try {
    const key = await getSharedSpacesCacheKey();
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((space) => normalizeSpace(space))
      .filter((space): space is SharedSpace => Boolean(space));
  } catch {
    return [];
  }
}

function normalizeSpaceStatus(value: any): SharedSpace['estado'] {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'archivado' || raw === 'archived') return 'archivado';
  return 'activo';
}

function normalizeSpaceType(value: any): SharedSpace['tipo'] {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'pareja' || raw === 'grupo' || raw === 'viaje' || raw === 'familia' || raw === 'custom') {
    return raw;
  }
  return 'grupo';
}

function defaultConfig(): SharedSpace['configuracion'] {
  return {
    splitDefaultMode: 'equal',
    allowAccountImpact: true,
    maxMembers: 10,
    requireApproval: false,
    allowCategories: true,
    allowRecurring: true,
  };
}

function normalizeSpace(raw: any): SharedSpace | null {
  if (!raw || typeof raw !== 'object') return null;

  const spaceId = raw.spaceId ?? raw.id ?? raw._id ?? raw.space_id ?? raw.space?.spaceId ?? null;
  if (!spaceId) return null;

  return {
    spaceId: String(spaceId),
    ownerUserId: String(raw.ownerUserId ?? raw.owner_user_id ?? raw.ownerId ?? raw.createdByUserId ?? ''),
    nombre: String(raw.nombre ?? raw.name ?? raw.spaceName ?? 'Espacio compartido'),
    tipo: normalizeSpaceType(raw.tipo ?? raw.type),
    monedaBase: String(raw.monedaBase ?? raw.baseCurrency ?? raw.currency ?? 'MXN'),
    estado: normalizeSpaceStatus(raw.estado ?? raw.status),
    configuracion: raw.configuracion ?? raw.configuration ?? raw.config ?? defaultConfig(),
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? raw.createdAt ?? new Date().toISOString()),
  };
}

function normalizeMember(raw: any): SharedSpaceMember | null {
  if (!raw || typeof raw !== 'object') return null;
  const memberId = raw.memberId ?? raw.id ?? raw._id ?? null;
  const spaceId = raw.spaceId ?? raw.space_id ?? '';
  const userId = raw.userId ?? raw.user_id ?? '';
  if (!memberId || !userId) return null;

  const roleRaw = String(raw.rol ?? raw.role ?? 'member').trim().toLowerCase();
  const rol: SharedSpaceMember['rol'] = roleRaw === 'owner' || roleRaw === 'admin' ? roleRaw : 'member';

  const statusRaw = String(raw.estado ?? raw.status ?? 'active').trim().toLowerCase();
  const estado: SharedSpaceMember['estado'] =
    statusRaw === 'invited' || statusRaw === 'left' || statusRaw === 'removed' ? statusRaw : 'active';

  return {
    memberId: String(memberId),
    spaceId: String(spaceId),
    userId: String(userId),
    rol,
    estado,
    alias: String(raw.alias ?? ''),
    nombreCompleto: raw.nombreCompleto ?? raw.fullName ?? raw.nombre ?? raw.name ?? '',
    joinedAt: raw.joinedAt ?? raw.joined_at,
    leftAt: raw.leftAt ?? raw.left_at,
  };
}

// ── In-memory cache to reduce API calls ─────────────────────────────────────

const _memCache: Record<string, { data: any; ts: number }> = {};
const MEM_CACHE_TTL = 20_000; // 20 seconds

function getMemCache<T>(key: string): T | null {
  const entry = _memCache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > MEM_CACHE_TTL) {
    delete _memCache[key];
    return null;
  }
  return entry.data as T;
}

function setMemCache(key: string, data: any): void {
  _memCache[key] = { data, ts: Date.now() };
}

/** Invalidate in-memory cache for a specific space or all spaces */
export function invalidateSpaceCache(spaceId?: string): void {
  if (spaceId) {
    for (const key of Object.keys(_memCache)) {
      if (key.includes(spaceId)) delete _memCache[key];
    }
  } else {
    for (const key of Object.keys(_memCache)) delete _memCache[key];
  }
}

function extractSpacesPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.spaces)) return payload.spaces;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.sharedSpaces)) return payload.sharedSpaces;
  if (payload.sharedSpacesSummary && Array.isArray(payload.sharedSpacesSummary.spaces)) {
    return payload.sharedSpacesSummary.spaces;
  }
  return [];
}

async function getSpacesFromSnapshotFallback(): Promise<SharedSpace[]> {
  const latest = getLatestSharedSpacesSummary() ?? (await getLatestSharedSpacesSummaryFromStorage());
  const summarySpaces = Array.isArray(latest?.spaces) ? latest!.spaces : [];
  return summarySpaces
    .map((space) => normalizeSpace(space))
    .filter((space): space is SharedSpace => Boolean(space));
}

/**
 * Returns the latest shared spaces summary from the dashboard snapshot cache.
 * Useful for quick UI rendering without extra API calls.
 */
export async function getSnapshotSpacesSummary(): Promise<import('../types/sharedSpaces').SharedSpacesSummary | null> {
  const latest = getLatestSharedSpacesSummary() ?? (await getLatestSharedSpacesSummaryFromStorage());
  return latest ?? null;
}

async function getCachedSpaceById(spaceId: string): Promise<SharedSpace | null> {
  const fromCache = (await getSpacesCache()).find((space) => String(space.spaceId) === String(spaceId));
  if (fromCache) return fromCache;

  const fromSnapshot = (await getSpacesFromSnapshotFallback()).find((space) => String(space.spaceId) === String(spaceId));
  return fromSnapshot ?? null;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// ── Spaces CRUD ─────────────────────────────────────────────────────────────

export async function createSpace(dto: CreateSpaceDTO): Promise<{ space: SharedSpace; ownerMember: SharedSpaceMember }> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const payload = await jsonOrThrow<{ space: SharedSpace; ownerMember: SharedSpaceMember }>(res);
  const normalizedSpace = normalizeSpace(payload?.space);
  if (normalizedSpace) {
    const cached = await getSpacesCache();
    await saveSpacesCache([normalizedSpace, ...cached.filter((space) => space.spaceId !== normalizedSpace.spaceId)]);
    return { ...payload, space: normalizedSpace };
  }
  return payload;
}

export async function listSpaces(): Promise<SharedSpace[]> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces`, {
    headers: { 'X-Skip-Cache': '1' }, // bypass client cache for debugging
  });
  // Log raw response body to help diagnose empty-list issues
  try {
    const txt = await res.clone().text();
    console.log('🔍 [SharedSpacesService] listSpaces raw response:', txt);
  } catch (e) {
    console.warn('🔍 [SharedSpacesService] Failed to read listSpaces response text', e);
  }
  const payload = await jsonOrThrow<any>(res);
  const normalized = extractSpacesPayload(payload)
    .map((space) => normalizeSpace(space))
    .filter((space): space is SharedSpace => Boolean(space));

  if (normalized.length > 0) {
    await saveSpacesCache(normalized);
    return normalized;
  }

  const snapshotFallback = await getSpacesFromSnapshotFallback();
  if (snapshotFallback.length > 0) {
    console.log('🛟 [SharedSpacesService] Using dashboard snapshot fallback for shared spaces:', snapshotFallback.length);
    await saveSpacesCache(snapshotFallback);
    return snapshotFallback;
  }

  const cachedFallback = await getSpacesCache();
  if (cachedFallback.length > 0) {
    console.log('🛟 [SharedSpacesService] Using local cached fallback for shared spaces:', cachedFallback.length);
    return cachedFallback;
  }

  return normalized;
}

export async function getSpaceDetail(spaceId: string): Promise<{ space: SharedSpace; members: SharedSpaceMember[] }> {
  // Check in-memory cache first to avoid duplicate API calls
  const cacheKey = `detail:${spaceId}`;
  const memCached = getMemCache<{ space: SharedSpace; members: SharedSpaceMember[] }>(cacheKey);
  if (memCached) return memCached;

  try {
    const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}`, {
      headers: { 'X-Skip-Cache': '1' },
    });
    const payload = await jsonOrThrow<any>(res);
    const rawSpace = payload?.space ?? payload?.data?.space ?? payload?.data ?? payload;
    const rawMembers = payload?.members ?? payload?.data?.members ?? [];

    const space = normalizeSpace(rawSpace);
    const members = Array.isArray(rawMembers)
      ? rawMembers.map((member) => normalizeMember(member)).filter((member): member is SharedSpaceMember => Boolean(member))
      : [];

    if (space) {
      const result = { space, members };
      setMemCache(cacheKey, result);
      const cached = await getSpacesCache();
      await saveSpacesCache([space, ...cached.filter((item) => item.spaceId !== space.spaceId)]);
      return result;
    }

    throw new Error('Espacio no encontrado');
  } catch (error) {
    const fallbackSpace = await getCachedSpaceById(spaceId);
    if (fallbackSpace) {
      console.log('🛟 [SharedSpacesService] Using cached fallback for space detail:', spaceId);
      return { space: fallbackSpace, members: [] };
    }
    throw error;
  }
}

export async function updateSpace(spaceId: string, dto: UpdateSpaceDTO): Promise<SharedSpace> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function archiveSpace(spaceId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}`, { method: 'DELETE' });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

// ── Invitations ─────────────────────────────────────────────────────────────

export async function sendInvitation(spaceId: string, dto: InviteMemberDTO): Promise<SharedInvitation> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function listSpaceInvitations(spaceId: string): Promise<SharedInvitation[]> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/invitations`);
  return jsonOrThrow(res);
}

export async function getPendingInvitations(): Promise<SharedInvitation[]> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/invitations/pending`, {
    headers: { 'X-Skip-Cache': '1' },
  });
  try {
    const txt = await res.clone().text();
    console.log('🔍 [SharedSpacesService] getPendingInvitations raw response:', txt);
  } catch (e) {
    console.warn('🔍 [SharedSpacesService] Failed to read getPendingInvitations response text', e);
  }
  return jsonOrThrow(res);
}

export async function acceptInvitation(invitationId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/invitations/${invitationId}/accept`, { method: 'POST' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

export async function rejectInvitation(invitationId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/invitations/${invitationId}/reject`, { method: 'POST' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

export async function verifyInvitationToken(token: string): Promise<any> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/invitations/verify?token=${encodeURIComponent(token)}`, {
    headers: { 'X-Skip-Cache': '1' },
  });
  return jsonOrThrow(res);
}

export async function acceptInvitationByToken(token: string): Promise<{ message: string; spaceId: string; spaceName: string }> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/invitations/accept-by-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return jsonOrThrow(res);
}

export async function getInvitationQrData(spaceId: string, invitationId: string): Promise<{ invitationId: string; shareUrl: string; deepLink: string; expiresAt: string; multiUse: boolean; maxUses: number | null }> {
  const res = await apiRateLimiter.fetch(
    `${SHARED_BASE}/spaces/${spaceId}/invitations/${invitationId}/qr`,
    { headers: { 'X-Skip-Cache': '1' } }
  );
  return jsonOrThrow(res);
}

/**
 * Genera una invitación de tipo QR/enlace de forma robusta.
 *
 * Estrategia (sin usar el endpoint /qr que puede no existir):
 * 1. Intenta con invitationType:'link' sin email (backend nuevo).
 * 2. Si el backend rechaza por falta de email/invitedUserId, envía
 *    la petición con un email placeholder para obtener invitationId,
 *    y usa el shareUrl que viene en la respuesta directamente.
 * 3. Si la respuesta tampoco trae shareUrl, construye la URL a partir
 *    del invitationId con el patrón conocido de LitFinance.
 */
export async function createQRInvitation(
  spaceId: string,
  opts: {
    rol?: string;
    message?: string;
    multiUse?: boolean;
    maxUses?: number;
  }
): Promise<{ invitationId?: string; shareUrl: string; deepLink: string; expiresAt: string; multiUse: boolean; maxUses: number | null }> {
  // ── Intentar flujo directo (backend nuevo) ───────────────────────────────
  try {
    const result = await sendInvitation(spaceId, {
      invitationType: 'link',
      rol: opts.rol as any,
      message: opts.message,
      multiUse: opts.multiUse,
      maxUses: opts.maxUses,
    });
    if (result.shareUrl) {
      return {
        invitationId: (result as any).invitationId ?? undefined,
        shareUrl: result.shareUrl,
        deepLink: result.deepLink ?? result.shareUrl,
        expiresAt: result.expiresAt,
        multiUse: result.multiUse ?? opts.multiUse ?? false,
        maxUses: (result as any).maxUses ?? opts.maxUses ?? null,
      };
    }
  } catch (err: any) {
    const msg: string = (err?.message ?? '').toLowerCase();
    const isValidationError =
      msg.includes('inviteduserid') ||
      msg.includes('email') ||
      msg.includes('proporcionar');
    if (!isValidationError) throw err;
    // Continúa al flujo de respaldo
  }

  // ── Flujo de respaldo (backend antiguo requiere email) ───────────────────
  // Pasar invitationType:'link' junto al email para que el backend devuelva shareUrl
  const placeholderEmail = `qr-${spaceId.slice(-8)}-${Date.now()}@noreply.litfinance.internal`;
  let invitation: SharedInvitation;
  try {
    invitation = await sendInvitation(spaceId, {
      email: placeholderEmail,
      invitationType: 'link',
      rol: opts.rol as any,
      message: opts.message,
      multiUse: opts.multiUse,
      maxUses: opts.maxUses,
    });
  } catch {
    // Si 'link' sigue fallando con email, intentar invitación email normal
    invitation = await sendInvitation(spaceId, {
      email: placeholderEmail,
      rol: opts.rol as any,
      message: opts.message,
    });
  }

  // Usar shareUrl de la respuesta si está disponible
  if (invitation.shareUrl) {
    return {
      invitationId: invitation.invitationId,
      shareUrl: invitation.shareUrl,
      deepLink: invitation.deepLink ?? invitation.shareUrl,
      expiresAt: invitation.expiresAt,
      multiUse: invitation.multiUse ?? opts.multiUse ?? false,
      maxUses: (invitation as any).maxUses ?? opts.maxUses ?? null,
    };
  }

  // Construir shareUrl sintético a partir del invitationId (último recurso)
  const shareUrl = `https://litfinance.app/invite/${invitation.invitationId}`;
  return {
    invitationId: invitation.invitationId,
    shareUrl,
    deepLink: `litfinance://invite/${invitation.invitationId}`,
    expiresAt: invitation.expiresAt,
    multiUse: invitation.multiUse ?? opts.multiUse ?? false,
    maxUses: (invitation as any).maxUses ?? opts.maxUses ?? null,
  };
}

export async function revokeInvitation(spaceId: string, invitationId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/invitations/${invitationId}/revoke`, { method: 'POST' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

// ── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(spaceId: string): Promise<SharedSpaceMember[]> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/members`);
  return jsonOrThrow(res);
}

export async function changeMemberRole(spaceId: string, memberId: string, rol: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/members/${memberId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rol }),
  });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

export async function removeMember(spaceId: string, memberId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/members/${memberId}/remove`, { method: 'POST' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

export async function leaveSpace(spaceId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/leave`, { method: 'POST' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

// ── Movements ───────────────────────────────────────────────────────────────

export async function createMovement(spaceId: string, dto: CreateMovementDTO): Promise<SharedMovementDetail & { idempotent?: boolean }> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function listMovements(
  spaceId: string,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    tipo?: string;
    estado?: string;
    categoryId?: string;
    from?: string;
    to?: string;
    createdBy?: string;
    hasAccountImpact?: string;
  },
): Promise<PaginatedResponse<SharedMovement>> {
  const q = qs(params ?? {});
  const cacheKey = `movements:${spaceId}${q}`;
  const memCached = getMemCache<PaginatedResponse<SharedMovement>>(cacheKey);
  if (memCached) return memCached;

  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/movements${q}`);
  const result = await jsonOrThrow<PaginatedResponse<SharedMovement>>(res);
  setMemCache(cacheKey, result);
  return result;
}

export async function getMovementDetail(spaceId: string, movementId: string): Promise<SharedMovementDetail> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/movements/${movementId}`);
  return jsonOrThrow(res);
}

export async function updateMovement(
  spaceId: string,
  movementId: string,
  dto: Partial<CreateMovementDTO>,
): Promise<SharedMovementDetail> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/movements/${movementId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function cancelMovement(spaceId: string, movementId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/movements/${movementId}/cancel`, { method: 'POST' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

export async function duplicateMovement(spaceId: string, movementId: string): Promise<SharedMovementDetail> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/movements/${movementId}/duplicate`, { method: 'POST' });
  return jsonOrThrow(res);
}

// ── Split Rules ─────────────────────────────────────────────────────────────

export async function createRule(spaceId: string, dto: CreateRuleDTO): Promise<SharedSplitRule> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function listRules(spaceId: string): Promise<SharedSplitRule[]> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/rules`);
  return jsonOrThrow(res);
}

export async function updateRule(spaceId: string, ruleId: string, dto: Partial<CreateRuleDTO>): Promise<SharedSplitRule> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/rules/${ruleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function archiveRule(spaceId: string, ruleId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/rules/${ruleId}`, { method: 'DELETE' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function createCategory(spaceId: string, dto: CreateCategoryDTO): Promise<SharedCategory> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function listCategories(spaceId: string): Promise<SharedCategory[]> {
  const cacheKey = `categories:${spaceId}`;
  const memCached = getMemCache<SharedCategory[]>(cacheKey);
  if (memCached) return memCached;

  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/categories`);
  const result = await jsonOrThrow<SharedCategory[]>(res);
  setMemCache(cacheKey, result);
  return result;
}

export async function updateCategory(spaceId: string, categoryId: string, dto: Partial<CreateCategoryDTO>): Promise<SharedCategory> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/categories/${categoryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  return jsonOrThrow(res);
}

export async function archiveCategory(spaceId: string, categoryId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/categories/${categoryId}`, { method: 'DELETE' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

// ── Account Impact ──────────────────────────────────────────────────────────

export async function getMovementImpacts(spaceId: string, movementId: string): Promise<AccountImpactResult[]> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/movements/${movementId}/impact`);
  return jsonOrThrow(res);
}

export async function revertMovementImpacts(spaceId: string, movementId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/movements/${movementId}/impact/revert`, { method: 'POST' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

export async function resyncImpact(impactId: string, body: { spaceId: string; newAmount: number; movementTitle?: string }): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/impact/${impactId}/resync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

// ── Analytics ───────────────────────────────────────────────────────────────

export async function getAnalyticsSummary(spaceId: string, from?: string, to?: string): Promise<SpaceAnalyticsSummary> {
  const q = qs({ from, to });
  const cacheKey = `analytics:${spaceId}${q}`;
  const memCached = getMemCache<SpaceAnalyticsSummary>(cacheKey);
  if (memCached) return memCached;

  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/analytics/summary${q}`);
  const result = await jsonOrThrow<SpaceAnalyticsSummary>(res);
  setMemCache(cacheKey, result);
  return result;
}

export async function getAnalyticsByMember(spaceId: string, from?: string, to?: string): Promise<MemberAnalytics[]> {
  const q = qs({ from, to });
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/analytics/by-member${q}`);
  return jsonOrThrow(res);
}

export async function getAnalyticsByCategory(spaceId: string, from?: string, to?: string): Promise<CategoryAnalytics[]> {
  const q = qs({ from, to });
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/analytics/by-category${q}`);
  return jsonOrThrow(res);
}

export async function getAnalyticsTrends(spaceId: string, from?: string, to?: string, groupBy?: 'day' | 'week' | 'month'): Promise<TrendPoint[]> {
  const q = qs({ from, to, groupBy });
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/analytics/trends${q}`);
  return jsonOrThrow(res);
}

export async function getSpaceBalance(spaceId: string, from?: string, to?: string): Promise<SpaceBalance> {
  const q = qs({ from, to });
  const cacheKey = `balance:${spaceId}${q}`;
  const memCached = getMemCache<SpaceBalance>(cacheKey);
  if (memCached) return memCached;

  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/spaces/${spaceId}/analytics/balance${q}`);
  const result = await jsonOrThrow<SpaceBalance>(res);
  setMemCache(cacheKey, result);
  return result;
}

// ── Notifications ───────────────────────────────────────────────────────────

export async function listSharedNotifications(
  params?: { page?: number; limit?: number },
): Promise<PaginatedResponse<SharedNotification> & { unreadCount: number }> {
  const q = qs(params ?? {});
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/notifications${q}`);
  return jsonOrThrow(res);
}

export async function getUnreadNotificationsCount(): Promise<{ unreadCount: number }> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/notifications/unread-count`);
  return jsonOrThrow(res);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/notifications/${notificationId}/read`, { method: 'PATCH' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await apiRateLimiter.fetch(`${SHARED_BASE}/notifications/read-all`, { method: 'PATCH' });
  if (!res.ok) {
    let msg = 'Error'; try { const b = await res.json(); msg = b?.message ?? msg; } catch {}
    throw new Error(msg);
  }
}

// ── Idempotency Key Generator ───────────────────────────────────────────────

let _counter = 0;
export function createIdempotencyKey(): string {
  return `${Date.now()}-${++_counter}-${Math.random().toString(36).slice(2, 8)}`;
}
