import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import FormInput from "../components/FormInput";
import { useThemeColors } from "../theme/useThemeColors";
import { useNavigation, useRoute, NavigationProp, RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import Toast from "react-native-toast-message";
import { passwordResetService } from "../services/passwordResetService";
import { fixEncoding } from "../utils/fixEncoding";

const ResetPasswordScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const route = useRoute<RouteProp<RootStackParamList, "ResetPassword">>();
  const resetToken = route.params?.resetToken || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const theme = useMemo(() => {
    const bg = colors.background;
    const shadowDark = "rgba(0, 0, 0, 0.35)";
    const shadowLight = "rgba(255, 255, 255, 0.18)";
    const borderSoft = "rgba(255, 255, 255, 0.08)";
    const surface = colors.inputBackground ?? bg;
    const accent = "#EF7725";
    return { bg, surface, shadowDark, shadowLight, borderSoft, accent };
  }, [colors]);

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      return Toast.show({ 
        type: "error", 
        text1: fixEncoding("Campos incompletos"), 
        text2: fixEncoding("Completa todos los campos.") 
      });
    }
    if (newPassword !== confirmPassword) {
      return Toast.show({ 
        type: "error", 
        text1: fixEncoding("Contraseñas no coinciden"), 
        text2: fixEncoding("Verifica que ambas contraseñas sean iguales.") 
      });
    }
    if (newPassword.length < 6) {
      return Toast.show({
        type: "error",
        text1: fixEncoding("Contraseña débil"),
        text2: fixEncoding("La contraseña debe tener al menos 6 caracteres."),
      });
    }
    try {
      await passwordResetService.resetPassword(resetToken, newPassword);

      Toast.show({ 
        type: "success", 
        text1: fixEncoding("Contraseña actualizada"), 
        text2: fixEncoding("Ya puedes iniciar sesión.") 
      });
      navigation.navigate("Login");
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: fixEncoding("Error"),
        text2: fixEncoding(error.message || "No se pudo actualizar la contraseña."),
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
            <Text style={[styles.title, { color: colors.text }]}>{fixEncoding("Nueva contraseña")}</Text>
            <Text style={[styles.subtitle, { color: colors.placeholder }]}>
              {fixEncoding("Tu código fue verificado. Ingresa tu nueva contraseña.")}
            </Text>
          </View>

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
              placeholder={fixEncoding("Nueva contraseña")}
              secureTextEntry={!showNewPassword}
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
              rightIcon={
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.iconButton}>
                  <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.placeholder} />
                </TouchableOpacity>
              }
            />
            <View style={[styles.innerHighlight, { borderColor: theme.shadowLight }]} />
          </View>

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
              placeholder={fixEncoding("Confirmar contraseña")}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              rightIcon={
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.iconButton}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.placeholder} />
                </TouchableOpacity>
              }
            />
            <View style={[styles.innerHighlight, { borderColor: theme.shadowLight }]} />
          </View>

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
            <Text style={styles.buttonText}>{fixEncoding("Restablecer")}</Text>
          </TouchableOpacity>
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

  neuCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
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

  iconButton: { padding: 4 },

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
});

export default ResetPasswordScreen;
