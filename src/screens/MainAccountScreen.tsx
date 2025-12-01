import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Animated, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import DataPrivacyModal from '../components/DataPrivacyModal';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../theme/useThemeColors';

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

const { width } = Dimensions.get('window');
const HEADER_H = Platform.OS === 'ios' ? 88 : 76;

const MainAccountScreen = () => {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const [cuenta, setCuenta] = useState<CuentaPrincipal | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [formData, setFormData] = useState<Partial<Usuario>>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

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

  const fetchData = async () => {
    await Promise.all([fetchCuentaPrincipal(), fetchUsuario()]);
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;
      // Nunca mandamos ningún campo de moneda en el payload, solo datos personales
      const { monedaPreferencia, ...rest } = formData;
      const cleanPayload = Object.fromEntries(
        Object.entries(rest).filter(([key]) => !key.toLowerCase().includes('moneda'))
      );
      const response = await fetch(`${API_BASE_URL}/user/update`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanPayload),
      });
      if (response.ok) {
        const updatedProfile = await response.json();
        setUsuario(updatedProfile);
        setFormData(updatedProfile);
        setEditMode(false);
        Toast.show({ type: 'success', text1: 'Perfil actualizado' });
        fetchData(); // Recargar datos para mostrar actualizados
      } else {
        const errorData = await response.json();
        console.error('Error updating profile:', errorData);
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.button} />
        <Text style={[styles.muted, { color: colors.textSecondary }]}>Cargando…</Text>
      </View>
    );
  }

  if (!cuenta) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="warning-outline" size={24} color="#ef4444" />
        <Text style={[styles.titleSm, { color: colors.text }]}>No se pudo cargar la cuenta</Text>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>Revisa tu conexión e inténtalo de nuevo</Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.headerWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.headerBar, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Cuenta Principal</Text>
          <View style={[styles.headerChip, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <Ionicons name="cash-outline" size={14} color={colors.text} />
            <Text style={[styles.headerChipText, { color: colors.text }]}>{cuenta.moneda}</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={HEADER_H}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={{ paddingBottom: 0 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}> 
          <View style={styles.rowBetween}>
            <View style={styles.rowCenter}>
              <View style={[styles.iconChip, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name="wallet-outline" size={16} color="#4f46e5" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{cuenta.nombre}</Text>
            </View>

            <View style={[styles.chipOutline, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.chipText, { color: colors.textSecondary }]}>{cuenta.moneda}</Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <Text style={[styles.currency, { color: colors.text }]}>{cuenta.simbolo}</Text>
            <Text style={[styles.amount, { color: colors.text }]}>{cuenta.cantidad.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={[styles.mutedXs, { color: colors.placeholder }]}>Actualizado {formatDate(cuenta.updatedAt)}</Text>
            <View style={[styles.chipSoft, { backgroundColor: '#eafaf1' }]}>
              <Ionicons name="star" size={12} color="#16a34a" />
              <Text style={styles.chipSoftText}>Principal</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.grid}>
          <View style={[styles.cardSm, styles.neuInset, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.label, { color: colors.placeholder }]}>ID Cuenta</Text>
            <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.valueMono, { color: colors.text }]}>{cuenta.id}</Text>
          </View>
          <View style={[styles.cardSm, styles.neuInset, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.label, { color: colors.placeholder }]}>Usuario</Text>
            <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.value, { color: colors.text }]}>{cuenta.userId}</Text>
          </View>
          <View style={[styles.cardSm, styles.neuInset, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.label, { color: colors.placeholder }]}>Moneda</Text>
            <Text style={[styles.value, { color: colors.text }]}>{cuenta.moneda}</Text>
          </View>
          <View style={[styles.cardSm, styles.neuInset, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.label, { color: colors.placeholder }]}>DB ID</Text>
            <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.valueMono, { color: colors.text }]}>{cuenta._id}</Text>
          </View>
        </View>

        {usuario && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.titleSm, { color: colors.text }]}>Mi perfil</Text>
              <View style={styles.rowCenter}>
                <TouchableOpacity onPress={() => setInfoModalVisible(true)} style={[styles.iconBtn, { backgroundColor: colors.inputBackground }]}>
                  <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditMode(!editMode)}
                  style={[styles.btn, styles.btnLight, { backgroundColor: colors.card, borderColor: colors.border, height: 34, marginLeft: 6 }]}
                >
                  <Ionicons name={editMode ? 'close' : 'pencil'} size={14} color={colors.text} />
                  <Text style={[styles.btnLightText, { color: colors.text }]}>{editMode ? 'Cancelar' : 'Editar'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {editMode ? (
              <>
                <View style={styles.fieldRow}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nombre</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={formData.nombreCompleto || ''} onChangeText={(t) => handleChange('nombreCompleto', t)} placeholder="Tu nombre" placeholderTextColor={colors.placeholder} />
                </View>

                <View style={styles.fieldRow}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={formData.email || ''} onChangeText={(t) => handleChange('email', t)} placeholder="correo@ejemplo.com" placeholderTextColor={colors.placeholder} keyboardType="email-address" autoCapitalize="none" />
                </View>

                <View style={styles.inline}>
                  <View style={[styles.fieldRow, styles.inlineItem]}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Edad</Text>
                    <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={formData.edad?.toString() || ''} onChangeText={(t) => handleChange('edad', parseInt(t) || 0)} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.placeholder} />
                  </View>
                  <View style={[styles.fieldRow, styles.inlineItem]}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Ocupación</Text>
                    <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={formData.ocupacion || ''} onChangeText={(t) => handleChange('ocupacion', t)} placeholder="Tu ocupación" placeholderTextColor={colors.placeholder} />
                  </View>
                </View>

                {/* Moneda preferida solo visualización, no editable ni enviada al backend */}
                <View style={styles.fieldRow}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Moneda preferida (solo visualización)</Text>
                  <View style={[styles.chipOutline, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                    <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.chipText, { color: colors.textSecondary }]}>{usuario.monedaPreferencia || 'No establecida'}</Text>
                  </View>
                  <Text style={[styles.helperText, { color: colors.placeholder }]}>La moneda principal se establece en el registro y no se puede cambiar.</Text>
                </View>

                <View style={[styles.neuInset, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, marginTop: 10 }]}>
                  <Text style={[styles.sectionMinor, { color: colors.textSecondary }]}>Datos personales</Text>

                  <View style={styles.fieldRow}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Teléfono</Text>
                    <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={formData.telefono || ''} onChangeText={(t) => handleChange('telefono', t)} keyboardType="phone-pad" placeholder="Ej. 55 1234 5678" placeholderTextColor={colors.placeholder} />
                  </View>

                  <View style={styles.fieldRow}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>País</Text>
                    <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={formData.pais || ''} onChangeText={(t) => handleChange('pais', t)} placeholder="Ej. México" placeholderTextColor={colors.placeholder} />
                  </View>

                  <View style={styles.inline}>
                    <View style={[styles.fieldRow, styles.inlineItem]}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Estado</Text>
                      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={formData.estado || ''} onChangeText={(t) => handleChange('estado', t)} placeholder="Ej. Jalisco" placeholderTextColor={colors.placeholder} />
                    </View>
                    <View style={[styles.fieldRow, styles.inlineItem]}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Ciudad</Text>
                      <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} value={formData.ciudad || ''} onChangeText={(t) => handleChange('ciudad', t)} placeholder="Ej. Guzmán" placeholderTextColor={colors.placeholder} />
                    </View>
                  </View>

                  <View style={styles.fieldRow}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Biografía</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text, minHeight: 80, textAlignVertical: 'top' }]}
                      value={formData.bio || ''}
                      onChangeText={(t) => handleChange('bio', t)}
                      multiline
                      placeholder="Cuéntanos sobre ti…"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                </View>

                <View style={styles.rowEnd}>
                  <TouchableOpacity onPress={handleCancel} style={[styles.btn, styles.btnGhost]}>
                    <Text style={[styles.btnGhostText, { color: colors.textSecondary }]}>Descartar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleUpdateProfile} style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.button, shadowColor: colors.shadow }]}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.items}>
                  <ItemRow icon="person-outline" label="Nombre" value={usuario.nombreCompleto} colors={colors} />
                  <ItemRow icon="mail-outline" label="Email" value={usuario.email} mono truncate colors={colors} />
                  <ItemRow icon="calendar-outline" label="Edad" value={`${usuario.edad}`} colors={colors} />
                  <ItemRow icon="briefcase-outline" label="Ocupación" value={usuario.ocupacion} colors={colors} />
                  <ItemRow icon="cash-outline" label="Moneda preferida" value={usuario.monedaPreferencia} colors={colors} />

                  <View style={[styles.neuInset, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, marginTop: 8 }]}>
                    <Text style={[styles.sectionMinor, { color: colors.textSecondary }]}>Datos personales</Text>
                    <ItemRow icon="call-outline" label="Teléfono" value={usuario.telefono || '—'} colors={colors} />
                    <ItemRow icon="earth-outline" label="País" value={usuario.pais || '—'} colors={colors} />
                    <View style={styles.inline}>
                      <View style={[styles.inlineItem, { paddingRight: 6 }]}>
                        <ItemRow icon="map-outline" label="Estado" value={usuario.estado || '—'} colors={colors} />
                      </View>
                      <View style={[styles.inlineItem, { paddingLeft: 6 }]}>
                        <ItemRow icon="location-outline" label="Ciudad" value={usuario.ciudad || '—'} colors={colors} />
                      </View>
                    </View>
                    {!!usuario.bio && <ItemRow icon="document-text-outline" label="Bio" value={usuario.bio} multiline colors={colors} />}
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.titleSm, { color: colors.text }]}>Estado de la cuenta</Text>
          </View>
          <View style={styles.stateRow}>
            <Dot color={cuenta.isPrincipal ? '#10b981' : '#ef4444'} />
            <Text style={[styles.value, { color: colors.text }]}>{cuenta.isPrincipal ? 'Principal activa' : 'No principal'}</Text>
          </View>
        </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---------- Modales ---------- */}
      <DataPrivacyModal visible={infoModalVisible} onClose={() => setInfoModalVisible(false)} />
    </>
  );
};

