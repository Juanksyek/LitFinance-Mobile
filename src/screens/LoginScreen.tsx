import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView, Animated } from "react-native";
import { apiRateLimiter } from "../services/apiRateLimiter";
import { authService } from "../services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import FormInput from "../components/FormInput";
import { useThemeColors } from "../theme/useThemeColors";
import { useNavigation, NavigationProp, StackActions } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import { API_BASE_URL } from "../constants/api";
import { Ionicons } from "@expo/vector-icons";

import { registerForPushNotifications } from "../services/notificationService";
import { jwtDecode } from "../utils/jwtDecode";
import { sanitizeObjectStrings } from "../utils/fixMojibake";

const LoginScreen: React.FC = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animations
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(16)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(24)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo bounce in
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      // Title fade+slide
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      // Form fade+slide
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(formSlide, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
      // Button fade+slide
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(buttonSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({ type: "error", text1: "Campos requeridos", text2: "Ingresa tu correo y contraseña." });
      return;
    }

    setLoading(true);

    try {
      // Ensure we have a deviceId for this installation and include it in login
      const deviceId = await authService.getOrCreateDeviceId();
      // Login uses direct fetch to avoid rate-limiter intercepting auth endpoints
      // Use centralized apiRateLimiter which now bypasses auth endpoints safely
      const response = await apiRateLimiter.fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err: any = new Error(errorData.message || `Error ${response.status}`);
        err.status = response.status;
        err.data = errorData;
        throw err;
      }

      const responseData = await response.json();
      // Be tolerant to backend response shapes
      const accessToken =
        responseData?.accessToken ||
        responseData?.token ||
        responseData?.data?.accessToken ||
        responseData?.data?.token ||
        null;
      const refreshToken =
        responseData?.refreshToken ||
        responseData?.refresh_token ||
        responseData?.data?.refreshToken ||
        responseData?.data?.refresh_token ||
        responseData?.tokens?.refreshToken ||
        responseData?.tokens?.refresh_token ||
        null;
      const user = responseData?.user || responseData?.data?.user || responseData?.usuario || responseData?.data?.usuario || null;
      const message = responseData?.message || responseData?.data?.message;

      console.log('🔑 accessToken:', accessToken);
      console.log('👤 user recibido:', user);
      if (!accessToken || !user) {
        throw new Error("La respuesta del servidor no es válida.");
      }

      // Prioridad: responseData.rol > user.rol > JWT > 'usuario'
      let rol = (responseData && (responseData.rol || responseData.role)) || user.rol;
      if (!rol && accessToken) {
        try {
          const decoded = jwtDecode(accessToken);
          console.log('🪪 JWT decodificado:', decoded);
          rol = decoded.rol || decoded.role || 'usuario';
        } catch (err) {
          console.log('❌ Error decodificando JWT:', err);
          rol = 'usuario';
        }
      }

      const usuarioParaGuardar = sanitizeObjectStrings({
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        cuentaId: user.cuentaId,
        rol: rol || 'usuario',
        // Premium fields (used for gating / plan limits)
        premiumSubscriptionStatus: user.premiumSubscriptionStatus ?? null,
        premiumUntil: user.premiumUntil ?? null,
        premiumSubscriptionId: user.premiumSubscriptionId ?? null,
      });

      await authService.setAccessToken(accessToken);
      if (refreshToken) await authService.setRefreshToken(refreshToken);
      await AsyncStorage.setItem("userData", JSON.stringify(usuarioParaGuardar));
      // Guardar identificadores usados por componentes para render inmediato
      try {
        if (user.id) await AsyncStorage.setItem('userId', String(user.id));
        if (user.cuentaId) await AsyncStorage.setItem('cuentaId', String(user.cuentaId));
      } catch {}

      Toast.show({
        type: "success",
        text1: message || "Inicio de sesión exitoso",
        text2: `Bienvenido, ${user.nombre || "usuario"}`,
      });

      // 🔔 IMPORTANTE: Registrar notificaciones después de login
      try {
        await registerForPushNotifications();
        console.log('✅ Notificaciones registradas correctamente');
      } catch (notifError) {
        console.warn('⚠️ Error registrando notificaciones:', notifError);
        // No bloquear el login si falla el registro de notificaciones
      }

      // Navegar a Dashboard (la pantalla se encarga de inicializar ids y sincronizar en background)
      navigation.dispatch(StackActions.replace("Dashboard"));
    } catch (error: any) {
      // Mejor manejo de errores para mostrar mensajes más útiles al usuario
      let title = "Error al iniciar sesión";
      let message = error?.message || "No se pudo conectar";

      // Normalize message/status for backend variations (401, 404, 'Unauthorized', 'not found')
      try {
        // Priorizar códigos estructurados desde backend
        const code = error?.data?.code || (error?.response && error.response.data && error.response.data.code);
        const status = error?.status || (error?.response && error.response.status) || null;
        const rawMsg = (error?.message || (error?.response && error.response.data && error.response.data.message) || '').toString().toLowerCase();

        if (code === 'ACCOUNT_NOT_ACTIVATED') {
          title = 'Cuenta no activada';
          message = 'Tu cuenta aún no ha sido activada. Revisa tu correo para confirmar la cuenta.';
          Toast.show({ type: 'info', text1: title, text2: message, visibilityTime: 8000 });
          setLoading(false);
          return;
        } else if (code === 'USER_NOT_FOUND' || code === 'USER_NOT_REGISTERED' || code === 'ACCOUNT_NOT_FOUND' || status === 404 || rawMsg.includes('not registered') || rawMsg.includes('usuario no registrado') || rawMsg.includes('not found')) {
          // Caso claro: usuario no registrado
          title = 'Usuario no registrado';
          message = 'No estás registrado. Regístrate para continuar.';
        } else if (code === 'INVALID_CREDENTIALS' || status === 401 || rawMsg.includes('invalid credentials') || rawMsg.includes('invalid password') || rawMsg.includes('correo o contraseña')) {
          // Credenciales inválidas
          title = 'Credenciales incorrectas';
          message = 'Correo o contraseña incorrectos. Verifica e inténtalo de nuevo.';
          setPassword("");
        } else if (status >= 500) {
          title = 'Error del servidor';
          message = 'No se pudo conectar con el servidor. Intenta más tarde.';
        } else if (status === 429) {
          title = 'Demasiados intentos';
          message = 'Has intentado iniciar sesión muchas veces. Intenta de nuevo más tarde.';
        } else if (error?.data && typeof error.data.message === 'string') {
          message = error.data.message;
        }
      } catch (internalErr) {
        // ignore parsing errors
      }

      Toast.show({ type: "error", text1: title, text2: message });
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
        <Animated.View style={[{ backgroundColor: colors.background }, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Image
            source={require("../images/LitFinance.png")}
            style={styles.logo}
          />
        </Animated.View>

        <Animated.Text style={[styles.title, { color: colors.text }, { opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>LitFinance</Animated.Text>
        <Animated.Text style={[styles.subtitle, { color: colors.placeholder }, { opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>
          Bienvenido de vuelta
        </Animated.Text>

        {/* Main Card Container */}
        <Animated.View style={[styles.cardContainer, { backgroundColor: colors.background }, { opacity: formOpacity, transform: [{ translateY: formSlide }] }]}>
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
          <Animated.View style={{ opacity: buttonOpacity, transform: [{ translateY: buttonSlide }] }}>
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
          </Animated.View>
        </Animated.View>

        {/* Sign up section */}
        <Animated.View style={[styles.signupContainer, { opacity: buttonOpacity }]}>
          <Text style={[styles.signupText, { color: colors.placeholder }]}>
            ¿Aún no tienes cuenta?{" "}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.signupLink}>Registrarse</Text>
          </TouchableOpacity>
        </Animated.View>
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