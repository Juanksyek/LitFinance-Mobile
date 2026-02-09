import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/useThemeColors';
import type {
  AnalyticsResumenInteligente,
  SmartInsight,
  SmartInsightSeverity,
  SmartSerieMensualBucket,
  SmartTopConceptoGasto,
} from '../../services/analyticsService';

type TabKey = 'insights' | 'tops' | 'serie' | 'recurrentes';

type Props = {
  data: AnalyticsResumenInteligente;
  isLoading?: boolean;
  onPressUpgrade?: () => void;
  onPressRefresh?: () => void;
};

const isAndroid = Platform.OS === 'android';

const formatCurrency = (value: number, currency: string) => {
  const n = Number.isFinite(value) ? value : 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${abs.toLocaleString('es-MX')} ${currency}`;
};

const formatCompact = (value: number) => {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1_000)}K`;
  return `${sign}${Math.round(abs).toLocaleString('es-MX')}`;
};

const safeText = (v?: string | null) => {
  if (v == null) return '';
  try {
    // Normalize to composed form (NFC) so accents and special chars render consistently
    return String(v).normalize ? String(v).normalize('NFC') : String(v);
  } catch (e) {
    return String(v);
  }
};

const severityTone = (sev: SmartInsightSeverity) => {
  switch (sev) {
    case 'success':
      return { icon: 'sparkles', color: '#10B981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.28)' } as const;
    case 'warning':
      return { icon: 'warning', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.28)' } as const;
    case 'danger':
      return { icon: 'alert-circle', color: '#EF4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.28)' } as const;
    case 'info':
    default:
      return { icon: 'information-circle', color: '#60A5FA', bg: 'rgba(96,165,250,0.14)', border: 'rgba(96,165,250,0.28)' } as const;
  }
};

const monthLabel = (yyyyMm: string) => {
  // yyyy-mm
  const [y, m] = yyyyMm.split('-').map((p) => Number(p));
  if (!y || !m) return yyyyMm;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
};

const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
};

