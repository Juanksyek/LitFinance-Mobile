import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';
import Toast from 'react-native-toast-message';

interface PreviewData {
  monedaActual: string;
  nuevaMoneda: string;
  tasaCambio: number;
  elementosAfectados: {
    cuentaPrincipal: boolean;
    transacciones: number;
    historialCuenta: number;
    recurrentes: number;
    total: number;
  };
  advertencia: string;
  reversible: boolean;
  intentosRestantes: number;
}

interface ConversionResult {
  message: string;
  cuenta: {
    _id: string;
    moneda: string;
    simbolo: string;
    cantidad: number;
  };
  conversion: {
    summary: {
      monedaAnterior: string;
      monedaNueva: string;
      tasaCambio: number;
      elementosConvertidos: {
        transacciones: number;
        historialCuenta: number;
        recurrentes: number;
        cuentaPrincipal: boolean;
      };
      totalElementos: number;
    };
  };
  intentosRestantes: number;
}

interface CurrencyChangeModalProps {
  visible: boolean;
  newCurrency: string;
  onClose: () => void;
  onSuccess: (result: ConversionResult) => void;
}

const CurrencyChangeModal: React.FC<CurrencyChangeModalProps> = ({
  visible,
  newCurrency,
  onClose,
  onSuccess,
}) => {
  const [preview, setPreview] = useState<PreviewData | null>(null);
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
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await fetch(
        `${API_BASE_URL}/cuenta/preview-currency-change?nuevaMoneda=${newCurrency}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPreview(data);
        setIntentosRestantes(data.intentosRestantes); // Guardar intentos restantes
      } else {
        const errorData = await response.json();
        Toast.show({
          type: 'error',
          text1: 'Error al obtener vista previa',
          text2: errorData.message || 'No se pudo cargar la información del cambio',
        });
        onClose();
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      Toast.show({
        type: 'error',
        text1: 'Error de conexión',
        text2: 'No se pudo conectar con el servidor',
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
    console.log('🚀 [CurrencyChangeModal] === INICIANDO CONVERSIÓN ===');
    console.log('🚀 [CurrencyChangeModal] Ejecutando cambio de moneda:', {
      newCurrency,
      timestamp: new Date().toISOString()
    });
    
    try {
      setConverting(true);
      const token = await AsyncStorage.getItem('authToken');
      
      console.log('🔑 [CurrencyChangeModal] Token obtenido:', token ? 'Existe' : 'No encontrado');
      
      console.log('🔍 [CurrencyChangeModal] Verificando estado actual de la cuenta...');
      try {
        const currentAccountResponse = await fetch(`${API_BASE_URL}/cuenta/principal`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const currentAccount = await currentAccountResponse.json();
        console.log('📊 [CurrencyChangeModal] Estado actual de la cuenta:', currentAccount);
        
        const amount = currentAccount.cantidad;
        console.log('🔍 [CurrencyChangeModal] Análisis del monto:', {
          valor: amount,
          tipo: typeof amount,
          esNumero: Number.isFinite(amount),
          esNegativo: amount < 0,
          esEntero: Number.isInteger(amount),
          enString: String(amount)
        });
        
      } catch (checkError) {
        console.log('⚠️ [CurrencyChangeModal] No se pudo obtener estado actual:', checkError);
      }
      
      const requestBody = {
        moneda: newCurrency,
      };
      
      console.log('📦 [CurrencyChangeModal] Cuerpo de la petición:', requestBody);
      console.log('🌐 [CurrencyChangeModal] Enviando petición PATCH a:', `${API_BASE_URL}/cuenta/editar-principal`);

      const response = await fetch(`${API_BASE_URL}/cuenta/editar-principal`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('📡 [CurrencyChangeModal] Respuesta recibida:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        const result = await response.json();
        setIntentosRestantes(result.intentosRestantes); // Actualizar intentos restantes
        
        console.log('🎯 [CurrencyChangeModal] === CONVERSIÓN EXITOSA ===');
        console.log('🎯 [CurrencyChangeModal] Resultado de conversión:', {
          result,
          newCurrency,
          timestamp: new Date().toISOString()
        });
        
        Toast.show({
          type: 'success',
          text1: 'Conversión Exitosa',
          text2: `Moneda cambiada a ${newCurrency}. Intentos restantes: ${result.intentosRestantes}`,
        });

        console.log('📞 [CurrencyChangeModal] Llamando onSuccess callback');
        onSuccess(result);
        console.log('🔚 [CurrencyChangeModal] Cerrando modal');
        onClose();
      } else {
        const errorData = await response.json();
        console.error('❌ [CurrencyChangeModal] Error en respuesta del servidor:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          newCurrency
        });
        
        Toast.show({
          type: 'error',
          text1: 'Error en la conversión',
          text2: errorData.message || 'No se pudo cambiar la moneda',
        });
      }
    } catch (error) {
      console.error('Error executing currency change:', error);
      Toast.show({
        type: 'error',
        text1: 'Error de conexión',
        text2: 'No se pudo completar la conversión',
      });
    } finally {
      setConverting(false);
    }
  };

  const renderPreview = () => (
    <ScrollView style={styles.content}>
      <View style={styles.header}>
        <Ionicons name="swap-horizontal" size={32} color="#667EEA" />
        <Text style={styles.title}>Vista Previa del Cambio</Text>
      </View>

      <View style={styles.conversionInfo}>
        <View style={styles.currencyRow}>
          <Text style={styles.fromCurrency}>{preview?.monedaActual}</Text>
          <Ionicons name="arrow-forward" size={20} color="#64748B" />
          <Text style={styles.toCurrency}>{preview?.nuevaMoneda}</Text>
        </View>
        <Text style={styles.exchangeRate}>
          Tasa de cambio: 1 {preview?.monedaActual} = {preview?.tasaCambio} {preview?.nuevaMoneda}
        </Text>
      </View>

      <View style={styles.affectedItemsContainer}>
        <Text style={styles.sectionTitle}>Elementos que serán convertidos:</Text>
        
        <View style={styles.itemRow}>
          <Ionicons name="wallet" size={20} color="#4CAF50" />
          <Text style={styles.itemText}>Cuenta principal</Text>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
        </View>
        
        <View style={styles.itemRow}>
          <Ionicons name="list" size={20} color="#4CAF50" />
          <Text style={styles.itemText}>
            {preview?.elementosAfectados.transacciones} transacciones
          </Text>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
        </View>
        
        <View style={styles.itemRow}>
          <Ionicons name="time" size={20} color="#4CAF50" />
          <Text style={styles.itemText}>
            {preview?.elementosAfectados.historialCuenta} registros de historial
          </Text>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
        </View>
        
        <View style={styles.itemRow}>
          <Ionicons name="repeat" size={20} color="#4CAF50" />
          <Text style={styles.itemText}>
            {preview?.elementosAfectados.recurrentes} pagos recurrentes
          </Text>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalText}>
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
        <Text style={styles.sectionTitle}>NO se verán afectadas:</Text>
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
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Cambio de Moneda</Text>
          <TouchableOpacity onPress={onClose} disabled={converting}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667EEA" />
            <Text style={styles.loadingText}>Cargando vista previa...</Text>
          </View>
        ) : converting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667EEA" />
            <Text style={styles.loadingText}>
              Convirtiendo moneda... Esto puede tomar unos momentos
            </Text>
            <Text style={styles.loadingSubtext}>
              Por favor no cierres la aplicación
            </Text>
          </View>
        ) : (
          <>
            {renderPreview()}
            
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={converting}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
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
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
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
    color: '#1E293B',
    marginTop: 8,
  },
  conversionInfo: {
    backgroundColor: '#F8FAFC',
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
    color: '#64748B',
    marginRight: 16,
  },
  toCurrency: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667EEA',
    marginLeft: 16,
  },
  exchangeRate: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  affectedItemsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
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
    color: '#475569',
    marginLeft: 12,
  },
  itemTextDisabled: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
    marginLeft: 12,
  },
  totalRow: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
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
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 16,
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
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
