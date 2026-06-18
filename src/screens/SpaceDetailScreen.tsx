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
  LayoutAnimation,
  UIManager,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useThemeColors } from '../theme/useThemeColors';
import Toast from 'react-native-toast-message';
import EventBus from '../utils/eventBus';
import * as sharedService from '../services/sharedSpacesService';
import type {
  SharedSpace,
  SharedSpaceMember,
  SharedMovement,
  SpaceBalance,
  SpaceAnalyticsSummary,
  SharedCategory,
  MemberRole,
} from '../types/sharedSpaces';
import {
  SPACE_TYPE_LABELS,
  SPACE_TYPE_ICONS,
  MEMBER_ROLE_LABELS,
  MOVEMENT_TYPE_LABELS,
  SPLIT_MODE_LABELS,
} from '../types/sharedSpaces';
import InviteMemberModal from '../components/shared/InviteMemberModal';
import SharedMovementModal from '../components/shared/SharedMovementModal';

type Tab = 'movements' | 'members' | 'balance';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function formatCurrency(amount: number, currency?: string): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const str = abs.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${str}${currency ? ` ${currency}` : ''}`;
}

function MemberDisplayName({ member, colors, maxWidth }: { member: SharedSpaceMember; colors: any; maxWidth?: number }) {
  // Use nombreCompleto from API directly — no async API calls needed
  const displayName =
    member.nombreCompleto ||
    member.alias ||
    (member.userId ? `Usuario ${String(member.userId).slice(-6)}` : 'Miembro');

  return (
    <Text
      style={[
        styles.memberName,
        { color: colors.text },
        maxWidth ? { maxWidth } : undefined,
      ]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {displayName}
    </Text>
  );
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Hace ${days}d`;
  return new Date(iso).toLocaleDateString('es-MX');
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const withAlpha = (color: string, alpha: number) => {
  const a = clamp(alpha, 0, 1);
  const c = (color || '').trim();
  if (c.startsWith('#')) {
    const hex = c.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      if ([r, g, b].every((x) => Number.isFinite(x))) return `rgba(${r},${g},${b},${a})`;
    }
  }
  return c;
};

const TAB_META: Record<Tab, { label: string; icon: string }> = {
  movements: { label: 'Movimientos', icon: 'receipt-outline' },
  members: { label: 'Miembros', icon: 'people-outline' },
  balance: { label: 'Balance', icon: 'analytics-outline' },
};

/** Safely resolve an icon name — if it looks invalid or has mojibake, fallback */
function safeIcon(name: string | null | undefined, fallback: string): any {
  if (!name || typeof name !== 'string') return fallback;
  const clean = name.trim();
  // Ionicons names are alphanumeric with dashes, e.g. "arrow-up-outline"
  if (!/^[a-zA-Z0-9-]+$/.test(clean)) return fallback;
  if (clean.length === 0 || clean.length > 50) return fallback;
  return clean as any;
}

