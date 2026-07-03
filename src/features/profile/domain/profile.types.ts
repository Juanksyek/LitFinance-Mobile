export interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  cuentaId: string;
  rol?: string;
  planType?: 'premium_plan' | 'free_plan';
  isPremium?: boolean;
  graficasAvanzadas?: boolean;
  premiumUntil?: string | Date | null;
  premiumSubscriptionStatus?: string | null;
  premiumSubscriptionId?: string | null;
  usarSubcuentaPorDefectoEnRecurrentes?: boolean;
  subcuentaPorDefectoRecurrentesId?: string | null;
}