/** -------------------- UI helpers -------------------- */
const ItemRow = ({
  icon, label, value, mono, truncate, multiline, colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  mono?: boolean;
  truncate?: boolean;
  multiline?: boolean;
  colors?: any;
}) => {
  return (
    <View style={styles.itemRow}>
      <View style={[styles.iconChip, { backgroundColor: colors?.inputBackground || '#f1f5f9' }]}>
        <Ionicons name={icon} size={14} color={colors?.textSecondary || '#475569'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemLabel, { color: colors?.textSecondary || '#6b7280' }]}>{label}</Text>
        {!!value && (
          <Text
            style={[mono ? [styles.valueMono, { color: colors?.text || '#0f172a' }] : [styles.value, { color: colors?.text || '#0f172a' }], multiline && { lineHeight: 18 }]}
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
  // Fondo y spacing general
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: HEADER_H + 12, // deja espacio al header fijo
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },

  // ---------- Header (como la captura) ----------
  headerWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 54 : 10,
    zIndex: 100,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 14,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    shadowOffset: { width: 3, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerChipText: { fontSize: 12, fontWeight: '800' },
  headerHandle: {
    alignSelf: 'center',
    marginTop: 8,
    width: 80,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },

  // ---------- Tarjetas ----------
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginTop: 2,
  },

  neuInset: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },

  cardSm: { minHeight: 66, justifyContent: 'center', flexBasis: (width - 14 * 2 - 10) / 2 - 0.5, flexGrow: 1 },

  // Filas
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },

  // Tipografías
  title: { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  titleSm: { fontSize: 15, fontWeight: '800' },
  muted: { fontSize: 13 },
  mutedXs: { fontSize: 12 },

  // Chips / pills
  iconChip: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipOutline: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 10, gap: 6,
  },
  chipText: { fontSize: 12, fontWeight: '800' },
  chipSoft: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, gap: 6 },
  chipSoftText: { fontSize: 12, color: '#166534', fontWeight: '800' },

  // Balance
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, marginBottom: 8 },
  currency: { fontSize: 18, fontWeight: '800', marginRight: 4 },
  amount: { fontSize: 30, fontWeight: '900', flexShrink: 1 },

  // Grid
  grid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Valores
  label: { fontSize: 11, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 14, fontWeight: '700' },
  valueMono: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontWeight: '700',
  },

  // Lista de items perfil
  items: { marginTop: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  itemLabel: { fontSize: 11, marginBottom: 2 },

  // Inputs
  fieldRow: { marginTop: 8 },
  inputLabel: { fontSize: 12, marginBottom: 6, fontWeight: '700' },
  helperText: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  input: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.02, shadowRadius: 4,
  },
  inline: { flexDirection: 'row', gap: 8 },
  inlineItem: { flex: 1 },

  // Botones
  btn: { height: 38, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnLight: { borderWidth: 1 },
  btnLightText: { fontWeight: '800', fontSize: 13 },
  btnGhost: { backgroundColor: 'transparent' },
  btnGhostText: { fontWeight: '800', fontSize: 13 },
  btnPrimary: {
    shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  iconBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  sectionMinor: { fontSize: 12, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Estado
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Overlay
  convertingOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 10, alignItems: 'center',
    backgroundColor: 'rgba(246,247,251,0.9)',
  },

  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

export default MainAccountScreen;
