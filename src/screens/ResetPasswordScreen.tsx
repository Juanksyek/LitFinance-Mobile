import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import FormInput from "../components/FormInput";
import { useThemeColors } from "../theme/useThemeColors";
import { useNavigation, useRoute, NavigationProp, RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import axios from "axios";
import Toast from "react-native-toast-message";
import { API_BASE_URL } from "../constants/api";

const ResetPasswordScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const route = useRoute<RouteProp<RootStackParamList, "ResetPassword">>();
  const email = route.params?.email || "";

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // ====== Neumorphism tokens (derivados del tema) ======
  const theme = useMemo(() => {
    const bg = colors.background;
    // sombritas claras/oscuras para relieve
    const shadowDark = "rgba(0, 0, 0, 0.35)";
    const shadowLight = "rgba(255, 255, 255, 0.18)";
    const borderSoft = "rgba(255, 255, 255, 0.08)";
    // superficies ligeramente elevadas
    const surface = colors.inputBackground ?? bg;
    const accent = "#EF7725";
    return { bg, surface, shadowDark, shadowLight, borderSoft, accent };
  }, [colors]);

  useEffect(() => {
    if (!canResend && timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    } else if (timer <= 0) {
      setCanResend(true);
    }
  }, [timer, canResend]);

  const handleResend = async () => {
    if (!email) return;
    setCanResend(false);
    setTimer(60);
    try {
      await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
      Toast.show({ type: "success", text1: "Correo reenviado", text2: "Revisa tu correo nuevamente." });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.response?.data?.message || "No se pudo reenviar el correo.",
      });
    }
  };

  const handleSubmit = async () => {
    if (!code || !newPassword || !confirmPassword) {
      return Toast.show({ type: "error", text1: "Campos incompletos", text2: "Completa todos los campos." });
    }
    if (newPassword !== confirmPassword) {
      return Toast.show({ type: "error", text1: "Contraseñas no coinciden", text2: "Verifica que ambas contraseñas sean iguales." });
    }
    try {
      const payload = { email, code, newPassword, confirmPassword };
      await axios.post(`${API_BASE_URL}/auth/reset-password`, payload);
      Toast.show({ type: "success", text1: "Contraseña actualizada", text2: "Ya puedes iniciar sesión." });
      navigation.navigate("Login");
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.response?.data?.message || "No se pudo actualizar la contraseña.",
      });
    }
  };

  // (opcional) enmascarado visual del correo
  const maskedEmail = useMemo(() => {
    if (!email) return "";
    const [user, domain] = email.split("@");
    if (!domain) return email;
    const u = user.length <= 2 ? user[0] + "*" : user[0] + "*".repeat(Math.max(1, user.length - 2)) + user.slice(-1);
    return `${u}@${domain}`;
  }, [email]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Tarjeta principal Neumorphic */}
        <View
          style={[
            styles.neuCard,
            {
              backgroundColor: theme.surface,
              shadowColor: theme.shadowDark,
              borderColor: theme.borderSoft,
            }
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Restablecer contraseña</Text>
            <Text style={[styles.subtitle, { color: colors.placeholder }]}>
              Se mandó un código a:{" "}
              <Text style={{ color: colors.text, fontWeight: "600" }}>{maskedEmail || email}</Text>
            </Text>
            <Text style={[styles.subtitle, { color: colors.placeholder }]}>
              Ingresa el código recibido y tu nueva contraseña.
            </Text>
          </View>

          {/* Input: Código */}
          <View
            style={[
              styles.neuInputWrapper,
              {
                backgroundColor: theme.surface,
                shadowColor: theme.shadowDark,
                borderColor: theme.borderSoft,
              }
            ]}
          >
            <FormInput
              placeholder="Código"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              style={styles.input}
            />
            <View style={[styles.innerHighlight, { borderColor: theme.shadowLight }]} />
          </View>

          {/* Input: Nueva contraseña */}
          <View
            style={[
              styles.neuInputWrapper,
              {
                backgroundColor: theme.surface,
                shadowColor: theme.shadowDark,
                borderColor: theme.borderSoft,
              }
            ]}
          >
            <FormInput
              placeholder="Nueva contraseña"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
            />
            <View style={[styles.innerHighlight, { borderColor: theme.shadowLight }]} />
          </View>

          {/* Input: Confirmar contraseña */}
          <View
            style={[
              styles.neuInputWrapper,
              {
                backgroundColor: theme.surface,
                shadowColor: theme.shadowDark,
                borderColor: theme.borderSoft,
              }
            ]}
          >
            <FormInput
              placeholder="Confirmar contraseña"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
            />
            <View style={[styles.innerHighlight, { borderColor: theme.shadowLight }]} />
          </View>

          {/* Botón neumorphic acentuado */}
          <TouchableOpacity
            style={[
              styles.neuButton,
              {
                backgroundColor: theme.accent,
                shadowColor: theme.shadowDark,
                borderColor: "rgba(255,255,255,0.22)",
              }
            ]}
            onPress={handleSubmit}
            activeOpacity={0.9}
          >
            <Text style={styles.buttonText}>Restablecer</Text>
          </TouchableOpacity>

          {/* Reenviar código */}
          <View style={styles.resendContainer}>
            <Text style={{ color: colors.placeholder }}>
              ¿No recibiste el código?{" "}
              {canResend ? (
                <Text style={{ color: theme.accent, fontWeight: "600" }} onPress={handleResend}>
                  Reenviar
                </Text>
              ) : (
                <Text>Reenviar en {timer}s</Text>
              )}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const RADIUS = 18;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },

  // ====== Neumorphism blocks ======
  neuCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    // sombras suaves combinadas
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  neuInputWrapper: {
    position: "relative",
    marginBottom: 16,
    borderRadius: RADIUS,
    paddingHorizontal: 4,
    borderWidth: 1,
    // sombra externa sutil
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  innerHighlight: {
    // simula luz superior izquierda (relieve)
    position: "absolute",
    left: 1,
    top: 1,
    right: 1,
    bottom: 1,
    borderRadius: RADIUS - 1,
    borderWidth: 1,
    opacity: 0.45,
    pointerEvents: "none",
  },
  neuButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    // glow bajo el botón
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },

  // ====== Text & layout ======
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 8,
    lineHeight: 20,
    fontWeight: "400",
  },

  // ====== Inputs / Button text ======
  input: {
    height: 44,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "500",
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  resendContainer: {
    alignItems: "center",
    marginTop: 6,
  },
});

export default ResetPasswordScreen;