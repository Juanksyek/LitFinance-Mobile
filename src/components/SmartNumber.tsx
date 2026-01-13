import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, FormatOptions } from '../utils/numberFormatter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
// Eliminado: CurrencyChangeModal y CurrencyField
import { useThemeColors } from '../theme/useThemeColors';

interface SmartNumberProps {
  value: number;
  options?: FormatOptions;
  style?: any;
  textStyle?: any;
  showWarnings?: boolean;
  allowTooltip?: boolean;
  color?: string;
  // Eliminado: props de cambio de moneda
}

const { width } = Dimensions.get('window');

const SmartNumber: React.FC<SmartNumberProps> = ({
  value,
  options = {},
  style,
  textStyle,
  showWarnings = false,
  allowTooltip = true,
  color,
}) => {
  const colors = useThemeColors();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [showFullNumbers, setShowFullNumbers] = useState(false);
  const effectiveColor = color || colors.text;

  useEffect(() => {
    loadNumberPreference();
    
    // Listener para cambios en la preferencia
    const checkInterval = setInterval(() => {
      loadNumberPreference();
    }, 500);
    
    return () => clearInterval(checkInterval);
  }, []);

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
    if (shouldShowTooltip) {
      setTooltipVisible(true);
    }
  };

  const getWarningColor = () => {
    if (result.warnings.some(w => w.includes('excede límites'))) return '#EF4444';
    if (result.warnings.some(w => w.includes('muy grande'))) return '#F59E0B';
    return effectiveColor;
  };

  // Eliminado: lógica de cambio de moneda y conversión

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
        <View style={[styles.tooltipContainer, { backgroundColor: colors.card }]}>
          <View style={[styles.tooltipHeader, { borderBottomColor: colors.border }]}>
            <Ionicons name="calculator" size={20} color="#4CAF50" />
            <Text style={[styles.tooltipTitle, { color: colors.text }]}>Información del Número</Text>
            <TouchableOpacity onPress={() => setTooltipVisible(false)}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tooltipContent}>
            <View style={styles.tooltipSection}>
              <Text style={[styles.tooltipLabel, { color: colors.textSecondary }]}>Valor mostrado:</Text>
              <Text style={[styles.tooltipValue, { color: colors.text }]}>{result.formatted}</Text>
            </View>

            <View style={styles.tooltipSection}>
              <Text style={[styles.tooltipLabel, { color: colors.textSecondary }]}>Valor completo:</Text>
              <Text style={[styles.tooltipValue, styles.fullValueText, { color: colors.text, backgroundColor: colors.inputBackground }]}>{result.fullValue}</Text>
            </View>

            {result.scientific && (
              <View style={styles.tooltipSection}>
                <Text style={[styles.tooltipLabel, { color: colors.textSecondary }]}>Notación científica:</Text>
                <Text style={[styles.tooltipValue, styles.scientificText]}>{result.scientific}</Text>
              </View>
            )}

            <View style={styles.infoGrid}>
              <View style={[styles.infoItem, { backgroundColor: colors.inputBackground }]}>
                <Text style={[styles.infoItemLabel, { color: colors.textSecondary }]}>Estado:</Text>
                <Text
                  style={[
                    styles.infoItemValue,
                    { color: result.isLarge ? '#F59E0B' : '#4CAF50' },
                  ]}
                >
                  {result.isLarge ? 'Número grande' : 'Normal'}
                </Text>
              </View>

              <View style={[styles.infoItem, { backgroundColor: colors.inputBackground }]}>
                <Text style={[styles.infoItemLabel, { color: colors.textSecondary }]}>Formato:</Text>
                <Text style={[styles.infoItemValue, { color: colors.text }]}>
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
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                onPress={() => setTooltipVisible(false)}
              >
                <Ionicons name="checkmark" size={16} color={colors.textSecondary} />
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.numberContainer}>
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
      </View>

      {tooltipVisible && renderTooltip()}

      {/* Eliminado: Modal de cambio de moneda y confirmación/conversión */}
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
    borderRadius: 16, width: width * 0.9, maxWidth: 400,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 16,
  },
  tooltipHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1,
  },
  tooltipTitle: { fontSize: 18, fontWeight: '700', flex: 1, marginLeft: 12 },
  tooltipContent: { padding: 20 },
  tooltipSection: { marginBottom: 16 },
  tooltipLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  tooltipValue: { fontSize: 16, fontWeight: '700' },
  fullValueText: { fontFamily: 'monospace', padding: 8, borderRadius: 6 },
  scientificText: { fontFamily: 'monospace', color: '#7C3AED' },
  infoGrid: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  infoItem: { flex: 1, padding: 12, borderRadius: 8 },
  infoItemLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  infoItemValue: { fontSize: 14, fontWeight: '600' },
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
    padding: 12, borderRadius: 8, borderWidth: 1,
  },
  actionButtonText: { fontSize: 14, fontWeight: '600', marginLeft: 6 },
  currencyActionButton: { borderColor: '#667EEA', borderWidth: 1 },

  // Encabezado del modal de picker
  currencyModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1,
  },
  currencyModalTitle: { fontSize: 20, fontWeight: '700' },
  exchangeDisclaimer: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
});

export default SmartNumber;
