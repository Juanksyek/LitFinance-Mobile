import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StatusBar, Dimensions } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

type AndroidNavMode = 'buttons' | 'gesture' | 'unknown';

type StableInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** info útil para debug/telemetría */
  androidNavMode?: AndroidNavMode;
  hasAndroidNavButtons?: boolean;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Insets estables:
 * - NO cambian con teclado/modals
 * - NO hacen "jump" por heurísticas de screen/window
 * - En Android detecta (aprox) gesture vs 3-botones
 */
export function useStableSafeInsets(): StableInsets {
  const dynamic = useSafeAreaInsets();

  const MAX_BOTTOM = Platform.OS === 'ios' ? 34 : 48; // 48 cubre 3-botones en edge-to-edge

  // Base inicial (evita el "primer render = 0" en muchos Android)
  const initial = useMemo(() => {
    const i = initialWindowMetrics?.insets;
    if (i) {
      return {
        top: i.top,
        bottom: clamp(i.bottom, 0, MAX_BOTTOM),
        left: i.left,
        right: i.right,
      };
    }
    return {
      top: dynamic.top,
      bottom: clamp(dynamic.bottom, 0, MAX_BOTTOM),
      left: dynamic.left,
      right: dynamic.right,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [stable, setStable] = useState<StableInsets>(initial);

  // Refs para “freeze” + regla monotónica (nunca bajar bottom)
  const topRef = useRef(stable.top);
  const bottomRef = useRef(stable.bottom);
  const leftRef = useRef(stable.left);
  const rightRef = useRef(stable.right);

  const keyboardVisibleRef = useRef(false);

  useEffect(() => {
    const s1 = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisibleRef.current = true;
    });
    const s2 = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false;
    });
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  // Actualiza SOLO cuando:
  // - teclado NO visible
  // - bottom “plausible” (<= MAX_BOTTOM)
  // - y bottom NUEVO es mayor (para evitar saltos por cambios raros)
  useEffect(() => {
    if (keyboardVisibleRef.current) return;

    const nextBottom = clamp(dynamic.bottom, 0, MAX_BOTTOM);

    let changed = false;

    // bottom monotónico (nunca disminuye)
    if (nextBottom > bottomRef.current) {
      bottomRef.current = nextBottom;
      changed = true;
    }

    // top/left/right sí pueden cambiar por rotación/cutouts, etc.
    if (dynamic.top !== topRef.current) {
      topRef.current = dynamic.top;
      changed = true;
    }
    if (dynamic.left !== leftRef.current) {
      leftRef.current = dynamic.left;
      changed = true;
    }
    if (dynamic.right !== rightRef.current) {
      rightRef.current = dynamic.right;
      changed = true;
    }

    if (changed) {
      setStable({
        top: topRef.current,
        bottom: bottomRef.current,
        left: leftRef.current,
        right: rightRef.current,
      });
    }
  }, [dynamic.top, dynamic.bottom, dynamic.left, dynamic.right, MAX_BOTTOM]);

  // Identificación aproximada: gesture vs 3-botones (para “no conflictos”)
  const androidNavMode: AndroidNavMode = useMemo(() => {
    if (Platform.OS !== 'android') return 'unknown';

    const b = bottomRef.current;

    // En edge-to-edge:
    // - 3 botones suele ser ~40-48
    // - gesture ~10-24
    if (b >= 32) return 'buttons';
    if (b > 0) return 'gesture';

    // Fallback: cuando bottom=0 (modo no edge-to-edge o insets raros)
    // Si la navbar "consume" layout, screen-window suele crecer (sin teclado).
    const { height: screenH } = Dimensions.get('screen');
    const { height: winH } = Dimensions.get('window');
    const statusH = StatusBar.currentHeight ?? 0;
    const sysBottom = Math.max(0, screenH - winH - statusH);

    if (sysBottom >= 32) return 'buttons';
    if (sysBottom > 0) return 'gesture';

    return 'unknown';
  }, [stable.bottom]);

  // Debug útil (puedes quitarlo luego)
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('📐 [useStableSafeInsets]', {
      platform: Platform.OS,
      stableBottom: stable.bottom,
      androidNavMode,
    });
  }, [stable.bottom, androidNavMode]);

  return {
    ...stable,
    androidNavMode,
    hasAndroidNavButtons: Platform.OS === 'android' && androidNavMode === 'buttons',
  };
}
