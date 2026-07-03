import type { DashboardSnapshot } from './dashboardSnapshot.types';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeDashboardSnapshot(
  snapshot: DashboardSnapshot | null | undefined,
): DashboardSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const normalized = snapshot as DashboardSnapshot & Record<string, any>;
  const meta = (normalized.meta && typeof normalized.meta === 'object')
    ? normalized.meta
    : ({} as DashboardSnapshot['meta']);
  const planEnforcement = (meta.planEnforcement && typeof meta.planEnforcement === 'object')
    ? meta.planEnforcement
    : ({} as NonNullable<DashboardSnapshot['meta']['planEnforcement']>);
  const viewer = (normalized.viewer && typeof normalized.viewer === 'object')
    ? normalized.viewer
    : undefined;
  const recentHistory = (normalized.recentHistory && typeof normalized.recentHistory === 'object')
    ? normalized.recentHistory
    : undefined;
  const metasSummary = (normalized.metasSummary && typeof normalized.metasSummary === 'object')
    ? normalized.metasSummary
    : undefined;
  const chartAggregates = (normalized.chartAggregates && typeof normalized.chartAggregates === 'object')
    ? normalized.chartAggregates
    : undefined;
  const conceptoBreakdown = (normalized.conceptoBreakdown && typeof normalized.conceptoBreakdown === 'object')
    ? normalized.conceptoBreakdown
    : undefined;
  const subaccountsTotals = (normalized.subaccountsTotals && typeof normalized.subaccountsTotals === 'object')
    ? normalized.subaccountsTotals
    : undefined;
  const recurrentesTotals = (normalized.recurrentesTotals && typeof normalized.recurrentesTotals === 'object')
    ? normalized.recurrentesTotals
    : undefined;

  return {
    ...normalized,
    meta: {
      ...meta,
      planEnforcement: {
        ...planEnforcement,
        subcuentas: {
          ...(planEnforcement?.subcuentas ?? {}),
          toPauseOnThisPage: asArray<string>(planEnforcement?.subcuentas?.toPauseOnThisPage),
        },
        recurrentes: {
          ...(planEnforcement?.recurrentes ?? {}),
          toPauseOnThisPage: asArray<string>(planEnforcement?.recurrentes?.toPauseOnThisPage),
        },
      },
    },
    viewer: viewer
      ? {
          ...viewer,
          monedasFavoritas: asArray<string>(viewer.monedasFavoritas),
        }
      : viewer,
    subaccountsSummary: asArray<DashboardSnapshot['subaccountsSummary'][number]>(normalized.subaccountsSummary),
    recurrentesSummary: asArray<DashboardSnapshot['recurrentesSummary'][number]>(normalized.recurrentesSummary),
    recentTransactions: asArray<DashboardSnapshot['recentTransactions'][number]>(normalized.recentTransactions),
    recentHistory: recentHistory
      ? {
          ...recentHistory,
          data: asArray<NonNullable<DashboardSnapshot['recentHistory']>['data'][number]>(recentHistory.data),
        }
      : recentHistory,
    metasSummary: metasSummary
      ? {
          ...metasSummary,
          data: asArray<NonNullable<DashboardSnapshot['metasSummary']>['data'][number]>(metasSummary.data),
        }
      : metasSummary,
    chartAggregates: chartAggregates
      ? {
          ...chartAggregates,
          points: asArray<DashboardSnapshot['chartAggregates']['points'][number]>(chartAggregates.points),
        }
      : normalized.chartAggregates,
    conceptoBreakdown: conceptoBreakdown
      ? {
          ...conceptoBreakdown,
          egresos: asArray<NonNullable<DashboardSnapshot['conceptoBreakdown']>['egresos'][number]>(conceptoBreakdown.egresos),
          ingresos: asArray<NonNullable<DashboardSnapshot['conceptoBreakdown']>['ingresos'][number]>(conceptoBreakdown.ingresos),
        }
      : conceptoBreakdown,
    subaccountsTotals: subaccountsTotals
      ? {
          ...subaccountsTotals,
          active: {
            ...subaccountsTotals.active,
            byCurrency: asArray<NonNullable<DashboardSnapshot['subaccountsTotals']>['active']['byCurrency'][number]>(subaccountsTotals.active?.byCurrency),
          },
          paused: {
            ...subaccountsTotals.paused,
            byCurrency: asArray<NonNullable<DashboardSnapshot['subaccountsTotals']>['paused']['byCurrency'][number]>(subaccountsTotals.paused?.byCurrency),
          },
        }
      : subaccountsTotals,
    recurrentesTotals: recurrentesTotals
      ? {
          ...recurrentesTotals,
          active: {
            ...recurrentesTotals.active,
            byCurrency: asArray<NonNullable<DashboardSnapshot['recurrentesTotals']>['active']['byCurrency'][number]>(recurrentesTotals.active?.byCurrency),
          },
          paused: {
            ...recurrentesTotals.paused,
            byCurrency: asArray<NonNullable<DashboardSnapshot['recurrentesTotals']>['paused']['byCurrency'][number]>(recurrentesTotals.paused?.byCurrency),
          },
        }
      : recurrentesTotals,
  };
}
