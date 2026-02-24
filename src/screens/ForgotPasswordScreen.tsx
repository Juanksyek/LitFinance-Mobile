import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, Animated, ActivityIndicator } from "react-native";
import FormInput from "../components/FormInput";
import { useThemeColors } from "../theme/useThemeColors";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { RootStackParamList } from "../navigation/AppNavigator";
import { passwordResetService } from "../services/passwordResetService";
import { fixEncoding } from "../utils/fixEncoding";

const ForgotPasswordScreen: React.FC = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Animaciones
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animación de entrada
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Animación de pulso continua en el logo
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  const handleSubmit = async () => {
    if (!email.includes("@")) {
      return Toast.show({
        type: "error",
        text1: fixEncoding("Correo inválido"),
        text2: fixEncoding("Por favor introduce un correo válido."),
      });
    }

    setLoading(true);
    try {
      await passwordResetService.requestOtp(email);

      Toast.show({
        type: "success",
        text1: fixEncoding("Código enviado"),
        text2: fixEncoding("Si el correo existe, te enviaremos un código de verificación."),
      });

      navigation.navigate("VerifyOtp", { email });
    } catch (error: any) {
      console.error("❌ Error al solicitar OTP:", error);
      Toast.show({
        type: "error",
        text1: fixEncoding("Error"),
        text2: fixEncoding(error.message || "No se pudo enviar el código. Intenta más tarde."),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Logo Container con animación */}
          <Animated.View 
            style={[
              styles.logoContainer,
              {
                transform: [
                  { scale: Animated.multiply(logoScale, pulseAnim) }
                ]
              }
            ]}
          >
            <View style={[styles.logoGlow, { backgroundColor: 'rgba(239, 119, 37, 0.15)' }]} />
            <Image source={require("../images/LitFinance.png")} style={styles.logo} />
          </Animated.View>
          
          <Text style={[styles.title, { color: colors.text }]}>{fixEncoding("Recuperar contraseña")}</Text>
          <Text style={[styles.subtitle, { color: colors.placeholder }]}>
            {fixEncoding("Ingresa tu correo electrónico y te enviaremos un código de verificación.")}
          </Text>
        </Animated.View>

        <Animated.View 
          style={[
            { opacity: fadeAnim },
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Input Container con efecto neumorphic */}
          <View style={[styles.inputWrapper, { backgroundColor: colors.background }]}>
            <FormInput
              placeholder={fixEncoding("Correo electrónico")}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.button, 
              { backgroundColor: "#EF7725" },
              loading && { opacity: 0.7 }
            ]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.buttonText, { marginLeft: 10 }]}>{fixEncoding("Enviando...")}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{fixEncoding("Enviar código")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.backContainer, { backgroundColor: colors.inputBackground }]} 
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={[styles.backText, { color: colors.placeholder }]}>
              {fixEncoding("¿Ya la recordaste? ")}{" "}
              <Text style={{ color: "#EF7725", fontWeight: "bold" }}>{fixEncoding("Inicia sesión")}</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 32 },
  logoContainer: {
    width: 120, height: 120, borderRadius: 30, marginBottom: 12, justifyContent: 'center', alignItems: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 30,
  },
  logo: { width: 100, height: 100, resizeMode: "contain", zIndex: 1 },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, textAlign: "center", marginBottom: 24, paddingHorizontal: 12, lineHeight: 20, fontWeight: '400' },
  inputWrapper: {
    marginBottom: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  input: {
    height: 36, borderRadius: 16, paddingHorizontal: 20, fontSize: 16, fontWeight: '500',
    backgroundColor: 'transparent', borderWidth: 0, margin: 0, paddingTop: 0, paddingBottom: 0,
  },
  button: {
    paddingVertical: 16, borderRadius: 16, alignItems: "center", marginBottom: 20, paddingTop: 20, paddingBottom: 20,
    shadowColor: '#EF7725', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 6, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600", letterSpacing: 0.3 },
  backContainer: {
    alignItems: 'center', padding: 8, borderRadius: 12, shadowColor: '#D1D1D6', shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  backText: { fontSize: 14, textAlign: "center", fontWeight: '400' },
  iconButton: { padding: 4 },
});

export default ForgotPasswordScreen;
