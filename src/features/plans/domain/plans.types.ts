export type PlanType = 'free_plan' | 'premium_plan';
export type PlanAction =
  | 'transaction'
  | 'recurrente'
  | 'subcuenta'
  | 'grafica'
  | 'reporte';

export type CanPerformResponse = {
  allowed: boolean;
  message?: string;
};

export type UserPlanLike = {
  premiumSubscriptionStatus?: string | null;
  premiumUntil?: string | Date | null;
};

export type CuentaPrincipalPlanResponse = UserPlanLike & {
  data?: UserPlanLike;
};

