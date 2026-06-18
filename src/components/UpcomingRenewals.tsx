import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';
import type { DashboardSnapshot } from '../types/dashboardSnapshot';
import { getUpcomingRenewals, type UpcomingRenewal } from '../utils/upcomingRenewals';

const WINDOWS = [
  { label: '7d',  days: 7 },
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
];

function fmtAmount(amount: number, moneda: string): string {
  const sym =
    moneda === 'MXN' ? '$' :
    moneda === 'USD' ? 'US$' :
    moneda === 'EUR' ? '€' : `${moneda} `;
  return `${sym}${amount.toFixed(0)}`;
}

interface Props {
  snapshot: DashboardSnapshot | null;
  onViewAll?: () => void;
}

export default function UpcomingRenewals({ snapshot, onViewAll }: Props) {
  const colors = useThemeColors();
  const [windowDays, setWindowDays] = useState(7);
  const s = useMemo(() => makeStyles(colors), [colors]);

  const items: UpcomingRenewal[] = useMemo(() => {
    if (!snapshot) return [];
    return getUpcomingRenewals(snapshot.recurrentesSummary, windowDays);
  }, [snapshot, windowDays]);

  if (!snapshot) return null;

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Próximas renovaciones</Text>
      </View>

      {/* Window chips */}
      <View style={s.chipRow}>
        {WINDOWS.map(w => (
          <TouchableOpacity
            key={w.days}
            style={[
              s.chip,
              { backgroundColor: colors.card, borderColor: colors.border },
              windowDays === w.days && { backgroundColor: colors.button, borderColor: colors.button },
            ]}
            onPress={() => setWindowDays(w.days)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[s.chipText, { color: colors.text }, windowDays === w.days && { color: '#fff' }]}>
              {w.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {items.length === 0 ? (
        <View style={s.emptyBox}>
          <View style={s.emptyIconBox}>
            <Ionicons name="checkmark" size={22} color="#10B981" />
          </View>
          <Text style={s.emptyTitle}>¡Sin renovaciones!</Text>
          <Text style={s.emptySub}>
            No hay cobros en los próximos {windowDays} días.
          </Text>
        </View>
      ) : (
        <View style={s.list}>
          {items.map((item, idx) => {
            const urgency =
              item.daysUntil === 0 ? '#EF4444' :
              item.daysUntil <= 3 ? '#F59E0B' :
              '#6366F1';
            const label =
              item.daysUntil === 0 ? 'Hoy' :
              item.daysUntil === 1 ? 'Mañana' :
              `En ${item.daysUntil} días`;

            return (
              <React.Fragment key={item.id}>
                {idx > 0 && <View style={s.sep} />}
                <View style={s.itemRow}>
                  <View style={[s.brandDot, { backgroundColor: item.color ?? '#6366F1' }]} />
                  <View style={s.itemBody}>
                    <Text style={s.itemName} numberOfLines={1}>{item.nombre}</Text>
                    {item.categoria ? (
                      <Text style={[s.itemCat, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.categoria}
                      </Text>
                    ) : null}
                  </View>
                  <View style={s.itemRight}>
                    <Text style={s.itemAmount}>{fmtAmount(item.monto, item.moneda)}</Text>
                    <Text style={[s.itemDays, { color: urgency }]}>{label}</Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>
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
      gap: 12,
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
    title:   { fontSize: 16, fontWeight: '700', color: colors.text },
    viewAll: { fontSize: 13, color: colors.info },
    chipRow: { flexDirection: 'row', gap: 6 },
    chip: {
      height: 32,
      paddingHorizontal: 10,
      minWidth: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    chipText: { fontSize: 11, fontWeight: '600' },
    emptyBox: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 6,
    },
    emptyIconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#10B98120',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    emptySub:   { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    list:       { gap: 2 },
    sep:        { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
    },
    brandDot: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
    itemBody:   { flex: 1 },
    itemName:   { fontSize: 14, fontWeight: '600', color: colors.text },
    itemCat:    { fontSize: 12, marginTop: 1 },
    itemRight:  { alignItems: 'flex-end' },
    itemAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
    itemDays:   { fontSize: 12, fontWeight: '600', textAlign: 'right' },
  });
}
