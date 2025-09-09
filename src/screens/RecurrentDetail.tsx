import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet, StatusBar, Dimensions, Animated, Pressable, Platform, SafeAreaView, ScrollView } from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import RecurrentModal from "../components/RecurrentModal";
import { API_BASE_URL } from "../constants/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import DeleteModal from "../components/DeleteModal";

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
  borderBottomLeftRadius: 6,
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

/* =========================
   Componente principal
========================= */
const RecurrenteDetail = () => {
  const route = useRoute<RecurrenteDetailRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [recurrente, setRecurrente] = useState(route.params.recurrente);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const formatCurrency = useCallback((amount: number, currency: string = "MXN") => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
  }, []);
  const showToast = useCallback((type: "success" | "error", text1: string, text2?: string) => {
    Toast.show({ type, text1, text2 });
  }, []);
  const navigateToDashboard = useCallback(() => navigation.navigate("Dashboard", { updated: true }), [navigation]);

  const toggleEstadoRecurrente = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) { showToast("error", "Error de autenticación", "No se encontró token de sesión"); return; }
      const endpoint = `${API_BASE_URL}/recurrentes/${recurrente.recurrenteId}/${recurrente.pausado ? "reanudar" : "pausar"}`;
      const res = await fetch(endpoint, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Error al actualizar estado");
      setRecurrente(prev => ({ ...prev, pausado: !prev.pausado }));
      showToast("success", `Recurrente ${!recurrente.pausado ? "pausado" : "reanudado"} exitosamente`);
      navigateToDashboard();
    } catch (e) {
      console.error(e);
      showToast("error", "No se pudo actualizar el recurrente");
    } finally { setIsUpdating(false); }
  }, [isUpdating, recurrente.pausado, recurrente.recurrenteId, navigateToDashboard, showToast]);

  const handleDelete = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) { showToast("error", "Error de autenticación"); return; }
      const res = await fetch(`${API_BASE_URL}/recurrentes/${recurrente.recurrenteId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al eliminar");
      showToast("success", "Recurrente eliminado");
      setDeleteVisible(false);
      navigateToDashboard();
    } catch (e) {
      console.error(e);
      showToast("error", "No se pudo eliminar");
    }
  }, [recurrente.recurrenteId, navigateToDashboard, showToast]);

  const handleModalSubmit = useCallback((data: any) => {
    setRecurrente(data);
    setModalVisible(false);
    showToast("success", "Recurrente actualizado");
  }, [showToast]);

  // Colores basados en plataforma
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
    bg: "#F6F7FB",
    text: "#0F172A",
    sub: "#64748B",
    cardBorder: "#EDEFF5",
    platform: getPlatformColor(),
  };

  // progreso ancho
  const progressW = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width - 48],
    extrapolate: "clamp",
  });

  // UI auxiliares
  const StatusPill = () => (
    <View style={[styles.statusPill, { borderColor: "#F9DFA9", backgroundColor: "#FFF7E6" }]}>
      <Ionicons name={recurrente.pausado ? "pause" : "checkmark-circle"} size={14} color={recurrente.pausado ? "#A16207" : "#2563EB"} />
      <Text style={[styles.statusPillText, { color: recurrente.pausado ? "#A16207" : "#2563EB" }]}>
        {recurrente.pausado ? "En pausa" : "Activa"}
      </Text>
    </View>
  );

  const ActionTile: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; disabled?: boolean; }> =
    ({ icon, label, onPress, danger, disabled }) => (
      <PressableScale onPress={onPress} disabled={disabled} style={[styles.tile, danger && styles.tileDanger]}>
        <View style={[styles.tileIconWrap, danger && styles.tileIconDanger]}>
          <Ionicons name={icon} size={20} color={danger ? "#DC2626" : theme.text} />
        </View>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </PressableScale>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.title} numberOfLines={1}>{recurrente.plataforma?.nombre || "Recurrente"}</Text>
            <StatusPill />
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
          {/* Tarjeta principal (estilo neumorphism claro) */}
          <View
            style={[
              styles.bigCard,
              shape246,
              { borderColor: theme.cardBorder, backgroundColor: "#fff" },
            ]}
          >
            <Text style={styles.bigCardCaption}>Monto programado</Text>

            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center" }}>
              <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(recurrente.monto)}</Text>
              <Text style={styles.currency}> MXN</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
              <View style={[styles.dot, { backgroundColor: theme.platform }]} />
              <Text style={[styles.identText, { color: theme.sub }]}>Color de identificación</Text>
            </View>

            {/* Progreso hacia próxima ejecución */}
            <View style={{ marginTop: 14 }}>
              <View style={styles.progressRow}>
                <Ionicons name="time-outline" size={16} color={theme.platform} />
                <Text style={[styles.progressText, { color: theme.platform }]}>
                  {diasRestantes === 0 ? "Se ejecuta hoy" : `En ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}`}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: progressW, backgroundColor: theme.platform }]} />
              </View>
            </View>
          </View>

          {/* Acciones (3 tiles como en el mock) */}
          <View style={styles.tilesRow}>
            <ActionTile icon="create-outline" label="Editar" onPress={() => setModalVisible(true)} />
            <ActionTile
              icon={recurrente.pausado ? "play" : "pause"}
              label={recurrente.pausado ? "Reanudar" : "Pausar"}
              onPress={toggleEstadoRecurrente}
              disabled={isUpdating}
            />
            <ActionTile icon="trash-outline" label="Eliminar" onPress={() => setDeleteVisible(true)} danger />
          </View>

          {/* Info “sin recordatorios” / lista de recordatorios */}
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={28} color="#94A3B8" />
            {(!recurrente.recordatorios || recurrente.recordatorios.length === 0) ? (
              <>
                <Text style={styles.emptyTitle}>Sin recordatorios</Text>
                <Text style={styles.emptyText}>No hay recordatorios configurados para este recurrente.</Text>
              </>
            ) : (
              <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {recurrente.recordatorios.map((d, i) => (
                  <Chip key={`${d}-${i}`} icon="alarm-outline" label={d === 1 ? "1 día antes" : `${d} días antes`} />
                ))}
              </View>
            )}
          </View>

          {/* Mini tarjetas inferiores (2 columnas) */}
          <View style={styles.bottomGrid}>
            <View style={[styles.smallCard, shape246]}>
              <View style={styles.smallIconBox}>
                <Ionicons name="trending-up-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.smallTitle}>Impacto en cuenta</Text>
              <Text style={[styles.smallValue, { color: "#111827" }]}>{tipoAfectacion}</Text>
              <Text style={styles.smallHint}>
                {recurrente.afectaCuentaPrincipal
                  ? "Modifica el saldo principal"
                  : recurrente.afectaSubcuenta
                  ? "Afecta una subcuenta"
                  : "No impacta saldos"}
              </Text>
            </View>

            <View style={[styles.smallCard, shape246]}>
              <View style={[styles.smallIconBox, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                <Ionicons name="finger-print-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.smallTitle}>ID Recurrente</Text>
              <Text style={[styles.smallValue, { color: "#111827" }]} numberOfLines={1}>
                {recurrente.recurrenteId}
              </Text>
              <Text style={styles.smallHint}>Identificador único</Text>
            </View>
          </View>

          {/* Frecuencia / próxima ejecución / plataforma */}
          <View style={[styles.infoBlock, shape246]}>
            <View style={styles.infoLine}>
              <Ionicons name="repeat" size={18} color={theme.platform} />
              <Text style={styles.infoKey}>Frecuencia</Text>
              <Text style={styles.infoVal} numberOfLines={1}>{descripcionFrecuencia}</Text>
            </View>
            <View style={styles.infoLine}>
              <Ionicons name="calendar" size={18} color={theme.platform} />
              <Text style={styles.infoKey}>Próxima ejecución</Text>
              <Text style={styles.infoVal} numberOfLines={1}>{proximaEjecucionFormateada}</Text>
            </View>
            {!!recurrente.plataforma?.categoria && (
              <View style={styles.infoLine}>
                <Ionicons name="layers-outline" size={18} color={theme.platform} />
                <Text style={styles.infoKey}>Categoría</Text>
                <Text style={styles.infoVal} numberOfLines={1}>{recurrente.plataforma.categoria}</Text>
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: "#ECEEF4",
    borderRadius: 16,
    ...tileShadow,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#0F172A", paddingTop: 10 },
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
    backgroundColor: "#FFF7E6",
  },
  statusPillText: { fontSize: 12, fontWeight: "700" },

  bigCard: {
    padding: 18,
    borderWidth: 1,
    ...cardShadow,
  },
  bigCardCaption: { textAlign: "center", color: "#64748B", fontSize: 13, fontWeight: "700" },
  amount: { fontSize: 40, fontWeight: "900", letterSpacing: -0.6, marginTop: 6 },
  currency: { fontSize: 14, color: "#64748B", marginLeft: 8, marginBottom: 6, fontWeight: "700" },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  identText: { fontSize: 13, fontWeight: "600" },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 6 },
  progressText: { fontSize: 13, fontWeight: "700" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#EDF2F7",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#38BDF8" },

  tilesRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, gap: 12 },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEF4",
    ...tileShadow,
    ...shape246,
  },
  tileDanger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  tileIconWrap: {
    width: 44, height: 44,
    borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1, borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  tileIconDanger: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECACA",
  },
  tileLabel: { fontSize: 12, fontWeight: "800", color: "#111827" },

  emptyWrap: { alignItems: "center", paddingVertical: 18, paddingHorizontal: 12 },
  emptyTitle: { marginTop: 8, fontSize: 16, fontWeight: "800", color: "#0F172A" },
  emptyText: { marginTop: 4, fontSize: 13, color: "#94A3B8", textAlign: "center" },

  bottomGrid: { flexDirection: "row", gap: 12, marginTop: 6 },
  smallCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEF4",
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
  smallTitle: { fontSize: 12, fontWeight: "800", color: "#6B7280" },
  smallValue: { fontSize: 16, fontWeight: "900", marginTop: 2 },
  smallHint: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  infoBlock: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEF4",
    padding: 14,
    ...tileShadow,
  },
  infoLine: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 6 },
  infoKey: { fontSize: 13, fontWeight: "800", color: "#6B7280", width: 140 },
  infoVal: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0F172A" },

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
