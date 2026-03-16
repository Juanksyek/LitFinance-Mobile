import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

type ThemeLike = {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  button: string;
  border: string;
};

type Piece = {
  startX: number;
  drift: number;
  size: number;
  radius: number;
  rotate: string;
  delay: number;
  duration: number;
  color: string;
};

type Props = {
  visible: boolean;
  colors: ThemeLike;
  title?: string;
  subtitle?: string;
  onDone?: () => void;
};

const PIECES = 26;

export default function ConfettiOverlay({ visible, colors, title, subtitle, onDone }: Props) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.96)).current;

  const progress = useRef(Array.from({ length: PIECES }, () => new Animated.Value(0))).current;

  const pieces: Piece[] = useMemo(() => {
    const palette = [
      withAlpha(colors.button, 0.95),
      withAlpha(colors.button, 0.55),
      withAlpha(colors.textSecondary, 0.75),
      withAlpha(colors.text, 0.55),
    ];

    // Deterministic-ish distribution without external RNG dependency
    return Array.from({ length: PIECES }, (_, i) => {
      const t = (i + 1) / PIECES;
      const startX = Math.round(10 + t * (SCREEN_W - 20));
      const drift = Math.round(((i % 2 === 0 ? 1 : -1) * (20 + (i % 5) * 10)));
      const size = 6 + (i % 4) * 3;
      const radius = i % 3 === 0 ? size / 2 : 2;
      const rotate = `${(i % 2 === 0 ? 1 : -1) * (220 + (i % 7) * 30)}deg`;
      const delay = (i % 9) * 30;
      const duration = 900 + (i % 8) * 90;
      const color = palette[i % palette.length];

      return { startX, drift, size, radius, rotate, delay, duration, color };
    });
  }, [colors.button, colors.text, colors.textSecondary]);

  useEffect(() => {
    if (!visible) return;

    overlayOpacity.setValue(0);
    cardOpacity.setValue(0);
    cardScale.setValue(0.96);
    progress.forEach((p) => p.setValue(0));

    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, friction: 9, tension: 120, useNativeDriver: true }),
    ]).start();

    const anims = progress.map((p, idx) =>
      Animated.timing(p, {
        toValue: 1,
        duration: pieces[idx]?.duration ?? 1100,
        delay: pieces[idx]?.delay ?? 0,
        useNativeDriver: true,
      })
    );

    Animated.stagger(18, anims).start();

    const t = setTimeout(() => {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        onDone?.();
      });
    }, 1650);

    return () => {
      clearTimeout(t);
    };
  }, [cardOpacity, cardScale, onDone, overlayOpacity, pieces, progress, visible]);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: overlayOpacity, backgroundColor: withAlpha(colors.background, 0.12) }]}>
      {pieces.map((cfg, idx) => {
        const p = progress[idx];
        const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [-20, SCREEN_H + 80] });
        const translateX = p.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.drift] });
        const rotate = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', cfg.rotate] });
        const opacity = p.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0.9] });

        return (
          <Animated.View
            key={idx}
            style={{
              position: 'absolute',
              left: cfg.startX,
              top: 0,
              width: cfg.size,
              height: cfg.size,
              borderRadius: cfg.radius,
              backgroundColor: cfg.color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}

      <Animated.View
        style={[
          styles.toastCard,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(colors.border, 0.9),
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        <View style={[styles.badge, { backgroundColor: withAlpha(colors.button, 0.14), borderColor: withAlpha(colors.button, 0.22) }]}
        >
          <Ionicons name="sparkles" size={18} color={withAlpha(colors.button, 0.95)} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title ?? '¡Meta cumplida!'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {subtitle ?? 'Qué gusto verte lograrlo. Sigue así.'}
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  toastCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 64,
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
