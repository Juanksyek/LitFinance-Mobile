import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useThemeColors } from "../theme/useThemeColors";
import supportService from "../services/supportService";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";

const CreateTicketScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const colors = useThemeColors();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Por favor ingresa un título",
      });
      return;
    }

    if (!descripcion.trim()) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Por favor describe tu problema",
      });
      return;
    }

    if (titulo.length > 200) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "El título debe tener máximo 200 caracteres",
      });
      return;
    }

    if (descripcion.length > 2000) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "La descripción debe tener máximo 2000 caracteres",
      });
      return;
    }

    try {
      setLoading(true);
      const ticket = await supportService.createTicket({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
      });

      Toast.show({
        type: "success",
        text1: "Ticket creado",
        text2: "Tu solicitud ha sido enviada",
      });

      // Navegar al detalle del ticket recién creado
      navigation.replace("TicketDetail", { ticketId: ticket.ticketId });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "No se pudo crear el ticket",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Nuevo ticket
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.button} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            Describe tu problema o pregunta. Nuestro equipo de soporte te
            responderá lo antes posible.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            Título <Text style={{ color: "#E53935" }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.placeholder,
              },
            ]}
            placeholder="¿En qué necesitas ayuda?"
            placeholderTextColor={colors.placeholder}
            value={titulo}
            onChangeText={setTitulo}
            maxLength={200}
            editable={!loading}
          />
          <Text style={[styles.charCount, { color: colors.placeholder }]}>
            {titulo.length}/200
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            Descripción <Text style={{ color: "#E53935" }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: colors.inputBackground,
                color: colors.text,
                borderColor: colors.placeholder,
              },
            ]}
            placeholder="Describe detalladamente tu problema..."
            placeholderTextColor={colors.placeholder}
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={6}
            maxLength={2000}
            textAlignVertical="top"
            editable={!loading}
          />
          <Text style={[styles.charCount, { color: colors.placeholder }]}>
            {descripcion.length}/2000
          </Text>
        </View>

        <View style={styles.tipContainer}>
          <Text style={[styles.tipTitle, { color: colors.text }]}>
            💡 Consejos para una mejor respuesta:
          </Text>
          <Text style={[styles.tipItem, { color: colors.placeholder }]}>
            • Sé específico sobre el problema
          </Text>
          <Text style={[styles.tipItem, { color: colors.placeholder }]}>
            • Incluye pasos para reproducir el error
          </Text>
          <Text style={[styles.tipItem, { color: colors.placeholder }]}>
            • Menciona la fecha y hora si es relevante
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.button },
            loading && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>Crear ticket</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#EF6C0010",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
  },
  charCount: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
  tipContainer: {
    backgroundColor: "#4CAF5010",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  tipItem: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CreateTicketScreen;
