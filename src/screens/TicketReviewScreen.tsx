import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import apiRateLimiter from '../services/apiRateLimiter';
import { API_BASE_URL } from '../constants/api';
import { createIdempotencyKey } from '../utils/idempotency';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useThemeColors } from '../theme/useThemeColors';
import { writeBase64ToCacheFile } from '../utils/base64File';
import {
  ticketScanService,
  CATEGORY_CONFIG,
  type Ticket,
  type TicketItem,
  type TicketCategoria,
} from '../services/ticketScanService';
import { emitTransaccionesChanged } from '../utils/dashboardRefreshBus';
import type { RootStackParamList } from '../navigation/AppNavigator';

type ReviewRoute = RouteProp<RootStackParamList, 'TicketReview'>;

// ─── Category Picker Modal ─────────────────────────────────
function CategoryChip({
  categoria,
  confianza,
  onPress,
  colors,
}: {
  categoria: TicketCategoria;
  confianza?: number;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const cat = CATEGORY_CONFIG[categoria] ?? CATEGORY_CONFIG.otros;
  const lowConf = typeof confianza === 'number' && confianza < 0.5;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.catChip, { backgroundColor: cat.color + '18', borderColor: cat.color + '40' }]}
    >
      <Text style={styles.catIcon}>{cat.icon}</Text>
      <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
      {lowConf && (
        <Ionicons name="alert-circle" size={13} color="#F59E0B" style={{ marginLeft: 2 }} />
      )}
    </TouchableOpacity>
  );
}

