import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet, StatusBar, Dimensions, Animated, Pressable, Platform, SafeAreaView, ScrollView, ActivityIndicator } from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import RecurrentModal from "../components/RecurrentModal";
import { API_BASE_URL } from "../constants/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../services/authService";
import Toast from "react-native-toast-message";
import { emitRecurrentesChanged } from "../utils/dashboardRefreshBus";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import DeleteModal from "../components/DeleteModal";
import { useThemeColors } from "../theme/useThemeColors";
import apiRateLimiter from "../services/apiRateLimiter";

const { width } = Dimensions.get("window");
type RecurrenteDetailRouteProp = RouteProp<
  {
    RecurrenteDetail: {
      recurrente: {
        recurrenteId: string;
        nombre: string;
        monto: number;
        frecuenciaTipo: string;
        frecuenciaValor: string;
        proximaEjecucion: string;
        plataforma?: { nombre: string; categoria: string; color?: string };
        afectaCuentaPrincipal: boolean;
        afectaSubcuenta: boolean;
        recordatorios?: number[];
        userId?: string;
        cuentaId?: string;
        pausado?: boolean;
        monedas?: string;
        moneda?: string;
      };
    };
  },
  "RecurrenteDetail"
>;

const DIAS_SEMANA = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const obtenerDescripcionFrecuencia = (tipo: string, valor: string): string => {
  switch (tipo) {
    case "dia_mes": return `Cada día ${valor} del mes`;
    case "dia_semana": return `Cada ${obtenerNombreDia(valor)}`;
    case "fecha_fija": return `Cada ${obtenerFechaCompleta(valor)}`;
    case "dias": return `Cada ${valor} días`;
    default: return "Frecuencia desconocida";
  }
};
const formatearFechaLocal = (iso: string): string => {
  try {
    const d = new Date(iso);
    const local = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    return local.toLocaleDateString("es-MX", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  } catch { return "Fecha no válida"; }
};
const obtenerNombreDia = (v: string) => DIAS_SEMANA[parseInt(v, 10)] || "día desconocido";
const obtenerFechaCompleta = (valor: string) => {
  const [dia, mes] = valor.split("-");
  const i = parseInt(mes, 10) - 1;
  if (isNaN(i) || i < 0 || i >= MESES.length) return valor;
  return `el ${dia} de ${MESES[i]}`;
};
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const estimatedCycleDays = (tipo: string, valor: string) => {
  if (tipo === "dia_semana") return 7;
  if (tipo === "dia_mes") return 30;
  if (tipo === "fecha_fija") return 365;
  if (tipo === "dias") return Number.isFinite(+valor) && +valor > 0 ? +valor : 30;
  return 30;
};
const daysUntil = (iso: string, tipo?: string, valor?: string) => {
  try {
    const now = new Date();
    let target = new Date(iso);
    if (tipo === "dia_mes" && valor) {
      const day = parseInt(valor, 10);
      let m = now.getMonth();
      let y = now.getFullYear();
      if (now.getDate() > day) { m += 1; if (m > 11) { m = 0; y += 1; } }
      target = new Date(y, m, day);
    }
    if (target < now) {
      if (tipo === "dia_mes" && valor) {
        let m = now.getMonth() + 1; let y = now.getFullYear();
        if (m > 11) { m = 0; y += 1; }
        target = new Date(y, m, parseInt(valor, 10));
      } else if (tipo === "dia_semana" && valor) {
        const targetDay = parseInt(valor, 10);
        const add = ((7 + targetDay - now.getDay()) % 7) || 7;
        target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
      } else if (tipo === "dias" && valor) {
        target = new Date(now.getTime() + Number(valor) * 86400000);
      }
    }
    const diff = target.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / 86400000));
  } catch { return 0; }
};

const withAlpha = (hex: string, alpha: number) => {
  try {
    const a = Math.round(clamp(alpha) * 255).toString(16).padStart(2, "0");
    let h = hex?.replace("#", "");
    if (!h) return hex;
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    return `#${h}${a}`;
  } catch { return hex; }
};
const cardShadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 8 },
});
const tileShadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 4 },
});
const shape246 = {
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  borderBottomRightRadius: 24,
  borderBottomLeftRadius: 24,
};

