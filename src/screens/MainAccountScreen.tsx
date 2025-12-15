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
  const profileFadeAnim = useRef(new Animated.Value(0)).current;
  const profileSlideAnim = useRef(new Animated.Value(15)).current;
  const gridItemsAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
    
    // Animate profile section
    Animated.parallel([
      Animated.timing(profileFadeAnim, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }),
      Animated.timing(profileSlideAnim, { toValue: 0, duration: 400, delay: 100, useNativeDriver: true }),
    ]).start();

    // Animate grid items
    Animated.timing(gridItemsAnim, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }).start();
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
      { 
        text: 'Sí, descartar', 
        style: 'destructive', 
        onPress: () => { 
          setFormData(usuario || {}); 
          setEditMode(false);
          // Animate exit
          Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();
        } 
      },
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
            activeOpacity={0.6}
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
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[
            styles.card, 
            styles.mainCard,
            { 
              backgroundColor: colors.card, 
              borderColor: colors.border, 
              shadowColor: colors.shadow, 
              opacity: fadeAnim, 
              transform: [{ translateY: slideAnim }] 
            }
          ]}> 
            <View style={styles.rowBetween}>
              <View style={styles.rowCenter}>
                <View style={[styles.iconChip, styles.iconChipLarge, { backgroundColor: '#eef2ff' }]}>
                  <Ionicons name="wallet" size={20} color="#4f46e5" />
                </View>
                <View>
                  <Text style={[styles.title, { color: colors.text }]}>{cuenta.nombre}</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Cuenta activa</Text>
                </View>
              </View>

              <View style={[styles.chipOutline, styles.chipOutlinePrimary, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}>
                <Ionicons name="cash" size={14} color="#4f46e5" />
                <Text style={[styles.chipText, { color: '#4f46e5' }]}>{cuenta.moneda}</Text>
              </View>
            </View>

            <View style={styles.balanceContainer}>
              <View style={styles.balanceRow}>
                <Text style={[styles.currency, { color: colors.textSecondary }]}>{cuenta.simbolo}</Text>
                <Text style={[styles.amount, { color: colors.text }]}>{cuenta.cantidad.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.chipSoft, { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' }]}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.chipSoftText}>Principal</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.rowBetween}>
              <Text style={[styles.mutedXs, { color: colors.placeholder }]}>
                <Ionicons name="time-outline" size={11} color={colors.placeholder} /> Actualizado {formatDate(cuenta.updatedAt)}
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={[
            styles.grid,
            { opacity: gridItemsAnim, transform: [{ translateY: gridItemsAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }
          ]}>
            <View style={[styles.cardSm, styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={[styles.gridIconChip, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="key-outline" size={16} color="#d97706" />
              </View>
              <Text style={[styles.label, { color: colors.placeholder }]}>ID Cuenta</Text>
              <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.valueMono, { color: colors.text }]}>{cuenta.id}</Text>
            </View>
            <View style={[styles.cardSm, styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={[styles.gridIconChip, { backgroundColor: '#ddd6fe' }]}>
                <Ionicons name="person-outline" size={16} color="#7c3aed" />
              </View>
              <Text style={[styles.label, { color: colors.placeholder }]}>Usuario</Text>
              <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.value, { color: colors.text }]}>{cuenta.userId}</Text>
            </View>
            <View style={[styles.cardSm, styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={[styles.gridIconChip, { backgroundColor: '#ccfbf1' }]}>
                <Ionicons name="globe-outline" size={16} color="#0d9488" />
              </View>
              <Text style={[styles.label, { color: colors.placeholder }]}>Moneda</Text>
              <Text style={[styles.value, { color: colors.text }]}>{cuenta.moneda}</Text>
            </View>
            <View style={[styles.cardSm, styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={[styles.gridIconChip, { backgroundColor: '#fce7f3' }]}>
                <Ionicons name="server-outline" size={16} color="#db2777" />
              </View>
              <Text style={[styles.label, { color: colors.placeholder }]}>DB ID</Text>
              <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.valueMono, { color: colors.text }]}>{cuenta._id}</Text>
            </View>
          </Animated.View>

          {usuario && (
            <Animated.View style={[
              styles.card,
              { 
                backgroundColor: colors.card, 
                borderColor: colors.border, 
                shadowColor: colors.shadow,
                opacity: profileFadeAnim,
                transform: [{ translateY: profileSlideAnim }, { scale: scaleAnim }]
              }
            ]}>
              <View style={styles.rowBetween}>
                <View style={styles.rowCenter}>
                  <View style={[styles.iconChip, styles.iconChipLarge, { backgroundColor: '#f0fdf4' }]}>
                    <Ionicons name="person" size={18} color="#16a34a" />
                  </View>
                  <Text style={[styles.titleSm, { color: colors.text }]}>Mi perfil</Text>
                </View>
                <View style={styles.rowCenter}>
                  <TouchableOpacity 
                    onPress={() => setInfoModalVisible(true)} 
                    style={[styles.iconBtn, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setEditMode(!editMode);
                      Animated.sequence([
                        Animated.timing(scaleAnim, { toValue: 0.96, duration: 100, useNativeDriver: true }),
                        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                      ]).start();
                    }}
                    style={[styles.btn, styles.btnLight, { backgroundColor: editMode ? colors.inputBackground : colors.button, borderColor: editMode ? colors.border : colors.button, height: 36, marginLeft: 8 }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={editMode ? 'close' : 'pencil'} size={14} color={editMode ? colors.text : '#fff'} />
                    <Text style={[styles.btnLightText, { color: editMode ? colors.text : '#fff', fontWeight: '800' }]}>
                      {editMode ? 'Cancelar' : 'Editar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {editMode ? (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 14 }]} />

                  <View style={styles.fieldRow}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      <Ionicons name="person-outline" size={12} /> Nombre completo
                    </Text>
                    <TextInput 
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} 
                      value={formData.nombreCompleto || ''} 
                      onChangeText={(t) => handleChange('nombreCompleto', t)} 
                      placeholder="Tu nombre" 
                      placeholderTextColor={colors.placeholder} 
                    />
                  </View>

                  <View style={styles.fieldRow}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      <Ionicons name="mail-outline" size={12} /> Email
                    </Text>
                    <TextInput 
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} 
                      value={formData.email || ''} 
                      onChangeText={(t) => handleChange('email', t)} 
                      placeholder="correo@ejemplo.com" 
                      placeholderTextColor={colors.placeholder} 
                      keyboardType="email-address" 
                      autoCapitalize="none" 
                    />
                  </View>

                  <View style={styles.inline}>
                    <View style={[styles.fieldRow, styles.inlineItem]}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        <Ionicons name="calendar-outline" size={12} /> Edad
                      </Text>
                      <TextInput 
                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} 
                        value={formData.edad?.toString() || ''} 
                        onChangeText={(t) => handleChange('edad', parseInt(t) || 0)} 
                        keyboardType="numeric" 
                        placeholder="0" 
                        placeholderTextColor={colors.placeholder} 
                      />
                    </View>
                    <View style={[styles.fieldRow, styles.inlineItem]}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        <Ionicons name="briefcase-outline" size={12} /> Ocupación
                      </Text>
                      <TextInput 
                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]} 
                        value={formData.ocupacion || ''} 
                        onChangeText={(t) => handleChange('ocupacion', t)} 
                        placeholder="Tu ocupación" 
                        placeholderTextColor={colors.placeholder} 
                      />
                    </View>
                  </View>

                  <View style={[styles.fieldRow, styles.currencyReadOnly]}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      <Ionicons name="cash-outline" size={12} /> Moneda preferida
                    </Text>
                    <View style={[styles.chipOutline, styles.chipOutlineReadOnly, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                      <Ionicons name="lock-closed" size={12} color={colors.placeholder} />
                      <Text style={[styles.chipText, { color: colors.textSecondary }]}>{usuario.monedaPreferencia || 'No establecida'}</Text>
                    </View>
                    <Text style={[styles.helperText, { color: colors.placeholder }]}>
                      <Ionicons name="information-circle-outline" size={11} /> La moneda se establece en el registro
                    </Text>
                  </View>

                  <View style={[styles.neuInset, styles.personalDataSection, { backgroundColor: colors.inputBackground, borderColor: colors.border, shadowColor: colors.shadow }]}>
                    <Text style={[styles.sectionMinor, { color: colors.textSecondary }]}>
                      <Ionicons name="shield-checkmark-outline" size={13} /> Datos personales
                    </Text>

                    <View style={styles.fieldRow}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        <Ionicons name="call-outline" size={12} /> Teléfono
                      </Text>
                      <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} value={formData.telefono || ''} onChangeText={(t) => handleChange('telefono', t)} keyboardType="phone-pad" placeholder="Ej. 55 1234 5678" placeholderTextColor={colors.placeholder} />
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        <Ionicons name="earth-outline" size={12} /> País
                      </Text>
                      <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} value={formData.pais || ''} onChangeText={(t) => handleChange('pais', t)} placeholder="Ej. México" placeholderTextColor={colors.placeholder} />
                    </View>

                    <View style={styles.inline}>
                      <View style={[styles.fieldRow, styles.inlineItem]}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                          <Ionicons name="map-outline" size={12} /> Estado
                        </Text>
                        <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} value={formData.estado || ''} onChangeText={(t) => handleChange('estado', t)} placeholder="Ej. Jalisco" placeholderTextColor={colors.placeholder} />
                      </View>
                      <View style={[styles.fieldRow, styles.inlineItem]}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                          <Ionicons name="location-outline" size={12} /> Ciudad
                        </Text>
                        <TextInput style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]} value={formData.ciudad || ''} onChangeText={(t) => handleChange('ciudad', t)} placeholder="Ej. Guzmán" placeholderTextColor={colors.placeholder} />
                      </View>
                    </View>

                    <View style={styles.fieldRow}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        <Ionicons name="document-text-outline" size={12} /> Biografía
                      </Text>
                      <TextInput
                        style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                        value={formData.bio || ''}
                        onChangeText={(t) => handleChange('bio', t)}
                        multiline
                        placeholder="Cuéntanos sobre ti…"
                        placeholderTextColor={colors.placeholder}
                      />
                    </View>
                  </View>

                  <View style={styles.rowEnd}>
                    <TouchableOpacity onPress={handleCancel} style={[styles.btn, styles.btnGhost, { borderWidth: 1, borderColor: colors.border }]} activeOpacity={0.7}>
                      <Ionicons name="close-circle-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.btnGhostText, { color: colors.textSecondary }]}>Descartar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={handleUpdateProfile} 
                      style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.button, shadowColor: colors.button }]}
                      activeOpacity={0.8}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={16} color="#fff" />
                          <Text style={styles.btnPrimaryText}>Guardar cambios</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 14 }]} />
                  <View style={styles.items}>
                    <ItemRow icon="person-outline" label="Nombre" value={usuario.nombreCompleto} colors={colors} />
                    <ItemRow icon="mail-outline" label="Email" value={usuario.email} mono truncate colors={colors} />
                    <ItemRow icon="calendar-outline" label="Edad" value={`${usuario.edad}`} colors={colors} />
                    <ItemRow icon="briefcase-outline" label="Ocupación" value={usuario.ocupacion} colors={colors} />
                    <ItemRow icon="cash-outline" label="Moneda preferida" value={usuario.monedaPreferencia} colors={colors} />

                    <View style={[styles.neuInset, styles.personalDataSection, { backgroundColor: colors.inputBackground, borderColor: colors.border, shadowColor: colors.shadow, marginTop: 12 }]}>
                      <Text style={[styles.sectionMinor, { color: colors.textSecondary }]}>
                        <Ionicons name="shield-checkmark-outline" size={13} /> Datos personales
                      </Text>
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
            </Animated.View>
          )}

          <View style={[styles.card, styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={styles.rowBetween}>
              <View style={styles.rowCenter}>
                <View style={[styles.iconChip, styles.iconChipLarge, { backgroundColor: '#ecfdf5' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#059669" />
                </View>
                <Text style={[styles.titleSm, { color: colors.text }]}>Estado de la cuenta</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 12 }]} />
            <View style={styles.stateRow}>
              <Dot color={cuenta.isPrincipal ? '#10b981' : '#ef4444'} />
              <Text style={[styles.value, { color: colors.text, fontSize: 15 }]}>
                {cuenta.isPrincipal ? 'Principal activa' : 'No principal'}
              </Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

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
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: HEADER_H + 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },

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
    marginHorizontal: 16,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerChipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 16,
  },
  mainCard: {
    borderRadius: 24,
    padding: 20,
  },
  statusCard: {
    marginBottom: 8,
  },

  neuInset: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  personalDataSection: {
    marginTop: 12,
  },

  cardSm: { 
    minHeight: 110, 
    justifyContent: 'flex-start', 
    flexBasis: (width - 16 * 2 - 12) / 2, 
    flexGrow: 1,
  },
  gridCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowEnd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 16 },

  title: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  subtitle: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  titleSm: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  muted: { fontSize: 13, fontWeight: '500' },
  mutedXs: { fontSize: 12, fontWeight: '600' },

  iconChip: { 
    width: 32, 
    height: 32, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  iconChipLarge: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  gridIconChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  chipOutline: {
    flexDirection: 'row', 
    alignItems: 'center',
    borderWidth: 1, 
    borderRadius: 999,
    paddingVertical: 7, 
    paddingHorizontal: 12, 
    gap: 6,
  },
  chipOutlinePrimary: {
    borderWidth: 1.5,
  },
  chipOutlineReadOnly: {
    paddingVertical: 8,
    marginTop: 4,
  },
  chipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  chipSoft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 999, 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    gap: 6,
  },
  chipSoftText: { fontSize: 12, color: '#059669', fontWeight: '800', letterSpacing: 0.3 },

  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
  },
  balanceRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end',
  },
  currency: { fontSize: 20, fontWeight: '700', marginRight: 6, marginBottom: 4 },
  amount: { fontSize: 36, fontWeight: '900', letterSpacing: -0.5 },

  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12,
    marginBottom: 16,
  },

  label: { 
    fontSize: 11, 
    marginBottom: 6, 
    marginTop: 4,
    textTransform: 'uppercase', 
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  value: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  valueMono: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontWeight: '600',
    letterSpacing: -0.3,
  },

  items: { marginTop: 0 },
  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 12, 
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  itemLabel: { fontSize: 11, marginBottom: 3, fontWeight: '700', letterSpacing: 0.3 },

  fieldRow: { marginTop: 12 },
  inputLabel: { 
    fontSize: 12, 
    marginBottom: 8, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  helperText: { 
    fontSize: 11, 
    marginTop: 6, 
    fontStyle: 'italic',
    lineHeight: 16,
  },
  input: {
    borderWidth: 1.5, 
    borderRadius: 14,
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    fontSize: 14,
    fontWeight: '500',
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.03, 
    shadowRadius: 6,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  currencyReadOnly: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  inline: { flexDirection: 'row', gap: 10 },
  inlineItem: { flex: 1 },

  btn: { 
    height: 42, 
    paddingHorizontal: 18, 
    borderRadius: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
  },
  btnLight: { 
    borderWidth: 1.5,
  },
  btnLightText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  btnGhost: { backgroundColor: 'transparent' },
  btnGhostText: { fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  btnPrimary: {
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 12,
    elevation: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },

  iconBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
  },

  sectionMinor: { 
    fontSize: 12, 
    fontWeight: '800', 
    marginBottom: 12, 
    textTransform: 'uppercase', 
    letterSpacing: 0.6,
  },

  stateRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
  },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  divider: {
    height: 1,
    marginVertical: 8,
  },

  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

export default MainAccountScreen;
