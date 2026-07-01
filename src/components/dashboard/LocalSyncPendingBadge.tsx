import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../theme/useThemeColors';
import { syncQueueRepository } from '../../local-db/repositories/syncQueue.repository';

export default function LocalSyncPendingBadge() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const [metrics, setMetrics] = useState({
    conflictCount: 0,
    errorCount: 0,
    pendingCount: 0,
    syncedCount: 0,
  });

  const loadMetrics = useCallback(async () => {
    try {
      setMetrics(await syncQueueRepository.getMetrics());
    } catch {
      setMetrics({ conflictCount: 0, errorCount: 0, pendingCount: 0, syncedCount: 0 });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMetrics();
    }, [loadMetrics]),
  );

  const hasIssues = metrics.conflictCount > 0 || metrics.errorCount > 0;
  const hasPending = metrics.pendingCount > 0;

  if (!hasPending && !hasIssues) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => navigation.navigate('SyncStatus')}
      style={[
        styles.container,
        {
          backgroundColor: hasIssues ? '#FEE2E2' : '#FFF3E8',
          borderColor: hasIssues ? '#EF4444' : '#EF7725',
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.left}>
        <Ionicons
          name={hasIssues ? 'warning-outline' : 'sync-outline'}
          size={18}
          color={hasIssues ? '#DC2626' : '#EF7725'}
        />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: hasIssues ? '#991B1B' : '#8A3F00' }]}>
            {hasIssues ? 'Revisa tu sincronizacion' : 'Cambios guardados en este dispositivo'}
          </Text>
          <Text style={[styles.subtitle, { color: hasIssues ? '#B91C1C' : '#9A4D0A' }]}>
            {metrics.pendingCount > 0 ? `${metrics.pendingCount} pendiente(s)` : 'Sin pendientes'}
            {metrics.conflictCount > 0 ? ` · ${metrics.conflictCount} conflicto(s)` : ''}
            {metrics.errorCount > 0 ? ` · ${metrics.errorCount} error(es)` : ''}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={hasIssues ? '#DC2626' : '#EF7725'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  copy: { flex: 1 },
  left: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10 },
  subtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  title: { fontSize: 13, fontWeight: '900' },
});