export default function SpaceDetailScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ SpaceDetail: { spaceId: string } }, 'SpaceDetail'>>();
  const { spaceId } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [space, setSpace] = useState<SharedSpace | null>(null);
  const [members, setMembers] = useState<SharedSpaceMember[]>([]);
  const [movements, setMovements] = useState<SharedMovement[]>([]);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [balance, setBalance] = useState<SpaceBalance | null>(null);
  const [analytics, setAnalytics] = useState<SpaceAnalyticsSummary | null>(null);
  const [categories, setCategories] = useState<SharedCategory[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('movements');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  const headerShadow = useRef(new Animated.Value(0)).current;
  const refreshSpin = useRef(new Animated.Value(0)).current;

  /** Cooldown ref — skips refetch if data was loaded recently (silent calls only) */
  const lastFetchTs = useRef<number>(0);
  const FETCH_COOLDOWN = 12_000; // 12 seconds
  const fetchInFlight = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
      } catch {}
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const fetchCore = useCallback(
    async (silent = false) => {
      // Skip if already in flight or fetched recently (for automatic/silent calls)
      if (silent && (fetchInFlight.current || Date.now() - lastFetchTs.current < FETCH_COOLDOWN)) {
        return;
      }
      fetchInFlight.current = true;
      try {
        if (!silent) setLoading(true);

        const detailRes = await sharedService.getSpaceDetail(spaceId);
        setSpace(detailRes.space);
        setMembers(detailRes.members ?? []);

        const [movRes, catRes] = await Promise.all([
          sharedService.listMovements(spaceId, { page: 1, limit: 20 }).catch(() => ({ items: [], total: 0 } as any)),
          sharedService.listCategories(spaceId).catch(() => [] as SharedCategory[]),
        ]);

        setMovements(movRes.items ?? []);
        setMovementsTotal(movRes.total ?? 0);
        setMovementsPage(1);
        setCategories(Array.isArray(catRes) ? catRes : []);
        lastFetchTs.current = Date.now();
      } catch (err: any) {
        if (!silent) {
          Toast.show({
            type: 'error',
            text1: 'Error al cargar espacio',
            text2: err?.message ?? '',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        fetchInFlight.current = false;
      }
    },
    [spaceId]
  );

  const fetchBalance = useCallback(async () => {
    try {
      const [bal, ana] = await Promise.all([
        sharedService.getSpaceBalance(spaceId),
        sharedService.getAnalyticsSummary(spaceId),
      ]);
      setBalance(bal);
      setAnalytics(ana);
    } catch {
      // no-op
    }
  }, [spaceId]);

  useFocusEffect(
    useCallback(() => {
      fetchCore(true);
    }, [fetchCore])
  );

  useEffect(() => {
    const handler = () => {
      // Invalidate caches so next fetch gets fresh data
      sharedService.invalidateSpaceCache(spaceId);
      lastFetchTs.current = 0; // Reset cooldown
      fetchCore(true);
    };
    EventBus.on('sharedSpaceChanged', handler);
    return () => EventBus.off('sharedSpaceChanged', handler);
  }, [fetchCore, spaceId]);

  useEffect(() => {
    if (activeTab === 'balance' && !balance) fetchBalance();
  }, [activeTab, balance, fetchBalance]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setBalance(null);
    // Invalidate caches and reset cooldown for explicit refresh
    sharedService.invalidateSpaceCache(spaceId);
    lastFetchTs.current = 0;

    const loop = Animated.loop(
      Animated.timing(refreshSpin, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
      })
    );
    loop.start();

    Promise.all([fetchCore(true), activeTab === 'balance' ? fetchBalance() : Promise.resolve()]).finally(() => {
      refreshSpin.stopAnimation(() => refreshSpin.setValue(0));
      loop.stop();
      setRefreshing(false);
    });
  }, [activeTab, fetchBalance, fetchCore, refreshSpin]);

  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCurrency, setEditCurrency] = useState('');
  const [editType, setEditType] = useState<SharedSpace['tipo']>('grupo');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const optionsBtnRef = useRef<any>(null);
  const DROPDOWN_WIDTH = Math.min(200, SCREEN_W * 0.48);
  const DROPDOWN_HEIGHT = 120;
  const [dropdownPos, setDropdownPos] = useState<{ left?: number; top?: number } | null>(null);

  const loadMoreMovements = useCallback(async () => {
    if (movements.length >= movementsTotal) return;
    const next = movementsPage + 1;
    try {
      const res = await sharedService.listMovements(spaceId, { page: next, limit: 20 });
      setMovements((prev) => [...prev, ...(res.items ?? [])]);
      setMovementsPage(next);
    } catch {}
  }, [spaceId, movementsPage, movements.length, movementsTotal]);

  const handleChangeRole = useCallback(
    async (member: SharedSpaceMember, newRole: MemberRole) => {
      try {
        await sharedService.changeMemberRole(spaceId, member.memberId, newRole);
        Toast.show({
          type: 'success',
          text1: `Rol cambiado a ${MEMBER_ROLE_LABELS[newRole]}`,
        });
        fetchCore(true);
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? '' });
      }
    },
    [spaceId, fetchCore]
  );

  const handleRemoveMember = useCallback(
    (member: SharedSpaceMember) => {
      Alert.alert(
        'Eliminar miembro',
        `¿Seguro que deseas eliminar a ${member.nombreCompleto || member.alias || 'este miembro'}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                await sharedService.removeMember(spaceId, member.memberId);
                Toast.show({ type: 'success', text1: 'Miembro eliminado' });
                EventBus.emit('sharedSpaceChanged');
                fetchCore(true);
              } catch (err: any) {
                Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? '' });
              }
            },
          },
        ],
      );
    },
    [spaceId, fetchCore]
  );

  const handleLeaveSpace = useCallback(() => {
    Alert.alert(
      'Abandonar espacio',
      '¿Seguro que deseas abandonar este espacio? No podrás volver a unirte sin una nueva invitación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abandonar',
          style: 'destructive',
          onPress: async () => {
            try {
              await sharedService.leaveSpace(spaceId);
              Toast.show({ type: 'info', text1: 'Has abandonado el espacio' });
              EventBus.emit('sharedSpaceChanged');
              navigation.goBack();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? '' });
            }
          },
        },
      ],
    );
  }, [spaceId, navigation]);

  const handleArchiveSpace = useCallback(() => {
    Alert.alert(
      'Archivar espacio',
      '¿Archivar este espacio? Los miembros ya no podrán crear movimientos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await sharedService.archiveSpace(spaceId);
              Toast.show({ type: 'success', text1: 'Espacio archivado' });
              EventBus.emit('sharedSpaceChanged');
              navigation.goBack();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? '' });
            }
          },
        },
      ],
    );
  }, [spaceId, navigation]);

  // Mantengo la lógica original
  const myMember = useMemo(() => members.find((m) => m.estado === 'active' && m.rol !== 'member'), [members]);
  const isAdmin = !!myMember;
  const isOwner = myMember?.rol === 'owner';

  const activeMembersCount = useMemo(() => members.filter((m) => m.estado === 'active').length, [members]);

  const movementSummary = useMemo(() => {
    const total = movements.reduce((acc, mov) => acc + Number(mov.montoTotal ?? 0), 0);
    const expenses = movements
      .filter((m) => m.tipo === 'expense' || m.tipo === 'adjustment')
      .reduce((acc, mov) => acc + Number(mov.montoTotal ?? 0), 0);
    return { total, expenses };
  }, [movements]);

  const headerBgOpacity = headerShadow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const headerBorderOpacity = headerShadow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const refreshRotate = refreshSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const onScroll = useCallback(
    (e: any) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      headerShadow.setValue(clamp(y / 18, 0, 1));
    },
    [headerShadow]
  );

  const switchTab = useCallback(
    (tab: Tab) => {
      animateLayout();
      setActiveTab(tab);
      if (tab === 'balance' && !balance) fetchBalance();
    },
    [animateLayout, balance, fetchBalance]
  );

  if (loading && !space) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.button} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando espacio…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!space) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <Text style={[styles.emptyFallbackTitle, { color: colors.textSecondary }]}>Espacio no encontrado</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, marginTop: 16 }]}
          >
            <Text style={{ color: colors.button, fontWeight: '800' }}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const spaceTypeIcon = safeIcon(SPACE_TYPE_ICONS[space.tipo], 'people-outline');
  const spaceTypeLabel = SPACE_TYPE_LABELS[space.tipo] ?? 'Espacio';
  const archived = space.estado === 'archivado';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <Animated.View style={[styles.headerWrap, { backgroundColor: colors.background }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerGlass,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              opacity: headerBgOpacity,
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerBorder,
            {
              backgroundColor: colors.border,
              opacity: headerBorderOpacity,
            },
          ]}
        />

        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.headerBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {space.nombre}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {spaceTypeLabel} • {space.monedaBase} • {activeMembersCount} miembros
            </Text>
          </View>

          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.headerBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Animated.View style={{ transform: [{ rotate: refreshing ? refreshRotate : '0deg' }] }}>
              <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            </Animated.View>
          </Pressable>

          <Pressable
            ref={optionsBtnRef}
            onPress={() => {
              try {
                const currentW = Dimensions.get('window').width;
                const dropW = Math.min(200, currentW * 0.48);
                if (optionsBtnRef.current?.measureInWindow) {
                  optionsBtnRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
                    // Align right edge of dropdown to right edge of button; clamp to screen
                    let left = Math.round(x + w - dropW);
                    left = Math.max(8, Math.min(left, currentW - dropW - 8));
                    const top = Math.round(y + h + 6);
                    setDropdownPos({ left, top });
                    setShowOptions(true);
                  });
                } else {
                  setDropdownPos(null);
                  setShowOptions(true);
                }
              } catch {
                setDropdownPos(null);
                setShowOptions(true);
              }
            }}
            style={({ pressed }) => [
              styles.headerBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </Animated.View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.button} />}
      >
        {/* Hero */}
        <Animated.View
          style={{
            opacity: enter,
            transform: [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          }}
        >
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.heroTop}>
              <View
                style={[
                  styles.heroIconWrap,
                  {
                    backgroundColor: withAlpha(colors.button, 0.1),
                    borderColor: withAlpha(colors.button, 0.18),
                  },
                ]}
              >
                <Ionicons name={spaceTypeIcon as any} size={22} color={colors.button} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.heroTitleRow}>
                  <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
                    {space.nombre}
                  </Text>

                  <View
                    style={[
                      styles.heroPill,
                      {
                        backgroundColor: archived ? 'rgba(148,163,184,0.16)' : withAlpha(colors.button, 0.1),
                        borderColor: archived ? 'rgba(148,163,184,0.24)' : withAlpha(colors.button, 0.18),
                      },
                    ]}
                  >
                    <Text style={[styles.heroPillText, { color: colors.textSecondary }]}>
                      {archived ? 'Archivado' : 'Activo'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                  {spaceTypeLabel} • {space.monedaBase} • actualizado {relativeTime(space.updatedAt ?? space.createdAt)}
                </Text>
              </View>
            </View>

            <View style={styles.heroStatsRow}>
              <MiniStat
                colors={colors}
                label="Miembros"
                value={String(activeMembersCount)}
                icon="people-outline"
              />
              <MiniStat
                colors={colors}
                label="Movimientos"
                value={String(movementsTotal)}
                icon="receipt-outline"
              />
              <MiniStat
                colors={colors}
                label="Volumen"
                value={formatCurrency(movementSummary.total, space.monedaBase)}
                icon="wallet-outline"
              />
            </View>
          </View>

          {/* Tabs */}
          <View style={[styles.tabsWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['movements', 'members', 'balance'] as Tab[]).map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => switchTab(tab)}
                  style={({ pressed }) => [
                    styles.tab,
                    {
                      backgroundColor: active ? withAlpha(colors.button, 0.12) : 'transparent',
                      borderColor: active ? withAlpha(colors.button, 0.18) : 'transparent',
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={TAB_META[tab].icon as any}
                    size={17}
                    color={active ? colors.button : colors.textSecondary}
                  />
                  <Text style={[styles.tabLabel, { color: active ? colors.button : colors.textSecondary }]}>
                    {TAB_META[tab].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Content */}
          {activeTab === 'movements' && (
            <MovementsTab
              colors={colors}
              movements={movements}
              categories={categories}
              moneda={space.monedaBase}
              total={movementsTotal}
              onLoadMore={loadMoreMovements}
              spaceId={spaceId}
              navigation={navigation}
            />
          )}

          {activeTab === 'members' && (
            <MembersTab
              colors={colors}
              members={members}
              isAdmin={isAdmin}
              isOwner={isOwner}
              onChangeRole={handleChangeRole}
              onRemove={handleRemoveMember}
            />
          )}

          {activeTab === 'balance' && (
            <BalanceTab
              colors={colors}
              balance={balance}
              analytics={analytics}
              members={members}
              moneda={space.monedaBase}
            />
          )}
        </Animated.View>

        <View style={{ height: 96 }} />
      </Animated.ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background }]}>
        <View style={[styles.bottomBarInner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {activeTab === 'members' && isAdmin ? (
            <Pressable
              onPress={() => setShowInviteModal(true)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Ionicons name="person-add-outline" size={18} color="#FFF" />
              <Text style={styles.actionBtnText}>Invitar miembro</Text>
            </Pressable>
          ) : activeTab === 'movements' ? (
            <Pressable
              onPress={() => setShowMovementModal(true)}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFF" />
              <Text style={styles.actionBtnText}>Nuevo movimiento</Text>
            </Pressable>
          ) : (
            <View style={styles.bottomHintWrap}>
              <Ionicons name="analytics-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.bottomHint, { color: colors.textSecondary }]}>
                Balance actualizado del espacio
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Modals */}
      <InviteMemberModal
        visible={showInviteModal}
        spaceId={spaceId}
        onClose={() => setShowInviteModal(false)}
        onInvited={() => {
          setShowInviteModal(false);
          fetchCore(true);
        }}
      />

      {/* Edit Space Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar espacio</Text>
            <TextInput
              placeholder="Nombre"
              placeholderTextColor={colors.textSecondary}
              value={editName}
              onChangeText={setEditName}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              placeholder="Moneda base (MXN)"
              placeholderTextColor={colors.textSecondary}
              value={editCurrency}
              onChangeText={setEditCurrency}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>Tipo</Text>
              <Pressable onPress={() => setEditType(editType === 'grupo' ? 'pareja' : 'grupo')} style={{ padding: 6 }}>
                <Text style={{ color: colors.button, fontWeight: '900' }}>{editType}</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={({ pressed }) => [styles.modalBtn, { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '900' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    if (!space) return;
                    const dto: any = { nombre: editName || space.nombre, monedaBase: editCurrency || space.monedaBase, tipo: editType };
                    await sharedService.updateSpace(space.spaceId, dto);
                    setShowEditModal(false);
                    Toast.show({ type: 'success', text1: 'Espacio actualizado' });
                    EventBus.emit('sharedSpaceChanged');
                    fetchCore(true);
                  } catch (err: any) {
                    Toast.show({ type: 'error', text1: 'Error al editar', text2: err?.message ?? '' });
                  }
                }}
                style={({ pressed }) => [styles.modalBtn, { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '900' }}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Options Dropdown (anchored to header "..." button) */}
      {/* Options Dropdown */}
      <Modal
        visible={showOptions}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setShowOptions(false)}
      >
        {/* Full-screen backdrop — closes on outside tap */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowOptions(false)}>
          {/* Inner pressable absorbs taps so they don't bubble to backdrop */}
          <Pressable
            onPress={() => {}}
            style={[
              styles.dropdown,
              { backgroundColor: colors.card, borderColor: colors.border, width: DROPDOWN_WIDTH },
              dropdownPos?.left !== undefined
                ? { left: dropdownPos.left, top: dropdownPos.top }
                : { right: 18, top: 80 },
            ]}
          >
            {isOwner ? (
              <Pressable
                onPress={() => {
                  setShowOptions(false);
                  setEditName(space?.nombre ?? '');
                  setEditCurrency(space?.monedaBase ?? '');
                  setEditType(space?.tipo ?? 'grupo');
                  setShowEditModal(true);
                }}
                style={({ pressed }) => [styles.optionRow, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.text} />
                <Text style={[styles.optionText, { color: colors.text }]}>Editar</Text>
              </Pressable>
            ) : null}

            {isOwner ? (
              <Pressable
                onPress={async () => {
                  setShowOptions(false);
                  try {
                    await sharedService.archiveSpace(spaceId);
                    Toast.show({ type: 'success', text1: 'Espacio archivado' });
                    EventBus.emit('sharedSpaceChanged');
                    navigation.goBack();
                  } catch (err: any) {
                    Toast.show({ type: 'error', text1: 'Error al archivar', text2: err?.message ?? '' });
                  }
                }}
                style={({ pressed }) => [styles.optionRow, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name="archive-outline" size={18} color={colors.text} />
                <Text style={[styles.optionText, { color: colors.text }]}>Archivar</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setShowOptions(false);
                  handleLeaveSpace();
                }}
                style={({ pressed }) => [styles.optionRow, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name="exit-outline" size={18} color={colors.text} />
                <Text style={[styles.optionText, { color: colors.text }]}>Abandonar</Text>
              </Pressable>
            )}

            {isOwner ? (
              <Pressable
                onPress={() => {
                  setShowOptions(false);
                  setDeleteConfirmed(false);
                  setShowDeleteConfirm(true);
                }}
                style={({ pressed }) => [styles.optionRowDanger, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={[styles.optionText, { color: '#EF4444' }]}>Eliminar</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={showDeleteConfirm} animationType="fade" transparent>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Eliminar espacio</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Marca para confirmar eliminación:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>Confirmar</Text>
              <Switch value={deleteConfirmed} onValueChange={setDeleteConfirmed} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => setShowDeleteConfirm(false)} style={({ pressed }) => [styles.modalBtn, { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.9 : 1 }]}>
                <Text style={{ color: colors.textSecondary, fontWeight: '900' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!deleteConfirmed) return Toast.show({ type: 'info', text1: 'Activa la confirmación para eliminar' });
                  try {
                    await sharedService.archiveSpace(spaceId);
                    setShowDeleteConfirm(false);
                    Toast.show({ type: 'success', text1: 'Espacio eliminado' });
                    EventBus.emit('sharedSpaceChanged');
                    navigation.goBack();
                  } catch (err: any) {
                    Toast.show({ type: 'error', text1: 'Error al eliminar', text2: err?.message ?? '' });
                  }
                }}
                disabled={!deleteConfirmed}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: deleteConfirmed ? '#EF4444' : '#6B7280',
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Text style={{ color: deleteConfirmed ? '#FFF' : '#E5E7EB', fontWeight: '900' }}>Eliminar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <SharedMovementModal
        visible={showMovementModal}
        spaceId={spaceId}
        members={members.filter((m) => m.estado === 'active')}
        categories={categories}
        monedaBase={space.monedaBase}
        splitDefault={space.configuracion?.splitDefaultMode ?? 'equal'}
        onClose={() => setShowMovementModal(false)}
        onCreated={() => {
          setShowMovementModal(false);
          EventBus.emit('sharedSpaceChanged');
          fetchCore(true);
        }}
      />
    </SafeAreaView>
  );
}

function MiniStat({
  colors,
  label,
  value,
  icon,
}: {
  colors: any;
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <View style={[styles.miniStat, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
      <View style={styles.miniStatTop}>
        <Ionicons name={icon as any} size={14} color={colors.textSecondary} />
        <Text style={[styles.miniStatLabel, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.miniStatValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MovementsTab({
  colors,
  movements,
  categories,
  moneda,
  total,
  onLoadMore,
  navigation,
}: {
  colors: any;
  movements: SharedMovement[];
  categories: SharedCategory[];
  moneda: string;
  total: number;
  onLoadMore: () => void;
  spaceId: string;
  navigation: any;
}) {
  const categoryMap = useMemo(() => {
    const map: Record<string, SharedCategory> = {};
    categories.forEach((c) => {
      map[c.categoryId] = c;
    });
    return map;
  }, [categories]);

  if (movements.length === 0) {
    return (
      <View style={styles.emptyTabWrap}>
        <View
          style={[
            styles.emptyTabIcon,
            { backgroundColor: withAlpha(colors.button, 0.1), borderColor: withAlpha(colors.button, 0.18) },
          ]}
        >
          <Ionicons name="receipt-outline" size={22} color={colors.button} />
        </View>
        <Text style={[styles.emptyTabTitle, { color: colors.text }]}>Sin movimientos</Text>
        <Text style={[styles.emptyTabText, { color: colors.textSecondary }]}>
          Registra el primer gasto o ingreso compartido.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 14 }}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {total} movimiento{total !== 1 ? 's' : ''}
        </Text>

        <Pressable
          onPress={onLoadMore}
          disabled={movements.length >= total}
          style={({ pressed }) => [
            styles.sectionAction,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
              opacity: movements.length >= total ? 0.45 : pressed ? 0.92 : 1,
            },
          ]}
        >
          <Text style={[styles.sectionActionText, { color: colors.text }]}>Ver más</Text>
        </Pressable>
      </View>

      {movements.map((mov, idx) => {
        const cat = mov.categoriaId ? categoryMap[mov.categoriaId] : null;
        const typeLabel = MOVEMENT_TYPE_LABELS[mov.tipo] ?? mov.tipo;
        const isExpense = mov.tipo === 'expense' || mov.tipo === 'adjustment';
        const colorTone = isExpense ? '#EF4444' : '#10B981';

        return (
          <Animated.View
            key={mov.movementId}
            style={{
              opacity: 1,
              transform: [{ translateY: 0 }],
            }}
          >
            <Pressable
              onPress={() => {
                if ((navigation as any)?.navigate) {
                  try {
                    navigation.navigate('SharedMovementDetail', { movementId: mov.movementId, spaceId: (mov as any).spaceId });
                  } catch {}
                }
              }}
              style={({ pressed }) => [
                styles.movCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.94 : 1,
                },
              ]}
            >
              <View style={styles.movTop}>
                <View style={[styles.movIconWrap, { backgroundColor: withAlpha(colorTone, 0.12) }]}>
                  <Ionicons
                    name={safeIcon(cat?.icono, isExpense ? 'arrow-up-outline' : 'arrow-down-outline')}
                    size={18}
                    color={colorTone}
                  />
                </View>

                <View style={styles.movInfo}>
                  <View style={styles.movTitleRow}>
                    <Text style={[styles.movTitle, { color: colors.text }]} numberOfLines={1}>
                      {mov.titulo}
                    </Text>

                    <View
                      style={[
                        styles.inlinePill,
                        {
                          backgroundColor: withAlpha(colorTone, 0.1),
                          borderColor: withAlpha(colorTone, 0.18),
                        },
                      ]}
                    >
                      <Text style={[styles.inlinePillText, { color: colorTone }]} numberOfLines={1}>
                        {typeLabel}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.movMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {SPLIT_MODE_LABELS[mov.splitMode] ?? mov.splitMode}
                    {cat?.nombre ? ` • ${cat.nombre}` : ''}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.movAmount, { color: colorTone }]}>
                    {isExpense ? '-' : '+'}
                    {formatCurrency(mov.montoTotal, moneda)}
                  </Text>
                  <Text style={[styles.movDate, { color: colors.textSecondary }]}>
                    {relativeTime(mov.fechaMovimiento)}
                  </Text>
                </View>
              </View>

              {mov.estado === 'cancelled' ? (
                <View style={[styles.cancelledBadge, { backgroundColor: '#EF444420' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#EF4444' }}>Cancelado</Text>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        );
      })}

      {movements.length < total ? (
        <Pressable
          onPress={onLoadMore}
          style={({ pressed }) => [
            styles.loadMoreBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.94 : 1,
            },
          ]}
        >
          <Text style={[styles.loadMoreText, { color: colors.button }]}>Cargar más movimientos</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MembersTab({
  colors,
  members,
  isAdmin,
  isOwner,
  onChangeRole,
  onRemove,
}: {
  colors: any;
  members: SharedSpaceMember[];
  isAdmin: boolean;
  isOwner: boolean;
  onChangeRole: (m: SharedSpaceMember, r: MemberRole) => void;
  onRemove: (m: SharedSpaceMember) => void;
}) {
  const activeMembers = useMemo(() => members.filter((m) => m.estado === 'active'), [members]);
  const otherMembers = useMemo(() => members.filter((m) => m.estado !== 'active'), [members]);

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {activeMembers.length} miembro{activeMembers.length !== 1 ? 's' : ''} activo{activeMembers.length !== 1 ? 's' : ''}
      </Text>

      {activeMembers.map((m) => (
        <MemberCard
          key={m.memberId}
          member={m}
          colors={colors}
          isAdmin={isAdmin}
          isOwner={isOwner}
          onChangeRole={onChangeRole}
          onRemove={onRemove}
        />
      ))}

      {otherMembers.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>Inactivos</Text>
          {otherMembers.map((m) => (
            <MemberCard
              key={m.memberId}
              member={m}
              colors={colors}
              isAdmin={false}
              isOwner={false}
              onChangeRole={() => {}}
              onRemove={() => {}}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

function MemberCard({
  member,
  colors,
  isAdmin,
  isOwner,
  onChangeRole,
  onRemove,
}: {
  member: SharedSpaceMember;
  colors: any;
  isAdmin: boolean;
  isOwner: boolean;
  onChangeRole: (m: SharedSpaceMember, r: MemberRole) => void;
  onRemove: (m: SharedSpaceMember) => void;
}) {
  const roleLabel = MEMBER_ROLE_LABELS[member.rol] ?? member.rol;
  const isActive = member.estado === 'active';

  const roleColor =
    member.rol === 'owner'
      ? '#F59E0B'
      : member.rol === 'admin'
        ? colors.button
        : colors.textSecondary;

  return (
    <View
      style={[
        styles.memberCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: isActive ? 1 : 0.55,
        },
      ]}
    >
      <View style={[styles.memberAvatar, { backgroundColor: colors.backgroundSecondary }]}>
        <Ionicons name="person-outline" size={18} color={colors.button} />
      </View>

      <View style={styles.memberInfo}>
        <MemberDisplayName member={member} colors={colors} />

        <View style={styles.memberMetaRow}>
          <Text style={[styles.memberRole, { color: roleColor }]}>{roleLabel}</Text>
          {!isActive ? (
            <View style={[styles.memberStatePill, { backgroundColor: 'rgba(148,163,184,0.16)' }]}>
              <Text style={styles.memberStateText}>{member.estado}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {isActive && isAdmin && member.rol !== 'owner' ? (
        <View style={styles.memberActions}>
          {isOwner ? (
            <Pressable
              onPress={() => onChangeRole(member, member.rol === 'admin' ? 'member' : 'admin')}
              style={({ pressed }) => [
                styles.memberActionBtn,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Ionicons
                name={member.rol === 'admin' ? 'arrow-down-outline' : 'arrow-up-outline'}
                size={14}
                color={colors.button}
              />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => onRemove(member)}
            style={({ pressed }) => [
              styles.memberActionBtn,
              {
                backgroundColor: '#EF444420',
                borderColor: '#EF444430',
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={14} color="#EF4444" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function BalanceTab({
  colors,
  balance,
  analytics,
  members,
  moneda,
}: {
  colors: any;
  balance: SpaceBalance | null;
  analytics: SpaceAnalyticsSummary | null;
  members: SharedSpaceMember[];
  moneda: string;
}) {
  const memberMap = useMemo(() => {
    const map: Record<string, SharedSpaceMember> = {};
    members.forEach((m) => {
      map[m.memberId] = m;
    });
    return map;
  }, [members]);

  if (!balance) {
    return (
      <View style={styles.emptyTabWrap}>
        <View
          style={[
            styles.emptyTabIcon,
            { backgroundColor: withAlpha(colors.button, 0.1), borderColor: withAlpha(colors.button, 0.18) },
          ]}
        >
          <ActivityIndicator size="small" color={colors.button} />
        </View>
        <Text style={[styles.emptyTabTitle, { color: colors.text }]}>Cargando balance…</Text>
        <Text style={[styles.emptyTabText, { color: colors.textSecondary }]}>
          Estamos calculando la distribución del espacio.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 14 }}>
      {analytics ? (
        <View style={[styles.analyticsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.analyticsTitle, { color: colors.text }]}>Resumen</Text>
          <View style={styles.analyticsGrid}>
            <AnalyticsStat label="Gastos" value={formatCurrency(analytics.totalExpenses, moneda)} color="#EF4444" colors={colors} />
            <AnalyticsStat label="Ingresos" value={formatCurrency(analytics.totalIncome, moneda)} color="#10B981" colors={colors} />
            <AnalyticsStat label="Neto" value={formatCurrency(analytics.netAmount, moneda)} color={colors.text} colors={colors} />
            <AnalyticsStat label="Movimientos" value={String(analytics.movementCount)} color={colors.button} colors={colors} />
          </View>
        </View>
      ) : null}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Balance por miembro</Text>
      {balance.members.map((bm) => {
        const member = memberMap[bm.memberId];
        const diff = bm.difference;
        const diffColor = diff > 0 ? '#10B981' : diff < 0 ? '#EF4444' : colors.textSecondary;
        return (
          <View key={bm.memberId} style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.memberAvatar, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name="person-outline" size={16} color={colors.button} />
            </View>

            <View style={styles.balanceInfo}>
              <MemberDisplayName member={member ?? { memberId: bm.memberId, userId: bm.userId, alias: '', rol: 'member', estado: 'active', spaceId: '' } as SharedSpaceMember} colors={colors} />
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                  Aportó: {formatCurrency(bm.totalContributed, moneda)}
                </Text>
                <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
                  Asignado: {formatCurrency(bm.totalAssigned, moneda)}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.balanceDiff, { color: diffColor }]}>
                {diff > 0 ? '+' : ''}
                {formatCurrency(diff, moneda)}
              </Text>
              <Text style={[styles.balanceHint, { color: colors.textSecondary }]}>
                {diff > 0 ? 'Le deben' : diff < 0 ? 'Debe' : 'OK'}
              </Text>
            </View>
          </View>
        );
      })}

      {balance.debts.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>Deudas sugeridas</Text>
          {balance.debts.map((debt, idx) => {
            const from = memberMap[debt.fromMemberId];
            const to = memberMap[debt.toMemberId];
            return (
              <View key={idx} style={[styles.debtCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.debtArrowWrap, { backgroundColor: withAlpha(colors.button, 0.1) }]}>
                  <Ionicons name="arrow-forward-outline" size={15} color={colors.button} />
                </View>
                <View style={[styles.debtText, { flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap' }]}>
                  <MemberDisplayName member={from ?? { memberId: debt.fromMemberId, userId: debt.fromUserId, alias: '', rol: 'member', estado: 'active', spaceId: '' } as SharedSpaceMember} colors={colors} />
                  <Text style={{ color: colors.text, fontWeight: '700' }}> {'\u2192'} </Text>
                  <MemberDisplayName member={to ?? { memberId: debt.toMemberId, userId: debt.toUserId, alias: '', rol: 'member', estado: 'active', spaceId: '' } as SharedSpaceMember} colors={colors} />
                </View>
                <Text style={[styles.debtAmount, { color: '#EF4444' }]}>{formatCurrency(debt.amount, moneda)}</Text>
              </View>
            );
          })}
        </>
      ) : null}

      {balance.isBalanced ? (
        <View style={[styles.balancedBadge, { backgroundColor: '#10B98120', borderColor: '#10B98130' }]}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
          <Text style={styles.balancedText}>Todo está balanceado</Text>
        </View>
      ) : null}
    </View>
  );
}

function AnalyticsStat({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: any;
}) {
  return (
    <View style={[styles.analyticsStat, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
      <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.analyticsValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

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
  emptyFallbackTitle: { fontSize: 14, fontWeight: '800' },

  // Header glass
  headerWrap: {
    position: 'relative',
    zIndex: 10,
    paddingBottom: 8,
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: 1,
    opacity: 0,
  },
  headerBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    opacity: 0,
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
  headerSub: { marginTop: 2, fontSize: 11, fontWeight: '700' },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },

  // Hero
  heroCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  heroTitle: { flex: 1, fontSize: 17, fontWeight: '900' },
  heroSubtitle: { fontSize: 12, fontWeight: '700', lineHeight: 16 },

  heroPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: { fontSize: 11, fontWeight: '900' },

  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  miniStat: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
  },
  miniStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  miniStatLabel: { fontSize: 11, fontWeight: '800', flex: 1 },
  miniStatValue: { fontSize: 13, fontWeight: '900' },

  // Tabs
  tabsWrap: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 6,
    flexDirection: 'row',
    gap: 6,
  },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tabLabel: { fontSize: 12.5, fontWeight: '900' },

  // Section helpers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: { fontSize: 12, fontWeight: '800', marginBottom: 10 },
  sectionAction: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sectionActionText: { fontSize: 12, fontWeight: '900' },

  // Movements
  movCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  movTop: { flexDirection: 'row', alignItems: 'center' },
  movIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movInfo: { flex: 1, marginHorizontal: 12 },
  movTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  movTitle: { flex: 1, fontSize: 14, fontWeight: '900', marginBottom: 2 },
  movMeta: { fontSize: 11, fontWeight: '700' },
  movAmount: { fontSize: 14, fontWeight: '900' },
  movDate: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  cancelledBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  inlinePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  inlinePillText: { fontSize: 10.5, fontWeight: '900' },

  loadMoreBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  loadMoreText: { fontSize: 13, fontWeight: '900' },

  // Members
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: { flex: 1, marginHorizontal: 12 },
  memberName: {
    fontSize: Math.min(14, Math.max(11.5, SCREEN_W * 0.034)),
    fontWeight: '900',
    marginBottom: 2,
    flexShrink: 1,
  },
  memberMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberRole: { fontSize: 12, fontWeight: '800' },
  memberStatePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  memberStateText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'capitalize',
  },
  memberActions: { flexDirection: 'row', gap: 8 },
  memberActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Balance
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  balanceInfo: { flex: 1, marginHorizontal: 12 },
  balanceRow: { marginTop: 3, gap: 2 },
  balanceLabel: { fontSize: 11, fontWeight: '700' },
  balanceDiff: { fontSize: 15, fontWeight: '900' },
  balanceHint: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  debtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  debtArrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtText: { flex: 1, fontSize: 13, fontWeight: '700' },
  debtAmount: { fontSize: 14, fontWeight: '900' },

  balancedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  balancedText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#10B981',
    marginLeft: 8,
  },

  // Analytics
  analyticsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  analyticsTitle: { fontSize: 16, fontWeight: '900', marginBottom: 12 },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analyticsStat: {
    width: (SCREEN_W - 36 - 32 - 12) / 2,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  analyticsLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  analyticsValue: { fontSize: 15, fontWeight: '900' },

  // Empty tab
  emptyTabWrap: {
    alignItems: 'center',
    paddingTop: 52,
    gap: 10,
  },
  emptyTabIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTabTitle: { fontSize: 16, fontWeight: '900' },
  emptyTabText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 18 : 14,
    paddingTop: 10,
  },
  bottomBarInner: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  actionBtnText: { fontSize: 15, fontWeight: '900', color: '#FFF' },

  bottomHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  bottomHint: { fontSize: 12, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    fontWeight: '800',
  },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsCard: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionRowDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionText: { fontSize: 15, fontWeight: '900', marginLeft: 6 },
  dropdown: {
    position: 'absolute',
    minWidth: 160,
    maxWidth: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
});