// commnt
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
          <Image source={require("../images/LitFinance.png")} style={styles.logo} />
          <Text style={[styles.title, { color: colors.text }]}>Recuperar contraseña</Text>
          <Text style={[styles.subtitle, { color: colors.placeholder }]}>
            Ingresa tu correo electrónico y te enviaremos instrucciones para recuperar tu cuenta.
          </Text>
        </View>

        <FormInput
          placeholder="Correo electrónico"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#EF7725" }]}
          onPress={handleSubmit}
        >
          <Text style={styles.buttonText}>Enviar</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
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
  container: { flex: 1 },
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
  logo: {
    width: 100,
    height: 100,
    marginBottom: 12,
    resizeMode: "contain",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  input: {
    height: 30,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderRadius: 10,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backText: {
    fontSize: 14,
    textAlign: "center",
  },
});

export default ForgotPasswordScreen;
