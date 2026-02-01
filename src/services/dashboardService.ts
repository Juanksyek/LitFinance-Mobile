import { API_BASE_URL } from '../constants/api';
import { authService } from './authService';
import apiRateLimiter from './apiRateLimiter';
import type { DashboardRange } from '../types/dashboardSnapshot';

export type DashboardTipoTransaccion = 'ingreso' | 'egreso' | 'ambos';

export type DashboardPeriodoKey = 'dia' | 'semana' | 'mes' | '3meses' | '6meses' | 'año';

export type DashboardExpensesChartMeta = {
  range: DashboardRange;
  isCustom: boolean;
  start: string;
  end: string;
  query: {
    tipoTransaccion: DashboardTipoTransaccion;
    moneda?: string | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
  };
  chart?: {
    granularity?: 'hour' | 'day' | 'month' | string;
    maxPoints?: number;
  };
};

export type DashboardExpensesChartPoint = {
  date: string;
  ingreso: number;
  egreso: number;
};

export type DashboardExpensesChartResponse = {
  meta: DashboardExpensesChartMeta;
  points: DashboardExpensesChartPoint[];
};

export type RateLimitedError = Error & {
  statusCode?: number;
  code?: string;
  retryAfterSeconds?: number;
};

export type DashboardBalanceCardResponse = {
  meta: {
    periodo: { key: DashboardPeriodoKey | string; label: string };
    start: string;
    end: string;
    periods?: {
      selected: DashboardPeriodoKey | string;
      available: Array<{ key: DashboardPeriodoKey | string; label: string }>;
    };
    query?: { moneda?: string | null };
  };
  account: { saldo: number; moneda: string };
  totals: { ingresos: number; egresos: number };
};

function parseRetryAfterSeconds(headers: Headers, body: any): number | undefined {
  const fromBody = Number(body?.retryAfterSeconds);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;

  const header = headers.get('Retry-After');
  const fromHeader = Number(header);
  if (Number.isFinite(fromHeader) && fromHeader > 0) return fromHeader;

  return undefined;
}

class DashboardService {
  async getExpensesChart(
    params: {
      range?: DashboardRange;
      tipoTransaccion?: DashboardTipoTransaccion;
      moneda?: string;
      fechaInicio?: string;
      fechaFin?: string;
    },
    signal?: AbortSignal
  ): Promise<DashboardExpensesChartResponse> {
    const token = await authService.getAccessToken();

    const query = new URLSearchParams();
    if (params.range) query.set('range', String(params.range));
    if (params.tipoTransaccion) query.set('tipoTransaccion', String(params.tipoTransaccion));
    if (params.moneda) query.set('moneda', String(params.moneda));

    // Custom range takes precedence when both are provided
    if (params.fechaInicio && params.fechaFin) {
      query.set('fechaInicio', params.fechaInicio);
      query.set('fechaFin', params.fechaFin);
    }

    const url = `${API_BASE_URL}/dashboard/expenses-chart${query.toString() ? `?${query}` : ''}`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const statusCode = data?.statusCode ?? res.status;
      const message = data?.message || `Error ${res.status}`;
      const err: RateLimitedError = new Error(message);
      err.statusCode = statusCode;
      err.code = data?.code;
      err.retryAfterSeconds = parseRetryAfterSeconds(res.headers, data);
      throw err;
    }

    return data as DashboardExpensesChartResponse;
  }

  async getBalanceCard(
    params: {
      periodo?: DashboardPeriodoKey | string;
      moneda?: string;
    },
    signal?: AbortSignal
  ): Promise<DashboardBalanceCardResponse> {
    const token = await authService.getAccessToken();

    const query = new URLSearchParams();
    if (params.periodo) query.set('periodo', String(params.periodo));
    if (params.moneda) query.set('moneda', String(params.moneda));

    const url = `${API_BASE_URL}/dashboard/balance-card${query.toString() ? `?${query}` : ''}`;

    const res = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const statusCode = data?.statusCode ?? res.status;
      const message = data?.message || `Error ${res.status}`;
      const err: RateLimitedError = new Error(message);
      err.statusCode = statusCode;
      err.code = data?.code;
      err.retryAfterSeconds = parseRetryAfterSeconds(res.headers, data);
      throw err;
    }

    return data as DashboardBalanceCardResponse;
  }
}

export const dashboardService = new DashboardService();
