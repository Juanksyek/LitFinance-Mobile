import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  Switch,
  Keyboard,
} from 'react-native';
import { PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/useThemeColors';
import Toast from 'react-native-toast-message';
import * as sharedService from '../../services/sharedSpacesService';
import {
  MOVEMENT_TYPE_LABELS,
  SPLIT_MODE_LABELS,
  type MovementType,
  type SplitMode,
  type SharedSpaceMember,
  type SharedCategory,
} from '../../types/sharedSpaces';

const MOV_TYPES: MovementType[] = ['expense', 'income', 'adjustment'];
const SPLIT_MODES: SplitMode[] = ['equal', 'percentage', 'fixed', 'participants_only'];

type Props = {
  visible: boolean;
  spaceId: string;
  members: SharedSpaceMember[];
  categories: SharedCategory[];
  monedaBase: string;
  splitDefault: SplitMode;
  onClose: () => void;
  onCreated: () => void;
};

type SplitEntry = {
  memberId: string;
  included: boolean;
  percentage: string;
  fixed: string;
};

export default function SharedMovementModal({
  visible,
  spaceId,
  members,
  categories,
  monedaBase,
  splitDefault,
  onClose,
  onCreated,
}: Props) {
  const colors = useThemeColors();

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const onShow = (e: any) => setKeyboardHeight(e.endCoordinates?.height || 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener('keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      try { showSub.remove(); } catch {}
      try { hideSub.remove(); } catch {}
    };
  }, []);

  // PanResponder para permitir cerrar solo desde el pill superior
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_evt, _gs) => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only start pan responder when gesture starts on the header area (we'll attach handlers there)
        return Math.abs(gestureState.dy) > 6 && Math.abs(gestureState.dx) < 20;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > 80) {
          onClose();
        }
      },
    })
  ).current;

  // ── Form state ────────────────────────────────────────────────────────
  const [tipo, setTipo] = useState<MovementType>('expense');
  const [titulo, setTitulo] = useState('');
  const [monto, setMonto] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>(splitDefault);
  const [payerMemberId, setPayerMemberId] = useState<string>(members[0]?.memberId ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Split per member
  const [splits, setSplits] = useState<SplitEntry[]>(() =>
    members.map((m) => ({
      memberId: m.memberId,
      included: true,
      percentage: '',
      fixed: '',
    })),
  );

  const updateSplit = useCallback((memberId: string, field: keyof SplitEntry, value: any) => {
    setSplits((prev) =>
      prev.map((s) => (s.memberId === memberId ? { ...s, [field]: value } : s)),
    );
  }, []);

  const reset = useCallback(() => {
    setTipo('expense');
    setTitulo('');
    setMonto('');
    setSplitMode(splitDefault);
    setPayerMemberId(members[0]?.memberId ?? '');
    setCategoryId(null);
    setSplits(members.map((m) => ({ memberId: m.memberId, included: true, percentage: '', fixed: '' })));
  }, [members, splitDefault]);

  // ── Build splits for API ──────────────────────────────────────────────
  const buildSplitsPayload = useCallback(() => {
    const montoTotal = parseFloat(monto) || 0;
    const included = splits.filter((s) => s.included);
    if (included.length === 0) return [];

    return included.map((s) => {
      const base: any = { memberId: s.memberId, included: true };
      if (splitMode === 'equal') {
        base.amountAssigned = +(montoTotal / included.length).toFixed(2);
      } else if (splitMode === 'percentage') {
        const pct = parseFloat(s.percentage) || (100 / included.length);
        base.percentage = pct;
        base.amountAssigned = +(montoTotal * pct / 100).toFixed(2);
      } else if (splitMode === 'fixed') {
        base.amountAssigned = parseFloat(s.fixed) || 0;
      } else {
        // participants_only — equal among selected
        base.amountAssigned = +(montoTotal / included.length).toFixed(2);
      }
      return base;
    });
  }, [splits, splitMode, monto]);

  // ── Submit ────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    const trimmedTitle = titulo.trim();
    const montoTotal = parseFloat(monto);
    if (!trimmedTitle) {
      Toast.show({ type: 'info', text1: 'Escribe un título' });
      return;
    }
    if (!montoTotal || montoTotal <= 0) {
      Toast.show({ type: 'info', text1: 'Ingresa un monto válido' });
      return;
    }
    if (!payerMemberId) {
      Toast.show({ type: 'info', text1: 'Selecciona quién pagó' });
      return;
    }

    const splitsPayload = buildSplitsPayload();
    if (splitsPayload.length === 0) {
      Toast.show({ type: 'info', text1: 'Selecciona al menos un participante' });
      return;
    }

    setSaving(true);
    try {
      await sharedService.createMovement(spaceId, {
        tipo,
        titulo: trimmedTitle,
        montoTotal,
        moneda: monedaBase,
        fechaMovimiento: new Date().toISOString(),
        splitMode,
        contributions: [
          { memberId: payerMemberId, amountContributed: montoTotal, contributionType: 'payer' },
        ],
        splits: splitsPayload,
        categoriaId: categoryId ?? undefined,
        idempotencyKey: sharedService.createIdempotencyKey(),
      });
      Toast.show({ type: 'success', text1: 'Movimiento registrado' });
      reset();
      onCreated();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err?.message ?? '' });
    } finally {
      setSaving(false);
    }
  }, [titulo, monto, tipo, splitMode, payerMemberId, categoryId, spaceId, monedaBase, buildSplitsPayload, reset, onCreated]);

  const memberMap = useMemo(() => {
    const map: Record<string, SharedSpaceMember> = {};
    members.forEach((m) => { map[m.memberId] = m; });
    return map;
  }, [members]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 24}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: keyboardHeight }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle: attach pan handlers here so only drags starting on handle close the modal */}
          <View {...pan.panHandlers} style={{ alignItems: 'center', marginBottom: 8 }}>
            <View style={[styles.handlePill, { backgroundColor: colors.border }]} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Math.max(24, keyboardHeight + 24) }}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nuevo movimiento</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Type */}
            <Text style={[styles.label, { color: colors.text }]}>Tipo</Text>
            <View style={styles.chipRow}>
              {MOV_TYPES.map((t) => {
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
                    <Text style={[styles.chipText, { color: selected ? '#FFF' : colors.text }]}>
                      {MOVEMENT_TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Title */}
            <Text style={[styles.label, { color: colors.text }]}>Título</Text>
            <TextInput
              placeholder="Ej. Cena en restaurante"
              value={titulo}
              onChangeText={setTitulo}
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.inputText }]}
              placeholderTextColor={colors.placeholder}
              maxLength={100}
            />

            {/* Amount */}
            <Text style={[styles.label, { color: colors.text }]}>Monto total ({monedaBase})</Text>
            <TextInput
              placeholder="0.00"
              value={monto}
              onChangeText={setMonto}
              keyboardType="decimal-pad"
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.inputText }]}
              placeholderTextColor={colors.placeholder}
            />

            {/* Category */}
            {categories.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Categoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      onPress={() => setCategoryId(null)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: !categoryId ? colors.button : colors.backgroundSecondary,
                          borderColor: !categoryId ? colors.button : colors.border,
                        },
                      ]}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.chipText, { color: !categoryId ? '#FFF' : colors.text }]}>Ninguna</Text>
                    </TouchableOpacity>
                    {categories.map((cat) => {
                      const selected = categoryId === cat.categoryId;
                      return (
                        <TouchableOpacity
                          key={cat.categoryId}
                          onPress={() => setCategoryId(cat.categoryId)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected ? colors.button : colors.backgroundSecondary,
                              borderColor: selected ? colors.button : colors.border,
                            },
                          ]}
                          activeOpacity={0.9}
                        >
                          <Text style={[styles.chipText, { color: selected ? '#FFF' : colors.text }]}>
                            {cat.nombre}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Payer */}
            <Text style={[styles.label, { color: colors.text }]}>¿Quién pagó?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={styles.chipRow}>
                {members.map((m) => {
                  const selected = payerMemberId === m.memberId;
                  return (
                    <TouchableOpacity
                      key={m.memberId}
                      onPress={() => setPayerMemberId(m.memberId)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? colors.button : colors.backgroundSecondary,
                          borderColor: selected ? colors.button : colors.border,
                        },
                      ]}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="person-outline" size={14} color={selected ? '#FFF' : colors.text} />
                      <Text style={[styles.chipText, { color: selected ? '#FFF' : colors.text }]}>
                        {m.alias}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Split mode */}
            <Text style={[styles.label, { color: colors.text }]}>Modo de división</Text>
            <View style={styles.chipRow}>
              {SPLIT_MODES.map((m) => {
                const selected = splitMode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setSplitMode(m)}
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

            {/* Participants / split config */}
            <Text style={[styles.label, { color: colors.text }]}>Participantes</Text>
            {splits.map((s) => {
              const member = memberMap[s.memberId];
              if (!member) return null;
              return (
                <View
                  key={s.memberId}
                  style={[styles.splitRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                >
                  <TouchableOpacity
                    onPress={() => updateSplit(s.memberId, 'included', !s.included)}
                    style={{ marginRight: 10 }}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name={s.included ? 'checkbox-outline' : 'square-outline'}
                      size={20}
                      color={s.included ? colors.button : colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <Text
                    style={[styles.splitName, { color: s.included ? colors.text : colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {member.alias}
                  </Text>
                  {s.included && splitMode === 'percentage' && (
                    <TextInput
                      placeholder="%"
                      value={s.percentage}
                      onChangeText={(v) => updateSplit(s.memberId, 'percentage', v)}
                      keyboardType="decimal-pad"
                      style={[styles.splitInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.inputText }]}
                      placeholderTextColor={colors.placeholder}
                    />
                  )}
                  {s.included && splitMode === 'fixed' && (
                    <TextInput
                      placeholder="$"
                      value={s.fixed}
                      onChangeText={(v) => updateSplit(s.memberId, 'fixed', v)}
                      keyboardType="decimal-pad"
                      style={[styles.splitInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.inputText }]}
                      placeholderTextColor={colors.placeholder}
                    />
                  )}
                  {s.included && splitMode === 'equal' && (
                    <Text style={[styles.splitLabel, { color: colors.textSecondary }]}>
                      ${(parseFloat(monto || '0') / Math.max(1, splits.filter((x) => x.included).length)).toFixed(2)}
                    </Text>
                  )}
                </View>
              );
            })}

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
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                  <Text style={styles.createBtnText}>Registrar movimiento</Text>
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
    maxHeight: '92%',
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
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  splitName: { flex: 1, fontSize: 14, fontWeight: '800' },
  splitInput: {
    width: 70,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  splitLabel: { fontSize: 13, fontWeight: '700' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 14,
    marginBottom: 10,
  },
  createBtnText: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  handlePill: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
});
