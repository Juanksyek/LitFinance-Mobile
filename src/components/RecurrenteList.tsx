import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";

const { width } = Dimensions.get("window");
const LIMIT = 4;
type RecurrenteNavigationProp = NavigationProp<RootStackParamList, "RecurrenteDetail">;

type Recurrente = {
    recurrenteId: string;
    nombre: string;
    monto: number;
    frecuenciaDias: number;
    proximaEjecucion: string;
    plataforma?: { color: string; nombre: string; categoria: string };
    afectaCuentaPrincipal: boolean;
    afectaSubcuenta: boolean;
    subcuentaId?: string;
    recordatorios?: number[];
};

const RecurrentesList = ({
    userId,
    subcuentaId,
    esSubcuenta = false,
    refreshKey,
}: {
    userId: string;
    subcuentaId?: string;
    esSubcuenta?: boolean;
    refreshKey?: number;
}) => {
    const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);

    const navigation = useNavigation<RecurrenteNavigationProp>();

    // Delay para el search
    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(timeout);
    }, [search]);

    // Fetch principal
    const fetchRecurrentes = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem("authToken");
            const query = `userId=${userId}&page=${page}&limit=${LIMIT}&search=${debouncedSearch}`;
            const res = await fetch(`${API_BASE_URL}/recurrentes?${query}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (!Array.isArray(data.items)) return;

            const filtrados = esSubcuenta
                ? data.items.filter((r: Recurrente) => r.subcuentaId === subcuentaId)
                : data.items.filter((r: Recurrente) => r.afectaCuentaPrincipal);

            setRecurrentes(filtrados);
            setHasMore(data.hasNextPage);
        } catch (err) {
            console.error("Error al obtener recurrentes:", err);
        } finally {
            setLoading(false);
        }
    };

    // Efecto principal al cambiar page o debouncedSearch
    useEffect(() => {
        fetchRecurrentes();
    }, [page, debouncedSearch]);

    // Si se pasa refreshKey (por editar o crear), se reinicia la búsqueda
    useEffect(() => {
        if (refreshKey) {
            setPage(1);
            setDebouncedSearch(""); // Reiniciar búsqueda también
        }
    }, [refreshKey]);

    const renderItem = ({ item }: { item: Recurrente }) => (
        <TouchableOpacity
            onPress={() => navigation.navigate("RecurrenteDetail", { recurrente: item })}
            style={[
                styles.card,
                { borderColor: item.plataforma?.color || "#EF7725" },
            ]}
        >
            <Text style={styles.nombre} numberOfLines={1}>
                {item.nombre}
            </Text>
            <Text style={styles.monto}>${item.monto.toFixed(2)}</Text>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.frecuenciaDias} días</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.wrapper}>
            <Text style={styles.title}>Recurrentes</Text>
            <TextInput
                style={styles.searchInput}
                placeholder="Buscar recurrente..."
                value={search}
                onChangeText={setSearch}
                placeholderTextColor="#aaa"
            />
            {loading ? (
                <ActivityIndicator color="#EF7725" style={{ marginTop: 20 }} />
            ) : (
                <>
                    <FlatList
                        data={recurrentes}
                        keyExtractor={(item) => item.recurrenteId}
                        renderItem={renderItem}
                        numColumns={2}
                        scrollEnabled={false}
                        columnWrapperStyle={styles.rowWrapper}
                        contentContainerStyle={{ paddingBottom: 16 }}
                    />
                    <View style={styles.pagination}>
                        <TouchableOpacity
                            onPress={() => setPage((p) => Math.max(p - 1, 1))}
                            style={[
                                styles.pageButton,
                                page === 1 && styles.pageButtonDisabled,
                            ]}
                            disabled={page === 1}
                        >
                            <Text style={styles.pageButtonText}>Anterior</Text>
                        </TouchableOpacity>
                        <Text style={styles.pageIndicator}>Página {page}</Text>
                        <TouchableOpacity
                            onPress={() => hasMore && setPage((p) => p + 1)}
                            style={[
                                styles.pageButton,
                                !hasMore && styles.pageButtonDisabled,
                            ]}
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

export default RecurrentesList;

const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: "#f0f0f3",
        marginBottom: 40,
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
        marginBottom: -5,
        padding: 8,
        borderRadius: 10,
        backgroundColor: "#f3f3f3",
        borderWidth: 2,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
        justifyContent: "space-between",
    },
    nombre: {
        fontSize: 12,
        fontWeight: "600",
        color: "#1e293b",
    },
    monto: {
        fontSize: 14,
        fontWeight: "700",
        color: "#0f172a",
    },
    badge: {
        backgroundColor: "#E0E7FF",
        alignSelf: "flex-start",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 2,
    },
    badgeText: {
        fontSize: 10,
        color: "#3730A3",
        fontWeight: "500",
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