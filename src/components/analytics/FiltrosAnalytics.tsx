import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import type { FiltrosAnalytics, RangoTiempo, TipoTransaccion } from '../../types/analytics';
import { useThemeColors } from '../../theme/useThemeColors';

interface FiltrosAnalyticsProps {
  filtros: FiltrosAnalytics;
  onFiltrosChange: (filtros: FiltrosAnalytics) => void;
}

const FiltrosAnalyticsComponent: React.FC<FiltrosAnalyticsProps> = ({
  filtros,
  onFiltrosChange
}) => {
  const colors = useThemeColors();
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
          style={[styles.filterButton, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
          onPress={() => setModalVisible(true)}
        >
          <Text style={[styles.filterButtonText, { color: colors.text }]}>📊 {getRangoLabel(filtros.rangoTiempo)}</Text>
          <Text style={[styles.filterButtonSubtext, { color: colors.textSecondary }]}>{getTipoTransaccionLabel(filtros.tipoTransaccion)}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={[styles.cancelButton, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filtros de Analytics</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={[styles.doneButton, { color: colors.button }]}>Listo</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Rango de Tiempo */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Periodo de Tiempo</Text>
              {rangosDisponibles.map((rango) => (
                <TouchableOpacity
                  key={rango.key}
                  style={[
                    styles.optionItem,
                    { backgroundColor: colors.card },
                    filtros.rangoTiempo === rango.key && [styles.selectedOption, { backgroundColor: colors.inputBackground, borderColor: colors.button }]
                  ]}
                  onPress={() => handleRangoChange(rango.key)}
                >
                  <Text style={[
                    styles.optionText,
                    { color: colors.text },
                    filtros.rangoTiempo === rango.key && [styles.selectedOptionText, { color: colors.button }]
                  ]}>
                    {rango.label}
                  </Text>
                  {filtros.rangoTiempo === rango.key && (
                    <Text style={[styles.checkmark, { color: colors.button }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Tipo de Transacción */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Tipo de Transacción</Text>
              {tiposTransaccion.map((tipo) => (
                <TouchableOpacity
                  key={tipo.key}
                  style={[
                    styles.optionItem,
                    { backgroundColor: colors.card },
                    filtros.tipoTransaccion === tipo.key && [styles.selectedOption, { backgroundColor: colors.inputBackground, borderColor: colors.button }]
                  ]}
                  onPress={() => handleTipoTransaccionChange(tipo.key)}
                >
                  <Text style={[
                    styles.optionText,
                    { color: colors.text },
                    filtros.tipoTransaccion === tipo.key && [styles.selectedOptionText, { color: colors.button }]
                  ]}>
                    {tipo.label}
                  </Text>
                  {filtros.tipoTransaccion === tipo.key && (
                    <Text style={[styles.checkmark, { color: colors.button }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Opciones Adicionales */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Opciones Adicionales</Text>
              
              <TouchableOpacity
                style={[styles.toggleItem, { backgroundColor: colors.card }]}
                onPress={handleIncluirRecurrentesChange}
              >
                <Text style={[styles.toggleText, { color: colors.text }]}>Incluir Recurrentes</Text>
                <View style={[
                  styles.toggle,
                  { backgroundColor: filtros.incluirRecurrentes ? colors.button : colors.border }
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
    borderRadius: 12,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterButtonSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  cancelButton: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 12,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedOption: {
    borderWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
  selectedOptionText: {
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 16,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {},
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
  },
});

export default FiltrosAnalyticsComponent;
// commit