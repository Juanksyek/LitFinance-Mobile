import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { useThemeColors } from '../theme/useThemeColors';
import { creditCardService } from '../services/creditCardService';
import type { CreditCard, CreateCreditCardDto, SaludLabel, Recordatorio } from '../types/creditCards';
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

const saludLabel = (label: SaludLabel | string | undefined) => {
  switch (label) {
    case 'excelente': return 'Excelente';
    case 'buena': return 'Buena';
    case 'regular': return 'Regular';
    case 'critica': return 'Crítica';
    default: return 'N/D';
  }
};

const emisorIcon = (emisor: string): React.ComponentProps<typeof Ionicons>['name'] => {
  const e = (emisor || '').toLowerCase();
  if (e.includes('amex')) return 'card';
  return 'card-outline';
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

// ─── Color palette for card backgrounds ─────────────────────────────────────
const CARD_COLORS = [
  '#1E40AF', '#DC2626', '#7C3AED', '#0F766E', '#D97706',
  '#DB2777', '#047857', '#1D4ED8', '#B45309', '#6D28D9',
];

// ─── Mini credit card visual ─────────────────────────────────────────────────
function CardVisual({ card, compact = false }: { card: CreditCard; compact?: boolean }) {
  const cardColor = card.color || '#1E40AF';
  const lighterColor = withAlpha(cardColor, 0.35);

  return (
    <View style={[styles.cardVisual, compact && styles.cardVisualCompact, { backgroundColor: cardColor }]}>
      {/* Decorative circles */}
      <View style={[styles.cvCircle1, { backgroundColor: lighterColor }]} />
      <View style={[styles.cvCircle2, { backgroundColor: lighterColor }]} />

      {/* Top row */}
      <View style={styles.cvTop}>
        <View>
          <Text style={styles.cvBank} numberOfLines={1}>{card.banco || card.nombre}</Text>
          {!compact && <Text style={styles.cvNombre} numberOfLines={1}>{card.nombre}</Text>}
        </View>
        <View style={[styles.cvChip, { borderColor: 'rgba(255,255,255,0.6)' }]}>
          <View style={styles.cvChipInner} />
        </View>
      </View>

      {/* Card number */}
      <Text style={[styles.cvNumber, compact && styles.cvNumberCompact]}>
        •••• •••• •••• {card.last4}
      </Text>

      {/* Bottom row */}
      <View style={styles.cvBottom}>
        <View>
          {!compact && (
            <Text style={styles.cvLabel}>DISPONIBLE</Text>
          )}
          <Text style={[styles.cvAmount, compact && { fontSize: 14 }]}>
            {card.moneda} {card.saldoDisponible?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <Text style={styles.cvEmisor}>{(card.emisor || '').toUpperCase()}</Text>
      </View>
    </View>
  );
}

// ─── Card list item ──────────────────────────────────────────────────────────
function CardItem({ card, onPress, onEdit }: { card: CreditCard; onPress: () => void; onEdit?: () => void }) {
  const colors = useThemeColors();
  const sc = saludColor(card.saludLabel);
  const pct = Math.min(100, Math.max(0, card.utilizacion ?? 0));

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: `${colors.border}88`, borderless: false }}
      style={({ pressed }) => [
        styles.cardItem,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      {onEdit ? (
        <TouchableOpacity onPress={onEdit} style={styles.cardEditBtn} activeOpacity={0.8}>
          <Ionicons name="pencil" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
      <CardVisual card={card} compact />

      <View style={styles.cardItemInfo}>
        {/* utilization bar */}
        <View style={styles.utilizBar}>
          <View style={[styles.utilizFill, { width: `${pct}%` as any, backgroundColor: sc }]} />
        </View>
        <View style={styles.cardItemRow}>
          <Text style={[styles.cardItemLabel, { color: colors.textSecondary }]}>
            Usado: {card.moneda} {(card.saldoUsado ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })} / {(card.limiteCredito ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
          </Text>
          <View style={[styles.saludBadge, { backgroundColor: withAlpha(sc, 0.15) }]}>
            <View style={[styles.saludDot, { backgroundColor: sc }]} />
            <Text style={[styles.saludBadgeText, { color: sc }]}>{saludLabel(card.saludLabel)}</Text>
          </View>
        </View>

        <View style={styles.cardItemRow}>
          <Text style={[styles.cardItemDateLabel, { color: colors.textSecondary }]}>
            Pago mín: <Text style={{ color: colors.text, fontWeight: '600' }}>
              {card.moneda} {(card.pagoMinimo ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </Text>
          </Text>
          <Text style={[styles.cardItemDateLabel, { color: colors.textSecondary }]}>
            Vence: <Text style={{ color: colors.text, fontWeight: '600' }}>{formatDate(card.proximaFechaPago)}</Text>
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ colors, onAdd }: { colors: any; onAdd: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconBg, { backgroundColor: withAlpha('#EF7725', 0.1) }]}>
        <Ionicons name="card-outline" size={48} color="#EF7725" />
      </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Añade tu TDC para llevar un control</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Registra tus tarjetas para controlar límites, pagos y fechas importantes. Mantén tus finanzas ordenadas fácilmente.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>Añadir TDC</Text>
          </TouchableOpacity>
    </View>
  );
}

// ─── Summary header ──────────────────────────────────────────────────────────
function SummaryHeader({ cards, colors }: { cards: CreditCard[]; colors: any }) {
  const totalUsado = cards.reduce((s, c) => s + (c.saldoUsado ?? 0), 0);
  const totalLimite = cards.reduce((s, c) => s + (c.limiteCredito ?? 0), 0);
  const pctAvg = totalLimite > 0 ? (totalUsado / totalLimite) * 100 : 0;

  const dominantMoneda = cards[0]?.moneda ?? 'MXN';

  const sc = saludColor(pctAvg < 30 ? 'excelente' : pctAvg < 50 ? 'buena' : pctAvg < 75 ? 'regular' : 'critica');

  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>Deuda total</Text>
          <Text style={[styles.summaryItemValue, { color: colors.text }]}>
            {dominantMoneda} {totalUsado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>Límite global</Text>
          <Text style={[styles.summaryItemValue, { color: colors.text }]}>
            {dominantMoneda} {totalLimite.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>Utilización</Text>
          <Text style={[styles.summaryItemValue, { color: sc }]}>{pctAvg.toFixed(1)}%</Text>
        </View>
      </View>
      {/* Global utilization bar */}
      <View style={[styles.globalBar, { backgroundColor: colors.border }]}>
        <View style={[styles.globalBarFill, { width: `${Math.min(100, pctAvg)}%` as any, backgroundColor: sc }]} />
      </View>
    </View>
  );
}

// ─── Add/Edit Card Modal ──────────────────────────────────────────────────────
interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (card: CreditCard) => void;
  editing?: CreditCard | null;
  colors: any;
}

function AddCardModal({ visible, onClose, onSaved, editing, colors }: AddCardModalProps) {
  const [nombre, setNombre] = useState('');
  const [banco, setBanco] = useState('');
  const [last4, setLast4] = useState('');
  const [emisor, setEmisor] = useState('VISA');
  const [moneda, setMoneda] = useState('MXN');
  const [limiteCredito, setLimiteCredito] = useState('');
  const [diaCorte, setDiaCorte] = useState('');
  const [diaPago, setDiaPago] = useState('');
  const [selectedColor, setSelectedColor] = useState(CARD_COLORS[0]);
  const [porcentajePagoMinimo, setPorcentajePagoMinimo] = useState('5');
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [newRecTipo, setNewRecTipo] = useState<'pago' | 'corte' | 'custom'>('pago');
  const [newRecDias, setNewRecDias] = useState('');
  const [newRecFecha, setNewRecFecha] = useState('');
  const [editingRecIndex, setEditingRecIndex] = useState<number | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const emisores = ['VISA', 'Mastercard', 'AMEX'];
  const monedas = ['MXN', 'USD', 'EUR'];

  useEffect(() => {
    if (editing) {
      setNombre(editing.nombre ?? '');
      setBanco(editing.banco ?? '');
      setLast4(editing.last4 ?? '');
      setEmisor(editing.emisor ?? 'VISA');
      setMoneda(editing.moneda ?? 'MXN');
      setLimiteCredito(String(editing.limiteCredito ?? ''));
      setDiaCorte(String(editing.diaCorte ?? ''));
      setDiaPago(String(editing.diaPago ?? ''));
      setSelectedColor(editing.color ?? CARD_COLORS[0]);
      setPorcentajePagoMinimo(String(editing.porcentajePagoMinimo ?? 5));
      setRecordatorios(editing.recordatorios ?? []);
    } else {
      setNombre('');
      setBanco('');
      setLast4('');
      setEmisor('VISA');
      setMoneda('MXN');
      setLimiteCredito('');
      setDiaCorte('');
      setDiaPago('');
      setSelectedColor(CARD_COLORS[0]);
      setPorcentajePagoMinimo('5');
      setRecordatorios([]);
    }
  }, [editing, visible]);

  const canSave = nombre.trim() && banco.trim() && last4.length === 4 && Number(limiteCredito) > 0 && Number(diaCorte) > 0 && Number(diaPago) > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const dto: CreateCreditCardDto = {
        nombre: nombre.trim(),
        banco: banco.trim(),
        last4: last4.trim(),
        emisor,
        moneda,
        color: selectedColor,
        limiteCredito: Number(limiteCredito),
        diaCorte: Number(diaCorte),
        diaPago: Number(diaPago),
          porcentajePagoMinimo: Number(porcentajePagoMinimo) || 0,
          recordatorios: recordatorios.length ? recordatorios : undefined,
      };
      let saved: CreditCard;
      if (editing) {
        saved = await creditCardService.updateCard(editing.cardId, dto);
      } else {
        saved = await creditCardService.createCard(dto);
      }
      onSaved(saved);
      onClose();
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: e?.code === 'PLAN_LIMIT' ? 'Plan gratuito' : 'Error',
        text2: e?.message || 'No se pudo guardar la tarjeta',
        visibilityTime: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            {/* Handle */}
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editing ? 'Editar tarjeta' : 'Nueva tarjeta'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Color picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Color de tarjeta</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CARD_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      selectedColor === c && styles.colorDotSelected,
                    ]}
                  >
                    {selectedColor === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Preview */}
              {nombre.trim() || banco.trim() || last4.trim() ? (
                <CardVisual
                  card={{ cardId: '', nombre: nombre || 'Mi tarjeta', banco: banco || 'Banco', last4: last4 || '0000', emisor, moneda, color: selectedColor, saldoDisponible: 0, saldoUsado: 0, limiteCredito: Number(limiteCredito) || 0, utilizacion: 0, saludScore: 0, saludLabel: 'excelente', pagoMinimo: 0, proximaFechaCorte: null, proximaFechaPago: null }}
                  compact={false}
                />
              ) : null}

              <View style={{ height: 16 }} />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nombre de tarjeta *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={nombre}
                onChangeText={setNombre}
                placeholder="ej. Visa Oro"
                placeholderTextColor={colors.placeholder}
                maxLength={40}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Banco *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={banco}
                onChangeText={setBanco}
                placeholder="ej. Banamex"
                placeholderTextColor={colors.placeholder}
                maxLength={40}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Últimos 4 dígitos *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={last4}
                onChangeText={(t) => setLast4(t.replace(/\D/g, '').slice(0, 4))}
                placeholder="4321"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
                maxLength={4}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Emisor</Text>
              <View style={styles.chipRow}>
                {emisores.map((e) => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setEmisor(e)}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: emisor === e ? '#EF7725' : colors.inputBackground },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: emisor === e ? '#fff' : colors.text }]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Moneda</Text>
              <View style={styles.chipRow}>
                {monedas.map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMoneda(m)}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: moneda === m ? '#EF7725' : colors.inputBackground },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: moneda === m ? '#fff' : colors.text }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Porcentaje pago mínimo</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={porcentajePagoMinimo}
                onChangeText={(t) => setPorcentajePagoMinimo(t.replace(/[^0-9.]/g, ''))}
                placeholder="5"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Recordatorios</Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Configura avisos automáticos para esta tarjeta. Puedes avisarte X días antes del cierre/pago, o en una fecha concreta.</Text>
              {recordatorios.length === 0 ? (
                <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>No hay recordatorios</Text>
              ) : (
                recordatorios.map((r, i) => (
                  <View key={i} style={[styles.reminderCard, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reminderTitle, { color: colors.text }]}>
                        {r.tipo === 'custom' ? 'Recordatorio: Fecha específica' : r.tipo === 'pago' ? 'Recordatorio de pago' : 'Recordatorio de corte'}
                      </Text>
                      <Text style={[styles.reminderSub, { color: colors.textSecondary }]}>
                        {r.tipo === 'custom' ? (r.fecha ? new Date(r.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fecha no definida') : `${r.diasAntes ?? '—'} días antes`}
                      </Text>
                    </View>
                    <View style={styles.reminderActions}>
                      <TouchableOpacity onPress={() => {
                        // toggle active
                        const next = [...recordatorios];
                        next[i] = { ...next[i], activo: !next[i].activo };
                        setRecordatorios(next);
                      }} style={{ padding: 6 }}>
                        <Ionicons name={r.activo ? 'eye' : 'eye-off'} size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => {
                          // start editing this reminder
                          setEditingRecIndex(i);
                          setNewRecTipo(r.tipo as any);
                          setNewRecDias(r.diasAntes ? String(r.diasAntes) : '');
                          setNewRecFecha(r.fecha ?? '');
                          setTempDate(r.fecha ? new Date(r.fecha) : null);
                        }} style={{ padding: 6 }}>
                        <Ionicons name="pencil" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setRecordatorios((prev) => prev.filter((_, idx) => idx !== i))} style={{ padding: 6 }}>
                        <Ionicons name="trash-outline" size={18} color={colors.error || '#EF4444'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: 8 }} />
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{editingRecIndex !== null ? 'Editar recordatorio' : 'Agregar recordatorio'}</Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>{editingRecIndex !== null ? 'Modifica los campos y presiona "Actualizar".' : 'Selecciona tipo y define cuándo quieres recibir el aviso.'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => setNewRecTipo('pago')} style={[styles.chip, { borderColor: colors.border, backgroundColor: newRecTipo === 'pago' ? '#EF7725' : colors.inputBackground }]}>
                  <Text style={[styles.chipText, { color: newRecTipo === 'pago' ? '#fff' : colors.text }]}>Pago</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setNewRecTipo('corte')} style={[styles.chip, { borderColor: colors.border, backgroundColor: newRecTipo === 'corte' ? '#EF7725' : colors.inputBackground }]}>
                  <Text style={[styles.chipText, { color: newRecTipo === 'corte' ? '#fff' : colors.text }]}>Corte</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setNewRecTipo('custom')} style={[styles.chip, { borderColor: colors.border, backgroundColor: newRecTipo === 'custom' ? '#EF7725' : colors.inputBackground }]}>
                  <Text style={[styles.chipText, { color: newRecTipo === 'custom' ? '#fff' : colors.text }]}>Fecha específica</Text>
                </TouchableOpacity>
              </View>
              {newRecTipo === 'custom' ? (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS === 'android') {
                        setTempDate(tempDate ?? new Date());
                        setShowDatePicker(true);
                      } else {
                        setTempDate(tempDate ?? new Date());
                        setShowDatePicker(true);
                      }
                    }}
                    style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, justifyContent: 'center' }]}
                  >
                    <Text style={{ color: tempDate ? colors.text : colors.placeholder }}>
                      {tempDate ? new Date(tempDate).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Seleccionar fecha y hora'}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && Platform.OS === 'ios' && (
                    <DateTimePicker
                      value={tempDate ?? new Date()}
                      mode="datetime"
                      display="default"
                      onChange={(_e, selected) => {
                        setShowDatePicker(false);
                        if (selected) {
                          setTempDate(selected);
                          setNewRecFecha(selected.toISOString());
                        }
                      }}
                    />
                  )}

                  {showDatePicker && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={tempDate ?? new Date()}
                      mode="date"
                      display="default"
                      onChange={(_e, selected) => {
                        setShowDatePicker(false);
                        if (selected) {
                          setTempDate(selected);
                          // open time picker now
                          setShowTimePicker(true);
                        }
                      }}
                    />
                  )}

                  {showTimePicker && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={tempDate ?? new Date()}
                      mode="time"
                      is24Hour={true}
                      display="default"
                      onChange={(_e, selected) => {
                        setShowTimePicker(false);
                        if (selected) {
                          const base = tempDate ?? new Date();
                          base.setHours(selected.getHours());
                          base.setMinutes(selected.getMinutes());
                          setTempDate(base);
                          setNewRecFecha(base.toISOString());
                        }
                      }}
                    />
                  )}
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    {[1,3,7,14].map((d) => (
                      <TouchableOpacity key={d} onPress={() => setNewRecDias(String(d))} style={[styles.chip, { borderColor: colors.border, backgroundColor: String(d) === newRecDias ? '#EF7725' : colors.inputBackground }]}>
                        <Text style={[styles.chipText, { color: String(d) === newRecDias ? '#fff' : colors.text }]}>{d} días</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                    value={newRecDias}
                    onChangeText={(t) => setNewRecDias(t.replace(/\D/g, '').slice(0, 3))}
                    placeholder="Días antes (ej. 3)"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                  />
                </>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TouchableOpacity
                    onPress={() => {
                    // validate input
                    if (newRecTipo === 'custom') {
                      if (!tempDate && !newRecFecha) {
                        Toast.show({ type: 'error', text1: 'Fecha requerida', text2: 'Selecciona una fecha y hora para el recordatorio.' });
                        return;
                      }
                    }
                    if ((newRecTipo === 'pago' || newRecTipo === 'corte') && !newRecDias) {
                      Toast.show({ type: 'error', text1: 'Días necesarios', text2: 'Introduce los días antes para este tipo de recordatorio.' });
                      return;
                    }
                    const rec: Recordatorio = newRecTipo === 'custom'
                      ? { tipo: 'custom', fecha: tempDate ? tempDate.toISOString() : (newRecFecha || undefined), activo: true }
                      : { tipo: newRecTipo, diasAntes: newRecDias ? Number(newRecDias) : undefined, activo: true } as Recordatorio;
                    if (editingRecIndex !== null) {
                      setRecordatorios((prev) => {
                        const next = [...prev];
                        next[editingRecIndex] = rec;
                        return next;
                      });
                      setEditingRecIndex(null);
                    } else {
                      setRecordatorios((prev) => [...prev, rec]);
                    }
                    setNewRecDias('');
                    setNewRecFecha('');
                    setNewRecTipo('pago');
                  }}
                  style={[styles.emptyBtn, { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10 }]}
                >
                  <Text style={styles.emptyBtnText}>{editingRecIndex !== null ? 'Actualizar recordatorio' : 'Agregar recordatorio'}</Text>
                </TouchableOpacity>
                {editingRecIndex !== null && (
                  <TouchableOpacity onPress={() => { setEditingRecIndex(null); setNewRecDias(''); setNewRecFecha(''); setNewRecTipo('pago'); }} style={[styles.emptyBtn, { backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 10 }]}>
                    <Text style={[styles.emptyBtnText, { color: colors.text }]}>Cancelar</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Límite de crédito *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                value={limiteCredito}
                onChangeText={(t) => setLimiteCredito(t.replace(/[^0-9.]/g, ''))}
                placeholder="50000"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
              />

              <View style={styles.twoCol}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Día de corte *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                    value={diaCorte}
                    onChangeText={(t) => setDiaCorte(t.replace(/\D/g, '').slice(0, 2))}
                    placeholder="15"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Día de pago *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                    value={diaPago}
                    onChangeText={(t) => setDiaPago(t.replace(/\D/g, '').slice(0, 2))}
                    placeholder="5"
                    placeholderTextColor={colors.placeholder}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, !canSave && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!canSave || saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editing ? 'Guardar cambios' : 'Agregar tarjeta'}</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CreditCardsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CreditCards'>>();

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      const data = await creditCardService.listCards();
      setCards(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (e: any) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { void load('initial'); }, [load]));

  useEffect(() => {
    const editId = route.params?.editCardId;
    const refreshKey = route.params?.refreshKey;
    const removedId = route.params?.removedCardId;
    if (typeof removedId !== 'undefined') {
      setCards((prev) => prev.filter((c) => c.cardId !== removedId));
      try { navigation.setParams?.({ removedCardId: undefined } as any); } catch {}
    }
    if (typeof refreshKey !== 'undefined') {
      void load('refresh');
      try { navigation.setParams?.({ refreshKey: undefined } as any); } catch {}
    }
    if (editId) {
      const existing = cards.find((c) => c.cardId === editId);
      if (existing) {
        setEditingCard(existing);
        setAddModalVisible(true);
        try { navigation.setParams?.({ editCardId: undefined } as any); } catch {}
      } else {
        void load('refresh').then(() => {
          const found = cards.find((c) => c.cardId === editId);
          if (found) {
            setEditingCard(found);
            setAddModalVisible(true);
          }
          try { navigation.setParams?.({ editCardId: undefined } as any); } catch {}
        }).catch(() => { try { navigation.setParams?.({ editCardId: undefined } as any); } catch {} });
      }
    }
  }, [route.params?.editCardId, route.params?.refreshKey, route.params?.removedCardId]);

  const handleCardSaved = useCallback((saved: CreditCard) => {
    setCards((prev) => {
      const idx = prev.findIndex((c) => c.cardId === saved.cardId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    Toast.show({ type: 'success', text1: '¡Tarjeta guardada!', visibilityTime: 2500 });
  }, []);

  const handleOpenAdd = useCallback(() => {
    setEditingCard(null);
    setAddModalVisible(true);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tarjetas de crédito</Text>
        <TouchableOpacity onPress={handleOpenAdd} style={styles.addHeaderBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={24} color="#EF7725" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#EF7725" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando tarjetas…</Text>
        </View>
      ) : cards.length === 0 ? (
        <ScrollView
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100, flex: 1 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <EmptyState colors={colors} onAdd={handleOpenAdd} />
        </ScrollView>
      ) : (
        <Animated.FlatList
          data={cards}
          keyExtractor={(c) => c.cardId}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          style={{ opacity: fadeAnim }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor="#EF7725" />}
          ListHeaderComponent={
            cards.length > 0 ? <SummaryHeader cards={cards} colors={colors} /> : null
          }
          renderItem={({ item }) => (
            <CardItem
              card={item}
              onPress={() => navigation.navigate('CreditCardDetail', { cardId: item.cardId })}
              onEdit={() => { setEditingCard(item); setAddModalVisible(true); }}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      {!loading && cards.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          onPress={handleOpenAdd}
          activeOpacity={0.88}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <AddCardModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSaved={handleCardSaved}
        editing={editingCard}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addHeaderBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  listContent: { padding: 16 },

  // Summary
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  summaryItemValue: { fontSize: 15, fontWeight: '700' },
  summaryDivider: { width: 1, height: 36, marginHorizontal: 8 },
  globalBar: { height: 5, borderRadius: 999, marginTop: 14, overflow: 'hidden' },
  globalBarFill: { height: '100%', borderRadius: 999 },

  // Card visual
  cardVisual: {
    borderRadius: 16,
    padding: 18,
    overflow: 'hidden',
    height: 160,
    justifyContent: 'space-between',
  },
  cardVisualCompact: {
    height: 120,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cvCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -60,
    top: -60,
  },
  cvCircle2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    left: -30,
    bottom: -40,
  },
  cvTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cvBank: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '700' },
  cvNombre: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
  cvChip: {
    width: 28,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cvChipInner: {
    width: 14,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  cvNumber: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: '600', letterSpacing: 2 },
  cvNumberCompact: { fontSize: 13, letterSpacing: 1.5 },
  cvBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cvLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '600', letterSpacing: 1 },
  cvAmount: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cvEmisor: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800', fontStyle: 'italic' },

  // Card item
  cardItem: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardEditBtn: { position: 'absolute', top: 12, right: 12, zIndex: 2, padding: 8, borderRadius: 8 },
  reminderCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  reminderTitle: { fontSize: 14, fontWeight: '700' },
  reminderSub: { fontSize: 12 },
  reminderActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  cardItemInfo: { marginTop: 4 },
  utilizBar: { height: 5, borderRadius: 999, backgroundColor: '#e0e0e0', overflow: 'hidden', marginBottom: 8 },
  utilizFill: { height: '100%', borderRadius: 999 },
  cardItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardItemLabel: { fontSize: 12, fontWeight: '500' },
  cardItemDateLabel: { fontSize: 12 },

  saludBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  saludDot: { width: 6, height: 6, borderRadius: 3 },
  saludBadgeText: { fontSize: 11, fontWeight: '700' },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIconBg: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF7725',
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EF7725',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF7725',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },

  // Add modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '92%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  modalCloseBtn: { padding: 4 },

  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  twoCol: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  saveBtn: {
    backgroundColor: '#EF7725',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
