import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'react-native';
import { API_BASE_URL } from '../constants/api';
import Toast from "react-native-toast-message";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  cuentaId: string;
  subcuentaId?: string;
  userId: string;
};

const RecurrentModal = ({
  visible,
  onClose,
  onSubmit,
  cuentaId,
  subcuentaId,
  userId,
}: Props) => {
  const [nombre, setNombre] = useState('');
  const [plataforma, setPlataforma] = useState<any>(null);
  const [frecuenciaDias, setFrecuenciaDias] = useState('30');
  const [monto, setMonto] = useState('');
  const [afectaCuentaPrincipal, setAfectaCuentaPrincipal] = useState(true);
  const [afectaSubcuenta, setAfectaSubcuenta] = useState(false);
  const [recordatorios, setRecordatorios] = useState<string[]>([]);

  const [plataformas, setPlataformas] = useState<any[]>([]);
  const [loadingPlataformas, setLoadingPlataformas] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchPlataformas = async () => {
      if (!visible) return;
  
      setLoadingPlataformas(true);
      try {
        const token = await AsyncStorage.getItem("authToken");
        const res = await fetch(`${API_BASE_URL}/plataformas-recurrentes`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
  
        const data = await res.json();
  
        if (!Array.isArray(data)) {
          Toast.show({ 
            type: 'error', 
            text1: 'Error al cargar plataformas', 
            text2: 'Formato de respuesta inesperado.' 
          });
          setPlataformas([]);
        } else {
          setPlataformas(data);
        }
      } catch (error) {
        Toast.show({ 
          type: 'error', 
          text1: 'Error al cargar plataformas', 
          text2: 'Revisa tu conexión o intenta más tarde.' 
        });
        setPlataformas([]);
      } finally {
        setLoadingPlataformas(false);
      }
    };
  
    fetchPlataformas();
  }, [visible]);

  const toggleRecordatorio = (valor: string) => {
    setRecordatorios((prev) =>
      prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]
    );
  };

  const handleGuardar = () => {
    if (!nombre || !plataforma || !monto || !frecuenciaDias) return;

    onSubmit({
      nombre,
      plataforma,
      frecuenciaDias: Number(frecuenciaDias),
      monto: Number(monto),
      afectaCuentaPrincipal,
      afectaSubcuenta,
      cuentaId,
      subcuentaId,
      userId,
      recordatorios: recordatorios.map((r) => parseInt(r)),
    });

    onClose();
    setNombre('');
    setMonto('');
    setRecordatorios([]);
    setPlataforma(null);
    setFrecuenciaDias('30');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.dragIndicator} />
          <View style={styles.header}>
            <Text style={styles.title}>Nuevo Recurrente</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej. Spotify Premium"
            />

            <Text style={styles.label}>Plataforma</Text>
            <View style={[styles.input, { padding: 0 }]}>
              <TextInput
                placeholder="Buscar plataforma..."
                placeholderTextColor="#64748b"
                style={{ paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a' }}
                value={search}
                onChangeText={setSearch}
              />
              <ScrollView style={{ maxHeight: 120 }}>
                {plataformas
                  .filter((p) =>
                    p.nombre.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((p) => (
                    <TouchableOpacity
                      key={p.plataformaId}
                      onPress={() => {
                        if (plataforma?.plataformaId === p.plataformaId) {
                          setPlataforma(null);
                        } else {
                          setPlataforma(p);
                        }
                      }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor:
                          plataforma?.plataformaId === p.plataformaId ? '#FEF2F2' : 'transparent',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: p.color,
                            marginRight: 8,
                          }}
                        />
                        <Text style={{ color: '#0f172a' }}>{p.nombre}</Text>
                        {plataforma?.plataformaId === p.plataformaId && (
                          <Ionicons name="checkmark-circle" size={16} color="#F59E0B" style={{ marginLeft: 6 }} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>

            <Text style={styles.label}>Monto</Text>
            <TextInput
              style={styles.input}
              value={monto}
              onChangeText={setMonto}
              keyboardType="numeric"
              placeholder="$0.00"
            />

            <Text style={styles.label}>Frecuencia</Text>
            <View style={styles.recordatorioContainer}>
              {[
                { label: 'Semanal', days: '7' },
                { label: 'Quincenal', days: '15' },
                { label: 'Mensual', days: '30' },
                { label: 'Personalizado', days: '' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.label}
                  onPress={() => setFrecuenciaDias(f.days)}
                  style={[
                    styles.recordatorioChip,
                    frecuenciaDias === f.days && styles.recordatorioChipSelected,
                  ]}
                >
                  <Text
                    style={
                      frecuenciaDias === f.days
                        ? styles.chipTextSelected
                        : styles.chipText
                    }
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {frecuenciaDias === '' && (
              <TextInput
                style={styles.input}
                value={frecuenciaDias}
                onChangeText={setFrecuenciaDias}
                keyboardType="numeric"
                placeholder="Ingresa días personalizados"
              />
            )}

            <Text style={styles.label}>Recordatorios</Text>
            <View style={styles.recordatorioContainer}>
              {['1', '3', '7'].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => toggleRecordatorio(r)}
                  style={[
                    styles.recordatorioChip,
                    recordatorios.includes(r) && styles.recordatorioChipSelected,
                  ]}
                >
                  <Text
                    style={
                      recordatorios.includes(r)
                        ? styles.chipTextSelected
                        : styles.chipText
                    }
                  >
                    {r} días antes
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            { !subcuentaId && (
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Afecta cuenta principal</Text>
                <Switch
                  value={afectaCuentaPrincipal}
                  onValueChange={setAfectaCuentaPrincipal}
                />
              </View>
            )}

            { subcuentaId && (
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Afecta subcuenta</Text>
                <Switch
                  value={afectaSubcuenta}
                  onValueChange={setAfectaSubcuenta}
                />
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.saveButton} onPress={handleGuardar}>
            <Text style={styles.saveButtonText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default RecurrentModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    maxHeight: '95%',
  },
  dragIndicator: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  label: {
    marginTop: 10,
    marginBottom: 5,
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  recordatorioContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  recordatorioChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#cbd5e1',
  },
  recordatorioChipSelected: {
    backgroundColor: '#F59E0B',
  },
  chipText: {
    color: '#1e293b',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#f0f9ff',
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#475569',
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});