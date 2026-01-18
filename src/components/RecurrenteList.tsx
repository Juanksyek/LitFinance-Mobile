import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { API_BASE_URL } from "../constants/api";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/useThemeColors";
import apiRateLimiter from "../services/apiRateLimiter";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");
const LIMIT = 4;
type RecurrenteNavigationProp = NavigationProp<RootStackParamList, "RecurrenteDetail">;

type Recurrente = {
    recurrenteId: string;
    nombre: string;
    monto: number;
    moneda?: string;
    frecuenciaValor: string;
    frecuenciaTipo: 'dia_semana' | 'dia_mes' | 'fecha_anual';
    proximaEjecucion: string;
    plataforma?: { color: string; nombre: string; categoria: string };
    afectaCuentaPrincipal: boolean;
    afectaSubcuenta: boolean;
    subcuentaId?: string;
    recordatorios?: number[];
    pausado: boolean;
  };

const RecurrentesList = ({
    userId,
    subcuentaId,
    esSubcuenta = false,
    refreshKey,
}: {
    userId?: string;
    subcuentaId?: string;
    esSubcuenta?: boolean;
    refreshKey?: number;
}) => {
    const colors = useThemeColors();
    console.log('🔁 [RecurrentesList] render', { userId, subcuentaId });
    const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);

    const navigation = useNavigation<RecurrenteNavigationProp>();
    
    // Refs para cleanup y control de estado
    const isMountedRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastFetchRef = useRef<number>(0);

    // Cleanup al desmontar
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(timeout);
    }, [search]);

    const fetchRecurrentes = async (forceFresh = false) => {
        if (!userId) {
            console.log('📋 [RecurrentesList] Esperando userId antes de hacer fetch');
            return;
        }
        const now = Date.now();

        console.log('📋 [RecurrentesList] Iniciando fetch de recurrentes:', {
            userId,
            page,
            debouncedSearch,
            esSubcuenta,
            subcuentaId,
            forceFresh
        });
        
        // Cancelar fetch anterior
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        try {
            setLoading(true);
            lastFetchRef.current = now;

            const token = await authService.getAccessToken();
            const query = `userId=${userId}&page=${page}&limit=${LIMIT}&search=${debouncedSearch}`;

            // Permitir forzar fetch fresco cuando se pasa header desde el refreshKey
            const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
            if (forceFresh) {
                headers['X-Skip-Cache'] = '1';
            }

            // 🔥 Usar apiRateLimiter en lugar de fetch directo
            const res = await apiRateLimiter.fetch(`${API_BASE_URL}/recurrentes?${query}`, {
                headers,
                signal,
            });

            // Verificar si fue abortado
            if (signal.aborted) {
                console.log('📋 [RecurrentesList] Fetch cancelado');
                return;
            }

            const data = await res.json();

            console.log('📥 [RecurrentesList] Respuesta recibida:', {
                itemsLength: data.items?.length || 0,
                hasNextPage: data.hasNextPage
            });

            if (!Array.isArray(data.items)) return;

            const filtrados = esSubcuenta
                ? data.items.filter((r: Recurrente) => String(r.subcuentaId ?? '') === String(subcuentaId ?? ''))
                : data.items.filter((r: Recurrente) => {
                    // Support both possible backend shapes: 'afectaCuentaPrincipal' or legacy 'afectaCuenta'
                    const affectsPrincipal = (r as any).afectaCuentaPrincipal;
                    const affectsLegacy = (r as any).afectaCuenta;
                    return (typeof affectsPrincipal === 'boolean' ? affectsPrincipal : (typeof affectsLegacy === 'boolean' ? affectsLegacy : true));
                });

            console.log('✅ [RecurrentesList] Recurrentes filtrados:', {
                totalOriginal: data.items.length,
                totalFiltrado: filtrados.length,
                tipo: esSubcuenta ? 'subcuenta' : 'cuenta principal'
            });

            // Solo actualizar estado si el componente está montado
            if (isMountedRef.current && !signal.aborted) {
                setRecurrentes(filtrados);
                setHasMore(data.hasNextPage);
            }
        } catch (err: any) {
            // Ignorar errores de abort
            if (err.name === 'AbortError' || signal.aborted) {
                console.log('📋 [RecurrentesList] Fetch cancelado');
                return;
            }
            console.error("❌ [RecurrentesList] Error al obtener recurrentes:", err);
            
            if (isMountedRef.current && !signal.aborted) {
                const isRateLimit = err.message?.includes('Rate limit') || err.message?.includes('429') || err.message?.includes('Too Many');
                if (isRateLimit) {
                    Toast.show({
                        type: 'error',
                        text1: '⚠️ Demasiadas peticiones',
                        text2: 'Espera 10 segundos e intenta de nuevo',
                        visibilityTime: 5000,
                    });
                }
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        // If userId changed or page/search changed, prefer a fresh fetch to avoid stale cache on initial load
        const force = !!userId; // when userId becomes available, force fresh
        fetchRecurrentes(force);
    }, [page, debouncedSearch, userId]);

    useEffect(() => {
        if (refreshKey) {
            console.log('🔄 [RecurrentesList] RefreshKey cambió, recargando datos (forceFresh):', refreshKey);
            setPage(1);
            setDebouncedSearch("");
            fetchRecurrentes(true);
        }
    }, [refreshKey]);

    const renderItem = ({ item }: { item: Recurrente }) => {
        const obtenerPeriodo = () => {
          switch (item.frecuenciaTipo) {
            case "dia_semana":
              return `Cada ${item.frecuenciaValor}`;
            case "dia_mes":
              return `Cada mes el día ${item.frecuenciaValor}`;
            case "fecha_anual":
              return `Cada ${item.frecuenciaValor}`;
            default:
              return "Sin periodo definido";
          }
        };
      
        return (
                    <TouchableOpacity
                        onPress={() => navigation.navigate("RecurrenteDetail", { recurrente: item })}
                        style={[
                            styles.card,
                            { borderColor: item.plataforma?.color || "#EF7725", backgroundColor: colors.card, shadowColor: colors.shadow },
                        ]}
                    >
                        <View>
                            <Text style={[styles.nombre, { color: colors.text }]} numberOfLines={1}>{item.nombre}</Text>
                            <Text style={[styles.monto, { color: colors.text }]}>${item.monto >= 1000000 
                                    ? `${(item.monto / 1000000).toFixed(1)}M`
                                    : item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                } {item.moneda || ''}</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{obtenerPeriodo()}</Text>
                            </View>
                            {item.pausado && (
                                <View style={[styles.badge, { backgroundColor: "#FEF3C7" }]}> 
                                    <Text style={[styles.badgeText, { color: "#92400E" }]}>Pausado</Text>
                                </View>
                            )}
                        </View>
            {item.pausado && (
              <Ionicons name="pause-circle" size={20} color="#FFD700" style={{ position: 'absolute', top: 6, right: 6 }} />
            )}
          </TouchableOpacity>
        );
      };

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.chartBackground, shadowColor: colors.shadow, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Recurrentes</Text>
            <TextInput
                style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
                placeholder="Buscar recurrente..."
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={colors.placeholder}
            />
            {loading ? (
                <ActivityIndicator color={colors.button} style={{ marginTop: 20 }} />
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
                                { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                                page === 1 && styles.pageButtonDisabled,
                            ]}
                            disabled={page === 1}
                        >
                            <Text style={[styles.pageButtonText, { color: colors.textSecondary }]}>Anterior</Text>
                        </TouchableOpacity>
                        <Text style={[styles.pageIndicator, { color: colors.text }]}>Página {page}</Text>
                        <TouchableOpacity
                            onPress={() => hasMore && setPage((p) => p + 1)}
                            style={[
                                styles.pageButton,
                                { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                                !hasMore && styles.pageButtonDisabled,
                            ]}
                            disabled={!hasMore}
                        >
                            <Text style={[styles.pageButtonText, { color: colors.textSecondary }]}>Siguiente</Text>
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
        marginBottom: 24,
        borderRadius: 14,
        padding: 16,
        shadowOpacity: 0.06,
        shadowRadius: 5,
        elevation: 3,
        borderWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 10,
    },
    searchInput: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        marginBottom: 14,
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
        borderWidth: 2,
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
        justifyContent: "space-between",
    },
    nombre: {
        fontSize: 12,
        fontWeight: "600",
    },
    monto: {
        fontSize: 14,
        fontWeight: "700",
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
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    pageButtonDisabled: {
        opacity: 0.4,
    },
    pageButtonText: {
        fontWeight: "600",
    },
    pageIndicator: {
        fontWeight: "500",
    },
});
