import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Animated,
  Pressable,
  Platform,
  ActivityIndicator,
  LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { StackNavigationProp } from "@react-navigation/stack";

import RecurrentModal from "../components/RecurrentModal";
import DeleteModal from "../components/DeleteModal";

import { API_BASE_URL } from "../constants/api";
import { authService } from "../services/authService";
import apiRateLimiter from "../services/apiRateLimiter";
import { emitRecurrentesChanged } from "../utils/dashboardRefreshBus";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useThemeColors } from "../theme/useThemeColors";
import { fixEncoding } from "../utils/fixEncoding";
import {
  daysUntil,
  estimatedCycleDays,
  describeFrequencyLong,
  progressFractionFromDays,
} from "../utils/recurrentUtils";
import { jwtDecode } from "../utils/jwtDecode";

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
        estado?: "completado" | "activo" | "pausado" | "error" | string;
        tipoRecurrente?: "plazo_fijo" | "continuo" | "indefinido" | string;
        pagosRealizados?: number;
        totalPagos?: number;
        fechaFin?: string;
        pausadoPorPlan?: boolean;
      };
    };
  },
  "RecurrenteDetail"
>;

const SP = 16;
const R = 18;

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

const withAlpha = (hex: string, alpha: number) => {
  try {
    const a = Math.round(clamp(alpha) * 255).toString(16).padStart(2, "0");
    let h = hex?.replace("#", "");
    if (!h) return hex;
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return `#${h}${a}`;
  } catch {
    return hex;
  }
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  android: { elevation: 8 },
});

const tileShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 4 },
});

const PressableScale: React.FC<{
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  children?: React.ReactNode;
}> = ({ onPress, disabled, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onIn = () =>
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      bounciness: 6,
      speed: 20,
    }).start();

  const onOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 6,
      speed: 20,
    }).start();

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

const formatearFechaLocal = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Fecha no válida";
    // Use UTC components to avoid timezone-shift for midnight UTC dates
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
    return utc.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "Fecha no válida";
  }
};

const isValidIsoDate = (iso?: string | null) => {
  if (!iso) return false;
  try {
    const d = new Date(String(iso));
    return !Number.isNaN(d.getTime());
  } catch {
    return false;
  }
};