const PressableScale: React.FC<{
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  children?: React.ReactNode;
}> = ({ onPress, disabled, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, bounciness: 6, speed: 20 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 6, speed: 20 }).start();
  return (
    <Pressable
      onPress={!disabled ? onPress : undefined}
      onPressIn={!disabled ? onIn : undefined}
      onPressOut={!disabled ? onOut : undefined}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      style={({ pressed }) => [style, pressed && Platform.OS === "ios" && { opacity: 0.96 }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
};

const RecurrenteDetail = () => {
  const colors = useThemeColors();
  const route = useRoute<RecurrenteDetailRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [recurrente, setRecurrente] = useState(route.params.recurrente);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Refs para prevención de memory leaks
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastOperationTimeRef = useRef<number>(0);

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('🧹 [RecurrenteDetail] Limpiando componente...');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const descripcionFrecuencia = useMemo(
    () => obtenerDescripcionFrecuencia(recurrente.frecuenciaTipo, recurrente.frecuenciaValor),
    [recurrente.frecuenciaTipo, recurrente.frecuenciaValor]
  );
  const proximaEjecucionFormateada = useMemo(
    () => formatearFechaLocal(recurrente.proximaEjecucion),
    [recurrente.proximaEjecucion]
  );

  const tipoAfectacion = useMemo(() => {
    if (recurrente.afectaCuentaPrincipal) return "Sí afecta (principal)";
    if (recurrente.afectaSubcuenta) return "Afecta subcuenta";
    return "No afecta";
  }, [recurrente.afectaCuentaPrincipal, recurrente.afectaSubcuenta]);

  const diasRestantes = useMemo(
    () => daysUntil(recurrente.proximaEjecucion, recurrente.frecuenciaTipo, recurrente.frecuenciaValor),
    [recurrente.proximaEjecucion, recurrente.frecuenciaTipo, recurrente.frecuenciaValor]
  );
  const ciclo = useMemo(
    () => estimatedCycleDays(recurrente.frecuenciaTipo, recurrente.frecuenciaValor),
    [recurrente.frecuenciaTipo, recurrente.frecuenciaValor]
  );
  const progreso = useMemo(() => clamp(1 - diasRestantes / ciclo), [diasRestantes, ciclo]);
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progreso, duration: 650, useNativeDriver: false }).start();
  }, [progreso]);

  const formatCurrency = useCallback((amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }, []);
  const showToast = useCallback((type: "success" | "error", text1: string, text2?: string) => {
    Toast.show({ type, text1, text2 });
  }, []);
  const navigateBackWithRecurrentesRefresh = useCallback(() => {
    emitRecurrentesChanged();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Dashboard", { updated: false } as any);
    }
  }, [navigation]);

  const toggleEstadoRecurrente = useCallback(async () => {
    // Crear un AbortController local para esta operación sin abortar peticiones previas
    const controller = new AbortController();
    const signal = controller.signal;

    if (!isMountedRef.current) return;

    // Mostrar estado de actualización (sin bloquear llamadas repetidas)
    setIsUpdating(true);

    try {
      const token = await authService.getAccessToken();
      if (!token) { 
        if (isMountedRef.current) {
          showToast("error", "Error de autenticación", "No se encontró token de sesión"); 
        }
        return; 
      }

      const endpoint = `${API_BASE_URL}/recurrentes/${recurrente.recurrenteId}/${recurrente.pausado ? "reanudar" : "pausar"}`;

      // Enviar la petición; permitimos que múltiples toggles se envíen sin cancelar previos
      const res = await apiRateLimiter.fetch(endpoint, { 
        method: "PUT", 
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error al actualizar estado");

      if (isMountedRef.current && !signal.aborted) {
        // Actualizar estado local inmediatamente
        setRecurrente(prev => ({ ...prev, pausado: !prev.pausado }));
        showToast("success", `Recurrente ${!recurrente.pausado ? "pausado" : "reanudado"} exitosamente`);
        // Emitir actualización dirigida para que el dashboard refresque la lista
        emitRecurrentesChanged();
      }
    } catch (e: any) {
      // Ignorar errores de abort
      if (e.name === 'AbortError') {
        console.log('🔄 [RecurrenteDetail] Toggle cancelado');
        return;
      }
      console.error(e);
      if (isMountedRef.current) {
        const errorMsg = e.message?.includes('Rate limit') || e.message?.includes('429') || e.message?.includes('Too Many')
          ? '⚠️ Demasiadas operaciones. Espera un momento e intenta de nuevo'
          : 'No se pudo actualizar el recurrente';
        showToast("error", errorMsg);
      }
    } finally { 
      if (isMountedRef.current) {
        setIsUpdating(false); 
      }
    }
  }, [recurrente.pausado, recurrente.recurrenteId, showToast]);

  const handleDelete = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    // Crear nuevo AbortController para esta operación
    const controller = new AbortController();
    const signal = controller.signal;
    
    try {
      const token = await authService.getAccessToken();
      if (!token) { 
        if (isMountedRef.current) {
          showToast("error", "Error de autenticación"); 
        }
        return; 
      }
      
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/recurrentes/${recurrente.recurrenteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` , 'X-Skip-Cache': '1'},
        signal,
      });

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('🗑️ [RecurrenteDetail] Delete cancelado');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        const statusCode = data?.statusCode ?? res.status;
        const message = data?.message || `Error ${res.status}`;
        const error: any = new Error(message);
        error.statusCode = statusCode;
        throw error;
      }
      
      if (isMountedRef.current && !signal.aborted) {
        showToast("success", "Recurrente eliminado");
        setDeleteVisible(false);
        navigateBackWithRecurrentesRefresh();
      }
    } catch (e: any) {
      // Ignorar errores de abort
      if (e.name === 'AbortError' || signal.aborted) {
        console.log('🗑️ [RecurrenteDetail] Delete cancelado');
        return;
      }
      console.error(e);
      if (isMountedRef.current) {
        showToast("error", "No se pudo eliminar");
      }
    }
  }, [recurrente.recurrenteId, showToast]);

  const handleModalSubmit = useCallback((data: any) => {
    setRecurrente(prev => ({ ...prev, ...data }));
    setModalVisible(false);
    showToast("success", "Recurrente actualizado");
    navigateBackWithRecurrentesRefresh();
  }, [showToast, navigateBackWithRecurrentesRefresh]);

  const getPlatformColor = () => {
    const c = recurrente.plataforma?.color;
    if (c) return c;
    const name = (recurrente.plataforma?.nombre || "").toLowerCase();
    const map: Record<string, string> = {
      netflix: "#E50914", spotify: "#1DB954", amazon: "#FF9900", hbo: "#5A2D82", disney: "#113CCF",
      youtube: "#FF0000", apple: "#A2AAAD", claro: "#E60000", izzi: "#FF7F00", telmex: "#0072CE",
      starplus: "#FF4F12", prime: "#00A8E1", totalplay: "#E6007A", blim: "#2D2D2D",
    };
    return map[name] || "#0EA5E9";
  };
  const theme = {
    platform: getPlatformColor(),
  };

  const progressW = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width - 48],
    extrapolate: "clamp",
  });

  const StatusPill = () => (
    <View style={[styles.statusPill, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
      <Ionicons name={recurrente.pausado ? "pause" : "checkmark-circle"} size={14} color={recurrente.pausado ? "#A16207" : "#2563EB"} />
      <Text style={[styles.statusPillText, { color: recurrente.pausado ? "#A16207" : "#2563EB" }]}>
        {recurrente.pausado ? "En pausa" : "Activa"}
      </Text>
    </View>
  );

  const ActionTile: React.FC<{ icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean; disabled?: boolean; }> =
    ({ icon, onPress, danger, disabled }) => (
      <PressableScale onPress={onPress} disabled={disabled} style={[styles.tile, danger && styles.tileDanger, { backgroundColor: danger ? colors.card : colors.card, borderColor: danger ? "#FECACA" : colors.border, shadowColor: colors.shadow }]}>
        <View style={[styles.tileIconWrap, danger && styles.tileIconDanger, { backgroundColor: danger ? "#FFF1F2" : colors.inputBackground, borderColor: danger ? "#FECACA" : colors.border }]}>
          <Ionicons name={icon} size={20} color={danger ? "#DC2626" : colors.text} />
        </View>
      </PressableScale>
    );

  const Chip: React.FC<{ color?: string; icon?: keyof typeof Ionicons.glyphMap; label: string }> = ({ color = theme.platform, icon, label }) => (
    <View style={[styles.chip, { borderColor: withAlpha(color, 0.28), backgroundColor: withAlpha(color, 0.06) }]}>
      {icon && <Ionicons name={icon} size={13} color={color} style={{ marginRight: 6 }} />}
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <PressableScale onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </PressableScale>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{recurrente.plataforma?.nombre || "Recurrente"}</Text>
            <StatusPill />
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
          <View
            style={[
              styles.bigCard,
              shape246,
              { borderColor: colors.border, backgroundColor: colors.card, shadowColor: colors.shadow },
            ]}
          >
            <Text style={[styles.bigCardCaption, { color: colors.textSecondary }]}>Monto programado</Text>

            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center" }}>
              <Text style={[styles.amount, { color: colors.text }]}> 
                {formatCurrency(
                  recurrente.monto,
                  recurrente.monedas || recurrente.moneda || "MXN"
                )}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
              <View style={[styles.dot, { backgroundColor: theme.platform }]} />
              <Text style={[styles.identText, { color: colors.textSecondary }]}>Color de identificación</Text>
            </View>

            <View style={{ marginTop: 14 }}>
              <View style={styles.progressRow}>
                <Ionicons name="time-outline" size={16} color={theme.platform} />
                <Text style={[styles.progressText, { color: theme.platform }]}>
                  {diasRestantes === 0 ? "Se ejecuta hoy" : `En ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}`}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.inputBackground }]}>
                <Animated.View style={[styles.progressFill, { width: progressW, backgroundColor: theme.platform }]} />
              </View>
            </View>
          </View>

          <View style={styles.tilesRow}>
            <ActionTile icon="create-outline" onPress={() => setModalVisible(true)} />
            <ActionTile
              icon={recurrente.pausado ? "play" : "pause"}
              onPress={toggleEstadoRecurrente}
              disabled={isUpdating}
            />
            <ActionTile icon="trash-outline" onPress={() => setDeleteVisible(true)} danger />
          </View>

          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={28} color={colors.border} />
            {(!recurrente.recordatorios || recurrente.recordatorios.length === 0) ? (
              <>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin recordatorios</Text>
                <Text style={[styles.emptyText, { color: colors.placeholder }]}>No hay recordatorios configurados para este recurrente.</Text>
              </>
            ) : (
              <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {recurrente.recordatorios.map((d, i) => (
                  <Chip key={`${d}-${i}`} icon="alarm-outline" label={d === 1 ? "1 día antes" : `${d} días antes`} />
                ))}
              </View>
            )}
          </View>

          <View style={styles.bottomGrid}>
            <View style={[styles.smallCard, shape246, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.smallIconBox}>
                <Ionicons name="trending-up-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={[styles.smallTitle, { color: colors.textSecondary }]}>Impacto en cuenta</Text>
              <Text style={[styles.smallValue, { color: colors.text }]}>{tipoAfectacion}</Text>
              <Text style={[styles.smallHint, { color: colors.placeholder }]}>
                {recurrente.afectaCuentaPrincipal
                  ? "Modifica el saldo principal"
                  : recurrente.afectaSubcuenta
                  ? "Afecta una subcuenta"
                  : "No impacta saldos"}
              </Text>
            </View>

            <View style={[styles.smallCard, shape246, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={[styles.smallIconBox, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                <Ionicons name="finger-print-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={[styles.smallTitle, { color: colors.textSecondary }]}>ID Recurrente</Text>
              <Text style={[styles.smallValue, { color: colors.text }]} numberOfLines={1}>
                {recurrente.recurrenteId}
              </Text>
              <Text style={[styles.smallHint, { color: colors.placeholder }]}>Identificador único</Text>
            </View>
          </View>

          <View style={[styles.infoBlock, shape246, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={styles.infoLine}>
              <Ionicons name="repeat" size={18} color={theme.platform} />
              <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Frecuencia</Text>
              <Text style={[styles.infoVal, { color: colors.text }]} numberOfLines={1}>{descripcionFrecuencia}</Text>
            </View>
            <View style={styles.infoLine}>
              <Ionicons name="calendar" size={18} color={theme.platform} />
              <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Próxima ejecución</Text>
              <Text style={[styles.infoVal, { color: colors.text }]} numberOfLines={1}>{proximaEjecucionFormateada}</Text>
            </View>
            {!!recurrente.plataforma?.categoria && (
              <View style={styles.infoLine}>
                <Ionicons name="layers-outline" size={18} color={theme.platform} />
                <Text style={[styles.infoKey, { color: colors.textSecondary }]}>Categoría</Text>
                <Text style={[styles.infoVal, { color: colors.text }]} numberOfLines={1}>{recurrente.plataforma.categoria}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Modales */}
        <DeleteModal
          visible={deleteVisible}
          onCancel={() => setDeleteVisible(false)}
          onConfirm={handleDelete}
          title="Eliminar recurrente"
          message="¿Estás seguro de que deseas eliminar este recurrente? Esta acción no se puede deshacer."
        />
        {modalVisible && (
          <RecurrentModal
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            onSubmit={handleModalSubmit}
            cuentaId={recurrente.cuentaId || "0000000"}
            userId={recurrente.userId || "0000000"}
            plataformas={recurrente.plataforma ? [recurrente.plataforma] : []}
            recurrenteExistente={recurrente}
          />
        )}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 44, height: 44,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    borderRadius: 16,
    ...tileShadow,
  },
  title: { fontSize: 18, fontWeight: "800", paddingTop: 10 },
  statusPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
  },
  statusPillText: { fontSize: 12, fontWeight: "700" },

  bigCard: {
    padding: 18,
    borderWidth: 1,
    ...cardShadow,
  },
  bigCardCaption: { textAlign: "center", fontSize: 13, fontWeight: "700" },
  amount: { fontSize: 40, fontWeight: "900", letterSpacing: -0.6, marginTop: 6 },
  currency: { fontSize: 14, marginLeft: 8, marginBottom: 6, fontWeight: "700" },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  identText: { fontSize: 13, fontWeight: "600" },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 6 },
  progressText: { fontSize: 13, fontWeight: "700" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },

  tilesRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, gap: 12 },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
    ...tileShadow,
    ...shape246,
  },
  tileDanger: {
    borderColor: "#FECACA",
  },
  tileIconWrap: {
    width: 44, height: 44,
    borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  tileIconDanger: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECACA",
  },
  tileLabel: { fontSize: 12, fontWeight: "800" },

  emptyWrap: { alignItems: "center", paddingVertical: 18, paddingHorizontal: 12 },
  emptyTitle: { marginTop: 8, fontSize: 16, fontWeight: "800" },
  emptyText: { marginTop: 4, fontSize: 13, textAlign: "center" },

  bottomGrid: { flexDirection: "row", gap: 12, marginTop: 6 },
  smallCard: {
    flex: 1,
    borderWidth: 1,
    padding: 14,
    ...tileShadow,
  },
  smallIconBox: {
    width: 34, height: 34,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1, borderColor: "#FDE68A",
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
  },
  smallTitle: { fontSize: 12, fontWeight: "800" },
  smallValue: { fontSize: 16, fontWeight: "900", marginTop: 2 },
  smallHint: { fontSize: 12, marginTop: 2 },

  infoBlock: {
    marginTop: 12,
    borderWidth: 1,
    padding: 14,
    ...tileShadow,
  },
  infoLine: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 6 },
  infoKey: { fontSize: 13, fontWeight: "800", width: 140 },
  infoVal: { flex: 1, fontSize: 14, fontWeight: "700" },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "800" },
});

export default RecurrenteDetail;
