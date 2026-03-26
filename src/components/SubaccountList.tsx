import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { API_BASE_URL } from "../constants/api";
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from "../theme/useThemeColors";
// ✅ NUEVO: Importar SmartNumber para mostrar cifras grandes de forma segura
import SmartNumber from './SmartNumber';
import apiRateLimiter from "../services/apiRateLimiter";
import Toast from "react-native-toast-message";
import { canPerform } from '../services/planConfigService';
import type { DashboardSnapshot } from "../types/dashboardSnapshot";

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
  createdAt?: string;
  activa: boolean;
  origenSaldo?: 'cuenta_principal' | 'nuevo';
  pausadaPorPlan?: boolean;
}

interface Props {
  userId?: string;
  refreshKey?: number;
  dashboardSnapshot?: DashboardSnapshot | null;
}

const LIMIT = 5;

const SubaccountsList: React.FC<Props> = ({ userId, refreshKey = 0, dashboardSnapshot }) => {
  const colors = useThemeColors();
  const [subcuentas, setSubcuentas] = useState<Subcuenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const navigation = useNavigation<any>();
  const [mostrarSoloActivas, setMostrarSoloActivas] = useState(false);
  const [hasReachedLimit, setHasReachedLimit] = useState(false);
  const [allowedLimit, setAllowedLimit] = useState<number | null>(null);
  const [subcuentasWithPauseStatus, setSubcuentasWithPauseStatus] = useState<Subcuenta[]>([]);

  const snapshotMode = dashboardSnapshot !== undefined;

  const subaccountsTotals = dashboardSnapshot?.subaccountsTotals;
  const showSubaccountsTotals =
    !!subaccountsTotals &&
    (Array.isArray(subaccountsTotals.active?.byCurrency) || Array.isArray(subaccountsTotals.paused?.byCurrency));

  // Refs para cleanup y control de estado
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(delay);
  }, [search]);

  // Snapshot mode (Dashboard): compute list locally from snapshot, avoid network + canPerform
  useEffect(() => {
    if (!snapshotMode || !dashboardSnapshot) return;

    const pauseIds = new Set(
      (dashboardSnapshot.meta?.planEnforcement?.subcuentas?.toPauseOnThisPage || []).map((x) => String(x))
    );

    const all: Subcuenta[] = (dashboardSnapshot.subaccountsSummary || []).map((s) => ({
      // Use backend per-item flag as source of truth; fall back to planEnforcement ids when present.
      pausadaPorPlan: Boolean(s.pausadaPorPlan) || pauseIds.has(String(s.id)),
      _id: s.id,
      subCuentaId: s.id,
      nombre: s.nombre,
      cantidad: Number(s.saldo || 0),
      moneda: s.moneda,
      simbolo: (s.simbolo ?? '') as any,
      color: (s.color ?? '') as any,
      afectaCuenta: true,
      updatedAt: dashboardSnapshot.meta?.generatedAt ?? new Date().toISOString(),
      createdAt: dashboardSnapshot.meta?.generatedAt ?? new Date().toISOString(),
      // Paused-by-plan should not be considered active in UI.
      activa: Boolean(s.activa) && !(Boolean(s.pausadaPorPlan) || pauseIds.has(String(s.id))),
    }));

    let filtered = all;
    if (debouncedSearch.trim()) {
      filtered = all.filter((x) => (x.nombre || '').toLowerCase().includes(debouncedSearch.toLowerCase()));
    }
    if (mostrarSoloActivas) {
      filtered = filtered.filter((x) => x.activa);
    }
    filtered = filtered.sort((a, b) => Number(b.activa) - Number(a.activa));

    const start = (page - 1) * LIMIT;
    const slice = filtered.slice(start, start + LIMIT);

    setSubcuentas(slice);
    setSubcuentasWithPauseStatus(slice);
    setHasMore(start + LIMIT < filtered.length);
    setLoading(false);

    const isPremium = Boolean(dashboardSnapshot.meta?.plan?.isPremium);
    const enforcement = dashboardSnapshot.meta?.planEnforcement?.subcuentas;
    const max = enforcement?.limit ?? dashboardSnapshot.meta?.limits?.maxSubcuentas ?? null;
    const unlimited = max === -1 || max === null;
    setAllowedLimit(unlimited ? null : Number(max));
    setHasReachedLimit(Boolean(enforcement?.overLimit) || (!isPremium && !unlimited && filtered.length >= Number(max)));
  }, [snapshotMode, dashboardSnapshot, debouncedSearch, mostrarSoloActivas, page]);

  const fetchSubcuentas = async (forceFresh = false) => {
    if (snapshotMode) return;
    if (!userId) {
      console.log('💳 [SubaccountsList] Esperando userId antes de hacer fetch');
      return;
    }
    const now = Date.now();

    console.log('💳 [SubaccountsList] Iniciando fetch de subcuentas:', {
      userId,
      page,
      mostrarSoloActivas,
      refreshKey,
      forceFresh,
      timestamp: new Date().toISOString()
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

      // Construir headers y permitir forzar fresh cuando venga el flag
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (forceFresh) headers['X-Skip-Cache'] = '1';

      // 🔥 Usar apiRateLimiter en lugar de fetch directo
      const res = await apiRateLimiter.fetch(
        `${API_BASE_URL}/subcuenta/${userId}?soloActivas=${mostrarSoloActivas}&page=${page}&limit=${LIMIT}`,
        { 
          headers,
          signal,
        }
      );

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('💳 [SubaccountsList] Fetch cancelado');
        return;
      }

      const data = await res.json();

      console.log('📥 [SubaccountsList] Respuesta recibida:', {
        dataLength: Array.isArray(data) ? data.length : 'No es array',
        type: typeof data
      });

      if (!Array.isArray(data)) {
        console.error("❌ [SubaccountsList] Respuesta inválida:", data);
        if (isMountedRef.current && !signal.aborted) {
          setSubcuentas([]);
          setHasMore(false);
          
          // Mostrar mensaje específico para error 429
          if (data?.statusCode === 429 || data?.message?.includes('Too Many')) {
            Toast.show({
              type: 'error',
              text1: '⚠️ Demasiadas peticiones',
              text2: 'Por favor espera 10 segundos antes de actualizar',
              visibilityTime: 5000,
            });
          }
        }
        return;
      }

      // rawData = respuesta sin filtrar
      const rawData = Array.isArray(data) ? data : [];

      // Aplicar búsqueda sobre el dataset recibido
      let filtered = rawData;
      if (debouncedSearch.trim()) {
        filtered = rawData.filter((s) => s.nombre.toLowerCase().includes(debouncedSearch.toLowerCase()));
      }
      filtered = filtered.sort((a, b) => Number(b.activa) - Number(a.activa));

      const moreAvailable = rawData.length === LIMIT; // si el backend devolvió LIMIT, asumimos que hay más

      console.log('✅ [SubaccountsList] Subcuentas actualizadas:', {
        totalOriginal: rawData.length,
        totalFiltrado: filtered.length,
        hasMore: moreAvailable,
      });

      // Solo actualizar estado si el componente está montado
      if (isMountedRef.current && !signal.aborted) {
        setHasMore(moreAvailable);

        // Si avanzamos a una página vacía (no debería pasar), corregimos al primer page
        if (rawData.length === 0 && page > 1) {
          console.warn('[SubaccountsList] Página vacía recibida, reset page -> 1');
          setPage(1);
        }
        
        // Verificar límite para mostrar información al usuario
        if (userId) {
          const subcuentasCount = filtered.length;
          const limitCheck = await canPerform('subcuenta', { userId, currentCount: subcuentasCount });
          const hasReachedLimitValue = !limitCheck.allowed;
          setHasReachedLimit(hasReachedLimitValue);
          
          let limit = null;
          if (limitCheck.message) {
            const match = limitCheck.message.match(/(\d+)\/(\d+)/);
            if (match) {
              limit = parseInt(match[2], 10);
            }
          }
          if (!limit && hasReachedLimitValue) {
            limit = subcuentasCount;
          }
          setAllowedLimit(limit);
          
          console.log('🔍 [SubaccountsList] Estado de subcuentas:', {
            count: subcuentasCount,
            allowed: limitCheck.allowed,
            limit,
            subcuentas: filtered.map(s => ({
              nombre: s.nombre,
              pausadaPorPlan: s.pausadaPorPlan,
              activa: s.activa,
              createdAt: s.createdAt
            }))
          });
          
          // 🛡️ VALIDACIÓN DEFENSIVA: Si el backend no marcó pausadaPorPlan correctamente,
          // el frontend lo calcula basado en fecha de creación y límite del plan
          if (hasReachedLimitValue && limit) {
            // Ordenar por fecha de creación (más recientes primero)
            const sorted = [...filtered].sort((a, b) => {
              const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
              const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
              return dateB - dateA; // Más recientes primero
            });
            
            // Verificar si el backend marcó correctamente
            const backendMarkedCorrectly = sorted.some((s, i) => {
              const shouldBePaused = i >= limit;
              return shouldBePaused && s.pausadaPorPlan;
            });
            
            if (!backendMarkedCorrectly) {
              console.warn('⚠️ [SubaccountsList] Backend no marcó pausadaPorPlan correctamente. Aplicando validación defensiva.');
              
              // Marcar las que exceden el límite como pausadas
              const withPauseStatus = sorted.map((sub, index) => ({
                ...sub,
                pausadaPorPlan: sub.pausadaPorPlan || index >= limit
              }));
              
              console.log('🔍 [SubaccountsList] Subcuentas con validación defensiva:', 
                withPauseStatus.map((s, i) => ({
                  index: i,
                  nombre: s.nombre,
                  pausadaPorPlan: s.pausadaPorPlan,
                  mantenerActiva: i < limit,
                  createdAt: s.createdAt
                }))
              );
              
              setSubcuentasWithPauseStatus(withPauseStatus);
              setSubcuentas(withPauseStatus);
              return;
            }
          }
        }
        
        // Si el backend marcó correctamente o no se alcanzó el límite
        setSubcuentasWithPauseStatus(filtered);
        setSubcuentas(filtered);
      }
    } catch (err: any) {
      // Ignorar errores de abort
      if (err.name === 'AbortError' || signal.aborted) {
        console.log('💳 [SubaccountsList] Fetch cancelado');
        return;
      }
      console.error("❌ [SubaccountsList] Error al obtener subcuentas:", err);
      
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
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const delay = setTimeout(() => {
      // Si el refreshKey cambió, forzamos fetch fresco para evitar cache
      fetchSubcuentas(Boolean(refreshKey));
    }, 400);

    return () => clearTimeout(delay);
  }, [page, debouncedSearch, refreshKey, mostrarSoloActivas, snapshotMode]);



  const handlePrev = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNext = () => {
    if (hasMore) setPage((p) => p + 1);
  };

  const renderItem = ({ item }: { item: Subcuenta }) => (
    <TouchableOpacity
      onPress={() => {
        if (item.pausadaPorPlan) {
          Toast.show({
            type: 'info',
            text1: '🔒 Subcuenta pausada automáticamente',
            text2: allowedLimit 
              ? `Tu plan actual permite ${allowedLimit} subcuentas activas. Las más antiguas se pausaron automáticamente. Actualiza a Premium para ilimitadas.`
              : 'Esta subcuenta fue pausada automáticamente por tu plan. Actualiza a Premium para reactivarla.',
            visibilityTime: 6000,
            onPress: () => {
              // Navegar a Settings para upgrade
            },
          });
          return;
        }
        navigation.navigate("SubaccountDetail", {
          subcuenta: item,
          onGlobalRefresh: fetchSubcuentas,
        });
      }}
      activeOpacity={item.pausadaPorPlan ? 1 : 0.7}
      style={[
        styles.card, 
        { 
          borderColor: item.color, 
          backgroundColor: colors.card, 
          shadowColor: colors.shadow,
          opacity: item.pausadaPorPlan ? 0.5 : 1
        }
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
          {item.nombre}
        </Text>
        {item.afectaCuenta && (
          <Ionicons name="checkmark-circle" size={14} color={item.color} />
        )}
      </View>

      <Text style={[styles.cardAmount, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
        {item.simbolo}
        {item.cantidad >= 1000000 
          ? `${(item.cantidad / 1000000).toFixed(1)}M`
          : item.cantidad.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        } {item.moneda}
      </Text>

      {/* Badge de estado */}
      <View style={styles.badgesRow}>
        {item.pausadaPorPlan ? (
          <View style={[styles.statusBadge, { backgroundColor: "#FEF3C7" }]}>
            <Text style={[styles.statusText, { color: "#F59E0B" }]}>⚠️ Pausada por plan</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: item.activa ? "#D1FAE5" : "#FEE2E2" }]}>
            <Text style={[styles.statusText, { color: item.activa ? "#10B981" : "#EF4444" }]}>
              {item.activa ? "Activa" : "Inactiva"}
            </Text>
          </View>
        )}

        {item.origenSaldo && (
          <View style={[styles.originBadge, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <Text style={[styles.originText, { color: colors.textSecondary }]}>
              {item.origenSaldo === 'cuenta_principal' ? 'Apartado' : 'Saldo nuevo'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.chartBackground, shadowColor: colors.shadow, borderColor: colors.border }]}>
      <View style={styles.headerBlock}>
        {/* Title row: name + Totales badge inline */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text, marginBottom: 0 }]}>Subcuentas</Text>
          {snapshotMode && showSubaccountsTotals && (
            <View style={[styles.totalsBadge, { backgroundColor: colors.button + '15', borderColor: colors.button + '35' }]}>
              <Ionicons name="stats-chart" size={10} color={colors.button} />
              <Text style={[styles.totalsBadgeText, { color: colors.button }]}>Totales</Text>
            </View>
          )}
        </View>

        {snapshotMode && showSubaccountsTotals && (
          <View style={[styles.totalsContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            {/* Activas row */}
            {Array.isArray(subaccountsTotals?.active?.byCurrency) && subaccountsTotals!.active.byCurrency.length > 0 && (
              <View style={styles.totalsRow}>
                <View style={styles.totalsStatusLabel}>
                  <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.totalsStatusText, { color: colors.textSecondary }]}>Activas</Text>
                </View>
                <View style={styles.totalsCurrencyRow}>
                  {subaccountsTotals!.active.byCurrency.map((x) => (
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
            {/* Divider */}
            {Array.isArray(subaccountsTotals?.active?.byCurrency) && subaccountsTotals!.active.byCurrency.length > 0 &&
             Array.isArray(subaccountsTotals?.paused?.byCurrency) && subaccountsTotals!.paused.byCurrency.length > 0 && (
              <View style={[styles.totalsDivider, { backgroundColor: colors.border }]} />
            )}
            {/* Pausadas row */}
            {Array.isArray(subaccountsTotals?.paused?.byCurrency) && subaccountsTotals!.paused.byCurrency.length > 0 && (
              <View style={styles.totalsRow}>
                <View style={styles.totalsStatusLabel}>
                  <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.totalsStatusText, { color: colors.textSecondary }]}>Pausadas</Text>
                </View>
                <View style={styles.totalsCurrencyRow}>
                  {subaccountsTotals!.paused.byCurrency.map((x) => (
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
        placeholder="Buscar subcuenta..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={colors.placeholder}
      />

      <View style={styles.toggleContainer}>
        <Text style={[styles.toggleLabel, { color: colors.textSecondary }]}>Mostrar solo activas</Text>
        <TouchableOpacity
          style={[
            styles.toggleSwitch,
            mostrarSoloActivas ? styles.toggleOn : styles.toggleOff,
          ]}
          onPress={() => {
            setPage(1);
            setMostrarSoloActivas(!mostrarSoloActivas);
          }}
        >
          <View
            style={[
              styles.toggleCircle,
              mostrarSoloActivas ? styles.circleOn : styles.circleOff,
            ]}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={colors.button} />
      ) : subcuentas.length === 0 ? (
        <Text style={[styles.noData, { color: colors.textSecondary }]}>No hay subcuentas registradas.</Text>
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
                { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                page <= 1 && styles.pageButtonDisabled,
              ]}
              onPress={handlePrev}
              disabled={page <= 1}
            >
              <Text style={[styles.pageButtonText, { color: colors.textSecondary }]}>Anterior</Text>
            </TouchableOpacity>
            <Text style={[styles.pageIndicator, { color: colors.text }]}>Página {page}</Text>
            <TouchableOpacity
              style={[
                styles.pageButton,
                { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow },
                !hasMore && styles.pageButtonDisabled
              ]}
              onPress={handleNext}
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
    padding: 8,
    borderRadius: 10,
    borderWidth: 2,
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    justifyContent: "space-between",
    minHeight: 60,
  },
  cardTitle: {
    fontWeight: "600",
    fontSize: 12,
    flex: 1,
    marginRight: 4,
  },
  cardAmount: {
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
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  originBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  originText: {
    fontSize: 10,
    fontWeight: '700',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 16,
    padding: 4,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: '#EF7725',
  },
  toggleOff: {
    backgroundColor: '#ccc',
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  circleOn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  circleOff: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
});

export default SubaccountsList;
