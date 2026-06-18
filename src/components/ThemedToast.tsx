import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToastConfig } from 'react-native-toast-message';

import { useThemeColors } from '../theme/useThemeColors';

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

type Variant = 'success' | 'error' | 'info' | 'warning';

type Props = {
  variant: Variant;
  text1?: string;
  text2?: string;
};

const ThemedToastCard = memo(function ThemedToastCard({ variant, text1, text2 }: Props) {
  const colors = useThemeColors();

  const accent =
    variant === 'success'
      ? colors.button
      : variant === 'error'
        ? colors.error
        : variant === 'warning'
          ? colors.warning
          : colors.info;

  const icon: any =
    variant === 'success'
      ? 'sparkles'
      : variant === 'error'
        ? 'alert-circle'
        : variant === 'warning'
          ? 'warning'
          : 'information-circle';

  const fallbackTitle =
    variant === 'success'
      ? 'Listo'
      : variant === 'error'
        ? 'Error'
        : variant === 'warning'
          ? 'Atención'
          : 'Info';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(colors.border, 0.9),
        },
      ]}
    >
      <View
        style={[
          styles.badge,
          {
            backgroundColor: withAlpha(accent, 0.14),
            borderColor: withAlpha(accent, 0.22),
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={withAlpha(accent, 0.95)} />
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {text1 || fallbackTitle}
        </Text>
        {!!text2 && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {text2}
          </Text>
        )}
      </View>
    </View>
  );
});

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => <ThemedToastCard variant="success" text1={text1} text2={text2} />, 
  error: ({ text1, text2 }) => <ThemedToastCard variant="error" text1={text1} text2={text2} />,
  info: ({ text1, text2 }) => <ThemedToastCard variant="info" text1={text1} text2={text2} />,
  warning: ({ text1, text2 }) => <ThemedToastCard variant="warning" text1={text1} text2={text2} />,
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});
