import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  Dimensions, Animated, TouchableOpacity, TextInput, Modal, Alert, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import DataPrivacyModal from '../components/DataPrivacyModal';
import SmartNumber from '../components/SmartNumber';
import BackButton from '../components/BackButton';
import { CurrencyPicker, Moneda as PickerMoneda } from '../components/CurrencyPicker';

interface CuentaPrincipal {
  esPrincipal: boolean;
  _id: string;
  userId: string;
  nombre: string;
  moneda: string;
  simbolo: string;
  color: string;
  cantidad: number;
  isPrincipal: boolean;
  id: string;
  updatedAt: string;
}

interface Usuario {
  id: string;
  nombreCompleto: string;
  email: string;
  edad: number;
  ocupacion: string;
  isPremium: boolean;
  monedaPreferencia: string;
  telefono?: string;
  pais?: string;
  estado?: string;
  ciudad?: string;
  bio?: string;
}

interface MonedaCatalogo {
  codigo: string;
  nombre: string;
  simbolo: string;
}

const { width } = Dimensions.get('window');

const MainAccountScreen = () => {
  const [cuenta, setCuenta] = useState<CuentaPrincipal | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [monedas, setMonedas] = useState<MonedaCatalogo[]>([]);

  // Un solo modal por funcionalidad
  const [monedaModalVisible, setMonedaModalVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);

  const [convertingCurrency, setConvertingCurrency] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [formData, setFormData] = useState<Partial<Usuario>>({});

  // Animaciones
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  // Adaptador
  const toMoneda = (m: MonedaCatalogo): PickerMoneda => ({
    id: m.codigo, codigo: m.codigo, nombre: m.nombre, simbolo: m.simbolo,
  });

  const fetchCuentaPrincipal = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) { setCuenta(null); setLoading(false); return; }
      const res = await fetch(`${API_BASE_URL}/cuenta/principal`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setCuenta(data);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      } else {
        setCuenta(null);
      }
    } catch {
      setCuenta(null);
    }
  };

  const fetchUsuario = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const userData = await res.json();
        setUsuario(userData);
        setFormData(userData);
      }
    } catch {}
  };

  const fetchMonedas = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/monedas/catalogo`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setMonedas(data);
      }
    } catch {}
  };

  const fetchData = async () => {
    await Promise.all([fetchCuentaPrincipal(), fetchUsuario(), fetchMonedas()]);
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/user/update`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        const updatedProfile = await response.json();
        setUsuario(updatedProfile);
        setFormData(updatedProfile);
        setEditMode(false);
        Toast.show({ type: 'success', text1: 'Perfil actualizado' });
      } else {
        const errorData = await response.json();
        Toast.show({ type: 'error', text1: 'Error', text2: errorData.message || 'No se pudo actualizar' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Usuario, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    Alert.alert('Descartar cambios', '¿Quieres descartar los cambios?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, descartar', style: 'destructive', onPress: () => { setFormData(usuario || {}); setEditMode(false); } },
    ]);
  };

  // Tasas mock
  const convertCurrency = async (from: string, to: string, amount: number) => {
    const rates: Record<string, Record<string, number>> = {
      USD: { MXN: 17.5, EUR: 0.85 },
      MXN: { USD: 0.057, EUR: 0.048 },
      EUR: { USD: 1.18, MXN: 20.6 },
    };
    if (from === to) return amount;
    const rate = rates[from]?.[to];
    if (!rate) throw new Error('Conversión no disponible');
    return amount * rate;
  };

  const handleCurrencyChange = async (newMoneda: PickerMoneda) => {
    try {
      setConvertingCurrency(true);
      if (!cuenta) return;
      const convertedAmount = await convertCurrency(cuenta.moneda, newMoneda.codigo, cuenta.cantidad);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/cuenta/principal/currency`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ moneda: newMoneda.codigo, simbolo: newMoneda.simbolo, cantidad: convertedAmount }),
      });

      if (response.ok) {
        setCuenta(prev => prev ? { ...prev, moneda: newMoneda.codigo, simbolo: newMoneda.simbolo, cantidad: convertedAmount } : null);
        forceCloseAllPickers();
        Toast.show({ type: 'success', text1: `Convertido a ${newMoneda.codigo}` });
        await fetchCuentaPrincipal();
      } else {
        const errorData = await response.json();
        Toast.show({ type: 'error', text1: 'Error', text2: errorData.message || 'No se pudo cambiar la moneda' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conversión' });
    } finally {
      setConvertingCurrency(false);
    }
  };

  const handleCurrencyChangeFromSmartNumber = async (code: string) => {
    const m = monedas.find(x => x.codigo === code);
    if (m) await handleCurrencyChange(toMoneda(m));
  };

  // Cierre seguro
  const forceCloseAllPickers = () => {
    setMonedaModalVisible(false);
    setCurrencyPickerVisible(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" />
        <Text style={styles.muted}>Cargando…</Text>
      </View>
    );
  }

  if (!cuenta) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={24} color="#ef4444" />
        <Text style={styles.titleSm}>No se pudo cargar la cuenta</Text>
        <Text style={styles.muted}>Revisa tu conexión e inténtalo de nuevo</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* BackButton fuera de la tarjeta */}
        <View style={styles.backButtonWrapper}>
          <BackButton />
        </View>
        {/* Balance */}
        <Animated.View style={[styles.card, styles.neu, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Elimina el BackButton de aquí */}
          <View style={styles.rowBetween}>
            <View style={styles.rowCenter}>
              <View style={[styles.iconChip, { backgroundColor: '#eef2ff' }]}>
                <Ionicons name="wallet-outline" size={16} color="#4f46e5" />
              </View>
              <Text style={styles.title}>{cuenta.nombre}</Text>
            </View>
            <TouchableOpacity onPress={() => { forceCloseAllPickers(); setCurrencyPickerVisible(true); }} style={styles.chipOutline}>
              <Ionicons name="swap-horizontal" size={14} color="#334155" />
              <Text style={styles.chipText}>{cuenta.moneda}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.currency}>{cuenta.simbolo}</Text>
            <SmartNumber
              value={cuenta.cantidad}
              options={{ context: 'card', symbol: '', currency: cuenta.moneda }}
              textStyle={styles.amount}
              allowCurrencyChange
              currentCurrency={cuenta.moneda}
              onCurrencyChange={handleCurrencyChangeFromSmartNumber}
            />
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.mutedXs}>Actualizado {formatDate(cuenta.updatedAt)}</Text>
            <View style={[styles.chipSoft, { backgroundColor: '#eafaf1' }]}>
              <Ionicons name="star" size={12} color="#16a34a" />
              <Text style={styles.chipSoftText}>Principal</Text>
            </View>
          </View>
        </Animated.View>

        {/* Grid esencial */}
        <View style={styles.grid}>
          <View style={[styles.cardSm, styles.neuInset]}>
            <Text style={styles.label}>ID Cuenta</Text>
            <Text numberOfLines={1} ellipsizeMode="middle" style={styles.valueMono}>{cuenta.id}</Text>
          </View>
          <View style={[styles.cardSm, styles.neuInset]}>
            <Text style={styles.label}>Usuario</Text>
            <Text numberOfLines={1} ellipsizeMode="middle" style={styles.value}>{cuenta.userId}</Text>
          </View>
          <View style={[styles.cardSm, styles.neuInset]}>
            <Text style={styles.label}>Moneda</Text>
            <Text style={styles.value}>{cuenta.moneda}</Text>
          </View>
          <View style={[styles.cardSm, styles.neuInset]}>
            <Text style={styles.label}>DB ID</Text>
            <Text numberOfLines={1} ellipsizeMode="middle" style={styles.valueMono}>{cuenta._id}</Text>
          </View>
        </View>

        {/* Perfil */}
        {usuario && (
          <View style={[styles.card, styles.neu]}>
            <View style={styles.rowBetween}>
              <Text style={styles.titleSm}>Mi perfil</Text>
              <View style={styles.rowCenter}>
                <TouchableOpacity onPress={() => setInfoModalVisible(true)} style={styles.iconBtn}>
                  <Ionicons name="help-circle-outline" size={18} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditMode(!editMode)} style={[styles.btn, styles.btnLight, { height: 34, marginLeft: 6 }]}>
                  <Ionicons name={editMode ? 'close' : 'pencil'} size={14} color="#0f172a" />
                  <Text style={styles.btnLightText}>{editMode ? 'Cancelar' : 'Editar'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {editMode ? (
              <>
                {/* Básico */}
                <View style={styles.fieldRow}>
                  <Text style={styles.inputLabel}>Nombre</Text>
                  <TextInput style={styles.input} value={formData.nombreCompleto || ''} onChangeText={(t) => handleChange('nombreCompleto', t)} placeholder="Tu nombre" />
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput style={styles.input} value={formData.email || ''} onChangeText={(t) => handleChange('email', t)} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" />
                </View>

                <View style={styles.inline}>
                  <View style={[styles.fieldRow, styles.inlineItem]}>
                    <Text style={styles.inputLabel}>Edad</Text>
                    <TextInput style={styles.input} value={formData.edad?.toString() || ''} onChangeText={(t) => handleChange('edad', parseInt(t) || 0)} keyboardType="numeric" placeholder="0" />
                  </View>
                  <View style={[styles.fieldRow, styles.inlineItem]}>
                    <Text style={styles.inputLabel}>Ocupación</Text>
                    <TextInput style={styles.input} value={formData.ocupacion || ''} onChangeText={(t) => handleChange('ocupacion', t)} placeholder="Tu ocupación" />
                  </View>
                </View>

                <View style={styles.fieldRow}>
                  <Text style={styles.inputLabel}>Moneda preferida</Text>
                  <TouchableOpacity style={styles.chipOutline} onPress={() => { forceCloseAllPickers(); setMonedaModalVisible(true); }}>
                    <Ionicons name="cash-outline" size={14} color="#334155" />
                    <Text style={styles.chipText}>{formData.monedaPreferencia || usuario.monedaPreferencia || 'Seleccionar'}</Text>
                  </TouchableOpacity>
                </View>

                {/* ⬇️ Datos personales extra */}
                <View style={[styles.neuInset, { marginTop: 10 }]}>
                  <Text style={styles.sectionMinor}>Datos personales</Text>

                  <View style={styles.fieldRow}>
                    <Text style={styles.inputLabel}>Teléfono</Text>
                    <TextInput style={styles.input} value={formData.telefono || ''} onChangeText={(t) => handleChange('telefono', t)} keyboardType="phone-pad" placeholder="Ej. 55 1234 5678" />
                  </View>

                  <View style={styles.fieldRow}>
                    <Text style={styles.inputLabel}>País</Text>
                    <TextInput style={styles.input} value={formData.pais || ''} onChangeText={(t) => handleChange('pais', t)} placeholder="Ej. México" />
                  </View>

                  <View style={styles.inline}>
                    <View style={[styles.fieldRow, styles.inlineItem]}>
                      <Text style={styles.inputLabel}>Estado</Text>
                      <TextInput style={styles.input} value={formData.estado || ''} onChangeText={(t) => handleChange('estado', t)} placeholder="Ej. CDMX" />
                    </View>
                    <View style={[styles.fieldRow, styles.inlineItem]}>
                      <Text style={styles.inputLabel}>Ciudad</Text>
                      <TextInput style={styles.input} value={formData.ciudad || ''} onChangeText={(t) => handleChange('ciudad', t)} placeholder="Ej. Coyoacán" />
                    </View>
                  </View>

                  <View style={styles.fieldRow}>
                    <Text style={styles.inputLabel}>Biografía</Text>
                    <TextInput
                      style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                      value={formData.bio || ''}
                      onChangeText={(t) => handleChange('bio', t)}
                      multiline
                      placeholder="Cuéntanos sobre ti…"
                    />
                  </View>
                </View>

                <View style={styles.rowEnd}>
                  <TouchableOpacity onPress={handleCancel} style={[styles.btn, styles.btnGhost]}>
                    <Text style={styles.btnGhostText}>Descartar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleUpdateProfile} style={[styles.btn, styles.btnPrimary]}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.items}>
                  <ItemRow icon="person-outline" label="Nombre" value={usuario.nombreCompleto} />
                  <ItemRow icon="mail-outline" label="Email" value={usuario.email} mono truncate />
                  <ItemRow icon="calendar-outline" label="Edad" value={`${usuario.edad}`} />
                  <ItemRow icon="briefcase-outline" label="Ocupación" value={usuario.ocupacion} />
                  <ItemRow icon="cash-outline" label="Moneda preferida" value={usuario.monedaPreferencia} />

                  {/* ⬇️ Datos personales extra (lectura compacta) */}
                  <View style={[styles.neuInset, { marginTop: 8 }]}>
                    <Text style={styles.sectionMinor}>Datos personales</Text>
                    <ItemRow icon="call-outline" label="Teléfono" value={usuario.telefono || '—'} />
                    <ItemRow icon="earth-outline" label="País" value={usuario.pais || '—'} />
                    <View style={styles.inline}>
                      <View style={[styles.inlineItem, { paddingRight: 6 }]}>
                        <ItemRow icon="map-outline" label="Estado" value={usuario.estado || '—'} />
                      </View>
                      <View style={[styles.inlineItem, { paddingLeft: 6 }]}>
                        <ItemRow icon="location-outline" label="Ciudad" value={usuario.ciudad || '—'} />
                      </View>
                    </View>
                    {!!usuario.bio && <ItemRow icon="document-text-outline" label="Bio" value={usuario.bio} multiline />}
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Estado */}
        <View style={[styles.card, styles.neu]}>
          <View style={styles.rowBetween}>
            <Text style={styles.titleSm}>Estado de la cuenta</Text>
          </View>
          <View style={styles.stateRow}>
            <Dot color={cuenta.isPrincipal ? '#10b981' : '#ef4444'} />
            <Text style={styles.value}>{cuenta.isPrincipal ? 'Principal activa' : 'No principal'}</Text>
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Picker de moneda preferida (perfil) */}
      <CurrencyPicker
        value={formData.monedaPreferencia || usuario?.monedaPreferencia || ''}
        visible={monedaModalVisible}
        onClose={forceCloseAllPickers}
        onSelect={(m: PickerMoneda) => {
          handleChange('monedaPreferencia', m.codigo);
          forceCloseAllPickers();
        }}
      />

      {/* Picker de moneda de la cuenta */}
      <CurrencyPicker
        value={cuenta.moneda}
        visible={currencyPickerVisible}
        onClose={forceCloseAllPickers}
        onSelect={(m: PickerMoneda) => handleCurrencyChange(m)}
      />

      {/* Info datos opcionales */}
      <DataPrivacyModal visible={infoModalVisible} onClose={() => setInfoModalVisible(false)} />

      {convertingCurrency && (
        <View style={[styles.convertingOverlay]} pointerEvents="none">
          <ActivityIndicator size="small" />
          <Text style={[styles.muted, { marginTop: 6 }]}>Convirtiendo…</Text>
        </View>
      )}
    </>
  );
};

/** -------------------- UI helpers -------------------- */
const ItemRow = ({
  icon, label, value, mono, truncate, multiline,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  mono?: boolean;
  truncate?: boolean;
  multiline?: boolean;
}) => {
  return (
    <View style={styles.itemRow}>
      <View style={[styles.iconChip, { backgroundColor: '#f1f5f9' }]}>
        <Ionicons name={icon} size={14} color="#475569" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{label}</Text>
        {!!value && (
          <Text
            style={[mono ? styles.valueMono : styles.value, multiline && { lineHeight: 18 }]}
            numberOfLines={multiline ? 0 : truncate ? 1 : 2}
            ellipsizeMode={truncate ? 'middle' : 'tail'}
          >
            {value}
          </Text>
        )}
      </View>
    </View>
  );
};

const Dot = ({ color }: { color: string }) => (
  <View style={[styles.dot, { backgroundColor: color }]} />
);

/** -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb', paddingHorizontal: 14, paddingTop: 42 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f7fb', gap: 6 },
  neu: {
    backgroundColor: '#f6f7fb',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  neuInset: {
    backgroundColor: '#f6f7fb',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#ffffff',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  card: { marginTop: 10 },
  // Agrega un nuevo estilo para el wrapper del BackButton
  backButtonWrapper: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginTop: 0, // Puedes ajustar el margen superior si lo deseas
    zIndex: 10,
  },
  cardSm: { minHeight: 66, justifyContent: 'center' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },

  title: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginLeft: 8 },
  titleSm: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  muted: { fontSize: 13, color: '#64748b' },
  mutedXs: { fontSize: 12, color: '#94a3b8' },

  iconChip: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  chipOutline: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 10, gap: 6, backgroundColor: '#fff',
  },
  chipText: { fontSize: 12, color: '#334155', fontWeight: '600' },

  chipSoft: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, gap: 6 },
  chipSoftText: { fontSize: 12, color: '#166534', fontWeight: '700' },

  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, marginBottom: 8 },
  currency: { fontSize: 18, fontWeight: '700', color: '#111827', marginRight: 4 },
  amount: { fontSize: 28, fontWeight: '800', color: '#0f172a', flexShrink: 1 },

  grid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  label: { fontSize: 11, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 14, color: '#0f172a', fontWeight: '600' },
  valueMono: {
    fontSize: 13, color: '#0f172a',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },

  items: { marginTop: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  itemLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },

  fieldRow: { marginTop: 8 },
  inputLabel: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: '#0f172a',
  },
  inline: { flexDirection: 'row', gap: 8 },
  inlineItem: { flex: 1 },

  btn: { height: 38, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnLight: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb' },
  btnLightText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  btnGhost: { backgroundColor: 'transparent' },
  btnGhostText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  btnPrimary: { backgroundColor: '#111827' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  iconBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },

  sectionMinor: { fontSize: 12, color: '#475569', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },

  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  convertingOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 10, alignItems: 'center',
    backgroundColor: 'rgba(246,247,251,0.9)',
  },
});

export default MainAccountScreen;