import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';
import type { DeleteSubcuentaAction } from '../types/subcuentas';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (action: DeleteSubcuentaAction, note?: string) => void;
  nombre: string;
  saldo: number;
  simbolo: string;
  loading?: boolean;
};

export default function SubaccountDeleteDecisionModal({
  visible,
  onCancel,
  onSubmit,
  nombre,
  saldo,
  simbolo,
  loading = false,
}: Props) {
  const colors = useThemeColors();
  const [action, setAction] = useState<DeleteSubcuentaAction>('transfer_to_principal');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setAction('transfer_to_principal');
    setNote('');
  }, [visible]);

  const saldoText = useMemo(() => {
    const amount = Number(saldo || 0);
    const abs = Math.abs(amount);
    const formatted = abs.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${simbolo || '$'}${formatted}`;
  }, [saldo, simbolo]);

  const canSubmit = !loading;

  const submit = () => {
    if (!canSubmit) return;
    const trimmed = note.trim();
    onSubmit(action, trimmed.length > 0 ? trimmed : undefined);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <Ionicons name="warning-outline" size={40} color={colors.error} style={styles.icon} />
          <Text style={[styles.title, { color: colors.text }]}>Eliminar subcuenta</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {nombre}
          </Text>

          <View style={[styles.saldoRow, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
            <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.saldoLabel, { color: colors.textSecondary }]}>Saldo actual:</Text>
            <Text style={[styles.saldoValue, { color: colors.text }]}>{saldoText}</Text>
          </View>

          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Elige qué hacer con el saldo restante antes de eliminarla.
          </Text>

          <View style={styles.options}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setAction('transfer_to_principal')}
              style={[
                styles.option,
                {
                  borderColor: action === 'transfer_to_principal' ? colors.button : colors.border,
                  backgroundColor: action === 'transfer_to_principal' ? colors.cardSecondary : colors.card,
                },
              ]}
              disabled={loading}
            >
              <View style={styles.optionHead}>
                <Ionicons
                  name={action === 'transfer_to_principal' ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={action === 'transfer_to_principal' ? colors.button : colors.textSecondary}
                />
                <Text style={[styles.optionTitle, { color: colors.text }]}>Transferir a principal</Text>
              </View>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>Mover el saldo a tu cuenta principal y eliminar la subcuenta.</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setAction('discard')}
              style={[
                styles.option,
                {
                  borderColor: action === 'discard' ? colors.error : colors.border,
                  backgroundColor: action === 'discard' ? colors.cardSecondary : colors.card,
                },
              ]}
              disabled={loading}
            >
              <View style={styles.optionHead}>
                <Ionicons
                  name={action === 'discard' ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={action === 'discard' ? colors.error : colors.textSecondary}
                />
                <Text style={[styles.optionTitle, { color: colors.text }]}>Descartar</Text>
              </View>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>Eliminar la subcuenta y descartar el saldo (no se recupera).</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Motivo/nota (opcional)"
            placeholderTextColor={colors.placeholder}
            editable={!loading}
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: action === 'discard' ? colors.error : colors.button,
                  borderColor: action === 'discard' ? colors.error : colors.button,
                },
              ]}
              onPress={submit}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.buttonText }]}>Eliminar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.9,
  },
  saldoRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  saldoLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  saldoValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 14,
  },
  options: {
    gap: 10,
  },
  option: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
