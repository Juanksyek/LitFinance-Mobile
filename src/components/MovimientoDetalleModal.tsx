import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import SmartNumber from './SmartNumber';
import { useThemeColors } from '../theme/useThemeColors';

// Reutiliza el tipo de movimiento de subcuenta
export type SubcuentaMovimiento = any;

interface Props {
  visible: boolean;
  onClose: () => void;
  movimiento: SubcuentaMovimiento | null;
  simbolo?: string;
}

const MovimientoDetalleModal: React.FC<Props> = ({ visible, onClose, movimiento, simbolo }) => {
  const colors = useThemeColors();
  if (!movimiento) return null;

  const formatAmountPlain = (amount: number) =>
    Math.abs(amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const montoOriginal = movimiento.montoOriginal ?? movimiento.monto;
  const monedaOrigen = movimiento.moneda;
  const montoConvertido = movimiento.montoConvertido ?? movimiento.montoConvertidoCuenta ?? movimiento.montoConvertidoSubcuenta;
  const monedaConvertida = movimiento.monedaConvertida ?? movimiento.monedaConvertidaCuenta ?? movimiento.monedaConvertidaSubcuenta;
  const tasaConversion = movimiento.tasaConversion ?? movimiento.tasaConversionCuenta ?? movimiento.tasaConversionSubcuenta;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.card }]}>  
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Detalle del movimiento</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 350 }}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Descripción:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{movimiento.descripcion || movimiento.concepto || movimiento.motivo || '—'}</Text>
            </View>
            {/* Multi-currency conversion display */}
            {montoOriginal != null && monedaOrigen && montoConvertido != null && monedaConvertida ? (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Monto:</Text>
                <Text style={[styles.value, { color: movimiento.tipo === 'egreso' ? '#EF4444' : '#10B981' }]}
                >
                  {(movimiento.tipo === 'egreso' ? '-' : '+') +
                    formatAmountPlain(montoOriginal) + ' ' + monedaOrigen +
                    ' → ' +
                    formatAmountPlain(montoConvertido) + ' ' + monedaConvertida}
                </Text>
              </View>
            ) : (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Monto:</Text>
                <Text style={[styles.value, { color: movimiento.tipo === 'egreso' ? '#EF4444' : '#10B981' }]}> {(movimiento.tipo === 'egreso' ? '-' : '+') + (simbolo || '') + Math.abs(movimiento.monto ?? movimiento.montoOriginal ?? 0)} </Text>
              </View>
            )}

            {/* Show conversion rate if available */}
            {tasaConversion && monedaOrigen && monedaConvertida && (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Tasa de conversión:</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  1 {monedaOrigen} = {tasaConversion} {monedaConvertida}
                </Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Fecha:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{movimiento.fecha ? new Date(movimiento.fecha).toLocaleString() : '—'}</Text>
            </View>
            {movimiento.motivo && (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Motivo:</Text>
                <Text style={[styles.value, { color: colors.text }]}>{movimiento.motivo}</Text>
              </View>
            )}
            {movimiento.source && (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Fuente:</Text>
                <Text style={[styles.value, { color: colors.text }]}>{movimiento.source}</Text>
              </View>
            )}
            {movimiento.transaccionId && (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>ID Transacción:</Text>
                <Text style={[styles.value, { color: colors.text }]}>{movimiento.transaccionId}</Text>
              </View>
            )}
            {/* Puedes agregar más campos relevantes aquí */}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '90%',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1.2,
    textAlign: 'right',
  },
});

export default MovimientoDetalleModal;
