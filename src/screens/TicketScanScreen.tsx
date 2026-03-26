import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
  Animated,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useThemeColors } from '../theme/useThemeColors';
import { useTheme } from '../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ticketScanService } from '../services/ticketScanService';
import {
  checkImageQuality,
  qualityLabel,
  type QualityCheck,
} from '../utils/imageQuality';
import {
  buildScanMetadata,
  type ScanSource,
  type ScanImageCapture,
} from '../utils/scanMetadata';
import {
  runLocalTicketOcr,
  isLocalOcrAvailable,
  type LocalOcrResult,
} from '../services/localTicketOcr';
import { isAnyOcrConfigured, ocrAndParse, type ParsedTicketOcr } from '../services/visionOcrService';
import type { RootStackParamList } from '../navigation/AppNavigator';

// Try to import document scanner — may not be available if native build is missing
let DocumentScanner: any = null;
try {
  DocumentScanner = require('react-native-document-scanner-plugin').default;
} catch {
  // Plugin not linked / native build required
}

const { width: SCREEN_W } = Dimensions.get('window');

type TicketScanRoute = RouteProp<RootStackParamList, 'TicketScan'>;

// ─── Multi-shot section type ────────────────────────────────
type ShotSection = 'global' | 'header' | 'body' | 'footer';

interface CapturedImage {
  uri: string;
  base64: string;
  mime: string;
  width: number;
  height: number;
  section: ShotSection;
}

// ─── Pipeline steps ─────────────────────────────────────────
type PipelineStep = 'idle' | 'capturing' | 'validating' | 'preview' | 'ready' | 'sending';

