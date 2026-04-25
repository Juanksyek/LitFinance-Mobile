import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

/**
 * Provides a fade+slide entrance animation consistent across all screens.
 * Returns { opacity, translateY } — wrap content in an Animated.View.
 */
export function useScreenEntrance(duration = 420, slideDistance = 18) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
    ]).start();
  }, []);

  return { opacity, translateY };
}

/**
 * Staggered list entry — each item fades+slides with delay.
 * Returns an array of animated style objects for N items.
 */
export function useStaggeredEntrance(count: number, stagger = 60, duration = 350, slideDistance = 14) {
  const anims = useRef(
    Array.from({ length: count }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(slideDistance),
    }))
  ).current;

  useEffect(() => {
    const animations = anims.map((a, i) =>
      Animated.parallel([
        Animated.timing(a.opacity, {
          toValue: 1,
          duration,
          delay: i * stagger,
          useNativeDriver: true,
        }),
        Animated.timing(a.translateY, {
          toValue: 0,
          duration,
          delay: i * stagger,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.parallel(animations).start();
  }, []);

  return anims;
}

/**
 * Simple press scale feedback for interactive elements.
 * Returns { scale, onPressIn, onPressOut }.
 */
export function usePressScale(activeScale = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: activeScale,
      useNativeDriver: true,
      speed: 28,
      bounciness: 0,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 4,
    }).start();
  };

  return { scale, onPressIn, onPressOut };
}
