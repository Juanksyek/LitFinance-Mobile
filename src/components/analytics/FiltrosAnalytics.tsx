import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import type { FiltrosAnalytics, RangoTiempo, TipoTransaccion } from '../../types/analytics';

interface FiltrosAnalyticsProps {
  filtros: FiltrosAnalytics;
  onFiltrosChange: (filtros: FiltrosAnalytics) => void;
}

const FiltrosAnalyticsComponent: React.FC<FiltrosAnalyticsProps> = ({
  filtros,
  onFiltrosChange
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const rangosDisponibles: { key: RangoTiempo; label: string }[] = [
    { key: 'dia', label: 'Hoy' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'mes', label: 'Este mes' },
    { key: '3meses', label: 'Últimos 3 meses' },
    { key: '6meses', label: 'Últimos 6 meses' },
    { key: 'año', label: 'Este año' },
  ];

  const tiposTransaccion: { key: TipoTransaccion; label: string }[] = [
    { key: 'ambos', label: 'Ambos' },
    { key: 'ingreso', label: 'Solo Ingresos' },
    { key: 'egreso', label: 'Solo Gastos' },
  ];

  const getRangoLabel = (rango?: RangoTiempo): string => {
    return rangosDisponibles.find(r => r.key === rango)?.label || 'Este mes';
  };

  const getTipoTransaccionLabel = (tipo?: TipoTransaccion): string => {
    return tiposTransaccion.find(t => t.key === tipo)?.label || 'Ambos';
  };

  const handleRangoChange = (rango: RangoTiempo) => {
    onFiltrosChange({ ...filtros, rangoTiempo: rango });
  };

  const handleTipoTransaccionChange = (tipo: TipoTransaccion) => {
    onFiltrosChange({ ...filtros, tipoTransaccion: tipo });
  };

  const handleIncluirRecurrentesChange = () => {
    onFiltrosChange({ ...filtros, incluirRecurrentes: !filtros.incluirRecurrentes });
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.filterButtonText}>📊 {getRangoLabel(filtros.rangoTiempo)}</Text>
          <Text style={styles.filterButtonSubtext}>{getTipoTransaccionLabel(filtros.tipoTransaccion)}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filtros de Analytics</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.doneButton}>Listo</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Rango de Tiempo */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Periodo de Tiempo</Text>
              {rangosDisponibles.map((rango) => (
                <TouchableOpacity
                  key={rango.key}
                  style={[
                    styles.optionItem,
                    filtros.rangoTiempo === rango.key && styles.selectedOption
                  ]}
                  onPress={() => handleRangoChange(rango.key)}
                >
                  <Text style={[
                    styles.optionText,
                    filtros.rangoTiempo === rango.key && styles.selectedOptionText
                  ]}>
                    {rango.label}
                  </Text>
                  {filtros.rangoTiempo === rango.key && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Tipo de Transacción */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tipo de Transacción</Text>
              {tiposTransaccion.map((tipo) => (
                <TouchableOpacity
                  key={tipo.key}
                  style={[
                    styles.optionItem,
                    filtros.tipoTransaccion === tipo.key && styles.selectedOption
                  ]}
                  onPress={() => handleTipoTransaccionChange(tipo.key)}
                >
                  <Text style={[
                    styles.optionText,
                    filtros.tipoTransaccion === tipo.key && styles.selectedOptionText
                  ]}>
                    {tipo.label}
                  </Text>
                  {filtros.tipoTransaccion === tipo.key && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Opciones Adicionales */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Opciones Adicionales</Text>
              
              <TouchableOpacity
                style={styles.toggleItem}
                onPress={handleIncluirRecurrentesChange}
              >
                <Text style={styles.toggleText}>Incluir Recurrentes</Text>
                <View style={[
                  styles.toggle,
                  filtros.incluirRecurrentes && styles.toggleActive
                ]}>
                  {filtros.incluirRecurrentes && (
                    <View style={styles.toggleIndicator} />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  filterButtonSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: '#EBF4FF',
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  optionText: {
    fontSize: 16,
    color: '#1F2937',
  },
  selectedOptionText: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 16,
    color: '#1F2937',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#3B82F6',
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
  },
});

export default FiltrosAnalyticsComponent;