export default function TicketScanScreen() {
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<TicketScanRoute>();
  const source = route.params?.source ?? 'camera';

  // ── State ─────────────────────────────────────────────────
  const [captures, setCaptures] = useState<CapturedImage[]>([]);
  const [quality, setQuality] = useState<QualityCheck | null>(null);
  const [ocrPreview, setOcrPreview] = useState<ParsedTicketOcr | null>(null);
  const [localOcrResult, setLocalOcrResult] = useState<LocalOcrResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [usedFlash, setUsedFlash] = useState(false);
  const [showOcrPreview, setShowOcrPreview] = useState(false);
  const [step, setStep] = useState<PipelineStep>('idle');
  const [scanProgress, setScanProgress] = useState('');
  const [scanSource, setScanSource] = useState<ScanSource>(
    source === 'gallery' ? 'gallery' : 'camera',
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mainCapture = captures[0] ?? null;
  const additionalCaptures = captures.slice(1);

  // ── Image compression ─────────────────────────────────────
  const compressImage = async (
    uri: string,
  ): Promise<{ base64: string; uri: string; width: number; height: number }> => {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 1800 } }],
      { compress: 0.82, format: SaveFormat.JPEG, base64: true },
    );
    const b64 = result.base64 ?? '';
    return {
      base64: b64.startsWith('data:') ? b64.split(',')[1] : b64,
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  };

  // ── Process captured image: compress + quality check ──────
  const processCapture = async (
    uri: string,
    section: ShotSection = 'global',
  ): Promise<CapturedImage | null> => {
    try {
      setStep('validating');
      const compressed = await compressImage(uri);

      const img: CapturedImage = {
        uri: compressed.uri,
        base64: compressed.base64,
        mime: 'image/jpeg',
        width: compressed.width,
        height: compressed.height,
        section,
      };

      // Run quality check on main (global) capture
      if (section === 'global') {
        const q = await checkImageQuality(compressed.uri, compressed.base64.length);
        setQuality(q);

        if (!q.passed) {
          Toast.show({
            type: 'info',
            text1: 'Calidad de imagen baja',
            text2: q.suggestions[0] ?? 'Intenta capturar de nuevo',
            visibilityTime: 4000,
          });
        }
      }

      return img;
    } catch (err) {
      console.error('[TicketScan] processCapture error:', err);
      return null;
    }
  };

  // ── 1. Document Scanner (native) ──────────────────────────
  const openDocumentScanner = useCallback(async () => {
    if (!DocumentScanner) {
      // Fallback to regular camera if plugin not available
      openCamera();
      return;
    }

    try {
      setStep('capturing');
      const result = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 1,
        letUserAdjustCrop: true,
      });

      if (
        result.status === 'cancel' ||
        !result.scannedImages ||
        result.scannedImages.length === 0
      ) {
        setStep('idle');
        return;
      }

      setScanSource('document_scanner');
      const img = await processCapture(result.scannedImages[0], 'global');
      if (img) {
        setCaptures([img]);
        setStep('ready');
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        setStep('idle');
      }
    } catch (err: any) {
      console.error('[TicketScan] Document scanner error:', err);
      // Fallback to camera on scanner failure
      Toast.show({
        type: 'info',
        text1: 'Escáner no disponible',
        text2: 'Usando cámara estándar',
      });
      openCamera();
    }
  }, []);

  // ── 2. Camera (expo-image-picker fallback) ────────────────
  const openCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a la cámara para escanear tickets.',
        [{ text: 'OK' }],
      );
      return;
    }

    setStep('capturing');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      base64: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      setStep(captures.length > 0 ? 'ready' : 'idle');
      return;
    }

    setScanSource('camera');
    const img = await processCapture(result.assets[0].uri, 'global');
    if (img) {
      setCaptures([img]);
      setStep('ready');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      setStep('idle');
    }
  }, [captures.length]);

  // ── 3. Gallery ────────────────────────────────────────────
  const openGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a la galería para seleccionar una imagen.',
        [{ text: 'OK' }],
      );
      return;
    }

    setStep('capturing');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      base64: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      setStep(captures.length > 0 ? 'ready' : 'idle');
      return;
    }

    setScanSource('gallery');
    const img = await processCapture(result.assets[0].uri, 'global');
    if (img) {
      setCaptures([img]);
      setStep('ready');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      setStep('idle');
    }
  }, [captures.length]);

  // ── 4. Multi-shot: capture detail section ─────────────────
  const captureDetailSection = useCallback(
    async (section: 'header' | 'body' | 'footer') => {
      const sectionLabels = {
        header: 'encabezado',
        body: 'artículos',
        footer: 'totales',
      };

      Toast.show({
        type: 'info',
        text1: `Captura: ${sectionLabels[section]}`,
        text2: 'Enfoca esa sección del ticket',
        visibilityTime: 2000,
      });

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        base64: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const img = await processCapture(result.assets[0].uri, section);
      if (img) {
        setCaptures((prev) => {
          // Remove existing capture of same section, add new one
          const filtered = prev.filter((c) => c.section !== section);
          return [...filtered, img];
        });
        setStep('ready');
      }
    },
    [],
  );

  // ── 5. Local OCR preview ──────────────────────────────────
  const runOcrPreview = useCallback(async () => {
    if (!mainCapture) return;
    const canDoLocalOcr = isLocalOcrAvailable();
    const canDoCloudOcr = isAnyOcrConfigured();
    if (!canDoLocalOcr && !canDoCloudOcr) return;

    setOcrLoading(true);
    try {
      // — Step A: ML Kit on-device (primary) ─────────────────
      if (canDoLocalOcr) {
        const result = await runLocalTicketOcr(mainCapture.uri, mainCapture.base64);
        setLocalOcrResult(result);

        if (!result.rawText.trim()) {
          Toast.show({
            type: 'info',
            text1: 'Sin texto detectado',
            text2: 'Acércate un poco y asegúrate de que el ticket esté bien iluminado.',
            visibilityTime: 4000,
          });
        }
      }

      // — Step B: cloud OCR for structured preview (fallback/parallel) ──
      if (canDoCloudOcr) {
        const parsed = await ocrAndParse(mainCapture.base64);
        setOcrPreview(parsed);
        setShowOcrPreview(true);
      } else if (localOcrResult?.rawText) {
        // If no cloud OCR, synthesize a minimal preview from ML Kit rawText
        setShowOcrPreview(true);
      }
    } catch (err: any) {
      console.warn('[TicketScan] OCR preview failed:', err?.message);
      Toast.show({
        type: 'info',
        text1: 'Preview no disponible',
        text2: 'Se procesará con IA en el servidor',
      });
    } finally {
      setOcrLoading(false);
    }
  }, [mainCapture, localOcrResult?.rawText]);

  // ── 6. Send to backend (enriched payload) ─────────────────
  const handleScan = async () => {
    if (!mainCapture) return;
    setStep('sending');
    setScanProgress('Enviando ticket...');

    try {
      const cuentaId = await AsyncStorage.getItem('cuentaId');

      // Build captures array for metadata
      const capturesMeta: ScanImageCapture[] = captures.map((c) => ({
        base64: c.base64,
        mimeType: c.mime,
        width: c.width,
        height: c.height,
        section: c.section,
      }));

      // Build rich metadata
      const metadata = buildScanMetadata({
        source: scanSource,
        quality: quality ?? {
          passed: true,
          score: 0.7,
          issues: [],
          suggestions: [],
          isLongTicket: false,
          width: mainCapture.width,
          height: mainCapture.height,
          fileSizeKB: Math.round(mainCapture.base64.length / 1024),
        },
        captures: capturesMeta,
        ocrPreview: ocrPreview?.rawText,
        edgesDetected: scanSource === 'document_scanner',
      });

      // Build additional captures payload (only detail shots)
      const capturasAdicionales = additionalCaptures.map((c) => ({
        base64: c.base64,
        mimeType: c.mime,
        section: c.section as 'header' | 'body' | 'footer',
        ancho: c.width,
        alto: c.height,
      }));

      // Determine approximate image rotation from dimensions
      const rotation: number | undefined =
        mainCapture.width > mainCapture.height ? 90 : undefined;

      setScanProgress('Procesando con IA...');
      console.log(
        '[TicketScan] Enviando — fuente:',
        scanSource,
        '| capturas:',
        captures.length,
        '| calidad:',
        quality?.score,
        '| KB:',
        Math.round(mainCapture.base64.length / 1024),
        '| ML Kit:',
        isLocalOcrAvailable(),
      );

      const res = await ticketScanService.scan({
        imagenBase64: mainCapture.base64,
        imagenMimeType: mainCapture.mime,
        ocrTexto: localOcrResult?.rawText ?? ocrPreview?.rawText,
        cuentaId: cuentaId ?? undefined,
        autoConfirm: false,
        metadata,
        capturasAdicionales: capturasAdicionales.length > 0 ? capturasAdicionales : undefined,
        localOcr: localOcrResult
          ? { rawText: localOcrResult.rawText, score: localOcrResult.score, blocks: localOcrResult.blocks }
          : undefined,
        captureMeta: {
          usedFlash,
          source: scanSource === 'gallery' ? 'gallery' : scanSource === 'document_scanner' ? 'document_scanner' : 'camera',
          rotation,
        },
      });

      console.log(
        '[TicketScan] Respuesta — tienda:',
        res.ticket.tienda,
        '| items:',
        res.ticket.items?.length,
        '| total:',
        res.ticket.total,
      );

      setScanProgress('');
      Toast.show({
        type: 'success',
        text1: '¡Ticket procesado!',
        text2: res.message,
      });
      // @ts-ignore
      navigation.replace('TicketReview', { ticket: res.ticket });
    } catch (err: any) {
      console.error('[TicketScan] Error:', err?.message);
      setScanProgress('');
      Toast.show({
        type: 'error',
        text1: 'Error al procesar',
        text2: err?.message || 'Intenta de nuevo o ingresa manualmente',
        visibilityTime: 5000,
      });
    } finally {
      setStep('ready');
    }
  };

  // ── Retake ────────────────────────────────────────────────
  const retake = () => {
    setCaptures([]);
    setQuality(null);
    setOcrPreview(null);
    setLocalOcrResult(null);
    setShowOcrPreview(false);
    setScanProgress('');
    setStep('idle');
    fadeAnim.setValue(0);
    setTimeout(() => {
      if (source === 'gallery') openGallery();
      else if (DocumentScanner) openDocumentScanner();
      else openCamera();
    }, 200);
  };

  // ── Auto-open on mount ────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (source === 'gallery') openGallery();
      else if (DocumentScanner) openDocumentScanner();
      else openCamera();
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  // ── Quality badge component ───────────────────────────────
  const QualityBadge = () => {
    if (!quality) return null;
    const { text, color } = qualityLabel(quality.score);
    return (
      <View style={[styles.qualityBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
        <Ionicons
          name={quality.score >= 0.65 ? 'checkmark-circle' : 'alert-circle'}
          size={14}
          color={color}
        />
        <Text style={[styles.qualityText, { color }]}>
          Calidad: {text} ({Math.round(quality.score * 100)}%)
        </Text>
        <Text style={[styles.qualityDims, { color: color + 'AA' }]}>
          {quality.width}×{quality.height} · {quality.fileSizeKB} KB
        </Text>
      </View>
    );
  };

  // ── Multi-shot section buttons ────────────────────────────
  const MultiShotControls = () => {
    if (!quality?.isLongTicket) return null;

    const sections: { key: 'header' | 'body' | 'footer'; icon: string; label: string }[] = [
      { key: 'header', icon: 'document-text-outline', label: 'Encabezado' },
      { key: 'body', icon: 'list-outline', label: 'Artículos' },
      { key: 'footer', icon: 'calculator-outline', label: 'Totales' },
    ];

    return (
      <View style={styles.multiShotWrap}>
        <View style={styles.multiShotHeader}>
          <Ionicons name="layers-outline" size={16} color="#F59E0B" />
          <Text style={[styles.multiShotTitle, { color: colors.text }]}>
            Ticket largo detectado
          </Text>
        </View>
        <Text style={[styles.multiShotSub, { color: colors.textSecondary }]}>
          Toma fotos de detalle para mejor precisión
        </Text>
        <View style={styles.multiShotRow}>
          {sections.map((s) => {
            const hasCap = captures.some((c) => c.section === s.key);
            return (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.multiShotBtn,
                  {
                    backgroundColor: hasCap ? '#10B98118' : colors.cardSecondary,
                    borderColor: hasCap ? '#10B981' : colors.border,
                  },
                ]}
                onPress={() => captureDetailSection(s.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={hasCap ? 'checkmark-circle' : (s.icon as any)}
                  size={18}
                  color={hasCap ? '#10B981' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.multiShotLabel,
                    { color: hasCap ? '#10B981' : colors.textSecondary },
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ── OCR Preview panel ─────────────────────────────────────
  const OcrPreviewPanel = () => {
    if (!showOcrPreview || (!ocrPreview && !localOcrResult)) return null;

    const source = isLocalOcrAvailable() ? 'ML Kit' : 'Nube';

    return (
      <View style={[styles.ocrPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.ocrPanelHeader}>
          <Ionicons name="eye-outline" size={16} color="#3B82F6" />
          <Text style={[styles.ocrPanelTitle, { color: colors.text }]}>Preview local</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <View style={{ backgroundColor: '#3B82F618', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
              <Text style={{ fontSize: 10, color: '#3B82F6', fontWeight: '600' }}>{source}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowOcrPreview(false)}>
              <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {ocrPreview?.tienda ? (
          <Text style={[styles.ocrField, { color: colors.text }]}>
            <Text style={styles.ocrLabel}>Tienda: </Text>
            {ocrPreview.tienda}
          </Text>
        ) : null}

        {ocrPreview && ocrPreview.total > 0 ? (
          <Text style={[styles.ocrField, { color: colors.text }]}>
            <Text style={styles.ocrLabel}>Total: </Text>
            ${ocrPreview.total.toFixed(2)} {ocrPreview.moneda}
          </Text>
        ) : null}

        {ocrPreview && ocrPreview.items.length > 0 ? (
          <Text style={[styles.ocrField, { color: colors.text }]}>
            <Text style={styles.ocrLabel}>Artículos: </Text>
            {ocrPreview.items.length} detectados
          </Text>
        ) : localOcrResult && localOcrResult.blocks.length > 0 ? (
          <Text style={[styles.ocrField, { color: colors.text }]}>
            <Text style={styles.ocrLabel}>Bloques: </Text>
            {localOcrResult.blocks.length} · confianza {Math.round(localOcrResult.score * 100)}%
          </Text>
        ) : null}

        <Text style={[styles.ocrHint, { color: colors.textTertiary }]}>
          Extracción local · La versión final será procesada con IA
        </Text>
      </View>
    );
  };

  // ── Capture source info ─────────────────────────────────
  const sourceLabel =
    scanSource === 'document_scanner'
      ? 'Escáner de documentos'
      : scanSource === 'gallery'
        ? 'Galería'
        : 'Cámara';

  const isSending = step === 'sending';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Escanear ticket</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      {mainCapture ? (
        <ScrollView
          style={styles.scrollWrap}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Image preview */}
            <View
              style={[
                styles.imageFrame,
                { borderColor: colors.border, backgroundColor: colors.cardSecondary },
              ]}
            >
              <Image
                source={{ uri: mainCapture.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <View style={styles.imageOverlay}>
                <View style={[styles.cornerTL, { borderColor: '#EF7725' }]} />
                <View style={[styles.cornerTR, { borderColor: '#EF7725' }]} />
                <View style={[styles.cornerBL, { borderColor: '#EF7725' }]} />
                <View style={[styles.cornerBR, { borderColor: '#EF7725' }]} />
              </View>
              {/* Source badge */}
              <View style={styles.sourceBadge}>
                <Ionicons
                  name={
                    scanSource === 'document_scanner'
                      ? 'scan-outline'
                      : scanSource === 'gallery'
                        ? 'images-outline'
                        : 'camera-outline'
                  }
                  size={11}
                  color="#fff"
                />
                <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
              </View>
            </View>

            {/* Quality badge */}
            <QualityBadge />

            {/* Quality issues */}
            {quality && quality.suggestions.length > 0 && quality.score < 0.65 && (
              <View
                style={[
                  styles.issuesCard,
                  { backgroundColor: '#F59E0B12', borderColor: '#F59E0B40' },
                ]}
              >
                {quality.suggestions.map((s, i) => (
                  <View key={String(i)} style={styles.issueRow}>
                    <Ionicons name="alert-circle-outline" size={14} color="#F59E0B" />
                    <Text style={[styles.issueText, { color: colors.textSecondary }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Multi-shot controls (long ticket) */}
            <MultiShotControls />

            {/* Additional captures thumbnails */}
            {additionalCaptures.length > 0 && (
              <View style={styles.thumbRow}>
                {additionalCaptures.map((cap, i) => (
                  <View
                    key={String(i)}
                    style={[
                      styles.thumbWrap,
                      { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                    ]}
                  >
                    <Image source={{ uri: cap.uri }} style={styles.thumbImg} resizeMode="cover" />
                    <Text style={[styles.thumbLabel, { color: colors.textSecondary }]}>
                      {cap.section === 'header'
                        ? 'Encab.'
                        : cap.section === 'body'
                          ? 'Cuerpo'
                          : 'Totales'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* OCR Preview panel */}
            <OcrPreviewPanel />

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
                onPress={retake}
                disabled={isSending}
              >
                <Ionicons name="refresh-outline" size={18} color={colors.text} />
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
                  Volver a tomar
                </Text>
              </TouchableOpacity>

              {/* OCR Preview button */}
              {(isLocalOcrAvailable() || isAnyOcrConfigured()) && !showOcrPreview && (
                <TouchableOpacity
                  style={[
                    styles.previewBtn,
                    { borderColor: '#3B82F640', backgroundColor: '#3B82F612' },
                  ]}
                  onPress={runOcrPreview}
                  disabled={isSending || ocrLoading}
                  activeOpacity={0.7}
                >
                  {ocrLoading ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <Ionicons name="eye-outline" size={18} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Primary action */}
            <TouchableOpacity
              style={[styles.primaryBtn, { opacity: isSending ? 0.7 : 1 }]}
              onPress={handleScan}
              disabled={isSending}
              activeOpacity={0.8}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="scan-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Procesar ticket</Text>
                </>
              )}
            </TouchableOpacity>

            {isSending && (
              <View style={styles.progressRow}>
                <ActivityIndicator size="small" color="#EF7725" />
                <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                  {scanProgress || 'Analizando tu ticket...'}
                </Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          {step === 'capturing' || step === 'validating' ? (
            <>
              <ActivityIndicator size="large" color="#EF7725" />
              <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 20 }]}>
                {step === 'validating' ? 'Validando imagen...' : 'Abriendo escáner...'}
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.emptyIcon, { backgroundColor: colors.cardSecondary }]}>
                <Ionicons
                  name={
                    source === 'gallery'
                      ? 'images-outline'
                      : DocumentScanner
                        ? 'scan-outline'
                        : 'camera-outline'
                  }
                  size={48}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {source === 'gallery' ? 'Selecciona una imagen' : 'Escanea tu ticket'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                {source === 'gallery'
                  ? 'Elige una foto de tu recibo desde la galería'
                  : DocumentScanner
                    ? 'El escáner detectará bordes y recortará automáticamente'
                    : 'Apunta la cámara hacia tu recibo de compra'}
              </Text>

              <TouchableOpacity
                style={styles.retryBtn}
                onPress={
                  source === 'gallery'
                    ? openGallery
                    : DocumentScanner
                      ? openDocumentScanner
                      : openCamera
                }
                activeOpacity={0.8}
              >
                <Ionicons
                  name={
                    source === 'gallery'
                      ? 'images-outline'
                      : DocumentScanner
                        ? 'scan-outline'
                        : 'camera-outline'
                  }
                  size={20}
                  color="#fff"
                />
                <Text style={styles.retryBtnText}>
                  {source === 'gallery'
                    ? 'Abrir galería'
                    : DocumentScanner
                      ? 'Abrir escáner'
                      : 'Abrir cámara'}
                </Text>
              </TouchableOpacity>

              {/* Alternate source buttons */}
              {source !== 'gallery' && (
                <View style={styles.altRow}>
                  {DocumentScanner && (
                    <TouchableOpacity
                      style={[styles.altBtn, { borderColor: colors.border }]}
                      onPress={openCamera}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="camera-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.altBtnText, { color: colors.textSecondary }]}>
                        Cámara
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.altBtn, { borderColor: colors.border }]}
                    onPress={openGallery}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="images-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.altBtnText, { color: colors.textSecondary }]}>
                      Galería
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const CORNER = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },

  // ── Scrollable preview ────────────────────────────────────
  scrollWrap: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // ── Image frame ───────────────────────────────────────────
  imageFrame: {
    height: SCREEN_W * 1.1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    margin: 12,
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER,
    height: CORNER,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER,
    height: CORNER,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER,
    height: CORNER,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderBottomRightRadius: 8,
  },
  sourceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourceBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },

  // ── Quality badge ─────────────────────────────────────────
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  qualityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  qualityDims: {
    fontSize: 11,
    marginLeft: 'auto',
  },

  // ── Issues card ───────────────────────────────────────────
  issuesCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  issueText: {
    fontSize: 12,
    flex: 1,
  },

  // ── Multi-shot ────────────────────────────────────────────
  multiShotWrap: {
    marginBottom: 12,
  },
  multiShotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  multiShotTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  multiShotSub: {
    fontSize: 12,
    marginBottom: 10,
  },
  multiShotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  multiShotBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  multiShotLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Thumbnails ────────────────────────────────────────────
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
  },
  thumbImg: {
    width: '100%',
    height: 54,
  },
  thumbLabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
  },

  // ── OCR Preview ───────────────────────────────────────────
  ocrPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  ocrPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  ocrPanelTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  ocrField: {
    fontSize: 13,
    marginBottom: 3,
  },
  ocrLabel: {
    fontWeight: '600',
  },
  ocrHint: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },

  // ── Actions ───────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#EF7725',
    marginBottom: 10,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 13,
  },

  // ── Empty state ───────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: '#EF7725',
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // ── Alternate source buttons ──────────────────────────────
  altRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  altBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  altBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
