import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SmartNumber from './SmartNumber';

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
};

type Props = {
  visible: boolean;
  onClose: () => void;
  historialItem: HistorialItem | null;
};

const HistorialDetalleModal = ({ visible, onClose, historialItem }: Props) => {
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
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name={iconoTipo} size={24} color={colorTipo} style={styles.tipoIcon} />
              <Text style={styles.title}>Detalle del Movimiento</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>Descripción</Text>
              <Text style={styles.value}>{descripcion}</Text>
            </View>

            {detalles.conceptoNombre && (
              <View style={styles.section}>
                <Text style={styles.label}>Concepto</Text>
                <Text style={styles.value}>{detalles.conceptoNombre}</Text>
              </View>
            )}

            {motivo && (
            <View style={styles.section}>
                <Text style={styles.label}>Motivo</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="chatbox-ellipses-outline" size={16} color="#0f172a" style={{ marginRight: 6 }} />
                <Text style={styles.value}>{motivo}</Text>
                </View>
            </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Monto</Text>
              {/* ✅ NUEVO: SmartNumber en lugar de toFixed para cifras grandes */}
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
              <Text style={styles.label}>Tipo</Text>
              <Text style={styles.value}>{tipo}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Fecha</Text>
              <Text style={styles.value}>{new Date(fecha).toLocaleString()}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Cuenta</Text>
              <Text style={styles.value}>{cuentaId}</Text>
            </View>

            {subcuentaId && (
              <View style={styles.section}>
                <Text style={styles.label}>Subcuenta</Text>
                <Text style={styles.value}>{subcuentaId}</Text>
              </View>
            )}

            {detalles.origen && (
              <View style={styles.section}>
                <Text style={styles.label}>Origen</Text>
                <Text style={styles.value}>{detalles.origen}</Text>
              </View>
            )}

            {detalles.etiqueta && (
              <View style={styles.section}>
                <Text style={styles.label}>Etiqueta</Text>
                <Text style={styles.value}>{detalles.etiqueta}</Text>
              </View>
            )}

            {detalles.resumen && (
              <View style={styles.section}>
                <Text style={styles.label}>Resumen</Text>
                <Text style={styles.value}>{detalles.resumen}</Text>
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
    backgroundColor: '#f8fafc',
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
    color: '#1e293b',
  },
  section: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#0f172a',
  },
});