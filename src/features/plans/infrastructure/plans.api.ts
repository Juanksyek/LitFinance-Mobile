import { httpClient } from '../../../shared/api/api-client';
import type {
  CanPerformResponse,
  CuentaPrincipalPlanResponse,
  PlanAction,
  PlanType,
} from '../domain/plans.types';

export const plansApi = {
  getCuentaPrincipal(): Promise<CuentaPrincipalPlanResponse> {
    return httpClient.get('/cuenta/principal', { authenticated: true });
  },

  getSubcuentasCount(_userId: string): Promise<unknown> {
    return httpClient.get(
      `/subcuenta?soloActivas=false&page=1&limit=50`,
      { authenticated: true },
    );
  },

  getRecurrentesCount(userId: string): Promise<unknown> {
    return httpClient.get(
      `/recurrentes?page=1&limit=50&search=`,
      { authenticated: true },
    );
  },

  canPerform(
    planType: PlanType,
    action: PlanAction,
    currentCount?: number,
  ): Promise<CanPerformResponse> {
    const query =
      currentCount !== undefined &&
      (action === 'subcuenta' || action === 'recurrente')
        ? `?currentCount=${encodeURIComponent(String(currentCount))}`
        : '';

    return httpClient.get(
      `/plan-config/${planType}/can-perform/${action}${query}`,
      { authenticated: true },
    );
  },
};
