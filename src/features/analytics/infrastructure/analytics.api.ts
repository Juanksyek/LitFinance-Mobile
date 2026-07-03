import { httpClient } from '../../../shared/api/api-client';
import type {
  AnalyticsFilters,
  AnalyticsResumenInteligente,
  AnalyticsSmartFilters,
  AnalisisTemporal,
  EstadisticaConcepto,
  EstadisticaRecurrente,
  EstadisticaSubcuenta,
  PreviewBalance,
  ResumenFinanciero,
} from '../domain/analytics.types';

function buildFilters(filters?: AnalyticsFilters): string {
  if (!filters) return '';

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(item => params.append(`${key}[]`, String(item)));
      return;
    }
    params.append(key, String(value));
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function analyticsGet<T>(
  endpoint: string,
  filters?: AnalyticsFilters,
  signal?: AbortSignal,
): Promise<T> {
  return httpClient.get(`/analytics${endpoint}${buildFilters(filters)}`, {
    authenticated: true,
    signal,
  });
}

export const analyticsApi = {
  getResumenFinanciero(
    filters?: AnalyticsFilters,
  ): Promise<ResumenFinanciero> {
    return analyticsGet('/resumen-financiero', filters);
  },

  async getResumenInteligente(
    filters?: AnalyticsSmartFilters,
    signal?: AbortSignal,
  ): Promise<AnalyticsResumenInteligente> {
    const response = await analyticsGet<
      AnalyticsResumenInteligente | { data: AnalyticsResumenInteligente }
    >('/resumen-inteligente', filters, signal);
    return (
      typeof response === 'object' &&
      response !== null &&
      'data' in response
    )
      ? response.data
      : response;
  },

  getEstadisticasPorConcepto(
    filters?: AnalyticsFilters,
  ): Promise<EstadisticaConcepto[]> {
    return analyticsGet('/por-concepto', filters);
  },

  getEstadisticasPorSubcuenta(
    filters?: AnalyticsFilters,
  ): Promise<EstadisticaSubcuenta[]> {
    return analyticsGet('/por-subcuenta', filters);
  },

  getEstadisticasPorRecurrente(
    filters?: AnalyticsFilters,
  ): Promise<EstadisticaRecurrente[]> {
    return analyticsGet('/por-recurrente', filters);
  },

  getAnalisisTemporal(
    filters?: AnalyticsFilters,
    signal?: AbortSignal,
  ): Promise<AnalisisTemporal> {
    return analyticsGet('/analisis-temporal', filters, signal);
  },

  getAnalisisTemporalRaw(
    filters?: AnalyticsFilters,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return analyticsGet('/analisis-temporal', filters, signal);
  },

  getPreview(codigoMoneda: string): Promise<PreviewBalance> {
    return httpClient.get(
      `/cuenta/preview/${encodeURIComponent(codigoMoneda)}`,
      { authenticated: true },
    );
  },
};
