import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, FormatOptions } from '../utils/numberFormatter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import CurrencyChangeModal from './CurrencyChangeModal';
import { CurrencyField, Moneda } from '../components/CurrencyPicker'; // ✅ reutilizable

interface SmartNumberProps {
  value: number;
  options?: FormatOptions;
  style?: any;
  textStyle?: any;
  showWarnings?: boolean;
  allowTooltip?: boolean;
  color?: string;
  allowCurrencyChange?: boolean;
  currentCurrency?: string;
  onCurrencyChange?: (newCurrency: string) => void;
  refreshPreferences?: number;
}

const { width } = Dimensions.get('window');

const SmartNumber: React.FC<SmartNumberProps> = ({
  value,
  options = {},
  style,
  textStyle,
  showWarnings = true,
  allowTooltip = true,
  color = '#1E293B',
  allowCurrencyChange = false,
  currentCurrency = 'MXN',
  onCurrencyChange,
  refreshPreferences = 0
}) => {
  // Tooltip
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Picker (usaremos CurrencyField dentro de un modal simple)
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedMonedaObj, setSelectedMonedaObj] = useState<Moneda | null>(null);

  // Confirmación/cambio
  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState('');

  // Preferencia de números completos/compactos
  const [showFullNumbers, setShowFullNumbers] = useState(false);

  useEffect(() => {
    loadNumberPreference();
  }, []);

  useEffect(() => {
    if (refreshPreferences > 0) loadNumberPreference();
  }, [refreshPreferences]);

  const loadNumberPreference = async () => {
    try {
      const preference = await AsyncStorage.getItem('showFullNumbers');
      setShowFullNumbers(preference === 'true');
    } catch (error) {
      console.error('Error cargando preferencia de números en SmartNumber:', error);
    }
  };

  // Formateo del valor
  const result = formatCurrency(value, {
    ...options,
    forceFullNumbers: showFullNumbers,
  });

  const hasWarnings = result.warnings.length > 0;
  const shouldShowTooltip = allowTooltip && (result.isTruncated || result.isLarge || hasWarnings);

  const handlePress = () => {
    if (allowCurrencyChange) {
      setPickerVisible(true);
    } else if (shouldShowTooltip) {
      setTooltipVisible(true);
    }
  };

  const getWarningColor = () => {
    if (result.warnings.some(w => w.includes('excede límites'))) return '#EF4444';
    if (result.warnings.some(w => w.includes('muy grande'))) return '#F59E0B';
    return color;
  };

  // ✅ Cuando el usuario elige moneda en el CurrencyField
  const handleMonedaChange = (m: Moneda) => {
    // Si es la misma, no hacemos nada
    if (m?.codigo === currentCurrency) {
      setPickerVisible(false);
      return;
    }
    setSelectedMonedaObj(m);
    setSelectedCurrencyCode(m.codigo);
    setPickerVisible(false);
    setChangeModalVisible(true); // abre confirmación/conversión
  };

  // ✅ Éxito de conversión
  const handleCurrencyChangeSuccess = (result: any) => {
    if (onCurrencyChange) onCurrencyChange(result?.cuenta?.moneda);
    Toast.show({
      type: 'success',
      text1: 'Conversión Exitosa',
      text2: `Se convirtieron ${result?.conversion?.summary?.totalElementos ?? 0} elementos`,
    });
  };

  // Tooltip UI
  const renderTooltip = () => (
    <Modal
      visible={tooltipVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setTooltipVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setTooltipVisible(false)}
      >
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltipHeader}>
            <Ionicons name="calculator" size={20} color="#4CAF50" />
            <Text style={styles.tooltipTitle}>Información del Número</Text>
            <TouchableOpacity onPress={() => setTooltipVisible(false)}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.tooltipContent}>
            <View style={styles.tooltipSection}>
              <Text style={styles.tooltipLabel}>Valor mostrado:</Text>
              <Text style={styles.tooltipValue}>{result.formatted}</Text>
            </View>

            <View style={styles.tooltipSection}>
              <Text style={styles.tooltipLabel}>Valor completo:</Text>
              <Text style={[styles.tooltipValue, styles.fullValueText]}>{result.fullValue}</Text>
            </View>

            {result.scientific && (
              <View style={styles.tooltipSection}>
                <Text style={styles.tooltipLabel}>Notación científica:</Text>
                <Text style={[styles.tooltipValue, styles.scientificText]}>{result.scientific}</Text>
              </View>
            )}

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoItemLabel}>Estado:</Text>
                <Text
                  style={[
                    styles.infoItemValue,
                    { color: result.isLarge ? '#F59E0B' : '#4CAF50' },
                  ]}
                >
                  {result.isLarge ? 'Número grande' : 'Normal'}
                </Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoItemLabel}>Formato:</Text>
                <Text style={styles.infoItemValue}>
                  {result.isTruncated ? 'Compacto' : 'Completo'}
                </Text>
              </View>
            </View>

            {showWarnings && hasWarnings && (
              <View style={styles.warningsContainer}>
                <View style={styles.warningHeader}>
                  <Ionicons name="warning" size={16} color="#F59E0B" />
                  <Text style={styles.warningTitle}>Advertencias:</Text>
                </View>
                {result.warnings.map((warning, index) => (
                  <View key={index} style={styles.warningItem}>
                    <Ionicons name="alert-circle-outline" size={12} color="#F59E0B" />
                    <Text style={styles.warningText}>{warning}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actionButtons}>
              {allowCurrencyChange && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.currencyActionButton]}
                  onPress={() => {
                    setTooltipVisible(false);
                    setPickerVisible(true);
                  }}
                >
                  <Ionicons name="swap-horizontal" size={16} color="#667EEA" />
                  <Text style={[styles.actionButtonText, { color: '#667EEA' }]}>
                    Cambiar Moneda
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setTooltipVisible(false)}
              >
                <Ionicons name="checkmark" size={16} color="#64748B" />
                <Text style={styles.actionButtonText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={!shouldShowTooltip && !allowCurrencyChange}
        activeOpacity={shouldShowTooltip || allowCurrencyChange ? 0.7 : 1}
        style={styles.numberContainer}
      >
        <Text style={[styles.numberText, textStyle, { color: getWarningColor() }]}>
          {result.formatted}
        </Text>

        {shouldShowTooltip && (
          <View style={styles.indicatorContainer}>
            {result.isTruncated && (
              <Ionicons name="ellipsis-horizontal" size={12} color="#94A3B8" />
            )}
            {hasWarnings && (
              <Ionicons name="warning" size={12} color={getWarningColor()} style={{ marginLeft: 2 }} />
            )}
          </View>
        )}
      </TouchableOpacity>

      {tooltipVisible && renderTooltip()}

      {/* ✅ Modal simple que contiene el CurrencyField reutilizable */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.currencyModalHeader}>
            <Text style={styles.currencyModalTitle}>Cambiar Moneda</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <CurrencyField
              label="Selecciona la moneda"
              value={selectedMonedaObj}
              onChange={handleMonedaChange}
              showSearch
              currentCode={currentCurrency}
            />
          </View>

          <View style={{ padding: 20 }}>
            <Text style={styles.exchangeDisclaimer}>
              💡 La conversión se realizará automáticamente en el servidor.
            </Text>
          </View>
        </View>
      </Modal>

      {/* ✅ Confirmación/conversión */}
      <CurrencyChangeModal
        visible={changeModalVisible}
        newCurrency={selectedCurrencyCode}
        onClose={() => setChangeModalVisible(false)}
        onSuccess={handleCurrencyChangeSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative' },
  numberContainer: { flexDirection: 'row', alignItems: 'center' },
  numberText: { fontSize: 16, fontWeight: '600' },
  indicatorContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  tooltipContainer: {
    backgroundColor: 'white', borderRadius: 16, width: width * 0.9, maxWidth: 400,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 16,
  },
  tooltipHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  tooltipTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', flex: 1, marginLeft: 12 },
  tooltipContent: { padding: 20 },
  tooltipSection: { marginBottom: 16 },
  tooltipLabel: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  tooltipValue: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  fullValueText: { fontFamily: 'monospace', backgroundColor: '#F1F5F9', padding: 8, borderRadius: 6 },
  scientificText: { fontFamily: 'monospace', color: '#7C3AED' },
  infoGrid: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  infoItem: { flex: 1, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8 },
  infoItemLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  infoItemValue: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  warningsContainer: {
    backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#F59E0B',
  },
  warningHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  warningTitle: { fontSize: 14, fontWeight: '600', color: '#92400E', marginLeft: 6 },
  warningItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  warningText: { fontSize: 12, color: '#92400E', marginLeft: 6, flex: 1, lineHeight: 16 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 12, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: '#475569', marginLeft: 6 },
  currencyActionButton: { borderColor: '#667EEA', borderWidth: 1 },

  // Encabezado del modal de picker
  currencyModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: 'white',
  },
  currencyModalTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  exchangeDisclaimer: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
});

export default SmartNumber;