// ─── Item Row ───────────────────────────────────────────────
function ItemRow({
  item,
  index,
  onEdit,
  onDelete,
  onCategoryChange,
  colors,
}: {
  item: TicketItem;
  index: number;
  onEdit: (index: number, field: keyof TicketItem, value: any) => void;
  onDelete: (index: number) => void;
  onCategoryChange: (index: number) => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const cat = CATEGORY_CONFIG[item.categoria ?? 'otros'] ?? CATEGORY_CONFIG.otros;

  // Confidence-based border: < 0.5 → red, < 0.7 → yellow, else default
  const confBorder =
    typeof item.confianza === 'number'
      ? item.confianza < 0.5
        ? '#EF4444'
        : item.confianza < 0.7
        ? '#F59E0B'
        : colors.border
      : colors.border;

  return (
    <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.itemHeader}>
        <View style={[styles.itemNumber, { backgroundColor: cat.color + '18' }]}>
          <Text style={[styles.itemNumberText, { color: cat.color }]}>{index + 1}</Text>
        </View>
        <TextInput
          style={[styles.itemName, { color: colors.text, borderBottomWidth: confBorder !== colors.border ? 1.5 : 0, borderBottomColor: confBorder }]}
          value={item.nombre}
          onChangeText={(v) => onEdit(index, 'nombre', v)}
          placeholder="Nombre del artículo"
          placeholderTextColor={colors.placeholder}
        />
        <TouchableOpacity onPress={() => onDelete(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.itemFields}>
        <View style={styles.itemField}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Cantidad</Text>
          <TextInput
            style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
            value={String(item.cantidad)}
            keyboardType="numeric"
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              if (!isNaN(n) && n > 0) {
                onEdit(index, 'cantidad', n);
                onEdit(index, 'subtotal', n * item.precioUnitario);
              }
            }}
          />
        </View>
        <View style={styles.itemField}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Precio unit.</Text>
          <TextInput
            style={[styles.fieldInput, { color: colors.text, borderColor: confBorder, backgroundColor: colors.inputBackground }]}
            value={String(item.precioUnitario)}
            keyboardType="decimal-pad"
            onChangeText={(v) => {
              const n = parseFloat(v);
              if (!isNaN(n)) {
                onEdit(index, 'precioUnitario', n);
                onEdit(index, 'subtotal', item.cantidad * n);
              }
            }}
          />
        </View>
        <View style={styles.itemField}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Subtotal</Text>
          <Text style={[styles.subtotalValue, { color: colors.text }]}>
            ${item.subtotal.toFixed(2)}
          </Text>
        </View>
      </View>

      <CategoryChip
        categoria={item.categoria ?? 'otros'}
        confianza={item.confianza}
        onPress={() => onCategoryChange(index)}
        colors={colors}
      />
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────
export default function TicketReviewScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<ReviewRoute>();
  const raw = route.params?.ticket;

  // Defensive: ensure originalTicket is always a safe object
  const originalTicket: Ticket = useMemo(() => {
    if (!raw) {
      console.warn('[TicketReview] ticket param is missing/undefined');
      return {
        ticketId: '', tienda: '', fechaCompra: new Date().toISOString(),
        items: [], subtotal: 0, impuestos: 0, descuentos: 0, propina: 0,
        total: 0, moneda: 'MXN', estado: 'review' as const, confirmado: false,
        hasImage: false, resumenCategorias: {}, createdAt: new Date().toISOString(),
      };
    }
    return {
      ...raw,
      ticketId: raw.ticketId ?? (raw as any)._id ?? '',
      items: Array.isArray(raw.items) ? raw.items : [],
      tienda: raw.tienda ?? '',
      subtotal: raw.subtotal ?? 0,
      impuestos: raw.impuestos ?? 0,
      descuentos: raw.descuentos ?? 0,
      propina: raw.propina ?? 0,
      total: raw.total ?? 0,
      moneda: raw.moneda ?? 'MXN',
      estado: raw.estado ?? 'review',
      confirmado: raw.confirmado ?? false,
      hasImage: raw.hasImage ?? false,
      resumenCategorias: raw.resumenCategorias ?? {},
      createdAt: raw.createdAt ?? new Date().toISOString(),
      fechaCompra: raw.fechaCompra ?? raw.createdAt ?? new Date().toISOString(),
    };
  }, [raw]);

  const [tienda, setTienda] = useState(originalTicket.tienda ?? '');
  const [items, setItems] = useState<TicketItem[]>(originalTicket.items ?? []);
  const [notas, setNotas] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [catPickerIndex, setCatPickerIndex] = useState<number | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [imageFileUri, setImageFileUri] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showLiquidar, setShowLiquidar] = useState(false);
  const [liqLoading, setLiqLoading] = useState(false);
  const [liqSubmitting, setLiqSubmitting] = useState(false);
  const [liquidOptions, setLiquidOptions] = useState<Array<{ type: 'cuenta'|'subcuenta'; id: string; label: string; subtitle?: string }>>([]);
  const [selectedLiquidOption, setSelectedLiquidOption] = useState<string | null>(null);
  const [liquidAmount, setLiquidAmount] = useState<string>('');
  const [liquidConcept, setLiquidConcept] = useState<string>('');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKey = `ticketDraft:${originalTicket.ticketId}`;

  const clearDraft = useCallback(async () => {
    try {
      if (!originalTicket.ticketId) return;
      await AsyncStorage.removeItem(draftKey);
    } catch {}
  }, [draftKey, originalTicket.ticketId]);

  const loadDraft = useCallback(async () => {
    try {
      if (!originalTicket.ticketId) return;
      const raw = await AsyncStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.tienda) setTienda(parsed.tienda);
      if (Array.isArray(parsed?.items)) setItems(parsed.items);
      if (typeof parsed?.notas === 'string') setNotas(parsed.notas);
      Toast.show({ type: 'info', text1: 'Borrador cargado', visibilityTime: 1500 });
    } catch (err) {
      // ignore
    }
  }, [draftKey, originalTicket.ticketId]);

  const saveDraft = useCallback(async () => {
    try {
      if (!originalTicket.ticketId) return;
      const payload = { tienda, items, notas };
      await AsyncStorage.setItem(draftKey, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  }, [draftKey, originalTicket.ticketId, tienda, items, notas]);

  const reviewLevel = originalTicket.reviewLevel ?? 'full';
  const fieldConfidence = originalTicket.fieldConfidence;
  const ocrScore = originalTicket.ocrScore;

  // Note: 'auto' reviewLevel no longer silently confirms — user always reviews first.

  // True when the ticket came from a scan but extraction yielded nothing
  const extractionFailed = originalTicket.estado === 'review' && items.length === 0 && originalTicket.total === 0;

  const computedTotal = useMemo(
    () => items.reduce((sum, it) => sum + (it.subtotal || 0), 0),
    [items],
  );

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((it) => {
      const key = it.categoria ?? 'otros';
      map[key] = (map[key] || 0) + (it.subtotal || 0);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, total]) => ({ cat: cat as TicketCategoria, total }));
  }, [items]);

  const editItem = useCallback((index: number, field: keyof TicketItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }, []);

  const deleteItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { nombre: '', cantidad: 1, precioUnitario: 0, subtotal: 0, categoria: 'otros', confianza: 1 },
    ]);
  }, []);

  const openCategoryPicker = (index: number) => setCatPickerIndex(index);

  const selectCategory = (cat: TicketCategoria) => {
    if (catPickerIndex !== null) {
      editItem(catPickerIndex, 'categoria', cat);
      editItem(catPickerIndex, 'confianza', 1);
      setCatPickerIndex(null);
    }
  };

  const handleConfirm = async () => {
    if (items.length === 0) {
      Toast.show({ type: 'info', text1: 'Agrega al menos un artículo' });
      return;
    }
    setConfirming(true);
    try {
      const edits: any = {};
      if (tienda !== originalTicket.tienda) edits.tienda = tienda;
      if (computedTotal !== originalTicket.total) edits.total = computedTotal;
      edits.items = items;
      if (notas) edits.notas = notas;

      const res = await ticketScanService.confirm(originalTicket.ticketId, edits);
      emitTransaccionesChanged();
      await clearDraft();
      Toast.show({
        type: 'success',
        text1: 'Cargo aplicado',
        text2: `Se descontaron $${res.ticket.total.toFixed(2)} de tu cuenta`,
        visibilityTime: 4000,
      });
      // @ts-ignore
      navigation.navigate('Dashboard');
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al confirmar',
        text2: err?.message || 'Intenta de nuevo',
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar ticket',
      '¿Estás seguro de que quieres cancelar este ticket? Los datos no se guardarán.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await ticketScanService.cancel(originalTicket.ticketId);
                  Toast.show({ type: 'info', text1: 'Ticket cancelado' });
                  await clearDraft();
                  navigation.goBack();
            } catch {
              Toast.show({ type: 'error', text1: 'Error al cancelar' });
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const loadLiquidOptions = useCallback(async () => {
    setLiqLoading(true);
    try {
      // try to get userId from storage
      let userId = await AsyncStorage.getItem('userId');
      // fetch principal and subcuentas similar to TransferModal
      const [cuentaRes, subcuentasRes] = await Promise.all([
        apiRateLimiter.fetch(`${API_BASE_URL}/cuenta/principal`, { method: 'GET', headers: { 'Cache-Control': 'no-store', 'X-Skip-Cache': '1' } }),
        apiRateLimiter.fetch(`${API_BASE_URL}/subcuenta/${encodeURIComponent(userId ?? '')}?soloActivas=true&page=1&limit=200`, { method: 'GET', headers: { 'Cache-Control': 'no-store', 'X-Skip-Cache': '1' } }),
      ]);
      const [cuentaBody, subcuentasBody] = await Promise.all([cuentaRes.json().catch(()=>({})), subcuentasRes.json().catch(()=>([]))]);
      const cuentaRaw: any = cuentaBody?.data ?? cuentaBody?.cuenta ?? cuentaBody ?? {};
      const principalId = String(cuentaRaw?.cuentaId ?? cuentaRaw?.id ?? cuentaRaw?._id ?? '').trim();
      const opts: any[] = [];
      if (principalId) opts.push({ type: 'cuenta', id: principalId, label: String(cuentaRaw?.nombre ?? 'Cuenta principal'), subtitle: cuentaRaw?.moneda ? String(cuentaRaw.moneda) : undefined });
      const subArr: any[] = Array.isArray(subcuentasBody?.data) ? subcuentasBody.data : Array.isArray(subcuentasBody) ? subcuentasBody : [];
      subArr.forEach((s: any) => {
        const id = String(s.subCuentaId ?? s.id ?? s._id ?? '').trim();
        if (id) opts.push({ type: 'subcuenta', id, label: String(s.nombre ?? 'Subcuenta'), subtitle: s.moneda });
      });
      setLiquidOptions(opts);
      if (opts.length > 0) setSelectedLiquidOption(opts[0].id);
      setLiquidAmount(String(originalTicket.total ?? computedTotal ?? 0));
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error cargando cuentas', text2: err?.message || 'No se pudieron obtener las cuentas.' });
    } finally {
      setLiqLoading(false);
    }
  }, [originalTicket.total, computedTotal]);

  useEffect(() => {
    if (showLiquidar) void loadLiquidOptions();
  }, [showLiquidar, loadLiquidOptions]);

  const loadImage = useCallback(async () => {
    if (!originalTicket.ticketId) return;
    if (imageBase64) {
      setShowImage((s) => !s);
      return;
    }
    setLoadingImage(true);
    try {
      const res = await ticketScanService.getImage(originalTicket.ticketId);
      // Set base64 and mime
      setImageBase64(res.imagenBase64);
      setImageMime(res.mimeType || 'image/jpeg');
      setShowImage(true);

      // Try writing to a temp file to check whether the base64 is valid as a file
      try {
        const ext = (res.mimeType || 'image/jpeg').includes('png') ? 'png' : 'jpg';
        const filename = `ticket_${originalTicket.ticketId}_${Date.now()}.${ext}`;
        const uri = await writeBase64ToCacheFile({ base64: res.imagenBase64, filename });
        console.log('[TicketReview] wrote image temp file', uri);
        setImageFileUri(uri);
      } catch (err: any) {
        console.warn('[TicketReview] could not write image temp file', err?.message || err);
        setImageFileUri(null);
      }
    } catch (err: any) {
      Toast.show({ type: 'info', text1: 'Imagen no disponible' });
    } finally {
      setLoadingImage(false);
    }
  }, [originalTicket.ticketId, imageBase64]);

  const saveImageToGallery = async () => {
    if (!imageBase64) return Toast.show({ type: 'info', text1: 'No hay imagen para guardar' });
    try {
      const ext = imageMime && imageMime.includes('png') ? 'png' : 'jpg';
      const filename = `ticket_${originalTicket.ticketId}_${Date.now()}.${ext}`;
      const cacheDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? '';
      const fileUri = cacheDir + filename;
      await FileSystem.writeAsStringAsync(fileUri, imageBase64, { encoding: 'base64' as any });
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'info', text1: 'Permiso denegado para guardar imagen' });
        return;
      }
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      try { await MediaLibrary.createAlbumAsync('LitFinance', asset, false); } catch {}
      Toast.show({ type: 'success', text1: 'Imagen guardada en la galería' });
    } catch (err: any) {
      console.error('[TicketReview] save image error', err);
      Toast.show({ type: 'error', text1: 'No se pudo guardar la imagen' });
    }
  };

  // Load draft on mount
  useEffect(() => {
    void loadDraft();
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current as any);
        saveTimerRef.current = null;
      }
    };
  }, [loadDraft]);

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!originalTicket.ticketId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveDraft();
      saveTimerRef.current = null;
    }, 700);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tienda, items, notas, saveDraft, originalTicket.ticketId]);

  const handleLiquidar = async () => {
    if (!selectedLiquidOption) return Toast.show({ type: 'info', text1: 'Selecciona una cuenta' });
    const montoNum = Number(String(liquidAmount).replace(/,/g, '.'));
    if (!Number.isFinite(montoNum) || montoNum <= 0) return Toast.show({ type: 'info', text1: 'Monto inválido' });
    setLiqSubmitting(true);
    try {
      const opt = liquidOptions.find((o) => o.id === selectedLiquidOption);
      const payload: any = { monto: montoNum, concepto: liquidConcept || undefined };
      if (opt?.type === 'cuenta') payload.cuentaId = opt.id;
      if (opt?.type === 'subcuenta') payload.subCuentaId = opt.id;
      const idempotencyKey = createIdempotencyKey('liq');
      const res = await ticketScanService.liquidar(originalTicket.ticketId, payload, idempotencyKey);
      Toast.show({ type: 'success', text1: res.message || 'Liquidado', text2: `Transacción ${res.transaccion?.transaccionId ?? ''}` });
      emitTransaccionesChanged();
      // clear draft then navigate to detail to show receipt
      await clearDraft();
      // @ts-ignore
      navigation.replace('TicketDetail', { ticketId: res.ticket.ticketId });
      setShowLiquidar(false);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error al liquidar', text2: err?.message || 'Intenta de nuevo' });
    } finally {
      setLiqSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Revisar ticket</Text>
          <View style={[styles.badge, { backgroundColor: '#EF772518' }]}>
            <Text style={styles.badgeText}>{originalTicket.estado}</Text>
          </View>
          {typeof ocrScore === 'number' && (
            <View style={[styles.badge, { backgroundColor: ocrScore >= 0.85 ? '#10B98118' : ocrScore >= 0.6 ? '#F59E0B18' : '#EF444418' }]}>
              <Text style={[styles.badgeText, { color: ocrScore >= 0.85 ? '#10B981' : ocrScore >= 0.6 ? '#F59E0B' : '#EF4444' }]}>
                LIT-OCR {Math.round(ocrScore * 100)}%
              </Text>
            </View>
          )}
        </View>
        {originalTicket.ticketId ? (
          <TouchableOpacity
            style={[styles.headerRightBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={loadImage}
            activeOpacity={0.7}
          >
            {loadingImage ? (
              <ActivityIndicator size="small" color="#EF7725" />
            ) : (
              <Ionicons name={showImage ? 'eye-off-outline' : 'image-outline'} size={20} color="#EF7725" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Extraction-failed banner */}
        {extractionFailed && (
          <View style={[styles.extractionBanner, { backgroundColor: '#F59E0B12', borderColor: '#F59E0B40' }]}>
            <View style={styles.extractionBannerRow}>
              <Ionicons name="alert-circle" size={20} color="#F59E0B" />
              <Text style={[styles.extractionBannerTitle, { color: '#F59E0B' }]}>No se pudo extraer información</Text>
            </View>
            <Text style={[styles.extractionBannerBody, { color: '#F59E0B' }]}>
              El análisis de imagen no detectó artículos ni precios. Puede ser por baja calidad o iluminación.{' '}
              <Text style={styles.extractionBannerBold}>Agrega los artículos manualmente</Text> con el botón de abajo.
            </Text>
            <TouchableOpacity
              style={styles.extractionRetakeBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="camera-outline" size={14} color="#fff" />
              <Text style={styles.extractionRetakeBtnText}>Reintentar con otra imagen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Auto mode: very high confidence — informational banner, user still confirms */}
        {reviewLevel === 'auto' && !extractionFailed && (
          <View style={[styles.extractionBanner, { backgroundColor: '#10B98112', borderColor: '#10B98140' }]}>
            <View style={styles.extractionBannerRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={[styles.extractionBannerTitle, { color: '#10B981' }]}>Datos extraídos</Text>
            </View>
            <Text style={[styles.extractionBannerBody, { color: '#10B981' }]}>
              Se recomienda revisar los datos extraidos del ticket escaneado, ya que LIT-OCR puede contener errores u omitir datos.
            </Text>
          </View>
        )}

        {/* Light-mode: alta confianza, sólo confirmar */}
        {reviewLevel === 'light' && !extractionFailed && (
          <View style={[styles.extractionBanner, { backgroundColor: '#10B98112', borderColor: '#10B98140' }]}>
            <View style={styles.extractionBannerRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={[styles.extractionBannerTitle, { color: '#10B981' }]}>Revisa rápido</Text>
            </View>
            <Text style={[styles.extractionBannerBody, { color: '#10B981' }]}>
              LIT-OCR detectó los datos con buena precisión. Confirma o edita si algo no cuadra.
            </Text>
          </View>
        )}

        {/* Manual mode: datos incompletos */}
        {reviewLevel === 'manual' && (
          <View style={[styles.extractionBanner, { backgroundColor: '#EF444412', borderColor: '#EF444440' }]}>
            <View style={styles.extractionBannerRow}>
              <Ionicons name="create-outline" size={20} color="#EF4444" />
              <Text style={[styles.extractionBannerTitle, { color: '#EF4444' }]}>Completa los datos manualmente</Text>
            </View>
            <Text style={[styles.extractionBannerBody, { color: '#EF4444' }]}>
              El escaneo no pudo extraer los datos con suficiente confianza. Por favor ingresa la información del ticket.
            </Text>
          </View>
        )}

        {/* Store info */}
        <View style={[styles.storeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.storeIconWrap, { backgroundColor: '#EF772518' }]}>
            <Ionicons name="storefront-outline" size={24} color="#EF7725" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.storeLabel, { color: colors.textSecondary }]}>Tienda</Text>
            <TextInput
              style={[styles.storeInput, { color: colors.text,
                borderBottomWidth: fieldConfidence?.tienda !== undefined && fieldConfidence.tienda < 0.7 ? 1.5 : 0,
                borderBottomColor: fieldConfidence?.tienda !== undefined
                  ? fieldConfidence.tienda < 0.5 ? '#EF4444' : '#F59E0B'
                  : undefined,
              }]}
              value={tienda}
              onChangeText={setTienda}
              placeholder="Nombre de la tienda"
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.storeMetaRow}>
              <View style={styles.storeMeta}>
                <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.storeMetaText, { color: colors.textSecondary }]}>
                  {(() => { try { return new Date(originalTicket.fechaCompra).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; } })()}
                </Text>
              </View>
              {!!originalTicket.metodoPago && (
                <View style={styles.storeMeta}>
                  <Ionicons
                    name={
                      /tarjeta|credito|debito/i.test(originalTicket.metodoPago)
                        ? 'card-outline'
                        : /efectivo/i.test(originalTicket.metodoPago)
                        ? 'cash-outline'
                        : 'wallet-outline'
                    }
                    size={12}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.storeMetaText, { color: colors.textSecondary }]}>
                    {originalTicket.metodoPago}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Image preview button + image container */}
        {originalTicket.ticketId && (
          <>
            <TouchableOpacity
              style={[styles.imageBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={loadImage}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showImage ? 'eye-off-outline' : 'image-outline'}
                size={18}
                color="#EF7725"
              />
              <Text style={[styles.imageBtnText, { color: '#EF7725' }]}>
                {loadingImage ? 'Cargando...' : showImage ? 'Ocultar imagen' : 'Ver imagen del ticket'}
              </Text>
              {loadingImage && <ActivityIndicator size="small" color="#EF7725" />}
            </TouchableOpacity>

              {showImage && imageBase64 && (
                <View style={[styles.imageContainer, { borderColor: colors.border }]}> 
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setShowFullscreen(true)}>
                    <Image
                      source={ imageFileUri ? { uri: imageFileUri } : { uri: `data:${imageMime};base64,${imageBase64}` } }
                      style={styles.ticketImage}
                      resizeMode="contain"
                    />
                    <TouchableOpacity onPress={saveImageToGallery} style={styles.downloadOverlay} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="download-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              )}

              <Modal isVisible={showFullscreen} onBackdropPress={() => setShowFullscreen(false)} onBackButtonPress={() => setShowFullscreen(false)} style={{ margin: 0 }}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                  <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 20 }} onPress={() => setShowFullscreen(false)}>
                    <Ionicons name="close" size={30} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} activeOpacity={1} onPress={() => setShowFullscreen(false)}>
                    <Image source={ imageFileUri ? { uri: imageFileUri } : { uri: `data:${imageMime};base64,${imageBase64}` } } style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
                  </TouchableOpacity>
                </View>
              </Modal>
          </>
        )}

        {/* Category summary */}
        {categorySummary.length > 0 && (
          <View style={styles.catSummary}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumen por categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {categorySummary.map(({ cat, total }) => {
                const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.otros;
                return (
                  <View key={cat} style={[styles.catPill, { backgroundColor: cfg.color + '14', borderColor: cfg.color + '30' }]}>
                    <Text style={styles.catPillIcon}>{cfg.icon}</Text>
                    <View>
                      <Text style={[styles.catPillLabel, { color: cfg.color }]}>{cfg.label}</Text>
                      <Text style={[styles.catPillAmount, { color: colors.text }]}>${total.toFixed(2)}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Items */}
        <View style={styles.itemsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Artículos ({items.length})
          </Text>
          <TouchableOpacity onPress={addItem} style={[styles.addBtn, { backgroundColor: '#EF772514' }]}>
            <Ionicons name="add" size={16} color="#EF7725" />
            <Text style={styles.addBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {items.map((item, i) => (
          <ItemRow
            key={i}
            item={item}
            index={i}
            onEdit={editItem}
            onDelete={deleteItem}
            onCategoryChange={openCategoryPicker}
            colors={colors}
          />
        ))}

        {items.length === 0 && (
          <View style={[styles.emptyItems, { backgroundColor: colors.cardSecondary }]}>
            <Ionicons name="receipt-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyItemsText, { color: colors.textSecondary }]}>
              No hay artículos.
            </Text>
            <TouchableOpacity
              onPress={addItem}
              style={[styles.emptyAddBtn, { backgroundColor: '#EF772514', borderColor: '#EF772530' }]}
            >
              <Ionicons name="add-circle-outline" size={16} color="#EF7725" />
              <Text style={{ color: '#EF7725', fontWeight: '600', fontSize: 14 }}>Agregar artículo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notes */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Notas (opcional)</Text>
        <TextInput
          style={[styles.notesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
          value={notas}
          onChangeText={setNotas}
          placeholder="Agrega notas sobre esta compra..."
          placeholderTextColor={colors.placeholder}
          multiline
          numberOfLines={3}
        />

        {/* Totals */}
        <View style={[styles.totalsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Subtotal (pre-tax) if backend extracted it */}
          {originalTicket.subtotal > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Subtotal</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>${originalTicket.subtotal.toFixed(2)}</Text>
            </View>
          )}
          {/* IVA/IEPS — purely informational, already baked into item prices */}
          {originalTicket.impuestos > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>IVA / IEPS (incluido)</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>${originalTicket.impuestos.toFixed(2)}</Text>
            </View>
          )}
          {originalTicket.descuentos > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Descuentos</Text>
              <Text style={[styles.totalValue, { color: '#10B981' }]}>-${originalTicket.descuentos.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={[styles.grandTotalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: '#EF7725' }]}>
              ${(computedTotal - (originalTicket.descuentos || 0)).toFixed(2)}
            </Text>
          </View>
          <Text style={[styles.currencyNote, { color: colors.textSecondary }]}>
            Moneda: {originalTicket.moneda || 'MXN'}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.cancelActionBtn, { borderColor: colors.error + '40' }]}
          onPress={handleCancel}
          disabled={confirming || cancelling}
        >
          {cancelling ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Ionicons name="close-outline" size={20} color={colors.error} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmBtn, { opacity: (confirming || liqSubmitting) ? 0.7 : 1, flex: 1, marginLeft: 8 }]}
          onPress={() => setShowLiquidar(true)}
          disabled={confirming || cancelling || liqLoading}
          activeOpacity={0.8}
        >
          {liqSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.confirmBtnText}>Confirmar y cobrar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Liquidation modal */}
      <Modal isVisible={showLiquidar} onBackdropPress={() => setShowLiquidar(false)} swipeDirection="down" onSwipeComplete={() => setShowLiquidar(false)} style={{ justifyContent: 'flex-end', margin: 0 }}>
        <View style={[{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.card }]}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Liquidar ticket</Text>
            <TouchableOpacity onPress={() => setShowLiquidar(false)}><Ionicons name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
          </View>

          {liqLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={colors.button} />
              <Text style={{ color: colors.textSecondary }}>Cargando cuentas…</Text>
            </View>
          ) : (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Cuenta destino</Text>
              {liquidOptions.map((o) => (
                <TouchableOpacity key={o.id} onPress={() => setSelectedLiquidOption(o.id)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, marginBottom: 8 }, selectedLiquidOption === o.id ? { borderColor: colors.button, backgroundColor: colors.cardSecondary } : { borderColor: colors.border, backgroundColor: colors.inputBackground }] }>
                  <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}>{o.type === 'cuenta' ? <Ionicons name="wallet-outline" size={16} color={colors.textSecondary} /> : <Ionicons name="layers-outline" size={16} color={colors.textSecondary} />}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{o.label}</Text>
                    {o.subtitle ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{o.subtitle}</Text> : null}
                  </View>
                  {selectedLiquidOption === o.id ? <Ionicons name="checkmark-circle" size={18} color={colors.button} /> : null}
                </TouchableOpacity>
              ))}

              <View style={{ marginTop: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Monto</Text>
                <TextInput keyboardType="decimal-pad" value={liquidAmount} onChangeText={setLiquidAmount} style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBackground, paddingHorizontal: 12, color: colors.text, marginTop: 8 }} />
              </View>

              <View style={{ marginTop: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Concepto (opcional)</Text>
                <TextInput value={liquidConcept} onChangeText={setLiquidConcept} style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBackground, paddingHorizontal: 12, color: colors.text, marginTop: 8 }} />
              </View>

              <TouchableOpacity onPress={handleLiquidar} disabled={liqSubmitting} style={[{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14, backgroundColor: colors.button }, liqSubmitting && { opacity: 0.6 }]}>
                {liqSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Liquidar</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* Category Picker Overlay */}
      {catPickerIndex !== null && (
        <TouchableOpacity
          style={styles.catOverlay}
          activeOpacity={1}
          onPress={() => setCatPickerIndex(null)}
        >
          <View style={[styles.catPickerSheet, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.catPickerTitle, { color: colors.text }]}>Seleccionar categoría</Text>
            <View style={styles.catPickerGrid}>
              {(Object.keys(CATEGORY_CONFIG) as TicketCategoria[]).map((key) => {
                const cfg = CATEGORY_CONFIG[key];
                const selected = items[catPickerIndex!]?.categoria === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.catPickerItem,
                      { backgroundColor: cfg.color + '12', borderColor: selected ? cfg.color : 'transparent', borderWidth: selected ? 2 : 0 },
                    ]}
                    onPress={() => selectCategory(key)}
                  >
                    <Text style={{ fontSize: 22 }}>{cfg.icon}</Text>
                    <Text style={[styles.catPickerItemLabel, { color: cfg.color }]} numberOfLines={1}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      )}
      </>
  </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#EF7725' },

  scrollContent: { padding: 16 },

  // Store
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  storeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLabel: { fontSize: 11, marginBottom: 2 },
  storeInput: { fontSize: 16, fontWeight: '600', padding: 0 },
  storeMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 5 },
  storeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeMetaText: { fontSize: 11 },

  // Category summary
  catSummary: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  catScroll: { flexDirection: 'row' },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    gap: 8,
  },
  catPillIcon: { fontSize: 18 },
  catPillLabel: { fontSize: 11, fontWeight: '600' },
  catPillAmount: { fontSize: 13, fontWeight: '700' },

  // Items
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#EF7725' },

  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  itemNumber: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNumberText: { fontSize: 12, fontWeight: '700' },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    padding: 0,
  },

  itemFields: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  itemField: { flex: 1 },
  fieldLabel: { fontSize: 11, marginBottom: 4 },
  fieldInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  subtotalValue: {
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 6,
  },

  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  catIcon: { fontSize: 14 },
  catLabel: { fontSize: 12, fontWeight: '600' },

  emptyItems: {
    alignItems: 'center',
    paddingVertical: 28,
    borderRadius: 14,
    gap: 8,
  },
  emptyItemsText: { fontSize: 14 },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },

  // Extraction failed banner
  extractionBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  extractionBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  extractionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  extractionBannerBody: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
  extractionBannerBold: {
    fontWeight: '700',
  },
  extractionRetakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 2,
  },
  extractionRetakeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  imageBtnText: { fontSize: 14, fontWeight: '500' },
  imageContainer: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    alignItems: 'center',
  },
  ticketImage: {
    width: '100%',
    height: 420,
  },
  downloadOverlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Notes
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 16,
  },

  // Totals
  totalsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14, fontWeight: '500' },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E020',
    paddingTop: 10,
    marginTop: 6,
    marginBottom: 0,
  },
  grandTotalLabel: { fontSize: 16, fontWeight: '700' },
  grandTotalValue: { fontSize: 20, fontWeight: '800' },
  currencyNote: { fontSize: 11, marginTop: 6, textAlign: 'right' },

  // Bottom
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cancelActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  liquidateText: { marginLeft: 8, fontSize: 15, fontWeight: '700' },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EF7725',
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Category picker
  catOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  catPickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  catPickerTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  catPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  catPickerItem: {
    width: 78,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 4,
  },
  catPickerItemLabel: { fontSize: 10, fontWeight: '600' },
});
