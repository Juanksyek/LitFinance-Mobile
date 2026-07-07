import { httpClient } from '../../../shared/api/api-client';
import { sanitizeObjectStrings } from '../../../utils/fixMojibake';
import type {
  FavoriteCurrenciesResponse,
  PublicUser,
  ToggleFavoriteCurrencyResponse,
} from '../domain/user.types';

const PUBLIC_USER_PATHS = [
  '/users',
  '/user',
  '/profiles',
  '/public/users',
  '/public/user',
] as const;

function sanitize<T>(value: T): T {
  return sanitizeObjectStrings(value) as T;
}

export const userApi = {
  async toggleFavoriteCurrency(
    codigoMoneda: string,
  ): Promise<ToggleFavoriteCurrencyResponse> {
    return sanitize(await httpClient.post<ToggleFavoriteCurrencyResponse>(
      '/user/monedas/toggle-favorita',
      { codigoMoneda },
      { authenticated: true },
    ));
  },

  async getFavoriteCurrencies(): Promise<FavoriteCurrenciesResponse> {
    return sanitize(await httpClient.get<FavoriteCurrenciesResponse>(
      '/user/monedas/favoritas',
      { authenticated: true },
    ));
  },

  async findPublicUser(userId: string): Promise<PublicUser | null> {
    for (const basePath of PUBLIC_USER_PATHS) {
      try {
        const response = sanitize(await httpClient.get<Record<string, unknown>>(
          `${basePath}/${encodeURIComponent(userId)}`,
          { skipCache: true },
        ));
        const nombre = extractPublicName(response);
        if (nombre) return { nombre };
      } catch {
        // Public profile routes vary across backend versions.
      }
    }

    return null;
  },
};

function extractPublicName(user: Record<string, unknown>): string | undefined {
  const directCandidates = [
    user.nombre,
    user.name,
    user.displayName,
    user.fullName,
    user.display_name,
    user.nombre_completo,
  ];

  const direct = directCandidates.find(
    value => typeof value === 'string' && value.trim().length > 0,
  );
  if (typeof direct === 'string') return direct;

  if (typeof user.firstName === 'string' && typeof user.lastName === 'string') {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  return undefined;
}
