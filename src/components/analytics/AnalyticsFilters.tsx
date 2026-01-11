import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnalyticsFilters as IAnalyticsFilters } from '../../services/analyticsService';
import { useThemeColors } from '../../theme/useThemeColors';

interface AnalyticsFiltersProps {
  filters: IAnalyticsFilters;
  onApply: (filters: IAnalyticsFilters) => void;
  onClose: () => void;
}

const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  filters,
  onApply,
  onClose,
}) => {
  const colors = useThemeColors();
  const [localFilters, setLocalFilters] = useState<IAnalyticsFilters>(filters);

  const rangoTiempoOptions = [
    { value: 'dia', label: 'Hoy' },
    { value: 'semana', label: 'Esta semana' },
    { value: 'mes', label: 'Este mes' },
    { value: '3meses', label: 'Últimos 3 meses' },
    { value: '6meses', label: 'Últimos 6 meses' },
    { value: 'año', label: 'Este año' },
  ];

  const tipoTransaccionOptions = [
    { value: 'ambos', label: 'Todos' },
    { value: 'ingreso', label: 'Solo ingresos' },
    { value: 'egreso', label: 'Solo gastos' },
  ];

  const handleApply = () => {
    onApply(localFilters);
  };

  const updateFilter = (key: keyof IAnalyticsFilters, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Filtros</Text>
          <TouchableOpacity onPress={handleApply} style={styles.applyButton}>
            <Text style={styles.applyText}>Aplicar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Rango de tiempo</Text>
            {rangoTiempoOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  { backgroundColor: colors.card },
                  localFilters.rangoTiempo === option.value && styles.selectedOption
                ]}
                onPress={() => updateFilter('rangoTiempo', option.value)}
              >
                <Text style={[
                  styles.optionText,
                  { color: colors.textSecondary },
                  localFilters.rangoTiempo === option.value && styles.selectedOptionText
                ]}>
                  {option.label}
                </Text>
                {localFilters.rangoTiempo === option.value && (
                  <Ionicons name="checkmark" size={20} color="#6366f1" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tipo de transacción</Text>
            {tipoTransaccionOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  { backgroundColor: colors.card },
                  localFilters.tipoTransaccion === option.value && styles.selectedOption
                ]}
                onPress={() => updateFilter('tipoTransaccion', option.value)}
              >
                <Text style={[
                  styles.optionText,
                  { color: colors.textSecondary },
                  localFilters.tipoTransaccion === option.value && styles.selectedOptionText
                ]}>
                  {option.label}
                </Text>
                {localFilters.tipoTransaccion === option.value && (
                  <Ionicons name="checkmark" size={20} color="#6366f1" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Opciones adicionales</Text>
            
            <View style={[styles.switchOption, { backgroundColor: colors.card }]}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Incluir recurrentes</Text>
              <Switch
                value={localFilters.incluirRecurrentes || false}
                onValueChange={(value) => updateFilter('incluirRecurrentes', value)}
                trackColor={{ false: colors.border, true: '#6366f1' }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={[styles.switchOption, { backgroundColor: colors.card }]}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Solo transacciones manuales</Text>
              <Switch
                value={localFilters.soloTransaccionesManuales || false}
                onValueChange={(value) => updateFilter('soloTransaccionesManuales', value)}
                trackColor={{ false: colors.border, true: '#6366f1' }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={[styles.switchOption, { backgroundColor: colors.card }]}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Incluir subcuentas inactivas</Text>
              <Switch
                value={localFilters.incluirSubcuentasInactivas || false}
                onValueChange={(value) => updateFilter('incluirSubcuentasInactivas', value)}
                trackColor={{ false: colors.border, true: '#6366f1' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  applyButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  applyText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: '#f0f9ff',
    borderColor: '#6366f1',
    borderWidth: 1,
  },
  optionText: {
    fontSize: 14,
  },
  selectedOptionText: {
    color: '#6366f1',
    fontWeight: '500',
  },
  switchOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 14,
  },
});

export default AnalyticsFilters;
