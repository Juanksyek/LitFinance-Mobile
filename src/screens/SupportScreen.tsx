import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useThemeColors } from "../theme/useThemeColors";
import supportService from "../services/supportService";
import { Ticket, TicketEstado } from "../types/support";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";

const SupportScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const colors = useThemeColors();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTickets();
    }, [])
  );

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await supportService.getMyTickets();
      // Ordenar por fecha de actualización descendente
      const sorted = data.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setTickets(sorted);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "No se pudieron cargar los tickets",
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTickets();
    setRefreshing(false);
  };

  const getEstadoBadge = (estado: TicketEstado) => {
    const config = {
      abierto: { color: "#E53935", text: "Abierto", icon: "alert-circle" },
      en_progreso: { color: "#FB8C00", text: "En progreso", icon: "time" },
      resuelto: { color: "#43A047", text: "Resuelto", icon: "checkmark-circle" },
      cerrado: { color: "#9E9E9E", text: "Cerrado", icon: "close-circle" },
    };

    const { color, text, icon } = config[estado];

    return (
      <View style={[styles.badge, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={14} color={color} />
        <Text style={[styles.badgeText, { color }]}>{text}</Text>
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 24) {
      if (hours < 1) return "Hace un momento";
      return `Hace ${hours}h`;
    } else if (days < 7) {
      return `Hace ${days}d`;
    } else {
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
      });
    }
  };

  const renderTicket = ({ item }: { item: Ticket }) => {
    const hasUnreadMessages = item.mensajes.some((m) => m.esStaff);
    const lastMessage =
      item.mensajes.length > 0
        ? item.mensajes[item.mensajes.length - 1]
        : null;

    return (
      <TouchableOpacity
        style={[
          styles.ticketCard,
          { backgroundColor: colors.inputBackground },
        ]}
        onPress={() =>
          navigation.navigate("TicketDetail", { ticketId: item.ticketId })
        }
      >
        <View style={styles.ticketHeader}>
          <Text
            style={[styles.ticketTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.titulo}
          </Text>
          {getEstadoBadge(item.estado)}
        </View>

        <Text
          style={[styles.ticketDescription, { color: colors.placeholder }]}
          numberOfLines={2}
        >
          {item.descripcion}
        </Text>

        {lastMessage && (
          <View style={styles.lastMessageContainer}>
            <Ionicons
              name={lastMessage.esStaff ? "headset" : "person"}
              size={12}
              color={colors.placeholder}
            />
            <Text
              style={[styles.lastMessage, { color: colors.placeholder }]}
              numberOfLines={1}
            >
              {lastMessage.mensaje}
            </Text>
          </View>
        )}

        <View style={styles.ticketFooter}>
          <Text style={[styles.ticketDate, { color: colors.placeholder }]}>
            {formatDate(item.updatedAt)}
          </Text>
          {item.mensajes.length > 0 && (
            <View style={styles.messageCount}>
              <Ionicons name="chatbubbles" size={12} color={colors.placeholder} />
              <Text
                style={[styles.messageCountText, { color: colors.placeholder }]}
              >
                {item.mensajes.length}
              </Text>
            </View>
          )}
        </View>

        {hasUnreadMessages && item.estado !== "cerrado" && (
          <View style={styles.unreadIndicator} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading && tickets.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Soporte
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Soporte
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={tickets}
        renderItem={renderTicket}
        keyExtractor={(item) => item.ticketId}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="help-buoy-outline"
              size={64}
              color={colors.placeholder}
            />
            <Text style={[styles.emptyText, { color: colors.placeholder }]}>
              No tienes tickets de soporte
            </Text>
            <Text
              style={[styles.emptySubtext, { color: colors.placeholder }]}
            >
              Crea uno nuevo para obtener ayuda
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.button }]}
        onPress={() => navigation.navigate("CreateTicket")}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
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
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  ticketCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: "relative",
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
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
    marginBottom: 8,
    lineHeight: 20,
  },
  lastMessageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  lastMessage: {
    fontSize: 13,
    flex: 1,
    fontStyle: "italic",
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketDate: {
    fontSize: 12,
  },
  messageCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  messageCountText: {
    fontSize: 12,
  },
  unreadIndicator: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF6C00",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});

export default SupportScreen;
