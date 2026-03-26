import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { API_BASE_URL } from "../constants/api";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/useThemeColors";
import { describeFrequencyShort } from '../utils/recurrentUtils';
import SmartNumber from './SmartNumber';
import apiRateLimiter from "../services/apiRateLimiter";
import Toast from "react-native-toast-message";
import { canPerform } from '../services/planConfigService';
import type { DashboardSnapshot } from "../types/dashboardSnapshot";

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
    tipoRecurrente?: 'indefinido' | 'plazo_fijo';
    totalPagos?: number;
    pagosRealizados?: number;
    estado?: 'activo' | 'pausado' | 'completado';
    pausadoPorPlan?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };

const RecurrentesList = ({
    userId,
    subcuentaId,
    esSubcuenta = false,
    refreshKey,
    dashboardSnapshot,
}: {
    userId?: string;
    subcuentaId?: string;
    esSubcuenta?: boolean;
    refreshKey?: number;
    dashboardSnapshot?: DashboardSnapshot | null;
}) => {
    const colors = useThemeColors();
    console.log('🔁 [RecurrentesList] render', { userId, subcuentaId });
    const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [hasReachedLimit, setHasReachedLimit] = useState(false);
    const [allowedLimit, setAllowedLimit] = useState<number | null>(null);
    const [recurrentesWithPauseStatus, setRecurrentesWithPauseStatus] = useState<Recurrente[]>([]);

    const snapshotMode = dashboardSnapshot !== undefined && !esSubcuenta;

    const recurrentesTotals = dashboardSnapshot?.recurrentesTotals;
    const showRecurrentesTotals =
        snapshotMode &&
        !!recurrentesTotals &&
        (Array.isArray(recurrentesTotals.active?.byCurrency) || Array.isArray(recurrentesTotals.paused?.byCurrency));

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

    // Snapshot mode (Dashboard): compute list locally from snapshot, avoid network + canPerform
    useEffect(() => {
        if (!snapshotMode || !dashboardSnapshot) return;

        const pauseIds = new Set(
            (dashboardSnapshot.meta?.planEnforcement?.recurrentes?.toPauseOnThisPage || []).map((x) => String(x))
        );

                const allBase = (dashboardSnapshot.recurrentesSummary || []).map((r) => {
            const pausedByPlan = Boolean(r.pausadoPorPlan) || pauseIds.has(String(r.id));
            const baseEstado = (r.estado as any) ?? (r.pausado ? 'pausado' : 'activo');
            const estado = pausedByPlan && baseEstado !== 'completado' ? 'pausado' : baseEstado;
            const pausado = Boolean(r.pausado) || (pausedByPlan && estado !== 'completado');
            return {
            recurrenteId: r.id,
            nombre: r.nombre,
            monto: Number(r.monto || 0),
            moneda: r.moneda,
            frecuenciaValor: r.frecuenciaValor,
            frecuenciaTipo: (r.frecuenciaTipo as any) ?? 'dia_mes',
            proximaEjecucion: r.nextRun,
            plataforma: r.color ? { color: r.color, nombre: '', categoria: '' } : undefined,
            pausado,
            estado,
            pausadoPorPlan: pausedByPlan,
                        createdAt: (r as any).createdAt,
                        updatedAt: (r as any).updatedAt,
            afectaCuentaPrincipal: true,
            afectaSubcuenta: false,
        };
        }) as Recurrente[];

                const isPremium = Boolean(dashboardSnapshot.meta?.plan?.isPremium);
                const max = dashboardSnapshot.meta?.limits?.maxRecurrentes ?? null;
                const unlimited = max === -1 || max === null;

                // If backend didn't flag pausadoPorPlan but we are over limit on free, apply a defensive mark.
                let all = allBase;
                const hasAnyPlanPaused = allBase.some((x) => x.pausadoPorPlan);
                if (!isPremium && !unlimited && typeof max === 'number' && allBase.length > max && !hasAnyPlanPaused) {
                    const getTime = (x: Recurrente) => {
                        const ts = x.createdAt || x.updatedAt || '';
                        const t = ts ? new Date(ts).getTime() : 0;
                        return Number.isFinite(t) ? t : 0;
                    };

                    // Keep most recent active; pause the oldest beyond the limit.
                    const sorted = [...allBase].sort((a, b) => getTime(b) - getTime(a));
                    const allowedIds = new Set(sorted.slice(0, max).map((x) => x.recurrenteId));
                    all = allBase.map((x) =>
                        allowedIds.has(x.recurrenteId)
                            ? x
                            : { ...x, pausadoPorPlan: true, pausado: true, estado: 'pausado' }
                    );
                }

        const q = debouncedSearch.trim().toLowerCase();
        const filtered = q ? all.filter((x) => (x.nombre || '').toLowerCase().includes(q)) : all;

        const start = (page - 1) * LIMIT;
        const slice = filtered.slice(start, start + LIMIT);

        setRecurrentes(slice);
        setRecurrentesWithPauseStatus(slice);
        setHasMore(start + LIMIT < filtered.length);
        setLoading(false);

        setAllowedLimit(unlimited ? null : Number(max));
        setHasReachedLimit(!isPremium && !unlimited && filtered.length >= Number(max));
    }, [snapshotMode, dashboardSnapshot, debouncedSearch, page]);

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
            
            // Log para verificar el estado pausadoPorPlan
            if (data.items?.length > 0) {
                console.log('🔍 [RecurrentesList] Estados de recurrentes:', 
                    data.items.map((r: Recurrente) => ({
                        nombre: r.nombre,
                        pausado: r.pausado,
                        pausadoPorPlan: r.pausadoPorPlan,
                        estado: r.estado
                    }))
                );
            }

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
                totalCount: data.totalCount,
                tipo: esSubcuenta ? 'subcuenta' : 'cuenta principal'
            });

            // Solo actualizar estado si el componente está montado
            if (isMountedRef.current && !signal.aborted) {
                setHasMore(data.hasNextPage);
                
                // Verificar límite para mostrar información al usuario
                if (userId && !esSubcuenta) {
                    const recurrentesCount = data.totalCount || filtrados.length;
                    const limitCheck = await canPerform('recurrente', { userId, currentCount: recurrentesCount });
                    const hasReachedLimitValue = !limitCheck.allowed;
                    setHasReachedLimit(hasReachedLimitValue);
                    
                    // Extraer el límite del mensaje del backend (ej: "Límite: 3/10" o "4/10")
                    let limit = null;
                    if (limitCheck.message) {
                        const match = limitCheck.message.match(/(\d+)\/(\d+)/);
                        if (match) {
                            limit = parseInt(match[2], 10);
                        }
                    }
                    if (!limit && hasReachedLimitValue) {
                        limit = recurrentesCount;
                    }
                    setAllowedLimit(limit);
                    
                    console.log('🔍 [RecurrentesList] Estado de recurrentes:', {
                        count: recurrentesCount,
                        allowed: limitCheck.allowed,
                        limit,
                        recurrentes: filtrados.map((r: Recurrente) => ({
                            nombre: r.nombre,
                            pausadoPorPlan: r.pausadoPorPlan,
                            pausado: r.pausado,
                            estado: r.estado,
                            createdAt: r.createdAt
                        }))
                    });
                    
                    // 🛡️ VALIDACIÓN DEFENSIVA: Si el backend no marcó pausadoPorPlan correctamente,
                    // el frontend lo calcula basado en fecha de creación y límite del plan
                    if (hasReachedLimitValue && limit) {
                        // Ordenar por fecha de creación (más recientes primero)
                        const sorted = [...filtrados].sort((a, b) => {
                            const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
                            const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
                            return dateB - dateA; // Más recientes primero
                        });
                        
                        // Verificar si el backend marcó correctamente
                        const backendMarkedCorrectly = sorted.some((r, i) => {
                            const shouldBePaused = i >= limit;
                            return shouldBePaused && r.pausadoPorPlan;
                        });
                        
                        if (!backendMarkedCorrectly) {
                            console.warn('⚠️ [RecurrentesList] Backend no marcó pausadoPorPlan correctamente. Aplicando validación defensiva.');
                            
                            // Marcar los que exceden el límite como pausados
                            const withPauseStatus = sorted.map((rec, index) => ({
                                ...rec,
                                pausadoPorPlan: rec.pausadoPorPlan || index >= limit
                            }));
                            
                            console.log('🔍 [RecurrentesList] Recurrentes con validación defensiva:', 
                                withPauseStatus.map((r, i) => ({
                                    index: i,
                                    nombre: r.nombre,
                                    pausadoPorPlan: r.pausadoPorPlan,
                                    mantenerActivo: i < limit,
                                    createdAt: r.createdAt
                                }))
                            );
                            
                            setRecurrentesWithPauseStatus(withPauseStatus);
                            setRecurrentes(withPauseStatus);
                            return;
                        }
                    }
                }
                
                // Si el backend marcó correctamente o no se alcanzó el límite
                setRecurrentesWithPauseStatus(filtrados);
                setRecurrentes(filtrados);
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
        if (snapshotMode) return;
        const force = !!userId;
        fetchRecurrentes(force);
    }, [page, debouncedSearch, userId, snapshotMode]);

    useEffect(() => {
        if (snapshotMode) return;
        if (refreshKey) {
            console.log('🔄 [RecurrentesList] RefreshKey cambió, recargando datos (forceFresh):', refreshKey);
            setPage(1);
            setDebouncedSearch("");
            fetchRecurrentes(true);
        }
    }, [refreshKey, snapshotMode]);

        const renderItem = ({ item }: { item: Recurrente }) => {
        const obtenerPeriodo = () => describeFrequencyShort(item.frecuenciaTipo as any, item.frecuenciaValor as any);
        const getEstadoInfo = () => {
          // Prioridad 1: Completado
          if (item.estado === 'completado' || (item.tipoRecurrente === 'plazo_fijo' && item.pagosRealizados === item.totalPagos)) {
            return { icon: 'checkmark-circle', color: '#10B981', label: 'Completado', emoji: '✅' };
          }
          // Prioridad 2: Pausado por plan (límite alcanzado)
          if (item.pausadoPorPlan) {
                        return { icon: 'lock-closed', color: '#F59E0B', label: 'Pausado por plan', emoji: '⚠️' };
          }
          // Prioridad 3: Pausado manualmente
          if (item.pausado || item.estado === 'pausado') {
            return { icon: 'pause-circle', color: '#F59E0B', label: 'Pausado', emoji: '⏸' };
          }
          // Por defecto: Activo
          return { icon: 'checkmark-circle', color: '#10B981', label: 'Activo', emoji: '🟢' };
        };

        const estadoInfo = getEstadoInfo();
        const esCompletado = estadoInfo.label === 'Completado';
      
        return (
          <TouchableOpacity
            onPress={() => {
              if (item.pausadoPorPlan) {
                Toast.show({
                  type: 'info',
                  text1: '🔒 Recurrente pausado automáticamente',
                  text2: allowedLimit 
                    ? `Tu plan actual permite ${allowedLimit} recurrentes activos. Los más antiguos se pausaron automáticamente. Actualiza a Premium para ilimitados.`
                    : 'Este recurrente fue pausado automáticamente por tu plan. Actualiza a Premium para reactivarlo.',
                  visibilityTime: 6000,
                  onPress: () => {
                    // Navegar a Settings para upgrade
                  },
                });
                return;
              }
              navigation.navigate("RecurrenteDetail", { recurrente: item });
            }}
            activeOpacity={item.pausadoPorPlan ? 1 : 0.7}
            style={[
              styles.card,
              { 
                borderColor: item.plataforma?.color || "#EF7725", 
                backgroundColor: colors.card, 
                shadowColor: colors.shadow,
                opacity: esCompletado ? 0.75 : (item.pausadoPorPlan ? 0.5 : 1)
              },
            ]}
          >
            {/* Estado visual (emoji o icono) */}
            <View style={[styles.estadoBadge, { backgroundColor: estadoInfo.color + '20' }]}>
              <Text style={{ fontSize: 14 }}>{estadoInfo.emoji}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.nombre, { color: colors.text }]} numberOfLines={1}>
                {item.nombre}
              </Text>
              <Text style={[styles.monto, { color: colors.text }]}>
                ${item.monto >= 1000000 
                  ? `${(item.monto / 1000000).toFixed(1)}M`
                  : item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                } {item.moneda || ''}
              </Text>
              
              {/* Badge de frecuencia */}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{obtenerPeriodo()}</Text>
              </View>

              {/* Badge de estado (solo si no es activo) */}
              {estadoInfo.label !== 'Activo' && (
                <View style={[styles.estadoLabelBadge, { backgroundColor: estadoInfo.color + '20' }]}> 
                  <Ionicons name={estadoInfo.icon as any} size={14} color={estadoInfo.color} />
                  <Text style={[styles.estadoLabelText, { color: estadoInfo.color }]}>
                    {estadoInfo.label}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      };

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.chartBackground, shadowColor: colors.shadow, borderColor: colors.border }]}>
            <View style={styles.headerBlock}>
                <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: colors.text, marginBottom: 0 }]}>Recurrentes</Text>
                    {showRecurrentesTotals && (
                        <View style={[styles.totalsBadge, { backgroundColor: colors.button + '15', borderColor: colors.button + '35' }]}>
                            <Ionicons name="stats-chart" size={10} color={colors.button} />
                            <Text style={[styles.totalsBadgeText, { color: colors.button }]}>Totales</Text>
                        </View>
                    )}
                </View>

                {showRecurrentesTotals && (
                    <View style={[styles.totalsContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                        {Array.isArray(recurrentesTotals?.active?.byCurrency) && recurrentesTotals!.active.byCurrency.length > 0 && (
                            <View style={styles.totalsRow}>
                                <View style={styles.totalsStatusLabel}>
                                    <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                                    <Text style={[styles.totalsStatusText, { color: colors.textSecondary }]}>Activos</Text>
                                </View>

                                <View style={styles.totalsCurrencyRow}>
                                    {recurrentesTotals!.active.byCurrency.map((x) => (
                                        <View
                                            key={`active-${x.moneda}`}
                                            style={[styles.totalsCurrencyPill, { backgroundColor: '#10B98112', borderColor: '#10B98132' }]}
                                        >
                                            <SmartNumber
                                                value={Number(x.total || 0)}
                                                textStyle={[styles.totalsValue, { color: colors.text }]}
                                                options={{ context: 'list', currency: x.moneda, maxLength: 14 }}
                                            />
                                            <Text style={[styles.totalsCount, { color: '#10B981' }]}>{Number(x.count || 0)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                        {Array.isArray(recurrentesTotals?.active?.byCurrency) && recurrentesTotals!.active.byCurrency.length > 0 &&
                         Array.isArray(recurrentesTotals?.paused?.byCurrency) && recurrentesTotals!.paused.byCurrency.length > 0 && (
                            <View style={[styles.totalsDivider, { backgroundColor: colors.border }]} />
                        )}
                        {Array.isArray(recurrentesTotals?.paused?.byCurrency) && recurrentesTotals!.paused.byCurrency.length > 0 && (
                            <View style={styles.totalsRow}>
                                <View style={styles.totalsStatusLabel}>
                                    <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                                    <Text style={[styles.totalsStatusText, { color: colors.textSecondary }]}>Pausados</Text>
                                </View>
                                <View style={styles.totalsCurrencyRow}>
                                    {recurrentesTotals!.paused.byCurrency.map((x) => (
                                        <View
                                            key={`paused-${x.moneda}`}
                                            style={[styles.totalsCurrencyPill, { backgroundColor: '#F59E0B12', borderColor: '#F59E0B32' }]}
                                        >
                                            <SmartNumber
                                                value={Number(x.total || 0)}
                                                textStyle={[styles.totalsValue, { color: colors.text }]}
                                                options={{ context: 'list', currency: x.moneda, maxLength: 14 }}
                                            />
                                            <Text style={[styles.totalsCount, { color: '#F59E0B' }]}>{Number(x.count || 0)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </View>
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
    headerBlock: {
        marginBottom: 10,
    },
    totalsContainer: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginTop: 6,
        gap: 6,
        
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    totalsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    totalsBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    totalsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    totalsStatusLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        width: 66,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    totalsStatusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    totalsCurrencyRow: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
    },
    totalsCurrencyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    totalsDivider: {
        height: 1,
        marginVertical: 1,
    },
    totalsValue: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    totalsCount: {
        fontSize: 10,
        fontWeight: '600',
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
    estadoBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    estadoLabelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginTop: 4,
        gap: 4,
    },
    estadoLabelText: {
        fontSize: 10,
        fontWeight: '600',
    },
    progresoContainer: {
        marginTop: 6,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 3,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progresoText: {
        fontSize: 10,
        fontWeight: '500',
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
