import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './authService';
import { API_BASE_URL } from '../constants/api';

export type PlanType = 'free_plan' | 'premium_plan';
export type PlanAction = 'transaction' | 'recurrente' | 'subcuenta' | 'grafica';

export type CanPerformResponse = {
  allowed: boolean;
  message?: string;
};

export type UserPlanLike = {
  premiumSubscriptionStatus?: string | null;
  premiumUntil?: string | Date | null;
};

function extractDateValue(dateLike: any): string | number | Date | null {
  if (!dateLike) return null;
  if (dateLike instanceof Date) return dateLike;
  if (typeof dateLike === 'string' || typeof dateLike === 'number') return dateLike;

  // MongoDB Extended JSON shapes: { $date: "..." } or { $date: { $numberLong: "..." } }
  if (typeof dateLike === 'object') {
    const maybeDate = (dateLike as any).$date;
    if (typeof maybeDate === 'string' || typeof maybeDate === 'number') return maybeDate;
    const maybeLong = maybeDate?.$numberLong;
    if (typeof maybeLong === 'string' || typeof maybeLong === 'number') return Number(maybeLong);
  }

  return null;
}

export function isPremiumUser(user?: UserPlanLike | null): boolean {
  if (!user) return false;
  if (user.premiumSubscriptionStatus === 'active' || user.premiumSubscriptionStatus === 'trialing') {
    return true;
  }
  const premiumUntil = extractDateValue((user as any).premiumUntil);
  if (!premiumUntil) return false;
  const until = new Date(premiumUntil as any);
  return until.getTime() > Date.now();
}

async function fetchPremiumFieldsFromCuentaPrincipal(): Promise<UserPlanLike | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}/cuenta/principal`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) return null;
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
  const normalized = json?.data ?? json;
  return {
    premiumSubscriptionStatus: normalized?.premiumSubscriptionStatus ?? null,
    premiumUntil: normalized?.premiumUntil ?? null,
  };
}

export async function getPlanTypeFromStorage(): Promise<PlanType> {
  try {
    const raw = await AsyncStorage.getItem('userData');
    if (!raw) {
      const fromCuenta = await fetchPremiumFieldsFromCuentaPrincipal();
      return isPremiumUser(fromCuenta) ? 'premium_plan' : 'free_plan';
    }

    const user = JSON.parse(raw);
    const hasPremiumFields =
      user &&
      (Object.prototype.hasOwnProperty.call(user, 'premiumUntil') ||
        Object.prototype.hasOwnProperty.call(user, 'premiumSubscriptionStatus'));

    if (!hasPremiumFields) {
      const fromCuenta = await fetchPremiumFieldsFromCuentaPrincipal();
      if (fromCuenta) {
        const updated = {
          ...user,
          premiumSubscriptionStatus: fromCuenta.premiumSubscriptionStatus ?? null,
          premiumUntil: fromCuenta.premiumUntil ?? null,
        };
        await AsyncStorage.setItem('userData', JSON.stringify(updated));
        return isPremiumUser(updated) ? 'premium_plan' : 'free_plan';
      }
    }

    return isPremiumUser(user) ? 'premium_plan' : 'free_plan';
  } catch {
    return 'free_plan';
  }
}

async function getAuthToken(): Promise<string | null> {
  return await authService.getAccessToken();
}

async function getApproxSubcuentasCount(userId: string): Promise<number> {
  // Free limit is small; we only need an approximate count, not a full pagination walk.
  const token = await getAuthToken();
  if (!token) return 0;

  const res = await fetch(
    `${API_BASE_URL}/subcuenta/${userId}?soloActivas=false&page=1&limit=50`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

async function getApproxRecurrentesCount(userId: string): Promise<number> {
  const token = await getAuthToken();
  if (!token) return 0;

  const res = await fetch(
    `${API_BASE_URL}/recurrentes?userId=${encodeURIComponent(userId)}&page=1&limit=50&search=`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  const items = data?.items;
  return Array.isArray(items) ? items.length : 0;
}

export async function canPerform(
  action: PlanAction,
  opts?: { planType?: PlanType; currentCount?: number; userId?: string }
): Promise<CanPerformResponse> {
  const token = await getAuthToken();
  if (!token) {
    return { allowed: false, message: 'Sesión expirada. Inicia sesión nuevamente.' };
  }

  const planType = opts?.planType ?? (await getPlanTypeFromStorage());

  let currentCount = opts?.currentCount;
  if (currentCount === undefined && opts?.userId) {
    if (action === 'subcuenta') {
      currentCount = await getApproxSubcuentasCount(opts.userId);
    } else if (action === 'recurrente') {
      currentCount = await getApproxRecurrentesCount(opts.userId);
    }
  }

  const query =
    currentCount !== undefined && (action === 'subcuenta' || action === 'recurrente')
      ? `?currentCount=${encodeURIComponent(String(currentCount))}`
      : '';

  const url = `${API_BASE_URL}/plan-config/${planType}/can-perform/${action}${query}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = (await res.json().catch(() => null)) as CanPerformResponse | null;
  if (!data || typeof data.allowed !== 'boolean') {
    // Fallback: if backend returns unexpected payload, do not hard-block.
    return { allowed: true };
  }

  return data;
}
