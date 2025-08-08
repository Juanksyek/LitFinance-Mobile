import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet, Pressable, ActivityIndicator, Animated, Dimensions, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'react-native';
import { API_BASE_URL } from '../constants/api';
import Toast from "react-native-toast-message";
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
// ✅ NUEVO: Importar componentes para manejar cifras grandes
import SmartInput from './SmartInput';
import SmartNumber from './SmartNumber';
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  cuentaId: string;
  subcuentaId?: string;
  userId: string;
  plataformas: any[];
  recurrente?: any;
  recurrenteExistente?: any;
}

interface FormErrors {
  nombre?: string;
  plataforma?: string;
  monto?: string;
  frecuencia?: string;
  moneda?: string;
}

const RecurrentModal: React.FC<Props> = ({ visible, onClose, onSubmit, cuentaId, subcuentaId, recurrente, recurrenteExistente }) => {
  // Form state
  const [nombre, setNombre] = useState('');
  const [plataforma, setPlataforma] = useState<any>(null);
  const [frecuenciaTipo, setFrecuenciaTipo] = useState<'dia_semana' | 'dia_mes' | 'fecha_fija'>('dia_semana');
  const [frecuenciaValor, setFrecuenciaValor] = useState('');
  // ✅ NUEVO: Estados para manejar cifras grandes de forma segura
  const [montoNumerico, setMontoNumerico] = useState<number | null>(null);
  const [montoValido, setMontoValido] = useState(false);
  const [erroresMonto, setErroresMonto] = useState<string[]>([]);
  const [afectaCuentaPrincipal, setAfectaCuentaPrincipal] = useState(true);
  const [afectaSubcuenta, setAfectaSubcuenta] = useState(false);
  const [recordatorios, setRecordatorios] = useState<string[]>([]);
  const [recordatoriosSeleccionados, setRecordatoriosSeleccionados] = useState<number[]>([]);
  const [moneda, setMoneda] = useState('USD');
  const [loading, setLoading] = useState(false);
  type NavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;
  const navigation = useNavigation<NavigationProp>();
  
  // ✅ NUEVO: Funciones para manejar cambios de monto de forma segura
  const getLimitesRecurrente = () => ({
    min: 0.01,
    max: 100000000, // 100 millones para pagos recurrentes (tarjetas, etc.)
    warning: 10000000, // Advertencia a partir de 10 millones
  });

  const handleMontoValidation = (isValid: boolean, errors: string[]) => {
    setMontoValido(isValid);
    setErroresMonto(errors);
  };

  // Data state
  const [plataformas, setPlataformas] = useState<any[]>([]);
  const [monedasDisponibles, setMonedasDisponibles] = useState<any[]>([]);

  // UI state
  const [loadingPlataformas, setLoadingPlataformas] = useState(false);
  const [loadingMonedas, setLoadingMonedas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [searchMoneda, setSearchMoneda] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPlatformSearch, setShowPlatformSearch] = useState(false);
  const [showCurrencySearch, setShowCurrencySearch] = useState(false);

  // Animation values
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedSearchMoneda, setDebouncedSearchMoneda] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchMoneda(searchMoneda), 300);
    return () => clearTimeout(timer);
  }, [searchMoneda]);

  // Animation effects
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!visible) return;
  
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      Toast.show({
        type: 'error',
        text1: 'Sesión expirada',
        text2: 'Inicia sesión nuevamente',
      });
      return;
    }
  
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  
    // Cargar plataformas
    setLoadingPlataformas(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plataformas-recurrentes`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlataformas(data);
      } else {
        throw new Error('Formato de respuesta inválido');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error al cargar plataformas',
        text2: 'Verifica tu conexión e intenta de nuevo',
      });
      setPlataformas([]);
    } finally {
      setLoadingPlataformas(false);
    }
  
    // Cargar monedas
    setLoadingMonedas(true);
    try {
      const res = await fetch(`${API_BASE_URL}/monedas`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMonedasDisponibles(data);
      } else {
        throw new Error('Formato de monedas inválido');
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error al cargar monedas',
        text2: 'No se pudieron obtener las monedas disponibles',
      });
      setMonedasDisponibles([]);
    } finally {
      setLoadingMonedas(false);
    }
  }, [visible]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered data
  const filteredPlataformas = useMemo(() => {
    return plataformas.filter((p) =>
      p.nombre.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [plataformas, debouncedSearch]);

  const filteredMonedas = useMemo(() => {
    return monedasDisponibles.filter((m) =>
      m.nombre.toLowerCase().includes(debouncedSearchMoneda.toLowerCase()) ||
      m.codigo.toLowerCase().includes(debouncedSearchMoneda.toLowerCase())
    );
  }, [monedasDisponibles, debouncedSearchMoneda]);

  // Event handlers
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  // ✅ NUEVO: Reemplazar función de manejo de monto con versión segura
  const handleMontoChange = useCallback((value: number | null) => {
    setMontoNumerico(value);
    if (errors.monto) {
      setErrors(prev => ({ ...prev, monto: undefined }));
    }
  }, [errors.monto]);

  const toggleRecordatorio = (valor: number) => {
    setRecordatoriosSeleccionados((prev) =>
      prev.includes(valor) ? prev.filter((r) => r !== valor) : [...prev, valor]
    );
  };

  const handleFrecuenciaChange = useCallback((tipo: typeof frecuenciaTipo) => {
    setFrecuenciaTipo(tipo);
    setFrecuenciaValor('');
    if (errors.frecuencia) {
      setErrors(prev => ({ ...prev, frecuencia: undefined }));
    }
  }, [errors.frecuencia]);

  const handlePlatformSelect = useCallback((platform: any) => {
    setPlataforma(platform);
    setShowPlatformSearch(false);
    setSearch('');
    if (errors.plataforma) {
      setErrors(prev => ({ ...prev, plataforma: undefined }));
    }
  }, [errors.plataforma]);

  const handleCurrencySelect = useCallback((currency: any) => {
    setMoneda(currency.codigo);
    setShowCurrencySearch(false);
    setSearchMoneda('');
    if (errors.moneda) {
      setErrors(prev => ({ ...prev, moneda: undefined }));
    }
  }, [errors.moneda]);

  const resetForm = useCallback(() => {
    setNombre('');
    setPlataforma(null);
    // ✅ NUEVO: Limpiar estados numéricos
    setMontoNumerico(null);
    setMontoValido(false);
    setErroresMonto([]);
    setFrecuenciaTipo('dia_semana');
    setFrecuenciaValor('');
    setRecordatorios([]);
    setMoneda('USD');
    setAfectaCuentaPrincipal(true);
    setAfectaSubcuenta(false);
    setSearch('');
    setSearchMoneda('');
    setErrors({});
    setShowPlatformSearch(false);
    setShowCurrencySearch(false);
  }, []);

  const handleGuardar = async () => {
    if (!nombre || !plataforma || !frecuenciaTipo || !frecuenciaValor || !moneda || !montoNumerico || !montoValido) {
      Toast.show({
        type: 'error',
        text1: 'Campos incompletos',
        text2: 'Por favor completa todos los campos requeridos',
      });
      return;
    }
  
    setLoading(true);
  
    try {
      const token = await AsyncStorage.getItem("authToken");
  
      const recurrenteData = {
        nombre,
        plataforma,
        frecuenciaTipo,
        frecuenciaValor,
        moneda,
        monto: montoNumerico, // ✅ NUEVO: Usar valor numérico validado
        cuentaId,
        subcuentaId: subcuentaId || null,
        afectaCuentaPrincipal: !subcuentaId,
        afectaSubcuenta: !!subcuentaId,
        recordatorios: recordatorios,
      };
  
      const res = await fetch(`${API_BASE_URL}/recurrentes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(recurrenteData),
      });
  
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Error al crear el recurrente');
      }
  
      Toast.show({
        type: 'success',
        text1: 'Recurrente creado',
        text2: 'El recurrente fue guardado correctamente',
      });
  
      onSubmit(recurrenteData);
      onClose();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo guardar el recurrente. Intenta de nuevo.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Prefill form if editing recurrenteExistente
  useEffect(() => {
    if (recurrenteExistente) {
      setNombre(recurrenteExistente.nombre || '');
      setPlataforma(recurrenteExistente.plataforma || null);
      // ✅ NUEVO: Setear valor numérico inicial
      setMontoNumerico(recurrenteExistente.monto || null);
      setFrecuenciaTipo(recurrenteExistente.frecuenciaTipo || 'dia_semana');
      setFrecuenciaValor(recurrenteExistente.frecuenciaValor || '');
      setRecordatorios(recurrenteExistente.recordatorios || []);
      setMoneda(recurrenteExistente.moneda || 'USD');
      setAfectaCuentaPrincipal(recurrenteExistente.afectaCuentaPrincipal ?? true);
      setAfectaSubcuenta(recurrenteExistente.afectaSubcuenta ?? false);
      if (recurrenteExistente?.recordatorios) {
        setRecordatoriosSeleccionados(recurrenteExistente.recordatorios);
      }
    }
  }, [recurrenteExistente]);

  useEffect(() => {
    // Si no hay edición de recurrenteExistente, usar recurrente como fallback
    if (!recurrenteExistente) {
      if (recurrente) {
        setNombre(recurrente.nombre || '');
        setPlataforma(recurrente.plataforma || null);
        setFrecuenciaTipo(recurrente.frecuenciaTipo || 'dia_semana');
        setFrecuenciaValor(recurrente.frecuenciaValor || '');
        // ✅ NUEVO: Setear valor numérico del recurrente
        setMontoNumerico(recurrente.monto || null);
        setMoneda(recurrente.moneda || 'USD');
        setAfectaCuentaPrincipal(recurrente.afectaCuentaPrincipal ?? true);
        setAfectaSubcuenta(recurrente.afectaSubcuenta ?? false);
        setRecordatorios(recurrente.recordatorios || []);
      } else {
        resetForm();
      }
    }
  }, [recurrente, visible, recurrenteExistente, resetForm]);

  // Render helpers
  const renderError = (error?: string) => {
    if (!error) return null;
    return (
      <Animated.View
        style={[styles.errorContainer, { opacity: fadeAnim }]}
      >
        <Ionicons name="alert-circle" size={16} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
      </Animated.View>
    );
  };

  const renderLoadingSkeleton = (height: number = 50) => (
    <View style={[styles.skeletonContainer, { height }]}>
      <Animated.View style={[styles.skeleton, { opacity: fadeAnim }]} />
    </View>
  );

  const renderPlatformItem = ({ item: platform }: { item: any }) => (
    <TouchableOpacity
      key={platform.plataformaId}
      onPress={() => handlePlatformSelect(platform)}
      style={[
        styles.listItem,
        plataforma?.plataformaId === platform.plataformaId && styles.listItemSelected,
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.listItemContent}>
        <View style={[styles.colorIndicator, { backgroundColor: platform.color }]} />
        <View style={styles.listItemTextContainer}>
          <Text style={styles.listItemTitle}>{platform.nombre}</Text>
          <Text style={styles.listItemSubtitle}>{platform.categoria}</Text>
        </View>
        {plataforma?.plataformaId === platform.plataformaId && (
          <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderCurrencyItem = ({ item: currency }: { item: any }) => (
    <TouchableOpacity
      key={currency.codigo}
      onPress={() => handleCurrencySelect(currency)}
      style={[
        styles.listItem,
        moneda === currency.codigo && styles.listItemSelected,
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.listItemContent}>
        <View style={styles.currencyIcon}>
          <Text style={styles.currencySymbol}>{currency.simbolo}</Text>
        </View>
        <View style={styles.listItemTextContainer}>
          <Text style={styles.listItemTitle}>{currency.nombre}</Text>
          <Text style={styles.listItemSubtitle}>{currency.codigo}</Text>
        </View>
        {moneda === currency.codigo && (
          <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderFrequencySelector = () => {
    const frequencies = [
      { label: 'Semanal', tipo: 'dia_semana', icon: 'calendar-outline' },
      { label: 'Mensual', tipo: 'dia_mes', icon: 'calendar' },
      { label: 'Anual', tipo: 'fecha_fija', icon: 'calendar-sharp' },
    ];

    return (
      <View style={styles.chipContainer}>
        {frequencies.map((freq) => (
          <TouchableOpacity
            key={freq.tipo}
            onPress={() => handleFrecuenciaChange(freq.tipo as any)}
            style={[
              styles.chip,
              frecuenciaTipo === freq.tipo && styles.chipSelected,
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={freq.icon as any}
              size={16}
              color={frecuenciaTipo === freq.tipo ? '#ffffff' : '#64748b'}
              style={styles.chipIcon}
            />
            <Text
              style={[
                styles.chipText,
                frecuenciaTipo === freq.tipo && styles.chipTextSelected,
              ]}
            >
              {freq.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Animated.View
            style={[
              styles.modal,
              {
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ],
              },
            ]}
          >
            <View style={styles.dragIndicator} />

            <View style={styles.header}>
              <Text style={styles.title}>Nuevo Recurrente</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre del Recurrente</Text>
                <TextInput
                  style={[styles.input, errors.nombre && styles.inputError]}
                  value={nombre}
                  onChangeText={(text) => {
                    setNombre(text);
                    if (errors.nombre) {
                      setErrors(prev => ({ ...prev, nombre: undefined }));
                    }
                  }}
                  placeholder="Ej. Spotify Premium, Netflix, Gym..."
                  placeholderTextColor="#94a3b8"
                  maxLength={50}
                />
                {renderError(errors.nombre)}
              </View>

              {/* Platform Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Plataforma</Text>
                <TouchableOpacity
                  style={[styles.selectorButton, errors.plataforma && styles.inputError]}
                  onPress={() => setShowPlatformSearch(!showPlatformSearch)}
                  activeOpacity={0.8}
                >
                  {plataforma ? (
                    <View style={styles.selectedItemContainer}>
                      <View style={[styles.colorIndicator, { backgroundColor: plataforma.color }]} />
                      <Text style={styles.selectedItemText}>{plataforma.nombre}</Text>
                    </View>
                  ) : (
                    <Text style={styles.placeholderText}>Selecciona una plataforma</Text>
                  )}
                  <Ionicons
                    name={showPlatformSearch ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
                {renderError(errors.plataforma)}

                {showPlatformSearch && (
                  <View style={styles.searchContainer}>
                    <View style={styles.searchInputContainer}>
                      <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Buscar plataforma..."
                        placeholderTextColor="#94a3b8"
                      />
                    </View>

                    <ScrollView style={styles.listContainer} nestedScrollEnabled>
                      {loadingPlataformas ? (
                        <>
                          {renderLoadingSkeleton()}
                          {renderLoadingSkeleton()}
                          {renderLoadingSkeleton()}
                        </>
                      ) : filteredPlataformas.length > 0 ? (
                        filteredPlataformas.map((platform) => renderPlatformItem({ item: platform }))
                      ) : (
                        <View style={styles.emptyState}>
                          <Ionicons name="search" size={48} color="#cbd5e1" />
                          <Text style={styles.emptyStateText}>No se encontraron plataformas</Text>
                          <Text style={styles.emptyStateSubtext}>Intenta con otro término de búsqueda</Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Currency Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Moneda</Text>
                <TouchableOpacity
                  style={[styles.selectorButton, errors.moneda && styles.inputError]}
                  onPress={() => setShowCurrencySearch(!showCurrencySearch)}
                  activeOpacity={0.8}
                >
                  {moneda ? (
                    <View style={styles.selectedItemContainer}>
                      {monedasDisponibles.find(m => m.codigo === moneda) && (
                        <>
                          <View style={styles.currencyIcon}>
                            <Text style={styles.currencySymbol}>
                              {monedasDisponibles.find(m => m.codigo === moneda)?.simbolo}
                            </Text>
                          </View>
                          <Text style={styles.selectedItemText}>
                            {monedasDisponibles.find(m => m.codigo === moneda)?.nombre} ({moneda})
                          </Text>
                        </>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.placeholderText}>Selecciona una moneda</Text>
                  )}
                  <Ionicons
                    name={showCurrencySearch ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
                {renderError(errors.moneda)}

                {showCurrencySearch && (
                  <View style={styles.searchContainer}>
                    <View style={styles.searchInputContainer}>
                      <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        value={searchMoneda}
                        onChangeText={setSearchMoneda}
                        placeholder="Buscar moneda..."
                        placeholderTextColor="#94a3b8"
                      />
                    </View>

                    <ScrollView style={styles.listContainer} nestedScrollEnabled>
                      {loadingMonedas ? (
                        <>
                          {renderLoadingSkeleton()}
                          {renderLoadingSkeleton()}
                          {renderLoadingSkeleton()}
                        </>
                      ) : filteredMonedas.length > 0 ? (
                        filteredMonedas.map((currency) => renderCurrencyItem({ item: currency }))
                      ) : (
                        <View style={styles.emptyState}>
                          <Ionicons name="card" size={48} color="#cbd5e1" />
                          <Text style={styles.emptyStateText}>No se encontraron monedas</Text>
                          <Text style={styles.emptyStateSubtext}>Intenta con otro término de búsqueda</Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* ✅ NUEVO: SmartInput en lugar de TextInput básico */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Monto</Text>
                <View style={styles.smartInputContainer}>
                  <SmartInput
                    type="currency"
                    placeholder="0.00"
                    prefix={monedasDisponibles.find(m => m.codigo === moneda)?.simbolo || '$'}
                    initialValue={montoNumerico || undefined}
                    {...getLimitesRecurrente()}
                    onValueChange={handleMontoChange}
                    onValidationChange={handleMontoValidation}
                    style={[styles.amountInput, errors.monto && styles.inputError]}
                    autoFix={true}
                  />
                </View>
                {renderError(errors.monto)}
                
                {/* ✅ NUEVO: Mostrar advertencia si hay errores */}
                {erroresMonto.length > 0 && (
                  <View style={styles.warningContainer}>
                    <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                    <View style={styles.warningContent}>
                      <Text style={styles.warningTitle}>Monto muy grande</Text>
                      <Text style={styles.warningText}>
                        Monto: <SmartNumber value={montoNumerico || 0} options={{ context: 'modal', symbol: monedasDisponibles.find(m => m.codigo === moneda)?.simbolo || '$' }} />
                      </Text>
                      <Text style={styles.warningSubtext}>
                        {erroresMonto[0]}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Frequency Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Frecuencia</Text>
                {renderFrequencySelector()}
                {renderError(errors.frecuencia)}

                {/* Frequency Value Selection */}
                {frecuenciaTipo === 'dia_semana' && (
                  <View style={styles.chipContainer}>
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setFrecuenciaValor(String(index))}
                        style={[
                          styles.dayChip,
                          frecuenciaValor === String(index) && styles.chipSelected,
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            frecuenciaValor === String(index) && styles.chipTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {frecuenciaTipo === 'dia_mes' && (
                  <View style={styles.chipContainer}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <TouchableOpacity
                        key={day}
                        onPress={() => setFrecuenciaValor(String(day))}
                        style={[
                          styles.dayChip,
                          frecuenciaValor === String(day) && styles.chipSelected,
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            frecuenciaValor === String(day) && styles.chipTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {frecuenciaTipo === 'fecha_fija' && (
                  <>
                    <Text style={styles.subLabel}>Selecciona el mes</Text>
                    <View style={styles.chipContainer}>
                      {[
                        'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
                      ].map((mes, index) => (
                        <TouchableOpacity
                          key={mes}
                          onPress={() => setFrecuenciaValor(`${index + 1}-1`)}
                          style={[
                            styles.chip,
                            frecuenciaValor.startsWith(`${index + 1}-`) && styles.chipSelected,
                          ]}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              frecuenciaValor.startsWith(`${index + 1}-`) && styles.chipTextSelected,
                            ]}
                          >
                            {mes}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {frecuenciaValor.includes('-') && (
                      <>
                        <Text style={styles.subLabel}>Selecciona el día</Text>
                        <View style={styles.chipContainer}>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                            const [mes] = frecuenciaValor.split('-');
                            const nuevaFecha = `${mes}-${day}`;
                            return (
                              <TouchableOpacity
                                key={day}
                                onPress={() => setFrecuenciaValor(nuevaFecha)}
                                style={[
                                  styles.dayChip,
                                  frecuenciaValor === nuevaFecha && styles.chipSelected,
                                ]}
                                activeOpacity={0.8}
                              >
                                <Text
                                  style={[
                                    styles.chipText,
                                    frecuenciaValor === nuevaFecha && styles.chipTextSelected,
                                  ]}
                                >
                                  {day}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    )}
                  </>
                )}
              </View>

              {/* Reminders */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recordatorios</Text>
                <Text style={styles.description}>Te notificaremos antes del próximo pago</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  {[1, 3, 7].map((dias) => (
                    <TouchableOpacity
                      key={dias}
                      onPress={() => toggleRecordatorio(dias)}
                      style={[
                        styles.reminderButton,
                        recordatoriosSeleccionados.includes(dias) && styles.reminderButtonSelected,
                      ]}
                    >
                      <Ionicons
                        name="alarm-outline"
                        size={16}
                        color={recordatoriosSeleccionados.includes(dias) ? '#0f172a' : '#64748b'}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={styles.reminderText}>
                        {dias === 1
                          ? '1 día antes'
                          : dias === 3
                          ? '3 días antes'
                          : '1 semana antes'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Account Settings */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Configuración de Cuenta</Text>

                {!subcuentaId && (
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                      <Text style={styles.switchLabel}>Afectar cuenta principal</Text>
                      <Text style={styles.switchDescription}>El monto se descontará de la cuenta principal</Text>
                    </View>
                    <Switch
                      value={afectaCuentaPrincipal}
                      onValueChange={setAfectaCuentaPrincipal}
                      trackColor={{ false: '#e2e8f0', true: '#f59e0b' }}
                      thumbColor={afectaCuentaPrincipal ? '#ffffff' : '#f1f5f9'}
                    />
                  </View>
                )}

                {subcuentaId && (
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                      <Text style={styles.switchLabel}>Afectar subcuenta</Text>
                      <Text style={styles.switchDescription}>El monto se descontará de la subcuenta seleccionada</Text>
                    </View>
                    <Switch
                      value={afectaSubcuenta}
                      onValueChange={setAfectaSubcuenta}
                      trackColor={{ false: '#e2e8f0', true: '#f59e0b' }}
                      thumbColor={afectaSubcuenta ? '#ffffff' : '#f1f5f9'}
                    />
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleGuardar}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#ffffff" style={styles.saveButtonIcon} />
                    <Text style={styles.saveButtonText}>Guardar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.95,
    minHeight: SCREEN_HEIGHT * 0.6,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  dragIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  inputGroup: {
    marginBottom: 22,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 12,
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  selectorButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedItemText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
    marginLeft: 10,
  },
  placeholderText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  currencyIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  currencySymbol: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  searchContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    maxHeight: 280,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchIcon: {
    marginRight: 8,
    color: '#64748b',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  listContainer: {
    maxHeight: 200,
  },
  listItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  listItemSelected: {
    backgroundColor: '#f0fdf4',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 1,
  },
  listItemSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyState: {
    padding: 36,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 10,
    marginBottom: 2,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
  },
  currencyPrefix: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#e2e8f0',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  currencyPrefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipSelected: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dayChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 40,
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
    backgroundColor: '#ffffff',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonIcon: {
    marginRight: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginLeft: 4,
    fontWeight: '500',
  },
  skeletonContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skeleton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    height: 18,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 16,
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    marginHorizontal: 4,
    elevation: 2,
  },
  reminderButtonSelected: {
    backgroundColor: '#f59e0b',
  },
  reminderButtonText: {
    fontSize: 13,
    marginLeft: 6,
    color: '#333',
  },
  reminderText: {
    fontSize: 10,
    color: '#333',
  },
  // ✅ NUEVO: Estilos para SmartInput y advertencias
  smartInputContainer: {
    marginBottom: 0, // SmartInput ya tiene su propio margin
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningContent: {
    flex: 1,
    marginLeft: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 2,
  },
  warningSubtext: {
    fontSize: 11,
    color: '#A16207',
    fontStyle: 'italic',
  },
});

export default RecurrentModal;