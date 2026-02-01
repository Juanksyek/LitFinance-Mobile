import PQueue from 'p-queue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './authService';
import { sanitizeObjectStrings } from '../utils/fixMojibake';

// Import userProfileService dynamically to avoid circular deps
let userProfileService: any = null;
let upgradeModalController: ((show: boolean, message?: string) => void) | null = null;

/**
 * ApiRateLimiter - Servicio estricto de rate limiting para evitar saturar el backend
 * 
 * Características:
 * - Cola de peticiones con concurrencia limitada (máximo 2 simultáneas)
 * - Intervalo mínimo de 2 segundos entre peticiones
 * - Deduplicación de peticiones idénticas
 * - Cache agresivo para reducir llamadas innecesarias
 * - Logging detallado para debugging
 */

interface QueuedRequest {
  key: string;
  url: string;
  options: RequestInit;
  timestamp: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

interface SharedResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: ArrayBuffer;
}

class ApiRateLimiter {
  private queue: PQueue;
  private highPriorityQueue: PQueue; // Cola prioritaria para mutaciones
  private pendingRequests: Map<string, Promise<SharedResponse>>;
  private lastRequestTime: number;
  private requestHistory: number[];
  private cache: Map<string, CacheEntry>;
  private readonly MIN_INTERVAL = 500; // 500ms entre peticiones (más rápido pero aún protegido)
  private readonly CACHE_DURATION = 60000; // 60 segundos de cache
  private readonly MAX_REQUESTS_PER_MINUTE = 20; // Máximo 20 peticiones por minuto
  private profileRefreshAttempts: Map<string, number> = new Map(); // Track 403 retry attempts

  constructor() {
    // Cola normal para GETs
    this.queue = new PQueue({
      concurrency: 2,
      interval: 2000, // Intervalo de 2 segundos
      intervalCap: 1, // Máximo 1 petición por intervalo
    });

    // Cola prioritaria para mutaciones (PUT/POST/PATCH/DELETE)
    this.highPriorityQueue = new PQueue({
      concurrency: 2,
      interval: 1000, // Mutaciones más rápidas
      intervalCap: 1,
    });

    this.pendingRequests = new Map();
    this.lastRequestTime = 0;
    this.requestHistory = [];
    this.cache = new Map();

    // Limpiar historial viejo cada minuto
    setInterval(() => {
      const oneMinuteAgo = Date.now() - 60000;
      this.requestHistory = this.requestHistory.filter(t => t > oneMinuteAgo);
    }, 60000);

    // Limpiar cache expirado cada 30 segundos
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 30000);

