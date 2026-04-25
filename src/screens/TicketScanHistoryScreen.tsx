import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Animated,
  PanResponder,
  Modal,
  Pressable,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../theme/useThemeColors';
import {
  ticketScanService,
  CATEGORY_CONFIG,
  type Ticket,
  type TicketEstado,
  type TicketCategoria,
} from '../services/ticketScanService';

const ESTADO_CONFIG: Record<TicketEstado, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  processing: { label: 'Procesando', color: '#F59E0B', icon: 'hourglass-outline' },
  review:     { label: 'En revisión', color: '#3B82F6', icon: 'eye-outline' },
  completed:  { label: 'Completado', color: '#10B981', icon: 'checkmark-circle-outline' },
  failed:     { label: 'Fallido', color: '#EF4444', icon: 'alert-circle-outline' },
  cancelled:  { label: 'Cancelado', color: '#9E9E9E', icon: 'close-circle-outline' },
};

const FILTERS: { value: TicketEstado | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'review', label: 'En revisión' },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados' },
];

function formatDate(iso: string | any) {
  // Handle MongoDB Extended JSON date: { $date: '...' }
  if (iso && typeof iso === 'object' && iso.$date) iso = iso.$date;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const ACTION_WIDTH = 80;
const SWIPE_THRESHOLD = -ACTION_WIDTH * 0.55;

interface SwipeableRowProps {
  item: Ticket;
  onPress: (ticket: Ticket) => void;
  onDeleteRequest: (ticket: Ticket) => void;
  colors: ReturnType<typeof import('../theme/useThemeColors').useThemeColors>;
}

function SwipeableTicketRow({ item, onPress, onDeleteRequest, colors }: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const snapToOpen = () => {
    Animated.spring(translateX, {
      toValue: -ACTION_WIDTH,
      useNativeDriver: true,
      bounciness: 4,
    }).start(() => { isOpen.current = true; });
  };

  const snapToClose = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start(() => { isOpen.current = false; });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 6 && Math.abs(gs.dx) > Math.abs(gs.dy * 1.5),
      onPanResponderMove: (_, gs) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        const next = Math.max(Math.min(base + gs.dx, 0), -ACTION_WIDTH);
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        if (isOpen.current) {
          gs.dx > ACTION_WIDTH * 0.4 ? snapToClose() : snapToOpen();
        } else {
          gs.dx < SWIPE_THRESHOLD ? snapToOpen() : snapToClose();
        }
      },
    }),
  ).current;

  const estado = ESTADO_CONFIG[item.estado] ?? ESTADO_CONFIG.completed;
  const topCats = Object.entries(item.resumenCategorias || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <View style={[rowStyles.wrapper, { borderRadius: 14, marginBottom: 10 }]}>
      {/* Delete action behind the card */}
      <View style={rowStyles.deletePane}>
        <TouchableOpacity
          style={rowStyles.deleteBtn}
          activeOpacity={0.8}
          onPress={() => {
            snapToClose();
            onDeleteRequest(item);
          }}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={rowStyles.deleteLabel}>Eliminar</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable card */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          style={[rowStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={() => {
            if (isOpen.current) { snapToClose(); return; }
            onPress(item);
          }}
        >
          <View style={rowStyles.ticketTop}>
            <View style={rowStyles.ticketMainInfo}>
              <View style={[rowStyles.storeIcon, { backgroundColor: '#EF772514' }]}>
                <Ionicons name="storefront-outline" size={18} color="#EF7725" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[rowStyles.storeName, { color: colors.text }]} numberOfLines={1}>
                  {item.tienda || 'Sin nombre'}
                </Text>
                <Text style={[rowStyles.ticketDate, { color: colors.textSecondary }]}>
                  {formatDate(item.fechaCompra || item.createdAt)}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[rowStyles.ticketTotal, { color: colors.text }]}>
                ${(item.total ?? 0).toFixed(2)}
              </Text>
              <View style={[rowStyles.estadoBadge, { backgroundColor: estado.color + '18' }]}>
                <Ionicons name={estado.icon} size={12} color={estado.color} />
                <Text style={[rowStyles.estadoLabel, { color: estado.color }]}>{estado.label}</Text>
              </View>
            </View>
          </View>

          {topCats.length > 0 && (
            <View style={rowStyles.catRow}>
              {topCats.map(([cat, amount]) => {
                const cfg = CATEGORY_CONFIG[cat as TicketCategoria] ?? CATEGORY_CONFIG.otros;
                return (
                  <View key={cat} style={[rowStyles.catTag, { backgroundColor: cfg.color + '12' }]}>
                    <Text style={{ fontSize: 12 }}>{cfg.icon}</Text>
                    <Text style={[rowStyles.catTagText, { color: cfg.color }]}>
                      ${(amount as number).toFixed(0)}
                    </Text>
                  </View>
                );
              })}
              <Text style={[rowStyles.itemCount, { color: colors.textSecondary }]}>
                {item.items?.length ?? 0} artículos
              </Text>
            </View>
          )}
          {/* Detalles de items: lista de nombres / descripciones por ticket */}
          {item.detalles && item.detalles.length > 0 && (
            <View style={rowStyles.detallesRow}>
              {item.detalles.map((d, i) => (
                <Text key={String(i)} numberOfLines={1} style={[rowStyles.detalleText, { color: colors.textSecondary }]}>
                  • {d}
                </Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

interface DeleteModalProps {
  visible: boolean;
  ticket: Ticket | null;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  colors: ReturnType<typeof import('../theme/useThemeColors').useThemeColors>;
}

function DeleteConfirmModal({ visible, ticket, deleting, onConfirm, onCancel, colors }: DeleteModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={modalStyles.backdrop} onPress={!deleting ? onCancel : undefined}>
        <Pressable style={[modalStyles.box, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={modalStyles.iconWrap}>
            <Ionicons name="trash-outline" size={28} color="#EF4444" />
          </View>
          <Text style={[modalStyles.title, { color: colors.text }]}>Eliminar ticket</Text>
          <Text style={[modalStyles.body, { color: colors.textSecondary }]}>
            ¿Estás seguro de que deseas eliminar el ticket de{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {ticket?.tienda || 'esta tienda'}
            </Text>
            ?{'\n'}Esta acción no se puede deshacer.
          </Text>

          <View style={modalStyles.btnRow}>
            <TouchableOpacity
              style={[modalStyles.btn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={onCancel}
              disabled={deleting}
              activeOpacity={0.7}
            >
              <Text style={[modalStyles.btnText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.btn, modalStyles.btnDanger]}
              onPress={onConfirm}
              disabled={deleting}
              activeOpacity={0.7}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[modalStyles.btnText, { color: '#fff' }]}>Eliminar</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function TicketScanHistoryScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<TicketEstado | 'all'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState(false);

  const LIMIT = 15;

  const fetchTickets = useCallback(async (pageN: number, append: boolean, estado?: TicketEstado | 'all') => {
    try {
      const res = await ticketScanService.list({
        page: pageN,
        limit: LIMIT,
        estado: !estado || estado === 'all' ? undefined : estado,
      });
      setTotal(res.total);
      setTickets((prev) => (append ? [...prev, ...res.data] : res.data));
    } catch (err) {
      console.error('[TicketHistory] fetch error', err);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setPage(1);
    await fetchTickets(1, false, filter === 'all' ? undefined : filter);
    setLoading(false);
  }, [filter, fetchTickets]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await fetchTickets(1, false, filter === 'all' ? undefined : filter);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (loadingMore || tickets.length >= total) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    await fetchTickets(next, true, filter === 'all' ? undefined : filter);
    setLoadingMore(false);
  };

  const onFilterChange = (f: TicketEstado | 'all') => {
    setFilter(f);
    setPage(1);
    setTickets([]);
    setLoading(true);
    fetchTickets(1, false, f === 'all' ? undefined : f).finally(() => setLoading(false));
  };

  const openDetail = (ticket: Ticket) => {
    if (ticket.estado === 'review') {
      // @ts-ignore
      navigation.navigate('TicketReview', { ticket });
    } else {
      // @ts-ignore
      navigation.navigate('TicketScanDetail', { ticketId: ticket.ticketId });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await ticketScanService.delete(deleteTarget.ticketId);
      setTickets((prev) => prev.filter((t) => t.ticketId !== deleteTarget.ticketId));
      setTotal((prev) => Math.max(0, prev - 1));
      setDeleteTarget(null);
    } catch (err) {
      console.error('[TicketHistory] delete error', err);
    } finally {
      setDeleting(false);
    }
  };

  const renderItem = ({ item }: { item: Ticket }) => (
    <SwipeableTicketRow
      item={item}
      onPress={openDetail}
      onDeleteRequest={setDeleteTarget}
      colors={colors}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Delete confirm modal */}
      <DeleteConfirmModal
        visible={deleteTarget !== null}
        ticket={deleteTarget}
        deleting={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        colors={colors}
      />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            // Regresar al Dashboard pero con el menú de Scan abierto (no abrir la cámara directamente)
            // Esto permite que el modal de escaneo esté disponible sin iniciar la cámara.
            // @ts-ignore
            navigation.navigate('Dashboard', { openScan: 'menu' });
          }}
        >
          <Ionicons name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Historial de tickets</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tickets</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#EF7725' }]}>
            ${tickets.filter((t) => t.confirmado).reduce((s, t) => s + (t.total || 0), 0).toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Gastado</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? '#EF772518' : colors.cardSecondary,
                  borderColor: active ? '#EF7725' : colors.border,
                },
              ]}
              onPress={() => onFilterChange(f.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: active ? '#EF7725' : colors.textSecondary },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EF7725" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando tickets...</Text>
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.cardSecondary }]}>
            <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin tickets</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Escanea tu primer recibo para empezar a registrar gastos automáticamente
          </Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.ticketId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color="#EF7725" style={{ marginVertical: 16 }} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },

  statsBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, marginVertical: 4 },

  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontWeight: '600' },

  ticketCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticketMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 12,
  },
  storeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: { fontSize: 15, fontWeight: '600' },
  ticketDate: { fontSize: 12, marginTop: 2 },
  ticketTotal: { fontSize: 17, fontWeight: '800' },

  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  estadoLabel: { fontSize: 10, fontWeight: '600' },

  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  catTagText: { fontSize: 11, fontWeight: '600' },
  itemCount: { fontSize: 11, marginLeft: 4 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  loadingText: { fontSize: 14, marginTop: 12 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

/* ─── Swipeable row styles ─────────────────────────────────── */
const rowStyles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  deletePane: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  deleteLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticketMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 12,
  },
  storeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: { fontSize: 15, fontWeight: '600' },
  ticketDate: { fontSize: 12, marginTop: 2 },
  ticketTotal: { fontSize: 17, fontWeight: '800' },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  estadoLabel: { fontSize: 10, fontWeight: '600' },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  catTagText: { fontSize: 11, fontWeight: '600' },
  itemCount: { fontSize: 11, marginLeft: 4 },
  detallesRow: {
    marginTop: 8,
  },
  detalleText: {
    fontSize: 12,
    marginTop: 2,
  },
});

/* ─── Delete modal styles ──────────────────────────────────── */
const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  box: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#EF44441A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnDanger: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
