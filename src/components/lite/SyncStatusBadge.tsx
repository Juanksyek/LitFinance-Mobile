import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../../theme/useThemeColors';
import { syncQueueRepository } from '../../local-db/repositories/syncQueue.repository';

type BadgeState = {
  conflictCount: number;
  errorCount: number;
  online: boolean;
  pendingCount: number;
};

export default function SyncStatusBadge() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const [state, setState] = useState<BadgeState>({
    conflictCount: 0,
    errorCount: 0,
    online: true,
    pendingCount: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      Promise.all([
        syncQueueRepository.getMetrics(),
        NetInfo.fetch().catch(() => null),
      ]).then(([metrics, netState]) => {
        if (!mounted) return;
        setState({
          conflictCount: metrics.conflictCount,
          errorCount: metrics.errorCount,
          online: Boolean(netState?.isConnected),
          pendingCount: metrics.pendingCount,
        });
      });
      return () => {
        mounted = false;
      };
    }, []),
  );

  const label = getLabel(state);
  const color = getColor(state, colors);
  const icon = getIcon(state);

  return (
    <TouchableOpacity
      style={[styles.badge, { borderColor: color, backgroundColor: withAlpha(color, 0.11) }]}
      onPress={() => navigation.navigate('SyncStatus')}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function getLabel(state: BadgeState): string {
  if (!state.online) return 'Sin conexion';
  if (state.conflictCount > 0) return `${state.conflictCount} conflicto${state.conflictCount === 1 ? '' : 's'}`;
  if (state.errorCount > 0) return `${state.errorCount} error${state.errorCount === 1 ? '' : 'es'}`;
  if (state.pendingCount > 0) return `${state.pendingCount} pendiente${state.pendingCount === 1 ? '' : 's'}`;
  return 'Sincronizado';
}

function getIcon(state: BadgeState): React.ComponentProps<typeof Ionicons>['name'] {
  if (!state.online) return 'cloud-offline-outline';
  if (state.conflictCount > 0 || state.errorCount > 0) return 'alert-circle-outline';
  if (state.pendingCount > 0) return 'cloud-upload-outline';
  return 'checkmark-circle-outline';
}

function getColor(state: BadgeState, colors: ReturnType<typeof useThemeColors>): string {
  if (!state.online) return colors.textSecondary;
  if (state.conflictCount > 0 || state.errorCount > 0) return colors.error;
  if (state.pendingCount > 0) return colors.warning;
  return colors.success;
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
  },
});
