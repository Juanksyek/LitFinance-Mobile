import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ScrollView,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useThemeColors } from "../theme/useThemeColors";
import supportService from "../services/supportService";
import { Ticket, Mensaje } from "../types/support";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";

interface RouteParams {
  ticketId: string;
}

const TicketDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const colors = useThemeColors();
  const { ticketId } = route.params as RouteParams;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isStaffOrAdmin, setIsStaffOrAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTicket();
    pollingIntervalRef.current = setInterval(() => {
      loadTicket(true);
    }, 15000);

    // Keyboard listeners to adjust FlatList padding and scroll to end
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e.endCoordinates?.height || 0;
      setKeyboardHeight(h);
      // allow layout to settle then scroll
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    (async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const raw = await AsyncStorage.getItem('userData');
        if (raw) {
          const u = JSON.parse(raw);
          const role = (u && (u.rol || u.role || u.roleName)) || '';
          setIsStaffOrAdmin(role === 'admin' || role === 'staff');
        }
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      showSub.remove();
      hideSub.remove();
    };
  }, [ticketId]);

  const loadTicket = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        console.log("🔄 [TicketDetail] loadTicket - Iniciando carga...", { ticketId, silent });
      }
      
      console.log("🔍 [TicketDetail] loadTicket - Llamando a supportService.getTicketDetail...");
      const data = await supportService.getTicketDetail(ticketId);
      
      console.log("✅ [TicketDetail] loadTicket - Ticket cargado:", { 
        ticketId: data.ticketId,
        estado: data.estado,
        mensajesCount: data.mensajes?.length || 0,
        titulo: data.titulo
      });
      
      if (data.mensajes && data.mensajes.length > 0) {
        console.log("💬 [TicketDetail] loadTicket - Mensajes del ticket:", 
          data.mensajes.map(m => ({
            id: m.id,
            esStaff: m.esStaff,
            preview: m.mensaje.substring(0, 50)
          }))
        );
      } else {
        console.log("⚠️ [TicketDetail] loadTicket - No hay mensajes en el ticket");
      }
      
      setTicket(data);
      
      if (data.mensajes && data.mensajes.length > 0) {
        setTimeout(() => {
          console.log("📄 [TicketDetail] loadTicket - Scrolling to end...");
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error: any) {
      console.error("❌ [TicketDetail] loadTicket - Error:", { 
        message: error.message,
        stack: error.stack 
      });
      if (!silent) {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: error.message || "No se pudo cargar el ticket",
        });
        navigation.goBack();
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSendMessage = async () => {
    console.log("📤 [TicketDetail] handleSendMessage - Iniciando...", { 
      mensajeLength: mensaje.length,
      mensajeTrim: mensaje.trim().length,
      ticketEstado: ticket?.estado 
    });
    
    if (!mensaje.trim()) {
      console.log("⚠️ [TicketDetail] handleSendMessage - Mensaje vacío, cancelando");
      return;
    }

    if (ticket?.estado === "cerrado") {
      console.log("⚠️ [TicketDetail] handleSendMessage - Ticket cerrado, cancelando");
      Toast.show({
        type: "error",
        text1: "Ticket cerrado",
        text2: "No se pueden agregar mensajes a un ticket cerrado",
      });
      return;
    }

    if (mensaje.length > 2000) {
      console.log("⚠️ [TicketDetail] handleSendMessage - Mensaje muy largo, cancelando");
      Toast.show({
        type: "error",
        text1: "Mensaje muy largo",
        text2: "El mensaje debe tener máximo 2000 caracteres",
      });
      return;
    }

    const mensajeAEnviar = mensaje.trim();
    console.log("📝 [TicketDetail] handleSendMessage - Preparando envío:", { 
      mensajeAEnviar: mensajeAEnviar.substring(0, 100),
      ticketId 
    });
    
    try {
      console.log("🚀 [TicketDetail] handleSendMessage - Estableciendo estados...");
      setSending(true);
      setMensaje("");
      
      console.log("📨 [TicketDetail] handleSendMessage - Llamando a supportService.addMessage...");
      const updatedTicket = await supportService.addMessage(ticketId, {
        mensaje: mensajeAEnviar,
      });
      
      console.log("✅ [TicketDetail] handleSendMessage - Respuesta recibida:", {
        ticketId: updatedTicket.ticketId,
        mensajesCount: updatedTicket.mensajes?.length || 0,
        estado: updatedTicket.estado
      });
      
      console.log("🔄 [TicketDetail] handleSendMessage - Actualizando estado del ticket...");
      setTicket(updatedTicket);
      
      Toast.show({
        type: "success",
        text1: "Mensaje enviado",
      });
      
      setTimeout(() => {
        console.log("📄 [TicketDetail] handleSendMessage - Scrolling to end...");
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error("❌ [TicketDetail] handleSendMessage - Error:", {
        message: error.message,
        stack: error.stack
      });
      console.log("↩️ [TicketDetail] handleSendMessage - Restaurando mensaje en input");
      setMensaje(mensajeAEnviar);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "No se pudo enviar el mensaje",
      });
    } finally {
      console.log("🏁 [TicketDetail] handleSendMessage - Finalizando (setSending(false))");
      setSending(false);
    }
  };

  const handleDeleteTicket = () => {
    Alert.alert(
      "Eliminar ticket",
      "¿Estás seguro de que deseas eliminar este ticket? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("🗑️ [TicketDetail] handleDeleteTicket - Eliminando...", { ticketId });
              await supportService.deleteTicket(ticketId);
              console.log("✅ [TicketDetail] handleDeleteTicket - Ticket eliminado");
              Toast.show({
                type: "success",
                text1: "Ticket eliminado",
                text2: "El ticket ha sido eliminado exitosamente",
              });
              navigation.goBack();
            } catch (error: any) {
              console.error("❌ [TicketDetail] handleDeleteTicket - Error:", error);
              Toast.show({
                type: "error",
                text1: "Error",
                text2: error.message || "No se pudo eliminar el ticket",
              });
            }
          },
        },
      ]
    );
  };

  const handleChangeStatus = async (newStatus: "abierto" | "en_progreso" | "resuelto" | "cerrado") => {
    try {
      console.log("🔄 [TicketDetail] handleChangeStatus - Cambiando estatus...", { 
        ticketId, 
        currentStatus: ticket?.estado,
        newStatus 
      });
      
      const updatedTicket = await supportService.updateTicketStatus(ticketId, {
        estado: newStatus,
      });
      
      console.log("✅ [TicketDetail] handleChangeStatus - Estatus actualizado", {
        newStatus: updatedTicket.estado
      });
      
      setTicket(updatedTicket);
      setShowStatusModal(false);
      
      Toast.show({
        type: "success",
        text1: "Estado actualizado",
        text2: `El ticket ahora está ${newStatus.replace('_', ' ')}`,
      });
    } catch (error: any) {
      console.error("❌ [TicketDetail] handleChangeStatus - Error:", error);
      const raw = (error && (error.message || String(error))) || '';
      const msg = raw.toLowerCase();
      let friendly = 'No se pudo actualizar el estado. Intenta de nuevo más tarde.';
      if (msg.includes('network') || msg.includes('timeout') || msg.includes('failed to fetch')) {
        friendly = 'No se pudo conectar al servidor. Revisa tu conexión a internet.';
      } else if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('forbidden') || msg.includes('403')) {
        friendly = 'No tienes permisos para cambiar el estado del ticket.';
      } else if (msg.includes('not found') || msg.includes('404')) {
        friendly = 'El ticket no fue encontrado. Actualiza la pantalla e intenta de nuevo.';
      }

      Toast.show({
        type: 'error',
        text1: 'No fue posible cambiar el estado',
        text2: friendly,
      });
    }
  };

  const getEstadoBadge = () => {
    if (!ticket) return null;

    const config = {
      abierto: { color: "#E53935", text: "Abierto", icon: "alert-circle" },
      en_progreso: { color: "#FB8C00", text: "En progreso", icon: "time" },
      resuelto: { color: "#43A047", text: "Resuelto", icon: "checkmark-circle" },
      cerrado: { color: "#9E9E9E", text: "Cerrado", icon: "close-circle" },
    };

    const { color, text, icon } = config[ticket.estado];

    return (
      <View style={[styles.badge, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={14} color={color} />
        <Text style={[styles.badgeText, { color }]}>{text}</Text>
      </View>
    );
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoy";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ayer";
    } else {
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  };

  const renderMessage = ({ item, index }: { item: Mensaje; index: number }) => {
    const isStaff = item.esStaff;
    const showDateSeparator =
      index === 0 ||
      new Date(ticket!.mensajes[index - 1].createdAt).toDateString() !==
        new Date(item.createdAt).toDateString();

    return (
      <>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={[styles.dateText, { color: colors.placeholder }]}>
              {formatMessageDate(item.createdAt)}
            </Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isStaff ? styles.staffMessage : styles.userMessage,
          ]}
        >
          <View style={styles.messageHeader}>
            <View style={styles.senderInfo}>
              <Ionicons
                name={isStaff ? "headset" : "person-circle"}
                size={16}
                color={isStaff ? colors.button : colors.text}
              />
              <Text
                style={[
                  styles.senderName,
                  { color: isStaff ? colors.button : colors.text },
                ]}
              >
                {isStaff ? "Soporte" : "Tú"}
              </Text>
            </View>
            <Text style={[styles.messageTime, { color: colors.placeholder }]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </View>
          <View
            style={[
              styles.messageBubble,
              {
                backgroundColor: isStaff
                  ? colors.button + "15"
                  : colors.inputBackground,
              },
            ]}
          >
            <Text style={[styles.messageText, { color: colors.text }]}>
              {item.mensaje}
            </Text>
          </View>
        </View>
      </>
    );
  };

  const renderHeader = () => {
    if (!ticket) return null;

    return (
      <View style={styles.ticketInfo}>
        <View style={styles.ticketHeader}>
          <Text style={[styles.ticketTitle, { color: colors.text }]}>
            {ticket.titulo}
          </Text>
          {getEstadoBadge()}
        </View>
        <Text
          style={[styles.ticketDescription, { color: colors.placeholder }]}
        >
          {ticket.descripcion}
        </Text>
        <Text style={[styles.ticketId, { color: colors.placeholder }]}>
          ID: {ticket.ticketId}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Ticket
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.button} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 80}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Ticket
        </Text>
        <View style={styles.headerActions}>
          {isStaffOrAdmin && (
            <TouchableOpacity 
              onPress={() => setShowStatusModal(true)}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="swap-horizontal" size={24} color={colors.button} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDeleteTicket}>
            <Ionicons name="trash-outline" size={24} color="#E53935" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={ticket?.mensajes || []}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[styles.messagesList, { paddingBottom: Math.max(80, 16 + keyboardHeight) }]}
        onRefresh={loadTicket}
        refreshing={refreshing}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {ticket?.estado !== "cerrado" && (
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.inputBackground, borderTopColor: colors.placeholder + "30" },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.placeholder,
              },
            ]}
            placeholder="Escribe tu mensaje..."
            placeholderTextColor={colors.placeholder}
            value={mensaje}
            onChangeText={setMensaje}
            onFocus={() => {
              // ensure messages are visible when typing
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
            }}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: colors.button },
              (!mensaje.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!mensaje.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      )}

      {ticket?.estado === "cerrado" && (
        <View style={[styles.closedBanner, { backgroundColor: "#9E9E9E20" }]}>
          <Ionicons name="lock-closed" size={16} color="#9E9E9E" />
          <Text style={[styles.closedText, { color: "#9E9E9E" }]}>
            Este ticket está cerrado. No se pueden agregar más mensajes.
          </Text>
        </View>
      )}

      {/* Modal de cambio de estatus */}
      <Modal
        visible={showStatusModal && isStaffOrAdmin}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View 
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Cambiar estado del ticket
            </Text>
            
            <TouchableOpacity
              style={[styles.statusOption, { borderBottomColor: colors.placeholder + "30" }]}
              onPress={() => handleChangeStatus("abierto")}
            >
              <Ionicons name="alert-circle" size={20} color="#E53935" />
              <Text style={[styles.statusOptionText, { color: colors.text }]}>
                Abierto
              </Text>
              {ticket?.estado === "abierto" && (
                <Ionicons name="checkmark" size={20} color={colors.button} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { borderBottomColor: colors.placeholder + "30" }]}
              onPress={() => handleChangeStatus("en_progreso")}
            >
              <Ionicons name="time" size={20} color="#FB8C00" />
              <Text style={[styles.statusOptionText, { color: colors.text }]}>
                En progreso
              </Text>
              {ticket?.estado !== "cerrado" && (
                <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.inputBackground }}>
                  <View
                    style={[
                      styles.inputContainer,
                      { backgroundColor: colors.inputBackground, borderTopColor: colors.placeholder + "30", paddingBottom: Platform.OS === 'android' ? 18 : 0 },
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.background,
                          color: colors.text,
                          borderColor: colors.placeholder,
                        },
                      ]}
                      placeholder="Escribe tu mensaje..."
                      placeholderTextColor={colors.placeholder}
                      value={mensaje}
                      onChangeText={setMensaje}
                      onFocus={() => {
                        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                      }}
                      multiline
                      maxLength={2000}
                      editable={!sending}
                    />
                    /* Lines 517-532 omitted */
                  </View>
                </SafeAreaView>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.placeholder + "20" }]}
              onPress={() => setShowStatusModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  ticketInfo: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#EF6C0010",
    marginBottom: 24,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 12,
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  ticketDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  ticketId: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dateText: {
    fontSize: 12,
    fontWeight: "600",
  },
  messageContainer: {
    marginBottom: 16,
  },
  staffMessage: {
    alignItems: "flex-start",
  },
  userMessage: {
    alignItems: "flex-end",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  senderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
  },
  messageTime: {
    fontSize: 11,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  closedText: {
    fontSize: 13,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  statusOptionText: {
    fontSize: 16,
    flex: 1,
  },
  cancelButton: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default TicketDetailScreen;
