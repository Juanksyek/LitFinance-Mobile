import React, { useMemo, useRef, useCallback } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';

type Props = {
  onPress: () => void;
};

const MetasCard: React.FC<Props> = ({ onPress }) => {
  const colors = useThemeColors();

  // Animations (no reanimated needed)
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const chevronX = useRef(new Animated.Value(0)).current;

  const startHover = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.985, duration: 110, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 180, useNativeDriver: false }),
      Animated.timing(chevronX, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [scale, glow, chevronX]);

  const endHover = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 130, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(chevronX, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [scale, glow, chevronX]);

  const glowBg = useMemo(() => {
    // soft tint with button color
    const c = (colors.button || '#3B82F6').trim();
    // try to make an rgba-ish overlay. If color isn't hex, fallback to low opacity.
    const isHex = c.startsWith('#') && (c.length === 7 || c.length === 4);
    if (!isHex) return 'rgba(59,130,246,0.10)';

    const hex = c.slice(1);
    const full = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (![r, g, b].every((n) => Number.isFinite(n))) return 'rgba(59,130,246,0.10)';
    return `rgba(${r},${g},${b},0.10)`;
  }, [colors.button]);

  const overlayOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const chevronTranslate = chevronX.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={startHover}
      onPressOut={endHover}
      style={({ pressed }) => [{ opacity: pressed ? 0.98 : 1 }]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Abrir metas"
    >
      <Animated.View
        style={[
          styles.card,
          styles.softShadow,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Glow overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.glowOverlay,
            {
              backgroundColor: glowBg,
              opacity: overlayOpacity,
              borderColor: colors.button,
            },
          ]}
        />

        <View style={styles.left}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="flag" size={18} color={colors.button} />
          </View>

          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                Metas
              </Text>
            </View>

            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
              Define objetivos y da seguimiento a tu progreso.
            </Text>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={[styles.cta, { color: colors.button }]}>Ver metas</Text>
          <Animated.View style={{ transform: [{ translateX: chevronTranslate }] }}>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  softShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },

  glowOverlay: {
    borderWidth: 1,
    borderRadius: 16,
  },

  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  textWrap: { flex: 1 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 12, lineHeight: 16 },

  badge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },

  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cta: { fontSize: 13, fontWeight: '900' },
});

export default MetasCard;