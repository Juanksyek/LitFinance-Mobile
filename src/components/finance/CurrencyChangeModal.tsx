import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../theme/useThemeColors';
import { financeService, type CurrencyChangePreview, type CurrencyChangeResult } from '../../services/financeService';
import { logger } from '../../shared/monitoring/logger';

interface CurrencyChangeModalProps {
  visible: boolean;
  newCurrency: string;
  onClose: () => void;
  onSuccess: (result: CurrencyChangeResult) => void;
}

const CurrencyChangeModal: React.FC<CurrencyChangeModalProps> = ({
  visible,
  newCurrency,
  onClose,
  onSuccess,
}) => {
  const colors = useThemeColors();
  const [preview, setPreview] = useState<CurrencyChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [step, setStep] = useState<'preview' | 'confirm' | 'result'>('preview');
  const [intentosRestantes, setIntentosRestantes] = useState<number | null>(null);

  useEffect(() => {
    if (visible && newCurrency) {
      loadPreview();
    }
  }, [visible, newCurrency]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      const data = await financeService.previewCurrencyChange(newCurrency);
      setPreview(data);
      setIntentosRestantes(data.intentosRestantes);
    } catch (error) {
      logger.warn('[CurrencyChangeModal] Error loading preview', {
        message: (error as any)?.message,
      });
      Toast.show({
        type: 'error',
        text1: 'Error al obtener vista previa',
        text2: (error as any)?.message || 'No se pudo cargar la información del cambio',
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const showConfirmation = () => {
    Alert.alert(
      '⚠️ Cambio de Moneda Base',
      `Esta operación convertirá TODO tu historial financiero a ${newCurrency}.\n\n` +
      `• Se convertirán ${preview?.elementosAfectados.total} elementos\n` +
      `• Las subcuentas NO se verán afectadas\n` +
      `• Esta operación NO es reversible\n\n` +
      '¿Estás seguro de continuar?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: executeCurrencyChange,
        },
      ]
    );
  };

  const executeCurrencyChange = async () => {
    try {
      setConverting(true);
      const result = await financeService.changeMainCurrency(newCurrency);
      setIntentosRestantes(result.intentosRestantes);

      Toast.show({
        type: 'success',
        text1: 'Conversión Exitosa',
        text2: `Moneda cambiada a ${newCurrency}. Intentos restantes: ${result.intentosRestantes}`,
      });

      onSuccess(result);
      onClose();
    } catch (error) {
      logger.warn('[CurrencyChangeModal] Error executing currency change', {
        newCurrency,
        message: (error as any)?.message,
      });
      Toast.show({
        type: 'error',
        text1: 'Error en la conversión',
        text2: (error as any)?.message || 'No se pudo completar la conversión',
      });
    } finally {
      setConverting(false);
    }
  };

  const renderPreview = () => (
    <ScrollView style={styles.content}>
      <View style={styles.header}>
        <Ionicons name="swap-horizontal" size={32} color="#667EEA" />
        <Text style={[styles.title, { color: colors.text }]}>Vista Previa del Cambio</Text>
      </View>

      <View style={[styles.conversionInfo, { backgroundColor: colors.cardSecondary }]}>
        <View style={styles.currencyRow}>
          <Text style={[styles.fromCurrency, { color: colors.textSecondary }]}>{preview?.monedaActual}</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
          <Text style={[styles.toCurrency, { color: '#667EEA' }]}>{preview?.nuevaMoneda}</Text>
        </View>
        <Text style={[styles.exchangeRate, { color: colors.textSecondary }]}>
          Tasa de cambio: 1 {preview?.monedaActual} = {preview?.tasaCambio} {preview?.nuevaMoneda}
        </Text>
      </View>

      <View style={styles.affectedItemsContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Elementos que serán convertidos:</Text>
        
        <View style={styles.itemRow}>
          <Ionicons name="wallet" size={20} color="#4CAF50" />
          <Text style={[styles.itemText, { color: colors.textSecondary }]}>Cuenta principal</Text>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
        </View>
        
        <View style={styles.itemRow}>
          <Ionicons name="list" size={20} color="#4CAF50" />
          <Text style={[styles.itemText, { color: colors.textSecondary }]}>
            {preview?.elementosAfectados.transacciones} transacciones
          </Text>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
        </View>
        
        <View style={styles.itemRow}>
          <Ionicons name="time" size={20} color="#4CAF50" />
          <Text style={[styles.itemText, { color: colors.textSecondary }]}>
            {preview?.elementosAfectados.historialCuenta} registros de historial
          </Text>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
        </View>
        
        <View style={styles.itemRow}>
          <Ionicons name="repeat" size={20} color="#4CAF50" />
          <Text style={[styles.itemText, { color: colors.textSecondary }]}>
            {preview?.elementosAfectados.recurrentes} pagos recurrentes
          </Text>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
        </View>

        <View style={[styles.totalRow, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.totalText, { color: colors.text }]}>
            Total: {preview?.elementosAfectados.total} elementos
          </Text>
        </View>
      </View>

      {intentosRestantes !== null && (
        <View style={styles.attemptsContainer}>
          <Text style={styles.attemptsText}>
            Intentos realizados: {3 - intentosRestantes}, Intentos restantes: {intentosRestantes}.
          </Text>
        </View>
      )}

      <View style={styles.warningContainer}>
        <Ionicons name="warning" size={24} color="#F59E0B" />
        <Text style={styles.warningText}>{preview?.advertencia}</Text>
      </View>

      <View style={styles.notAffectedContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>NO se verán afectadas:</Text>
        <View style={styles.itemRow}>
          <Ionicons name="business" size={20} color="#94A3B8" />
          <Text style={styles.itemTextDisabled}>Subcuentas</Text>
          <Ionicons name="close-circle" size={20} color="#94A3B8" />
        </View>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Cambio de Moneda</Text>
          <TouchableOpacity onPress={onClose} disabled={converting}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667EEA" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando vista previa...</Text>
          </View>
        ) : converting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667EEA" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Convirtiendo moneda... Esto puede tomar unos momentos
            </Text>
            <Text style={[styles.loadingSubtext, { color: colors.textTertiary }]}>
              Por favor no cierres la aplicación
            </Text>
          </View>
        ) : (
          <>
            {renderPreview()}
            
            <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: colors.cardSecondary }]}
                onPress={onClose}
                disabled={converting}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={showConfirmation}
                disabled={converting || !preview}
              >
                <Text style={styles.confirmButtonText}>Cambiar Moneda</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  conversionInfo: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fromCurrency: {
    fontSize: 24,
    fontWeight: '700',
    marginRight: 16,
  },
  toCurrency: {
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 16,
  },
  exchangeRate: {
    fontSize: 14,
    textAlign: 'center',
  },
  affectedItemsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 12,
  },
  itemTextDisabled: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 12,
  },
  totalRow: {
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    marginLeft: 12,
    lineHeight: 20,
  },
  notAffectedContainer: {
    marginBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 16,
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#667EEA',
    borderRadius: 8,
    paddingVertical: 16,
    marginLeft: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  attemptsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  attemptsText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
});

export default CurrencyChangeModal;