const Segmented = ({
  active,
  onChange,
  tabs,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  tabs: Array<{ key: TabKey; label: string; icon: any }>;
}) => {
  const colors = useThemeColors();
  return (
    <View style={[styles.segmentWrap, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            activeOpacity={0.9}
            style={[
              styles.segmentBtn,
              {
                backgroundColor: isActive ? colors.button : 'transparent',
                borderColor: isActive ? colors.button : 'transparent',
              },
            ]}
          >
            <Ionicons name={t.icon} size={14} color={isActive ? '#fff' : colors.textSecondary} />
            <Text style={[styles.segmentText, { color: isActive ? '#fff' : colors.textSecondary }]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const InsightRow = ({ item }: { item: SmartInsight }) => {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const tone = severityTone(item.severidad);

  const toggle = () => {
    if (isAndroid && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={toggle}
      style={[styles.insightCard, { backgroundColor: tone.bg, borderColor: tone.border }]}
    >
      <View style={styles.insightHeader}>
        <View style={[styles.insightIconBadge, { backgroundColor: 'rgba(0,0,0,0.12)' }]}>
          <Ionicons name={tone.icon as any} size={16} color={tone.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.insightTitle, { color: colors.text }]} numberOfLines={2}>
            {safeText(item.titulo)}
          </Text>
          <Text style={[styles.insightCode, { color: colors.textSecondary }]}>{safeText(item.codigo)}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </View>
      {open && (
        <Text style={[styles.insightDetail, { color: colors.textSecondary }]}>
          {safeText(item.detalle)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const SerieMini = ({
  buckets,
  currency,
}: {
  buckets: SmartSerieMensualBucket[];
  currency: string;
}) => {
  const colors = useThemeColors();
  const [selected, setSelected] = useState(0);

  const data = useMemo(() => {
    const last = buckets.slice(-8);
    const maxAbs = Math.max(
      1,
      ...last.map((b) => Math.max(Math.abs(b.ingresos || 0), Math.abs(b.gastos || 0), Math.abs(b.balance || 0)))
    );
    return { last, maxAbs };
  }, [buckets]);

  if (!data.last.length) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
        <Ionicons name="analytics" size={18} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Sin datos de serie mensual.</Text>
      </View>
    );
  }

  const b = data.last[Math.min(selected, data.last.length - 1)];

  return (
    <View>
      <View style={[styles.miniChart, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
        {data.last.map((bucket, idx) => {
          const hIn = Math.round((Math.abs(bucket.ingresos || 0) / data.maxAbs) * 46) + 6;
          const hOut = Math.round((Math.abs(bucket.gastos || 0) / data.maxAbs) * 46) + 6;
          const isSel = idx === selected;

          return (
            <TouchableOpacity
              key={`${bucket.mes}-${idx}`}
              activeOpacity={0.85}
              onPress={() => setSelected(idx)}
              style={styles.barCol}
            >
              <View style={[styles.bar, { height: hIn, backgroundColor: isSel ? '#10B981' : 'rgba(16,185,129,0.6)' }]} />
              <View style={[styles.bar, { height: hOut, backgroundColor: isSel ? '#EF4444' : 'rgba(239,68,68,0.6)' }]} />
              <Text style={[styles.barLabel, { color: colors.textTertiary }]}>{monthLabel(bucket.mes)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.monthDetail, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.monthDetailRow}>
          <Text style={[styles.monthDetailTitle, { color: colors.text }]}>{monthLabel(b.mes)}</Text>
          {!!b.gastosRecurrentes && (
            <Text style={[styles.monthDetailMuted, { color: colors.textSecondary }]}>
              Recurrentes: {formatCompact(b.gastosRecurrentes)}
            </Text>
          )}
        </View>

        <View style={styles.monthKpis}>
          <View style={styles.kpiPill}>
            <Text style={[styles.kpiLabel, { color: '#10B981' }]}>Ingresos</Text>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(b.ingresos || 0, currency)}</Text>
          </View>
          <View style={styles.kpiPill}>
            <Text style={[styles.kpiLabel, { color: '#EF4444' }]}>Gastos</Text>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(b.gastos || 0, currency)}</Text>
          </View>
          <View style={styles.kpiPill}>
            <Text style={[styles.kpiLabel, { color: (b.balance || 0) >= 0 ? '#10B981' : '#EF4444' }]}>Balance</Text>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(b.balance || 0, currency)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const TopConceptos = ({ items, currency }: { items: SmartTopConceptoGasto[]; currency: string }) => {
  const colors = useThemeColors();
  const normalized = useMemo(() => {
    const arr = (items || []).slice(0, 8).map((it) => {
      const name = safeText(it.concepto?.nombre || it.nombre || 'Concepto');
      const color = it.concepto?.color || it.color || '#60A5FA';
      const icono = it.concepto?.icono || it.icono;
      return { ...it, name, color, icono };
    });
    const max = Math.max(1, ...arr.map((i) => Math.abs(i.monto || 0)));
    return { arr, max };
  }, [items]);

  if (!normalized.arr.length) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
        <Ionicons name="pricetags" size={18} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{'A\u00FAn no hay tops de conceptos.'}</Text>
      </View>
    );
  }

  return (
    <View>
      {normalized.arr.map((it, idx) => {
        const delta = Number.isFinite(it.deltaVsPeriodoAnterior as any) ? Number(it.deltaVsPeriodoAnterior) : null;
        const deltaColor = delta === null ? colors.textSecondary : delta > 0 ? '#EF4444' : delta < 0 ? '#10B981' : colors.textSecondary;
        return (
          <View
            key={`${it.concepto?.id || it.nombre || 'c'}-${idx}`}
            style={[styles.topRow, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
          >
            <View style={[styles.topIcon, { backgroundColor: `${it.color}22` }]}>
              <Ionicons name={(it.icono as any) || 'pricetag'} size={16} color={it.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.topRowHeader}>
                <Text style={[styles.topName, { color: colors.text }]} numberOfLines={1}>
                  {it.name}
                </Text>
                <Text style={[styles.topAmt, { color: colors.text }]}>{formatCurrency(it.monto || 0, currency)}</Text>
              </View>
              <View style={styles.topRowSub}>
                <ProgressBar value={Math.abs(it.monto || 0)} max={normalized.max} color={it.color} />
                {delta !== null && (
                  <View style={styles.deltaPill}>
                    <Ionicons name={delta > 0 ? 'arrow-up' : delta < 0 ? 'arrow-down' : 'remove'} size={12} color={deltaColor} />
                    <Text style={[styles.deltaText, { color: deltaColor }]}>{Math.abs(delta).toFixed(0)}%</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default function SmartResumenCard({ data, isLoading, onPressUpgrade, onPressRefresh }: Props) {
  const colors = useThemeColors();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(14)).current;
  const [tab, setTab] = useState<TabKey>('insights');

  useEffect(() => {
    if (isAndroid && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 70, friction: 8 }),
    ]).start();
  }, [isLoading, fade, slide]);

  const isPositive = (data?.totales?.balance || 0) >= 0;
  const accent = colors.button;

  const tabs = useMemo(
    () => [
      { key: 'insights' as const, label: 'Insights', icon: 'sparkles-outline' },
      { key: 'tops' as const, label: 'Tops', icon: 'pricetags-outline' },
      { key: 'serie' as const, label: 'Serie', icon: 'bar-chart-outline' },
      { key: 'recurrentes' as const, label: 'Recurrentes', icon: 'repeat-outline' },
    ],
    []
  );

  const content = useMemo(() => {
    if (tab === 'insights') {
      const items = (data.insights || []).slice(0, 10);
      if (!items.length) {
        return (
          <View style={[styles.emptyBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={18} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{'A\u00FAn no hay insights para este periodo.'}</Text>
          </View>
        );
      }
      return (
        <View>
          {items.map((it) => (
            <InsightRow key={it.codigo} item={it} />
          ))}
        </View>
      );
    }

    if (tab === 'tops') {
      return <TopConceptos items={data.topConceptosGasto || []} currency={data.moneda} />;
    }

    if (tab === 'serie') {
      return <SerieMini buckets={data.serieMensual || []} currency={data.moneda} />;
    }

    // recurrentes
    if (!data.recurrentes) {
      return (
        <View style={[styles.emptyBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Ionicons name="repeat" size={18} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay datos de recurrentes en este periodo.</Text>
        </View>
      );
    }

    return (
      <View>
        <View style={[styles.recurrentBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <View style={styles.recurrentHeader}>
            <Text style={[styles.recurrentTitle, { color: colors.text }]}>Total ejecutado</Text>
            <Text style={[styles.recurrentAmt, { color: colors.text }]}>
              {formatCurrency(data.recurrentes.totalEjecutado || 0, data.moneda)}
            </Text>
          </View>
          {(data.recurrentes.top || []).slice(0, 6).map((r, idx) => (
            <View key={`${r.nombre}-${idx}`} style={styles.recurrentRow}>
              <Text style={[styles.recurrentName, { color: colors.textSecondary }]} numberOfLines={1}>
                {safeText(r.nombre)}
              </Text>
              <Text style={[styles.recurrentRowAmt, { color: colors.text }]}>
                {formatCurrency(r.monto || 0, r.moneda || data.moneda)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }, [tab, data, colors]);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <LinearGradient
        colors={[`${accent}22`, `${accent}08`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card, shadowColor: colors.shadow }]}
      >
        <View style={styles.topHeader}>
          <View style={styles.titleBlock}>
            <View style={[styles.premiumBadge, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
              <Ionicons name="sparkles" size={14} color={accent} />
              <Text style={[styles.premiumBadgeText, { color: accent }]}>SMART</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Resumen Inteligente</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
              {data.periodo?.descripcion || 'Periodo'} • {data.periodo?.fechaInicio?.slice(0, 10)} → {data.periodo?.fechaFin?.slice(0, 10)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onPressRefresh}
            activeOpacity={0.85}
            style={[styles.refreshBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
          >
            <Ionicons name="refresh" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
          >
            <Text style={[styles.kpiSmall, { color: colors.textSecondary }]}>Ingresos</Text>
            <Text style={[styles.kpiBig, { color: colors.text }]}>{formatCurrency(data.totales.ingresos || 0, data.moneda)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
          >
            <Text style={[styles.kpiSmall, { color: colors.textSecondary }]}>Gastos</Text>
            <Text style={[styles.kpiBig, { color: colors.text }]}>{formatCurrency(data.totales.gastos || 0, data.moneda)}</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
          >
            <Text style={[styles.kpiSmall, { color: colors.textSecondary }]}>Balance</Text>
            <Text style={[styles.kpiBig, { color: isPositive ? '#10B981' : '#EF4444' }]}>
              {formatCurrency(data.totales.balance || 0, data.moneda)}
            </Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
          >
            <Text style={[styles.kpiSmall, { color: colors.textSecondary }]}>Movimientos</Text>
            <Text style={[styles.kpiBig, { color: colors.text }]}>{formatCompact(data.totales.movimientos || 0)}</Text>
          </View>
        </View>

        <Segmented active={tab} onChange={setTab} tabs={tabs} />

        <View style={{ marginTop: 10 }}>{content}</View>

        {!!onPressUpgrade && (
          <TouchableOpacity
            onPress={onPressUpgrade}
            activeOpacity={0.9}
            style={[styles.upgradeCta, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}
          >
            <Ionicons name="diamond" size={16} color={accent} />
            <Text style={[styles.upgradeText, { color: accent }]}>Mejorar mi plan</Text>
            <Ionicons name="chevron-forward" size={16} color={accent} />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },

  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleBlock: { flex: 1 },

  premiumBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  premiumBadgeText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },

  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  kpiSmall: { fontSize: 12, fontWeight: '800' },
  kpiBig: { marginTop: 6, fontSize: 14, fontWeight: '900' },

  segmentWrap: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentText: { fontSize: 12, fontWeight: '900' },

  insightCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightIconBadge: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 13, fontWeight: '900' },
  insightCode: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  insightDetail: { marginTop: 10, fontSize: 12, fontWeight: '700', lineHeight: 16 },

  emptyBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: { fontSize: 12, fontWeight: '800', flex: 1 },

  miniChart: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barCol: { width: 34, alignItems: 'center', gap: 4 },
  bar: { width: 10, borderRadius: 8 },
  barLabel: { fontSize: 10, fontWeight: '900', marginTop: 2 },

  monthDetail: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  monthDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthDetailTitle: { fontSize: 12, fontWeight: '900' },
  monthDetailMuted: { fontSize: 11, fontWeight: '800' },

  monthKpis: { flexDirection: 'row', gap: 10, marginTop: 10 },
  kpiPill: { flex: 1 },
  kpiLabel: { fontSize: 11, fontWeight: '900' },
  kpiValue: { marginTop: 4, fontSize: 11, fontWeight: '900' },

  topRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  topIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  topRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  topName: { fontSize: 13, fontWeight: '900', flex: 1 },
  topAmt: { fontSize: 12, fontWeight: '900' },
  topRowSub: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.25)',
    overflow: 'hidden',
    flex: 1,
  },
  progressFill: { height: 8, borderRadius: 999 },

  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deltaText: { fontSize: 11, fontWeight: '900' },

  recurrentBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  recurrentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  recurrentTitle: { fontSize: 12, fontWeight: '900' },
  recurrentAmt: { fontSize: 12, fontWeight: '900' },
  recurrentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  recurrentName: { fontSize: 12, fontWeight: '800', flex: 1 },
  recurrentRowAmt: { fontSize: 12, fontWeight: '900' },

  upgradeCta: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  upgradeText: { fontSize: 13, fontWeight: '900' },
});
