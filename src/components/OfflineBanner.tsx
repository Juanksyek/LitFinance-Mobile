import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useConnectivity } from '../connectivity/ConnectivityContext';
import { useThemeColors } from '../theme/useThemeColors';

export default function OfflineBanner() {
  const { isConnected, isInternetReachable } = useConnectivity();
  const colors = useThemeColors();

  if (isConnected && isInternetReachable !== false) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: '#C4512D' }]}>
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>Sin conexión. Guardaremos cambios pendientes para sincronizarlos después.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
