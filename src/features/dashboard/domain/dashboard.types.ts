import type { DashboardRange } from '../../../types/dashboardSnapshot';

export type DashboardTipoTransaccion = 'ingreso' | 'egreso' | 'ambos';

export type DashboardPeriodoKey =
  | 'dia'
  | 'semana'
  | 'mes'
  | '3meses'
  | '6meses'
  | 'año';

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

export type ExpensesChartParams = {
  range?: DashboardRange;
  tipoTransaccion?: DashboardTipoTransaccion;
  moneda?: string;
  fechaInicio?: string;
  fechaFin?: string;
};

export type BalanceCardParams = {
  periodo?: DashboardPeriodoKey | string;
  moneda?: string;
};

