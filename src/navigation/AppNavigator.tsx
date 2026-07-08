import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import LegacyNavigator from './LegacyNavigator';
import LiteNavigator from './LiteNavigator';
import { versionConfigService, type VersionConfig } from '../services/versionConfigService';
import { useThemeColors } from '../theme/useThemeColors';

export type { RootStackParamList, Subcuenta } from './LegacyNavigator';

export default function AppNavigator() {
  const colors = useThemeColors();
  const [config, setConfig] = useState<VersionConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    versionConfigService
      .fetchAndPersist()
      .catch(() => versionConfigService.getConfig())
      .then((nextConfig) => {
        if (mounted) setConfig(nextConfig);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading && !config) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.button} />
      </View>
    );
  }

  return config?.mode === 'full' ? <LegacyNavigator /> : <LiteNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
