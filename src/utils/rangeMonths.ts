import type { DashboardRange } from '../types/dashboardSnapshot';

/** Maps a DashboardRange preset to an approximate number of months. */
export function rangeToMonths(range: DashboardRange): number {
  switch (range) {
    case 'day':     return 1 / 30;
    case 'week':    return 1 / 4.33;
    case 'month':   return 1;
    case '3months': return 3;
    case '6months': return 6;
    case 'year':    return 12;
    case 'all':     return 24;
    default:        return 1;
  }
}
