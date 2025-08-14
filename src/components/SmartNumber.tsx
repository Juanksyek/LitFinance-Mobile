import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, FormatOptions } from '../utils/numberFormatter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';
import CurrencyChangeModal from './CurrencyChangeModal';
import Toast from 'react-native-toast-message';

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

interface Moneda {
  codigo: string;
  nombre: string;
  simbolo: string;
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
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [convertingCurrency, setConvertingCurrency] = useState(false);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [loadingMonedas, setLoadingMonedas] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFullNumbers, setShowFullNumbers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMonedas, setTotalMonedas] = useState(0);
  const itemsPerPage = 10;
  
  // Ref para el timeout de búsqueda
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar preferencia de formato de números
  useEffect(() => {
    loadNumberPreference();
  }, []);

  // Recargar preferencias cuando se indique desde el componente padre
  useEffect(() => {
    if (refreshPreferences > 0) {
      loadNumberPreference();
    }
  }, [refreshPreferences]);

  const loadNumberPreference = async () => {
    try {
      const preference = await AsyncStorage.getItem('showFullNumbers');
      setShowFullNumbers(preference === 'true');
    } catch (error) {
      console.error('Error cargando preferencia de números en SmartNumber:', error);
    }
  };

  // Función para cargar monedas desde el backend con búsqueda y paginación
  const loadMonedas = async (page: number = 1, search: string = '') => {
    try {
      setLoadingMonedas(true);
      
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.error('No se encontró el token de usuario');
        return;
      }

      // Construir URL con parámetros de búsqueda y paginación
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        ...(search && { search })
      });

      const url = `${API_BASE_URL}/monedas/catalogo?${params}`;
      console.log('Cargando monedas desde:', url);
      console.log('Parámetros de búsqueda:', { page, search, limit: itemsPerPage });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Respuesta del servidor:', data);
        
        // Verificar si la respuesta tiene estructura de paginación
        if (data.monedas && Array.isArray(data.monedas)) {
          setMonedas(data.monedas);
          setTotalPages(data.totalPages || 1);
          setTotalMonedas(data.total || data.monedas.length);
          setCurrentPage(page);
          console.log('Monedas cargadas:', data.monedas.length, 'Total:', data.total);
        } else if (Array.isArray(data)) {
          // Fallback: si la respuesta es un array simple
          setMonedas(data);
          setTotalPages(1);
          setTotalMonedas(data.length);
          setCurrentPage(1);
          console.log('Monedas cargadas (array simple):', data.length);
        } else {
          console.log('Estructura de respuesta no reconocida:', data);
          setMonedas([]);
          setTotalPages(1);
          setTotalMonedas(0);
        }
      } else {
        console.error('Error al cargar monedas:', response.status, response.statusText);
        // Fallback a monedas por defecto si falla la carga
        setMonedas([
          { codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$' },
          { codigo: 'MXN', nombre: 'Peso Mexicano', simbolo: '$' },
          { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
          { codigo: 'GBP', nombre: 'Libra Esterlina', simbolo: '£' },
          { codigo: 'JPY', nombre: 'Yen Japonés', simbolo: '¥' },
          { codigo: 'CAD', nombre: 'Dólar Canadiense', simbolo: 'C$' },
        ]);
        setTotalPages(1);
        setTotalMonedas(6);
      }
    } catch (error) {
      console.error('Error al cargar monedas:', error);
      // Fallback a monedas por defecto
      setMonedas([
        { codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$' },
        { codigo: 'MXN', nombre: 'Peso Mexicano', simbolo: '$' },
        { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
        { codigo: 'GBP', nombre: 'Libra Esterlina', simbolo: '£' },
        { codigo: 'JPY', nombre: 'Yen Japonés', simbolo: '¥' },
        { codigo: 'CAD', nombre: 'Dólar Canadiense', simbolo: 'C$' },
      ]);
      setTotalPages(1);
      setTotalMonedas(6);
    } finally {
      setLoadingMonedas(false);
    }
  };

  // Cargar monedas cuando se abre el modal
  useEffect(() => {
    if (currencyModalVisible) {
      setCurrentPage(1);
      setSearchText('');
      loadMonedas(1, '');
    }
  }, [currencyModalVisible]);

  // Limpiar timeout al desmontar componente
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Función para manejar la búsqueda
  const handleSearch = (text: string) => {
    setSearchText(text);
    setCurrentPage(1);
    
    // Cancelar búsqueda anterior si existe
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Si el texto está vacío, buscar inmediatamente
    if (text.trim() === '') {
      loadMonedas(1, '');
      return;
    }
    
    // Debounce la búsqueda después de 300ms
    searchTimeoutRef.current = setTimeout(() => {
      loadMonedas(1, text);
    }, 300);
  };

  // Función para ir a la página anterior
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      loadMonedas(newPage, searchText);
    }
  };

  // Función para ir a la página siguiente
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      loadMonedas(newPage, searchText);
    }
  };

  // Función para seleccionar moneda y abrir modal de confirmación
  const handleCurrencySelect = (moneda: Moneda) => {
    console.log('🔄 [SmartNumber] === SELECCIÓN DE MONEDA ===');
    console.log('🔄 [SmartNumber] Usuario seleccionó moneda:', {
      monedaActual: currentCurrency,
      monedaSeleccionada: moneda.codigo,
      monedaNombre: moneda.nombre,
      timestamp: new Date().toISOString()
    });
    
    if (moneda.codigo === currentCurrency) {
      console.log('⚠️ [SmartNumber] Misma moneda seleccionada, cancelando');
      return; // No hacer nada si es la misma moneda
    }
    
    console.log('✅ [SmartNumber] Abriendo modal de confirmación de cambio');
    setSelectedCurrency(moneda.codigo);
    setCurrencyModalVisible(false);
    setChangeModalVisible(true);
  };

  // Función para manejar el éxito del cambio de moneda
  const handleCurrencyChangeSuccess = (result: any) => {
    console.log('🎉 [SmartNumber] === CAMBIO DE MONEDA EXITOSO ===');
    console.log('🎉 [SmartNumber] Resultado del cambio de moneda:', {
      resultadoCompleto: result,
      nuevaMoneda: result.cuenta?.moneda,
      conversion: result.conversion?.summary,
      timestamp: new Date().toISOString()
    });
    
    if (onCurrencyChange) {
      console.log('📞 [SmartNumber] Llamando onCurrencyChange con moneda:', result.cuenta.moneda);
      onCurrencyChange(result.cuenta.moneda);
      console.log('✅ [SmartNumber] onCurrencyChange ejecutado exitosamente');
    } else {
      console.log('⚠️ [SmartNumber] onCurrencyChange no está definido');
    }
    
    Toast.show({
      type: 'success',
      text1: 'Conversión Exitosa',
      text2: `Se convirtieron ${result.conversion.summary.totalElementos} elementos`,
    });
  };
  
  const result = formatCurrency(value, {
    ...options,
    forceFullNumbers: showFullNumbers
  });
  const hasWarnings = result.warnings.length > 0;
  const shouldShowTooltip = allowTooltip && (result.isTruncated || result.isLarge || hasWarnings);

  const handlePress = () => {
    console.log('🖱️ [SmartNumber] Usuario presionó SmartNumber:', {
      allowCurrencyChange,
      shouldShowTooltip,
      currentCurrency,
      value,
      timestamp: new Date().toISOString()
    });
    
    if (allowCurrencyChange) {
      console.log('💱 [SmartNumber] Abriendo modal de selección de monedas');
      setCurrencyModalVisible(true);
    } else if (shouldShowTooltip) {
      console.log('ℹ️ [SmartNumber] Mostrando tooltip');
      setTooltipVisible(true);
    }
  };

  const getWarningColor = () => {
    if (result.warnings.some(w => w.includes('excede límites'))) return '#EF4444';
    if (result.warnings.some(w => w.includes('muy grande'))) return '#F59E0B';
    return color;
  };

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
            {/* Valor mostrado */}
            <View style={styles.tooltipSection}>
              <Text style={styles.tooltipLabel}>Valor mostrado:</Text>
              <Text style={styles.tooltipValue}>{result.formatted}</Text>
            </View>

            {/* Valor completo */}
            <View style={styles.tooltipSection}>
              <Text style={styles.tooltipLabel}>Valor completo:</Text>
              <Text style={[styles.tooltipValue, styles.fullValueText]}>
                {result.fullValue}
              </Text>
            </View>

            {/* Notación científica si aplica */}
            {result.scientific && (
              <View style={styles.tooltipSection}>
                <Text style={styles.tooltipLabel}>Notación científica:</Text>
                <Text style={[styles.tooltipValue, styles.scientificText]}>
                  {result.scientific}
                </Text>
              </View>
            )}

            {/* Información adicional */}
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoItemLabel}>Estado:</Text>
                <Text style={[styles.infoItemValue, { 
                  color: result.isLarge ? '#F59E0B' : '#4CAF50' 
                }]}>
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

            {/* Advertencias */}
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

            {/* Botones de acción */}
            <View style={styles.actionButtons}>
              {allowCurrencyChange && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.currencyActionButton]}
                  onPress={() => {
                    setTooltipVisible(false);
                    setCurrencyModalVisible(true);
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
                onPress={() => {
                  // Aquí podrías implementar copiar al clipboard
                  setTooltipVisible(false);
                }}
              >
                <Ionicons name="copy-outline" size={16} color="#4CAF50" />
                <Text style={styles.actionButtonText}>Copiar</Text>
              </TouchableOpacity>
              
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
        <Text style={[
          styles.numberText, 
          textStyle,
          { color: getWarningColor() }
        ]}>
          {result.formatted}
        </Text>
        
        {shouldShowTooltip && (
          <View style={styles.indicatorContainer}>
            {result.isTruncated && (
              <Ionicons name="ellipsis-horizontal" size={12} color="#94A3B8" />
            )}
            {hasWarnings && (
              <Ionicons 
                name="warning" 
                size={12} 
                color={getWarningColor()} 
                style={{ marginLeft: 2 }}
              />
            )}
          </View>
        )}
      </TouchableOpacity>
      
      {tooltipVisible && renderTooltip()}
      
      {/* Modal de cambio de moneda */}
      {currencyModalVisible && (
        <Modal
          visible={currencyModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setCurrencyModalVisible(false)}
        >
          <View style={styles.currencyModalContainer}>
            <View style={styles.currencyModalHeader}>
              <Text style={styles.currencyModalTitle}>Cambiar Moneda</Text>
              <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            {/* Campo de búsqueda */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar moneda..."
                placeholderTextColor="#94A3B8"
                value={searchText}
                onChangeText={handleSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Información de resultados */}
            <View style={styles.resultsInfo}>
              <Text style={styles.resultsText}>
                {totalMonedas} moneda{totalMonedas !== 1 ? 's' : ''} encontrada{totalMonedas !== 1 ? 's' : ''}
                {totalPages > 1 && ` • Página ${currentPage} de ${totalPages}`}
              </Text>
            </View>
            
            <View style={styles.currentValueInfo}>
              <Text style={styles.currentValueLabel}>Valor actual:</Text>
              <Text style={styles.currentValueText}>
                {monedas.find(m => m.codigo === currentCurrency)?.simbolo}{value.toLocaleString('es-MX')} {currentCurrency}
              </Text>
            </View>
            
            <ScrollView style={styles.currencyList} showsVerticalScrollIndicator={false}>
              {loadingMonedas ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#667EEA" />
                  <Text style={styles.loadingText}>Cargando monedas disponibles...</Text>
                </View>
              ) : monedas.length > 0 ? (
                monedas.map((moneda) => {
                  const isCurrentCurrency = currentCurrency === moneda.codigo;
                  
                  return (
                    <TouchableOpacity
                      key={moneda.codigo}
                      style={[
                        styles.currencyOption,
                        isCurrentCurrency && styles.currencyOptionSelected
                      ]}
                      onPress={() => handleCurrencySelect(moneda)}
                      disabled={isCurrentCurrency || convertingCurrency}
                    >
                      <View style={styles.currencyOptionLeft}>
                        <View style={styles.currencyIcon}>
                          <Text style={styles.currencySymbol}>{moneda.simbolo}</Text>
                        </View>
                        <View style={styles.currencyInfo}>
                          <Text style={styles.currencyCode}>{moneda.codigo}</Text>
                          <Text style={styles.currencyName}>{moneda.nombre}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.currencyOptionRight}>
                        {isCurrentCurrency ? (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentText}>Actual</Text>
                          </View>
                        ) : convertingCurrency ? (
                          <ActivityIndicator size="small" color="#667EEA" />
                        ) : (
                          <View style={styles.changeIndicator}>
                            <Text style={styles.changeText}>Cambiar</Text>
                            <Ionicons name="arrow-forward" size={16} color="#667EEA" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : searchText && searchText.trim() !== '' ? (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="search" size={48} color="#94A3B8" />
                  <Text style={styles.noResultsTitle}>No se encontraron monedas</Text>
                  <Text style={styles.noResultsText}>
                    No hay resultados para "{searchText}"
                  </Text>
                  <TouchableOpacity 
                    style={styles.clearSearchButton}
                    onPress={() => handleSearch('')}
                  >
                    <Text style={styles.clearSearchText}>Limpiar búsqueda</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={48} color="#EF4444" />
                  <Text style={styles.errorText}>No se pudieron cargar las monedas</Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => loadMonedas(1, searchText)}
                  >
                    <Ionicons name="refresh" size={20} color="#667EEA" />
                    <Text style={styles.retryText}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
            
            {/* Controles de paginación */}
            {totalPages > 1 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity 
                  style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                  onPress={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? "#CBD5E1" : "#667EEA"} />
                  <Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
                    Anterior
                  </Text>
                </TouchableOpacity>
                
                <View style={styles.paginationInfo}>
                  <Text style={styles.paginationText}>
                    {currentPage} de {totalPages}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                  onPress={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  <Text style={[styles.paginationButtonText, currentPage === totalPages && styles.paginationButtonTextDisabled]}>
                    Siguiente
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? "#CBD5E1" : "#667EEA"} />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.currencyModalFooter}>
              <Text style={styles.exchangeDisclaimer}>
                💡 La conversión se realizará automáticamente en el servidor.
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal de vista previa y confirmación de cambio de moneda */}
      <CurrencyChangeModal
        visible={changeModalVisible}
        newCurrency={selectedCurrency}
        onClose={() => setChangeModalVisible(false)}
        onSuccess={handleCurrencyChangeSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  numberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberText: {
    fontSize: 16,
    fontWeight: '600',
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: width * 0.9,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginLeft: 12,
  },
  tooltipContent: {
    padding: 20,
  },
  tooltipSection: {
    marginBottom: 16,
  },
  tooltipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  tooltipValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  fullValueText: {
    fontFamily: 'monospace',
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 6,
  },
  scientificText: {
    fontFamily: 'monospace',
    color: '#7C3AED',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  infoItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  infoItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  warningsContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 6,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 6,
  },
  currencyActionButton: {
    borderColor: '#667EEA',
    borderWidth: 1,
  },
  // Estilos para el modal de cambio de moneda
  currencyModalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  currencyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: 'white',
  },
  currencyModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  currentValueInfo: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currentValueLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  currentValueText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  currencyList: {
    flex: 1,
    marginTop: 20,
    maxHeight: 400, // Altura máxima para permitir scroll
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currencyOptionSelected: {
    backgroundColor: '#F1F5F9',
    borderColor: '#667EEA',
    borderWidth: 2,
  },
  currencyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667EEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  currencyName: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  currencyOptionRight: {
    alignItems: 'flex-end',
  },
  currentBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  conversionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversionAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 8,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667EEA',
    marginRight: 8,
  },
  currencyModalFooter: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  exchangeDisclaimer: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Estilos para loading y error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#667EEA',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667EEA',
    marginLeft: 8,
  },
  // Estilos para búsqueda
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    marginLeft: 12,
    marginRight: 12,
  },
  resultsInfo: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  resultsText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  // Estilos para paginación
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#667EEA',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667EEA',
  },
  paginationButtonTextDisabled: {
    color: '#CBD5E1',
  },
  paginationInfo: {
    flex: 1,
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  // Estilos para "no resultados"
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  clearSearchButton: {
    backgroundColor: '#667EEA',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearSearchText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SmartNumber;
// Path: src/components/DataPrivacyModal.tsx