const RecurrenteDetail = () => {
  const colors = useThemeColors();
  const route = useRoute<RecurrenteDetailRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const [recurrente, setRecurrente] = useState(route.params.recurrente);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isMountedRef = useRef(true);
  const requestsRef = useRef<Record<string, AbortController | null>>({ toggle: null, del: null });

  // Animations
  const intro = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const warning = "#F59E0B";
  const success = "#10B981";
  const danger = "#EF4444";
  const primaryBlue = "#2563EB";
  const cardSecondary = (colors as any).cardSecondary ?? colors.card;

  useEffect(() => {
    isMountedRef.current = true;

    if (Platform.OS === "android" && (LayoutAnimation as any).configureNext) {
      // enable layout animation if needed (Expo usually ok)
    }

    Animated.timing(intro, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();

    return () => {
      isMountedRef.current = false;
      Object.values(requestsRef.current).forEach((c) => {
        try {
          c?.abort();
        } catch {}
      });
    };
  }, [intro]);

  const startRequest = useCallback((key: "toggle" | "del") => {
    try {
      requestsRef.current[key]?.abort();
    } catch {}
    const c = new AbortController();
    requestsRef.current[key] = c;
    return c;
  }, []);

  const descripcionFrecuencia = useMemo(
    () => describeFrequencyLong(recurrente.frecuenciaTipo, recurrente.frecuenciaValor),
    [recurrente.frecuenciaTipo, recurrente.frecuenciaValor]
  );

  const proximaEjecucionFormateada = useMemo(() => {
    if (!isValidIsoDate(recurrente.proximaEjecucion)) return "Sin fecha";
    return formatearFechaLocal(recurrente.proximaEjecucion);
  }, [recurrente.proximaEjecucion]);

  const tipoAfectacion = useMemo(() => {
    if (recurrente.afectaCuentaPrincipal) return "Sí afecta (principal)";
    if (recurrente.afectaSubcuenta) return "Afecta subcuenta";
    return "No afecta";
  }, [recurrente.afectaCuentaPrincipal, recurrente.afectaSubcuenta]);

  const diasRestantes = useMemo(() => {
    if (!isValidIsoDate(recurrente.proximaEjecucion)) return null;
    return daysUntil(recurrente.proximaEjecucion, recurrente.frecuenciaTipo, recurrente.frecuenciaValor);
  }, [recurrente.proximaEjecucion, recurrente.frecuenciaTipo, recurrente.frecuenciaValor]);

  const ciclo = useMemo(
    () => estimatedCycleDays(recurrente.frecuenciaTipo, recurrente.frecuenciaValor),
    [recurrente.frecuenciaTipo, recurrente.frecuenciaValor]
  );

  const progreso = useMemo(() => {
    if (diasRestantes === null) return 0;
    return progressFractionFromDays(diasRestantes, ciclo);
  }, [diasRestantes, ciclo]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progreso,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [progreso, progressAnim]);

  const progressW = useMemo(() => {
    return progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, Math.max(0, width - (SP * 2 + 22))],
      extrapolate: "clamp",
    });
  }, [progressAnim]);

  const formatCurrency = useCallback((amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }, []);

  const getPlatformColor = useCallback(() => {
    const c = recurrente.plataforma?.color;
    if (c) return c;

    const name = (recurrente.plataforma?.nombre || "").toLowerCase();
    const map: Record<string, string> = {
      netflix: "#E50914",
      spotify: "#1DB954",
      amazon: "#FF9900",
      hbo: "#5A2D82",
      disney: "#113CCF",
      youtube: "#FF0000",
      apple: "#A2AAAD",
      claro: "#E60000",
      izzi: "#FF7F00",
      telmex: "#0072CE",
      starplus: "#FF4F12",
      prime: "#00A8E1",
      totalplay: "#E6007A",
      blim: "#2D2D2D",
    };
    return map[name] || "#0EA5E9";
  }, [recurrente.plataforma?.color, recurrente.plataforma?.nombre]);

  const theme = useMemo(() => ({ platform: getPlatformColor() }), [getPlatformColor]);

  const esCompletado = useMemo(() => {
    // Estado explícito desde la API tiene prioridad
    if (recurrente.estado === "completado") return true;
    // Si es plazo fijo y se alcanzaron los pagos, considerarlo completado
    if (
      recurrente.tipoRecurrente === "plazo_fijo" &&
      recurrente.totalPagos !== undefined &&
      (recurrente.pagosRealizados || 0) >= (recurrente.totalPagos || 0) &&
      (recurrente.totalPagos || 0) > 0
    )
      return true;

    return false;
  }, [recurrente.estado, recurrente.tipoRecurrente, recurrente.pagosRealizados, recurrente.totalPagos]);

  const status = useMemo(() => {
    if (esCompletado) return { label: "Completado", icon: "checkmark-circle" as const, color: success, bg: withAlpha(success, 0.10) };
    // Mapear estado provisto por la API
    switch (recurrente.estado) {
      case "pausado":
        return { label: "En pausa", icon: "pause-circle" as const, color: warning, bg: withAlpha(warning, 0.10) };
      case "error":
        return { label: "Error", icon: "alert-circle" as const, color: danger, bg: withAlpha(danger, 0.10) };
      case "activo":
      default:
        if (recurrente.pausado) return { label: "En pausa", icon: "pause-circle" as const, color: warning, bg: withAlpha(warning, 0.10) };
        return { label: "Activo", icon: "checkmark-circle-outline" as const, color: primaryBlue, bg: withAlpha(primaryBlue, 0.10) };
    }
  }, [esCompletado, recurrente.estado, recurrente.pausado]);

  const headerShadowOpacity = useMemo(() => {
    return scrollY.interpolate({
      inputRange: [0, 24, 120],
      outputRange: [0, 0.06, 0.12],
      extrapolate: "clamp",
    });
  }, [scrollY]);

  const introStyle = useMemo(() => {
    const opacity = intro.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const translateY = intro.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
    return { opacity, transform: [{ translateY }] };
  }, [intro]);

  const showToast = useCallback((type: "success" | "error" | "info", text1: string, text2?: string) => {
    Toast.show({ type, text1: fixEncoding(text1), text2: text2 ? fixEncoding(text2) : undefined });
  }, []);

  const navigateBackWithRecurrentesRefresh = useCallback(() => {
    emitRecurrentesChanged();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Dashboard", { updated: false } as any);
  }, [navigation]);

  const toggleEstadoRecurrente = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isUpdating) return;

    if (recurrente.pausadoPorPlan) {
      showToast(
        "info",
        "🔒 Pausado automáticamente",
        "Este recurrente fue pausado por el sistema. Actualiza a Premium para reactivarlo."
      );
      return;
    }

    setIsUpdating(true);
    const controller = startRequest("toggle");

    try {
      const token = await authService.getAccessToken();
      if (!token) {
        showToast("error", "Error de autenticación", "No se encontró token de sesión");
        return;
      }

      const endpoint = `${API_BASE_URL}/recurrentes/${recurrente.recurrenteId}/${recurrente.pausado ? "reanudar" : "pausar"}`;

      // Try with a couple of silent retries on rate-limit to avoid showing a noisy toast
      const maxRetries = 2;
      let attempt = 0;
      let lastErr: any = null;
      while (attempt <= maxRetries) {
        const attemptController = startRequest(`toggle`);
        try {
          const tkn = await authService.getAccessToken();
          const res = await apiRateLimiter.fetch(endpoint, {
            method: "PUT",
            headers: { Authorization: `Bearer ${tkn || token}` },
            signal: attemptController.signal,
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || "Error al actualizar estado");
          if (attemptController.signal.aborted) return;

          if (isMountedRef.current) {
            // Apply any returned fields from the API to keep UI in sync (nextRun, recordatorios, estado, pagos)
            const updates: any = {};
            if (data?.nextRun) updates.proximaEjecucion = data.nextRun;
            if (data?.proximaEjecucion) updates.proximaEjecucion = data.proximaEjecucion;
            if (Array.isArray(data?.recordatorios)) updates.recordatorios = data.recordatorios;
            if (data?.recordatorios && !Array.isArray(data.recordatorios) && typeof data.recordatorios === 'string') {
              try {
                updates.recordatorios = data.recordatorios.split(',').map((s: string) => Number(s.trim())).filter((n: number) => Number.isFinite(n));
              } catch {
                // ignore
              }
            }
            if (typeof data?.pausado === 'boolean') updates.pausado = data.pausado;
            else updates.pausado = !recurrente.pausado;
            if (data?.estado) updates.estado = data.estado;
            if (typeof data?.pagosRealizados === 'number') updates.pagosRealizados = data.pagosRealizados;
            if (typeof data?.totalPagos === 'number') updates.totalPagos = data.totalPagos;

            setRecurrente((prev) => ({ ...prev, ...updates }));
            // Invalidate dashboard caches and request a fresh snapshot
            try {
              // Best-effort: clear cached snapshot for current user so dashboard will refetch fresh
              const tok = await authService.getAccessToken();
              if (tok) {
                try {
                  const decoded: any = jwtDecode(tok as any);
                  const uid = decoded?.userId;
                  if (uid) {
                    // Defaults: range 'month' and recentLimit 15 match Dashboard defaults
                    // ignore errors
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const ds = await import('../services/dashboardSnapshotService');
                    try {
                      await ds.clearCachedDashboardSnapshot({ userId: uid, range: 'month', recentLimit: 15 });
                    } catch {}
                  }
                } catch {}
              }
            } catch {}

            emitRecurrentesChanged();
            showToast("success", !updates.pausado ? "Recurrente pausado" : "Recurrente reanudado");
          }

          // success -> break retry loop
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
          if (err?.name === 'AbortError') return;

          // Silent backoff before retrying
          const backoffMs = 2000 * attempt; // 2s, 4s
          await new Promise((res) => setTimeout(res, backoffMs));
          // continue loop to retry
        }
      }
    } finally {
      if (isMountedRef.current) setIsUpdating(false);
    }
  }, [
    API_BASE_URL,
    recurrente.pausado,
    recurrente.pausadoPorPlan,
    recurrente.recurrenteId,
    isUpdating,
    showToast,
    startRequest,
  ]);

  const handleDelete = useCallback(async () => {
    if (!isMountedRef.current) return;

    const controller = startRequest("del");

    try {
      const token = await authService.getAccessToken();
      if (!token) {
        showToast("error", "Error de autenticación");
        return;
      }

      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/recurrentes/${recurrente.recurrenteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "X-Skip-Cache": "1" },
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);

      if (isMountedRef.current) {
        showToast("success", "Recurrente eliminado");
        setDeleteVisible(false);
        navigateBackWithRecurrentesRefresh();
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      showToast("error", "No se pudo eliminar");
    }
  }, [API_BASE_URL, recurrente.recurrenteId, showToast, navigateBackWithRecurrentesRefresh, startRequest]);

  const handleModalSubmit = useCallback(
    (data: any) => {
      setRecurrente((prev) => ({ ...prev, ...data }));
      setModalVisible(false);
      showToast("success", "Recurrente actualizado");
      navigateBackWithRecurrentesRefresh();
    },
    [showToast, navigateBackWithRecurrentesRefresh]
  );

  // 🔒 Estabilizar referencia para evitar loops dentro del modal
  const recurrenteForModal = useMemo(
    () => ({
      recurrenteId: recurrente.recurrenteId,
      nombre: recurrente.nombre,
      monto: recurrente.monto,
      frecuenciaTipo: recurrente.frecuenciaTipo,
      frecuenciaValor: recurrente.frecuenciaValor,
      proximaEjecucion: recurrente.proximaEjecucion,
      plataforma: recurrente.plataforma,
      afectaCuentaPrincipal: recurrente.afectaCuentaPrincipal,
      afectaSubcuenta: recurrente.afectaSubcuenta,
      recordatorios: recurrente.recordatorios,
      userId: recurrente.userId,
      cuentaId: recurrente.cuentaId,
      pausado: recurrente.pausado,
      monedas: recurrente.monedas,
      moneda: recurrente.moneda,
      estado: recurrente.estado,
      tipoRecurrente: recurrente.tipoRecurrente,
      pagosRealizados: recurrente.pagosRealizados,
      totalPagos: recurrente.totalPagos,
      pausadoPorPlan: recurrente.pausadoPorPlan,
    }),
    [
      recurrente.recurrenteId,
      recurrente.nombre,
      recurrente.monto,
      recurrente.frecuenciaTipo,
      recurrente.frecuenciaValor,
      recurrente.proximaEjecucion,
      recurrente.plataforma?.nombre,
      recurrente.plataforma?.categoria,
      recurrente.plataforma?.color,
      recurrente.afectaCuentaPrincipal,
      recurrente.afectaSubcuenta,
      recurrente.recordatorios,
      recurrente.userId,
      recurrente.cuentaId,
      recurrente.pausado,
      recurrente.monedas,
      recurrente.moneda,
      recurrente.estado,
      recurrente.tipoRecurrente,
      recurrente.pagosRealizados,
      recurrente.totalPagos,
      recurrente.pausadoPorPlan,
    ]
  );

  const Chip: React.FC<{ color?: string; icon?: any; label: string }> = ({ color = theme.platform, icon, label }) => (
    <View style={[styles.chip, { borderColor: withAlpha(color, 0.25), backgroundColor: withAlpha(color, 0.08) }]}>
      {!!icon && <Ionicons name={icon} size={13} color={color} style={{ marginRight: 6 }} />}
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {fixEncoding(label)}
      </Text>
    </View>
  );

  const InfoTile: React.FC<{
    icon: any;
    label: string;
    value: string;
    accent?: string;
    hint?: string;
  }> = ({ icon, label, value, accent = theme.platform, hint }) => (
    <View style={[styles.infoTile, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={[styles.infoIcon, { backgroundColor: withAlpha(accent, 0.10) }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {fixEncoding(label)}
      </Text>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
        {fixEncoding(value)}
      </Text>
      {!!hint && (
        <Text style={[styles.infoHint, { color: colors.placeholder }]} numberOfLines={2}>
          {fixEncoding(hint)}
        </Text>
      )}
    </View>
  );

  const ActionButton: React.FC<{
    icon: any;
    label: string;
    onPress: () => void;
    accent: string;
    disabled?: boolean;
    loading?: boolean;
  }> = ({ icon, label, onPress, accent, disabled, loading }) => (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionBtn,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(accent, disabled ? 0.25 : 0.4),
          shadowColor: colors.shadow,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <View style={[styles.actionIconBox, { backgroundColor: withAlpha(accent, 0.10) }]}>
        {loading ? <ActivityIndicator size="small" color={accent} /> : <Ionicons name={icon} size={18} color={accent} />}
      </View>
      <Text style={[styles.actionLabel, { color: accent }]} numberOfLines={1}>
        {fixEncoding(label)}
      </Text>
    </PressableScale>
  );

  const moneda = recurrente.monedas || recurrente.moneda || "MXN";

  const payoutHint = useMemo(() => {
    if (recurrente.tipoRecurrente === "plazo_fijo") {
      const done = recurrente.pagosRealizados || 0;
      const total = recurrente.totalPagos || 0;
      return total > 0 ? `${done} de ${total} pagos` : "Pagos definidos";
    }
    return "Sin límite de pagos";
  }, [recurrente.tipoRecurrente, recurrente.pagosRealizados, recurrente.totalPagos]);

  const smallProgress = useMemo(() => {
    if (recurrente.tipoRecurrente !== "plazo_fijo") return 0;
    const total = recurrente.totalPagos || 0;
    if (!total) return 0;
    return clamp((recurrente.pagosRealizados || 0) / total);
  }, [recurrente.tipoRecurrente, recurrente.pagosRealizados, recurrente.totalPagos]);

  const smallProgressW = useMemo(() => {
    return Math.round(smallProgress * 100) / 100;
  }, [smallProgress]);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
              shadowColor: colors.shadow,
              shadowOpacity: headerShadowOpacity as any,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <PressableScale
              onPress={() => navigation.goBack()}
              style={[styles.headerBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </PressableScale>

            <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 10 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {fixEncoding(recurrente.plataforma?.nombre || recurrente.nombre || "Recurrente")}
              </Text>

              <View style={[styles.statusPill, { borderColor: colors.border, backgroundColor: status.bg }]}>
                <Ionicons name={status.icon} size={14} color={status.color} />
                <Text style={[styles.statusText, { color: status.color }]}>{fixEncoding(status.label)}</Text>

                {recurrente.pausadoPorPlan ? (
                  <View style={[styles.lockPill, { backgroundColor: withAlpha(warning, 0.12), borderColor: withAlpha(warning, 0.25) }]}>
                    <Ionicons name="lock-closed" size={12} color={warning} />
                    <Text style={[styles.lockText, { color: warning }]}>Plan</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ width: 44 }} />
          </View>
        </Animated.View>

        <Animated.ScrollView
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: SP, paddingBottom: 28 }}
        >
          <Animated.View style={introStyle}>
            {/* Hero Card */}
            <View
              style={[
                styles.hero,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <View style={styles.heroTopRow}>
                <Chip color={theme.platform} icon="pricetag-outline" label={recurrente.plataforma?.categoria || "Recurrente"} />
                <Chip color={colors.textSecondary} icon="card-outline" label={moneda} />
              </View>

              <Text style={[styles.heroCaption, { color: colors.textSecondary }]}>{fixEncoding("Monto programado")}</Text>
              <Text style={[styles.heroAmount, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(recurrente.monto, moneda)}
              </Text>

              <View style={styles.progressBlock}>
                <View style={styles.progressRow}>
                  <Ionicons name="time-outline" size={16} color={theme.platform} />
                  <Text style={[styles.progressText, { color: theme.platform }]} numberOfLines={1}>
                    {diasRestantes === null
                      ? fixEncoding('Próxima ejecución no disponible')
                      : diasRestantes === 0
                      ? fixEncoding('Se ejecuta hoy')
                      : fixEncoding(`En ${diasRestantes} ${diasRestantes === 1 ? 'día' : 'días'}`)}
                  </Text>
                </View>

                <View style={[styles.progressTrack, { backgroundColor: colors.inputBackground }]}>
                  <Animated.View style={[styles.progressFill, { width: progressW, backgroundColor: theme.platform }]} />
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <ActionButton
                icon="create-outline"
                label="Editar"
                accent={warning}
                disabled={esCompletado}
                onPress={() => setModalVisible(true)}
              />

              <ActionButton
                icon={recurrente.pausado ? "play-circle-outline" : "pause-circle-outline"}
                label={recurrente.pausado ? "Reanudar" : "Pausar"}
                accent={recurrente.pausado ? success : warning}
                disabled={esCompletado || recurrente.pausadoPorPlan}
                loading={isUpdating}
                onPress={toggleEstadoRecurrente}
              />

              <ActionButton
                icon="trash-outline"
                label="Eliminar"
                accent={danger}
                disabled={esCompletado}
                onPress={() => setDeleteVisible(true)}
              />
            </View>

            {/* Recordatorios */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{fixEncoding("Recordatorios")}</Text>
                <Ionicons name="notifications-outline" size={18} color={colors.textSecondary} />
              </View>

              {(() => {
                const recs = Array.isArray(recurrente.recordatorios)
                  ? recurrente.recordatorios.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)
                  : [];
                if (!recs || recs.length === 0) {
                  return (
                    <View style={styles.emptyRow}>
                      <Ionicons name="alarm-outline" size={22} color={colors.border} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>{fixEncoding('Sin recordatorios')}</Text>
                        <Text style={[styles.emptySub, { color: colors.placeholder }]}>{fixEncoding('No hay recordatorios configurados para este recurrente.')}</Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <View style={styles.chipsWrap}>
                    {recs.map((d: number, i: number) => (
                      <Chip key={`${d}-${i}`} icon="alarm-outline" label={d === 1 ? '1 día antes' : `${d} días antes`} />
                    ))}
                  </View>
                );
              })()}
            </View>

            {/* Info grid */}
            <View style={styles.grid}>
              <InfoTile
                icon={recurrente.tipoRecurrente === "plazo_fijo" ? "calendar-number-outline" : "infinite-outline"}
                label="Tipo de pago"
                value={recurrente.tipoRecurrente === "plazo_fijo" ? "Plazo fijo" : "Continuo"}
                accent={primaryBlue}
                hint={payoutHint}
              />

              <InfoTile
                icon="trending-up-outline"
                label="Impacto"
                value={tipoAfectacion}
                accent={warning}
                hint={
                  recurrente.afectaCuentaPrincipal
                    ? "Modifica el saldo principal"
                    : recurrente.afectaSubcuenta
                    ? "Afecta una subcuenta"
                    : "No impacta saldos"
                }
              />

              <InfoTile icon="repeat-outline" label="Frecuencia" value={descripcionFrecuencia} accent={theme.platform} hint="Regla de ejecución" />

              <InfoTile icon="calendar-outline" label="Próxima ejecución" value={proximaEjecucionFormateada} accent={theme.platform} hint="Fecha estimada" />

              {/* Mostrar fecha de término si viene desde la API */}
              {recurrente.fechaFin ? (
                <InfoTile
                  icon="calendar-clear-outline"
                  label="Finaliza"
                  value={formatearFechaLocal(recurrente.fechaFin)}
                  accent={theme.platform}
                  hint="Fecha de finalización"
                />
              ) : null}
            </View>

            {/* Plazo fijo progress */}
            {recurrente.tipoRecurrente === "plazo_fijo" && (recurrente.totalPagos || 0) > 0 ? (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{fixEncoding("Progreso de pagos")}</Text>
                  <Text style={[styles.miniRight, { color: colors.textSecondary }]}>{fixEncoding(payoutHint)}</Text>
                </View>

                <View style={[styles.smallTrack, { backgroundColor: colors.inputBackground }]}>
                  <View
                    style={[
                      styles.smallFill,
                      {
                        width: `${smallProgressW * 100}%`,
                        backgroundColor: esCompletado ? success : warning,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            {/* Footer IDs */}
            <View style={[styles.footer, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.footerRow}>
                <Ionicons name="finger-print-outline" size={18} color={warning} />
                <Text style={[styles.footerKey, { color: colors.textSecondary }]}>{fixEncoding("ID Recurrente")}</Text>
                <Text style={[styles.footerVal, { color: colors.text }]} numberOfLines={1}>
                  {recurrente.recurrenteId}
                </Text>
              </View>
            </View>
          </Animated.View>
        </Animated.ScrollView>

        {/* Modales */}
        <DeleteModal
          visible={deleteVisible}
          onCancel={() => setDeleteVisible(false)}
          onConfirm={handleDelete}
          title={fixEncoding("Eliminar recurrente")}
          message={fixEncoding("¿Estás seguro de que deseas eliminar este recurrente? Esta acción no se puede deshacer.")}
        />

        {modalVisible && (
          <RecurrentModal
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            onSubmit={handleModalSubmit}
            cuentaId={recurrente.cuentaId || "0000000"}
            userId={recurrente.userId || "0000000"}
            plataformas={recurrente.plataforma ? [recurrente.plataforma] : []}
            recurrenteExistente={recurrenteForModal}
          />
        )}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: SP,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 3,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    ...tileShadow,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  statusPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
  },
  statusText: { fontSize: 12, fontWeight: "900" },
  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  lockText: { fontSize: 11, fontWeight: "900" },

  hero: {
    borderWidth: 1,
    borderRadius: R + 6,
    padding: 18,
    ...cardShadow,
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 10,
  },
  heroCaption: { textAlign: "center", fontSize: 13, fontWeight: "800" },
  heroAmount: {
    marginTop: 6,
    textAlign: "center",
    fontSize: Math.min(44, Math.max(34, width * 0.11)),
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  progressBlock: { marginTop: 14 },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 },
  progressText: { fontSize: 13, fontWeight: "900" },
  progressTrack: { height: 10, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 8,
    ...tileShadow,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontSize: 13, fontWeight: "900" },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "900" },

  section: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: R + 2,
    padding: 14,
    ...tileShadow,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  miniRight: { fontSize: 12, fontWeight: "900" },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  emptyTitle: { fontSize: 14, fontWeight: "900" },
  emptySub: { fontSize: 12, fontWeight: "700", marginTop: 2, lineHeight: 16 },

  chipsWrap: { marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },

  grid: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  infoTile: {
    width: "48%",
    borderWidth: 1,
    borderRadius: R,
    padding: 14,
    ...tileShadow,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  infoLabel: { fontSize: 12, fontWeight: "900" },
  infoValue: { marginTop: 4, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  infoHint: { marginTop: 6, fontSize: 12, fontWeight: "700", lineHeight: 16 },

  smallTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  smallFill: { height: "100%", borderRadius: 999 },

  footer: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: R + 2,
    padding: 14,
    ...tileShadow,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  footerKey: { fontSize: 13, fontWeight: "900", width: 110 },
  footerVal: { flex: 1, fontSize: 13, fontWeight: "900" },
});

export default RecurrenteDetail;
