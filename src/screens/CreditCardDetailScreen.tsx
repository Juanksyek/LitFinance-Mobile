import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { useThemeColors } from '../theme/useThemeColors';
import { creditCardService } from '../services/creditCardService';
import type {
  CreditCard,
  CreditCardMovimiento,
  CreditCardSaludResponse,
  MovimientoTipo,
  RegisterMovimientoDto,
  SaludLabel,
} from '../types/creditCards';
import type { RootStackParamList } from '../navigation/AppNavigator';
import SmartNumber from '../components/SmartNumber';

// ─── helpers ────────────────────────────────────────────────────────────────

const withAlpha = (hex: string, alpha: number) => {
  const c = (hex || '#000').replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  if (full.length !== 6) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const saludColor = (label: SaludLabel | string | undefined) => {
  switch (label) {
    case 'excelente': return '#10B981';
    case 'buena': return '#34D399';
    case 'regular': return '#F59E0B';
    case 'critica': return '#EF4444';
    default: return '#87898C';
  }
};

const saludText = (label: SaludLabel | string | undefined) => {
  switch (label) {
    case 'excelente': return 'Excelente';
    case 'buena': return 'Buena';
    case 'regular': return 'Regular';
    case 'critica': return 'Crítica';
    default: return 'N/D';
  }
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

const movTipoConfig = (tipo: MovimientoTipo | string) => {
  switch (tipo) {
    case 'compra': return { icon: 'cart-outline' as const, color: '#EF4444', label: 'Compra', sign: '-' };
    case 'pago': return { icon: 'checkmark-circle-outline' as const, color: '#10B981', label: 'Pago', sign: '+' };
    case 'credito': return { icon: 'add-circle-outline' as const, color: '#3B82F6', label: 'Crédito', sign: '+' };
    case 'ajuste': return { icon: 'refresh-outline' as const, color: '#F59E0B', label: 'Ajuste', sign: '±' };
    default: return { icon: 'ellipsis-horizontal' as const, color: '#87898C', label: tipo, sign: '' };
  }
};

// ─── Hero card visual ────────────────────────────────────────────────────────
function HeroCard({ card }: { card: CreditCard }) {
  const cardColor = card.color || '#1E40AF';
  const lighter = withAlpha(cardColor, 0.35);
  const pct = Math.min(100, Math.max(0, card.utilizacion ?? 0));

  return (
    <View style={[styles.heroCard, { backgroundColor: cardColor }]}>
      {/* Decoration */}
      <View style={[styles.heroCircle1, { backgroundColor: lighter }]} />
      <View style={[styles.heroCircle2, { backgroundColor: lighter }]} />

      <View style={styles.heroTop}>
        <View>
          <Text style={styles.heroBanco}>{card.banco}</Text>
          <Text style={styles.heroNombre}>{card.nombre}</Text>
        </View>
        <View style={styles.heroChip}>
          <View style={styles.heroChipInner} />
        </View>
      </View>

      <Text style={styles.heroNumber}>•••• •••• •••• {card.last4}</Text>

      <View style={styles.heroBottom}>
        <View>
          <Text style={styles.heroLabelSm}>DISPONIBLE</Text>
          <Text style={styles.heroAvailable}>
            {card.moneda} {(card.saldoDisponible ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.heroLabelSm}>UTILIZACIÓN</Text>
          <Text style={styles.heroUtilPct}>{pct.toFixed(1)}%</Text>
        </View>
      </View>

      {/* Util bar */}
      <View style={styles.heroBar}>
        <View style={[styles.heroBarFill, { width: `${pct}%` as any }]} />
      </View>

      <Text style={styles.heroEmisor}>{(card.emisor || '').toUpperCase()}</Text>
    </View>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────
function StatTile({ label, value, color, colors }: { label: string; value: string; color?: string; colors: any }) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: color ?? colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

// ─── Register movement modal ─────────────────────────────────────────────────
interface RegisterMovModal {
  visible: boolean;
  defaultType: MovimientoTipo;
  card: CreditCard;
  onClose: () => void;
  onRegistered: (updated: CreditCard) => void;
  colors: any;
}

function RegisterMovModal({ visible, defaultType, card, onClose, onRegistered, colors }: RegisterMovModal) {
  const [tipo, setTipo] = useState<MovimientoTipo>(defaultType);
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const [subCuentaId, setSubCuentaId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTipo(defaultType);
      setMonto('');
      setDescripcion('');
      setCuentaId('');
      setSubCuentaId('');
    }
  }, [visible, defaultType]);

  const tipos: MovimientoTipo[] = ['compra', 'pago', 'credito', 'ajuste'];
  const canSave = Number(monto) > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const dto: RegisterMovimientoDto = {
        tipo,
        monto: Number(monto),
        descripcion: descripcion.trim() || undefined,
        fecha: new Date().toISOString(),
        // opcional: cuando es pago se puede especificar desde qué cuenta/subcuenta se realiza
        cuentaId: cuentaId?.trim() || undefined,
        subCuentaId: subCuentaId?.trim() || undefined,
      };
      const updated = await creditCardService.registerMovimiento(card.cardId, dto);
      onRegistered(updated);
      onClose();
      Toast.show({ type: 'success', text1: 'Movimiento registrado', visibilityTime: 2200 });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: e?.code === 'VALIDATION' ? 'Cargo no permitido' : 'Error',
        text2: e?.message || 'No se pudo registrar',
        visibilityTime: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const tipoColor = movTipoConfig(tipo).color;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.movModalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={[styles.movModalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.movModalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.movModalHeader}>
              <Text style={[styles.movModalTitle, { color: colors.text }]}>Registrar movimiento</Text>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo</Text>
            <View style={styles.chipRow}>
              {tipos.map((t) => {
                const cfg = movTipoConfig(t);
                const active = tipo === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTipo(t)}
                    style={[
                      styles.movTipoChip,
                      { borderColor: active ? cfg.color : colors.border, backgroundColor: active ? withAlpha(cfg.color, 0.12) : colors.inputBackground },
                    ]}
                  >
                    <Ionicons name={cfg.icon} size={14} color={active ? cfg.color : colors.textSecondary} />
                    <Text style={[styles.movTipoChipText, { color: active ? cfg.color : colors.textSecondary }]}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Monto *</Text>
            <TextInput
              style={[styles.movInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              value={monto}
              onChangeText={(t) => setMonto(t.replace(/[^0-9.]/g, ''))}
              placeholder={`0.00 ${card.moneda}`}
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Descripción</Text>
            <TextInput
              style={[styles.movInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="ej. Supermercado Walmart"
              placeholderTextColor={colors.placeholder}
              maxLength={80}
            />

            {tipo === 'pago' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Cuenta ID (opcional)</Text>
                <TextInput
                  style={[styles.movInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                  value={cuentaId}
                  onChangeText={setCuentaId}
                  placeholder="Ej. cuenta_abc"
                  placeholderTextColor={colors.placeholder}
                  maxLength={64}
                />

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Subcuenta ID (opcional)</Text>
                <TextInput
                  style={[styles.movInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                  value={subCuentaId}
                  onChangeText={setSubCuentaId}
                  placeholder="Ej. subcuenta_123"
                  placeholderTextColor={colors.placeholder}
                  maxLength={64}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.movSaveBtn, { backgroundColor: tipoColor, opacity: canSave ? 1 : 0.4 }]}
              onPress={handleSave}
              disabled={!canSave || saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.movSaveBtnText}>
                  {tipo === 'pago' ? 'Registrar pago' : tipo === 'compra' ? 'Registrar compra' : tipo === 'credito' ? 'Registrar crédito' : 'Registrar ajuste'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: Platform.OS === 'ios' ? 8 : 20 }} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Movement row ─────────────────────────────────────────────────────────────
function MovRow({ mov, colors }: { mov: CreditCardMovimiento; colors: any }) {
  const id = mov.movimientoId || mov._id || '';
  const cfg = movTipoConfig(mov.tipo);
  const fecha = mov.fecha || mov.createdAt;

  return (
    <View style={[styles.movRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.movIconBg, { backgroundColor: withAlpha(cfg.color, 0.12) }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <View style={styles.movInfo}>
        <Text style={[styles.movDesc, { color: colors.text }]} numberOfLines={1}>
          {mov.descripcion || mov.concepto || cfg.label}
        </Text>
        <Text style={[styles.movDate, { color: colors.textSecondary }]}>{formatDateTime(fecha)}</Text>
      </View>
      <Text style={[styles.movAmount, { color: cfg.color }]}>
        {cfg.sign}{mov.monto?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
type ScreenRoute = RouteProp<RootStackParamList, 'CreditCardDetail'>;

export default function CreditCardDetailScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ScreenRoute>();
  const { cardId } = route.params;

  const [card, setCard] = useState<CreditCard | null>(null);
  const [salud, setSalud] = useState<CreditCardSaludResponse | null>(null);
  const [movimientos, setMovimientos] = useState<CreditCardMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [movModalVisible, setMovModalVisible] = useState(false);
  const [movDefaultType, setMovDefaultType] = useState<MovimientoTipo>('compra');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);

      const [cardData, saludData, movData] = await Promise.allSettled([
        creditCardService.getCard(cardId),
        creditCardService.getSalud(cardId),
        creditCardService.getMovimientos(cardId, { limit: 20 }),
      ]);

      if (cardData.status === 'fulfilled') setCard(cardData.value);
      if (saludData.status === 'fulfilled') setSalud(saludData.value);
      if (movData.status === 'fulfilled') setMovimientos(movData.value.data ?? []);

      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo cargar la tarjeta' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cardId, fadeAnim]);

  useFocusEffect(useCallback(() => { void load('initial'); }, [load]));

  const handleMovRegistered = useCallback((updated: CreditCard) => {
    setCard(updated);
    void creditCardService.getMovimientos(cardId, { limit: 20 })
      .then((r) => setMovimientos(r.data ?? []))
      .catch(() => {});
    void creditCardService.getSalud(cardId)
      .then(setSalud)
      .catch(() => {});
  }, [cardId]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Eliminar tarjeta',
      `¿Estás seguro de que quieres eliminar "${card?.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await creditCardService.deleteCard(cardId);
              Toast.show({ type: 'success', text1: 'Tarjeta eliminada', visibilityTime: 2000 });
              navigation.navigate('CreditCards', { refreshKey: Date.now(), removedCardId: cardId });
            } catch (e: any) {
              Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo eliminar' });
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [card, cardId, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.loadingHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Detalle de tarjeta</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#EF7725" />
        </View>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.loadingHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingWrap}>
          <Text style={[{ color: colors.textSecondary }]}>Tarjeta no encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sc = saludColor(card.saludLabel);
  const pct = Math.min(100, Math.max(0, card.utilizacion ?? 0));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.loadingHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{card.nombre}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreditCards', { editCardId: card.cardId, refreshKey: Date.now() })}
          style={styles.editBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.backBtn}
          activeOpacity={0.7}
          disabled={deleting}
        >
          {deleting
            ? <ActivityIndicator size="small" color={colors.error || '#EF4444'} />
            : <Ionicons name="trash-outline" size={20} color={colors.error || '#EF4444'} />
          }
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor="#EF7725" />}
      >
        {/* Hero card */}
        <HeroCard card={card} />

        {/* Quick action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => { setMovDefaultType('pago'); setMovModalVisible(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnPrimaryText}>Registrar pago</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { setMovDefaultType('compra'); setMovModalVisible(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="cart-outline" size={20} color="#EF7725" />
            <Text style={[styles.actionBtnSecondaryText, { color: '#EF7725' }]}>Registrar compra</Text>
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatTile
            label="Saldo usado"
            value={`${card.moneda} ${(card.saldoUsado ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            color={sc}
            colors={colors}
          />
          <StatTile
            label="Disponible"
            value={`${card.moneda} ${(card.saldoDisponible ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            color="#10B981"
            colors={colors}
          />
          <StatTile
            label="Límite"
            value={`${card.moneda} ${(card.limiteCredito ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            colors={colors}
          />
          <StatTile
            label="Pago mínimo"
            value={`${card.moneda} ${(card.pagoMinimo ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
            colors={colors}
          />
        </View>

        {/* Health section */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="heart-outline" size={18} color={sc} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Salud financiera</Text>
            <View style={[styles.saludPill, { backgroundColor: withAlpha(sc, 0.15) }]}>
              <View style={[styles.saludDot, { backgroundColor: sc }]} />
              <Text style={[styles.saludPillText, { color: sc }]}>{saludText(card.saludLabel)}</Text>
            </View>
          </View>

          {/* Score bar */}
          <View style={styles.scoreBarWrap}>
            <View style={[styles.scoreBar, { backgroundColor: colors.border }]}>
              <View style={[styles.scoreBarFill, { width: `${Math.min(100, card.saludScore ?? 0)}%` as any, backgroundColor: sc }]} />
            </View>
            <Text style={[styles.scoreText, { color: sc }]}>{card.saludScore ?? 0}/100</Text>
          </View>

          {/* Alerts */}
          {salud?.alertas && salud.alertas.length > 0 && (
            <View style={[styles.alertBox, { backgroundColor: withAlpha('#F59E0B', 0.1), borderColor: withAlpha('#F59E0B', 0.3) }]}>
              {salud.alertas.map((a, i) => (
                <View key={i} style={styles.alertRow}>
                  <Ionicons name="warning-outline" size={14} color="#F59E0B" style={{ marginTop: 1 }} />
                  <Text style={[styles.alertText, { color: colors.text }]}>{a}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Upcoming dates */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Próximas fechas</Text>
          </View>
          <View style={styles.datesRow}>
            <View style={[styles.dateTile, { backgroundColor: withAlpha('#3B82F6', 0.08), borderColor: withAlpha('#3B82F6', 0.2) }]}>
              <Ionicons name="cut-outline" size={20} color="#3B82F6" />
              <Text style={[styles.dateTileLabel, { color: colors.textSecondary }]}>Fecha de corte</Text>
              <Text style={[styles.dateTileValue, { color: colors.text }]}>{formatDate(card.proximaFechaCorte)}</Text>
            </View>
            <View style={[styles.dateTile, { backgroundColor: withAlpha('#EF7725', 0.08), borderColor: withAlpha('#EF7725', 0.2) }]}>
              <Ionicons name="cash-outline" size={20} color="#EF7725" />
              <Text style={[styles.dateTileLabel, { color: colors.textSecondary }]}>Fecha de pago</Text>
              <Text style={[styles.dateTileValue, { color: colors.text }]}>{formatDate(card.proximaFechaPago)}</Text>
            </View>
          </View>
        </View>

        {/* Movements */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Movimientos recientes</Text>
            <TouchableOpacity
              onPress={() => { setMovDefaultType('compra'); setMovModalVisible(true); }}
              style={[styles.sectionAction, { backgroundColor: withAlpha('#EF7725', 0.1) }]}
            >
              <Ionicons name="add" size={14} color="#EF7725" />
              <Text style={styles.sectionActionText}>Nuevo</Text>
            </TouchableOpacity>
          </View>

          {movimientos.length === 0 ? (
            <View style={styles.movEmpty}>
              <Text style={[styles.movEmptyText, { color: colors.textSecondary }]}>Sin movimientos aún</Text>
            </View>
          ) : (
            movimientos.map((m, i) => (
              <MovRow key={m.movimientoId || m._id || i} mov={m} colors={colors} />
            ))
          )}
        </View>
      </Animated.ScrollView>

      <RegisterMovModal
        visible={movModalVisible}
        defaultType={movDefaultType}
        card={card}
        onClose={() => setMovModalVisible(false)}
        onRegistered={handleMovRegistered}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  editBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { padding: 16 },

  // Hero card
  heroCard: {
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
    minHeight: 190,
    justifyContent: 'space-between',
  },
  heroCircle1: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120, right: -70, top: -70,
  },
  heroCircle2: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75, left: -40, bottom: -50,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroBanco: { color: '#fff', fontSize: 16, fontWeight: '700' },
  heroNombre: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
  heroChip: {
    width: 32, height: 26, borderRadius: 5, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  heroChipInner: { width: 16, height: 12, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  heroNumber: { color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: '600', letterSpacing: 2.5, textAlign: 'center' },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroLabelSm: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '600', letterSpacing: 1 },
  heroAvailable: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  heroUtilPct: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  heroBar: { height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginTop: 4 },
  heroBarFill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999 },
  heroEmisor: { position: 'absolute', bottom: 22, right: 22, color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '800', fontStyle: 'italic' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 14 },
  actionBtnPrimary: { backgroundColor: '#10B981' },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  actionBtnSecondary: { borderWidth: 1 },
  actionBtnSecondaryText: { fontWeight: '700', fontSize: 14 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statTile: {
    flex: 1, minWidth: '45%', borderRadius: 14, borderWidth: 1,
    padding: 14, alignItems: 'center',
  },
  statValue: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },

  // Section
  section: {
    borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  sectionActionText: { color: '#EF7725', fontSize: 12, fontWeight: '700' },

  // Health
  saludPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  saludDot: { width: 6, height: 6, borderRadius: 3 },
  saludPillText: { fontSize: 12, fontWeight: '700' },
  scoreBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  scoreBar: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 999 },
  scoreText: { fontSize: 14, fontWeight: '700', minWidth: 46, textAlign: 'right' },
  alertBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  alertRow: { flexDirection: 'row', gap: 6 },
  alertText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Dates
  datesRow: { flexDirection: 'row', gap: 10 },
  dateTile: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  dateTileLabel: { fontSize: 11, textAlign: 'center' },
  dateTileValue: { fontSize: 13, fontWeight: '700', textAlign: 'center' },

  // Movements
  movRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  movIconBg: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  movInfo: { flex: 1 },
  movDesc: { fontSize: 14, fontWeight: '600' },
  movDate: { fontSize: 12, marginTop: 2 },
  movAmount: { fontSize: 14, fontWeight: '700' },
  movEmpty: { paddingVertical: 20, alignItems: 'center' },
  movEmptyText: { fontSize: 14 },

  // Register movement modal
  movModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  movModalSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  movModalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  movModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  movModalTitle: { flex: 1, fontSize: 18, fontWeight: '700' },

  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  movTipoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  movTipoChipText: { fontSize: 13, fontWeight: '600' },
  movInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 14 },
  movSaveBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  movSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
