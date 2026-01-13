import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../theme/ThemeContext";
import { useThemeColors } from "../theme/useThemeColors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { apiRateLimiter } from "../services/apiRateLimiter";
import { API_BASE_URL } from "../constants/api";
import Toast from "react-native-toast-message";

type FilterType = "all" | "active" | "inactive";

export default function AdminNotificationsScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const colors = useThemeColors();

  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const filters: { key: FilterType; label: string; icon: string; description: string }[] = [
    {
      key: "all",
      label: "Todos los usuarios",
      icon: "people",
      description: "Enviar a todos los usuarios registrados",
    },
    {
      key: "active",
      label: "Usuarios activos",
      icon: "checkmark-circle",
      description: "Usuarios con actividad reciente (últimos 7 días)",
    },
    {
      key: "inactive",
      label: "Usuarios inactivos",
      icon: "time",
      description: "Usuarios sin actividad por más de 7 días",
    },
  ];

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert("Campos requeridos", "Por favor ingresa un título y un mensaje");
      return;
    }

    Alert.alert(
      "Confirmar envío",
      `¿Enviar notificación a ${filters.find((f) => f.key === selectedFilter)?.label}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: async () => {
            try {
              setSending(true);
              const token = await authService.getAccessToken();

              if (!token) {
                Alert.alert("Error", "No se encontró token de autenticación");
                return;
              }

              // Endpoint para enviar notificación broadcast
              const response = await apiRateLimiter.fetch(
                `${API_BASE_URL}/notificaciones/enviar-todos`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    titulo: title,
                    mensaje: message,
                    filtro: selectedFilter,
                    data: {
                      tipo: "admin_broadcast",
                      filtro: selectedFilter,
                    },
                  }),
                }
              );

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Error al enviar notificación');
              }

              Toast.show({
                type: "success",
                text1: "✅ Notificación enviada",
                text2: "Se envió correctamente a los usuarios seleccionados",
              });

              // Limpiar campos
              setTitle("");
              setMessage("");
              setSelectedFilter("all");
            } catch (error: any) {
              console.error("Error enviando notificación:", error);
              Alert.alert(
                "Error",
                error.response?.data?.message || "No se pudo enviar la notificación"
              );
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Admin Notificaciones
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Info Badge */}
        <View style={[styles.infoBadge, { backgroundColor: colors.button + "20" }]}>
          <Ionicons name="information-circle" size={20} color={colors.button} />
          <Text style={[styles.infoBadgeText, { color: colors.button }]}>
            Panel exclusivo para administradores
          </Text>
        </View>

        {/* Filtros */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Selecciona destinatarios
          </Text>

          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterCard,
                {
                  backgroundColor: colors.card,
                  borderColor:
                    selectedFilter === filter.key ? colors.button : colors.border,
                  borderWidth: selectedFilter === filter.key ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedFilter(filter.key)}
              activeOpacity={0.7}
            >
              <View style={styles.filterContent}>
                <View
                  style={[
                    styles.filterIcon,
                    {
                      backgroundColor:
                        selectedFilter === filter.key
                          ? colors.button + "20"
                          : colors.inputBackground,
                    },
                  ]}
                >
                  <Ionicons
                    name={filter.icon as any}
                    size={24}
                    color={selectedFilter === filter.key ? colors.button : colors.textSecondary}
                  />
                </View>
                <View style={styles.filterTextContainer}>
                  <Text style={[styles.filterLabel, { color: colors.text }]}>
                    {filter.label}
                  </Text>
                  <Text style={[styles.filterDescription, { color: colors.textSecondary }]}>
                    {filter.description}
                  </Text>
                </View>
                {selectedFilter === filter.key && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.button} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Formulario de Notificación */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Contenido de la notificación
          </Text>

          <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Título de la notificación
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Ej: Nueva funcionalidad disponible"
              placeholderTextColor={colors.placeholder}
              value={title}
              onChangeText={setTitle}
              maxLength={60}
            />
            <Text style={[styles.charCount, { color: colors.textTertiary }]}>
              {title.length}/60
            </Text>
          </View>

          <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Mensaje
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Escribe el mensaje de la notificación..."
              placeholderTextColor={colors.placeholder}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            <Text style={[styles.charCount, { color: colors.textTertiary }]}>
              {message.length}/200
            </Text>
          </View>
        </View>

        {/* Preview */}
        {(title || message) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Vista previa
            </Text>
            <View
              style={[
                styles.previewCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.previewHeader}>
                <Ionicons name="notifications" size={20} color={colors.button} />
                <Text style={[styles.previewApp, { color: colors.textSecondary }]}>
                  LitFinance
                </Text>
              </View>
              <Text style={[styles.previewTitle, { color: colors.text }]}>
                {title || "Título de notificación"}
              </Text>
              <Text style={[styles.previewMessage, { color: colors.textSecondary }]}>
                {message || "Mensaje de la notificación"}
              </Text>
            </View>
          </View>
        )}

        {/* Botón Enviar */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: colors.button,
              opacity: !title.trim() || !message.trim() || sending ? 0.5 : 1,
            },
          ]}
          onPress={handleSendNotification}
          disabled={!title.trim() || !message.trim() || sending}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.sendButtonText}>
                Enviar a {filters.find((f) => f.key === selectedFilter)?.label}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.warningText, { color: colors.textTertiary }]}>
          ⚠️ Las notificaciones se enviarán inmediatamente. Verifica el contenido antes de
          enviar.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginBottom: 24,
  },
  infoBadgeText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  filterCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  filterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filterIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  filterTextContainer: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  filterDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  inputCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  previewCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  previewApp: {
    fontSize: 12,
    fontWeight: "500",
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  previewMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  warningText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
});
