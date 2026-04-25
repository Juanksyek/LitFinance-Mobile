import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../theme/useThemeColors';
import { ticketScanService, CATEGORY_CONFIG, type TicketCategoria } from '../services/ticketScanService';

interface ManualItem {
  nombre: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: number;
}

const METODO_PAGO_OPTIONS = [
  { value: 'efectivo', label: 'Efectivo', icon: 'cash-outline' as const },
  { value: 'tarjeta', label: 'Tarjeta', icon: 'card-outline' as const },
  { value: 'transferencia', label: 'Transferencia', icon: 'swap-horizontal-outline' as const },
];

export default function TicketManualScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [tienda, setTienda] = useState('');
  const [direccion, setDireccion] = useState('');
  const [fechaCompra, setFechaCompra] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<ManualItem[]>([
    { nombre: '', cantidad: 1, precioUnitario: '', subtotal: 0 },
  ]);
  const [impuestos, setImpuestos] = useState('');
  const [descuentos, setDescuentos] = useState('');
  const [sending, setSending] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.subtotal, 0),
    [items],
  );

  const total = useMemo(
    () => subtotal + (parseFloat(impuestos) || 0) - (parseFloat(descuentos) || 0),
    [subtotal, impuestos, descuentos],
  );

  const updateItem = useCallback((index: number, field: keyof ManualItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      if (field === 'cantidad' || field === 'precioUnitario') {
        const price = parseFloat(field === 'precioUnitario' ? value : item.precioUnitario) || 0;
        const qty = field === 'cantidad' ? value : item.cantidad;
        item.subtotal = qty * price;
      }
      copy[index] = item;
      return copy;
    });
  }, []);

  const addItem = () => {
    setItems((prev) => [...prev, { nombre: '', cantidad: 1, precioUnitario: '', subtotal: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) setFechaCompra(date);
  };

  const formatDate = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async () => {
    if (!tienda.trim()) {
      Toast.show({ type: 'info', text1: 'Ingresa el nombre de la tienda' });
      return;
    }
    const validItems = items.filter((it) => it.nombre.trim() && it.subtotal > 0);
    if (validItems.length === 0) {
      Toast.show({ type: 'info', text1: 'Agrega al menos un artículo con precio' });
      return;
    }

    setSending(true);
    try {
      const cuentaId = await AsyncStorage.getItem('cuentaId');
      const res = await ticketScanService.createManual({
        tienda: tienda.trim(),
        direccionTienda: direccion.trim() || undefined,
        fechaCompra: fechaCompra.toISOString(),
        items: validItems.map((it) => ({
          nombre: it.nombre.trim(),
          cantidad: it.cantidad,
          precioUnitario: parseFloat(it.precioUnitario) || 0,
          subtotal: it.subtotal,
        })),
        subtotal,
        impuestos: parseFloat(impuestos) || 0,
        descuentos: parseFloat(descuentos) || 0,
        total,
        moneda: undefined, // use default
        metodoPago,
        cuentaId: cuentaId ?? undefined,
        notas: notas.trim() || undefined,
      });

      Toast.show({ type: 'success', text1: 'Ticket creado', text2: res.message });
      // Navigate to review to confirm
      // @ts-ignore
      navigation.replace('TicketReview', { ticket: res.ticket });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al crear ticket',
        text2: err?.message || 'Intenta de nuevo',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ticket manual</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Store name */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Tienda *</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
          value={tienda}
          onChangeText={setTienda}
          placeholder="Ej: Walmart, Oxxo, Farmacia..."
          placeholderTextColor={colors.placeholder}
        />

        {/* Address */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Dirección (opcional)</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
          value={direccion}
          onChangeText={setDireccion}
          placeholder="Dirección de la tienda"
          placeholderTextColor={colors.placeholder}
        />

        {/* Date */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Fecha de compra</Text>
        <TouchableOpacity
          style={[styles.dateBtn, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(fechaCompra)}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={fechaCompra}
            mode="date"
            maximumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        {/* Payment method */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Método de pago</Text>
        <View style={styles.payRow}>
          {METODO_PAGO_OPTIONS.map((opt) => {
            const active = metodoPago === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.payChip,
                  {
                    backgroundColor: active ? '#EF772518' : colors.inputBackground,
                    borderColor: active ? '#EF7725' : colors.border,
                  },
                ]}
                onPress={() => setMetodoPago(opt.value)}
              >
                <Ionicons name={opt.icon} size={16} color={active ? '#EF7725' : colors.textSecondary} />
                <Text style={[styles.payChipText, { color: active ? '#EF7725' : colors.textSecondary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Items section */}
        <View style={styles.itemsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Artículos</Text>
          <TouchableOpacity onPress={addItem} style={[styles.addBtn, { backgroundColor: '#EF772514' }]}>
            <Ionicons name="add" size={16} color="#EF7725" />
            <Text style={styles.addBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {items.map((item, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.itemRow1}>
              <TextInput
                style={[styles.itemNameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                value={item.nombre}
                onChangeText={(v) => updateItem(i, 'nombre', v)}
                placeholder={`Artículo ${i + 1}`}
                placeholderTextColor={colors.placeholder}
              />
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.itemRow2}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>Cant.</Text>
                <TextInput
                  style={[styles.miniInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                  value={String(item.cantidad)}
                  keyboardType="numeric"
                  onChangeText={(v) => {
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n > 0) updateItem(i, 'cantidad', n);
                  }}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>Precio unit.</Text>
                <TextInput
                  style={[styles.miniInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                  value={item.precioUnitario}
                  keyboardType="decimal-pad"
                  placeholder="$0.00"
                  placeholderTextColor={colors.placeholder}
                  onChangeText={(v) => updateItem(i, 'precioUnitario', v)}
                />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.miniLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.subtotalText, { color: colors.text }]}>${item.subtotal.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Tax & discounts */}
        <View style={styles.taxRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Impuestos</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              value={impuestos}
              keyboardType="decimal-pad"
              placeholder="$0.00"
              placeholderTextColor={colors.placeholder}
              onChangeText={setImpuestos}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Descuentos</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              value={descuentos}
              keyboardType="decimal-pad"
              placeholder="$0.00"
              placeholderTextColor={colors.placeholder}
              onChangeText={setDescuentos}
            />
          </View>
        </View>

        {/* Notes */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Notas (opcional)</Text>
        <TextInput
          style={[styles.notesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
          value={notas}
          onChangeText={setNotas}
          placeholder="Notas adicionales..."
          placeholderTextColor={colors.placeholder}
          multiline
          numberOfLines={3}
        />

        {/* Totals card */}
        <View style={[styles.totalsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.totalLine}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Subtotal</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>${subtotal.toFixed(2)}</Text>
          </View>
          {(parseFloat(impuestos) || 0) > 0 && (
            <View style={styles.totalLine}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Impuestos</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>${(parseFloat(impuestos) || 0).toFixed(2)}</Text>
            </View>
          )}
          {(parseFloat(descuentos) || 0) > 0 && (
            <View style={styles.totalLine}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Descuentos</Text>
              <Text style={[styles.totalValue, { color: '#10B981' }]}>-${(parseFloat(descuentos) || 0).toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalLine, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }]}>
            <Text style={[styles.grandLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.grandValue, { color: '#EF7725' }]}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.submitBtn, { opacity: sending ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Crear ticket</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  scrollContent: { padding: 16 },

  label: { fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateText: { fontSize: 15 },

  payRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  payChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  payChipText: { fontSize: 12, fontWeight: '600' },

  sectionTitle: { fontSize: 15, fontWeight: '700' },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
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
    padding: 12,
    marginBottom: 10,
  },
  itemRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  itemNameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  itemRow2: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  miniLabel: { fontSize: 11, marginBottom: 4 },
  miniInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  subtotalText: { fontSize: 15, fontWeight: '700', paddingVertical: 8 },

  taxRow: { flexDirection: 'row', gap: 12 },

  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },

  totalsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14, fontWeight: '500' },
  grandLabel: { fontSize: 16, fontWeight: '700' },
  grandValue: { fontSize: 20, fontWeight: '800' },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#EF7725',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
