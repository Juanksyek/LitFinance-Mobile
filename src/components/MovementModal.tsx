import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch, Dimensions } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_URL } from '../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import ConceptsManager from './ConceptsManager';

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

const MovementModal: React.FC<Props> = ({ visible, onClose, tipo, cuentaId, onSuccess, isSubcuenta, subcuentaId, onRefresh }) => {
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [afectaCuenta, setAfectaCuenta] = useState(true);
  const [moneda, setMoneda] = useState('MXN');
  const [monedas, setMonedas] = useState<string[]>([]);
  const [monedaModalVisible, setMonedaModalVisible] = useState(false);

  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [conceptoBusqueda, setConceptoBusqueda] = useState('');
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState<Concepto | null>(null);
  const [showConceptsManager, setShowConceptsManager] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();

  const fetchMonedasYConceptos = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Token no encontrado');

      const [resMonedasRaw, resCuentaRaw, resConceptosRaw] = await Promise.all([
        fetch(`${API_BASE_URL}/monedas`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/cuenta/principal`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/conceptos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [resMonedas, resCuenta, resConceptos] = await Promise.all([
        resMonedasRaw.json(),
        resCuentaRaw.json(),
        resConceptosRaw.json(),
      ]);

      const listaMonedas = Array.isArray(resMonedas)
        ? resMonedas.map((m: any) => m.codigo || m.clave || m.simbolo).filter(Boolean)
        : [];

      setMonedas(listaMonedas);
      setMoneda(resCuenta?.moneda || 'MXN');

      if (Array.isArray(resConceptos?.resultados)) {
        setConceptos(resConceptos.resultados);
      } else {
        throw new Error('Respuesta inválida de conceptos');
      }
    } catch (err: any) {
      console.error('Error al cargar datos:', err);
      Toast.show({
        type: 'error',
        text1: 'Error al cargar datos',
        text2: err.message || 'No se pudieron cargar monedas ni conceptos.',
      });
    }
  };

  const handleSend = async () => {
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0 || !motivo.trim()) {
      return Toast.show({
        type: 'error',
        text1: 'Campos inválidos',
        text2: 'Debes ingresar un monto válido y un motivo.',
      });
    }

    const conceptoFinal = conceptoSeleccionado?.nombre || motivo.trim();

    if (!conceptoFinal) {
      return Toast.show({
        type: 'error',
        text1: 'Concepto requerido',
        text2: 'Debes seleccionar un concepto o escribir uno en el motivo.',
      });
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const payload = {
        tipo,
        monto: parseFloat(monto),
        concepto: conceptoFinal,
        motivo,
        moneda,
        cuentaId,
        afectaCuenta,
        ...(isSubcuenta && subcuentaId ? { subCuentaId: subcuentaId } : {}),
      };

      console.log('🟠 Enviando movimiento:', payload);

      const res = await fetch(`${API_BASE_URL}/transacciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Error al guardar el movimiento');
      }

      Toast.show({ type: 'success', text1: 'Movimiento guardado' });

      if (onRefresh) onRefresh();

      setMonto('');
      setMotivo('');
      setConceptoSeleccionado(null);
      onSuccess();
      onClose();

      if (isSubcuenta) {
        navigation.navigate('Dashboard', { updated: true });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err?.message || 'No se pudo guardar',
      });
    } finally {
      setLoading(false);
    }
  };

  const conceptosFiltrados = conceptoBusqueda.length === 0
    ? conceptos
    : conceptos.filter(c =>
        c.nombre.toLowerCase().includes(conceptoBusqueda.toLowerCase())
      );

  useEffect(() => {
    if (visible) fetchMonedasYConceptos();
    else {
      setMonto('');
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
          <TextInput
            placeholder="Monto"
            keyboardType="numeric"
            value={monto}
            onChangeText={setMonto}
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity style={styles.monedaBox} onPress={() => setMonedaModalVisible(true)}>
            <Text style={styles.monedaText}>{moneda}</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>

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
            style={[styles.input, { flex: 1, color: '#000', fontSize: 12 }]}
          />
          <TouchableOpacity onPress={() => setShowConceptsManager(true)}>
            <Text style={styles.adminLink}>+ Conceptos</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.conceptosText}>Tus conceptos</Text>
        <View style={styles.conceptosBox}>
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
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Afecta cuenta principal</Text>
          <Switch value={afectaCuenta} onValueChange={setAfectaCuenta} />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: color }]}
          onPress={handleSend}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Guardando...' : 'Guardar'}</Text>
        </TouchableOpacity>

        <Modal
          isVisible={monedaModalVisible}
          onBackdropPress={() => setMonedaModalVisible(false)}
          onBackButtonPress={() => setMonedaModalVisible(false)}
          style={{ justifyContent: 'flex-end', margin: 0 }}
          backdropOpacity={0.5}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          propagateSwipe={false}
          avoidKeyboard={false}
        >
          <View style={styles.monedaModal}>
            <Text style={styles.monedaModalTitle}>Selecciona una moneda</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {monedas.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => {
                    setMoneda(m);
                    setMonedaModalVisible(false);
                  }}
                  style={styles.monedaOption}
                >
                  <Text style={{ fontSize: 16 }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

        <Modal
          isVisible={showConceptsManager}
          onBackdropPress={() => setShowConceptsManager(false)}
          backdropOpacity={0.4}
          hasBackdrop={true}
          animationIn="zoomIn"
          animationOut="zoomOut"
          backdropTransitionOutTiming={0}
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            margin: 0,
          }}
          useNativeDriver={true}
          hideModalContentWhileAnimating={true}
          avoidKeyboard={false}
          propagateSwipe={false}
        >
          <View style={styles.subModalCard}>
            <ConceptsManager onClose={() => {
              setShowConceptsManager(false);
              fetchMonedasYConceptos();
            }} />
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modal: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: SCREEN_HEIGHT * 0.95,
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monedaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
    marginTop: -10,
  },
  monedaText: {
    fontSize: 14,
    color: '#333',
    marginRight: 4,
    textAlignVertical: 'center',
  },
  monedaModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '60%',
  },
  monedaModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  monedaOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  conceptoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  adminLink: {
    marginLeft: 8,
    fontSize: 13,
    color: '#EF7725',
    fontWeight: '500',
  },
  conceptosText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#444',
    marginBottom: 8,
  },
  conceptosBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: '#EF7725',
  },
  chipText: {
    fontSize: 13,
    color: '#000',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  switchLabel: {
    fontSize: 14,
    color: '#444',
  },
  button: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  subModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  subModalCard: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#f0f0f3',
    borderRadius: 20,
    padding: 20,
  },
});

export default MovementModal;
