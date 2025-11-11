import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, Modal } from 'react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import FormInput from '../components/FormInput';
import { useThemeColors } from '../theme/useThemeColors';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../constants/api';
import { monedasPredefinidas, Moneda } from '../constants/monedas';
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
    monedaPreferencia: 'USD',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [monedas, setMonedas] = useState<Moneda[]>(monedasPredefinidas);
  const [monedaModalVisible, setMonedaModalVisible] = useState(false);

  const handleChange = (key: keyof typeof form, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const fetchMonedas = async () => {
    try {
      console.log('Obteniendo monedas desde: /monedas/catalogo');
      const response = await axios.get(`${API_BASE_URL}/monedas/catalogo`);
      
      if (response.data && Array.isArray(response.data)) {
        setMonedas(response.data);
        return;
      }
    } catch (error: any) {
      console.log(`❌ Error obteniendo monedas:`, error.response?.status || error.message);
    }
    setMonedas(monedasPredefinidas);
  };

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
    if (
      !form.email || !form.password || !form.confirmPassword ||
      !form.nombreCompleto || !form.edad || !form.ocupacion
    ) {
      return Toast.show({
        type: 'error',
        text1: 'Campos requeridos',
        text2: 'Completa todos los campos.',
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
        edad: parseInt(form.edad, 10),
        ocupacion: form.ocupacion,
        monedaPreferencia: form.monedaPreferencia,
      };

      await axios.post(`${API_BASE_URL}/auth/register`, payload);

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
        text2: error.response?.data?.message || 'Intenta más tarde.',
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

        <View style={styles.formCard}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
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
                <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
                  <FormInput
                    placeholder="Ocupación"
                    value={form.ocupacion}
                    onChangeText={(v) => handleChange('ocupacion', v)}
                    style={[styles.input, { borderWidth: 0 }]}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Sección: Datos de cuenta */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
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
              <View style={styles.sectionIcon}>
                <Ionicons name="settings-outline" size={20} color="#EF7725" />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferencias</Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.monedaSelector, styles.neumorphicSelector]}
              onPress={() => setMonedaModalVisible(true)}
            >
              <View style={styles.monedaSelectorContent}>
                <Ionicons name="card-outline" size={20} color="#6B7280" style={styles.monedaIcon} />
                <Text style={[styles.monedaText, { color: colors.text }]}>
                  {monedas.find(m => m.codigo === form.monedaPreferencia)?.nombre || form.monedaPreferencia}
                </Text>
              </View>
              <View style={styles.chevronContainer}>
                <Ionicons name="chevron-down" size={20} color={colors.placeholder} />
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

          {/* Link para login */}
          <View style={styles.loginLinkContainer}>
            <Text style={[styles.loginText, { color: colors.placeholder }]}>
              ¿Ya tienes cuenta?
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Inicia sesión</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal para seleccionar moneda */}
        <Modal
          visible={monedaModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setMonedaModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, styles.neumorphicModal]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Seleccionar Moneda</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setMonedaModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                {monedas.map((moneda) => (
                  <TouchableOpacity
                    key={moneda.codigo}
                    style={[
                      styles.monedaOption,
                      form.monedaPreferencia === moneda.codigo && styles.selectedMonedaOption
                    ]}
                    onPress={() => {
                      handleChange('monedaPreferencia', moneda.codigo);
                      setMonedaModalVisible(false);
                    }}
                  >
                    <View style={styles.monedaOptionContent}>
                      <View style={styles.monedaSymbol}>
                        <Text style={styles.symbolText}>{moneda.simbolo}</Text>
                      </View>
                      <View style={styles.monedaInfo}>
                        <Text style={[styles.monedaOptionText, { color: colors.text }]}>
                          {moneda.nombre}
                        </Text>
                        <Text style={[styles.monedaCode, { color: colors.placeholder }]}>
                          {moneda.codigo}
                        </Text>
                      </View>
                    </View>
                    {form.monedaPreferencia === moneda.codigo && (
                      <View style={styles.checkIcon}>
                        <Ionicons name="checkmark" size={20} color="#10B981" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#FAFAFA',
  },
  selectedMonedaOption: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
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
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
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
});

export default RegisterScreen;
