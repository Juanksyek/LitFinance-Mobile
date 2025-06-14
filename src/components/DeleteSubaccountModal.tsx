import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteSubaccountModal({ visible, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Ionicons name="warning-outline" size={42} color="#EF4444" style={styles.icon} />
          <Text style={styles.title}>Eliminar subcuenta</Text>
          <Text style={styles.message}>
            ¿Estás seguro de que deseas eliminar esta subcuenta? Esta acción no se puede deshacer.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onCancel}>
              <Text style={[styles.buttonText, { color: '#374151' }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.delete]} onPress={onConfirm}>
              <Text style={[styles.buttonText, { color: '#EF4444' }]}>Eliminar</Text>
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
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  cancel: {
    borderColor: '#D1D5DB',
    backgroundColor: '#f9fafb',
  },
  delete: {
    borderColor: '#EF4444',
    backgroundColor: '#fef2f2',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
