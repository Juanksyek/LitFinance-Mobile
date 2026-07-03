import { httpClient } from '../../../shared/api/api-client';
import type {
  BalanceCardParams,
  DashboardBalanceCardResponse,
  DashboardExpensesChartResponse,
  ExpensesChartParams,
} from '../domain/dashboard.types';

function toQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export const dashboardApi = {
  getExpensesChart(
    params: ExpensesChartParams,
    signal?: AbortSignal,
  ): Promise<DashboardExpensesChartResponse> {
    return httpClient.get(
      `/dashboard/expenses-chart${toQuery({
        range: params.range,
        tipoTransaccion: params.tipoTransaccion,
        moneda: params.moneda,
        fechaInicio:
          params.fechaInicio && params.fechaFin ? params.fechaInicio : undefined,
        fechaFin:
          params.fechaInicio && params.fechaFin ? params.fechaFin : undefined,
      })}`,
      { authenticated: true, signal, skipCache: true },
    );
  },

  getBalanceCard(
    params: BalanceCardParams,
    signal?: AbortSignal,
  ): Promise<DashboardBalanceCardResponse> {
    return httpClient.get(
      `/dashboard/balance-card${toQuery({
        periodo: params.periodo,
        moneda: params.moneda,
      })}`,
      { authenticated: true, signal, skipCache: true },
    );
  },
};
