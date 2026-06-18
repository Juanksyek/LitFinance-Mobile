import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import EventBus from '../utils/eventBus';
import * as sharedService from '../services/sharedSpacesService';
import type { SharedSpace, SharedInvitation } from '../types/sharedSpaces';
import { SPACE_TYPE_LABELS as TYPE_LABELS, SPACE_TYPE_ICONS as TYPE_ICONS } from '../types/sharedSpaces';
import { useThemeColors } from '../theme/useThemeColors';
import CreateSpaceModal from '../components/shared/CreateSpaceModal';

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

export default function SharedSpacesScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<SharedInvitation[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // UI anim
  const enter = useRef(new Animated.Value(0)).current;
  const headerShadow = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
      } catch {}
    }
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [enter]);

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // Try snapshot data first for faster initial rendering
      if (!silent) {
        try {
          const snapshotSummary = await sharedService.getSnapshotSpacesSummary?.();
          if (snapshotSummary && Array.isArray(snapshotSummary.spaces) && snapshotSummary.spaces.length > 0) {
            const snapshotSpaces: SharedSpace[] = snapshotSummary.spaces.map((s: any) => ({
              spaceId: s.spaceId,
              ownerUserId: s.ownerUserId ?? '',
              nombre: s.nombre ?? 'Espacio',
              tipo: s.tipo ?? 'grupo',
              monedaBase: s.monedaBase ?? 'MXN',
              estado: 'activo' as const,
              configuracion: s.configuracion ?? {
                splitDefaultMode: 'equal' as const,
                allowAccountImpact: true,
                maxMembers: s.maxMembers ?? 10,
                requireApproval: false,
                allowCategories: true,
                allowRecurring: true,
              },
              createdAt: new Date().toISOString(),
              updatedAt: s.lastMovementAt ?? new Date().toISOString(),
            }));
            snapshotSpaces.sort((a: any, b: any) => {
              const ad = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              const bd = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              return bd - ad;
            });
            setSpaces(snapshotSpaces);
            setLoading(false);
          }
        } catch {}
      }

      const listSpacesFn: any = (sharedService as any).listSpaces;

      const [spacesRes, invRes] = await Promise.all([
        typeof listSpacesFn === 'function'
          ? listSpacesFn()
          : [],
        (sharedService as any).getPendingInvitations?.() ?? [],
      ]);

      const spacesArr = Array.isArray(spacesRes) ? spacesRes : [];
      const invArr = Array.isArray(invRes) ? invRes : [];

      // sort by updatedAt desc
      spacesArr.sort((a: any, b: any) => {
        const ad = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bd = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bd - ad;
      });

      setSpaces(spacesArr);
      setPendingInvitations(invArr);
    } catch (err: any) {
      if (!silent) {
        Toast.show({
          type: 'error',
          text1: 'Error al cargar espacios',
          text2: err?.message ?? 'Intenta más tarde.',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [fetchData])
  );

  useEffect(() => {
    const handler = () => fetchData(true);
    EventBus.on('sharedSpaceChanged', handler);
    return () => EventBus.off('sharedSpaceChanged', handler);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 800, useNativeDriver: true })).start();
    try {
      await fetchData(true);
    } finally {
      rotate.stopAnimation(() => rotate.setValue(0));
      setRefreshing(false);
    }
  }, [fetchData, rotate]);

  const handleAccept = useCallback(
    async (inv: SharedInvitation) => {
      try {
        await (sharedService as any).acceptInvitation(inv.invitationId);
        Toast.show({ type: 'success', text1: 'Invitación aceptada' });
        EventBus.emit('sharedSpaceChanged');
        fetchData(true);
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? 'No se pudo aceptar' });
      }
    },
    [fetchData]
  );

  const handleReject = useCallback(async (inv: SharedInvitation) => {
    try {
      await (sharedService as any).rejectInvitation(inv.invitationId);
      Toast.show({ type: 'info', text1: 'Invitación rechazada' });
      setPendingInvitations((prev) => prev.filter((i) => i.invitationId !== inv.invitationId));
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? 'No se pudo rechazar' });
    }
  }, []);

  const handleSpaceCreated = useCallback(
    (newSpace?: SharedSpace) => {
      setShowCreateModal(false);

      if (newSpace) {
        const normalized: SharedSpace = {
          spaceId: newSpace.spaceId,
          ownerUserId: newSpace.ownerUserId ?? '',
          nombre: newSpace.nombre ?? 'Nuevo espacio',
          tipo: newSpace.tipo ?? 'grupo',
          monedaBase: newSpace.monedaBase ?? 'MXN',
          estado: newSpace.estado ?? 'activo',
          configuracion:
            newSpace.configuracion ??
            ({
              splitDefaultMode: 'equal',
              allowAccountImpact: true,
              maxMembers: 10,
              requireApproval: false,
              allowCategories: true,
              allowRecurring: true,
            } as any),
          createdAt: newSpace.createdAt ?? new Date().toISOString(),
          updatedAt: newSpace.updatedAt ?? new Date().toISOString(),
        } as SharedSpace;

        animateLayout();
        setSpaces((prev) => [normalized, ...prev.filter((s) => s.spaceId !== normalized.spaceId)]);
      }

      EventBus.emit('sharedSpaceChanged');
      void fetchData(true);
    },
    [animateLayout, fetchData]
  );

  const activeSpaces = useMemo(() => spaces.filter((s) => s.estado === 'activo'), [spaces]);
  const archivedSpaces = useMemo(() => spaces.filter((s) => s.estado === 'archivado'), [spaces]);

  const headerBgOpacity = headerShadow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const headerBorderOpacity = headerShadow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const refreshRotate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const onScroll = useCallback(
    (e: any) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      headerShadow.setValue(clamp(y / 18, 0, 1));
    },
    [headerShadow]
  );

  const stats = useMemo(() => {
    return {
      active: activeSpaces.length,
      archived: archivedSpaces.length,
      invites: pendingInvitations.length,
    };
  }, [activeSpaces.length, archivedSpaces.length, pendingInvitations.length]);

  // Selected top tab: 'active' | 'invites' | 'archived'
  const [selectedTopTab, setSelectedTopTab] = useState<'active' | 'invites' | 'archived'>('active');
  const flatListRef = useRef<any>(null);

  const keyExtractor = useCallback((it: any, idx: number) => String(it?.spaceId ?? it?.invitationId ?? idx), []);

  const renderSpace = useCallback(
    ({ item, index }: { item: SharedSpace; index: number }) => (
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [10 + Math.min(index, 10) * 2, 0],
              }),
            },
          ],
        }}
      >
        <SpaceCard space={item} colors={colors} navigation={navigation} />
      </Animated.View>
    ),
    [colors, enter, navigation]
  );

  // determine which data to show depending on selected top tab
  const listData = useMemo(() => {
    if (selectedTopTab === 'invites') return pendingInvitations;
    if (selectedTopTab === 'archived') return archivedSpaces;
    return activeSpaces;
  }, [selectedTopTab, activeSpaces, archivedSpaces, pendingInvitations]);

  const ListHeader = useMemo(() => {
    const showEmptyActive = !loading && activeSpaces.length === 0 && pendingInvitations.length === 0;
    const showEmptyInvites = !loading && pendingInvitations.length === 0;
    const showEmptyArchived = !loading && archivedSpaces.length === 0;

    return (
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 }}>
        {/* Quick stats */}
        <View style={styles.statsRow}>
          <StatsPill
            colors={colors}
            icon="people-outline"
            label="Activos"
            value={String(stats.active)}
            tone="primary"
            onPress={() => {
              setSelectedTopTab('active');
              flatListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
            }}
            selected={selectedTopTab === 'active'}
          />
          <StatsPill
            colors={colors}
            icon="mail-unread-outline"
            label="Invitaciones"
            value={String(stats.invites)}
            tone={stats.invites > 0 ? 'warn' : 'neutral'}
            onPress={() => {
              setSelectedTopTab('invites');
              flatListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
            }}
            selected={selectedTopTab === 'invites'}
          />
          <StatsPill
            colors={colors}
            icon="archive-outline"
            label="Archivados"
            value={String(stats.archived)}
            tone="neutral"
            onPress={() => {
              setSelectedTopTab('archived');
              flatListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
            }}
            selected={selectedTopTab === 'archived'}
          />
        </View>

        {/* Invitations preview (only when not viewing invites) */}
        {selectedTopTab !== 'invites' && pendingInvitations.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Invitaciones</Text>
              <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>{pendingInvitations.length}</Text>
            </View>

            {pendingInvitations.map((inv) => (
              <InvitationCard
                key={inv.invitationId}
                invitation={inv}
                colors={colors}
                onAccept={() => handleAccept(inv)}
                onReject={() => handleReject(inv)}
              />
            ))}
          </View>
        ) : null}

        {/* Title / controls per selected tab */}
        {selectedTopTab === 'active' && (
          <View style={[styles.sectionRow, { marginTop: pendingInvitations.length ? 16 : 10 }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Mis espacios</Text>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              style={({ pressed }) => [
                styles.inlineCreate,
                {
                  backgroundColor: withAlpha(colors.button, 0.12),
                  borderColor: withAlpha(colors.button, 0.18),
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={16} color={colors.button} />
              <Text style={[styles.inlineCreateText, { color: colors.button }]}>Crear</Text>
            </Pressable>
          </View>
        )}

        {selectedTopTab === 'invites' && (
          <View style={[styles.sectionRow, { marginTop: 10 }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Invitaciones</Text>
          </View>
        )}

        {selectedTopTab === 'archived' && (
          <View style={[styles.sectionRow, { marginTop: 10 }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Archivados</Text>
          </View>
        )}

        {/* Empty states per tab */}
        {selectedTopTab === 'active' && showEmptyActive && (
          <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: withAlpha(colors.button, 0.1), borderColor: withAlpha(colors.button, 0.18) }]}>
              <Ionicons name="people-outline" size={26} color={colors.button} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin espacios aún</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Crea un espacio para dividir gastos con pareja, amigos o familia.</Text>
            <Pressable onPress={() => setShowCreateModal(true)} style={({ pressed }) => [styles.emptyBtn, { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 }]}>
              <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={styles.emptyBtnText}>Crear espacio</Text>
            </Pressable>
          </View>
        )}

        {selectedTopTab === 'invites' && showEmptyInvites && (
          <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: withAlpha(colors.button, 0.06), borderColor: withAlpha(colors.border, 0.08) }]}>
              <Ionicons name="mail-unread-outline" size={26} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No hay invitaciones</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Cuando alguien te invite, aparecerá aquí.</Text>
          </View>
        )}

        {selectedTopTab === 'archived' && showEmptyArchived && (
          <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: withAlpha(colors.button, 0.06), borderColor: withAlpha(colors.border, 0.08) }]}>
              <Ionicons name="archive-outline" size={26} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No hay espacios archivados</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Los espacios archivados aparecerán aquí.</Text>
          </View>
        )}

        {/* Loading skeleton */}
        {loading && spaces.length === 0 ? (
          <View style={{ marginTop: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonSpaceCard key={`sk-${i}`} colors={colors} index={i} />
            ))}
          </View>
        ) : null}
      </View>
    );
  }, [
    activeSpaces.length,
    archivedSpaces.length,
    colors,
    handleAccept,
    handleReject,
    loading,
    pendingInvitations,
    spaces.length,
    stats.active,
    stats.archived,
    stats.invites,
    selectedTopTab,
  ]);

  const ListFooter = useMemo(() => {
    if (archivedSpaces.length === 0) return <View style={{ height: 28 }} />;

    return (
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28 }}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Archivados</Text>
          <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>{archivedSpaces.length}</Text>
        </View>
        {archivedSpaces.map((space) => (
          <SpaceCard key={space.spaceId} space={space} colors={colors} navigation={navigation} />
        ))}
      </View>
    );
  }, [archivedSpaces, colors, navigation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header (glass + compact) */}
      <Animated.View style={[styles.headerWrap, { backgroundColor: colors.background }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerGlass,
            { backgroundColor: colors.card, borderBottomColor: colors.border, opacity: headerBgOpacity },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.headerBorder, { backgroundColor: colors.border, opacity: headerBorderOpacity }]}
        />

        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 6 : 8 }]}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
            <View style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </View>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              Espacios Compartidos
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
              Finanzas en equipo • {stats.active} activos
            </Text>
          </View>

          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            hitSlop={10}
          >
            <View style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Animated.View style={{ transform: [{ rotate: refreshing ? refreshRotate : '0deg' }] }}>
                <Ionicons name="refresh" size={18} color={colors.textSecondary} />
              </Animated.View>
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('QRScanner' as never)}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            hitSlop={10}
          >
            <View style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="qr-code-outline" size={19} color={colors.text} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('SharedNotifications' as never)}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            hitSlop={10}
          >
            <View style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
            </View>
          </Pressable>
        </View>
      </Animated.View>

      {/* Content */}
      <FlatList
        ref={flatListRef}
        data={listData}
        extraData={selectedTopTab}
        keyExtractor={keyExtractor}
        renderItem={selectedTopTab === 'invites' ? ({ item }) => (
          // invitations render as InvitationCard
          <InvitationCard
            key={(item as any).invitationId}
            invitation={item as SharedInvitation}
            colors={colors}
            onAccept={() => handleAccept(item as SharedInvitation)}
            onReject={() => handleReject(item as SharedInvitation)}
          />
        ) : renderSpace}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 18 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.button} />}
      />

      {/* FAB */}
      {!loading ? (
        <Pressable
          onPress={() => setShowCreateModal(true)}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.button,
              shadowColor: colors.shadow,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={26} color="#FFF" />
        </Pressable>
      ) : null}

      {/* Create Modal */}
      <CreateSpaceModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleSpaceCreated}
      />
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Components
// ────────────────────────────────────────────────────────────────────────────

