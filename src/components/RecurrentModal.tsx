import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { authService } from "../services/authService";
import { parseNumber } from "../utils/numberFormatter";
import { Ionicons } from "@expo/vector-icons";
import { Switch } from "react-native";
import { API_BASE_URL } from "../constants/api";
import Toast from "react-native-toast-message";
import SmartInput from "./SmartInput";
import SmartNumber from "./SmartNumber";
import { CurrencyField, Moneda } from "../components/CurrencyPicker";
import { useThemeColors } from "../theme/useThemeColors";
import { fixEncoding } from "../utils/fixEncoding";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  cuentaId: string;
  subcuentaId?: string;
  userId: string;
  plataformas: any[];
  recurrente?: any;
  recurrenteExistente?: any;
}

interface FormErrors {
  nombre?: string;
  plataforma?: string;
  monto?: string;
  frecuencia?: string;
  moneda?: string;
  totalPagos?: string;
}

const AnimatedField: React.FC<{
  children: React.ReactNode;
  anim: Animated.Value;
}> = ({ children, anim }) => (
  <Animated.View
    style={{
      opacity: anim,
      transform: [
        {
          translateY: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [26, 0],
          }),
        },
        {
          scale: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.965, 1],
          }),
        },
      ],
    }}
  >
    {children}
  </Animated.View>
);

const FieldSuccess: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;
  return (
    <Animated.View style={styles.fieldSuccess}>
      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
    </Animated.View>
  );
};

