import { httpClient } from '../../../shared/api/api-client';
import type {
  ReportExportParams,
  ReportExportResponse,
} from '../domain/report.types';

function buildReportQuery(params: ReportExportParams): string {
  const query = new URLSearchParams();

  if (params.format) query.set('format', params.format);
  if (params.rango) query.set('rango', params.rango);
  if (params.fechaInicio) query.set('fechaInicio', params.fechaInicio);
  if (params.fechaFin) query.set('fechaFin', params.fechaFin);
  if (params.monedaBase) query.set('monedaBase', params.monedaBase);
  if (typeof params.limiteMovimientos === 'number') {
    query.set('limiteMovimientos', String(params.limiteMovimientos));
  }
  if (typeof params.topN === 'number') {
    query.set('topN', String(params.topN));
  }
  if (typeof params.incluirMovimientos === 'boolean') {
    query.set('incluirMovimientos', String(params.incluirMovimientos));
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export const reportsApi = {
  export(params: ReportExportParams): Promise<ReportExportResponse> {
    return httpClient.get(`/reportes/export${buildReportQuery(params)}`, {
      authenticated: true,
      skipCache: true,
    });
  },
};