function StatsPill({
  colors,
  icon,
  label,
  value,
  tone,
  onPress,
  selected,
}: {
  colors: any;
  icon: string;
  label: string;
  value: string;
  tone: 'primary' | 'warn' | 'neutral';
  onPress?: () => void;
  selected?: boolean;
}) {
  const bg =
    tone === 'primary'
      ? withAlpha(colors.button, 0.12)
      : tone === 'warn'
        ? 'rgba(245,158,11,0.14)'
        : withAlpha(colors.border, 0.12);

  const bd =
    tone === 'primary'
      ? withAlpha(colors.button, 0.18)
      : tone === 'warn'
        ? 'rgba(245,158,11,0.22)'
        : withAlpha(colors.border, 0.18);

  const warnColor = '#F59E0B';
  const selectedBgColor = selected ? (tone === 'warn' ? warnColor : colors.button) : undefined;
  const selectedBorderColor = selected ? (tone === 'warn' ? warnColor : colors.button) : undefined;
  const selectedStyle = selected
    ? { backgroundColor: selectedBgColor, borderColor: selectedBorderColor }
    : {};

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.statsPill, selectedStyle, { backgroundColor: bg, borderColor: bd, opacity: pressed ? 0.9 : 1 }]}>
      {(() => {
        const selectedColor = selected ? (tone === 'warn' ? warnColor : colors.button) : null;
        const iconColor = selected ? '#FFF' : colors.textSecondary;
        const labelColor = selected ? '#FFF' : colors.textSecondary;
        const valueBg = selectedColor ?? withAlpha(colors.card, 0.7);
        const valueBorder = selected ? selectedColor : bd;
        const valueTextColor = selected ? '#FFF' : colors.text;

        return (
          <>
            <Ionicons name={icon as any} size={14} color={iconColor} />
            <Text style={[styles.statsLabel, { color: labelColor }]} numberOfLines={1}>
              {label}
            </Text>
            <View style={[styles.statsValuePill, { backgroundColor: valueBg, borderColor: valueBorder }]}> 
              <Text style={[styles.statsValue, { color: valueTextColor }]}>{value}</Text>
            </View>
          </>
        );
      })()}
    </Pressable>
  );
}

