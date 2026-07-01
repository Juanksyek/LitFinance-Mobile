import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuth from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../theme/useThemeColors';
import EventBus from '../utils/eventBus';

type AutoLockValue = 'off' | 'immediate' | '30s' | '1m' | '5m' | '10m';

const PS_KEYS = {
  useBiometrics: 'ps_useBiometrics',
  hideAppSwitcher: 'ps_hideAppSwitcher',
  autoLock: 'ps_autoLock',
} as const;

const PIN_KEY = 'ps_pin_v1';

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

const autoLockToMs = (v: AutoLockValue | null | undefined): number | null => {
  if (!v || v === 'off') return null;
  if (v === 'immediate') return 0;
  if (v === '30s') return 30_000;
  if (v === '1m') return 60_000;
  if (v === '5m') return 5 * 60_000;
  if (v === '10m') return 10 * 60_000;
  return 0;
};

export default function AppLockGate({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();

  const [useBiometrics, setUseBiometrics] = useState(false);
  const [hideAppSwitcher, setHideAppSwitcher] = useState(false);
  const [autoLock, setAutoLock] = useState<AutoLockValue>('off');
  const [pinConfigured, setPinConfigured] = useState(false);

  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastBackgroundAt = useRef<number | null>(null);
  const backgroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const biometricTriedRef = useRef(false);

  const lockEnabled = useMemo(() => autoLock !== 'off', [autoLock]);
  const autoLockMs = useMemo(() => autoLockToMs(autoLock), [autoLock]);
  const inactivityLockMs = useMemo(() => {
    if (!autoLock || autoLock === 'off') return null;
    if (autoLock === 'immediate') return null;
    return autoLockToMs(autoLock);
  }, [autoLock]);

  const loadSettings = useCallback(async () => {
    try {
      const entries = await AsyncStorage.multiGet([PS_KEYS.useBiometrics, PS_KEYS.hideAppSwitcher, PS_KEYS.autoLock]);
      const map = new Map(entries);

      setUseBiometrics(map.get(PS_KEYS.useBiometrics) === '1');
      setHideAppSwitcher(map.get(PS_KEYS.hideAppSwitcher) === '1');

      const storedAutoLock = (map.get(PS_KEYS.autoLock) as AutoLockValue | null) ?? 'off';
      setAutoLock(storedAutoLock);
    } catch {
      // ignore
    }

    try {
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      setPinConfigured(!!storedPin);
    } catch {
      setPinConfigured(false);
    }
  }, []);

  const cancelBackgroundTimer = useCallback(() => {
    if (backgroundTimer.current) {
      clearTimeout(backgroundTimer.current);
      backgroundTimer.current = null;
    }
  }, []);

  const cancelInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  }, []);

  const lockNow = useCallback(() => {
    if (!lockEnabled) return;
    if (!pinConfigured && !useBiometrics) return;
    setLocked(true);
  }, [lockEnabled, pinConfigured, useBiometrics]);

  const scheduleBackgroundLock = useCallback(() => {
    cancelBackgroundTimer();
    if (!lockEnabled) return;
    if (!pinConfigured && !useBiometrics) return;

    const ms = autoLockMs;
    if (ms == null) return;

    if (ms === 0) {
      lockNow();
      return;
    }

    backgroundTimer.current = setTimeout(() => {
      lockNow();
    }, ms);
  }, [autoLockMs, cancelBackgroundTimer, lockEnabled, lockNow, pinConfigured, useBiometrics]);

  const scheduleInactivityLock = useCallback(() => {
    cancelInactivityTimer();

    if (!lockEnabled) return;
    if (locked) return;
    if (!pinConfigured && !useBiometrics) return;
    if (appState.current !== 'active') return;

    const ms = inactivityLockMs;
    if (ms == null) return;
    if (ms <= 0) return;

    inactivityTimer.current = setTimeout(() => {
      lockNow();
    }, ms);
  }, [cancelInactivityTimer, inactivityLockMs, lockEnabled, lockNow, locked, pinConfigured, useBiometrics]);

  const onUserInteraction = useCallback(() => {
    scheduleInactivityLock();
  }, [scheduleInactivityLock]);

  const doBiometricUnlock = useCallback(async () => {
    if (!useBiometrics) return false;
    try {
      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Desbloquear',
        cancelLabel: 'Cancelar',
        fallbackLabel: pinConfigured ? 'Usar PIN' : undefined,
      });
      return !!result.success;
    } catch {
      return false;
    }
  }, [pinConfigured, useBiometrics]);

  const onUnlock = useCallback(async () => {
    setPinError(null);
    if (!locked) return;

    // Prefer biometrics if enabled
    if (useBiometrics) {
      setUnlocking(true);
      const ok = await doBiometricUnlock();
      setUnlocking(false);
      if (ok) {
        setLocked(false);
        setPinInput('');
        return;
      }
    }

    if (!pinConfigured) {
      setPinError('Configura un PIN o activa biometría.');
      return;
    }

    try {
      setUnlocking(true);
      const stored = await SecureStore.getItemAsync(PIN_KEY);
      if (!stored) {
        setPinError('PIN no configurado.');
        return;
      }
      if (pinInput.trim() !== String(stored)) {
        setPinError('PIN incorrecto');
        return;
      }
      setLocked(false);
      setPinInput('');
    } finally {
      setUnlocking(false);
    }
  }, [doBiometricUnlock, locked, pinConfigured, pinInput, useBiometrics]);

  useEffect(() => {
    loadSettings();

    const handler = () => loadSettings();
    EventBus.on('privacySecurity:changed', handler);
    return () => EventBus.off('privacySecurity:changed', handler);
  }, [loadSettings]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appState.current;
      appState.current = next;

      // Always reload settings on foreground (safe + simple)
      if (next === 'active') {
        await loadSettings();
        cancelBackgroundTimer();
        scheduleInactivityLock();

        // Evaluate if we should lock (background duration exceeded)
        if (lockEnabled && lastBackgroundAt.current != null && autoLockMs != null) {
          const elapsed = Date.now() - lastBackgroundAt.current;
          if (autoLockMs === 0 || elapsed >= autoLockMs) {
            lockNow();
          }
        }

        lastBackgroundAt.current = null;
        biometricTriedRef.current = false;
        return;
      }

      if (next === 'background' || next === 'inactive') {
        lastBackgroundAt.current = Date.now();
        cancelInactivityTimer();
        if (lockEnabled) {
          scheduleBackgroundLock();
        }
      }

      // If transitioning from background -> inactive, keep timer running.
      if ((prev === 'background' || prev === 'inactive') && (next === 'background' || next === 'inactive')) {
        // no-op
      }
    });

    return () => {
      cancelBackgroundTimer();
      cancelInactivityTimer();
      sub.remove();
    };
  }, [autoLockMs, cancelBackgroundTimer, cancelInactivityTimer, loadSettings, lockEnabled, lockNow, scheduleBackgroundLock, scheduleInactivityLock]);

  // Attempt biometrics automatically once when lock appears
  useEffect(() => {
    if (!locked) return;
    cancelInactivityTimer();
    if (!useBiometrics) return;
    if (biometricTriedRef.current) return;

    biometricTriedRef.current = true;
    (async () => {
      setUnlocking(true);
      const ok = await doBiometricUnlock();
      setUnlocking(false);
      if (ok) {
        setLocked(false);
        setPinInput('');
      }
    })();
  }, [cancelInactivityTimer, doBiometricUnlock, locked, useBiometrics]);

  useEffect(() => {
    // When unlocking finishes, restart inactivity timer.
    if (!locked && appState.current === 'active') scheduleInactivityLock();
  }, [locked, scheduleInactivityLock]);

  const showPrivacyOverlay = hideAppSwitcher && appState.current !== 'active';

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        onUserInteraction();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        onUserInteraction();
        return false;
      }}
      onTouchStart={onUserInteraction}
      onTouchMove={onUserInteraction}
      onTouchEnd={onUserInteraction}
      onTouchCancel={onUserInteraction}
    >
      {children}

      {showPrivacyOverlay && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: withAlpha(colors.background, 0.94),
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            },
          ]}
        >
          <View
            style={{
              width: 70,
              height: 70,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: withAlpha(colors.border, 0.9),
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Ionicons name="lock-closed" size={26} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>Contenido oculto</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' }}>
            Privacidad activada para el app switcher
          </Text>
        </View>
      )}

      <Modal visible={locked} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={[styles.lockWrap, { backgroundColor: withAlpha(colors.background, 0.88) }]}>
          <View style={[styles.lockCard, { backgroundColor: colors.card, borderColor: withAlpha(colors.border, 0.9) }]}>
            <View style={[styles.badge, { backgroundColor: withAlpha(colors.button, 0.14), borderColor: withAlpha(colors.button, 0.22) }]}>
              <Ionicons name="lock-closed" size={18} color={withAlpha(colors.button, 0.95)} />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>App bloqueada</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {useBiometrics ? 'Desbloquea con biometría o PIN.' : 'Ingresa tu PIN para continuar.'}
            </Text>

            {pinConfigured && (
              <View style={[styles.pinBox, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
                <Ionicons name="keypad" size={18} color={colors.textSecondary} />
                <TextInput
                  value={pinInput}
                  onChangeText={(t) => {
                    setPinError(null);
                    setPinInput(t.replace(/[^0-9]/g, '').slice(0, 6));
                  }}
                  placeholder="PIN"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  secureTextEntry
                  style={[styles.pinInput, { color: colors.text }]}
                  maxLength={6}
                />
              </View>
            )}

            {!!pinError && <Text style={[styles.error, { color: colors.error }]}>{pinError}</Text>}

            <View style={styles.actions}>
              {useBiometrics && (
                <TouchableOpacity
                  disabled={unlocking}
                  onPress={async () => {
                    setPinError(null);
                    setUnlocking(true);
                    const ok = await doBiometricUnlock();
                    setUnlocking(false);
                    if (ok) {
                      setLocked(false);
                      setPinInput('');
                    }
                  }}
                  activeOpacity={0.85}
                  style={[styles.btn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                >
                  <Ionicons name="finger-print" size={18} color={colors.textSecondary} />
                  <Text style={[styles.btnText, { color: colors.textSecondary }]}>Biometría</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                disabled={unlocking}
                onPress={onUnlock}
                activeOpacity={0.85}
                style={[styles.btnPrimary, { backgroundColor: colors.button }]}
              >
                {unlocking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnPrimaryText}>Desbloquear</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  lockWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  lockCard: {
    width: '92%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  pinBox: {
    marginTop: 12,
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    padding: 0,
  },
  error: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '800',
  },
  actions: {
    marginTop: 14,
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  btnPrimary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
});
