import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, Modal } from 'react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
      ? '#EF6C00'
      : passwordStrength === 'Media'
      ? '#FFA726'
      : '#FFE0B2';

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
          <Image source={require('../images/LitFinance.png')} style={styles.logo} />
          <Text style={[styles.title, { color: colors.text }]}>Crear cuenta</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Datos personales</Text>
          <FormInput
            placeholder="Nombre completo"
            value={form.nombreCompleto}
            onChangeText={(v) => handleChange('nombreCompleto', v)}
            style={styles.input}
          />
          <View style={styles.row}>
            <View style={styles.rowInput}>
              <FormInput
                placeholder="Edad"
                keyboardType="numeric"
                value={form.edad}
                onChangeText={(v) => handleChange('edad', v)}
              />
            </View>
            <View style={styles.rowInput}>
              <FormInput
                placeholder="Ocupación"
                value={form.ocupacion}
                onChangeText={(v) => handleChange('ocupacion', v)}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Datos de cuenta</Text>
          <FormInput
            placeholder="Correo electrónico"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(v) => handleChange('email', v)}
            style={styles.input}
          />
          <FormInput
            placeholder="Contraseña"
            secureTextEntry={!showPassword}
            value={form.password}
            onChangeText={(v) => handleChange('password', v)}
            style={styles.input}
            rightIcon={
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.placeholder}
              />
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />
          <Text style={{ color: strengthColor, marginBottom: 8 }}>
            Fortaleza: <Text style={{ fontWeight: 'bold' }}>{passwordStrength}</Text>
          </Text>

          <FormInput
            placeholder="Confirmar contraseña"
            secureTextEntry={!showConfirmPassword}
            value={form.confirmPassword}
            onChangeText={(v) => handleChange('confirmPassword', v)}
            style={styles.input}
            rightIcon={
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.placeholder}
              />
            }
            onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
          />
          {form.confirmPassword.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons
                name={passwordsMatch ? 'checkmark-circle-outline' : 'close-circle-outline'}
                size={18}
                color={passwordsMatch ? '#53F29D' : '#EF6C00'}
              />
              <Text style={{ marginLeft: 6, color: colors.placeholder }}>
                {passwordsMatch ? 'Coinciden' : 'No coinciden'}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Preferencias</Text>
          <TouchableOpacity 
            style={styles.monedaSelector}
            onPress={() => setMonedaModalVisible(true)}
          >
            <Text style={styles.monedaText}>
              Moneda preferida: {monedas.find(m => m.codigo === form.monedaPreferencia)?.nombre || form.monedaPreferencia}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.placeholder} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, { backgroundColor: '#EF7725' }]} onPress={handleRegister}>
            <Text style={styles.buttonText}>Registrarse</Text>
          </TouchableOpacity>

          <Text style={[styles.backText, { color: colors.placeholder }]}>
            ¿Ya tienes cuenta?{' '}
            <Text style={{ color: '#EF7725', fontWeight: 'bold' }} onPress={() => navigation.goBack()}>
              Inicia sesión
            </Text>
          </Text>
        </View>

        {/* Modal para seleccionar moneda */}
        <Modal
          visible={monedaModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setMonedaModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar Moneda</Text>
                <TouchableOpacity onPress={() => setMonedaModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll}>
                {monedas.map((moneda) => (
                  <TouchableOpacity
                    key={moneda.codigo}
                    style={styles.monedaOption}
                    onPress={() => {
                      handleChange('monedaPreferencia', moneda.codigo);
                      setMonedaModalVisible(false);
                    }}
                  >
                    <Text style={styles.monedaOptionText}>
                      {moneda.simbolo} {moneda.nombre} ({moneda.codigo})
                    </Text>
                    {form.monedaPreferencia === moneda.codigo && (
                      <Ionicons name="checkmark" size={20} color="#EF7725" />
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
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 12,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  form: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowInput: {
    flex: 1,
  },
  input: {
    height: 48,
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backText: {
    fontSize: 14,
    textAlign: 'center',
  },
  monedaSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  monedaText: {
    fontSize: 16,
    color: '#495057',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalScroll: {
    maxHeight: 300,
  },
  monedaOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  monedaOptionText: {
    fontSize: 16,
    color: '#374151',
  },
});

export default RegisterScreen;