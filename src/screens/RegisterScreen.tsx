import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, Modal, TextInput, FlatList, Switch, Linking, Animated } from 'react-native';
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

  // Entrance animations
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(12)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, speed: 18, bounciness: 6, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(formSlide, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nombreCompleto: '',
    edad: '',
    ocupacion: '',
    monedaPrincipal: 'MXN',
    aceptaTerminos: false,
    aceptaDatosFinancieros: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [monedas, setMonedas] = useState<Moneda[]>(monedasPredefinidas);
  const [monedaModalVisible, setMonedaModalVisible] = useState(false);
  const [monedaSearch, setMonedaSearch] = useState('');
  const [ocupacionesModalVisible, setOcupacionesModalVisible] = useState(false);
  const [ocupSearch, setOcupSearch] = useState('');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step transition animations
  const stepSlide = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;

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

  // Normalize strings for diacritics/accents and collapse whitespace
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const formatSymbol = (m: Moneda) => {
    if (m && m.simbolo && m.simbolo.length > 0) return m.simbolo;
    const fallback: Record<string, string> = {
      USD: '$',
      MXN: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      PEN: 'S/',
      BRL: 'R$',
      CAD: 'C$',
      AUD: 'A$',
      NZD: 'NZ$',
      CHF: 'CHF',
    };
    return fallback[m.codigo] || m.codigo;
  };

  const filteredMonedas = useMemo(() => {
    const q = normalize(monedaSearch || '');
    if (!q) return monedas;
    return monedas.filter(m => {
      const name = normalize(m.nombre || '');
      const code = (m.codigo || '').toLowerCase();
      const symbol = normalize(String(m.simbolo || ''));
      return name.includes(q) || code.includes(q) || symbol.includes(q);
    });
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

    if (!form.aceptaTerminos) {
      return Toast.show({
        type: 'error',
        text1: 'Términos requeridos',
        text2: 'Debes aceptar los Términos y la Política de Privacidad.',
      });
    }

    if (!form.aceptaDatosFinancieros) {
      return Toast.show({
        type: 'error',
        text1: 'Consentimiento requerido',
        text2: 'Debes otorgar tu consentimiento para el tratamiento de datos patrimoniales y financieros.',
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
        aceptaTerminos: form.aceptaTerminos,
        aceptaDatosFinancieros: form.aceptaDatosFinancieros,
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

  const goToStep = (nextStep: 1 | 2 | 3) => {
    const direction = nextStep > currentStep ? 1 : -1;
    Animated.parallel([
      Animated.timing(stepOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(stepSlide, { toValue: direction * -24, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setCurrentStep(nextStep);
      stepSlide.setValue(direction * 24);
      Animated.parallel([
        Animated.timing(stepOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(stepSlide, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!form.nombreCompleto.trim()) {
        return Toast.show({ type: 'error', text1: 'Nombre requerido', text2: 'Ingresa tu nombre completo.' });
      }
      const edadTrim = (form.edad || '').toString().trim();
      const edadNum = Number(edadTrim);
      if (!edadTrim || !Number.isFinite(edadNum) || !Number.isInteger(edadNum) || edadNum < 13 || edadNum > 100) {
        return Toast.show({ type: 'error', text1: 'Edad inválida', text2: 'Ingresa un número entero entre 13 y 100.' });
      }
      if (!form.ocupacion.trim()) {
        return Toast.show({ type: 'error', text1: 'Ocupación requerida', text2: 'Selecciona tu ocupación.' });
      }
      goToStep(2);
    } else if (currentStep === 2) {
      if (!form.email || !form.password || !form.confirmPassword) {
        return Toast.show({ type: 'error', text1: 'Campos requeridos', text2: 'Completa todos los campos.' });
      }
      if (!passwordsMatch) {
        return Toast.show({ type: 'error', text1: 'Contraseñas no coinciden' });
      }
      goToStep(3);
    } else {
      handleRegister();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <Image source={require('../images/LitFinance.png')} style={styles.logo} />
          </Animated.View>
          <Animated.Text style={[styles.title, { color: colors.text, opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>Crear cuenta</Animated.Text>
          <Animated.Text style={[styles.subtitle, { color: colors.placeholder, opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>
            Solo 3 pasos rápidos
          </Animated.Text>
        </View>

        <Animated.View style={[styles.formCard, { backgroundColor: colors.card, opacity: formOpacity, transform: [{ translateY: formSlide }] }]}>

          {/* Step progress indicator */}
          <View style={styles.stepperContainer}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, { backgroundColor: '#EF7725' }]}>
                {currentStep > 1
                  ? <Ionicons name="checkmark" size={16} color="white" />
                  : <Ionicons name="person-outline" size={16} color="white" />
                }
              </View>
              <Text style={[styles.stepLabel, styles.stepLabelActive]}>Personal</Text>
            </View>
            <View style={[styles.stepLine, { backgroundColor: currentStep > 1 ? '#EF7725' : colors.border }]} />
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, { backgroundColor: currentStep >= 2 ? '#EF7725' : colors.inputBackground }]}>
                {currentStep > 2
                  ? <Ionicons name="checkmark" size={16} color="white" />
                  : <Ionicons name="lock-closed-outline" size={16} color={currentStep >= 2 ? 'white' : colors.placeholder} />
                }
              </View>
              <Text style={[styles.stepLabel, currentStep >= 2 && styles.stepLabelActive]}>Acceso</Text>
            </View>
            <View style={[styles.stepLine, { backgroundColor: currentStep > 2 ? '#EF7725' : colors.border }]} />
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, { backgroundColor: currentStep >= 3 ? '#EF7725' : colors.inputBackground }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color={currentStep >= 3 ? 'white' : colors.placeholder} />
              </View>
              <Text style={[styles.stepLabel, currentStep >= 3 && styles.stepLabelActive]}>Finalizar</Text>
            </View>
          </View>

          {/* Animated step content */}
          <Animated.View style={{ opacity: stepOpacity, transform: [{ translateX: stepSlide }] }}>

            {/* Step 1: Personal info */}
            {currentStep === 1 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>¿Cómo te llamas?</Text>
                <Text style={[styles.stepSubtitle, { color: colors.placeholder }]}>Cuéntanos un poco sobre ti</Text>

                <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
                  <FormInput
                    placeholder="Nombre completo"
                    value={form.nombreCompleto}
                    onChangeText={(v) => handleChange('nombreCompleto', v)}
                    style={[styles.input, { borderWidth: 0 }]}
                  />
                </View>

                <View style={styles.row}>
                  <View style={styles.rowInput}>
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
                  <View style={styles.rowInput}>
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
                <Text style={[styles.ageHint, { color: colors.placeholder }]}>Edad: número entero entre 13 y 100</Text>
              </View>
            )}

            {/* Step 2: Account access */}
            {currentStep === 2 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Tu acceso</Text>
                <Text style={[styles.stepSubtitle, { color: colors.placeholder }]}>Configura cómo entrarás a la app</Text>

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

                {form.password.length > 0 && (
                  <View style={styles.passwordStrengthContainer}>
                    <View style={[styles.strengthIndicator, { backgroundColor: strengthColor }]} />
                    <Text style={[styles.strengthText, { color: strengthColor }]}>
                      Fortaleza: {passwordStrength}
                    </Text>
                  </View>
                )}

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
            )}

            {/* Step 3: Preferences & consent */}
            {currentStep === 3 && (
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Últimos detalles</Text>
                <Text style={[styles.stepSubtitle, { color: colors.placeholder }]}>Ya casi terminas, ¡ánimo!</Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.inputWrapper, { backgroundColor: colors.background }]}
                  onPress={() => setMonedaModalVisible(true)}
                >
                  <View style={[styles.selectInner, { paddingHorizontal: 16, paddingVertical: 12 }]}>
                    <Ionicons name="wallet-outline" size={20} color="#EF7725" style={{ marginRight: 10 }} />
                    <Text style={[styles.selectValue, { color: colors.text }]}>{
                      (() => {
                        const m = monedas.find(m => m.codigo === form.monedaPrincipal);
                        return m ? `${formatSymbol(m)}  ${m.nombre}` : form.monedaPrincipal;
                      })()
                    }</Text>
                    <View style={styles.selectIcon}>
                      <Ionicons name="chevron-down" size={20} color={colors.placeholder} />
                    </View>
                  </View>
                </TouchableOpacity>
                <Text style={[styles.ageHint, { color: '#EF7725' }]}>⚠️ La moneda no podrá cambiarse después</Text>

                <View style={[styles.consentCard, { backgroundColor: colors.inputBackground }]}>
                  <View style={styles.consentRow}>
                    <Switch
                      value={form.aceptaTerminos}
                      onValueChange={(v) => handleChange('aceptaTerminos', v)}
                      trackColor={{ false: '#ccc', true: '#EF7725' }}
                      thumbColor={form.aceptaTerminos ? '#fff' : '#f4f3f4'}
                    />
                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                      {'He leído y acepto los '}
                      <Text
                        style={styles.checkboxLink}
                        onPress={() => Linking.openURL('https://thelitfinance.com/terminos')}
                      >
                        Términos y Condiciones
                      </Text>
                      {' y la '}
                      <Text
                        style={styles.checkboxLink}
                        onPress={() => Linking.openURL('https://thelitfinance.com/privacidad')}
                      >
                        Política de Privacidad
                      </Text>
                      .
                    </Text>
                  </View>
                  <View style={[styles.consentDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.consentRow}>
                    <Switch
                      value={form.aceptaDatosFinancieros}
                      onValueChange={(v) => handleChange('aceptaDatosFinancieros', v)}
                      trackColor={{ false: '#ccc', true: '#EF7725' }}
                      thumbColor={form.aceptaDatosFinancieros ? '#fff' : '#f4f3f4'}
                    />
                    <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                      {'Otorgo mi consentimiento para el tratamiento de mis datos financieros conforme al '}
                      <Text
                        style={styles.checkboxLink}
                        onPress={() => Linking.openURL('https://thelitfinance.com/terminos')}
                      >
                        Aviso de Datos Financieros
                      </Text>
                      .
                    </Text>
                  </View>
                </View>
              </View>
            )}

          </Animated.View>

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {currentStep > 1 && (
              <TouchableOpacity
                style={[styles.backButton, { borderColor: colors.border }]}
                onPress={() => goToStep((currentStep - 1) as 1 | 2 | 3)}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.nextButton, currentStep === 3 && !(form.aceptaTerminos && form.aceptaDatosFinancieros) && styles.buttonDisabled]}
              onPress={handleNextStep}
              activeOpacity={0.8}
              disabled={currentStep === 3 && !(form.aceptaTerminos && form.aceptaDatosFinancieros)}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>
                  {currentStep === 3 ? 'Crear mi cuenta' : 'Continuar'}
                </Text>
                <Ionicons name={currentStep === 3 ? 'checkmark' : 'arrow-forward'} size={20} color="white" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.loginLinkContainer}>
            <Text style={[styles.loginText, { color: colors.placeholder }]}>
              ¿Ya tienes cuenta?
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Inicia sesión</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

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
                            <Text style={[styles.symbolText, { color: colors.textSecondary }]}>{formatSymbol(moneda)}</Text>
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
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
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
  // Step progress indicator
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  stepItem: {
    alignItems: 'center',
    width: 60,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginTop: 17,
  },
  stepLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#EF7725',
    fontWeight: '600',
  },
  // Step content
  stepContent: {
    minHeight: 240,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  stepSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
  },
  // Inputs
  row: {
    flexDirection: 'row',
    gap: 12,
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
    marginBottom: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
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
    marginTop: -4,
  },
  strengthIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  strengthText: {
    fontSize: 13,
    fontWeight: '600',
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: -4,
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
    fontSize: 13,
    fontWeight: '600',
  },
  // Consent card
  consentCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  consentDivider: {
    height: 1,
    marginVertical: 12,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  checkboxLink: {
    color: '#EF7725',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  // Navigation
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  nextButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF7725',
    shadowColor: '#EF7725',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  loginLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  loginText: {
    fontSize: 15,
    fontWeight: '500',
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF7725',
  },
  ageHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: -8,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  // Modals
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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalWarning: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalListWrapper: {
    height: 320,
    position: 'relative',
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
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  monedaCode: {
    fontSize: 13,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  ocupacionItem: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  ocupacionText: {
    fontSize: 15,
    fontWeight: '600',
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

