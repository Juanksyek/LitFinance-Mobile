import type { DashboardSnapshot } from '../types/dashboardSnapshot';

export type TipoFilter = 'egreso' | 'ingreso' | 'ambos';
export type SortMode  = 'suma' | 'precio';

export interface ConceptoEntry {
  concepto: string;
  /** Sum of all matching transactions */
  total: number;
  /** Highest single transaction amount */
  maxPrecio: number;
  /** Number of transactions */
  count: number;
  moneda: string;
  color: string;
}

export interface ConceptoBreakdown {
  items: ConceptoEntry[];
  grandTotal: number;
  totalSum: number;
}

const PALETTE = [
  '#6366F1', '#F59E0B', '#10B981', '#EF4444',
  '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6',
];

/**
 * Groups recentTransactions by concepto, applies tipo filter,
 * returns top N entries sorted by the chosen mode.
 * Prefers server-aggregated snapshot.conceptoBreakdown when available
 * (full dataset, not limited by recentLimit).
 */
export function getConceptoBreakdown(
  snapshot: DashboardSnapshot,
  tipo: TipoFilter = 'egreso',
  sortMode: SortMode = 'suma',
  topN = 6,
): ConceptoBreakdown {
  // --- Prefer server-aggregated payload when available ---
  if (snapshot.conceptoBreakdown) {
    const breakdown = snapshot.conceptoBreakdown;
    let source: Array<{ concepto: string; total: number; maxPrecio: number; count: number; moneda: string }>;
    let grandTotalServer: number;

    if (tipo === 'egreso') {
      source = breakdown.egresos;
      grandTotalServer = breakdown.totalEgresos;
    } else if (tipo === 'ingreso') {
      source = breakdown.ingresos;
      grandTotalServer = breakdown.totalIngresos;
    } else {
      // Merge both arrays by concepto
      const map = new Map<string, { total: number; maxPrecio: number; count: number; moneda: string }>();
      for (const row of [...breakdown.egresos, ...breakdown.ingresos]) {
        const existing = map.get(row.concepto);
        if (existing) {
          existing.total    += row.total;
          existing.maxPrecio = Math.max(existing.maxPrecio, row.maxPrecio);
          existing.count    += row.count;
        } else {
          map.set(row.concepto, { ...row });
        }
      }
      source = Array.from(map.entries()).map(([concepto, v]) => ({ concepto, ...v }));
      grandTotalServer = breakdown.totalEgresos + breakdown.totalIngresos;
    }

    const sorted = [...source].sort((a, b) =>
      sortMode === 'precio' ? b.maxPrecio - a.maxPrecio : b.total - a.total,
    );

    const top  = sorted.slice(0, topN);
    const rest = sorted.slice(topN);

    const items: ConceptoEntry[] = top.map((row, i) => ({
      concepto:  row.concepto,
      total:     row.total,
      maxPrecio: row.maxPrecio,
      count:     row.count,
      moneda:    row.moneda,
      color:     PALETTE[i % PALETTE.length],
    }));

    if (rest.length > 0) {
      const dominantMoneda =
        source.reduce((acc, r) => {
          acc[r.moneda] = (acc[r.moneda] ?? 0) + r.count;
          return acc;
        }, {} as Record<string, number>);
      const dm = Object.entries(dominantMoneda).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'MXN';

      items.push({
        concepto:  'Otros',
        total:     rest.reduce((s, r) => s + r.total, 0),
        maxPrecio: Math.max(...rest.map(r => r.maxPrecio)),
        count:     rest.reduce((s, r) => s + r.count, 0),
        moneda:    dm,
        color:     '#9CA3AF',
      });
    }

    const totalSum = top.reduce((s, r) => s + r.total, 0) + (rest.length > 0 ? rest.reduce((s, r) => s + r.total, 0) : 0);
    return { items, grandTotal: grandTotalServer, totalSum };
  }

  // --- Fallback: compute from recentTransactions ---
  const map: Record<string, { total: number; maxPrecio: number; count: number; moneda: string }> = {};
  const monedaCount: Record<string, number> = {};

  for (const tx of snapshot.recentTransactions) {
    if (tipo !== 'ambos' && tx.tipo !== tipo) continue;
    const key = tx.concepto?.trim() || 'Sin concepto';
    if (!map[key]) map[key] = { total: 0, maxPrecio: 0, count: 0, moneda: tx.moneda ?? 'MXN' };
    map[key].total += tx.monto;
    map[key].count += 1;
    if (tx.monto > map[key].maxPrecio) map[key].maxPrecio = tx.monto;
    monedaCount[tx.moneda] = (monedaCount[tx.moneda] ?? 0) + 1;
  }

  const dominantMoneda =
    Object.entries(monedaCount).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'MXN';

  const sorted = Object.entries(map).sort(([, a], [, b]) =>
    sortMode === 'precio' ? b.maxPrecio - a.maxPrecio : b.total - a.total,
  );

  const top  = sorted.slice(0, topN);
  const rest = sorted.slice(topN);

  const items: ConceptoEntry[] = top.map(([concepto, v], i) => ({
    concepto,
    total:     v.total,
    maxPrecio: v.maxPrecio,
    count:     v.count,
    moneda:    v.moneda,
    color:     PALETTE[i % PALETTE.length],
  }));

  if (rest.length > 0) {
    items.push({
      concepto:  'Otros',
      total:     rest.reduce((s, [, v]) => s + v.total, 0),
      maxPrecio: Math.max(...rest.map(([, v]) => v.maxPrecio)),
      count:     rest.reduce((s, [, v]) => s + v.count, 0),
      moneda:    dominantMoneda,
      color:     '#9CA3AF',
    });
  }

  const totalSum = items.reduce((s, i) => s + i.total, 0);

  return { items, grandTotal: totalSum, totalSum };
}
