import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { useThemeColors } from '../theme/useThemeColors';
import {
  ticketScanService,
  CATEGORY_CONFIG,
  type Ticket,
  type TicketCategoria,
  type TicketEstado,
} from '../services/ticketScanService';
import type { RootStackParamList } from '../navigation/AppNavigator';

const { width: SCREEN_W } = Dimensions.get('window');

type DetailRoute = RouteProp<RootStackParamList, 'TicketScanDetail'>;

const ESTADO_CONFIG: Record<TicketEstado, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  processing: { label: 'Procesando', color: '#F59E0B', icon: 'hourglass-outline' },
  review:     { label: 'En revisión', color: '#3B82F6', icon: 'eye-outline' },
  completed:  { label: 'Completado', color: '#10B981', icon: 'checkmark-circle-outline' },
  failed:     { label: 'Fallido', color: '#EF4444', icon: 'alert-circle-outline' },
  cancelled:  { label: 'Cancelado', color: '#9E9E9E', icon: 'close-circle-outline' },
};

function formatFullDate(iso: string | any) {
  // Handle MongoDB Extended JSON date: { $date: '...' }
  if (iso && typeof iso === 'object' && iso.$date) iso = iso.$date;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

export default function TicketScanDetailScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<DetailRoute>();
  const { ticketId } = route.params;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const data = await ticketScanService.getDetail(ticketId);
      setTicket(data);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error al cargar ticket', text2: err?.message });
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const loadImage = async () => {
    if (imageBase64) {
      setShowImage(!showImage);
      return;
    }
    setLoadingImage(true);
    try {
      const res = await ticketScanService.getImage(ticketId);
      setImageBase64(res.imagenBase64);
      setImageMime(res.mimeType);
      setShowImage(true);
    } catch {
      Toast.show({ type: 'info', text1: 'Imagen no disponible' });
    } finally {
      setLoadingImage(false);
    }
  };

  const saveImageToGallery = async () => {
    if (!imageBase64) return Toast.show({ type: 'info', text1: 'No hay imagen para guardar' });
    try {
      const ext = imageMime && imageMime.includes('png') ? 'png' : 'jpg';
      const filename = `ticket_${ticketId}_${Date.now()}.${ext}`;
      const cacheDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? '';
      const fileUri = cacheDir + filename;
      await FileSystem.writeAsStringAsync(fileUri, imageBase64, { encoding: 'base64' as any });
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'info', text1: 'Permiso denegado para guardar imagen' });
        return;
      }
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      try { await MediaLibrary.createAlbumAsync('LitFinance', asset, false); } catch { /* ignore if exists */ }
      Toast.show({ type: 'success', text1: 'Imagen guardada en la galería' });
    } catch (err: any) {
      console.error('[TicketDetail] save image error', err);
      Toast.show({ type: 'error', text1: 'No se pudo guardar la imagen' });
    }
  };

  const handleCancel = () => {
    if (!ticket) return;
    Alert.alert(
      'Cancelar ticket',
      ticket.confirmado
        ? 'Este ticket ya fue confirmado. Cancelarlo NO revertirá la transacción automáticamente.'
        : '¿Seguro que deseas cancelar este ticket?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await ticketScanService.cancel(ticketId);
              Toast.show({ type: 'info', text1: 'Ticket cancelado' });
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#EF7725" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>No se pudo cargar el ticket</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const estado = ESTADO_CONFIG[ticket.estado] ?? ESTADO_CONFIG.completed;
  const categorySummary = Object.entries(ticket.resumenCategorias || {}).sort(([, a], [, b]) => b - a);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>Detalle del ticket</Text>

        {ticketId ? (
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Store header card */}
        <View style={[styles.storeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.storeIconBig, { backgroundColor: '#EF772514' }]}>
            <Ionicons name="storefront-outline" size={28} color="#EF7725" />
          </View>
          <Text style={[styles.storeName, { color: colors.text }]}>{ticket.tienda || 'Sin tienda'}</Text>
          {ticket.direccionTienda ? (
            <Text style={[styles.storeAddress, { color: colors.textSecondary }]}>{ticket.direccionTienda}</Text>
          ) : null}
          <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
            {formatFullDate(ticket.fechaCompra || ticket.createdAt)}
          </Text>

          <View style={styles.headerRow}>
            <View style={[styles.estadoBadge, { backgroundColor: estado.color + '18' }]}>
              <Ionicons name={estado.icon} size={14} color={estado.color} />
              <Text style={[styles.estadoText, { color: estado.color }]}>{estado.label}</Text>
            </View>
            {ticket.transaccionId && (
              <View style={[styles.txBadge, { backgroundColor: '#10B98118' }]}>
                <Ionicons name="link-outline" size={12} color="#10B981" />
                <Text style={[styles.txBadgeText, { color: '#10B981' }]}>Transacción vinculada</Text>
              </View>
            )}
          </View>
        </View>

        {/* Total */}
        <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
          <Text style={[styles.totalValue, { color: '#EF7725' }]}>
            ${ticket.total.toFixed(2)} <Text style={styles.currency}>{ticket.moneda}</Text>
          </Text>
          {ticket.metodoPago ? (
            <Text style={[styles.payMethod, { color: colors.textSecondary }]}>
              Método: {ticket.metodoPago}
            </Text>
          ) : null}
        </View>

        {/* Image */}
        {ticketId && (
          <TouchableOpacity
            style={[styles.imageBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={loadImage}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showImage ? 'eye-off-outline' : 'image-outline'}
              size={20}
              color="#EF7725"
            />
            <Text style={[styles.imageBtnText, { color: '#EF7725' }]}>
              {loadingImage ? 'Cargando...' : showImage ? 'Ocultar imagen' : 'Ver imagen del ticket'}
            </Text>
            {loadingImage && <ActivityIndicator size="small" color="#EF7725" />}
          </TouchableOpacity>
        )}

        {showImage && imageBase64 && (
          <View style={[styles.imageContainer, { borderColor: colors.border }]}> 
            <TouchableOpacity activeOpacity={0.9} onPress={() => setShowFullscreen(true)}>
              <Image
                source={{ uri: `data:${imageMime};base64,${imageBase64}` }}
                style={styles.ticketImage}
                resizeMode="contain"
              />
              <TouchableOpacity onPress={saveImageToGallery} style={styles.downloadOverlay} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="download-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}

        {/* Fullscreen modal */}
        <Modal visible={showFullscreen} transparent onRequestClose={() => setShowFullscreen(false)}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 20 }} onPress={() => setShowFullscreen(false)}>
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} activeOpacity={1} onPress={() => setShowFullscreen(false)}>
              <Image source={{ uri: `data:${imageMime};base64,${imageBase64}` }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Category summary */}
        {categorySummary.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Por categoría</Text>
            <View style={styles.catGrid}>
              {categorySummary.map(([cat, amount]) => {
                const cfg = CATEGORY_CONFIG[cat as TicketCategoria] ?? CATEGORY_CONFIG.otros;
                return (
                  <View key={cat} style={[styles.catCard, { backgroundColor: cfg.color + '10', borderColor: cfg.color + '25' }]}>
                    <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                    <Text style={[styles.catCardLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    <Text style={[styles.catCardAmount, { color: colors.text }]}>${(amount as number).toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Items list */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Artículos ({ticket.items?.length ?? 0})
        </Text>
        {(ticket.items || []).map((item, i) => {
          const cat = CATEGORY_CONFIG[item.categoria ?? 'otros'] ?? CATEGORY_CONFIG.otros;
          return (
            <View key={i} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.itemIcon, { backgroundColor: cat.color + '14' }]}>
                <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.nombre}</Text>
                <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                  {item.cantidad}x ${item.precioUnitario.toFixed(2)}
                </Text>
              </View>
              <Text style={[styles.itemSubtotal, { color: colors.text }]}>${item.subtotal.toFixed(2)}</Text>
            </View>
          );
        })}

        {/* Totals breakdown */}
        <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Subtotal</Text>
            <Text style={[styles.breakdownValue, { color: colors.text }]}>${ticket.subtotal.toFixed(2)}</Text>
          </View>
          {ticket.impuestos > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Impuestos</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>${ticket.impuestos.toFixed(2)}</Text>
            </View>
          )}
          {ticket.descuentos > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Descuentos</Text>
              <Text style={[styles.breakdownValue, { color: '#10B981' }]}>-${ticket.descuentos.toFixed(2)}</Text>
            </View>
          )}
          {ticket.propina > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Propina</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>${ticket.propina.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {ticket.notas ? (
          <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.notesTitle, { color: colors.text }]}>Notas</Text>
            <Text style={[styles.notesContent, { color: colors.textSecondary }]}>{ticket.notas}</Text>
          </View>
        ) : null}

        {/* Actions */}
        {ticket.estado !== 'cancelled' && (
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.error + '40' }]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                <Text style={[styles.cancelButtonText, { color: colors.error }]}>Cancelar ticket</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 15, marginTop: 12 },
  goBackBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: '#EF7725' },
  goBackText: { color: '#fff', fontWeight: '600' },

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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  headerRightBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { padding: 16 },

  // Store card
  storeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  storeIconBig: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  storeName: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  storeAddress: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  dateLabel: { fontSize: 13, marginTop: 6 },
  headerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  estadoText: { fontSize: 12, fontWeight: '600' },
  txBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  txBadgeText: { fontSize: 11, fontWeight: '600' },

  // Total
  totalCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  currency: { fontSize: 16, fontWeight: '500' },
  payMethod: { fontSize: 12, marginTop: 6 },

  // Image
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
  },
  ticketImage: {
    width: SCREEN_W - 64,
    height: (SCREEN_W - 64) * 1.4,
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

  // Categories
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 16 },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catCard: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  catCardLabel: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  catCardAmount: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontSize: 14, fontWeight: '500' },
  itemMeta: { fontSize: 12, marginTop: 1 },
  itemSubtotal: { fontSize: 14, fontWeight: '700' },

  // Breakdown
  breakdownCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  breakdownLabel: { fontSize: 14 },
  breakdownValue: { fontSize: 14, fontWeight: '500' },

  // Notes
  notesCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
  },
  notesTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  notesContent: { fontSize: 14, lineHeight: 20 },

  // Cancel
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 20,
  },
  cancelButtonText: { fontSize: 14, fontWeight: '600' },
});
