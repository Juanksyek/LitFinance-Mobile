import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, Switch } from 'react-native';
import Modal from 'react-native-modal';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_URL } from '../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Picker } from '@react-native-picker/picker';
import ConceptsManager from './ConceptsManager';


interface Props {
  visible: boolean;
  onClose: () => void;
  tipo: 'ingreso' | 'egreso';
  cuentaId: string;
  onSuccess: () => void;
}

interface Concepto {
  conceptoId: string;
  nombre: string;
  color: string;
  icono: string;
}

const MovementModal: React.FC<Props> = ({ visible, onClose, tipo, cuentaId, onSuccess }) => {
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [afectaCuenta, setAfectaCuenta] = useState(true);
  const [moneda, setMoneda] = useState('MXN');
  const [monedas, setMonedas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [conceptoBusqueda, setConceptoBusqueda] = useState('');
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState<Concepto | null>(null);
  const [showConceptsManager, setShowConceptsManager] = useState(false);

  const fetchMonedasYConceptos = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error("Token no encontrado");

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
        : Array.isArray(resMonedas?.monedas)
          ? resMonedas.monedas.map((m: any) => m.codigo || m.clave || m.simbolo).filter(Boolean)
          : [];

      if (listaMonedas.length === 0) throw new Error('No se encontraron monedas válidas');
      setMonedas(listaMonedas);

      setMoneda(resCuenta?.moneda || 'MXN');

      if (!Array.isArray(resConceptos?.resultados)) {
        console.error('❌ Conceptos no válidos:', resConceptos);
        throw new Error('Respuesta inválida de conceptos');
      }

      setConceptos(resConceptos.resultados);
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
    if (!monto || isNaN(Number(monto)) || Number(monto) <= 0 || !motivo || !conceptoSeleccionado) {
      return Toast.show({
        type: 'error',
        text1: 'Campos inválidos',
        text2: 'Llena todos los campos y selecciona un concepto.',
      });
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      await fetch(`${API_BASE_URL}/transacciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tipo,
          monto: parseFloat(monto),
          concepto: conceptoSeleccionado.nombre,
          motivo,
          moneda,
          cuentaId,
          afectaCuenta,
        }),
      });

      Toast.show({ type: 'success', text1: 'Movimiento guardado' });
      setMonto('');
      setMotivo('');
      setConceptoSeleccionado(null);
      onSuccess();
      onClose();
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
      onSwipeComplete={onClose}
      swipeDirection="down"
      onBackdropPress={onClose}
      backdropOpacity={0}
      style={styles.modalContainer}
    >
      <View style={[styles.modal, styles.neumorphic]}>
        <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
          <Ionicons name="close-outline" size={28} color="#888" />
        </TouchableOpacity>

        <Ionicons name={icon} size={32} color={color} style={{ marginBottom: 10 }} />
        <Text style={styles.title}>Agregar {tipo}</Text>

        <TextInput
          placeholder="Monto"
          keyboardType="numeric"
          value={monto}
          onChangeText={setMonto}
          style={styles.input}
          placeholderTextColor="#aaa"
        />

        <Text style={styles.label}>Concepto:</Text>
        <TextInput
          placeholder="Buscar concepto..."
          value={conceptoBusqueda}
          onChangeText={setConceptoBusqueda}
          style={styles.input}
        />

        <TouchableOpacity onPress={() => setShowConceptsManager(true)} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>+ Administrar conceptos</Text>
        </TouchableOpacity>

        <FlatList
          data={conceptosFiltrados}
          keyExtractor={(item) => item.conceptoId}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setConceptoSeleccionado(item)}
              style={[
                styles.conceptoItem,
                conceptoSeleccionado?.conceptoId === item.conceptoId && styles.conceptoSeleccionado,
              ]}
            >
              <Text style={{ fontSize: 16 }}>{item.icono} {item.nombre}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#999' }}>No hay conceptos disponibles.</Text>}
          style={{ maxHeight: 100, marginBottom: 12 }}
        />

        <TextInput
          placeholder="Motivo"
          value={motivo}
          onChangeText={setMotivo}
          style={styles.input}
          placeholderTextColor="#aaa"
        />

        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Moneda:</Text>
          <Picker
            selectedValue={moneda}
            onValueChange={setMoneda}
            style={styles.picker}
          >
            {monedas.map((m) => (
              <Picker.Item key={m} label={m} value={m} />
            ))}
          </Picker>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Afecta cuenta principal:</Text>
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
          isVisible={showConceptsManager}
          onBackdropPress={() => setShowConceptsManager(false)}
          backdropOpacity={0.3}
          style={styles.conceptsModal}
        >
          <View style={styles.conceptsContainer}>
            <ConceptsManager onClose={() => {
              setShowConceptsManager(false);
              fetchMonedasYConceptos();
            }} />
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  neumorphic: {
    backgroundColor: '#f0f0f3',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  closeIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    marginTop: 28,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    fontSize: 16,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
    marginBottom: 4,
    color: '#333',
  },
  pickerContainer: {
    marginVertical: 8,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  button: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  conceptoItem: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  conceptoSeleccionado: {
    backgroundColor: '#EF772530',
    borderColor: '#EF7725',
    borderWidth: 1,
  },
  linkButton: {
    marginBottom: 6,
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  linkButtonText: {
    color: '#EF7725',
    fontSize: 13,
    fontWeight: '500',
  },
  conceptsModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  conceptsContainer: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: '#f0f0f3',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
});

export default MovementModal;
