import { API_BASE_URL } from "../constants/api";
import { apiRateLimiter } from "./apiRateLimiter";
import { sanitizeObjectStrings } from "../utils/fixMojibake";

type ToggleResp = { message: string; esFavorita: boolean; monedasFavoritas: any[] };

class UserService {
  async toggleMonedaFavorita(codigoMoneda: string): Promise<ToggleResp> {
    const url = `${API_BASE_URL}/user/monedas/toggle-favorita`;
    const res = await apiRateLimiter.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigoMoneda }),
    });

    if (!res.ok) {
      const rawErr = await res.json().catch(() => ({}));
      const err = sanitizeObjectStrings(rawErr);
      throw new Error(err.message || `Error ${res.status}`);
    }

    const json = await res.json();
    return sanitizeObjectStrings(json) as ToggleResp;
  }

  async getMonedasFavoritas(): Promise<{ monedasFavoritas: any[]; detalles?: any }> {
    const url = `${API_BASE_URL}/user/monedas/favoritas`;
    const res = await apiRateLimiter.fetch(url);
    if (!res.ok) {
      const rawErr = await res.json().catch(() => ({}));
      const err = sanitizeObjectStrings(rawErr);
      throw new Error(err.message || `Error ${res.status}`);
    }

    const json = await res.json();
    return sanitizeObjectStrings(json) as { monedasFavoritas: any[]; detalles?: any };
  }

  // Caching for public user lookups
  private publicCache: Record<string, { nombre?: string } | null> = {};

  /**
   * Tries to fetch a public user profile by id. Returns null if not available.
   */
  async getPublicUser(userId: string): Promise<{ nombre?: string } | null> {
    if (!userId) return null;
    if (this.publicCache[userId] !== undefined) return this.publicCache[userId];
    try {
      const candidates = [
        `${API_BASE_URL}/users/${encodeURIComponent(userId)}`,
        `${API_BASE_URL}/user/${encodeURIComponent(userId)}`,
        `${API_BASE_URL}/profiles/${encodeURIComponent(userId)}`,
        `${API_BASE_URL}/public/users/${encodeURIComponent(userId)}`,
        `${API_BASE_URL}/public/user/${encodeURIComponent(userId)}`,
      ];

      for (const url of candidates) {
        try {
          const res = await apiRateLimiter.fetch(url, { headers: { 'X-Skip-Cache': '1' } });
          if (!res.ok) continue;
          const j = await res.json().catch(() => ({}));
          const sanitized = sanitizeObjectStrings(j);
          const nameCandidate =
            sanitized.nombre ??
            sanitized.name ??
            sanitized.displayName ??
            sanitized.fullName ??
            sanitized.display_name ??
            sanitized.nombre_completo ??
            (sanitized.firstName && sanitized.lastName ? `${sanitized.firstName} ${sanitized.lastName}` : undefined) ??
            undefined;
          if (nameCandidate) {
            // Debug: log which endpoint returned a name
            console.log('[UserService] getPublicUser -> resolved', { userId, url, nameCandidate });
            this.publicCache[userId] = { nombre: nameCandidate };
            return this.publicCache[userId];
          } else {
            console.log('[UserService] getPublicUser -> endpoint returned no name fields', { userId, url, body: sanitized });
          }
        } catch {
          // try next endpoint
        }
      }

      console.log('[UserService] getPublicUser -> no endpoints returned a name for', { userId });
      this.publicCache[userId] = null;
      return null;
    } catch (e) {
      this.publicCache[userId] = null;
      return null;
    }
  }
}

export default new UserService();
