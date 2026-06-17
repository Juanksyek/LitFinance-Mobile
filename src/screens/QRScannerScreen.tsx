import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import EventBus from '../utils/eventBus';
import * as sharedService from '../services/sharedSpacesService';
import { useThemeColors } from '../theme/useThemeColors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SCAN_SIZE = SCREEN_W * 0.68;

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function extractTokenFromUrl(url: string): string | null {
  try {
    // Handle both https://app.thelitfinance.com/invite?token=xxx and litfinance://invite?token=xxx
    const match = url.match(/[?&]token=([^&]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

type ScreenState = 'scanning' | 'verifying' | 'preview' | 'joining' | 'success' | 'error';

interface VerifiedInvitation {
  valid: boolean;
  invitationId: string;
  invitationType: string;
  rol: string;
  message?: string;
  multiUse?: boolean;
  maxUses?: number | null;
  acceptedCount?: number;
  remainingUses?: number | null;
  expiresAt: string;
  space: {
    spaceId: string;
    nombre: string;
    tipo: string;
    monedaBase: string;
  };
  invitedBy?: string;
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function QRScannerScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();

  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScreenState>('scanning');
  const [invitation, setInvitation] = useState<VerifiedInvitation | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [scannedToken, setScannedToken] = useState('');
  const isProcessing = useRef(false);

  // Animations
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const cornerPulse = useRef(new Animated.Value(1)).current;
  const overlayFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(SCREEN_H)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successRotate = useRef(new Animated.Value(0)).current;

  // ── Scan line animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'scanning') return;

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    scanLoop.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cornerPulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(cornerPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    return () => {
      scanLoop.stop();
      pulseLoop.stop();
    };
  }, [state, scanLineAnim, cornerPulse]);

  // ── Show card animation ─────────────────────────────────────────────────
  const showCard = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }),
    ]).start();
  }, [overlayFade, cardSlide, cardScale]);

  const hideCard = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayFade, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.9, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [overlayFade, cardSlide, cardScale]);

  // ── Success animation ───────────────────────────────────────────────────
  const playSuccess = useCallback(() => {
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 12 }),
      Animated.timing(successRotate, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [successScale, successRotate]);

  // ── Handle barcode scan ─────────────────────────────────────────────────
  const handleBarcodeScan = useCallback(
    async (result: BarcodeScanningResult) => {
      if (isProcessing.current || state !== 'scanning') return;
      isProcessing.current = true;

      const data = result.data;
      const token = extractTokenFromUrl(data);

      if (!token) {
        // Not a valid invitation QR
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Toast.show({
          type: 'error',
          text1: 'QR no válido',
          text2: 'Este código no es una invitación de LitFinance.',
        });
        setTimeout(() => {
          isProcessing.current = false;
        }, 2500);
        return;
      }

      // Valid token found!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScannedToken(token);
      setState('verifying');

      try {
        const result = await sharedService.verifyInvitationToken(token);
        setInvitation(result);
        setState('preview');
        showCard();
      } catch (err: any) {
        const msg = err?.message ?? 'No se pudo verificar la invitación.';
        setErrorMsg(msg);
        setState('error');
        showCard();
      }
    },
    [state, showCard]
  );

  // ── Accept invitation ───────────────────────────────────────────────────
  const handleAccept = useCallback(async () => {
    if (!scannedToken) return;
    setState('joining');

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await sharedService.acceptInvitationByToken(scannedToken);

      setState('success');
      playSuccess();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // After 2s navigate to the space
      setTimeout(() => {
        EventBus.emit('sharedSpaceChanged');
        navigation.replace('SpaceDetail', { spaceId: res.spaceId });
      }, 2000);
    } catch (err: any) {
      const msg = err?.message ?? 'No se pudo unir al espacio.';
      setErrorMsg(msg);
      setState('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [scannedToken, playSuccess, navigation]);

  // ── Reset to scanning ───────────────────────────────────────────────────
  const resetToScan = useCallback(() => {
    hideCard();
    setTimeout(() => {
      setState('scanning');
      setInvitation(null);
      setErrorMsg('');
      setScannedToken('');
      isProcessing.current = false;
      successScale.setValue(0);
      successRotate.setValue(0);
    }, 300);
  }, [hideCard, successScale, successRotate]);

  // ── Permission handling ─────────────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.button} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.permWrap}>
          <View style={[styles.permIcon, { backgroundColor: withAlpha(colors.button, 0.1) }]}>
            <Ionicons name="camera-outline" size={48} color={colors.button} />
          </View>
          <Text style={[styles.permTitle, { color: colors.text }]}>Acceso a la cámara</Text>
          <Text style={[styles.permText, { color: colors.textSecondary }]}>
            Necesitamos acceso a tu cámara para escanear códigos QR de invitación a espacios compartidos.
          </Text>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [styles.permBtn, { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 }]}
          >
            <Ionicons name="camera" size={20} color="#FFF" />
            <Text style={styles.permBtnText}>Permitir cámara</Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            <Text style={[styles.permLink, { color: colors.textSecondary }]}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Interpolations ──────────────────────────────────────────────────────
  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_SIZE - 4],
  });

  const successRotateStr = successRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spaceTypeIcons: Record<string, string> = {
    pareja: 'heart-outline',
    grupo: 'people-outline',
    viaje: 'airplane-outline',
    familia: 'home-outline',
    custom: 'build-outline',
  };

  const spaceTypeLabels: Record<string, string> = {
    pareja: 'Pareja',
    grupo: 'Grupo',
    viaje: 'Viaje',
    familia: 'Familia',
    custom: 'Personalizado',
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={state === 'scanning' ? handleBarcodeScan : undefined}
      />

      {/* Dark overlay with cutout */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Top */}
        <View style={[styles.overlayBlock, { height: (SCREEN_H - SCAN_SIZE) / 2 - 30 }]} />
        {/* Middle row */}
        <View style={{ flexDirection: 'row', height: SCAN_SIZE }}>
          <View style={[styles.overlayBlock, { width: (SCREEN_W - SCAN_SIZE) / 2 }]} />
          {/* Scan window (transparent) */}
          <View style={{ width: SCAN_SIZE, height: SCAN_SIZE }}>
            {/* Corner brackets */}
            <Animated.View style={[styles.cornersWrap, { transform: [{ scale: cornerPulse }] }]}>
              <Corner position="top-left" color={colors.button} />
              <Corner position="top-right" color={colors.button} />
              <Corner position="bottom-left" color={colors.button} />
              <Corner position="bottom-right" color={colors.button} />
            </Animated.View>

            {/* Scan line */}
            {state === 'scanning' && (
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    backgroundColor: colors.button,
                    transform: [{ translateY: scanLineY }],
                  },
                ]}
              />
            )}
          </View>
          <View style={[styles.overlayBlock, { width: (SCREEN_W - SCAN_SIZE) / 2 }]} />
        </View>
        {/* Bottom */}
        <View style={[styles.overlayBlock, { flex: 1 }]} />
      </View>

      {/* Top header */}
      <SafeAreaView style={styles.topHeader} edges={['top']}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.topBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>

          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>Escanear QR</Text>
            <Text style={styles.topSub}>Invitación a espacio compartido</Text>
          </View>

          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      {/* Bottom instructions (while scanning) */}
      {state === 'scanning' && (
        <SafeAreaView style={styles.bottomInstructions} edges={['bottom']}>
          <View style={styles.instructionPill}>
            <Ionicons name="qr-code-outline" size={18} color="#FFF" />
            <Text style={styles.instructionText}>Apunta al código QR de invitación</Text>
          </View>
        </SafeAreaView>
      )}

      {/* Verifying spinner */}
      {state === 'verifying' && (
        <View style={styles.centerOverlay}>
          <View style={[styles.spinnerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.button} />
            <Text style={[styles.spinnerText, { color: colors.text }]}>Verificando invitación...</Text>
          </View>
        </View>
      )}

      {/* Preview / Error / Success card overlay */}
      {(state === 'preview' || state === 'joining' || state === 'error' || state === 'success') && (
        <Animated.View style={[styles.cardOverlay, { opacity: overlayFade }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={state === 'error' ? resetToScan : undefined} />

          <Animated.View
            style={[
              styles.cardWrap,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                transform: [{ translateY: cardSlide }, { scale: cardScale }],
              },
            ]}
          >
            {/* ── Success state ───────────────────────────────────────── */}
            {state === 'success' && (
              <View style={styles.successWrap}>
                <Animated.View
                  style={[
                    styles.successCircle,
                    {
                      backgroundColor: colors.success,
                      transform: [{ scale: successScale }, { rotate: successRotateStr }],
                    },
                  ]}
                >
                  <Ionicons name="checkmark" size={40} color="#FFF" />
                </Animated.View>
                <Text style={[styles.successTitle, { color: colors.text }]}>¡Te uniste al espacio!</Text>
                <Text style={[styles.successSub, { color: colors.textSecondary }]}>
                  {invitation?.space?.nombre ?? 'Espacio compartido'}
                </Text>
                <Text style={[styles.successHint, { color: colors.textSecondary }]}>Redirigiendo...</Text>
              </View>
            )}

            {/* ── Preview state ───────────────────────────────────────── */}
            {(state === 'preview' || state === 'joining') && invitation && (
              <View>
                {/* Space header */}
                <View style={styles.previewHeader}>
                  <View
                    style={[
                      styles.previewIconWrap,
                      { backgroundColor: withAlpha(colors.button, 0.12), borderColor: withAlpha(colors.button, 0.2) },
                    ]}
                  >
                    <Ionicons
                      name={(spaceTypeIcons[invitation.space.tipo] ?? 'people-outline') as any}
                      size={28}
                      color={colors.button}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={2}>
                      {invitation.space.nombre}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <View
                        style={[
                          styles.previewPill,
                          { backgroundColor: withAlpha(colors.button, 0.1), borderColor: withAlpha(colors.button, 0.18) },
                        ]}
                      >
                        <Text style={[styles.previewPillText, { color: colors.button }]}>
                          {spaceTypeLabels[invitation.space.tipo] ?? invitation.space.tipo}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.previewPill,
                          { backgroundColor: withAlpha(colors.border, 0.12), borderColor: withAlpha(colors.border, 0.2) },
                        ]}
                      >
                        <Text style={[styles.previewPillText, { color: colors.textSecondary }]}>
                          {invitation.space.monedaBase}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Invitation details */}
                <View style={[styles.detailsWrap, { borderColor: colors.border }]}>
                  {invitation.invitedBy && (
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Invitado por</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{invitation.invitedBy}</Text>
                    </View>
                  )}
                  {invitation.message && (
                    <View style={styles.detailRow}>
                      <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Mensaje</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
                        "{invitation.message}"
                      </Text>
                    </View>
                  )}
                  {invitation.multiUse && (
                    <View style={styles.detailRow}>
                      <Ionicons name="infinite-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Usos restantes</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {invitation.remainingUses === null || invitation.remainingUses === undefined
                          ? 'Sin límite'
                          : `${invitation.remainingUses} restante${invitation.remainingUses !== 1 ? 's' : ''}`}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Ionicons name="shield-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Rol</Text>
                    <View
                      style={[
                        styles.rolBadge,
                        {
                          backgroundColor: withAlpha(
                            invitation.rol === 'admin' ? colors.warning : colors.button,
                            0.12
                          ),
                          borderColor: withAlpha(
                            invitation.rol === 'admin' ? colors.warning : colors.button,
                            0.2
                          ),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rolBadgeText,
                          { color: invitation.rol === 'admin' ? colors.warning : colors.button },
                        ]}
                      >
                        {invitation.rol === 'admin' ? 'Admin' : 'Miembro'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={resetToScan}
                    disabled={state === 'joining'}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                        opacity: state === 'joining' ? 0.5 : pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                    <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleAccept}
                    disabled={state === 'joining'}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.actionBtnPrimary,
                      {
                        backgroundColor: colors.button,
                        borderColor: colors.button,
                        opacity: state === 'joining' ? 0.8 : pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    {state === 'joining' ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="people" size={18} color="#FFF" />
                        <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Unirme</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Error state ─────────────────────────────────────────── */}
            {state === 'error' && (
              <View style={styles.errorWrap}>
                <View style={[styles.errorCircle, { backgroundColor: withAlpha(colors.error, 0.12) }]}>
                  <Ionicons name="alert-circle" size={36} color={colors.error} />
                </View>
                <Text style={[styles.errorTitle, { color: colors.text }]}>No se pudo verificar</Text>
                <Text style={[styles.errorMsg, { color: colors.textSecondary }]}>{errorMsg}</Text>
                <Pressable
                  onPress={resetToScan}
                  style={({ pressed }) => [
                    styles.errorBtn,
                    { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 },
                  ]}
                >
                  <Ionicons name="scan-outline" size={18} color="#FFF" />
                  <Text style={styles.errorBtnText}>Escanear de nuevo</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

// ── Corner brackets ───────────────────────────────────────────────────────

function Corner({ position, color }: { position: string; color: string }) {
  const size = 28;
  const thickness = 4;
  const radius = 14;

  const borderStyles: any = {};
  switch (position) {
    case 'top-left':
      borderStyles.top = 0;
      borderStyles.left = 0;
      borderStyles.borderTopWidth = thickness;
      borderStyles.borderLeftWidth = thickness;
      borderStyles.borderTopLeftRadius = radius;
      break;
    case 'top-right':
      borderStyles.top = 0;
      borderStyles.right = 0;
      borderStyles.borderTopWidth = thickness;
      borderStyles.borderRightWidth = thickness;
      borderStyles.borderTopRightRadius = radius;
      break;
    case 'bottom-left':
      borderStyles.bottom = 0;
      borderStyles.left = 0;
      borderStyles.borderBottomWidth = thickness;
      borderStyles.borderLeftWidth = thickness;
      borderStyles.borderBottomLeftRadius = radius;
      break;
    case 'bottom-right':
      borderStyles.bottom = 0;
      borderStyles.right = 0;
      borderStyles.borderBottomWidth = thickness;
      borderStyles.borderRightWidth = thickness;
      borderStyles.borderBottomRightRadius = radius;
      break;
  }

  return (
    <View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderColor: color,
        },
        borderStyles,
      ]}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Overlay
  overlayBlock: { backgroundColor: 'rgba(0,0,0,0.55)' },

  // Scan window
  cornersWrap: { ...StyleSheet.absoluteFillObject },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 2,
    opacity: 0.7,
  },

  // Top header
  topHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 28) + 8 : 8,
    paddingBottom: 12,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
  topSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700', marginTop: 2 },

  // Bottom instructions
  bottomInstructions: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 24 },
  instructionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  instructionText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  // Center overlay (verifying)
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  spinnerCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 32,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  spinnerText: { fontSize: 15, fontWeight: '900' },

  // Card overlay
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 26,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },

  // Preview
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
  previewIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  previewPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewPillText: { fontSize: 11, fontWeight: '900' },

  detailsWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 14,
    marginBottom: 18,
    gap: 12,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel: { fontSize: 13, fontWeight: '800', width: 85 },
  detailValue: { fontSize: 13, fontWeight: '900', flex: 1 },
  rolBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rolBadgeText: { fontSize: 12, fontWeight: '900' },

  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionBtnPrimary: { flex: 1.4 },
  actionBtnText: { fontSize: 15, fontWeight: '900' },

  // Success
  successWrap: { alignItems: 'center', paddingVertical: 12, gap: 12 },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: { fontSize: 20, fontWeight: '900' },
  successSub: { fontSize: 15, fontWeight: '800' },
  successHint: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  // Error
  errorWrap: { alignItems: 'center', paddingVertical: 8, gap: 12 },
  errorCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: { fontSize: 18, fontWeight: '900' },
  errorMsg: { fontSize: 14, fontWeight: '800', textAlign: 'center', lineHeight: 20 },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 16,
    marginTop: 4,
  },
  errorBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },

  // Permission
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  permIcon: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  permText: { fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 },
  permBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 18,
    marginTop: 8,
  },
  permBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  permLink: { fontSize: 14, fontWeight: '800' },
});