const RecurrentModal: React.FC<Props> = ({
  visible,
  onClose,
  onSubmit,
  cuentaId,
  subcuentaId,
  recurrente,
  recurrenteExistente,
}) => {
  const colors = useThemeColors();

  // Form state
  const [nombre, setNombre] = useState("");
  const [plataforma, setPlataforma] = useState<any>(null);
  const [frecuenciaTipo, setFrecuenciaTipo] = useState<
    "dia_semana" | "dia_mes" | "fecha_fija"
  >("dia_semana");
  const [frecuenciaValor, setFrecuenciaValor] = useState("");
  const [montoNumerico, setMontoNumerico] = useState<number | null>(null);
  const [montoValido, setMontoValido] = useState(false);
  const [erroresMonto, setErroresMonto] = useState<string[]>([]);
  const [afectaCuentaPrincipal, setAfectaCuentaPrincipal] = useState(true);
  const [afectaSubcuenta, setAfectaSubcuenta] = useState(false);
  const [recordatoriosSeleccionados, setRecordatoriosSeleccionados] = useState<
    number[]
  >([]);
  const [tipoRecurrente, setTipoRecurrente] = useState<
    "indefinido" | "plazo_fijo"
  >("indefinido");
  const [totalPagos, setTotalPagos] = useState<number | null>(null);
  const [totalPagosValid, setTotalPagosValid] = useState(false);
  const [totalPagosErrors, setTotalPagosErrors] = useState<string[]>([]);
  const [moneda, setMoneda] = useState("USD");
  const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>({
    id: "seed",
    codigo: "USD",
    nombre: "USD",
    simbolo: "$",
  });

  // Data state
  const [plataformasState, setPlataformasState] = useState<any[]>([]);
  const [loadingPlataformas, setLoadingPlataformas] = useState(false);
  const [loadingRecurrenteDetalle, setLoadingRecurrenteDetalle] = useState(false);
  const [recurrenteDetalle, setRecurrenteDetalle] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPlatformSearch, setShowPlatformSearch] = useState(false);

  // Animations
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const fieldAnims = useRef(
    Array.from({ length: 8 }, () => new Animated.Value(0)),
  ).current;

  const panY = useRef(new Animated.Value(0)).current;

  const isEditing = !!recurrenteExistente;
  const editingId =
    recurrenteExistente?.recurrenteId ?? recurrente?.recurrenteId ?? null;

  const currentProgress = useMemo(() => {
    const steps: boolean[] = [
      !!nombre.trim(),
      !!plataforma,
      !!selectedMoneda,
      montoValido,
      !!frecuenciaValor,
      tipoRecurrente !== "plazo_fijo" ? true : totalPagosValid,
    ];
    const done = steps.filter(Boolean).length;
    return (done / steps.length) * 100;
  }, [
    nombre,
    plataforma,
    selectedMoneda,
    montoValido,
    frecuenciaValor,
    tipoRecurrente,
    totalPagosValid,
  ]);

  // ---- IMPORTANT: stop input sync loops ----
  // A) Only provide initialValue ONCE per open/id
  const initialMontoRef = useRef<number | undefined>(undefined);
  const initialTotalPagosRef = useRef<number | undefined>(undefined);

  // B) Force a controlled remount for SmartInput/CurrencyField when opening or changing recurrente
  const [formKey, setFormKey] = useState(0);

  // Track if prefill was already done to avoid resetting during typing
  const prefillDoneRef = useRef(false);
  const recordatoriosTouchedRef = useRef(false);

  // Ensure the modal actually animates into view when opened
  useEffect(() => {
    if (!visible) return;

    slideAnim.setValue(SCREEN_HEIGHT);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.98);
    headerAnim.setValue(0);
    fieldAnims.forEach((a) => a.setValue(0));

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.stagger(
        40,
        fieldAnims.map((a) =>
          Animated.timing(a, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [visible]);

  // When opening or switching edit target: reset prefill + remount children safely
  useEffect(() => {
    if (!visible) {
      prefillDoneRef.current = false;
      recordatoriosTouchedRef.current = false;
      initialMontoRef.current = undefined;
      initialTotalPagosRef.current = undefined;
      setRecurrenteDetalle(null);
      setLoadingRecurrenteDetalle(false);
      return;
    }

    // visible true
    prefillDoneRef.current = false; // allow prefill to run for this open/id
    recordatoriosTouchedRef.current = false;
    initialMontoRef.current = undefined;
    initialTotalPagosRef.current = undefined;
    setFormKey((k) => k + 1); // remount SmartInput/CurrencyField (prevents internal sync loops)
  }, [visible, editingId]);

  // When editing: fetch full recurrente details (recordatorios often aren't included in list snapshots)
  useEffect(() => {
    if (!visible) return;
    if (!isEditing || !editingId) return;

    let cancelled = false;

    const fetchDetalle = async () => {
      setLoadingRecurrenteDetalle(true);
      try {
        const token = await authService.getAccessToken();
        if (!token) return;

        const res = await fetch(`${API_BASE_URL}/recurrentes/${editingId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!cancelled) setRecurrenteDetalle(data);
      } catch {
        // ignore; we can still edit with partial data
      } finally {
        if (!cancelled) setLoadingRecurrenteDetalle(false);
      }
    };

    fetchDetalle();

    return () => {
      cancelled = true;
    };
  }, [visible, isEditing, editingId]);

  // Debounce platform search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Límites de monto
  const getLimitesRecurrente = () => ({
    min: 0.01,
    max: 100000000,
    warning: 10000000,
  });

  const handleMontoValidation = useCallback(
    (isValid: boolean, nextErrors: string[]) => {
      setMontoValido((prev) => (prev === isValid ? prev : isValid));
      setErroresMonto((prev) => {
        const sameLength = prev.length === nextErrors.length;
        const sameItems =
          sameLength && prev.every((v, i) => v === nextErrors[i]);
        return sameItems ? prev : nextErrors;
      });
    },
    [],
  );

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!visible) return;

    const token = await authService.getAccessToken();
    if (!token) {
      Toast.show({
        type: "error",
        text1: fixEncoding("Sesión expirada"),
        text2: fixEncoding("Inicia sesión nuevamente"),
      });
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    setLoadingPlataformas(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plataformas-recurrentes`, {
        headers,
      });
      const data = await res.json();
      if (Array.isArray(data)) setPlataformasState(data);
      else throw new Error("Formato de respuesta inválido");
    } catch {
      Toast.show({
        type: "error",
        text1: fixEncoding("Error al cargar plataformas"),
        text2: fixEncoding("Verifica tu conexión e intenta de nuevo"),
      });
      setPlataformasState([]);
    } finally {
      setLoadingPlataformas(false);
    }
  }, [visible]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPlataformas = useMemo(() => {
    return plataformasState.filter((p) =>
      p?.nombre?.toLowerCase?.().includes(debouncedSearch.toLowerCase()),
    );
  }, [plataformasState, debouncedSearch]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleMontoChange = useCallback((value: number | null) => {
    setMontoNumerico((prev) => (prev === value ? prev : value));
    setErrors((prev) => (prev.monto ? { ...prev, monto: undefined } : prev));
  }, []);

  const handleTotalPagosChange = useCallback((value: number | null) => {
    setTotalPagos((prev) => (prev === value ? prev : value));
    setErrors((prev) =>
      prev.totalPagos ? { ...prev, totalPagos: undefined } : prev,
    );
  }, []);

  const handleTotalPagosValidation = useCallback(
    (isValid: boolean, nextErrors: string[]) => {
      setTotalPagosValid((prev) => (prev === isValid ? prev : isValid));
      setTotalPagosErrors((prev) => {
        const sameLength = prev.length === nextErrors.length;
        const sameItems =
          sameLength && prev.every((v, i) => v === nextErrors[i]);
        return sameItems ? prev : nextErrors;
      });
    },
    [],
  );

  const toggleRecordatorio = (valor: number) => {
    recordatoriosTouchedRef.current = true;
    setRecordatoriosSeleccionados((prev) =>
      prev.includes(valor) ? prev.filter((r) => r !== valor) : [...prev, valor],
    );
  };

  const handleFrecuenciaChange = useCallback((tipo: typeof frecuenciaTipo) => {
    setFrecuenciaTipo(tipo);
    setFrecuenciaValor("");
    setErrors((prev) =>
      prev.frecuencia ? { ...prev, frecuencia: undefined } : prev,
    );
  }, []);

  const handlePlatformSelect = useCallback((platform: any) => {
    setPlataforma(platform);
    setShowPlatformSearch(false);
    setSearch("");
    setErrors((prev) =>
      prev.plataforma ? { ...prev, plataforma: undefined } : prev,
    );
  }, []);

  const resetForm = useCallback(() => {
    setNombre("");
    setPlataforma(null);
    setMontoNumerico(null);
    setMontoValido(false);
    setErroresMonto([]);
    setFrecuenciaTipo("dia_semana");
    setFrecuenciaValor("");
    setMoneda("USD");
    setSelectedMoneda({
      id: "seed",
      codigo: "USD",
      nombre: "USD",
      simbolo: "$",
    });
    setAfectaCuentaPrincipal(true);
    setAfectaSubcuenta(false);
    setSearch("");
    setErrors({});
    setShowPlatformSearch(false);
    setTipoRecurrente("indefinido");
    setTotalPagos(null);
    setTotalPagosValid(false);
    setTotalPagosErrors([]);
    setRecordatoriosSeleccionados([]);
  }, []);

  const handleGuardar = async () => {
    if (
      !nombre ||
      !plataforma ||
      !frecuenciaTipo ||
      !frecuenciaValor ||
      !moneda ||
      montoNumerico === null ||
      !montoValido
    ) {
      Toast.show({
        type: "error",
        text1: fixEncoding("Campos incompletos"),
        text2: fixEncoding("Por favor completa todos los campos requeridos"),
      });
      return;
    }

    if (tipoRecurrente === "plazo_fijo") {
      if (totalPagos === null || totalPagos < 1) {
        Toast.show({
          type: "error",
          text1: fixEncoding("Total de pagos requerido"),
          text2: fixEncoding("Ingresa el número total de pagos para este recurrente"),
        });
        return;
      }
      if (totalPagos > 120) {
        Toast.show({
          type: "error",
          text1: fixEncoding("Total de pagos muy alto"),
          text2: fixEncoding("El máximo permitido es 120 pagos"),
        });
        return;
      }
      if (!totalPagosValid && totalPagosErrors.length > 0) {
        Toast.show({
          type: "error",
          text1: fixEncoding("Total de pagos inválido"),
          text2: totalPagosErrors[0] ? fixEncoding(totalPagosErrors[0]) : undefined,
        });
        return;
      }
    }

    setSaving(true);
    try {
      // Validar con backend si se puede crear el recurrente (solo al crear, no al editar)
      if (!isEditing) {
        const planConfigService = await import('../services/planConfigService');
        const userId = cuentaId;
        const canPerformRes = await planConfigService.canPerform('recurrente', { userId });
        if (!canPerformRes.allowed) {
          const isConfigError = canPerformRes.message?.includes('Configuración de plan no disponible');
          Toast.show({
            type: "error",
            text1: isConfigError ? fixEncoding("Error de configuración") : fixEncoding("Límite alcanzado"),
            text2: isConfigError 
              ? fixEncoding("No se pudo verificar tu plan. Por favor, contacta a soporte.")
              : fixEncoding(canPerformRes.message || "Has alcanzado el límite de recurrentes para tu plan."),
          });
          setSaving(false);
          return;
        }
      }

      const token = await authService.getAccessToken();
      if (!token) {
        Toast.show({
          type: "error",
          text1: fixEncoding("Sesión expirada"),
          text2: fixEncoding("Inicia sesión nuevamente"),
        });
        return;
      }

      const recurrenteData = {
        nombre,
        plataforma,
        frecuenciaTipo,
        frecuenciaValor,
        moneda,
        monto: montoNumerico,
        cuentaId,
        subcuentaId: subcuentaId || null,
        afectaCuentaPrincipal: !subcuentaId,
        afectaSubcuenta: !!subcuentaId,
        recordatorios: recordatoriosSeleccionados,
        tipoRecurrente,
        ...(tipoRecurrente === "plazo_fijo" && { totalPagos }),
      };

      const url = isEditing
        ? `${API_BASE_URL}/recurrentes/${recurrenteExistente.recurrenteId}`
        : `${API_BASE_URL}/recurrentes`;

      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recurrenteData),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(
          error.message ||
            `Error al ${isEditing ? "actualizar" : "crear"} el recurrente`,
        );
      }

      const responseData = await res.json();

      Toast.show({
        type: "success",
        text1: fixEncoding(isEditing ? "Recurrente actualizado" : "Recurrente creado"),
        text2: fixEncoding(`El recurrente fue ${isEditing ? "actualizado" : "guardado"} correctamente`),
      });

      if (isEditing) {
        onSubmit({ ...recurrenteExistente, ...recurrenteData });
      } else {
        onSubmit(responseData || recurrenteData);
      }

      onClose();
    } catch {
      Toast.show({
        type: "error",
        text1: fixEncoding("Error"),
        text2: fixEncoding(`No se pudo ${isEditing ? "actualizar" : "guardar"} el recurrente. Intenta de nuevo.`),
      });
    } finally {
      setSaving(false);
    }
  };

  // ✅ SINGLE PREFILL EFFECT (no duplicate effects)
  useEffect(() => {
    if (!visible) return;
    if (prefillDoneRef.current) return;

    const source = recurrenteExistente ?? recurrente;

    // If no source and we are creating new => reset once
    if (!source) {
      prefillDoneRef.current = true;
      resetForm();
      return;
    }

    prefillDoneRef.current = true;

    // Nombre
    setNombre(source.nombre || "");

    // Plataforma
    setPlataforma(source.plataforma || null);

    // Frecuencia
    setFrecuenciaTipo(source.frecuenciaTipo || "dia_semana");
    setFrecuenciaValor(source.frecuenciaValor || "");

    // Monto
    const montoParsed = parseNumber(
      String(source.monto ?? source.amount ?? source.cantidad ?? ""),
    );
    const montoFinal = typeof montoParsed === "number" ? montoParsed : null;

    initialMontoRef.current =
      typeof montoFinal === "number" ? montoFinal : undefined;
    setMontoNumerico(montoFinal);

    const limites = getLimitesRecurrente();
    const montoValidNew =
      typeof montoFinal === "number" ? montoFinal >= limites.min : false;
    setMontoValido(montoValidNew);

    // Moneda
    const code = source.moneda || source.currency || "USD";
    setMoneda(code);

    // OJO: evita “seed” infinito: si viene un objeto moneda real, úsalo; si no, crea uno estable
    const sym = source.simbolo || "$";
    const monedaObj: Moneda = source.monedaObj?.codigo
      ? source.monedaObj
      : {
          id: source.monedaId || "seed",
          codigo: code,
          nombre: code,
          simbolo: sym,
        };

    setSelectedMoneda(monedaObj);

    // Afectaciones
    setAfectaCuentaPrincipal(source.afectaCuentaPrincipal ?? true);
    setAfectaSubcuenta(source.afectaSubcuenta ?? false);

    // Tipo recurrente + total pagos
    const tipo = source.tipoRecurrente || "indefinido";
    setTipoRecurrente(tipo);

    if (tipo === "plazo_fijo" && source.totalPagos) {
      initialTotalPagosRef.current = source.totalPagos;
      setTotalPagos(source.totalPagos);
      setTotalPagosValid(true);
    } else {
      initialTotalPagosRef.current = undefined;
      setTotalPagos(null);
      setTotalPagosValid(false);
      setTotalPagosErrors([]);
    }

    // Recordatorios (a veces no vienen en el objeto de lista; se completan con detalle)
    const recs = Array.isArray(source.recordatorios) ? source.recordatorios : [];
    setRecordatoriosSeleccionados(recs);
  }, [visible, editingId, recurrenteExistente, recurrente, resetForm]);

  // Once we have the detail, set recordatorios if the user hasn't edited them yet
  useEffect(() => {
    if (!visible) return;
    if (!recurrenteDetalle) return;
    if (recordatoriosTouchedRef.current) return;

    const next = Array.isArray(recurrenteDetalle.recordatorios)
      ? recurrenteDetalle.recordatorios
      : [];

    setRecordatoriosSeleccionados((prev) => {
      const sameLength = prev.length === next.length;
      const sameItems = sameLength && prev.every((v, i) => v === next[i]);
      return sameItems ? prev : next;
    });
  }, [visible, recurrenteDetalle]);

  // PanResponder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 240,
            useNativeDriver: true,
          }).start(() => {
            panY.setValue(0);
            handleClose();
          });
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const renderError = (error?: string) => {
    if (!error) return null;
    return (
      <Animated.View style={[styles.errorContainer, { opacity: fadeAnim }]}>
        <Ionicons name="alert-circle" size={14} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
      </Animated.View>
    );
  };

  const renderLoadingSkeleton = (height: number = 50) => (
    <View style={[styles.skeletonContainer, { height }]}>
      <Animated.View
        style={[
          styles.skeleton,
          { backgroundColor: colors.border, opacity: fadeAnim },
        ]}
      />
    </View>
  );

  const renderPlatformItem = ({ item: platform }: { item: any }) => {
    const isSelected = plataforma?.plataformaId === platform.plataformaId;

    return (
      <TouchableOpacity
        onPress={() => handlePlatformSelect(platform)}
        style={[
          styles.platformItem,
          { backgroundColor: colors.card },
          isSelected && {
            backgroundColor: colors.button + "15",
            borderColor: colors.button,
          },
        ]}
        activeOpacity={0.7}
      >
        <View
          style={[styles.platformColor, { backgroundColor: platform.color }]}
        />
        <View style={styles.platformInfo}>
          <Text
            style={[styles.platformName, { color: colors.text }]}
            numberOfLines={1}
          >
            {platform.nombre}
          </Text>
          <Text
            style={[styles.platformCategory, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {platform.categoria}
          </Text>
        </View>
        {isSelected && (
          <View
            style={[styles.platformCheck, { backgroundColor: colors.button }]}
          >
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFrequencySelector = () => {
    const frequencies = [
      { label: "Semanal", tipo: "dia_semana", icon: "calendar-outline" },
      { label: "Mensual", tipo: "dia_mes", icon: "calendar" },
      { label: "Anual", tipo: "fecha_fija", icon: "calendar-sharp" },
    ];

    return (
      <View style={styles.frequencyGrid}>
        {frequencies.map((freq) => {
          const isSelected = frecuenciaTipo === freq.tipo;
          return (
            <TouchableOpacity
              key={freq.tipo}
              onPress={() => handleFrecuenciaChange(freq.tipo as any)}
              style={[
                styles.frequencyCard,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
                isSelected && {
                  backgroundColor: colors.button,
                  borderColor: colors.button,
                  ...styles.frequencyCardSelected,
                },
              ]}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.frequencyIconContainer,
                  isSelected && { backgroundColor: "rgba(255,255,255,0.2)" },
                ]}
              >
                <Ionicons
                  name={freq.icon as any}
                  size={20}
                  color={isSelected ? "#fff" : colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.frequencyLabel,
                  { color: isSelected ? "#fff" : colors.text },
                ]}
              >
                {freq.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // no-op
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={handleClose}
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.modal,
              { backgroundColor: colors.card },
              {
                transform: [
                  { translateY: Animated.add(slideAnim, panY) },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            {/* Swipe Handle */}
            <View style={styles.handleContainer} {...panResponder.panHandlers}>
              <View
                style={[styles.handle, { backgroundColor: colors.border }]}
              />
            </View>

            {/* Header */}
            <Animated.View
              style={[
                styles.header,
                {
                  opacity: headerAnim,
                  transform: [
                    {
                      translateY: headerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.headerContent}>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: colors.button + "20" },
                  ]}
                >
                  <Ionicons name="repeat" size={22} color={colors.button} />
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {isEditing ? fixEncoding("Editar Recurrente") : fixEncoding("Nuevo Recurrente")}
                  </Text>

                  {!isEditing && (
                    <View style={styles.progressSection}>
                      <View
                        style={[
                          styles.progressTrack,
                          { backgroundColor: colors.inputBackground },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              backgroundColor: colors.button,
                              width: `${currentProgress}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.progressLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {Math.round(currentProgress)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>

            {/* Form Content */}
            <View style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                onScroll={onScroll}
                scrollEventThrottle={16}
              >
                {/* 1) Nombre */}
                <AnimatedField anim={fieldAnims[0]}>
                  <View style={styles.fieldContainer}>
                    <View style={styles.fieldHeader}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Nombre del Recurrente
                      </Text>
                      <FieldSuccess show={!!nombre} />
                    </View>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.border,
                        },
                        nombre && styles.inputWrapperFilled,
                        errors.nombre && styles.inputWrapperError,
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.inputText }]}
                        value={nombre}
                        onChangeText={setNombre}
                        autoCorrect={false}
                        autoCapitalize="none"
                        importantForAutofill="no"
                        placeholder={fixEncoding("Ej. Spotify Premium, Netflix...")}
                        placeholderTextColor={colors.placeholder}
                        maxLength={50}
                        returnKeyType="done"
                        blurOnSubmit={false}
                      />
                    </View>
                    {renderError(errors.nombre)}
                    {nombre && (
                      <Text
                        style={[
                          styles.helpText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        ✓ Nombre identificado correctamente
                      </Text>
                    )}
                  </View>
                </AnimatedField>

                {/* 2) Plataforma */}
                <AnimatedField anim={fieldAnims[1]}>
                  <View style={styles.fieldContainer}>
                    <View style={styles.fieldHeader}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Plataforma
                      </Text>
                      <FieldSuccess show={!!plataforma} />
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.selectorBtn,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.border,
                        },
                        plataforma && styles.inputWrapperFilled,
                        errors.plataforma && styles.inputWrapperError,
                      ]}
                      onPress={() => setShowPlatformSearch((v) => !v)}
                      activeOpacity={0.7}
                    >
                      {plataforma ? (
                        <View style={styles.selectedPlatform}>
                          <View
                            style={[
                              styles.platformColor,
                              { backgroundColor: plataforma.color },
                            ]}
                          />
                          <Text
                            style={[
                              styles.selectedText,
                              { color: colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {plataforma.nombre}
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.placeholderText,
                            { color: colors.placeholder },
                          ]}
                        >
                          {fixEncoding("Selecciona una plataforma")}
                        </Text>
                      )}
                      <Ionicons
                        name={
                          showPlatformSearch ? "chevron-up" : "chevron-down"
                        }
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    {renderError(errors.plataforma)}

                    {showPlatformSearch && (
                      <Animated.View
                        style={[
                          styles.dropdown,
                          {
                            backgroundColor: colors.cardSecondary,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.searchBox,
                            {
                              backgroundColor: colors.inputBackground,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name="search"
                            size={18}
                            color={colors.textSecondary}
                          />
                          <TextInput
                            style={[
                              styles.searchInput,
                              { color: colors.inputText },
                            ]}
                            value={search}
                            onChangeText={setSearch}
                            placeholder={fixEncoding("Buscar plataforma...")}
                            placeholderTextColor={colors.placeholder}
                          />
                        </View>

                        <ScrollView
                          style={styles.platformList}
                          nestedScrollEnabled
                        >
                          {loadingPlataformas ? (
                            <>
                              {renderLoadingSkeleton()}
                              {renderLoadingSkeleton()}
                              {renderLoadingSkeleton()}
                            </>
                          ) : filteredPlataformas.length > 0 ? (
                            filteredPlataformas.map((p) => (
                              <View key={p.plataformaId}>
                                {renderPlatformItem({ item: p })}
                              </View>
                            ))
                          ) : (
                            <View style={styles.emptyState}>
                              <Ionicons
                                name="search"
                                size={40}
                                color={colors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.emptyText,
                                  { color: colors.text },
                                ]}
                              >
                                {fixEncoding("No se encontraron plataformas")}
                              </Text>
                              <Text
                                style={[
                                  styles.emptySubtext,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {fixEncoding("Intenta con otro término")}
                              </Text>
                            </View>
                          )}
                        </ScrollView>
                      </Animated.View>
                    )}

                    {plataforma && (
                      <View
                        style={[
                          styles.infoBox,
                          {
                            backgroundColor: colors.button + "10",
                            borderColor: colors.button + "30",
                          },
                        ]}
                      >
                        <Ionicons
                          name="information-circle"
                          size={16}
                          color={colors.button}
                        />
                        <Text
                          style={[
                            styles.infoText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Categoría:{" "}
                          <Text
                            style={{ fontWeight: "600", color: colors.text }}
                          >
                            {plataforma.categoria}
                          </Text>
                        </Text>
                      </View>
                    )}
                  </View>
                </AnimatedField>

                {/* 3) Moneda */}
                <AnimatedField anim={fieldAnims[2]}>
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Moneda
                    </Text>
                    <CurrencyField
                      key={`currency-${formKey}`} // ✅ remount controlled
                      label=""
                      value={selectedMoneda}
                      onChange={(m) => {
                        setSelectedMoneda(m);
                        setMoneda(m.codigo);
                        setErrors((prev) =>
                          prev.moneda ? { ...prev, moneda: undefined } : prev,
                        );
                      }}
                      showSearch
                    />
                    {renderError(errors.moneda)}
                  </View>
                </AnimatedField>

                {/* 4) Monto */}
                <AnimatedField anim={fieldAnims[3]}>
                  <View style={styles.fieldContainer}>
                    <View style={styles.fieldHeader}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Monto
                      </Text>
                      <FieldSuccess show={montoValido} />
                    </View>

                    <SmartInput
                      key={`monto-${formKey}`} // ✅ remount controlled
                      type="currency"
                      placeholder="0.00"
                      prefix={selectedMoneda?.simbolo || "$"}
                      context={
                        isEditing
                          ? `recurrente-monto-edit-${editingId ?? "edit"}`
                          : "recurrente-monto-new"
                      }
                      initialValue={initialMontoRef.current} // ✅ only once per open/id
                      {...getLimitesRecurrente()}
                      onValueChange={(v) => handleMontoChange(v)}
                      onValidationChange={handleMontoValidation}
                      style={StyleSheet.flatten([
                        { marginBottom: 0 },
                        { backgroundColor: colors.inputBackground },
                      ])}
                      inputContainerStyle={StyleSheet.flatten([
                        {
                          borderRadius: styles.smartInput.borderRadius,
                          borderWidth: styles.smartInput.borderWidth,
                          height: styles.smartInput.height,
                          paddingHorizontal: styles.smartInput.paddingHorizontal,
                          borderColor: colors.border,
                        },
                        errors.monto && styles.inputWrapperError,
                      ])}
                      inputStyle={StyleSheet.flatten([
                        {
                          fontSize: styles.smartInput.fontSize,
                          fontWeight: styles.smartInput.fontWeight,
                          color: colors.inputText,
                        },
                      ])}
                      autoFix
                    />

                    {renderError(errors.monto)}

                    {erroresMonto.length > 0 && (
                      <View
                        style={[
                          styles.warningBox,
                          {
                            backgroundColor: "#FEF3C7",
                            borderColor: "#F59E0B",
                          },
                        ]}
                      >
                        <Ionicons name="warning" size={16} color="#F59E0B" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.warningTitle}>
                            Monto muy grande
                          </Text>
                          <Text style={styles.warningText}>
                            Monto:{" "}
                            <SmartNumber
                              value={montoNumerico || 0}
                              options={{
                                context: "modal",
                                symbol: selectedMoneda?.simbolo || "$",
                              }}
                            />
                          </Text>
                          <Text style={styles.warningSubtext}>
                            {erroresMonto[0]}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </AnimatedField>

                {/* 5) Tipo de Pago */}
                <AnimatedField anim={fieldAnims[4]}>
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Tipo de Pago
                    </Text>
                    <Text
                      style={[
                        styles.description,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {tipoRecurrente === "indefinido"
                        ? fixEncoding("Este recurrente se ejecutará continuamente")
                        : fixEncoding("Este recurrente tendrá una duración definida")}
                    </Text>

                    <View style={styles.tipoGrid}>
                      <TouchableOpacity
                        onPress={() => {
                          setTipoRecurrente("indefinido");
                          initialTotalPagosRef.current = undefined;
                          setTotalPagos(null);
                          setTotalPagosValid(false);
                          setTotalPagosErrors([]);
                        }}
                        style={[
                          styles.tipoCard,
                          {
                            backgroundColor: colors.cardSecondary,
                            borderColor: colors.border,
                          },
                          tipoRecurrente === "indefinido" && {
                            backgroundColor: colors.button,
                            borderColor: colors.button,
                          },
                        ]}
                        activeOpacity={0.85}
                      >
                        <View
                          style={[
                            styles.tipoIcon,
                            tipoRecurrente === "indefinido" && {
                              backgroundColor: "rgba(255,255,255,0.2)",
                            },
                          ]}
                        >
                          <Ionicons
                            name="infinite-outline"
                            size={24}
                            color={
                              tipoRecurrente === "indefinido"
                                ? "#fff"
                                : colors.textSecondary
                            }
                          />
                        </View>
                        <Text
                          style={[
                            styles.tipoTitle,
                            {
                              color:
                                tipoRecurrente === "indefinido"
                                  ? "#fff"
                                  : colors.text,
                            },
                          ]}
                        >
                          Continuo
                        </Text>
                        <Text
                          style={[
                            styles.tipoSubtitle,
                            {
                              color:
                                tipoRecurrente === "indefinido"
                                  ? "rgba(255,255,255,0.8)"
                                  : colors.textSecondary,
                            },
                          ]}
                        >
                          {fixEncoding("Sin límite")}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setTipoRecurrente("plazo_fijo");
                          setErrors((prev) =>
                            prev.totalPagos
                              ? { ...prev, totalPagos: undefined }
                              : prev,
                          );
                        }}
                        style={[
                          styles.tipoCard,
                          {
                            backgroundColor: colors.cardSecondary,
                            borderColor: colors.border,
                          },
                          tipoRecurrente === "plazo_fijo" && {
                            backgroundColor: colors.button,
                            borderColor: colors.button,
                          },
                        ]}
                        activeOpacity={0.85}
                      >
                        <View
                          style={[
                            styles.tipoIcon,
                            tipoRecurrente === "plazo_fijo" && {
                              backgroundColor: "rgba(255,255,255,0.2)",
                            },
                          ]}
                        >
                          <Ionicons
                            name="calendar-number-outline"
                            size={24}
                            color={
                              tipoRecurrente === "plazo_fijo"
                                ? "#fff"
                                : colors.textSecondary
                            }
                          />
                        </View>
                        <Text
                          style={[
                            styles.tipoTitle,
                            {
                              color:
                                tipoRecurrente === "plazo_fijo"
                                  ? "#fff"
                                  : colors.text,
                            },
                          ]}
                        >
                          Plazo Fijo
                        </Text>
                        <Text
                          style={[
                            styles.tipoSubtitle,
                            {
                              color:
                                tipoRecurrente === "plazo_fijo"
                                  ? "rgba(255,255,255,0.8)"
                                  : colors.textSecondary,
                            },
                          ]}
                        >
                          {fixEncoding("Duración definida")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </AnimatedField>

                {/* 6) Frecuencia */}
                <AnimatedField anim={fieldAnims[5]}>
                  <View style={styles.fieldContainer}>
                    <View style={styles.fieldHeader}>
                      <Text style={[styles.label, { color: colors.text }]}>
                        Frecuencia
                      </Text>
                      <FieldSuccess show={!!frecuenciaValor} />
                    </View>

                    <Text
                      style={[
                        styles.description,
                        { color: colors.textSecondary, marginBottom: 10 },
                      ]}
                    >
                        {tipoRecurrente === "plazo_fijo"
                        ? fixEncoding("Selecciona cada cuánto se realizará el pago")
                        : fixEncoding("Selecciona el día o fecha en que se ejecutará")}
                    </Text>

                    {renderFrequencySelector()}
                    {renderError(errors.frecuencia)}

                    {frecuenciaTipo === "dia_semana" && (
                      <View style={styles.dayGrid}>
                        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(
                          (day, index) => {
                            const isSelected =
                              frecuenciaValor === String(index);
                            return (
                              <TouchableOpacity
                                key={index}
                                onPress={() =>
                                  setFrecuenciaValor(String(index))
                                }
                                style={[
                                  styles.dayChip,
                                  {
                                    backgroundColor: colors.cardSecondary,
                                    borderColor: colors.border,
                                  },
                                  isSelected && {
                                    backgroundColor: colors.button,
                                    borderColor: colors.button,
                                  },
                                ]}
                                activeOpacity={0.85}
                              >
                                <Text
                                  style={[
                                    styles.dayText,
                                    {
                                      color: isSelected ? "#fff" : colors.text,
                                    },
                                  ]}
                                >
                                  {fixEncoding(day)}
                                </Text>
                              </TouchableOpacity>
                            );
                          },
                        )}
                      </View>
                    )}

                    {frecuenciaTipo === "dia_mes" && (
                      <View style={styles.dayGrid}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(
                          (day) => {
                            const isSelected = frecuenciaValor === String(day);
                            return (
                              <TouchableOpacity
                                key={day}
                                onPress={() => setFrecuenciaValor(String(day))}
                                style={[
                                  styles.numberChip,
                                  {
                                    backgroundColor: colors.cardSecondary,
                                    borderColor: colors.border,
                                  },
                                  isSelected && {
                                    backgroundColor: colors.button,
                                    borderColor: colors.button,
                                  },
                                ]}
                                activeOpacity={0.85}
                              >
                                <Text
                                  style={[
                                    styles.numberText,
                                    {
                                      color: isSelected ? "#fff" : colors.text,
                                    },
                                  ]}
                                >
                                  {day}
                                </Text>
                              </TouchableOpacity>
                            );
                          },
                        )}
                      </View>
                    )}

                    {frecuenciaTipo === "fecha_fija" && (
                      <>
                        <Text
                          style={[
                            styles.subLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Selecciona el mes
                        </Text>
                        <View style={styles.monthGrid}>
                          {[
                            "Ene",
                            "Feb",
                            "Mar",
                            "Abr",
                            "May",
                            "Jun",
                            "Jul",
                            "Ago",
                            "Sep",
                            "Oct",
                            "Nov",
                            "Dic",
                          ].map((mes, index) => {
                            const isSelected = frecuenciaValor.startsWith(
                              `${index + 1}-`,
                            );
                            return (
                              <TouchableOpacity
                                key={mes}
                                onPress={() =>
                                  setFrecuenciaValor(`${index + 1}-1`)
                                }
                                style={[
                                  styles.monthChip,
                                  {
                                    backgroundColor: colors.cardSecondary,
                                    borderColor: colors.border,
                                  },
                                  isSelected && {
                                    backgroundColor: colors.button,
                                    borderColor: colors.button,
                                  },
                                ]}
                                activeOpacity={0.85}
                              >
                                <Text
                                  style={[
                                    styles.monthText,
                                    {
                                      color: isSelected ? "#fff" : colors.text,
                                    },
                                  ]}
                                >
                                  {mes}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {frecuenciaValor.includes("-") && (
                          <>
                            <Text
                              style={[
                                styles.subLabel,
                                { color: colors.textSecondary, marginTop: 16 },
                              ]}
                            >
                              {fixEncoding("Selecciona el día")}
                            </Text>
                            <View style={styles.dayGrid}>
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(
                                (day) => {
                                  const [mes] = frecuenciaValor.split("-");
                                  const nuevaFecha = `${mes}-${day}`;
                                  const isSelected =
                                    frecuenciaValor === nuevaFecha;
                                  return (
                                    <TouchableOpacity
                                      key={day}
                                      onPress={() =>
                                        setFrecuenciaValor(nuevaFecha)
                                      }
                                      style={[
                                        styles.numberChip,
                                        {
                                          backgroundColor: colors.cardSecondary,
                                          borderColor: colors.border,
                                        },
                                        isSelected && {
                                          backgroundColor: colors.button,
                                          borderColor: colors.button,
                                        },
                                      ]}
                                      activeOpacity={0.85}
                                    >
                                      <Text
                                        style={[
                                          styles.numberText,
                                          {
                                            color: isSelected
                                              ? "#fff"
                                              : colors.text,
                                          },
                                        ]}
                                      >
                                        {day}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                },
                              )}
                            </View>
                          </>
                        )}
                      </>
                    )}
                  </View>
                </AnimatedField>

                {/* 7) Total de pagos (solo si plazo fijo) */}
                {tipoRecurrente === "plazo_fijo" && (
                  <AnimatedField anim={fieldAnims[6]}>
                    <View style={styles.fieldContainer}>
                      <View style={styles.fieldHeader}>
                        <Text style={[styles.label, { color: colors.text }]}>
                          Total de Pagos
                        </Text>
                        <FieldSuccess show={totalPagosValid} />
                      </View>
                      <Text
                        style={[
                          styles.description,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {fixEncoding("¿Cuántas veces se ejecutará este recurrente?")}
                      </Text>

                      <SmartInput
                        key={`totalPagos-${formKey}`} // ✅ remount controlled
                        type="integer"
                        placeholder="Ej: 12"
                        context={
                          isEditing
                            ? `recurrente-total-pagos-edit-${editingId ?? "edit"}`
                            : "recurrente-total-pagos-new"
                        }
                        initialValue={initialTotalPagosRef.current} // ✅ only once per open/id
                        onValueChange={(v) => handleTotalPagosChange(v)}
                        onValidationChange={handleTotalPagosValidation}
                        style={StyleSheet.flatten([
                          { marginBottom: 0 },
                          { backgroundColor: colors.inputBackground },
                        ])}
                        inputContainerStyle={StyleSheet.flatten([
                          {
                            borderRadius: styles.smartInput.borderRadius,
                            borderWidth: styles.smartInput.borderWidth,
                            height: styles.smartInput.height,
                            paddingHorizontal: styles.smartInput.paddingHorizontal,
                            borderColor: colors.border,
                          },
                          errors.totalPagos && styles.inputWrapperError,
                        ])}
                        inputStyle={StyleSheet.flatten([
                          {
                            fontSize: styles.smartInput.fontSize,
                            fontWeight: styles.smartInput.fontWeight,
                            color: colors.inputText,
                          },
                        ])}
                      />

                      {renderError(errors.totalPagos)}

                      {totalPagos && totalPagos > 0 && frecuenciaTipo && (
                        <View
                          style={[
                            styles.infoBox,
                            {
                              backgroundColor: colors.button + "10",
                              borderColor: colors.button + "30",
                            },
                          ]}
                        >
                          <Ionicons
                            name="information-circle"
                            size={16}
                            color={colors.button}
                          />
                          <Text
                            style={[
                              styles.infoText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {fixEncoding("Se realizarán")} {" "}
                            <Text
                              style={{ fontWeight: "700", color: colors.text }}
                            >
                              {totalPagos}
                            </Text>{" "}
                            {fixEncoding("pagos")} {" "}
                            {frecuenciaTipo === "dia_semana" && fixEncoding("semanales")}
                            {frecuenciaTipo === "dia_mes" && fixEncoding("mensuales")}
                            {frecuenciaTipo === "fecha_fija" && fixEncoding("anuales")}
                            {montoNumerico ? fixEncoding(" por un total de ") : ""}
                            {montoNumerico ? (
                              <SmartNumber
                                value={(montoNumerico || 0) * (totalPagos || 0)}
                                options={{
                                  context: "modal",
                                  symbol: selectedMoneda?.simbolo || "$",
                                }}
                              />
                            ) : null}
                          </Text>
                        </View>
                      )}
                    </View>
                  </AnimatedField>
                )}

                {/* 8) Recordatorios */}
                <AnimatedField anim={fieldAnims[7]}>
                  <View style={styles.fieldContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Recordatorios
                    </Text>
                    <Text
                      style={[
                        styles.description,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {fixEncoding("Te notificaremos antes del próximo pago")}
                    </Text>
                    <View style={styles.reminderGrid}>
                      {[
                        { dias: 1, label: fixEncoding("1 día"), icon: "alarm-outline" },
                        {
                          dias: 3,
                          label: fixEncoding("3 días"),
                          icon: "notifications-outline",
                        },
                        { dias: 7, label: fixEncoding("1 semana"), icon: "time-outline" },
                      ].map(({ dias, label, icon }) => {
                        const isSelected =
                          recordatoriosSeleccionados.includes(dias);
                        return (
                          <TouchableOpacity
                            key={dias}
                            onPress={() => toggleRecordatorio(dias)}
                            style={[
                              styles.reminderCard,
                              {
                                backgroundColor: colors.cardSecondary,
                                borderColor: colors.border,
                              },
                              isSelected && {
                                backgroundColor: colors.button,
                                borderColor: colors.button,
                              },
                            ]}
                            activeOpacity={0.85}
                          >
                            <Ionicons
                              name={icon as any}
                              size={20}
                              color={isSelected ? "#fff" : colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.reminderText,
                                { color: isSelected ? "#fff" : colors.text },
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </AnimatedField>

                {/* 9) Config de cuenta */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, { color: colors.text }]}>
                    {fixEncoding("Configuración de Cuenta")}
                  </Text>

                  {!subcuentaId && (
                    <View
                      style={[
                        styles.switchCard,
                        { backgroundColor: colors.cardSecondary },
                      ]}
                    >
                      <View style={styles.switchContent}>
                        <Ionicons
                          name="wallet-outline"
                          size={20}
                          color={colors.text}
                        />
                        <View style={styles.switchTextContainer}>
                          <Text
                            style={[styles.switchLabel, { color: colors.text }]}
                          >
                            Afectar cuenta principal
                          </Text>
                          <Text
                            style={[
                              styles.switchDesc,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {fixEncoding("El monto se descontará de la cuenta principal")}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={afectaCuentaPrincipal}
                        onValueChange={(v) => setAfectaCuentaPrincipal(v)}
                        trackColor={{
                          false: colors.border,
                          true: colors.button,
                        }}
                        thumbColor="#ffffff"
                        ios_backgroundColor={colors.border}
                      />
                    </View>
                  )}

                  {subcuentaId && (
                    <View
                      style={[
                        styles.switchCard,
                        { backgroundColor: colors.cardSecondary },
                      ]}
                    >
                      <View style={styles.switchContent}>
                        <Ionicons
                          name="folder-outline"
                          size={20}
                          color={colors.text}
                        />
                        <View style={styles.switchTextContainer}>
                          <Text
                            style={[styles.switchLabel, { color: colors.text }]}
                          >
                            Afectar subcuenta
                          </Text>
                          <Text
                            style={[
                              styles.switchDesc,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {fixEncoding("El monto se descontará de la subcuenta seleccionada")}
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={afectaSubcuenta}
                        onValueChange={(v) => setAfectaSubcuenta(v)}
                        trackColor={{
                          false: colors.border,
                          true: colors.button,
                        }}
                        thumbColor="#ffffff"
                        ios_backgroundColor={colors.border}
                      />
                    </View>
                  )}
                </View>

                <View style={{ height: 12 }} />
              </ScrollView>
            </View>

            {/* Action Button */}
            <View
              style={[styles.footer, { borderTopColor: "rgba(0,0,0,0.05)" }]}
            >
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: colors.button },
                  saving && { opacity: 0.75 },
                ]}
                onPress={handleGuardar}
                disabled={saving}
                activeOpacity={0.9}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={22}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.saveBtnText}>
                      {isEditing
                        ? "Actualizar Recurrente"
                        : "Guardar Recurrente"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  keyboardView: { flex: 1, justifyContent: "flex-end" },
  modal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: SCREEN_HEIGHT * 0.78,
    maxHeight: SCREEN_HEIGHT * 0.95,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: { paddingTop: 12, paddingBottom: 8, alignItems: "center" },
  handle: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerContent: { flex: 1, flexDirection: "row", alignItems: "center" },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  progressSection: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressLabel: { fontSize: 11, fontWeight: "600", minWidth: 32 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 },
  fieldContainer: { marginBottom: 24 },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  fieldSuccess: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 15, fontWeight: "600", letterSpacing: -0.3 },
  subLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 10,
    marginTop: 16,
  },
  description: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  inputWrapper: {
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    height: 52,
    justifyContent: "center",
  },
  inputWrapperFilled: { borderWidth: 2 },
  inputWrapperError: { borderColor: "#EF4444", borderWidth: 2 },
  input: { fontSize: 15, fontWeight: "500" },
  smartInput: {
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    fontWeight: "500",
  },
  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 16,
    height: 52,
  },
  selectedPlatform: { flexDirection: "row", alignItems: "center", flex: 1 },
  platformColor: { width: 24, height: 24, borderRadius: 12, marginRight: 10 },
  selectedText: { fontSize: 15, fontWeight: "500", flex: 1 },
  placeholderText: { fontSize: 15 },
  dropdown: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: 300,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  platformList: { maxHeight: 240 },
  platformItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    borderLeftWidth: 2,
    borderLeftColor: "transparent",
  },
  platformInfo: { flex: 1, marginLeft: 12 },
  platformName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  platformCategory: { fontSize: 12 },
  platformCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 15, fontWeight: "600", marginTop: 12 },
  emptySubtext: { fontSize: 13, marginTop: 4, textAlign: "center" },
  frequencyGrid: { flexDirection: "row", gap: 10, marginTop: 4 },
  frequencyCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
  },
  frequencyCardSelected: { transform: [{ scale: 1.02 }] },
  frequencyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  frequencyLabel: { fontSize: 13, fontWeight: "600" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  dayChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 50,
    alignItems: "center",
  },
  dayText: { fontSize: 13, fontWeight: "600" },
  numberChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: 13, fontWeight: "600" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  monthChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: 58,
    alignItems: "center",
  },
  monthText: { fontSize: 13, fontWeight: "600" },
  reminderGrid: { flexDirection: "row", gap: 10, marginTop: 4 },
  reminderCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 6,
  },
  reminderText: { fontSize: 12, fontWeight: "600" },
  tipoGrid: { flexDirection: "row", gap: 12, marginTop: 4 },
  tipoCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  tipoIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  tipoTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  tipoSubtitle: { fontSize: 12, fontWeight: "500" },
  switchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  switchContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
    marginRight: 12,
  },
  switchTextContainer: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  switchDesc: { fontSize: 12, lineHeight: 16 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginTop: 10,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 2,
  },
  warningText: { fontSize: 12, color: "#92400E", marginBottom: 2 },
  warningSubtext: { fontSize: 11, color: "#A16207", fontStyle: "italic" },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  errorText: { fontSize: 12, color: "#EF4444", fontWeight: "600" },
  helpText: { fontSize: 12, marginTop: 8, lineHeight: 16 },
  skeletonContainer: { padding: 16 },
  skeleton: { height: 20, borderRadius: 8 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.3,
  },
});

export default RecurrentModal;
