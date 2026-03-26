import type { DashboardSnapshot } from '../types/dashboardSnapshot';

export interface CategorySpend {
  categoria: string;
  total: number;
  count: number;
  moneda: string;
  color: string;
}

const PALETTE = [
  '#6366F1', '#F59E0B', '#10B981', '#EF4444',
  '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6',
];

/**
 * Aggregates egreso transactions by their concepto string.
 * Shows the topN categories; everything else collapses to "Otros".
 */
export function getSpendingByConcepto(
  snapshot: DashboardSnapshot,
  topN = 5,
): CategorySpend[] {
  const map: Record<string, { total: number; count: number }> = {};
  const monedaCount: Record<string, number> = {};

  for (const tx of snapshot.recentTransactions) {
    if (tx.tipo !== 'egreso') continue;
    const key = tx.concepto?.trim() || 'Sin concepto';
    if (!map[key]) map[key] = { total: 0, count: 0 };
    map[key].total += tx.monto;
    map[key].count += 1;
    monedaCount[tx.moneda] = (monedaCount[tx.moneda] ?? 0) + 1;
  }

  // Dominant currency for display
  const moneda =
    Object.entries(monedaCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'MXN';

  const sorted = Object.entries(map).sort(([, a], [, b]) => b.total - a.total);
  const top  = sorted.slice(0, topN);
  const rest = sorted.slice(topN);

  const result: CategorySpend[] = top.map(([cat, v], i) => ({
    categoria: cat,
    total: v.total,
    count: v.count,
    moneda,
    color: PALETTE[i % PALETTE.length],
  }));

  if (rest.length > 0) {
    result.push({
      categoria: 'Otros',
      total: rest.reduce((s, [, v]) => s + v.total, 0),
      count: rest.reduce((s, [, v]) => s + v.count, 0),
      moneda,
      color: '#9CA3AF',
    });
  }

  return result;
}

function toMonthlyAmount(monto: number, tipo: string | null, valorStr: string): number {
  const valor = parseFloat(valorStr) || 1;
  switch (tipo) {
    case 'diario':  return (monto / valor) * 30;
    case 'semanal': return (monto / valor) * 4.33;
    case 'mensual': return monto / valor;
    case 'anual':   return (monto / valor) / 12;
    default:        return monto;
  }
}

/**
 * Aggregates active recurrentes by their platform category (falls back to nombre).
 * Amounts are normalized to the selected range in months.
 */
export function getSpendingByRecurrenteCategoria(
  snapshot: DashboardSnapshot,
  rangeMonths = 1,
): CategorySpend[] {
  const map: Record<string, { total: number; count: number; color: string | null; moneda: string }> = {};

  for (const r of snapshot.recurrentesSummary) {
    if (r.pausado || r.estado === 'cancelado') continue;
    const key = r.categoria ?? r.nombre;
    if (!map[key]) map[key] = { total: 0, count: 0, color: r.color, moneda: r.moneda };
    const monthly = toMonthlyAmount(r.monto, r.frecuenciaTipo, r.frecuenciaValor);
    map[key].total += monthly * rangeMonths;
    map[key].count += 1;
  }

  return Object.entries(map)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([cat, v], i) => ({
      categoria: cat,
      total: v.total,
      count: v.count,
      moneda: v.moneda,
      color: v.color ?? PALETTE[i % PALETTE.length],
    }));
}
