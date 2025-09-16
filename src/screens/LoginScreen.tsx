import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import FormInput from "../components/FormInput";
import { useThemeColors } from "../theme/useThemeColors";
import { useNavigation, NavigationProp, StackActions } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import { API_BASE_URL } from "../constants/api";
import Ionicons from "react-native-vector-icons/Ionicons";

const LoginScreen: React.FC = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: "error",
        text1: "Campos requeridos",
        text2: "Ingresa tu correo y contraseña.",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      const { accessToken, user, message } = response.data;

      if (!accessToken || !user) {
        throw new Error("La respuesta del servidor no es válida.");
      }

      const usuarioParaGuardar = {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        cuentaId: user.cuentaId,
      };
  
      await AsyncStorage.setItem("authToken", accessToken);
      await AsyncStorage.setItem("userData", JSON.stringify(usuarioParaGuardar));
    
      Toast.show({
        type: "success",
        text1: message || "Inicio de sesión exitoso",
        text2: `Bienvenido, ${user.nombre || "usuario"}`,
      });
  
      navigation.dispatch(StackActions.replace("Dashboard"));
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error al iniciar sesión",
        text2: error.message || "No se pudo conectar",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Container with Neumorphic Effect */}
        <View style={[{ backgroundColor: colors.background }]}>
          <Image
            source={require("../images/LitFinance.png")}
            style={styles.logo}
          />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>LitFinance</Text>
        <Text style={[styles.subtitle, { color: colors.placeholder }]}>
          Bienvenido de vuelta
        </Text>

        {/* Main Card Container */}
        <View style={[styles.cardContainer, { backgroundColor: colors.background }]}>
          <View style={styles.inputContainer}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
              <FormInput
                placeholder="Correo electrónico"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                style={[styles.input, { borderWidth: 0 }]}
              />
            </View>
            
            <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
              <FormInput
                placeholder="Contraseña"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                style={[styles.input, { borderWidth: 0 }]}
                rightIcon={
                  <TouchableOpacity 
                    style={styles.iconButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color={colors.placeholder}
                    />
                  </TouchableOpacity>
                }
              />
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPassword")}
              style={styles.forgotContainer}
            >
              <Text style={[styles.forgotText, { color: colors.placeholder }]}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login Button with Neumorphic Effect */}
          <TouchableOpacity
            style={[
              styles.button, 
              { backgroundColor: loading ? colors.placeholder : colors.button },
              loading && styles.buttonDisabled
            ]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { opacity: loading ? 0.7 : 1 }]}>
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign up section */}
        <View style={styles.signupContainer}>
          <Text style={[styles.signupText, { color: colors.placeholder }]}>
            ¿Aún no tienes cuenta?{" "}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.signupLink}>Registrarse</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logo: {
    width: 70,
    height: 70,
    resizeMode: "contain",
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "400",
    marginBottom: 40,
    opacity: 0.7,
  },
  cardContainer: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: -8,
      height: -8,
    },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    borderWidth: Platform.OS === 'ios' ? 1 : 0,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputContainer: {
    width: "100%",
    marginBottom: 24,
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
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  input: {
    height: 36,
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '500',
  },
  iconButton: {
    padding: 4,
  },
  forgotContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: "500",
  },
  button: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#EF7725',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  buttonDisabled: {
    shadowOpacity: 0.1,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  signupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupText: {
    fontSize: 14,
    fontWeight: "400",
  },
  signupLink: {
    color: "#EF7725", 
    fontWeight: "700",
    fontSize: 14,
  },
});

export default LoginScreen;