import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountDashboardService } from '../services/accountDashboardService';
import { logger } from '../shared/monitoring/logger';

type CuentaPrincipal = {
  _id: string;
  nombre: string;
  saldo: number;
  moneda: string;
  premiumSubscriptionStatus?: string | null;
  premiumUntil?: string | Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  [key: string]: any;
};

export function useCuentaPrincipal(token: string | null, reloadKey: number = 0) {
  const [cuenta, setCuenta] = useState<CuentaPrincipal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCuenta = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const normalized = await accountDashboardService.getCuentaPrincipal() as CuentaPrincipal;
      setCuenta(normalized);

      // Keep premium gating in sync even if login response didn't include it
      try {
        const rawUser = await AsyncStorage.getItem('userData');
        if (rawUser) {
          const user = JSON.parse(rawUser);
          const updated = {
            ...user,
            premiumSubscriptionStatus: normalized?.premiumSubscriptionStatus ?? user?.premiumSubscriptionStatus ?? null,
            premiumUntil: normalized?.premiumUntil ?? user?.premiumUntil ?? null,
            premiumSubscriptionId: normalized?.premiumSubscriptionId ?? user?.premiumSubscriptionId ?? null,
          };
          await AsyncStorage.setItem('userData', JSON.stringify(updated));
        }
      } catch {
        // ignore storage errors
      }
    } catch (err: any) {
      setError(err?.message || 'Error desconocido');
      logger.error('Error fetching cuenta principal', {
        message: err?.message,
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCuenta();
  }, [fetchCuenta, reloadKey]);

  const isPremium = 
    cuenta?.premiumSubscriptionStatus === 'active' || 
    cuenta?.premiumSubscriptionStatus === 'trialing' ||
    (cuenta?.premiumUntil && new Date(cuenta.premiumUntil) > new Date());

  return { cuenta, loading, error, refetch: fetchCuenta, isPremium };
}