function SpaceCard({ space, colors, navigation }: { space: SharedSpace; colors: any; navigation: any }) {
  const icon = (TYPE_ICONS as any)[space.tipo] ?? 'people-outline';
  const label = (TYPE_LABELS as any)[space.tipo] ?? String(space.tipo ?? 'grupo');
  const isArchived = space.estado === 'archivado';

  // best-effort fields (don’t break if backend doesn’t send them)
  const members = (space as any)?.miembrosCount ?? (space as any)?.membersCount ?? (space as any)?.members?.length;
  const membersLabel = typeof members === 'number' ? `${members} miembros` : 'Equipo';

  const updated = relativeTime((space as any)?.updatedAt ?? (space as any)?.createdAt);

  return (
    <Pressable
      onPress={() => navigation.navigate('SpaceDetail', { spaceId: space.spaceId })}
      style={({ pressed }) => [
        styles.spaceCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: isArchived ? 0.6 : pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={[styles.spaceIconWrap, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <Ionicons name={icon as any} size={20} color={colors.button} />
      </View>

      <View style={styles.spaceInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.spaceName, { color: colors.text }]} numberOfLines={1}>
            {space.nombre}
          </Text>

          <View
            style={[
              styles.pill,
              {
                backgroundColor: withAlpha(colors.button, 0.10),
                borderColor: withAlpha(colors.button, 0.18),
              },
            ]}
          >
            <Text style={[styles.pillText, { color: colors.textSecondary }]} numberOfLines={1}>
              {space.monedaBase ?? 'MXN'}
            </Text>
          </View>
        </View>

        <Text style={[styles.spaceMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {label} • {membersLabel} • {updated}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function InvitationCard({
  invitation,
  colors,
  onAccept,
  onReject,
}: {
  invitation: SharedInvitation;
  colors: any;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handle = async (action: () => Promise<void> | void) => {
    if (processing) return;
    setProcessing(true);
    try {
      await action();
    } finally {
      setProcessing(false);
    }
  };

  const pressIn = () => Animated.spring(scale, { toValue: 0.99, useNativeDriver: true, speed: 28, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          styles.invCard,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(colors.button, 0.16),
          },
        ]}
      >
        <View style={styles.invTop}>
          <View style={[styles.invIcon, { backgroundColor: withAlpha(colors.button, 0.12), borderColor: withAlpha(colors.button, 0.18) }]}>
            <Ionicons name="mail-outline" size={18} color={colors.button} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.invTitle, { color: colors.text }]} numberOfLines={1}>
              {invitation.spaceName ?? 'Espacio compartido'}
            </Text>
            {invitation.message ? (
              <Text style={[styles.invMsg, { color: colors.textSecondary }]} numberOfLines={2}>
                {invitation.message}
              </Text>
            ) : (
              <Text style={[styles.invMsg, { color: colors.textSecondary }]} numberOfLines={2}>
                Te invitaron a colaborar.
              </Text>
            )}
          </View>

          <Text style={[styles.invTime, { color: colors.textSecondary }]}>{relativeTime((invitation as any)?.createdAt)}</Text>
        </View>

        <View style={styles.invActions}>
          <Pressable
            onPress={() => handle(onReject as any)}
            disabled={processing}
            style={({ pressed }) => [
              styles.invBtn,
              { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <Text style={[styles.invBtnText, { color: colors.textSecondary }]}>Rechazar</Text>
          </Pressable>

          <Pressable
            onPress={() => handle(onAccept as any)}
            disabled={processing}
            style={({ pressed }) => [
              styles.invBtn,
              { backgroundColor: colors.button, borderColor: colors.button, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            {processing ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={[styles.invBtnText, { color: '#FFF' }]}>Aceptar</Text>}
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SkeletonSpaceCard({ colors, index }: { colors: any; index: number }) {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 620, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }}>
      <View style={[styles.spaceCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 10 }]}>
        <View style={[styles.spaceIconWrap, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} />
        <View style={{ flex: 1, marginHorizontal: 14 }}>
          <View style={{ height: 14, width: '62%', borderRadius: 8, backgroundColor: colors.backgroundSecondary, marginBottom: 8 }} />
          <View style={{ height: 12, width: '42%', borderRadius: 8, backgroundColor: colors.backgroundSecondary }} />
        </View>
        <View style={{ width: 18 }} />
      </View>
    </Animated.View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header (glass)
  headerWrap: { position: 'relative', zIndex: 10, paddingBottom: 8 },
  headerGlass: { ...StyleSheet.absoluteFillObject, borderBottomWidth: 1, opacity: 0 },
  headerBorder: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, opacity: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
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
  headerSub: { marginTop: 2, fontSize: 12, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statsPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsLabel: { fontSize: 12, fontWeight: '900', flex: 1 },
  statsValuePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statsValue: { fontSize: 12, fontWeight: '900' },

  // Sections
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900' },
  sectionMeta: { fontSize: 12, fontWeight: '900' },

  inlineCreate: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineCreateText: { fontSize: 12.5, fontWeight: '900' },

  // Space card
  spaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  spaceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spaceInfo: { flex: 1, marginHorizontal: 14 },
  spaceName: { fontSize: 15, fontWeight: '900', flex: 1 },
  spaceMeta: { marginTop: 4, fontSize: 12, fontWeight: '800' },

  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 11, fontWeight: '900' },

  // Invitation
  invCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  invTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  invIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invTitle: { fontSize: 14, fontWeight: '900' },
  invMsg: { fontSize: 12, fontWeight: '700', marginTop: 2, lineHeight: 16 },
  invTime: { fontSize: 11, fontWeight: '800' },
  invActions: { flexDirection: 'row', gap: 10 },
  invBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invBtnText: { fontSize: 14, fontWeight: '900' },

  // Empty
  emptyWrap: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyText: { fontSize: 13, fontWeight: '800', textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginTop: 2,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '900', color: '#FFF' },

  // FAB
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
});