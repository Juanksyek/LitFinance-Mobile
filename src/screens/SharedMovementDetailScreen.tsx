import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useThemeColors } from '../theme/useThemeColors';
import Toast from 'react-native-toast-message';
import EventBus from '../utils/eventBus';
import * as sharedService from '../services/sharedSpacesService';
import { userProfileService } from '../services/userProfileService';
import userService from '../services/userService';
import type {
  SharedMovementDetail,
  SharedMovementContribution,
  SharedMovementSplit,
  MemberDifference,
  AccountImpactResult,
} from '../types/sharedSpaces';
import {
  MOVEMENT_TYPE_LABELS,
  SPLIT_MODE_LABELS,
} from '../types/sharedSpaces';

const { width: SCREEN_W } = Dimensions.get('window');

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const withAlpha = (color: string, alpha: number) => {
  const a = clamp(alpha, 0, 1);
  const c = (color || '').trim();
  if (c.startsWith('#')) {
    const hex = c.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((x: string) => x + x).join('') : hex;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      if ([r, g, b].every((x) => Number.isFinite(x))) return `rgba(${r},${g},${b},${a})`;
    }
  }
  return c;
};

function formatCurrency(amount: number, currency?: string): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const str = abs.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${str}${currency ? ` ${currency}` : ''}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Resolves a userId to a display name */
function UserName({ userId, fallback, style }: { userId: string; fallback?: string; style?: any }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!userId) {
      setName(fallback ?? 'Miembro');
      return;
    }
    (async () => {
      try {
        const pub = await userService.getPublicUser(userId);
        if (mounted) {
          setName(pub?.nombre ?? fallback ?? `Usuario ${userId.slice(-6)}`);
        }
      } catch {
        if (mounted) setName(fallback ?? `Usuario ${userId.slice(-6)}`);
      }
    })();
    return () => { mounted = false; };
  }, [userId, fallback]);

  return <Text style={style} numberOfLines={1}>{name ?? fallback ?? 'Miembro'}</Text>;
}

