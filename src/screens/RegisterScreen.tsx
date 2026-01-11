import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, Modal, TextInput, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiRateLimiter } from '../services/apiRateLimiter';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import FormInput from '../components/FormInput';
import { useThemeColors } from '../theme/useThemeColors';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../constants/api';
import { monedasPredefinidas, Moneda } from '../constants/monedas';
import ocupaciones from '../constants/ocupaciones.json';
const getPasswordStrength = (password: string) => {
  if (password.length < 6) return 'Débil';
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'Media';
  return 'Fuerte';
};

const RegisterScreen: React.FC = () => {
  const colors = useThemeColors();
  const navigation = useNavigation();

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nombreCompleto: '',
    edad: '',
    ocupacion: '',
    monedaPrincipal: 'MXN',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [monedas, setMonedas] = useState<Moneda[]>(monedasPredefinidas);
  const [monedaModalVisible, setMonedaModalVisible] = useState(false);
  const [monedaSearch, setMonedaSearch] = useState('');
  const [ocupacionesModalVisible, setOcupacionesModalVisible] = useState(false);
  const [ocupSearch, setOcupSearch] = useState('');

  const handleChange = (key: keyof typeof form, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const filteredOcupaciones = useMemo(() => {
    const q = ocupSearch.trim().toLowerCase();
    if (!q) return ocupaciones;
    return ocupaciones.filter((o: string) => o.toLowerCase().includes(q));
  }, [ocupSearch]);

  const selectOcupacion = (o: string) => {
    handleChange('ocupacion', o);
    setOcupacionesModalVisible(false);
    setOcupSearch('');
  };

  // debug: if occupations list empty, log to help diagnose
  if (!Array.isArray(ocupaciones) || ocupaciones.length === 0) {
    // only log in dev
    // eslint-disable-next-line no-console
    console.log('Advertencia: lista de ocupaciones vacía o no es un arreglo', ocupaciones);
  }

  const fetchMonedas = async () => {
    try {
      console.log('Obteniendo monedas desde: /monedas/catalogo');
      const response = await apiRateLimiter.fetch(`${API_BASE_URL}/monedas/catalogo`);
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setMonedas(data);
          return;
        }
      }
    } catch (error: any) {
      console.log(`Error obteniendo monedas:`, error.message);
    }
    setMonedas(monedasPredefinidas);
  };

  const filteredMonedas = useMemo(() => {
    const q = monedaSearch.trim().toLowerCase();
    if (!q) return monedas;
    return monedas.filter(m => ((m.nombre || '') + ' ' + (m.codigo || '')).toLowerCase().includes(q));
  }, [monedaSearch, monedas]);

  useEffect(() => {
    fetchMonedas();
  }, []);

  const passwordStrength = getPasswordStrength(form.password);
  const passwordsMatch = form.password === form.confirmPassword;

  const strengthColor =
    passwordStrength === 'Fuerte'
      ? '#10B981'
      : passwordStrength === 'Media'
      ? '#EF7725'
      : '#EF4444';

  const handleRegister = async () => {
    // Validaciones estrictas
    if (!form.email || !form.password || !form.confirmPassword || !form.nombreCompleto) {
      return Toast.show({
        type: 'error',
        text1: 'Campos requeridos',
        text2: 'Completa todos los campos.',
      });
    }
    // Normalizar y validar `edad`: entero dentro del rango aceptable
    const EDAD_MIN = 13;
    const EDAD_MAX = 100;
    const edadTrim = (form.edad || '').toString().trim();
    const edadNum = Number(edadTrim);
    if (!edadTrim) {
      return Toast.show({ type: 'error', text1: 'Edad requerida', text2: 'Ingresa tu edad.' });
    }
    if (!Number.isFinite(edadNum) || Number.isNaN(edadNum)) {
      return Toast.show({ type: 'error', text1: 'Edad inválida', text2: 'Ingresa un número válido para la edad.' });
    }
    if (!Number.isInteger(edadNum)) {
      return Toast.show({ type: 'error', text1: 'Edad inválida', text2: 'La edad debe ser un número entero.' });
    }
    if (edadNum < EDAD_MIN || edadNum > EDAD_MAX) {
      return Toast.show({ type: 'error', text1: 'Edad fuera de rango', text2: `La edad debe estar entre ${EDAD_MIN} y ${EDAD_MAX} años.` });
    }
    if (!form.ocupacion || !form.ocupacion.trim()) {
      return Toast.show({
        type: 'error',
        text1: 'Ocupación requerida',
        text2: 'Ingresa tu ocupación.',
      });
    }
    if (!passwordsMatch) {
      return Toast.show({
        type: 'error',
        text1: 'Contraseñas no coinciden',
      });
    }

    try {
      const payload = {
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        nombreCompleto: form.nombreCompleto,
        edad: Number(form.edad),
        ocupacion: form.ocupacion.trim(),
        monedaPrincipal: form.monedaPrincipal,
      };

      const response = await apiRateLimiter.fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al registrar');
      }

      Toast.show({
        type: 'success',
        text1: 'Registro exitoso',
        text2: 'Verifica tu correo para activar la cuenta.',
      });

      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al registrar',
        text2: error.message || 'Intenta más tarde.',
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require('../images/LitFinance.png')} style={styles.logo} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Crear cuenta</Text>
          <Text style={[styles.subtitle, { color: colors.placeholder }]}>
            Únete a la comunidad financiera
          </Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.card }]}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name="person-outline" size={20} color="#EF7725" />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Datos personales</Text>
            </View>
            
            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
                <FormInput
                  placeholder="Nombre completo"
                  value={form.nombreCompleto}
                  onChangeText={(v) => handleChange('nombreCompleto', v)}
                  style={[styles.input, { borderWidth: 0 }]}
                />
              </View>
            </View>
            
            <View style={styles.row}>
              <View style={[styles.rowInput, styles.inputContainer]}>
                <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
                  <FormInput
                    placeholder="Edad"
                    keyboardType="numeric"
                    value={form.edad}
                    onChangeText={(v) => handleChange('edad', v)}
                    style={[styles.input, { borderWidth: 0 }]}
                  />
                </View>
              </View>
              <View style={[styles.rowInput, styles.inputContainer]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.inputWrapper, { backgroundColor: colors.background }]}
                  onPress={() => setOcupacionesModalVisible(true)}
                >
                  <View style={[styles.selectInner, { paddingHorizontal: 16, paddingVertical: 12 }]}>
                    <Text style={[styles.selectValue, { color: form.ocupacion ? colors.text : colors.placeholder }]}> 
                      {form.ocupacion || 'Ocupación'}
                    </Text>
                    <View style={styles.selectIcon}>
                      <Ionicons name="chevron-down" size={20} color={colors.placeholder} />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.ageHint, { color: colors.placeholder }]}>Debes ingresar un número entero entre 13 y 100.</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#EF7725" />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Datos de cuenta</Text>
            </View>
            
            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
                <FormInput
                  placeholder="Correo electrónico"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={form.email}
                  onChangeText={(v) => handleChange('email', v)}
                  style={[styles.input, { borderWidth: 0 }]}
                />
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
                <FormInput
                  placeholder="Contraseña"
                  secureTextEntry={!showPassword}
                  value={form.password}
                  onChangeText={(v) => handleChange('password', v)}
                  style={[styles.input, { borderWidth: 0 }]}
                  rightIcon={
                    <TouchableOpacity 
                      style={styles.iconButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={22}
                        color={colors.placeholder}
                      />
                    </TouchableOpacity>
                  }
                />
              </View>
            </View>
            
            {form.password.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <View style={[styles.strengthIndicator, { backgroundColor: strengthColor }]} />
                <Text style={[styles.strengthText, { color: strengthColor }]}>
                  Fortaleza: {passwordStrength}
                </Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
                <FormInput
                  placeholder="Confirmar contraseña"
                  secureTextEntry={!showConfirmPassword}
                  value={form.confirmPassword}
                  onChangeText={(v) => handleChange('confirmPassword', v)}
                  style={[styles.input, { borderWidth: 0 }]}
                  rightIcon={
                    <TouchableOpacity 
                      style={styles.iconButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={22}
                        color={colors.placeholder}
                      />
                    </TouchableOpacity>
                  }
                />
              </View>
            </View>
            
            {form.confirmPassword.length > 0 && (
              <View style={styles.matchContainer}>
                <View style={[styles.matchIcon, { backgroundColor: passwordsMatch ? '#10B981' : '#EF4444' }]}>
                  <Ionicons
                    name={passwordsMatch ? 'checkmark' : 'close'}
                    size={14}
                    color="white"
                  />
                </View>
                <Text style={[styles.matchText, { color: passwordsMatch ? '#10B981' : '#EF4444' }]}>
                  {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name="settings-outline" size={20} color="#EF7725" />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferencias</Text>
            </View>
            
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.inputWrapper, { backgroundColor: colors.background }]}
              onPress={() => setMonedaModalVisible(true)}
            >
                <View style={[styles.selectInner, { paddingHorizontal: 16, paddingVertical: 12 }]}>
                  <Text style={[styles.selectValue, { color: colors.text }]}>
                    {monedas.find(m => m.codigo === form.monedaPrincipal)?.nombre || form.monedaPrincipal}
                  </Text>
                  <View style={styles.selectIcon}>
                    <Ionicons name="chevron-down" size={20} color={colors.placeholder} />
                  </View>
                </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.button, styles.neumorphicButton]} 
            onPress={handleRegister}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonText}>Crear mi cuenta</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </View>
          </TouchableOpacity>

          <View style={styles.loginLinkContainer}>
            <Text style={[styles.loginText, { color: colors.placeholder }]}>
              ¿Ya tienes cuenta?
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Inicia sesión</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={monedaModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setMonedaModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, styles.neumorphicModal, { backgroundColor: colors.card }]}>
              <View style={[styles.modalHeaderContainer, { borderBottomColor: colors.border }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Seleccionar Moneda Principal</Text>
                  <TouchableOpacity 
                    style={[styles.closeButton, { backgroundColor: colors.inputBackground }]}
                    onPress={() => setMonedaModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.modalWarning, { color: '#EF7725' }]}>⚠️ Esta moneda no se podrá cambiar después</Text>
              </View>
              <View style={{ padding: 12 }}>
                <TextInput
                  placeholder="Buscar moneda..."
                  value={monedaSearch}
                  onChangeText={setMonedaSearch}
                  style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  placeholderTextColor={colors.placeholder}
                />
                <View style={styles.modalListWrapper}>
                  <FlatList
                    data={filteredMonedas}
                    keyExtractor={(item) => item.codigo}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    style={{ height: 320 }}
                    ListEmptyComponent={() => (
                      <View style={{ padding: 16 }}>
                        <Text style={{ color: colors.placeholder }}>No se encontraron monedas.</Text>
                      </View>
                    )}
                    renderItem={({ item: moneda }) => (
                      <TouchableOpacity
                        key={moneda.codigo}
                        style={[
                          styles.ocupacionItem,
                          { backgroundColor: colors.inputBackground },
                          form.monedaPrincipal === moneda.codigo && { backgroundColor: colors.cardSecondary, borderColor: colors.border }
                        ]}
                        onPress={() => {
                          handleChange('monedaPrincipal', moneda.codigo);
                          setMonedaModalVisible(false);
                          setMonedaSearch('');
                        }}
                      >
                        <View style={styles.monedaOptionContent}>
                          <View style={[styles.monedaSymbol, { backgroundColor: colors.background }]}>
                            <Text style={[styles.symbolText, { color: colors.textSecondary }]}>{moneda.simbolo}</Text>
                          </View>
                          <View style={styles.monedaInfo}>
                            <Text style={[styles.monedaOptionText, { color: colors.text }]}>
                              {moneda.nombre}
                            </Text>
                            <Text style={[styles.monedaCode, { color: colors.placeholder }]}> {moneda.codigo} </Text>
                          </View>
                        </View>
                        {form.monedaPrincipal === moneda.codigo && (
                          <View style={styles.checkIcon}>
                            <Ionicons name="checkmark" size={20} color="#10B981" />
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.12)"]}
                    style={styles.modalBottomGradient}
                    pointerEvents="none"
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          visible={ocupacionesModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setOcupacionesModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, styles.neumorphicModal, { backgroundColor: colors.card }]}>
              <View style={[styles.modalHeaderContainer, { borderBottomColor: colors.border }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Seleccionar Ocupación</Text>
                  <TouchableOpacity 
                    style={[styles.closeButton, { backgroundColor: colors.inputBackground }]}
                    onPress={() => setOcupacionesModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ padding: 12 }}>
                <TextInput
                  placeholder="Buscar ocupación..."
                  value={ocupSearch}
                  onChangeText={setOcupSearch}
                  style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  placeholderTextColor={colors.placeholder}
                />
                <View style={styles.modalListWrapper}>
                  <FlatList
                    data={filteredOcupaciones}
                    keyExtractor={(item) => item}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    style={{ height: 320 }}
                    ListEmptyComponent={() => (
                      <View style={{ padding: 16 }}>
                        <Text style={{ color: colors.placeholder }}>No se encontraron ocupaciones.</Text>
                      </View>
                    )}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => selectOcupacion(item)}
                        activeOpacity={0.8}
                        style={[
                          styles.ocupacionItem,
                          { backgroundColor: colors.inputBackground },
                          form.ocupacion === item && { backgroundColor: colors.cardSecondary, borderColor: colors.border }
                        ]}
                      >
                        <Text style={[styles.ocupacionText, { color: colors.text }]}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.12)"]}
                    style={styles.modalBottomGradient}
                    pointerEvents="none"
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
// Styles
const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  formCard: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#64748B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  inputContainer: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  rowInput: {
    flex: 1,
  },
  input: {
    height: 36,
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '500',
  },
  inputWrapper: {
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  selectInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    height: 53,
    flex: 1,
  },
  selectValue: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  selectIcon: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    padding: 4,
  },
  passwordStrengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  strengthIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  strengthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  matchText: {
    fontSize: 14,
    fontWeight: '600',
  },
  monedaSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  neumorphicSelector: {
    borderWidth: 1,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  monedaSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  monedaIcon: {
    marginRight: 12,
  },
  monedaText: {
    fontSize: 16,
    fontWeight: '500',
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  neumorphicButton: {
    backgroundColor: '#EF7725',
    shadowColor: '#EF7725',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  loginLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  loginText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loginLink: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF7725',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '70%',
    borderRadius: 24,
    padding: 24,
  },
  neumorphicModal: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalHeaderContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalWarning: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: 300,
  },
  monedaOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedMonedaOption: {
    borderWidth: 1,
  },
  monedaOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  monedaSymbol: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '700',
  },
  monedaInfo: {
    flex: 1,
  },
  monedaOptionText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  monedaCode: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  modalListWrapper: {
    height: 320,
    position: 'relative',
  },
  ocupacionItem: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  ocupacionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  ageHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalBottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 36,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
});

export default RegisterScreen;
