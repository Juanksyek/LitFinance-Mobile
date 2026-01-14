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
}

export default new UserService();
