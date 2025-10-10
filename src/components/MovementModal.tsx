import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  ViewStyle
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from '../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import ConceptsManager from './ConceptsManager';
import SmartInput from './SmartInput';
import SmartNumber from './SmartNumber';
import { CurrencyField, Moneda } from '../components/CurrencyPicker';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onClose: () => void;
  tipo: 'ingreso' | 'egreso';
  cuentaId: string;
  onSuccess: () => void;
  isSubcuenta?: boolean;
  subcuentaId?: string;
  onRefresh?: () => void;
}

interface Concepto {
  conceptoId: string;
  nombre: string;
  color: string;
  icono: string;
}

const MovementModal: React.FC<Props> = ({
  visible,
  onClose,
  tipo,
  cuentaId,
  onSuccess,
  isSubcuenta,
  subcuentaId,
  onRefresh
}) => {
  const [montoNumerico, setMontoNumerico] = useState<number | null>(null);
  const [montoValido, setMontoValido] = useState(false);
  const [erroresMonto, setErroresMonto] = useState<string[]>([]);

  const [motivo, setMotivo] = useState('');
  const [afectaCuenta, setAfectaCuenta] = useState(true);

  // ✅ Estados de moneda
  const [moneda, setMoneda] = useState('MXN');
  const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>({
    id: 'seed',
    codigo: 'MXN',
    nombre: 'Peso mexicano',
    simbolo: '$',
  });

  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [conceptoBusqueda, setConceptoBusqueda] = useState('');
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState<Concepto | null>(null);
  const [showConceptsManager, setShowConceptsManager] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();

  const getLimitesPorTipo = () => {
    const baseLimit = isSubcuenta ? 1_000_000 : 10_000_000;
    return tipo === 'egreso'
      ? { maxValue: baseLimit, minValue: 0.01, warningThreshold: baseLimit * 0.1 }
      : { maxValue: baseLimit * 10, minValue: 0.01, warningThreshold: baseLimit * 0.5 };
  };

  const handleMontoChange = (value: number | null) => setMontoNumerico(value);
  const handleValidationChange = (isValid: boolean, errors: string[]) => {
    setMontoValido(isValid);
    setErroresMonto(errors);
  };

  const getSymbolForCurrency = (currency: string): string => {
    const symbols: Record<string, string> = {
      MXN: '$',
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CNY: '¥',
    };
    return symbols[currency] || '$';
  };

  const fetchCuentaYConceptos = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Token no encontrado');

      const [resCuentaRaw, resConceptosRaw] = await Promise.all([
        fetch(`${API_BASE_URL}/cuenta/principal`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/conceptos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [resCuenta, resConceptos] = await Promise.all([
        resCuentaRaw.json(),
        resConceptosRaw.json(),
      ]);

      const codigo = resCuenta?.moneda || 'MXN';
      const symbol = resCuenta?.simbolo || getSymbolForCurrency(codigo);
      setMoneda(codigo);
      setSelectedMoneda({
        id: 'seed',
        codigo,
        nombre: codigo,
        simbolo: symbol,
      });

      if (Array.isArray(resConceptos?.resultados)) {
        setConceptos(resConceptos.resultados);
      } else {
        throw new Error('Respuesta inválida de conceptos');
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al cargar datos',
        text2: err.message || 'No se pudieron cargar cuenta ni conceptos.',
      });
    }
  };

  const handleSend = async () => {
    if (!montoNumerico || !montoValido || !motivo.trim()) {
      return Toast.show({ type: 'error', text1: 'Datos incompletos', text2: 'Verifica el monto y el motivo.' });
    }

    if (erroresMonto.some((e) => e.includes('muy grande'))) {
      Toast.show({ type: 'warning', text1: 'Monto inusualmente grande', text2: '¿Seguro que es correcto?' });
    }

    const conceptoFinal = conceptoSeleccionado?.nombre || motivo.trim();
    if (!conceptoFinal) {
      return Toast.show({ type: 'error', text1: 'Concepto requerido', text2: 'Selecciona o escribe un concepto.' });
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const payload = {
        tipo,
        monto: montoNumerico,
        concepto: conceptoFinal,
        motivo,
        moneda,
        cuentaId,
        afectaCuenta,
        ...(isSubcuenta && subcuentaId ? { subCuentaId: subcuentaId } : {}),
      };

      const res = await fetch(`${API_BASE_URL}/transacciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error((await res.json())?.message || 'Error al guardar');

      Toast.show({ type: 'success', text1: 'Movimiento guardado' });
      onRefresh?.();
      setMontoNumerico(null);
      setMontoValido(false);
      setErroresMonto([]);
      setMotivo('');
      setConceptoSeleccionado(null);
      onSuccess();
      onClose();

      if (isSubcuenta) navigation.navigate('Dashboard', { updated: true });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err?.message || 'No se pudo guardar' });
    } finally {
      setLoading(false);
    }
  };

  const conceptosFiltrados = conceptoBusqueda.length === 0
    ? conceptos
    : conceptos.filter(c => c.nombre.toLowerCase().includes(conceptoBusqueda.toLowerCase()));

  useEffect(() => {
    if (visible) fetchCuentaYConceptos();
    else {
      setMontoNumerico(null);
      setMontoValido(false);
      setErroresMonto([]);
      setMotivo('');
      setConceptoBusqueda('');
      setConceptoSeleccionado(null);
    }
  }, [visible]);

  const icon = tipo === 'ingreso' ? 'arrow-up-outline' : 'arrow-down-outline';
  const color = tipo === 'ingreso' ? '#4CAF50' : '#F44336';

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modalContainer}
      backdropOpacity={0.15}
      animationIn="fadeIn"
      animationOut="fadeOut"
      useNativeDriver={false}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modal}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Ionicons name={icon} size={22} color={color} />
          <Text style={styles.title}>Agregar {tipo}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <SmartInput
            type="currency"
            initialValue={0}
            context="transaction"
            maxValue={getLimitesPorTipo().maxValue}
            minValue={getLimitesPorTipo().minValue}
            onValueChange={handleMontoChange}
            onValidationChange={handleValidationChange}
            prefix={selectedMoneda?.simbolo || getSymbolForCurrency(moneda)}
            clearable
            autoFix
            style={StyleSheet.flatten([{ flex: 1, marginRight: 8, marginTop: 8 }])}
            placeholder="0.00"
          />

          {/* ✅ CurrencyField para seleccionar moneda */}
          <View style={{ minWidth: 120 }}>
            <CurrencyField
              value={selectedMoneda}
              onChange={(m) => {
                setSelectedMoneda(m);
                setMoneda(m.codigo);
              }}
              showSearch
            />
          </View>
        </View>

        {montoNumerico && montoNumerico >= getLimitesPorTipo().warningThreshold && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning-outline" size={16} color="#F59E0B" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Monto inusualmente grande</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.warningText}>Has ingresado: </Text>
                <SmartNumber
                  value={montoNumerico}
                  options={{ context: 'detail', symbol: selectedMoneda?.simbolo || getSymbolForCurrency(moneda) }}
                  textStyle={[styles.warningText, styles.warningAmount]}
                />
              </View>
              <Text style={styles.warningSubtext}>Verifica que sea correcto antes de continuar.</Text>
            </View>
          </View>
        )}

        <TextInput
          placeholder="Motivo"
          value={motivo}
          onChangeText={setMotivo}
          style={styles.input}
          placeholderTextColor="#aaa"
        />

        <View style={styles.conceptoHeader}>
          <TextInput
            placeholder="Busca o escribe un concepto rápido"
            placeholderTextColor="#999"
            value={conceptoBusqueda}
            onChangeText={setConceptoBusqueda}
            style={[styles.input, { flex: 1, fontSize: 12 }]}
          />
          <TouchableOpacity onPress={() => setShowConceptsManager(true)}>
            <Text style={styles.adminLink}>+ Conceptos</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.conceptosText}>Tus conceptos</Text>
        <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.conceptosBox}>
          {conceptosFiltrados.map((item) => {
            const isSelected = conceptoSeleccionado?.conceptoId === item.conceptoId;
            return (
              <TouchableOpacity
                key={item.conceptoId}
                onPress={() => setConceptoSeleccionado(isSelected ? null : item)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                <Text style={styles.chipText}>{item.icono} {item.nombre}</Text>
              </TouchableOpacity>
            );
          })}
          {conceptosFiltrados.length === 0 && (
            <Text style={{ color: '#888', fontSize: 12 }}>Sin resultados…</Text>
          )}
        </ScrollView>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Afecta cuenta principal</Text>
          <Switch value={afectaCuenta} onValueChange={setAfectaCuenta} />
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: color }]} onPress={handleSend} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Guardando...' : 'Guardar'}</Text>
        </TouchableOpacity>

        {/* Gestor de conceptos */}
        <Modal
          isVisible={showConceptsManager}
          onBackdropPress={() => setShowConceptsManager(false)}
          backdropOpacity={0.4}
          animationIn="fadeIn"
          animationOut="fadeOut"
          useNativeDriver={false}
          style={{ justifyContent: 'center', alignItems: 'center', margin: 0 }}
        >
          <View style={styles.subModalCard}>
            <ConceptsManager
              onClose={() => {
                setShowConceptsManager(false);
                fetchCuentaYConceptos();
              }}
            />
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { justifyContent: 'flex-end', margin: 0 },
  modal: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: SCREEN_HEIGHT * 0.95,
  },
  conceptoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
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
  title: { fontSize: 18, fontWeight: '600', color: '#333' },
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  adminLink: { marginLeft: 8, fontSize: 13, color: '#EF7725', fontWeight: '500' },
  conceptosText: { fontSize: 14, fontWeight: '500', color: '#444', marginBottom: 8 },
  conceptosBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: { backgroundColor: '#f0f0f0', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, margin: 3 },
  chipSelected: { backgroundColor: '#EF7725' },
  chipText: { fontSize: 13, color: '#000' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  switchLabel: { fontSize: 14, color: '#444' },
  button: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  buttonText: { color: '#fff', fontWeight: '600' },
  subModalCard: { width: '90%', maxHeight: '85%', backgroundColor: '#f0f0f3', borderRadius: 20, padding: 20 },
  smartInputContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  smartInputOuter: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 10,
  },
  smartInputText: {
    fontSize: 14,
    color: '#333',
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
  warningContent: { flex: 1, marginLeft: 8 },
  warningTitle: { fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 4 },
  warningText: { fontSize: 12, color: '#92400E', marginBottom: 2 },
  warningAmount: { fontWeight: '700', color: '#92400E' },
  warningSubtext: { fontSize: 11, color: '#A16207', fontStyle: 'italic' },
});

export default MovementModal;
