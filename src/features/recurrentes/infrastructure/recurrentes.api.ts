import { httpClient } from '../../../shared/api/api-client';
import type {
  EstadisticasRecurrentes,
  FiltroEstadisticas,
  HistorialRecurrenteParams,
} from '../domain/recurrentes.types';

export const recurrentesApi = {
  getEstadisticas(
    filtro: FiltroEstadisticas = 'mes',
  ): Promise<EstadisticasRecurrentes> {
    return httpClient.get(
      `/recurrentes/historial/estadisticas?filtro=${encodeURIComponent(filtro)}`,
      { authenticated: true },
    );
  },

  getHistorial<T = unknown>({
    recurrenteId,
    page = 1,
    limit = 10,
  }: HistorialRecurrenteParams): Promise<T> {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    return httpClient.get(
      `/recurrentes/${encodeURIComponent(recurrenteId)}/historial?${query.toString()}`,
      { authenticated: true },
    );
  },
};