export default function SharedMovementDetailScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ SharedMovementDetail: { movementId: string; spaceId: string } }, 'SharedMovementDetail'>>();
  const { movementId, spaceId } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<SharedMovementDetail | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [enter]);

  // Load current user ID
  useEffect(() => {
    (async () => {
      try {
        const profile = await userProfileService.getCachedProfile();
        setCurrentUserId(profile?.id ?? null);
      } catch {}
    })();
  }, []);

  const fetchDetail = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await sharedService.getMovementDetail(spaceId, movementId);
      setDetail(res);
    } catch (err: any) {
      if (!silent) {
        Toast.show({ type: 'error', text1: 'Error al cargar', text2: err?.message ?? '' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [spaceId, movementId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDetail(true);
  }, [fetchDetail]);

  const isCreator = useMemo(() => {
    if (!detail?.movement || !currentUserId) return false;
    return detail.movement.createdByUserId === currentUserId;
  }, [detail, currentUserId]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancelar movimiento',
      '\u00BFSeguro que deseas cancelar este movimiento? Esta acci\u00F3n no se puede deshacer.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'S\u00ED, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await sharedService.cancelMovement(spaceId, movementId);
              Toast.show({ type: 'success', text1: 'Movimiento cancelado' });
              EventBus.emit('sharedSpaceChanged');
              navigation.goBack();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? '' });
            }
          },
        },
      ],
    );
  }, [spaceId, movementId, navigation]);

  if (loading && !detail) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.button} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando detalle…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Movimiento no encontrado</Text>
          <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.button, fontWeight: '800' }}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const mov = detail.movement;
  const isExpense = mov.tipo === 'expense' || mov.tipo === 'adjustment';
  const colorTone = isExpense ? '#EF4444' : '#10B981';
  const typeLabel = MOVEMENT_TYPE_LABELS[mov.tipo] ?? mov.tipo;
  const splitLabel = SPLIT_MODE_LABELS[mov.splitMode] ?? mov.splitMode;
  const isCancelled = mov.estado === 'cancelled';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.headerWrap, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              Detalle del movimiento
            </Text>
          </View>

          <View style={{ width: 42 }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.button} />}
      >
        <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>

          {/* Main Info Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardTop}>
              <View style={[styles.iconWrap, { backgroundColor: withAlpha(colorTone, 0.12) }]}>
                <Ionicons name={isExpense ? 'arrow-up-outline' : 'arrow-down-outline'} size={22} color={colorTone} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.movTitle, { color: colors.text }]} numberOfLines={2}>
                  {mov.titulo}
                </Text>
                <Text style={[styles.movMeta, { color: colors.textSecondary }]}>
                  {typeLabel} {'\u2022'} {splitLabel}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.movAmount, { color: colorTone }]}>
                  {isExpense ? '-' : '+'}
                  {formatCurrency(mov.montoTotal, mov.moneda)}
                </Text>
              </View>
            </View>

            {isCancelled && (
              <View style={[styles.cancelBadge, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
                <Text style={styles.cancelBadgeText}>Cancelado</Text>
              </View>
            )}

            {/* Details Grid */}
            <View style={styles.detailsGrid}>
              <DetailRow label="Fecha" value={formatDate(mov.fechaMovimiento)} colors={colors} />
              <DetailRow label="Estado" value={mov.estado} colors={colors} />
              <DetailRow label="Moneda" value={mov.moneda} colors={colors} />
              <DetailRow label="Visibilidad" value={mov.visibility === 'all' ? 'Todos' : mov.visibility === 'admins_only' ? 'Solo admins' : 'Solo creador'} colors={colors} />
              {mov.descripcion ? <DetailRow label="Descripci\u00F3n" value={mov.descripcion} colors={colors} /> : null}
              {mov.notes ? <DetailRow label="Notas" value={mov.notes} colors={colors} /> : null}
              {mov.tags && mov.tags.length > 0 ? <DetailRow label="Etiquetas" value={mov.tags.join(', ')} colors={colors} /> : null}
            </View>

            {/* Created by */}
            <View style={[styles.creatorRow, { borderTopColor: colors.border }]}>
              <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.creatorLabel, { color: colors.textSecondary }]}>Creado por: </Text>
              <UserName userId={mov.createdByUserId} style={[styles.creatorName, { color: colors.text }]} />
            </View>
          </View>

          {/* Contributions */}
          {detail.contributions.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Ionicons name="wallet-outline" size={16} color={colors.button} /> Contribuciones
              </Text>
              {detail.contributions.map((c, idx) => (
                <ContributionRow key={c.contributionId ?? idx} contribution={c} moneda={mov.moneda} colors={colors} />
              ))}
            </View>
          )}

          {/* Splits */}
          {detail.splits.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Ionicons name="git-branch-outline" size={16} color={colors.button} /> Distribuci{'\u00F3'}n
              </Text>
              {detail.splits.map((s, idx) => (
                <SplitRow key={s.splitId ?? idx} split={s} moneda={mov.moneda} splitMode={mov.splitMode} colors={colors} />
              ))}
            </View>
          )}

          {/* Member Differences */}
          {detail.memberDifferences.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Ionicons name="swap-horizontal-outline" size={16} color={colors.button} /> Diferencias
              </Text>
              {detail.memberDifferences.map((d, idx) => (
                <DifferenceRow key={d.memberId ?? idx} diff={d} moneda={mov.moneda} colors={colors} />
              ))}
            </View>
          )}

          {/* Account Impacts */}
          {detail.impacts && detail.impacts.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Ionicons name="flash-outline" size={16} color={colors.button} /> Impactos en cuenta
              </Text>
              {detail.impacts.map((impact, idx) => (
                <ImpactRow key={impact.impactId ?? idx} impact={impact} colors={colors} />
              ))}
            </View>
          )}

          {/* Actions — only if creator */}
          {isCreator && !isCancelled && (
            <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.dangerBtn,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Ionicons name="close-circle-outline" size={18} color="#FFF" />
                <Text style={styles.dangerBtnText}>Cancelar movimiento</Text>
              </Pressable>
            </View>
          )}

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function DetailRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function ContributionRow({ contribution, moneda, colors }: { contribution: SharedMovementContribution; moneda: string; colors: any }) {
  const typeLabel =
    contribution.contributionType === 'payer'
      ? 'Pagador'
      : contribution.contributionType === 'shared_source'
        ? 'Fuente compartida'
        : 'Manual';

  return (
    <View style={[styles.subRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.subAvatar, { backgroundColor: withAlpha(colors.button, 0.1) }]}>
        <Ionicons name="person-outline" size={14} color={colors.button} />
      </View>
      <View style={{ flex: 1 }}>
        <UserName userId={contribution.userId ?? ''} fallback={`Miembro ${(contribution.memberId ?? '').slice(-5)}`} style={[styles.subName, { color: colors.text }]} />
        <Text style={[styles.subMeta, { color: colors.textSecondary }]}>{typeLabel}</Text>
      </View>
      <Text style={[styles.subAmount, { color: '#10B981' }]}>
        {formatCurrency(contribution.amountContributed, moneda)}
      </Text>
    </View>
  );
}

