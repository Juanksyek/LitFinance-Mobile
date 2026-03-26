import type { DashboardSnapshot } from '../types/dashboardSnapshot';

export type RecurrenteSummaryItem = DashboardSnapshot['recurrentesSummary'][number];

export interface UpcomingRenewal extends RecurrenteSummaryItem {
  daysUntil: number;
}

/**
 * Returns active recurrentes charging within `withinDays` from now,
 * sorted closest-first. Also includes overdue items (up to 1 day past).
 */
export function getUpcomingRenewals(
  recurrentes: RecurrenteSummaryItem[],
  withinDays = 7,
): UpcomingRenewal[] {
  const now = Date.now();
  const cutoff = now + withinDays * 24 * 60 * 60 * 1000;
  const overdueBuffer = now - 24 * 60 * 60 * 1000; // 1 day ago

  return recurrentes
    .filter(r => {
      if (r.pausado || r.estado === 'cancelado' || r.estado === 'completado') return false;
      if (!r.nextRun) return false;
      const ts = new Date(r.nextRun).getTime();
      if (isNaN(ts)) return false;
      return ts >= overdueBuffer && ts <= cutoff;
    })
    .map(r => ({
      ...r,
      daysUntil: Math.max(
        0,
        Math.ceil((new Date(r.nextRun).getTime() - now) / (24 * 60 * 60 * 1000)),
      ),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
