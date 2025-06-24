import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
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
      >
        <Image
          source={require("../images/LitFinance.png")}
          style={styles.logo}
        />

        <Text style={[styles.title, { color: colors.text }]}>LitFinance</Text>

        <View style={styles.inputContainer}>
          <FormInput
            placeholder="Correo"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <FormInput
            placeholder="Contraseña"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            rightIcon={
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.placeholder}
              />
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />
          <TouchableOpacity
            onPress={() => navigation.navigate("ForgotPassword")}
          >
            <Text style={[styles.forgotText, { color: colors.placeholder }]}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.button }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Cargando..." : "Iniciar Sesión"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.signupText, { color: colors.placeholder }]}>
          ¿Aún no tienes cuenta?{" "}
          <Text
            onPress={() => navigation.navigate("Register")}
            style={{ color: "#EF7725", fontWeight: "bold" }}
          >
            Registrarse
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
    resizeMode: "contain",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 32,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  forgotText: {
    paddingBottom: 30,
    textAlign: "center",
    fontSize: 14,
  },
  button: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  signupText: {
    fontSize: 14,
    textAlign: "center",
  },
});

export default LoginScreen;