import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import SmartNumber from './SmartNumber';
import { useThemeColors } from '../theme/useThemeColors';

type Detalles = {
  origen?: string;
  etiqueta?: string;
  resumen?: string;
  conceptoNombre?: string;
  [key: string]: any;
};

type HistorialItem = {
  id: string;
  descripcion: string;
  monto: number;
  tipo: string;
  fecha: string;
  cuentaId: string;
  subcuentaId?: string;
  metadata?: any;
  detalles?: Detalles;
  motivo?: string;
  conceptoId?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  historialItem: HistorialItem | null;
};

const HistorialDetalleModal = ({ visible, onClose, historialItem }: Props) => {
  const colors = useThemeColors();
  
  if (!historialItem) return null;

  const {
    descripcion,
    monto,
    tipo,
    fecha,
    cuentaId,
    subcuentaId,
    detalles = {},
    motivo,
    conceptoId, // <-- agregar aquí
  } = historialItem;

  const iconoTipo = tipo === 'ingreso'
    ? 'arrow-down-circle'
    : tipo === 'egreso'
    ? 'arrow-up-circle'
    : tipo === 'recurrente'
    ? 'repeat'
    : 'info';

  const colorTipo = tipo === 'ingreso' ? '#16a34a' : tipo === 'egreso' ? '#dc2626' : '#0ea5e9';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name={iconoTipo} size={24} color={colorTipo} style={styles.tipoIcon} />
              <Text style={[styles.title, { color: colors.text }]}>Detalle del Movimiento</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Descripción</Text>
              <Text style={[styles.value, { color: colors.text }]}>{descripcion}</Text>
            </View>

            {conceptoId && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Concepto ID</Text>
                <Text style={[styles.value, { color: colors.text }]}>{conceptoId}</Text>
              </View>
            )}

            {detalles.conceptoNombre && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Concepto</Text>
                <Text style={[styles.value, { color: colors.text }]}>{detalles.conceptoNombre}</Text>
              </View>
            )}

            {motivo && (
            <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Motivo</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
                <Text style={[styles.value, { color: colors.text }]}>{motivo}</Text>
                </View>
            </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Monto</Text>
              <Text style={[styles.value, { color: colorTipo }]}>
                <SmartNumber 
                  value={monto} 
                  options={{ 
                    context: 'detail', 
                    symbol: '$',
                    maxLength: 12 
                  }}
                  textStyle={[styles.value, { color: colorTipo }]}
                />
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Tipo</Text>
              <Text style={[styles.value, { color: colors.text }]}>{tipo}</Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Fecha</Text>
              <Text style={[styles.value, { color: colors.text }]}>{new Date(fecha).toLocaleString()}</Text>
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Cuenta</Text>
              <Text style={[styles.value, { color: colors.text }]}>{cuentaId}</Text>
            </View>

            {subcuentaId && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Subcuenta</Text>
                <Text style={[styles.value, { color: colors.text }]}>{subcuentaId}</Text>
              </View>
            )}

            {detalles.origen && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Origen</Text>
                <Text style={[styles.value, { color: colors.text }]}>{detalles.origen}</Text>
              </View>
            )}

            {detalles.etiqueta && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Etiqueta</Text>
                <Text style={[styles.value, { color: colors.text }]}>{detalles.etiqueta}</Text>
              </View>
            )}

            {detalles.resumen && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Resumen</Text>
                <Text style={[styles.value, { color: colors.text }]}>{detalles.resumen}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default HistorialDetalleModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipoIcon: {
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
  },
});