    console.log('🚦 [ApiRateLimiter] Servicio inicializado - Concurrencia: 2, Intervalo: 2s, Max/min: 20');
  }

  private async toSharedResponse(res: Response): Promise<SharedResponse> {
    let body = await res.arrayBuffer();

    // If the response is JSON, attempt to sanitize string fields to fix mojibake
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.toLowerCase().includes('application/json') && typeof TextDecoder !== 'undefined' && typeof TextEncoder !== 'undefined') {
        const text = new TextDecoder('utf-8').decode(body);
        // Try to parse JSON and sanitize strings recursively
        try {
          const parsed = JSON.parse(text);
          const sanitized = sanitizeObjectStrings(parsed);
          const retext = JSON.stringify(sanitized);
          body = new TextEncoder().encode(retext).buffer as ArrayBuffer;
        } catch (e) {
          // If JSON parse fails, leave body untouched
        }
      }
    } catch (e) {
      // ignore errors in sanitization
    }

    return {
      status: res.status,
      statusText: res.statusText,
      headers: Array.from(res.headers.entries()),
      body,
    };
  }

  private fromSharedResponse(shared: SharedResponse): Response {
    // Create a fresh Response each time to avoid sharing consumed streams.
    const bodyCopy = shared.body.slice(0);
    return new Response(bodyCopy, {
      status: shared.status,
      statusText: shared.statusText,
      headers: shared.headers,
    });
  }

  /**
   * Normaliza headers para asegurar casing consistente de X-Skip-Cache
   */
  private normalizeHeaders(init?: RequestInit): Headers {
    const h = new Headers(init?.headers || {});
    // Asegurar que x-skip-cache (minúsculas) se mueva a X-Skip-Cache
    const lower = h.get('x-skip-cache');
    if (lower && !h.get('X-Skip-Cache')) {
      h.set('X-Skip-Cache', lower);
      h.delete('x-skip-cache');
    }
    return h;
  }

  /**
   * Detecta si una petición debe omitir cache (X-Skip-Cache o Cache-Control: no-store)
   */
  private hasSkipCache(headers?: HeadersInit): boolean {
    const h = new Headers(headers || {});
    const skipCache = h.get('X-Skip-Cache') || h.get('x-skip-cache');
    const cacheControl = h.get('Cache-Control') || h.get('cache-control');
    return skipCache === '1' || (cacheControl?.includes('no-store') ?? false);
  }

  /**
   * Invalida cache por prefijo (útil después de mutaciones)
   */
  private invalidateCacheByPrefix(prefix: string): void {
    let invalidated = 0;
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
        invalidated++;
      }
    }
    if (invalidated > 0) {
      console.log(`🗑️ [ApiRateLimiter] Invalidados ${invalidated} entries de cache con prefijo: ${prefix}`);
    }
  }

  /**
   * Invalida cache relacionado con mutaciones
   */
  private invalidateRelatedCache(url: string, method: string): void {
    if (method === 'GET') return; // Solo mutaciones

    try {
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      
      // Extraer userId de la URL si está presente
      const userIdMatch = url.match(/userId=([^&]+)/);
      const userId = userIdMatch ? userIdMatch[1] : null;

      // Invalidar según el recurso mutado
      if (url.includes('/recurrentes')) {
        this.invalidateCacheByPrefix(`GET:${baseUrl}/recurrentes`);
        if (userId) {
          this.invalidateCacheByPrefix(`GET:${baseUrl}/recurrentes?userId=${userId}`);
        }
      }
      
      if (url.includes('/subcuenta')) {
        this.invalidateCacheByPrefix(`GET:${baseUrl}/subcuenta`);
        if (userId) {
          this.invalidateCacheByPrefix(`GET:${baseUrl}/subcuenta/${userId}`);
        }
      }
      
      if (url.includes('/transacciones') || url.includes('/cuenta/principal')) {
        this.invalidateCacheByPrefix(`GET:${baseUrl}/cuenta/principal`);
        this.invalidateCacheByPrefix(`GET:${baseUrl}/transacciones`);
        if (userId) {
          this.invalidateCacheByPrefix(`GET:${baseUrl}/cuenta/principal/${userId}`);
        }
      }
    } catch (e) {
      console.warn('⚠️ [ApiRateLimiter] Error invalidando cache:', e);
    }
  }

  private refreshing: Promise<string | null> | null = null;

  /**
   * Register a callback to show upgrade modal
   */
  setUpgradeModalController(controller: (show: boolean, message?: string) => void): void {
    upgradeModalController = controller;
  }

  /**
   * Get the upgrade modal controller (for external access)
   */
  get upgradeModalController() {
    return upgradeModalController;
  }

  /**
   * Handle 403 Forbidden responses
   * Attempts to refresh user profile once per request, then shows upgrade modal if still 403
   */
  private async handle403Response(url: string, options: RequestInit, response: Response, requestKey: string): Promise<Response | null> {
    console.warn('🚫 [ApiRateLimiter] 403 Forbidden recibido para:', url);

    // Only treat PREMIUM_REQUIRED as an upgrade-gated 403.
    // Other 403s should be returned to the caller to handle normally.
    try {
      const parsed = await response.clone().json();
      const code = parsed?.code;
      if (code && code !== 'PREMIUM_REQUIRED') {
        console.warn('🚫 [ApiRateLimiter] 403 no es PREMIUM_REQUIRED, devolviendo al caller:', { url, code });
        this.profileRefreshAttempts.delete(requestKey);
        return response;
      }
    } catch {
      // If body is not JSON, fall through to existing behavior.
    }

    // Check if we already tried to refresh profile for this request
    const attempts = this.profileRefreshAttempts.get(requestKey) || 0;
    
    if (attempts === 0) {
      // First 403: try refreshing user profile
      console.log('🔄 [ApiRateLimiter] Primer 403, intentando refrescar perfil de usuario...');
      this.profileRefreshAttempts.set(requestKey, 1);

      try {
        // Lazy load userProfileService to avoid circular deps
        if (!userProfileService) {
          userProfileService = await import('./userProfileService').then(m => m.default || m.userProfileService);
        }

        // Fetch and update profile
        await userProfileService.fetchAndUpdateProfile();
        console.log('✅ [ApiRateLimiter] Perfil actualizado, reintentando petición...');

        // Retry the original request
        const retryResponse = await fetch(url, options);
        
        // Clean up attempt counter on success or different error
        if (retryResponse.status !== 403) {
          this.profileRefreshAttempts.delete(requestKey);
        }
        
        return retryResponse;
      } catch (error) {
        console.error('❌ [ApiRateLimiter] Error actualizando perfil:', error);
        this.profileRefreshAttempts.delete(requestKey);
      }
    }

    // Second 403 or profile refresh failed: show upgrade modal
    console.log('🔒 [ApiRateLimiter] 403 persistente, mostrando modal de upgrade');
    this.profileRefreshAttempts.delete(requestKey);

    // Extract message from response
    let message = 'Esta función requiere LitFinance Premium. Actualiza tu plan.';
    try {
      const data = await response.clone().json();
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // Use default message
    }

    // Show upgrade modal if controller is registered
    if (upgradeModalController) {
      upgradeModalController(true, message);
    }

    // Return original 403 response
    return null;
  }

  private async performRefreshOnce(): Promise<string | null> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        console.log('🔁 [ApiRateLimiter] Intentando refresh de tokens...');
        const newToken = await authService.refreshTokens();
        console.log('🔁 [ApiRateLimiter] Refresh exitoso');
        return newToken;
      } catch (e) {
        console.error('🔁 [ApiRateLimiter] Refresh falló:', e);
        throw e;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  /**
   * Genera una clave única para una petición
   */
  private getRequestKey(url: string, options: RequestInit): string {
    const method = options.method || 'GET';
    const headers = options.headers;
    const authHeader = this.getHeaderValue(headers, 'authorization') || '';
    const authHash = authHeader ? this.hashString(authHeader) : '';
    const body = this.getBodyKey(options.body);
    
    // Usar hasSkipCache para determinar el modo de cache
    const skipCache = this.hasSkipCache(headers);
    const cacheHint = (method === 'GET' && !skipCache) ? 'cache' : 'no-cache';
    
    return `${method}:${url}:${authHash}:${cacheHint}:${body}`;
  }

  private getHeaderValue(headers: HeadersInit | undefined, name: string): string | undefined {
    if (!headers) return undefined;
    const lower = name.toLowerCase();

    if (headers instanceof Headers) {
      return headers.get(name) ?? headers.get(lower) ?? undefined;
    }

    if (Array.isArray(headers)) {
      const found = headers.find(([k]) => String(k).toLowerCase() === lower);
      return found ? String(found[1]) : undefined;
    }

    // Record<string, string>
    for (const [k, v] of Object.entries(headers)) {
      if (String(k).toLowerCase() === lower) return String(v);
    }
    return undefined;
  }

  private hashString(value: string): string {
    // djb2-ish hash, suficiente para claves de cache/dedup
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  }

  private getBodyKey(body: RequestInit['body']): string {
    if (!body) return '';
    if (typeof body === 'string') return body;
    try {
      return JSON.stringify(body);
    } catch {
      return '[non-json-body]';
    }
  }

  private shouldUseCache(options: RequestInit): boolean {
    const method = options.method || 'GET';
    if (method !== 'GET') return false;

    // Usar helper hasSkipCache que normaliza headers
    if (this.hasSkipCache(options.headers)) return false;

    return true;
  }

  /**
   * Detecta endpoints de autenticación donde no tiene sentido intentar refresh.
   * Evita llamar a refreshTokens para rutas como /auth/login, /auth/register, /auth/forgot-password, /auth/reset-password
   */
  private isAuthEndpoint(url: string): boolean {
    try {
      const u = new URL(url);
      const p = u.pathname.toLowerCase();
      if (p.startsWith('/auth')) {
        // allow refresh endpoint to be treated normally (it should not attempt another refresh)
        if (p.includes('/auth/refresh')) return true; // treat refresh specially below
        return true;
      }
      return false;
    } catch {
      // fallback simple check
      const lower = url.toLowerCase();
      return (
        lower.includes('/auth/login') ||
        lower.includes('/auth/register') ||
        lower.includes('/auth/forgot-password') ||
        lower.includes('/auth/reset-password') ||
        lower.includes('/auth/refresh')
      );
    }
  }

  /**
   * Verifica si estamos excediendo el límite de peticiones por minuto
   */
  private isRateLimitExceeded(): boolean {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestHistory = this.requestHistory.filter(t => t > oneMinuteAgo);
    
    if (this.requestHistory.length >= this.MAX_REQUESTS_PER_MINUTE) {
      console.warn('⚠️ [ApiRateLimiter] LÍMITE EXCEDIDO:', {
        peticionesUltimoMinuto: this.requestHistory.length,
        maximo: this.MAX_REQUESTS_PER_MINUTE
      });
      return true;
    }
    return false;
  }

  /**
   * Obtiene datos del cache si están disponibles y no han expirado
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (entry.expiresAt < now) {
      this.cache.delete(key);
      console.log('🗑️ [ApiRateLimiter] Cache expirado:', key);
      return null;
    }

    console.log('✅ [ApiRateLimiter] Cache hit:', key);
    return entry.data;
  }

  /**
   * Guarda datos en cache
   */
  private saveToCache(key: string, data: any): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION,
    });
    console.log('💾 [ApiRateLimiter] Guardado en cache:', key);
  }

  /**
   * Ejecuta una petición con rate limiting estricto
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Normalizar headers primero
    const normalizedHeaders = this.normalizeHeaders(options);
    // Bypass completo para endpoints de autenticación: no queuear ni intentar refresh
    if (this.isAuthEndpoint(url)) {
      try {
        console.log('🔒 [ApiRateLimiter] Bypass para endpoint auth, ejecutando fetch directo:', url);
        const directOptions = Object.assign({}, options, { headers: normalizedHeaders });
        return await fetch(url, directOptions);
      } catch (e) {
        console.error('🔒 [ApiRateLimiter] Error en fetch directo para auth endpoint:', e);
        throw e;
      }
    }
    
    // Ensure Authorization header exists: if caller didn't provide, attach current access token
    // But DO NOT attach Authorization for auth endpoints (login/register/refresh)
    try {
      if (!this.isAuthEndpoint(url)) {
        if (!normalizedHeaders.get('Authorization') && !normalizedHeaders.get('authorization')) {
          const token = await authService.getAccessToken();
          if (token) normalizedHeaders.set('Authorization', `Bearer ${token}`);
        }
      }
    } catch (e) {
      // ignore token attach errors
    }

    // Actualizar options con headers normalizados
    options = Object.assign({}, options, { headers: normalizedHeaders });

    const method = options.method || 'GET';
    const skipCache = this.hasSkipCache(normalizedHeaders);
    const key = this.getRequestKey(url, options);
    
    console.log('📨 [ApiRateLimiter] Nueva petición:', {
      key,
      url,
      method,
      skipCache,
      queueSize: this.queue.size,
      pending: this.queue.pending,
    });

    // 1. Verificar cache (solo para GET y si no se deshabilitó con skip-cache)
    if (method === 'GET' && !skipCache) {
      const cached = this.getFromCache(key);
      if (cached) {
        // Retornar respuesta falsa desde cache
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. Deduplicación: si la misma petición ya está en curso, esperar a ella
    if (this.pendingRequests.has(key)) {
      console.log('⏳ [ApiRateLimiter] Petición duplicada, esperando a la existente:', key);
      return this.pendingRequests.get(key)!.then(shared => this.fromSharedResponse(shared));
    }

    // 3. Verificar rate limit
    if (this.isRateLimitExceeded()) {
      console.error('🚫 [ApiRateLimiter] Rate limit excedido, rechazando petición');
      throw new Error('Rate limit excedido. Por favor espera un momento.');
    }

    // 4. Agregar a la cola (prioritaria para mutaciones, normal para GETs)
    const isMutation = method !== 'GET';
    const targetQueue = isMutation ? this.highPriorityQueue : this.queue;
    
    const sharedPromise = targetQueue.add(async (): Promise<SharedResponse> => {
      // Esperar intervalo mínimo desde última petición
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_INTERVAL) {
        const waitTime = this.MIN_INTERVAL - timeSinceLastRequest;
        console.log('⏱️ [ApiRateLimiter] Esperando intervalo mínimo:', waitTime, 'ms');
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      console.log(`🚀 [ApiRateLimiter] Ejecutando petición [${isMutation ? 'PRIORITY' : 'normal'}]:`, key);
      this.lastRequestTime = Date.now();
      this.requestHistory.push(this.lastRequestTime);

      try {
        const response = await fetch(url, options);

        // Auto-refresh on 401: try once to refresh tokens and retry
        if (response.status === 401) {
          console.warn('🔐 [ApiRateLimiter] 401 recibido, intentando refresh...');
          // Do not attempt refresh for auth endpoints (login/register/reset/forgot)
          if (this.isAuthEndpoint(url)) {
            console.warn('🔐 [ApiRateLimiter] 401 en endpoint de auth, no se intentará refresh:', url);
            throw new Error('Unauthorized');
          }
          try {
            const newToken = await this.performRefreshOnce();
            if (newToken) {
              // Rebuild headers with new Authorization
              const newHeaders: any = Object.assign({}, options.headers || {});
              newHeaders.Authorization = `Bearer ${newToken}`;
              const retryOptions = Object.assign({}, options, { headers: newHeaders });
              const retryResponse = await fetch(url, retryOptions);

              if (retryResponse.status === 429) {
                const retryAfter = retryResponse.headers.get('Retry-After');
                const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
                const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
                  ? retryAfterSeconds * 1000
                  : 10000;
                await new Promise(resolve => setTimeout(resolve, waitMs));
                throw new Error('Demasiadas peticiones. Por favor espera un momento.');
              }

              if (retryResponse.ok && this.shouldUseCache(options)) {
                try {
                  const sharedRetryForCache = await this.toSharedResponse(retryResponse);
                  const cacheRes = this.fromSharedResponse(sharedRetryForCache);
                  const dataRetry = await cacheRes.json();
                  this.saveToCache(key, dataRetry);
                  return sharedRetryForCache;
                } catch (cacheErr) {
                  console.warn('⚠️ [ApiRateLimiter] Error caching retry response:', cacheErr);
                  return await this.toSharedResponse(retryResponse);
                }
              }

              return await this.toSharedResponse(retryResponse);
            }
          } catch (refreshErr) {
            console.error('🔐 [ApiRateLimiter] Refresh/Retry falló:', refreshErr);
            throw refreshErr;
          }
        }

        // Handle 403 Forbidden: refresh profile and retry once
        if (response.status === 403) {
          const retryResponse = await this.handle403Response(url, options, response, key);
          if (retryResponse) {
            // Profile refresh worked, retry succeeded or returned different status
            if (retryResponse.ok && method === 'GET' && !skipCache) {
              try {
                const sharedRetryForCache = await this.toSharedResponse(retryResponse);
                const cacheRes = this.fromSharedResponse(sharedRetryForCache);
                const dataRetry = await cacheRes.json();
                this.saveToCache(key, dataRetry);
                return sharedRetryForCache;
              } catch (cacheErr) {
                console.warn('⚠️ [ApiRateLimiter] Error caching retry response:', cacheErr);
                return await this.toSharedResponse(retryResponse);
              }
            }
            return await this.toSharedResponse(retryResponse);
          }
          // If handle403Response returns null, continue with original 403 response
        }

        // Detectar 429 (Too Many Requests)
        if (response.status === 429) {
          console.error('🚨 [ApiRateLimiter] 429 Too Many Requests detectado!');
          // Respetar Retry-After si existe; si no, pausar 10s
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
          const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : 10000;
          await new Promise(resolve => setTimeout(resolve, waitMs));
          throw new Error('Demasiadas peticiones. Por favor espera un momento.');
        }

        // Guardar en cache si fue exitoso Y no tiene skip-cache
        if (response.ok) {
          // Invalidar cache relacionado si fue una mutación exitosa
          if (isMutation) {
            this.invalidateRelatedCache(url, method);
          }

          // Solo cachear GETs sin skip-cache
          if (method === 'GET' && !skipCache) {
            try {
              const sharedForCache = await this.toSharedResponse(response);
              const cacheRes = this.fromSharedResponse(sharedForCache);
              const data = await cacheRes.json();
              this.saveToCache(key, data);
              return sharedForCache;
            } catch (cacheErr) {
              console.warn('⚠️ [ApiRateLimiter] Error caching response:', cacheErr);
              // Continuar sin cachear si falla
            }
          }
        }

        return await this.toSharedResponse(response);
      } finally {
        // Remover de peticiones pendientes
        this.pendingRequests.delete(key);
      }
    });

    // Guardar promesa para deduplicación
    this.pendingRequests.set(key, sharedPromise);

    return sharedPromise.then(shared => this.fromSharedResponse(shared));
  }

  /**
   * Limpia el cache y resetea el rate limiter
   */
  reset(): void {
    console.log('🔄 [ApiRateLimiter] Reseteando servicio...');
    this.cache.clear();
    this.pendingRequests.clear();
    this.requestHistory = [];
    this.queue.clear();
    this.highPriorityQueue.clear();
  }

  /**
   * Obtiene estadísticas del rate limiter
   */
  getStats() {
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = this.requestHistory.filter(t => t > oneMinuteAgo).length;
    
    return {
      queueSize: this.queue.size,
      highPriorityQueueSize: this.highPriorityQueue.size,
      pending: this.queue.pending,
      highPriorityPending: this.highPriorityQueue.pending,
      cacheSize: this.cache.size,
      requestsLastMinute: recentRequests,
      maxRequestsPerMinute: this.MAX_REQUESTS_PER_MINUTE,
      utilizationPercent: (recentRequests / this.MAX_REQUESTS_PER_MINUTE) * 100,
    };
  }

  /**
   * Limpia el cache de forma manual
   */
  clearCache(): void {
    console.log('🗑️ [ApiRateLimiter] Cache limpiado manualmente');
    this.cache.clear();
  }
}

// Exportar instancia singleton
export const apiRateLimiter = new ApiRateLimiter();
export default apiRateLimiter;
