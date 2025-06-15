import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get("window");

interface Subcuenta {
  _id: string;
  nombre: string;
  cantidad: number;
  moneda: string;
  simbolo: string;
  color: string;
  afectaCuenta: boolean;
  subCuentaId: string;
  updatedAt: string;
}

interface Props {
  userId: string;
  refreshKey?: number;
}

const LIMIT = 5;

const SubaccountsList: React.FC<Props> = ({ userId, refreshKey = 0 }) => {
  const [subcuentas, setSubcuentas] = useState<Subcuenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const navigation = useNavigation<any>();

  useEffect(() => {
    const delay = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(delay);
  }, [search]);

  const fetchSubcuentas = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(`${API_BASE_URL}/subcuenta/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      const filtered = debouncedSearch
        ? data.filter((s: Subcuenta) =>
            s.nombre.toLowerCase().includes(debouncedSearch.toLowerCase())
          )
        : data;

      const start = (page - 1) * LIMIT;
      const end = start + LIMIT;

      setSubcuentas(filtered.slice(start, end));
      setHasMore(end < filtered.length);
    } catch (err) {
      console.error("Error al obtener subcuentas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchSubcuentas();
  }, [page, debouncedSearch, refreshKey]);

  const handlePrev = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNext = () => {
    if (hasMore) setPage((p) => p + 1);
  };

  const renderItem = ({ item }: { item: Subcuenta }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('SubaccountDetail', {
        subcuenta: item,
        onGlobalRefresh: () => {}
      })}
      style={[styles.card, { borderColor: item.color }]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
          {item.nombre}
        </Text>
        {item.afectaCuenta && (
          <Ionicons name="checkmark-circle" size={14} color={item.color} />
        )}
      </View>
      <Text style={styles.cardAmount} numberOfLines={1} ellipsizeMode="tail">
        {item.simbolo}
        {item.cantidad.toLocaleString()} {item.moneda}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Subcuentas</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar subcuenta..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#aaa"
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color="#EF7725" />
      ) : subcuentas.length === 0 ? (
        <Text style={styles.noData}>No hay subcuentas registradas.</Text>
      ) : (
        <>
          <FlatList
            data={subcuentas}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.rowWrapper}
            contentContainerStyle={{ paddingBottom: 16 }}
          />

          <View style={styles.pagination}>
            <TouchableOpacity
              style={[
                styles.pageButton,
                page <= 1 && styles.pageButtonDisabled,
              ]}
              onPress={handlePrev}
              disabled={page <= 1}
            >
              <Text style={styles.pageButtonText}>Anterior</Text>
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>Página {page}</Text>
            <TouchableOpacity
              style={[styles.pageButton, !hasMore && styles.pageButtonDisabled]}
              onPress={handleNext}
              disabled={!hasMore}
            >
              <Text style={styles.pageButtonText}>Siguiente</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 24,
    backgroundColor: "#f0f0f3",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
  },
  searchInput: {
    backgroundColor: "#f3f3f3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 14,
    color: "#333",
  },
  rowWrapper: {
    justifyContent: "space-between",
    marginBottom: 14,
  },
  card: {
    width: (width - 64) / 2 - 8,
    height: 80,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#f3f3f3",
    borderWidth: 2,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    justifyContent: "space-between",
    minHeight: 60,
  },
  cardTitle: {
    color: "#333",
    fontWeight: "600",
    fontSize: 12,
    flex: 1,
    marginRight: 4,
  },
  cardAmount: {
    color: "#000",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },

  noData: {
    textAlign: "center",
    marginTop: 20,
    color: "#999",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  pageButton: {
    backgroundColor: "#EF7725",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pageButtonDisabled: {
    backgroundColor: "#ccc",
  },
  pageButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  pageIndicator: {
    color: "#444",
    fontWeight: "500",
  },
});

export default SubaccountsList;
