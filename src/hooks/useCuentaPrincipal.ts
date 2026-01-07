import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    console.log('[useCuentaPrincipal] token:', token);
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/cuenta/principal`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      console.log('[useCuentaPrincipal] /cuenta/principal response:', text);
      if (!res.ok) {
        throw new Error('Error al cargar cuenta principal');
      }
      const json = text ? JSON.parse(text) : null;
      const normalized = json?.data ?? json;
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
      console.error('Error fetching cuenta principal:', err);
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

  console.log('[useCuentaPrincipal] cuenta:', cuenta, 'isPremium:', isPremium);
  return { cuenta, loading, error, refetch: fetchCuenta, isPremium };
}
