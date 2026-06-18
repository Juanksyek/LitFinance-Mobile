import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/useThemeColors';
import Toast from 'react-native-toast-message';
import * as sharedService from '../../services/sharedSpacesService';
import type { SharedSpace } from '../../types/sharedSpaces';
import {
  SPACE_TYPE_LABELS,
  SPACE_TYPE_ICONS,
  SPLIT_MODE_LABELS,
  type SpaceType,
  type SplitMode,
} from '../../types/sharedSpaces';

const SPACE_TYPES: SpaceType[] = ['pareja', 'grupo', 'viaje', 'familia', 'custom'];
const CURRENCIES = ['USD', 'MXN', 'EUR', 'COP', 'ARS', 'CLP', 'PEN', 'BRL', 'GBP'];
const SPLIT_MODES: SplitMode[] = ['equal', 'percentage', 'fixed', 'units', 'participants_only', 'custom'];

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (space?: SharedSpace) => void;
};

export default function CreateSpaceModal({ visible, onClose, onCreated }: Props) {
  const colors = useThemeColors();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<SpaceType>('grupo');
  const [moneda, setMoneda] = useState('MXN');
  const [splitDefault, setSplitDefault] = useState<SplitMode>('equal');
  const [allowImpact, setAllowImpact] = useState(true);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setNombre('');
    setTipo('grupo');
    setMoneda('MXN');
    setSplitDefault('equal');
    setAllowImpact(true);
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = nombre.trim();
    if (!trimmed) {
      Toast.show({ type: 'info', text1: 'Escribe un nombre para el espacio' });
      return;
    }
    setSaving(true);
    try {
      const res = await sharedService.createSpace({
        nombre: trimmed,
        tipo,
        monedaBase: moneda,
        configuracion: {
          splitDefaultMode: splitDefault,
          allowAccountImpact: allowImpact,
          maxMembers: tipo === 'pareja' ? 2 : 10,
          requireApproval: false,
          allowCategories: true,
          allowRecurring: true,
        },
      });
      Toast.show({ type: 'success', text1: 'Espacio creado' });
      reset();
      onCreated(res?.space);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error al crear espacio', text2: err?.message ?? '' });
    } finally {
      setSaving(false);
    }
  }, [nombre, tipo, moneda, splitDefault, allowImpact, reset, onCreated]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nuevo espacio</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Nombre */}
            <Text style={[styles.label, { color: colors.text }]}>Nombre</Text>
            <TextInput
              placeholder="Ej. Casa Compartida"
              value={nombre}
              onChangeText={setNombre}
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.inputText }]}
              placeholderTextColor={colors.placeholder}
              maxLength={60}
            />

            {/* Tipo */}
            <Text style={[styles.label, { color: colors.text }]}>Tipo</Text>
            <View style={styles.chipRow}>
              {SPACE_TYPES.map((t) => {
                const selected = tipo === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTipo(t)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.button : colors.backgroundSecondary,
                        borderColor: selected ? colors.button : colors.border,
                      },
                    ]}
                    activeOpacity={0.9}
                  >
                    <Ionicons name={(SPACE_TYPE_ICONS[t] ?? 'people-outline') as any} size={16} color={selected ? '#FFF' : colors.text} />
                    <Text style={[styles.chipText, { color: selected ? '#FFF' : colors.text }]}>
                      {SPACE_TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Moneda */}
            <Text style={[styles.label, { color: colors.text }]}>Moneda base</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={styles.chipRow}>
                {CURRENCIES.map((c) => {
                  const selected = moneda === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setMoneda(c)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? colors.button : colors.backgroundSecondary,
                          borderColor: selected ? colors.button : colors.border,
                        },
                      ]}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.chipText, { color: selected ? '#FFF' : colors.text }]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Split mode */}
            <Text style={[styles.label, { color: colors.text }]}>División por defecto</Text>
            <View style={styles.chipRow}>
              {SPLIT_MODES.map((m) => {
                const selected = splitDefault === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setSplitDefault(m)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.button : colors.backgroundSecondary,
                        borderColor: selected ? colors.button : colors.border,
                      },
                    ]}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.chipText, { color: selected ? '#FFF' : colors.text, fontSize: 11 }]}>
                      {SPLIT_MODE_LABELS[m]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Account impact toggle */}
            <TouchableOpacity
              onPress={() => setAllowImpact(!allowImpact)}
              style={[styles.toggleRow, { borderColor: colors.border }]}
              activeOpacity={0.9}
            >
              <Ionicons
                name={allowImpact ? 'checkbox-outline' : 'square-outline'}
                size={22}
                color={allowImpact ? colors.button : colors.textSecondary}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Permitir impacto en cuentas</Text>
                <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                  Los movimientos pueden afectar los saldos de cuentas personales
                </Text>
              </View>
            </TouchableOpacity>

            {/* Create button */}
            <TouchableOpacity
              onPress={handleCreate}
              disabled={saving}
              activeOpacity={0.9}
              style={[styles.createBtn, { backgroundColor: colors.button, opacity: saving ? 0.6 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                  <Text style={styles.createBtnText}>Crear espacio</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  label: { fontSize: 13, fontWeight: '900', marginBottom: 8, marginTop: 4 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '800' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    marginTop: 4,
    marginBottom: 14,
  },
  toggleLabel: { fontSize: 14, fontWeight: '800' },
  toggleHint: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  createBtnText: { fontSize: 16, fontWeight: '900', color: '#FFF' },
});
