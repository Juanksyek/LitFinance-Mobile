import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useThemeColors } from '../theme/useThemeColors';
import Toast from 'react-native-toast-message';
import * as sharedService from '../services/sharedSpacesService';
import type { SharedNotification, SharedNotificationType } from '../types/sharedSpaces';

// ── Notification icon/color mapping ─────────────────────────────────────────

const NOTIF_ICON: Record<SharedNotificationType, string> = {
  invitation_received: 'mail-outline',
  invitation_accepted: 'checkmark-circle-outline',
  invitation_rejected: 'close-circle-outline',
  invitation_revoked: 'ban-outline',
  member_joined: 'person-add-outline',
  member_left: 'exit-outline',
  member_removed: 'person-remove-outline',
  role_changed: 'shield-checkmark-outline',
  movement_created: 'add-circle-outline',
  movement_edited: 'create-outline',
  movement_cancelled: 'trash-outline',
  impact_applied: 'flash-outline',
  impact_reverted: 'return-up-back-outline',
  impact_failed: 'alert-circle-outline',
  space_updated: 'settings-outline',
  space_archived: 'archive-outline',
};

const NOTIF_COLOR: Record<string, string> = {
  invitation_received: '#6366F1',
  invitation_accepted: '#10B981',
  invitation_rejected: '#EF4444',
  invitation_revoked: '#F59E0B',
  member_joined: '#10B981',
  member_left: '#F59E0B',
  member_removed: '#EF4444',
  role_changed: '#6366F1',
  movement_created: '#3B82F6',
  movement_edited: '#6366F1',
  movement_cancelled: '#EF4444',
  impact_applied: '#10B981',
  impact_reverted: '#F59E0B',
  impact_failed: '#EF4444',
  space_updated: '#3B82F6',
  space_archived: '#6B7280',
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
  return new Date(iso).toLocaleDateString();
}

export default function SharedNotificationsScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();

  const [notifications, setNotifications] = useState<SharedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async (pageNum = 1, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await sharedService.listSharedNotifications({ page: pageNum, limit: 30 });
      if (pageNum === 1) {
        setNotifications(res.items ?? []);
      } else {
        setNotifications((prev) => [...prev, ...(res.items ?? [])]);
      }
      setTotal(res.total ?? 0);
      setPage(pageNum);
      setUnreadCount(res.unreadCount ?? 0);
    } catch (err: any) {
      if (!silent) Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? '' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchNotifications(1, true); }, [fetchNotifications]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleMarkRead = useCallback(async (notif: SharedNotification) => {
    if (notif.read) return;
    try {
      await sharedService.markNotificationRead(notif.notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notif.notificationId ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await sharedService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      Toast.show({ type: 'success', text1: 'Todas las notificaciones marcadas como leídas' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? '' });
    }
  }, []);

  const loadMore = useCallback(() => {
    if (notifications.length < total) {
      fetchNotifications(page + 1, true);
    }
  }, [notifications.length, total, page, fetchNotifications]);

  const renderNotification = useCallback(
    ({ item }: { item: SharedNotification }) => {
      const icon = NOTIF_ICON[item.type] ?? 'notifications-outline';
      const iconColor = NOTIF_COLOR[item.type] ?? colors.button;
      return (
        <TouchableOpacity
          onPress={() => handleMarkRead(item)}
          activeOpacity={0.9}
          style={[
            styles.notifCard,
            {
              backgroundColor: item.read ? colors.card : `${colors.button}10`,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.notifIcon, { backgroundColor: `${iconColor}18` }]}>
            <Ionicons name={icon as any} size={18} color={iconColor} />
          </View>
          <View style={styles.notifContent}>
            <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.notifMsg, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={[styles.notifTime, { color: colors.textSecondary }]}>
              {relativeTime(item.createdAt)}
            </Text>
          </View>
          {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.button }]} />}
        </TouchableOpacity>
      );
    },
    [colors, handleMarkRead],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notificaciones</Text>
          {unreadCount > 0 && (
            <Text style={[styles.headerSub, { color: colors.button }]}>
              {unreadCount} sin leer
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerBtn} activeOpacity={0.85}>
            <Ionicons name="checkmark-done-outline" size={20} color={colors.button} />
          </TouchableOpacity>
        )}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.button} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin notificaciones</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Las actividades de tus espacios compartidos aparecerán aquí.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.notificationId}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.button} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    elevation: 4,
  },
  headerBtn: { width: 42, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 0.2 },
  headerSub: { marginTop: 2, fontSize: 12, fontWeight: '700' },

  listContent: { padding: 18, paddingBottom: 40 },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
  notifMsg: { fontSize: 12, fontWeight: '600', lineHeight: 17, marginBottom: 4 },
  notifTime: { fontSize: 10, fontWeight: '600' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, marginLeft: 6 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  emptyText: { fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 18 },
});
