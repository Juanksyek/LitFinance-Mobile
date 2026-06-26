import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';
import { buscarMonedaPorCodigo } from '../constants/monedas';
import type { DashboardSnapshot, DashboardRange } from '../types/dashboardSnapshot';
import { fetchDashboardSnapshot } from '../services/dashboardSnapshotService';
import {
  getConceptoBreakdown,
  type TipoFilter,
  type SortMode,
} from '../utils/conceptoBreakdown';

const RANGES: Array<{ label: string; value: DashboardRange }> = [
  { label: 'D',  value: 'day' },
  { label: 'S',  value: 'week' },
  { label: 'M',  value: 'month' },
  { label: '3M', value: '3months' },
  { label: '6M', value: '6months' },
];

function fmtAmount(amount: number, moneda: string | undefined | null): string {
  const sym = buscarMonedaPorCodigo(moneda ?? '')?.simbolo ?? '$';
  if (amount >= 1000) return `${sym}${(amount / 1000).toFixed(1)}k`;
  return `${sym}${amount.toFixed(2)}`;
}

function getSnapshotRange(snapshot: DashboardSnapshot | null): DashboardRange | null {
  const selected = snapshot?.meta?.ranges?.selected;
  if (selected) return selected as DashboardRange;

  const chartRange = snapshot?.chartAggregates?.range;
  return chartRange ? (chartRange as DashboardRange) : null;
}

interface Props {
  /** Initial snapshot from the parent. Component manages its own range independently. */
  initialSnapshot: DashboardSnapshot | null;
  onViewAll?: () => void;
}

