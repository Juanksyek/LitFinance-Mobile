export type DashboardRange = 'day' | 'week' | 'month' | '3months' | '6months' | 'year' | 'all';

export type DashboardRangeOption = {
  key: string;
  label: string;
};

export type DashboardSnapshot = {
  meta: {
    version: string;
    generatedAt: string;
    plan: {
      type: 'free_plan' | 'premium_plan' | string;
      isPremium: boolean;
    };
    limits: {
      maxSubcuentas: number | null;
      maxRecurrentes: number | null;
      transaccionesPorDia: number | null;
      historicoLimitadoDias: number | null;
    };

    // New stable UI mapping (optional for backward compatibility)
    limitsV2?: {
      planType: string;
      updatedAt: string | null;
      items: Array<{
        key: 'subcuentas' | 'recurrentes' | 'transaccionesPorDia' | 'historicoLimitadoDias' | string;
        label: string;
        limit: number | null; // -1 => unlimited
        unlimited: boolean;
      }>;
    };

    // Frontend-friendly range selector (optional for backward compatibility)
    ranges?: {
      selected: DashboardRange;
      available: DashboardRangeOption[];
    };

    // Dashboard plan enforcement (optional; present when backend computes which items
    // should be considered paused due to plan limits).
    planEnforcement?: {
      subcuentas: {
        limit: number; // -1 => unlimited
        total: number;
        overLimit: boolean;
        toPauseOnThisPage: string[];
      };
      recurrentes: {
        limit: number; // -1 => unlimited
        total: number;
        overLimit: boolean;
        toPauseOnThisPage: string[];
      };
    };
  };

  // Viewer info ready for UI (optional for backward compatibility)
  viewer?: {
    id: string;
    nombreCompleto: string | null;
    monedaPrincipal: string | null;
    monedaPreferencia: string | null;
    monedasFavoritas: string[];
  };
  accountSummary: {
    cuentaId: string | null;
    moneda: string;
    saldo: number;
    ingresosPeriodo: number;
    egresosPeriodo: number;
  };
  subaccountsSummary: Array<{
    id: string;
    nombre: string;
    saldo: number;
    moneda: string;
    activa: boolean;
    pausadaPorPlan: boolean;
    color: string | null;
    simbolo: string | null;
  }>;
  recurrentesSummary: Array<{
    id: string;
    nombre: string;
    color: string | null;
    monto: number;
    moneda: string;
    frecuenciaTipo: string | null;
    frecuenciaValor: string;
    nextRun: string;
    estado: string;
    pausado: boolean;
    pausadoPorPlan: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>;
  recentTransactions: Array<{
    id: string;
    tipo: 'ingreso' | 'egreso' | string;
    monto: number;
    montoConvertido: number | null;
    moneda: string;
    monedaConvertida: string | null;
    concepto: string;
    cuentaId: string | null;
    subCuentaId: string | null;
    // When movement date differs from registeredAt/createdAt
    fechaEfectiva?: string | null;
    // When the movement was registered in the system
    registradoEn?: string | null;
    // Backend-provided helper for UI badges
    isBackdated?: boolean;
    createdAt: string;
  }>;

  recentHistory?: {
    total: number;
    page: number;
    limit: number;
    data: Array<{
      id: string;
      tipo: string;
      descripcion: string;
      monto: number;
      fecha: string;
      motivo: string | null;
      subcuentaId: string | null;
      conceptoId: string | null;
      detalles:
        | {
            distintivo?: {
              tipo: 'backdated' | 'edited' | 'deleted' | string;
              label?: string | null;
            };
            [key: string]: any;
          }
        | null;
      metadata: Record<string, any> | null;
    }>;
  };
  chartAggregates: {
    range: DashboardRange;
    granularity?: 'hour' | 'day' | 'month';
    start: string;
    end: string;
    points: Array<{ x: string; in: number; out: number }>;
  };

  // Global (non-paginated) totals to support multi-currency UX.
  // Note: `total` is a direct sum (may mix currencies); `byCurrency` is reliable.
  subaccountsTotals?: {
    active: { total: number; count: number; byCurrency: Array<{ moneda: string; total: number; count: number }> };
    paused: { total: number; count: number; byCurrency: Array<{ moneda: string; total: number; count: number }> };
  };

  recurrentesTotals?: {
    active: { total: number; count: number; byCurrency: Array<{ moneda: string; total: number; count: number }> };
    paused: { total: number; count: number; byCurrency: Array<{ moneda: string; total: number; count: number }> };
  };
};

export type SnapshotFetchResult =
  | { kind: 'not-modified' }
  | { kind: 'ok'; snapshot: DashboardSnapshot; etag: string | null };

export type RateLimitedError = Error & {
  code: 'RATE_LIMITED';
  retryAfterSeconds: number;
};

export type UnauthorizedError = Error & {
  code: 'UNAUTHORIZED';
};
