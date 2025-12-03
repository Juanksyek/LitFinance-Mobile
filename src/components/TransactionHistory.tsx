import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { API_BASE_URL } from "../constants/api";
import Toast from "react-native-toast-message";
import HistorialDetalleModal from "./HistorialDetalleModal";
import SmartNumber from './SmartNumber';
import { useThemeColors } from "../theme/useThemeColors";

type HistorialItem = {
  id: string;
  descripcion: string;
  monto: number;
  tipo: string;
  fecha: string;
  cuentaId: string;
  subcuentaId?: string;
  detalles?: {
    origen?: string;
    etiqueta?: string;
    resumen?: string;
    [key: string]: any;
  };
};

interface JwtPayload {
  cuentaId: string;
  userId?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

const TransactionHistory = ({ refreshKey }: { refreshKey?: number }) => {
  const colors = useThemeColors();
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState<HistorialItem | null>(null);
  const limit = 5;

  useEffect(() => {
    const fetchHistorial = async () => {
      console.log('[TransactionHistory] Iniciando fetch de historial:', {
        refreshKey,
        search,
        page,
        timestamp: new Date().toISOString()
      });
      
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem("authToken");

        if (!token) {
          Toast.show({
            type: "error",
            text1: "Token no encontrado",
            text2: "Por favor inicia sesión nuevamente.",
          });
          return;
        }

        const decoded: JwtPayload = jwtDecode(token);
        const cuentaId = decoded?.cuentaId;

        if (!cuentaId) {
          Toast.show({
            type: "error",
            text1: "Cuenta no encontrada",
            text2: "No se pudo obtener el ID de la cuenta.",
          });
          return;
        }

        const url = `${API_BASE_URL}/cuenta-historial?cuentaId=${cuentaId}&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        console.log('[TransactionHistory] Respuesta recibida:', {
          dataLength: data?.data?.length || 0,
          hasData: Array.isArray(data?.data),
          hasMore: data?.data?.length === limit
        });

        if (Array.isArray(data?.data)) {
          setHistorial(data.data);
          setHasMore(data.data.length === limit);
          console.log('✅ [TransactionHistory] Historial actualizado exitosamente');
        } else {
          setHistorial([]);
          setHasMore(false);
          Toast.show({
            type: "info",
            text1: "Sin movimientos",
            text2: "No hay historial registrado aún.",
          });
        }
      } catch (err) {
        setHistorial([]);
        Toast.show({
          type: "error",
          text1: "Error al cargar historial",
          text2: "Revisa tu conexión o vuelve a intentar.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHistorial();
  }, [refreshKey, search, page]);

  const iconByTipo = (tipo: string) => {
    switch (tipo) {
      case "ingreso":
        return <Ionicons name="trending-up" size={20} color="#388e3c" />;
      case "egreso":
        return <Ionicons name="trending-down" size={20} color="#d32f2f" />;
      case "recurrente":
        return <Ionicons name="repeat" size={20} color="#1976d2" />;
      case "ajuste_subcuenta":
        return <Ionicons name="sync-outline" size={20} color="#fbc02d" />;
      case "cambio_moneda":
        return <Ionicons name="swap-horizontal" size={20} color="#7b1fa2" />;
      default:
        return <Ionicons name="time-outline" size={20} color="#616161" />;
    }
  };

  const TransactionItem = ({
    icon,
    title,
    amount,
    date,
    onPress,
  }: {
    icon: React.ReactNode;
    title: string;
    amount: string;
    date: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={[styles.transactionItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress}>
      <View style={[styles.transactionIconContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
        {icon}
      </View>
      <View style={styles.transactionDetails}>
        <Text style={[styles.transactionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>{date}</Text>
      </View>
      <Text style={[styles.transactionAmount, { color: colors.text }]}>{amount}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.chartBackground, shadowColor: colors.shadow, borderColor: colors.border }]}>
      <Text style={[styles.cardLabel, { color: colors.text }]}>Historial de transacciones</Text>

      <TextInput
        style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
        placeholder="Buscar por descripción..."
        placeholderTextColor={colors.placeholder}
        value={search}
        onChangeText={(text) => {
          setPage(1);
          setSearch(text);
        }}
      />

      {loading ? (
        <ActivityIndicator size="small" color={colors.button} />
      ) : historial.length > 0 ? (
        historial.map((item) => (
          <TransactionItem
            key={item.id}
            icon={iconByTipo(item.tipo)}
            title={item.descripcion}
            amount={
              // ✅ NUEVO: Formatear cifras grandes con representación en miles para 1M+
              item.monto >= 1000000 
                ? `$${(item.monto / 1000000).toFixed(1)}M`
                : `$${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
            date={new Date(item.fecha).toLocaleDateString()}
            onPress={() => {
              setItemSeleccionado(item);
              setModalVisible(true);
            }}
          />
        ))
      ) : (
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>
          No hay movimientos registrados.
        </Text>
      )}

      <View style={styles.pagination}>
        <TouchableOpacity
          disabled={page === 1}
          onPress={() => setPage((prev) => Math.max(prev - 1, 1))}
          style={[styles.viewAllButton, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }, page === 1 && { opacity: 0.4 }]}
        >
          <Ionicons name="chevron-back-outline" size={16} color={colors.button} />
          <Text style={[styles.viewAllText, { color: colors.textSecondary }]}>Anterior</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!hasMore}
          onPress={() => setPage((prev) => prev + 1)}
          style={[styles.viewAllButton, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }, !hasMore && { opacity: 0.4 }]}
        >
          <Text style={[styles.viewAllText, { color: colors.textSecondary }]}>Siguiente</Text>
          <Ionicons name="chevron-forward-outline" size={16} color={colors.button} />
        </TouchableOpacity>
      </View>

      <HistorialDetalleModal
        visible={modalVisible}
        historialItem={itemSeleccionado}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

export default TransactionHistory;

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 10,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
  },
  transactionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 13,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "500",
    marginRight: 6,
  },
  searchInput: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 8,
  },
});
