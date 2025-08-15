import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image } from "react-native";
import FormInput from "../components/FormInput";
import { useThemeColors } from "../theme/useThemeColors";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import Toast from "react-native-toast-message";
import { API_BASE_URL } from "../constants/api";

const ForgotPasswordScreen: React.FC = () => {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const [email, setEmail] = useState("");

  const handleSubmit = async () => {
    if (!email.includes("@")) {
      return Toast.show({
        type: "error",
        text1: "Correo inválido",
        text2: "Por favor introduce un correo válido.",
      });
    }

    try {
      const payload = { email };
      console.log("📤 Enviando solicitud de recuperación:", payload);

      const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, payload);
      console.log("✅ Respuesta del servidor:", response.data);

      Toast.show({
        type: "success",
        text1: "Correo enviado",
        text2: "Revisa tu correo para recuperar tu cuenta.",
      });

      navigation.goBack();
    } catch (error: any) {
      console.error("❌ Error al enviar recuperación:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2:
          error.response?.data?.message || "No se pudo enviar el correo. Intenta más tarde.",
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {/* Logo Container con efecto neumorphic */}
          <View style={[styles.logoContainer, { backgroundColor: colors.background }]}>
            <Image source={require("../images/LitFinance.png")} style={styles.logo} />
          </View>
          
          <Text style={[styles.title, { color: colors.text }]}>Recuperar contraseña</Text>
          <Text style={[styles.subtitle, { color: colors.placeholder }]}>
            Ingresa tu correo electrónico y te enviaremos instrucciones para recuperar tu cuenta.
          </Text>
        </View>

        {/* Input Container con efecto neumorphic */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
          <FormInput
            placeholder="Correo electrónico"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#EF7725" }]}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Enviar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backContainer} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.placeholder }]}>
            ¿Ya la recordaste?{" "}
            <Text style={{ color: "#EF7725", fontWeight: "bold" }}>Inicia sesión</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 20,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: "contain",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 12,
    lineHeight: 20,
    fontWeight: '400',
  },
  inputWrapper: {
    marginBottom: 20,
    borderRadius: 16,
    // Efecto neumorphic - sombra externa
    shadowColor: '#000',
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    // Simulación de sombra interna
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  input: {
    height: 36,                    // Altura reducida para look minimalista
    borderRadius: 16,              // Bordes redondeados
    paddingHorizontal: 20,         // Espaciado interno horizontal
    fontSize: 16,                  // Tamaño de fuente
    fontWeight: '500',             // Peso de fuente medio
    backgroundColor: 'transparent', // Fondo transparente
    borderWidth: 0,                // Sin borde propio
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 20,
    paddingBottom: 20,
    // Efecto neumorphic para botón
    shadowColor: '#EF7725',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    // Gradiente simulado con border
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  backContainer: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    // Efecto neumorphic sutil para el link
    shadowColor: '#D1D1D6',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  backText: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: '400',
  },
  iconButton: {
    padding: 4,
  },
});

export default ForgotPasswordScreen;