import { API_BASE_URL } from '../constants/api';
import { apiRateLimiter } from './apiRateLimiter';

export type ReportFormat = 'pdf' | 'xlsx';
export type ReportRango = 'dia' | 'semana' | 'mes' | '3meses' | '6meses' | 'a\u00F1o';

export type ReportExportResponse = {
  filename: string;
  mimeType: string;
  base64: string;
  sizeBytes: number;
  generatedAt: string;
  meta?: {
    format?: ReportFormat;
    incluirMovimientos?: boolean;
    limiteMovimientos?: number;
    movimientosTotal?: number;
    topN?: number;
    moneda?: string;
    periodo?: {
      fechaInicio?: string;
      fechaFin?: string;
      descripcion?: string;
    };
  };
};

export type ReportExportParams = {
  format?: ReportFormat;
  rango?: ReportRango;
  fechaInicio?: string;
  fechaFin?: string;
  monedaBase?: string;
  limiteMovimientos?: number;
  topN?: number;
  incluirMovimientos?: boolean;
};

export type ApiError = Error & { status?: number; code?: string };

function parseJsonSafe(text: string): any {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function exportReporte(params: ReportExportParams): Promise<ReportExportResponse> {
  const qp = new URLSearchParams();
  if (params.format) qp.set('format', params.format);
  if (params.rango) qp.set('rango', params.rango);
  if (params.fechaInicio) qp.set('fechaInicio', params.fechaInicio);
  if (params.fechaFin) qp.set('fechaFin', params.fechaFin);
  if (params.monedaBase) qp.set('monedaBase', params.monedaBase);
  if (typeof params.limiteMovimientos === 'number') qp.set('limiteMovimientos', String(params.limiteMovimientos));
  if (typeof params.topN === 'number') qp.set('topN', String(params.topN));
  if (typeof params.incluirMovimientos === 'boolean') qp.set('incluirMovimientos', params.incluirMovimientos ? 'true' : 'false');

  const url = `${API_BASE_URL}/reportes/export${qp.toString() ? `?${qp.toString()}` : ''}`;

  const res = await apiRateLimiter.fetch(url, {
    method: 'GET',
    headers: {
      'X-Skip-Cache': '1',
    },
  });

  const text = await res.text();
  const json = parseJsonSafe(text);

  if (!res.ok) {
    const message = json?.message || `Error exportando reporte (${res.status})`;
    const err: ApiError = new Error(message);
    err.status = res.status;
    err.code = json?.code;
    throw err;
  }

  return json as ReportExportResponse;
}
