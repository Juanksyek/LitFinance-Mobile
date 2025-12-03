import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal,
  KeyboardAvoidingView, Platform, StyleSheet, Pressable, ActivityIndicator,
  Animated, Dimensions, Keyboard, PanResponder, GestureResponderEvent, PanResponderGestureState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'react-native';
import { API_BASE_URL } from '../constants/api';
import Toast from "react-native-toast-message";
import SmartInput from './SmartInput';
import SmartNumber from './SmartNumber';
import { CurrencyField, Moneda } from '../components/CurrencyPicker';
import { useThemeColors } from '../theme/useThemeColors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

const RecurrentModal: React.FC<Props> = ({
  visible,
  onClose,
  onSubmit,
  cuentaId,
  subcuentaId,
  recurrente,
  recurrenteExistente
}) => {
  const colors = useThemeColors();
  // Form state
  const [nombre, setNombre] = useState('');
  const [plataforma, setPlataforma] = useState<any>(null);
  const [frecuenciaTipo, setFrecuenciaTipo] = useState<'dia_semana' | 'dia_mes' | 'fecha_fija'>('dia_semana');
  const [frecuenciaValor, setFrecuenciaValor] = useState('');

  // Monto seguro
  const [montoNumerico, setMontoNumerico] = useState<number | null>(null);
  const [montoValido, setMontoValido] = useState(false);
  const [erroresMonto, setErroresMonto] = useState<string[]>([]);

  const [afectaCuentaPrincipal, setAfectaCuentaPrincipal] = useState(true);
  const [afectaSubcuenta, setAfectaSubcuenta] = useState(false);
  const [recordatorios, setRecordatorios] = useState<string[]>([]);
  const [recordatoriosSeleccionados, setRecordatoriosSeleccionados] = useState<number[]>([]);

  // Moneda (código) y selección (para CurrencyField)
  const [moneda, setMoneda] = useState('USD');
  const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>({
    id: 'seed',
    codigo: 'USD',
    nombre: 'USD',
    simbolo: '$',
  });

  // Data state
  const [plataformas, setPlataformas] = useState<any[]>([]);

  // UI state
  const [loadingPlataformas, setLoadingPlataformas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPlatformSearch, setShowPlatformSearch] = useState(false);

  // Animations
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;

  // Detectar si estamos en modo edición
  const isEditing = !!recurrenteExistente;

  // Debounce platform search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Animation effects (sin cambios de lógica)
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Límites de monto
  const getLimitesRecurrente = () => ({
    min: 0.01,
    max: 100000000,
    warning: 10000000,
  });

  const handleMontoValidation = (isValid: boolean, errors: string[]) => {
    setMontoValido(isValid);
    setErroresMonto(errors);
  };

  // Data fetching (solo plataformas)
  const fetchData = useCallback(async () => {
    if (!visible) return;

    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      Toast.show({ type: 'error', text1: 'Sesión expirada', text2: 'Inicia sesión nuevamente' });
      return;
    }

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    setLoadingPlataformas(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plataformas-recurrentes`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) setPlataformas(data);
      else throw new Error('Formato de respuesta inválido');
    } catch {
      Toast.show({ type: 'error', text1: 'Error al cargar plataformas', text2: 'Verifica tu conexión e intenta de nuevo' });
      setPlataformas([]);
    } finally {
      setLoadingPlataformas(false);
    }
  }, [visible]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtros
  const filteredPlataformas = useMemo(() => {
    return plataformas.filter((p) => p.nombre.toLowerCase().includes(debouncedSearch.toLowerCase()));
  }, [plataformas, debouncedSearch]);

  // Handlers UI
  const handleClose = useCallback(() => { Keyboard.dismiss(); onClose(); }, [onClose]);

  const handleMontoChange = useCallback((value: number | null) => {
    setMontoNumerico(value);
    if (errors.monto) setErrors(prev => ({ ...prev, monto: undefined }));
  }, [errors.monto]);

  const toggleRecordatorio = (valor: number) => {
    setRecordatoriosSeleccionados((prev) => prev.includes(valor) ? prev.filter((r) => r !== valor) : [...prev, valor]);
  };

  const handleFrecuenciaChange = useCallback((tipo: typeof frecuenciaTipo) => {
    setFrecuenciaTipo(tipo);
    setFrecuenciaValor('');
    if (errors.frecuencia) setErrors(prev => ({ ...prev, frecuencia: undefined }));
  }, [errors.frecuencia]);

  const handlePlatformSelect = useCallback((platform: any) => {
    setPlataforma(platform);
    setShowPlatformSearch(false);
    setSearch('');
    if (errors.plataforma) setErrors(prev => ({ ...prev, plataforma: undefined }));
  }, [errors.plataforma]);

  const resetForm = useCallback(() => {
    setNombre('');
    setPlataforma(null);
    setMontoNumerico(null);
    setMontoValido(false);
    setErroresMonto([]);
    setFrecuenciaTipo('dia_semana');
    setFrecuenciaValor('');
    setRecordatorios([]);
    setMoneda('USD');
    setSelectedMoneda({ id: 'seed', codigo: 'USD', nombre: 'USD', simbolo: '$' });
    setAfectaCuentaPrincipal(true);
    setAfectaSubcuenta(false);
    setSearch('');
    setErrors({});
    setShowPlatformSearch(false);
  }, []);

  // Guardar o actualizar
  const [loading, setLoading] = useState(false);
  const handleGuardar = async () => {
    if (!nombre || !plataforma || !frecuenciaTipo || !frecuenciaValor || !moneda || !montoNumerico || !montoValido) {
      Toast.show({ type: 'error', text1: 'Campos incompletos', text2: 'Por favor completa todos los campos requeridos' });
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
        monto: montoNumerico,
        cuentaId,
        subcuentaId: subcuentaId || null,
        afectaCuentaPrincipal: !subcuentaId,
        afectaSubcuenta: !!subcuentaId,
        recordatorios: recordatoriosSeleccionados,
      };

      const url = isEditing 
        ? `${API_BASE_URL}/recurrentes/${recurrenteExistente.recurrenteId}`
        : `${API_BASE_URL}/recurrentes`;
      
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(recurrenteData),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || `Error al ${isEditing ? 'actualizar' : 'crear'} el recurrente`);
      }

      const responseData = await res.json();
      
      Toast.show({ 
        type: 'success', 
        text1: isEditing ? 'Recurrente actualizado' : 'Recurrente creado', 
        text2: `El recurrente fue ${isEditing ? 'actualizado' : 'guardado'} correctamente` 
      });
      
      // Si estamos editando, devolvemos los datos actualizados
      if (isEditing) {
        onSubmit({ ...recurrenteExistente, ...recurrenteData });
      } else {
        onSubmit(responseData || recurrenteData);
      }
      
      onClose();
    } catch (error) {
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: `No se pudo ${isEditing ? 'actualizar' : 'guardar'} el recurrente. Intenta de nuevo.` 
      });
    } finally {
      setLoading(false);
    }
  };

  // Prefill si editas
  useEffect(() => {
    if (recurrenteExistente && visible) {
      setNombre(recurrenteExistente.nombre || '');
      setPlataforma(recurrenteExistente.plataforma || null);

      const montoParsed = toNumber(
        recurrenteExistente.monto ?? recurrenteExistente.amount ?? recurrenteExistente.cantidad
      );
      setMontoNumerico(montoParsed);
      setMontoValido(!!montoParsed && montoParsed > 0);

      setFrecuenciaTipo(recurrenteExistente.frecuenciaTipo || 'dia_semana');
      setFrecuenciaValor(recurrenteExistente.frecuenciaValor || '');
      const recs = recurrenteExistente.recordatorios || [];
      setRecordatorios(recs);
      setRecordatoriosSeleccionados(recs);

      const code = recurrenteExistente.moneda || recurrenteExistente.currency || 'USD';
      setMoneda(code);
      setSelectedMoneda({
        id: 'seed',
        codigo: code,
        nombre: code,
        simbolo: recurrenteExistente.simbolo || '$',
      });

      setAfectaCuentaPrincipal(recurrenteExistente.afectaCuentaPrincipal ?? true);
      setAfectaSubcuenta(recurrenteExistente.afectaSubcuenta ?? false);
    }
  }, [recurrenteExistente, visible]);

  // Prefill si vienes con props "recurrente" o reseteo
  useEffect(() => {
    if (!recurrenteExistente) {
      if (recurrente) {
        setNombre(recurrente.nombre || '');
        setPlataforma(recurrente.plataforma || null);
        setFrecuenciaTipo(recurrente.frecuenciaTipo || 'dia_semana');
        setFrecuenciaValor(recurrente.frecuenciaValor || '');
        setMontoNumerico(recurrente.monto || null);
        const code = recurrente.moneda || 'USD';
        setMoneda(code);
        setSelectedMoneda({ id: 'seed', codigo: code, nombre: code, simbolo: recurrente.simbolo || '$' });
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
      <Animated.View style={[styles.errorContainer, { opacity: fadeAnim }]}>
        <Ionicons name="alert-circle" size={16} color="#92400E" />
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
      style={[styles.listItem, plataforma?.plataformaId === platform.plataformaId && styles.listItemSelected]}
      activeOpacity={0.8}
    >
      <View style={styles.listItemContent}>
        <View style={[styles.colorIndicator, { backgroundColor: platform.color }]} />
        <View style={styles.listItemTextContainer}>
          <Text style={styles.listItemTitle}>{platform.nombre}</Text>
          <Text style={styles.listItemSubtitle}>{platform.categoria}</Text>
        </View>
        {plataforma?.plataformaId === platform.plataformaId && (
          <Ionicons name="checkmark-circle" size={20} color="#EF7725" />
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
            style={[styles.chip,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              frecuenciaTipo === freq.tipo && { backgroundColor: colors.button, borderColor: colors.button }
            ]}
            activeOpacity={0.9}
          >
            <Ionicons
              name={freq.icon as any}
              size={16}
              color={frecuenciaTipo === freq.tipo ? colors.buttonText : colors.textSecondary}
              style={styles.chipIcon}
            />
            <Text style={[styles.chipText, { color: colors.text }, frecuenciaTipo === freq.tipo && { color: colors.buttonText, fontWeight: '700' }]}>
              {freq.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // PanResponder para deslizar hacia abajo y cerrar el modal
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Solo activar si el usuario desliza verticalmente hacia abajo
        return Math.abs(gestureState.dy) > 10 && gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80) {
          Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }).start(() => {
            panY.setValue(0);
            handleClose();
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  if (!visible) return null;

  // Convierte varios formatos de número a number o null
  const toNumber = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && !isNaN(v)) return v;
    // soporta "1,234.56", "$1,234.56", "1 234,56", etc.
    const s = String(v).replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
    // si hay coma y punto, intenta detectar formato "1.234,56" -> 1234.56
    if (s.includes(',') && s.includes('.')) {
      const lastComma = s.lastIndexOf(',');
      const normalized = s
        .replace(/\./g, '')        // miles
        .replace(',', '.');        // decimal
      return parseFloat(normalized);
    }
    // si solo hay coma, trátala como decimal
    const normalized = s.replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? null : n;
  };

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} pointerEvents="none">
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} pointerEvents="auto" />
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
          <Animated.View
            style={[
              styles.modal,
              { backgroundColor: colors.card },
              {
                transform: [
                  { translateY: Animated.add(slideAnim, panY) },
                  { scale: scaleAnim }
                ],
              },
            ]}
          >
            {/* Handle con PanResponder */}
            <View
              style={[styles.handle, { backgroundColor: colors.border }]}
              {...panResponder.panHandlers}
            />

            <View style={styles.header}>
              {/* Icono de recurrente al lado del título */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="repeat" size={20} color="#EF7725" style={{ marginRight: 8 }} />
                <Text style={[styles.title, { color: colors.text }]}>
                  {isEditing ? 'Editar Recurrente' : 'Nuevo Recurrente'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
              keyboardShouldPersistTaps="handled"
            >
              {/* Nombre */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Nombre del Recurrente</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }, errors.nombre && styles.inputError]}
                  value={nombre}
                  onChangeText={(text) => {
                    setNombre(text);
                    if (errors.nombre) setErrors(prev => ({ ...prev, nombre: undefined }));
                  }}
                  placeholder="Ej. Spotify Premium, Netflix, Gym..."
                  placeholderTextColor={colors.placeholder}
                  maxLength={50}
                />
                {renderError(errors.nombre)}
              </View>

              {/* Plataforma */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Plataforma</Text>
                <TouchableOpacity
                  style={[styles.selectorButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }, errors.plataforma && styles.inputError]}
                  onPress={() => setShowPlatformSearch(!showPlatformSearch)}
                  activeOpacity={0.9}
                >
                  {plataforma ? (
                    <View style={styles.selectedItemContainer}>
                      <View style={[styles.colorIndicator, { backgroundColor: plataforma.color }]} />
                      <Text style={[styles.selectedItemText, { color: colors.text }]}>{plataforma.nombre}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.placeholderText, { color: colors.placeholder }]}>Selecciona una plataforma</Text>
                  )}
                  <Ionicons name={showPlatformSearch ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                {renderError(errors.plataforma)}

                {showPlatformSearch && (
                  <View style={[styles.searchContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                    <View style={[styles.searchInputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                      <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                      <TextInput
                        style={[styles.searchInput, { color: colors.inputText }]}
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Buscar plataforma..."
                        placeholderTextColor={colors.placeholder}
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

              {/* Moneda */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Moneda</Text>
                <CurrencyField
                  label=""
                  value={selectedMoneda}
                  onChange={(m) => {
                    setSelectedMoneda(m);
                    setMoneda(m.codigo);
                    if (errors.moneda) setErrors(prev => ({ ...prev, moneda: undefined }));
                  }}
                  showSearch
                />
                {renderError(errors.moneda)}
              </View>

              {/* Monto */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Monto</Text>
                <View>
                  <SmartInput
                    key={`monto-${recurrenteExistente?.recurrenteId || 'new'}-${montoNumerico ?? 'nil'}`}
                    type="currency"
                    placeholder="0.00"
                    prefix={selectedMoneda?.simbolo || '$'}
                    initialValue={montoNumerico ?? undefined}
                    {...getLimitesRecurrente()}
                    onValueChange={handleMontoChange}
                    onValidationChange={handleMontoValidation}
                    style={StyleSheet.flatten([...(errors.monto ? [styles.inputError] : []), { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }])}
                    autoFix
                  />
                </View>
                {renderError(errors.monto)}

                {erroresMonto.length > 0 && (
                  <View style={[styles.warningContainer, { backgroundColor: colors.backgroundSecondary, borderLeftColor: colors.warning }]}> 
                    <Ionicons name="warning-outline" size={16} color={colors.warning} />
                    <View style={styles.warningContent}>
                      <Text style={[styles.warningTitle, { color: colors.error }]}>Monto muy grande</Text>
                      <Text style={[styles.warningText, { color: colors.error }]}> 
                        Monto:{' '}
                        <SmartNumber
                          value={montoNumerico || 0}
                          options={{ context: 'modal', symbol: selectedMoneda?.simbolo || '$' }}
                        />
                      </Text>
                      <Text style={[styles.warningSubtext, { color: colors.warning }]}>{erroresMonto[0]}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Frecuencia */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Frecuencia</Text>
                {renderFrequencySelector()}
                {renderError(errors.frecuencia)}

                {frecuenciaTipo === 'dia_semana' && (
                  <View style={styles.chipContainer}>
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setFrecuenciaValor(String(index))}
                        style={[styles.dayChip,
                          { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                          frecuenciaValor === String(index) && { backgroundColor: colors.button, borderColor: colors.button }
                        ]}
                        activeOpacity={0.9}
                      >
                        <Text style={[styles.chipText, { color: colors.text }, frecuenciaValor === String(index) && { color: colors.buttonText, fontWeight: '700' }]}>
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
                        style={[styles.dayChip,
                          { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                          frecuenciaValor === String(day) && { backgroundColor: colors.button, borderColor: colors.button }
                        ]}
                        activeOpacity={0.9}
                      >
                        <Text style={[styles.chipText, { color: colors.text }, frecuenciaValor === String(day) && { color: colors.buttonText, fontWeight: '700' }]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {frecuenciaTipo === 'fecha_fija' && (
                  <>
                    <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Selecciona el mes</Text>
                    <View style={styles.chipContainer}>
                      {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((mes, index) => (
                        <TouchableOpacity
                          key={mes}
                          onPress={() => setFrecuenciaValor(`${index + 1}-1`)}
                          style={[styles.chip,
                            { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                            frecuenciaValor.startsWith(`${index + 1}-`) && { backgroundColor: colors.button, borderColor: colors.button }
                          ]}
                          activeOpacity={0.9}
                        >
                          <Text style={[styles.chipText, { color: colors.text }, frecuenciaValor.startsWith(`${index + 1}-`) && { color: colors.buttonText, fontWeight: '700' }]}>
                            {mes}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {frecuenciaValor.includes('-') && (
                      <>
                        <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Selecciona el día</Text>
                        <View style={styles.chipContainer}>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                            const [mes] = frecuenciaValor.split('-');
                            const nuevaFecha = `${mes}-${day}`;
                            return (
                              <TouchableOpacity
                                key={day}
                                onPress={() => setFrecuenciaValor(nuevaFecha)}
                                style={[styles.dayChip,
                                  { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                                  frecuenciaValor === nuevaFecha && { backgroundColor: colors.button, borderColor: colors.button }
                                ]}
                                activeOpacity={0.9}
                              >
                                <Text style={[styles.chipText, { color: colors.text }, frecuenciaValor === nuevaFecha && { color: colors.buttonText, fontWeight: '700' }]}>
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

              {/* Recordatorios */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Recordatorios</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>Te notificaremos antes del próximo pago</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  {[1, 3, 7].map((dias) => (
                    <TouchableOpacity
                      key={dias}
                      onPress={() => toggleRecordatorio(dias)}
                      style={[styles.reminderButton,
                        { backgroundColor: colors.cardSecondary },
                        recordatoriosSeleccionados.includes(dias) && { backgroundColor: colors.button }
                      ]}
                      activeOpacity={0.9}
                    >
                      <Ionicons
                        name="alarm-outline"
                        size={16}
                        color={recordatoriosSeleccionados.includes(dias) ? colors.buttonText : colors.textSecondary}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[styles.reminderText, { color: recordatoriosSeleccionados.includes(dias) ? colors.buttonText : colors.text }]}>
                        {dias === 1 ? '1 día antes' : dias === 3 ? '3 días antes' : '1 semana antes'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Config de cuenta */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Configuración de Cuenta</Text>

                {!subcuentaId && (
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                      <Text style={[styles.switchLabel, { color: colors.text }]}>Afectar cuenta principal</Text>
                      <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>El monto se descontará de la cuenta principal</Text>
                    </View>
                    <Switch
                      value={afectaCuentaPrincipal}
                      onValueChange={setAfectaCuentaPrincipal}
                      trackColor={{ false: '#e2e8f0', true: '#EF7725' }}
                      thumbColor={afectaCuentaPrincipal ? '#ffffff' : '#f1f5f9'}
                    />
                  </View>
                )}

                {subcuentaId && (
                  <View style={styles.switchRow}>
                    <View style={styles.switchLabelContainer}>
                      <Text style={[styles.switchLabel, { color: colors.text }]}>Afectar subcuenta</Text>
                      <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>El monto se descontará de la subcuenta seleccionada</Text>
                    </View>
                    <Switch
                      value={afectaSubcuenta}
                      onValueChange={setAfectaSubcuenta}
                      trackColor={{ false: '#e2e8f0', true: '#EF7725' }}
                      thumbColor={afectaSubcuenta ? '#ffffff' : '#f1f5f9'}
                    />
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Acciones (solo botón guardar, sin cancelar) */}
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={[ 
                  styles.saveButton,
                  { 
                    backgroundColor: saving ? colors.button + '99' : colors.button, // faded when saving
                    borderColor: colors.button,
                    shadowColor: colors.button,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.18,
                    shadowRadius: 4,
                    elevation: 3,
                  },
                ]}
                onPress={handleGuardar}
                disabled={saving}
                activeOpacity={0.95}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.buttonText} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color={colors.buttonText} style={styles.saveButtonIcon} />
                    <Text style={[styles.saveButtonText, { color: colors.buttonText, fontWeight: '700', letterSpacing: 0.5 }] }>
                      {isEditing ? 'Actualizar' : 'Guardar'}
                    </Text>
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
  /** Overlay/backdrop como MovementModal */
  overlay: { flex: 1, justifyContent: 'flex-end', margin: 0 },
  backdrop: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: -1,                               // ✅ por detrás del sheet
  },
  /** Sheet principal: bordes & paddings como MovementModal */
  keyboardAvoid: { flex: 1, justifyContent: 'flex-end' },
  modal: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: SCREEN_HEIGHT * 0.95,
    minHeight: SCREEN_HEIGHT * 0.6,
  },

  /** Handle y header (idéntico look) */
  handle: {
    width: 40,
    height: 5,
    borderRadius: 5,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '600' },
  closeButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  /** Scroll & grupos */
  scrollView: { flex: 1 },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingBottom: 20, 
    flexGrow: 1,
  },
  inputGroup: { marginBottom: 22 },

  /** Tipografías e inputs como MovementModal */
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  subLabel: { fontSize: 13, fontWeight: '500', marginTop: 12, marginBottom: 8 },
  description: { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  inputError: { borderWidth: 2 },

  /** Selector de plataforma */
  selectorButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedItemContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectedItemText: { fontSize: 14, fontWeight: '500', marginLeft: 10 },
  placeholderText: { fontSize: 14 },
  colorIndicator: { width: 20, height: 20, borderRadius: 10, marginRight: 6 },

  /** Buscador de plataformas */
  searchContainer: {
    marginTop: 12, borderWidth: 1, borderRadius: 14, maxHeight: 280,
  },
  searchInputContainer: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  listContainer: { maxHeight: 200 },
  listItem: { paddingVertical: 12, paddingHorizontal: 16 },
  listItemSelected: {},
  listItemContent: { flexDirection: 'row', alignItems: 'center' },
  listItemTextContainer: { flex: 1, marginLeft: 10 },
  listItemTitle: { fontSize: 14, fontWeight: '500', marginBottom: 1 },
  listItemSubtitle: { fontSize: 12 },
  emptyState: { padding: 36, alignItems: 'center' },
  emptyStateText: { fontSize: 14, fontWeight: '500', marginTop: 10, marginBottom: 2 },
  emptyStateSubtext: { fontSize: 12, textAlign: 'center' },

  /** Chips y estados */
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20,
  },
  chipSelected: {},
  chipIcon: { marginRight: 6 },
  chipText: { fontSize: 13 },
  chipTextSelected: { fontWeight: '700' },
  dayChip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, minWidth: 40, alignItems: 'center',
  },

  /** Switches */
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  switchLabelContainer: { flex: 1, marginRight: 12 },
  switchLabel: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  switchDescription: { fontSize: 12 },

  /** Botonera (idéntica) */
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    gap: 12,
  },
  saveButton: {
    flex: 2, flexDirection: 'row', paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center'
  },
  saveButtonDisabled: {},
  saveButtonIcon: { marginRight: 6 },
  saveButtonText: { fontSize: 14, fontWeight: '700' },

  /** Warnings y errores iguales */
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
  warningContent: { flex: 1, marginLeft: 8 },
  warningTitle: { fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 4 },
  warningText: { fontSize: 12, color: '#92400E', marginBottom: 2 },
  warningSubtext: { fontSize: 11, color: '#A16207', fontStyle: 'italic' },

  errorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingHorizontal: 2 },
  errorText: { fontSize: 13, color: '#92400E', marginLeft: 4, fontWeight: '600' },

  /** Skeleton como lista */
  skeletonContainer: { paddingVertical: 10, paddingHorizontal: 16 },
  skeleton: { borderRadius: 6, height: 18 },
  reminderButton: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18, marginHorizontal: 4,
  },
  reminderButtonSelected: {},
  reminderText: { fontSize: 10 },
});

export default RecurrentModal;
