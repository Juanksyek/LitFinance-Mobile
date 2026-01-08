import PQueue from 'p-queue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './authService';

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
  private pendingRequests: Map<string, Promise<SharedResponse>>;
  private lastRequestTime: number;
  private requestHistory: number[];
  private cache: Map<string, CacheEntry>;
  private readonly MIN_INTERVAL = 500; // 500ms entre peticiones (más rápido pero aún protegido)
  private readonly CACHE_DURATION = 60000; // 60 segundos de cache
  private readonly MAX_REQUESTS_PER_MINUTE = 20; // Máximo 20 peticiones por minuto

  constructor() {
    // Cola con concurrencia máxima de 2 peticiones simultáneas
    this.queue = new PQueue({
      concurrency: 2,
      interval: 2000, // Intervalo de 2 segundos
      intervalCap: 1, // Máximo 1 petición por intervalo
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
    const body = await res.arrayBuffer();
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

  private refreshing: Promise<string | null> | null = null;

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
    const cacheHint = this.shouldUseCache(options) ? 'cache' : 'no-cache';
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

    // Permitir forzar no-cache desde el caller
    if ((options as any).cache === 'no-store') return false;

    const cacheControl = this.getHeaderValue(options.headers, 'cache-control')?.toLowerCase();
    if (cacheControl?.includes('no-store') || cacheControl?.includes('no-cache')) return false;

    const skipCache = this.getHeaderValue(options.headers, 'x-skip-cache');
    if (skipCache === '1' || skipCache?.toLowerCase() === 'true') return false;

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
    // Ensure Authorization header exists: if caller didn't provide, attach current access token
    try {
      const headersObj: any = Object.assign({}, options.headers || {});
      if (!this.getHeaderValue(headersObj, 'authorization')) {
        const token = await authService.getAccessToken();
        if (token) headersObj.Authorization = `Bearer ${token}`;
      }
      options = Object.assign({}, options, { headers: headersObj });
    } catch (e) {
      // ignore token attach errors
    }

    const key = this.getRequestKey(url, options);
    
    console.log('📨 [ApiRateLimiter] Nueva petición:', {
      key,
      url,
      method: options.method || 'GET',
      queueSize: this.queue.size,
      pending: this.queue.pending,
    });

    // 1. Verificar cache (solo para GET y si no se deshabilitó)
    if (this.shouldUseCache(options)) {
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

    // 4. Agregar a la cola
    const sharedPromise = this.queue.add(async (): Promise<SharedResponse> => {
      // Esperar intervalo mínimo desde última petición
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_INTERVAL) {
        const waitTime = this.MIN_INTERVAL - timeSinceLastRequest;
        console.log('⏱️ [ApiRateLimiter] Esperando intervalo mínimo:', waitTime, 'ms');
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      console.log('🚀 [ApiRateLimiter] Ejecutando petición:', key);
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

        // Guardar en cache si fue exitoso (leer del clone para evitar 'Already read')
        if (response.ok && this.shouldUseCache(options)) {
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
  }

  /**
   * Obtiene estadísticas del rate limiter
   */
  getStats() {
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = this.requestHistory.filter(t => t > oneMinuteAgo).length;
    
    return {
      queueSize: this.queue.size,
      pending: this.queue.pending,
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
