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
  Keyboard,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useThemeColors } from "../theme/useThemeColors";
import supportService from "../services/supportService";
import { Ticket, Mensaje } from "../types/support";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { fixEncoding } from "../utils/fixEncoding";
import EventBus from "../utils/eventBus";

interface RouteParams {
  ticketId: string;
}

const TicketDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { ticketId } = route.params as RouteParams;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isStaffOrAdmin, setIsStaffOrAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const updatingStatusRef = useRef(false);
  const sendingQueueRef = useRef<Promise<any>[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ altura real del composer para padding del listado
  const [composerHeight, setComposerHeight] = useState(0);

  // ✅ estabiliza bottom inset (evita recortes/jumps al abrir/cerrar teclado)
  const [stableBottomInset, setStableBottomInset] = useState(insets.bottom);
  useEffect(() => {
    setStableBottomInset((prev) => Math.max(prev, insets.bottom));
  }, [insets.bottom]);

  useEffect(() => {
    loadTicket();
    pollingIntervalRef.current = setInterval(() => {
      loadTicket(true);
    }, 15000);

    // Solo para scroll al abrir teclado (sin tocar paddings manuales)
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    });

    (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const raw = await AsyncStorage.getItem("userData");
        if (raw) {
          const u = JSON.parse(raw);
          const role = (u && (u.rol || u.role || u.roleName)) || "";
          setIsStaffOrAdmin(role === "admin" || role === "staff");
        }
      } catch {}
    })();

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      showSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const loadTicket = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setRefreshing(true);
      }
      const data = await supportService.getTicketDetail(ticketId);

      if (updatingStatusRef.current) {
        // no pisar estado optimista
      } else {
        const hasPendingSends = sendingQueueRef.current.length > 0;
        if (hasPendingSends) {
          setTicket((current) => {
            if (!current) return data;
            const currentCount = (current.mensajes || []).length;
            const incomingCount = (data.mensajes || []).length;
            if (incomingCount < currentCount) return current;
            return data;
          });
        } else {
          setTicket(data);
        }
      }

      if (data.mensajes && data.mensajes.length > 0) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
      }
    } catch (error: any) {
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
    if (!mensaje.trim()) return;

    if (ticket?.estado === "cerrado") {
      Toast.show({
        type: "error",
        text1: "Ticket cerrado",
        text2: "No se pueden agregar mensajes a un ticket cerrado",
      });
      return;
    }

    if (mensaje.length > 2000) {
      Toast.show({
        type: "error",
        text1: "Mensaje muy largo",
        text2: "El mensaje debe tener máximo 2000 caracteres",
      });
      return;
    }

    const mensajeAEnviar = mensaje.trim();

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      mensaje: mensajeAEnviar,
      createdAt: new Date().toISOString(),
      esStaff: false,
    } as any;

    setMensaje("");
    setTicket((t) => {
      if (!t) return t;
      return { ...t, mensajes: [...(t.mensajes || []), optimisticMsg] } as Ticket;
    });

    const sendPromise = (async () => {
      try {
        const updatedTicket = await supportService.addMessage(ticketId, { mensaje: mensajeAEnviar });
        setTicket(updatedTicket);
        EventBus.emit("ticketUpdated", updatedTicket);
        Toast.show({ type: "success", text1: "Mensaje enviado" });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
      } catch (err: any) {
        setTicket((t) => {
          if (!t) return t;
          return { ...t, mensajes: (t.mensajes || []).filter((m: any) => m.id !== tempId) } as Ticket;
        });
        setMensaje(mensajeAEnviar);
        Toast.show({ type: "error", text1: "Error", text2: err?.message || "No se pudo enviar el mensaje" });
      }
    })();

    sendingQueueRef.current.push(sendPromise);
    sendPromise.finally(() => {
      sendingQueueRef.current = sendingQueueRef.current.filter((p) => p !== sendPromise);
    });
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
              await supportService.deleteTicket(ticketId);
              Toast.show({
                type: "success",
                text1: "Ticket eliminado",
                text2: "El ticket ha sido eliminado exitosamente",
              });
              navigation.goBack();
            } catch (error: any) {
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
    if (!ticket) return;
    try {
      setUpdatingStatus(true);
      updatingStatusRef.current = true;

      setTicket((t) => (t ? ({ ...t, estado: newStatus } as Ticket) : t));
      setShowStatusModal(false);

      const updatedTicket = await supportService.updateTicketStatus(ticketId, { estado: newStatus });
      setTicket(updatedTicket);
      EventBus.emit("ticketUpdated", updatedTicket);

      Toast.show({
        type: "success",
        text1: "Estado actualizado",
        text2: `El ticket ahora está ${newStatus.replace("_", " ")}`,
      });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "No fue posible cambiar el estado",
        text2: "Intenta de nuevo más tarde.",
      });
    } finally {
      setUpdatingStatus(false);
      updatingStatusRef.current = false;
    }
  };

  const getEstadoBadge = () => {
    if (!ticket) return null;

    const config: any = {
      abierto: { color: "#E53935", text: "Abierto", icon: "alert-circle" },
      en_progreso: { color: "#FB8C00", text: "En progreso", icon: "time" },
      resuelto: { color: "#43A047", text: "Resuelto", icon: "checkmark-circle" },
      cerrado: { color: "#9E9E9E", text: "Cerrado", icon: "close-circle" },
    };

    const { color, text, icon } = config[ticket.estado];

    return (
      <View style={[styles.badge, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[styles.badgeText, { color }]}>{text}</Text>
      </View>
    );
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Hoy";
    if (date.toDateString() === yesterday.toDateString()) return "Ayer";
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
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
            <View style={[styles.dateLine, { backgroundColor: colors.placeholder + "30" }]} />
            <Text style={[styles.dateText, { color: colors.placeholder }]}>{formatMessageDate(item.createdAt)}</Text>
            <View style={[styles.dateLine, { backgroundColor: colors.placeholder + "30" }]} />
          </View>
        )}

        <View style={[styles.messageContainer, isStaff ? styles.staffMessage : styles.userMessage]}>
          <View style={styles.messageHeader}>
            <View style={styles.senderInfo}>
              <Ionicons
                name={isStaff ? "headset" : "person-circle"}
                size={16}
                color={isStaff ? colors.button : colors.text}
              />
              <Text style={[styles.senderName, { color: isStaff ? colors.button : colors.text }]}>
                {isStaff ? "Soporte" : "Tú"}
              </Text>
            </View>
            <Text style={[styles.messageTime, { color: colors.placeholder }]}>{formatMessageTime(item.createdAt)}</Text>
          </View>

          <View
            style={[
              styles.messageBubble,
              {
                backgroundColor: isStaff ? colors.button + "15" : colors.inputBackground,
              },
            ]}
          >
            <Text style={[styles.messageText, { color: colors.text }]}>{fixEncoding(item.mensaje)}</Text>
          </View>
        </View>
      </>
    );
  };

  const renderHeader = () => {
    if (!ticket) return null;
    return (
      <View style={[styles.ticketInfo, { backgroundColor: colors.button + "10" }]}>
        <View style={styles.ticketHeader}>
          <Text style={[styles.ticketTitle, { color: colors.text }]}>{ticket.titulo}</Text>
          {getEstadoBadge()}
        </View>
        <Text style={[styles.ticketDescription, { color: colors.placeholder }]}>{fixEncoding(ticket.descripcion)}</Text>
        <Text style={[styles.ticketId, { color: colors.placeholder }]}>ID: {ticket.ticketId}</Text>
      </View>
    );
  };

  // SafeAreaView already applies the top inset; only add Android status bar height.
  const topPad = Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0;

  // ✅ En Android evitamos KAV (aquí era el que dejaba el recuadro blanco)
  const BodyWrapper: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const bodyWrapperProps =
    Platform.OS === "ios"
      ? { behavior: "padding" as const, keyboardVerticalOffset: 0 }
      : {};

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { paddingTop: 12 + topPad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Ticket</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.button} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: 12 + topPad }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>Ticket</Text>

        <View style={styles.headerActions}>
          {isStaffOrAdmin && (
            <TouchableOpacity
              onPress={() => setShowStatusModal(true)}
              style={{ marginRight: 16 }}
              disabled={updatingStatus}
            >
              <Ionicons
                name="swap-horizontal"
                size={24}
                color={updatingStatus ? colors.placeholder : colors.button}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDeleteTicket}>
            <Ionicons name="trash-outline" size={24} color="#E53935" />
          </TouchableOpacity>
        </View>
      </View>

      <BodyWrapper style={{ flex: 1, backgroundColor: colors.background }} {...bodyWrapperProps}>
        <FlatList
          ref={flatListRef}
          data={ticket?.mensajes || []}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          style={{ flex: 1, backgroundColor: colors.background }}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentContainerStyle={[
            styles.messagesList,
            {
              paddingBottom: Math.max(16, composerHeight) + stableBottomInset + 12,
            },
          ]}
          refreshing={refreshing}
          onRefresh={() => loadTicket(false)}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {ticket?.estado !== "cerrado" && (
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.background, // ✅ pinta el área inferior (adiós blanco)
                borderTopColor: colors.placeholder + "30",
                paddingBottom: 12 + stableBottomInset, // ✅ safe area bottom estable
              },
            ]}
            onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
          >
            <View
              style={[
                styles.composerInner,
                { backgroundColor: colors.inputBackground, borderColor: colors.placeholder + "30" },
              ]}
            >
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.placeholder + "40",
                  },
                ]}
                placeholder="Escribe tu mensaje..."
                placeholderTextColor={colors.placeholder}
                value={mensaje}
                onChangeText={setMensaje}
                onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60)}
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
          </View>
        )}

        {ticket?.estado === "cerrado" && (
          <View style={[styles.closedBanner, { backgroundColor: "#9E9E9E20", paddingBottom: 10 + stableBottomInset }]}>
            <Ionicons name="lock-closed" size={16} color="#9E9E9E" />
            <Text style={[styles.closedText, { color: "#9E9E9E" }]}>
              Este ticket está cerrado. No se pueden agregar más mensajes.
            </Text>
          </View>
        )}
      </BodyWrapper>

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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Cambiar estado del ticket</Text>

            <TouchableOpacity
              style={[styles.statusOption, { borderBottomColor: colors.placeholder + "30" }]}
              onPress={() => handleChangeStatus("abierto")}
            >
              <Ionicons name="alert-circle" size={20} color="#E53935" />
              <Text style={[styles.statusOptionText, { color: colors.text }]}>Abierto</Text>
              {ticket?.estado === "abierto" && <Ionicons name="checkmark" size={20} color={colors.button} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { borderBottomColor: colors.placeholder + "30" }]}
              onPress={() => handleChangeStatus("en_progreso")}
            >
              <Ionicons name="time" size={20} color="#FB8C00" />
              <Text style={[styles.statusOptionText, { color: colors.text }]}>En progreso</Text>
              {ticket?.estado === "en_progreso" && <Ionicons name="checkmark" size={20} color={colors.button} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { borderBottomColor: colors.placeholder + "30" }]}
              onPress={() => handleChangeStatus("resuelto")}
            >
              <Ionicons name="checkmark-circle" size={20} color="#43A047" />
              <Text style={[styles.statusOptionText, { color: colors.text }]}>Resuelto</Text>
              {ticket?.estado === "resuelto" && <Ionicons name="checkmark" size={20} color={colors.button} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { borderBottomColor: colors.placeholder + "30" }]}
              onPress={() => handleChangeStatus("cerrado")}
            >
              <Ionicons name="close-circle" size={20} color="#9E9E9E" />
              <Text style={[styles.statusOptionText, { color: colors.text }]}>Cerrado</Text>
              {ticket?.estado === "cerrado" && <Ionicons name="checkmark" size={20} color={colors.button} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.placeholder + "20" }]}
              onPress={() => setShowStatusModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: "600" },
  headerActions: { flexDirection: "row", alignItems: "center" },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  messagesList: { padding: 16, paddingBottom: 8 },

  ticketInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 12,
  },
  ticketTitle: { fontSize: 18, fontWeight: "600", flex: 1 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },

  ticketDescription: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  ticketId: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },

  dateSeparator: { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 12 },
  dateLine: { flex: 1, height: 1 },
  dateText: { fontSize: 12, fontWeight: "600" },

  messageContainer: { marginBottom: 16 },
  staffMessage: { alignItems: "flex-start" },
  userMessage: { alignItems: "flex-end" },

  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  senderInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  senderName: { fontSize: 12, fontWeight: "600" },
  messageTime: { fontSize: 11 },

  messageBubble: { maxWidth: "80%", padding: 12, borderRadius: 12 },
  messageText: { fontSize: 14, lineHeight: 20 },

  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  composerInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    gap: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 110,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { opacity: 0.5 },

  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  closedText: { fontSize: 13, fontWeight: "500" },

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
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 20, textAlign: "center" },

  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  statusOptionText: { fontSize: 16, flex: 1 },

  cancelButton: { marginTop: 16, padding: 14, borderRadius: 8, alignItems: "center" },
  cancelButtonText: { fontSize: 16, fontWeight: "600" },
});

export default TicketDetailScreen;