import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Image, Alert
} from 'react-native';
import FormInput from '../components/FormInput';
import { useThemeColors } from '../theme/useThemeColors';
import { useNavigation } from '@react-navigation/native';

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
  });

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleRegister = () => {
    if (form.password !== form.confirmPassword) {
      return Alert.alert('Error', 'Las contraseñas no coinciden');
    }

    console.log('Datos enviados:', form);
    Alert.alert('Éxito', 'Registro exitoso');
    navigation.goBack();
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
          <FormInput
            placeholder="Nombre completo"
            value={form.nombreCompleto}
            onChangeText={(v) => handleChange('nombreCompleto', v)}
          />
          <FormInput
            placeholder="Correo electrónico"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(v) => handleChange('email', v)}
          />
          <FormInput
            placeholder="Edad"
            keyboardType="numeric"
            value={form.edad}
            onChangeText={(v) => handleChange('edad', v)}
          />
          <FormInput
            placeholder="Ocupación"
            value={form.ocupacion}
            onChangeText={(v) => handleChange('ocupacion', v)}
          />
          <FormInput
            placeholder="Contraseña"
            secureTextEntry
            value={form.password}
            onChangeText={(v) => handleChange('password', v)}
          />
          <FormInput
            placeholder="Confirmar contraseña"
            secureTextEntry
            value={form.confirmPassword}
            onChangeText={(v) => handleChange('confirmPassword', v)}
          />

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
});

export default RegisterScreen;