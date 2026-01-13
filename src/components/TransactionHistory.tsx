import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import { jwtDecode } from "jwt-decode";
import { API_BASE_URL } from "../constants/api";
import Toast from "react-native-toast-message";
import HistorialDetalleModal from "./HistorialDetalleModal";
import SmartNumber from './SmartNumber';
import { useThemeColors } from "../theme/useThemeColors";
import apiRateLimiter from "../services/apiRateLimiter";

// Fix common mojibake where UTF-8 bytes were decoded as Latin-1
// Example: "TransacciÃ³n" -> "Transacción"
const fixMojibake = (input?: string | null) => {
  if (!input) return "";
  try {
    // Try the classic approach first
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore escape is deprecated but widely available at runtime
    return decodeURIComponent(escape(input));
  } catch (e) {
    try {
      // Fallback: reinterpret char codes as UTF-8 bytes
      const bytes = new Uint8Array(Array.from(input).map((c) => c.charCodeAt(0)));
      // TextDecoder may not exist in some RN JS engines; guard it
      // @ts-ignore
      if (typeof TextDecoder !== 'undefined') {
        // @ts-ignore
        return new TextDecoder('utf-8').decode(bytes);
      }
    } catch (e2) {
      // ignore
    }
  }
  return input;
};

type HistorialItem = {
  id: string;
  _id?: string;
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
  metadata?: {
    monedaOrigen?: string;
    montoOriginal?: number;
    monedaConvertida?: string;
    montoConvertido?: number;
    monedaDestino?: string;
    monedaCuenta?: string;
    tasaConversion?: number;
    nota?: string;
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

  // Cache de páginas para evitar refetches al navegar hacia atrás/adelante
  const pagesCacheRef = useRef<Record<number, HistorialItem[]>>({});
  const [requestedPage, setRequestedPage] = useState<number>(1);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs para prevención de memory leaks
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('🧹 [TransactionHistory] Limpiando componente...');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const formatAmountPlain = (amount: number) =>
    Math.abs(amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getConversionLabel = (item: HistorialItem): string | null => {
    const meta: any = item.metadata ?? {};
    const montoOriginal = meta.montoOriginal;
    const monedaOrigen = meta.monedaOrigen ?? meta.monedaOriginal;
    if (montoOriginal == null || !monedaOrigen) return null;

    const montoConvertido = meta.montoConvertido ?? item.monto;
    const monedaConvertida = meta.monedaConvertida ?? meta.monedaDestino ?? meta.monedaCuenta;
    if (montoConvertido == null || !monedaConvertida) return null;

    // Only show when it actually looks like a conversion (currency differs)
    if (String(monedaOrigen) === String(monedaConvertida)) return null;

    return `${formatAmountPlain(montoOriginal)} ${monedaOrigen} → ${formatAmountPlain(montoConvertido)} ${monedaConvertida}`;
  };

  useEffect(() => {
    const fetchHistorial = async () => {
      // Note: we removed strict global rate-limiting that blocked UX. Instead
      // we use per-page caching + debounce + prefetch to avoid saturating the API.

      if (!isMountedRef.current) {
        console.log('⚠️ [TransactionHistory] Componente desmontado, cancelando fetch');
        return;
      }

      // Cancelar fetch anterior
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      if (isMountedRef.current) {
        setLoading(true);
      }
      
      try {
        const token = await authService.getAccessToken();

        if (!token) {
          if (isMountedRef.current) {
            Toast.show({
              type: "error",
              text1: "Token no encontrado",
              text2: "Por favor inicia sesión nuevamente.",
            });
          }
          return;
        }

        const decoded: JwtPayload = jwtDecode(token);
        const cuentaId = decoded?.cuentaId;

        if (!cuentaId) {
          if (isMountedRef.current) {
            Toast.show({
              type: "error",
              text1: "Cuenta no encontrada",
              text2: "No se pudo obtener el ID de la cuenta.",
            });
          }
          return;
        }

        const url = `${API_BASE_URL}/cuenta-historial?cuentaId=${cuentaId}&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;

        const res = await apiRateLimiter.fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        });

        // Verificar si fue abortado
        if (signal.aborted) {
          console.log('📋 [TransactionHistory] Fetch cancelado');
          return;
        }

        const data = await res.json();

        // Solo actualizar estado si el componente está montado
        if (isMountedRef.current && !signal.aborted) {
          // Verificar si la respuesta tiene error 429
          if (data?.statusCode === 429 || data?.message?.includes('Too Many')) {
            Toast.show({
              type: "warning",
              text1: "⚠️ Demasiadas peticiones",
              text2: "Por favor espera 10 segundos antes de actualizar",
              position: "bottom",
              visibilityTime: 4000,
            });
            return;
          }
          
          if (Array.isArray(data?.data)) {
            setHistorial(data.data);
            setHasMore(data.data.length === limit);
            // Cachear la página para navegación rápida posterior
            try {
              pagesCacheRef.current[page] = data.data;
            } catch (e) {}
            // Prefetch siguiente página con ligero delay para no saturar
            if (data.data.length === limit) {
              const next = page + 1;
              if (!pagesCacheRef.current[next]) {
                setTimeout(async () => {
                  try {
                    const token = await authService.getAccessToken();
                    if (!token) return;
                    const res2 = await apiRateLimiter.fetch(`${API_BASE_URL}/cuenta-historial?cuentaId=${(jwtDecode(token) as JwtPayload)?.cuentaId}&page=${next}&limit=${limit}&search=${encodeURIComponent(search)}`,
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const d2 = await res2.json();
                    if (Array.isArray(d2?.data)) {
                      pagesCacheRef.current[next] = d2.data;
                    }
                  } catch (e) {
                    // ignore prefetch errors
                  }
                }, 600);
              }
            }
          } else {
            setHistorial([]);
            setHasMore(false);
            Toast.show({
              type: "info",
              text1: "Sin movimientos",
              text2: "No hay historial registrado aún.",
            });
          }
        }
      } catch (err) {
        // Ignorar errores de abort
        // Narrow 'err' safely since catch default type is unknown
        if (signal.aborted || (err as any)?.name === 'AbortError') {
          console.log('📋 [TransactionHistory] Fetch cancelado');
          return;
        }
        
        // Detectar errores de rate limiting
        const errorMsg = (typeof err === 'object' && err !== null && 'message' in err) ? String((err as any).message) : String(err);
        if (errorMsg.includes('Rate limit') || errorMsg.includes('429') || errorMsg.includes('Too Many')) {
          if (isMountedRef.current) {
            Toast.show({
              type: "warning",
              text1: "⚠️ Demasiadas peticiones",
              text2: "Por favor espera 10 segundos antes de actualizar",
              position: "bottom",
              visibilityTime: 4000,
            });
          }
          return;
        }
        
        if (isMountedRef.current) {
          setHistorial([]);
          Toast.show({
            type: "error",
            text1: "Error al cargar historial",
            text2: "Revisa tu conexión o vuelve a intentar.",
          });
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchHistorial();
  }, [refreshKey, search, page]);

  // Handler que usa debounce para evitar ráfagas de peticiones cuando el usuario
  // navega rápidamente. Actualiza `requestedPage` y tras 300ms aplica `page`.
  const handleRequestPage = (newPage: number) => {
    if (newPage < 1) return;
    setRequestedPage(newPage);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      // Si ya tenemos la página en cache, úsala localmente sin fetch
      if (pagesCacheRef.current[newPage]) {
        setHistorial(pagesCacheRef.current[newPage]);
        setHasMore(pagesCacheRef.current[newPage].length === limit);
        setPage(newPage);
        return;
      }
      setPage(newPage);
    }, 300);
  };

  // Si el refreshKey o la búsqueda cambian, limpiar cache y regresar a página 1
  useEffect(() => {
    pagesCacheRef.current = {};
    setRequestedPage(1);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setPage(1);
  }, [refreshKey, search]);

  const iconByTipo = (tipo: string) => {
    switch (tipo) {
      case "ingreso":
        return <Ionicons name="trending-up" size={20} color="#388e3c" />;
      case "egreso":
        return <Ionicons name="trending-down" size={20} color="#d32f2f" />;
      case "recurrente":
        return <Ionicons name="repeat" size={20} color="#6366f1" />;
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
    tipo,
    plataforma,
  }: {
    icon: React.ReactNode;
    title: string;
    amount: string;
    date: string;
    onPress: () => void;
    tipo?: string;
    plataforma?: string;
  }) => (
    <TouchableOpacity style={[styles.transactionItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress}>
      <View style={[styles.transactionIconContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}> 
        {icon}
      </View>
      <View style={styles.transactionDetails}>
        <Text style={[styles.transactionTitle, { color: colors.text }]}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>{date}</Text>
        </View>
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

      { loading ? (
        <ActivityIndicator size="small" color={colors.button} />
      ) : historial.length > 0 ? (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>
            Total: {historial.length} | Recurrentes: {historial.filter(i => i.tipo === 'recurrente').length}
          </Text>
          {historial.map((item, index) => {
            console.log(`🎨 [RENDER ${index}]`, {
              id: item.id || item._id,
              tipo: item.tipo,
              descripcion: fixMojibake(item.descripcion).substring(0, 30),
              monto: item.monto
            });
            let amountText = '';
            let showRegistroBadge = false;
            let registroBadgeText = '';
            let showRecurrenteBadge = false;
            let recurrenteBadgeText = '';
            const conversionLabel = getConversionLabel(item);
            // Recurrente de registro (monto 0)
            if (item.tipo === 'recurrente' && item.monto === 0) {
              amountText = 'Registro';
              showRegistroBadge = true;
              if (conversionLabel) {
                registroBadgeText = conversionLabel;
              } else if (item.metadata?.montoOriginal && item.metadata?.monedaOrigen) {
                registroBadgeText = `${formatAmountPlain(item.metadata.montoOriginal)} ${item.metadata.monedaOrigen}`;
              } else {
                registroBadgeText = 'Recurrente';
              }
            } else if (item.tipo === 'recurrente') {
              // Recurrente ejecutado (monto > 0)
              amountText = `$${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              showRecurrenteBadge = true;
              if (conversionLabel) {
                recurrenteBadgeText = conversionLabel;
              } else if (item.metadata?.monedaOrigen && item.metadata?.montoOriginal) {
                recurrenteBadgeText = `${formatAmountPlain(item.metadata.montoOriginal)} ${item.metadata.monedaOrigen}`;
              } else {
                recurrenteBadgeText = 'Recurrente';
              }
            } else if (item.monto >= 1000000) {
              amountText = `$${(item.monto / 1000000).toFixed(1)}M`;
            } else {
              amountText = `$${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            // Usar item.id o item._id como key y fallback para props
            const key = item.id || item._id;
            return (
              <View key={key}>
                <TransactionItem
                  icon={iconByTipo(item.tipo)}
                  title={fixMojibake(item.descripcion)}
                  amount={amountText}
                  date={new Date(item.fecha).toLocaleDateString()}
                  tipo={item.tipo}
                  plataforma={item.detalles?.plataforma}
                  onPress={() => {
                    setItemSeleccionado(item);
                    setModalVisible(true);
                  }}
                />
                {(showRegistroBadge || showRecurrenteBadge) && (registroBadgeText || recurrenteBadgeText || item.metadata?.nota) && (
                  <View style={{ marginBottom: 6, marginLeft: 48 }}>
                    {!!(registroBadgeText || recurrenteBadgeText) && (
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 8 }}>
                        {showRegistroBadge ? registroBadgeText : recurrenteBadgeText}
                      </Text>
                    )}
                    {!!item.metadata?.nota && (
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 8, marginTop: (registroBadgeText || recurrenteBadgeText) ? 2 : 0 }}>
                        {fixMojibake(item.metadata.nota)}
                      </Text>
                    )}
                  </View>
                )}
                {!showRegistroBadge && !showRecurrenteBadge && conversionLabel && (
                  <View style={{ marginBottom: 6, marginLeft: 48 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 8 }}>{conversionLabel}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </>
      ) : (
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>
          No hay movimientos registrados.
        </Text>
      )}

      <View style={styles.pagination}>
        <TouchableOpacity
          disabled={page === 1}
          onPress={() => handleRequestPage(Math.max(page - 1, 1))}
          style={[styles.viewAllButton, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }, page === 1 && { opacity: 0.4 }]}
        >
          <Ionicons name="chevron-back-outline" size={16} color={colors.button} />
          <Text style={[styles.viewAllText, { color: colors.textSecondary }]}>Anterior</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Página {page}</Text>
        </View>

        <TouchableOpacity
          disabled={!hasMore}
          onPress={() => handleRequestPage(page + 1)}
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
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  transactionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  transactionDetails: {
    flex: 1,
    marginRight: 8,
  },
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
  recurrenteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
  },
  recurrenteBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  registroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    marginLeft: 2,
  },
  registroBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