function SplitRow({ split, moneda, splitMode, colors }: { split: SharedMovementSplit; moneda: string; splitMode: string; colors: any }) {
  const included = split.included !== false;
  let detail = '';
  if (split.amountAssigned != null) detail = formatCurrency(split.amountAssigned, moneda);
  else if (split.percentage != null) detail = `${split.percentage}%`;
  else if (split.units != null) detail = `${split.units} uds.`;

  return (
    <View style={[styles.subRow, { borderBottomColor: colors.border, opacity: included ? 1 : 0.5 }]}>
      <View style={[styles.subAvatar, { backgroundColor: withAlpha(included ? '#10B981' : '#94A3B8', 0.12) }]}>
        <Ionicons name={included ? 'checkmark' : 'remove'} size={14} color={included ? '#10B981' : '#94A3B8'} />
      </View>
      <View style={{ flex: 1 }}>
        <UserName userId={split.userId ?? ''} fallback={`Miembro ${(split.memberId ?? '').slice(-5)}`} style={[styles.subName, { color: colors.text }]} />
        <Text style={[styles.subMeta, { color: colors.textSecondary }]}>
          {split.roleInSplit ?? (included ? 'Participante' : 'Excluido')}
        </Text>
      </View>
      {detail ? (
        <Text style={[styles.subAmount, { color: colors.text }]}>{detail}</Text>
      ) : null}
    </View>
  );
}

function DifferenceRow({ diff, moneda, colors }: { diff: MemberDifference; moneda: string; colors: any }) {
  const diffColor = diff.difference > 0 ? '#10B981' : diff.difference < 0 ? '#EF4444' : colors.textSecondary;
  return (
    <View style={[styles.subRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.subAvatar, { backgroundColor: withAlpha(diffColor, 0.12) }]}>
        <Ionicons name="swap-horizontal-outline" size={14} color={diffColor} />
      </View>
      <View style={{ flex: 1 }}>
        <UserName userId={diff.userId} fallback={`Miembro ${(diff.memberId ?? '').slice(-5)}`} style={[styles.subName, { color: colors.text }]} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
          <Text style={[styles.subMeta, { color: colors.textSecondary }]}>
            Aport{'\u00F3'}: {formatCurrency(diff.contributed, moneda)}
          </Text>
          <Text style={[styles.subMeta, { color: colors.textSecondary }]}>
            Asignado: {formatCurrency(diff.assigned, moneda)}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.subAmount, { color: diffColor }]}>
          {diff.difference > 0 ? '+' : ''}{formatCurrency(diff.difference, moneda)}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, marginTop: 1 }}>
          {diff.difference > 0 ? 'Le deben' : diff.difference < 0 ? 'Debe' : 'OK'}
        </Text>
      </View>
    </View>
  );
}

function ImpactRow({ impact, colors }: { impact: AccountImpactResult; colors: any }) {
  const statusColor =
    impact.status === 'applied' ? '#10B981'
    : impact.status === 'reverted' ? '#F59E0B'
    : impact.status === 'failed' ? '#EF4444'
    : colors.textSecondary;

  const statusLabel =
    impact.status === 'applied' ? 'Aplicado'
    : impact.status === 'reverted' ? 'Revertido'
    : impact.status === 'failed' ? 'Fallido'
    : impact.status === 'pending' ? 'Pendiente'
    : impact.status;

  const typeLabel =
    impact.impactType === 'income' ? 'Ingreso'
    : impact.impactType === 'expense' ? 'Gasto'
    : 'Ajuste';

  return (
    <View style={[styles.subRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.subAvatar, { backgroundColor: withAlpha(statusColor, 0.12) }]}>
        <Ionicons name="flash-outline" size={14} color={statusColor} />
      </View>
      <View style={{ flex: 1 }}>
        <UserName userId={impact.userId} style={[styles.subName, { color: colors.text }]} />
        <Text style={[styles.subMeta, { color: colors.textSecondary }]}>
          {typeLabel} {'\u2022'} {impact.destinationType === 'main_account' ? 'Cuenta principal' : 'Subcuenta'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.subAmount, { color: colors.text }]}>
          {formatCurrency(impact.amount, impact.moneda)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: withAlpha(statusColor, 0.12) }]}>
          <Text style={{ fontSize: 9, fontWeight: '900', color: statusColor }}>{statusLabel}</Text>
        </View>
      </View>
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: { fontSize: 14, fontWeight: '700' },

  headerWrap: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },
  headerBtn: {
    width: 42,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.2 },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movTitle: { fontSize: 17, fontWeight: '900', marginBottom: 3 },
  movMeta: { fontSize: 12, fontWeight: '700' },
  movAmount: { fontSize: 18, fontWeight: '900' },

  cancelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },
  cancelBadgeText: { fontSize: 12, fontWeight: '900', color: '#EF4444' },

  detailsGrid: {
    marginTop: 16,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  detailLabel: { fontSize: 12, fontWeight: '800', flex: 1 },
  detailValue: { fontSize: 12, fontWeight: '700', flex: 2, textAlign: 'right' },

  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  creatorLabel: { fontSize: 12, fontWeight: '700' },
  creatorName: { fontSize: 12, fontWeight: '900' },

  sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 12 },

  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subName: { fontSize: 13, fontWeight: '900' },
  subMeta: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  subAmount: { fontSize: 14, fontWeight: '900' },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 3,
  },

  actionsCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 16,
  },
  dangerBtnText: { fontSize: 15, fontWeight: '900', color: '#FFF' },
});