export default function SpendingByCategory({ initialSnapshot, onViewAll }: Props) {
  const colors = useThemeColors();
  const [range,    setRange]    = useState<DashboardRange>('month');
  const [tipo,     setTipo]     = useState<TipoFilter>('egreso');
  const [sortMode, setSortMode] = useState<SortMode>('suma');
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(initialSnapshot);
  const [loading,  setLoading]  = useState(false);
  const s = useMemo(() => makeStyles(colors), [colors]);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Keep dashboard-provided snapshots fresh without overwriting a user-selected range.
  useEffect(() => {
    if (!initialSnapshot) return;

    const incomingRange = getSnapshotRange(initialSnapshot) ?? 'month';
    if (incomingRange !== range) return;

    setSnapshot(initialSnapshot);
  }, [initialSnapshot, range]);

  const fetchForRange = useCallback(async (r: DashboardRange) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setLoading(true);
    try {
      const res = await fetchDashboardSnapshot({ range: r, signal });
      if (signal.aborted || !mountedRef.current) return;
      if (res.kind === 'ok') setSnapshot(res.snapshot);
    } catch {
      // ignore aborts
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const handleRangePress = (r: DashboardRange) => {
    setRange(r);
    const incomingRange = getSnapshotRange(initialSnapshot) ?? 'month';
    if (initialSnapshot && incomingRange === r) {
      setSnapshot(initialSnapshot);
      return;
    }
    void fetchForRange(r);
  };

  const { items, totalSum } = useMemo(() => {
    if (!snapshot) return { items: [], grandTotal: 0, totalSum: 0 };
    return getConceptoBreakdown(snapshot, tipo, sortMode);
  }, [snapshot, tipo, sortMode]);

  const grandTotal = items.reduce((sum, i) => sum + i.total, 0);

  const accentColor =
    tipo === 'egreso'  ? '#EF4444' :
    tipo === 'ingreso' ? '#10B981' :
    '#6366F1';

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Gasto por concepto</Text>
      </View>

      {/* Controls row: ranges on the left, tipo icon chips on the right */}
      <View style={s.controlsRow}>
        <View style={s.chipRow}>
          {RANGES.map(r => (
            <TouchableOpacity
              key={r.value}
              style={[
                s.chip,
                { backgroundColor: colors.card, borderColor: colors.border },
                range === r.value && { backgroundColor: colors.button, borderColor: colors.button },
              ]}
              onPress={() => handleRangePress(r.value)}
              activeOpacity={0.7}
              disabled={loading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[s.chipText, { color: colors.text }, range === r.value && { color: '#fff' }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
          {loading && <ActivityIndicator size="small" color={colors.button} style={{ marginLeft: 8 }} />}
        </View>

        <View style={s.filterGroup}>
          {(['ingreso', 'egreso', 'ambos'] as TipoFilter[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[
                s.chip,
                { backgroundColor: colors.card, borderColor: colors.border },
                tipo === t && { backgroundColor: colors.button, borderColor: colors.button },
              ]}
              onPress={() => setTipo(t)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={t === 'ingreso' ? 'arrow-up' : t === 'egreso' ? 'arrow-down' : 'swap-vertical'}
                size={12}
                color={tipo === t ? '#fff' : colors.textTertiary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Rows */}
      {items.length === 0 ? (
        <Text style={[s.empty, { color: colors.textTertiary }]}>
          Sin {tipo === 'ingreso' ? 'ingresos' : tipo === 'egreso' ? 'gastos' : 'movimientos'} en este período
        </Text>
      ) : (
        <>
          {items.map(item => {
            const pct = grandTotal > 0 ? (item.total / grandTotal) * 100 : 0;
            const primaryAmt = sortMode === 'precio' ? item.maxPrecio : item.total;
            return (
              <View key={item.concepto} style={s.row}>
                <View style={[s.dot, { backgroundColor: item.color }]} />
                <View style={s.rowBody}>
                  <View style={s.rowHeader}>
                    <Text style={[s.rowLabel, { color: colors.text }]} numberOfLines={1}>
                      {item.concepto}
                    </Text>
                    <Text style={[s.countBadge, { color: colors.textTertiary }]}>
                      {item.count}x
                    </Text>
                  </View>
                  <View style={[s.barTrack, { backgroundColor: colors.border }]}>
                    <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: item.color }]} />
                  </View>
                </View>
                <View style={s.rowRight}>
                  <Text style={[s.rowAmount, { color: colors.text }]}>
                    {fmtAmount(primaryAmt, item.moneda)}
                  </Text>
                  {sortMode === 'precio' && (
                    <Text style={[s.rowSub, { color: colors.textSecondary }]}>
                      {fmtAmount(item.total, item.moneda)}
                    </Text>
                  )}
                  <Text style={[s.rowPct, { color: colors.textTertiary }]}>
                    {pct.toFixed(0)}%
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Footer */}
          <View style={[s.footer, { borderTopColor: colors.border }]}>
            <Text style={[s.footerLabel, { color: colors.textSecondary }]}>Total acumulado</Text>
            <Text style={[s.footerAmount, { color: accentColor }]}>
              {fmtAmount(totalSum, items[0]?.moneda ?? 'MXN')}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      gap: 10,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title:    { fontSize: 16, fontWeight: '700', color: colors.text },
    viewAll:  { fontSize: 13, color: colors.info },
    chipRow:  { flexDirection: 'row', gap: 6 },
    chip: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    chipText: { fontSize: 11, fontWeight: '600' },
    segmented: {
      flexDirection: 'row',
      borderRadius: 10,
      padding: 2,
    },
    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    filterGroup: {
      flexDirection: 'row',
      gap: 6,
    },
    seg: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: 8,
    },
    segText:       { fontSize: 12, fontWeight: '500' },
    segTextActive: { color: '#fff', fontWeight: '700' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      flexShrink: 0,
    },
    rowBody:    { flex: 1, gap: 4 },
    rowHeader:  { flexDirection: 'row', alignItems: 'center' },
    rowLabel:   { fontSize: 13, flex: 1 },
    countBadge: { fontSize: 11, marginLeft: 4 },
    barTrack: {
      height: 5,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill:    { height: 5, borderRadius: 3 },
    rowRight:   { alignItems: 'flex-end', minWidth: 68 },
    rowAmount:  { fontSize: 13, fontWeight: '700' },
    rowSub:     { fontSize: 11 },
    rowPct:     { fontSize: 11 },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      paddingTop: 10,
      marginTop: 2,
    },
    footerLabel:  { fontSize: 13 },
    footerAmount: { fontSize: 14, fontWeight: '700' },
    empty:        { textAlign: 'center', paddingVertical: 24, fontSize: 13 },
  });
}
