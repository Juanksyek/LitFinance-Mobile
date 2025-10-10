import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, UIManager, LayoutAnimation, Platform, Animated, KeyboardAvoidingView } from "react-native";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { API_BASE_URL } from "../constants/api";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ease = {
  duration: 220,
  update: { type: LayoutAnimation.Types.easeInEaseOut, duration: 220 },
  create: { type: LayoutAnimation.Types.easeInEaseOut, duration: 180, property: LayoutAnimation.Properties.opacity },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, duration: 150, property: LayoutAnimation.Properties.opacity },
} as const;

export type Moneda = {
  id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  esPrincipal?: boolean;
  esFavorita?: boolean;
};

type MonedasResponse = {
  favoritas: Moneda[];
  otras: Moneda[];
  total: number;
  totalFavoritas: number;
};

export type CurrencyPickerProps = {
  visible: boolean;
  onClose: () => void;
  value?: string;
  onSelect: (moneda: Moneda) => void;
  getAuthToken?: () => Promise<string | null>;
  searchPlaceholder?: string;
  showSearch?: boolean;
  maxListHeight?: number;
};

function sortByNombre(a: Moneda, b: Moneda) {
  return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
}

export const CurrencyPicker: React.FC<CurrencyPickerProps> = ({
  visible,
  onClose,
  value,
  onSelect,
  getAuthToken,
  searchPlaceholder = "Busca por nombre o código…",
  showSearch = true,
  maxListHeight = 360,
}) => {
  const [data, setData] = useState<MonedasResponse>({
    favoritas: [],
    otras: [],
    total: 0,
    totalFavoritas: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  const starScale = useRef<Record<string, Animated.Value>>({}).current;
  const getStarAnim = (id: string) => {
    if (!starScale[id]) starScale[id] = new Animated.Value(1);
    return starScale[id];
  };

  const getHeaders = useCallback(async () => {
    const token =
      (await (getAuthToken ? getAuthToken() : AsyncStorage.getItem("authToken"))) ||
      null;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [getAuthToken]);

  const fetchMonedas = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getHeaders();
      const res = await fetch(`${API_BASE_URL}/monedas`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const json: MonedasResponse = await res.json();
      json.favoritas = [...(json.favoritas || [])].sort(sortByNombre);
      json.otras = [...(json.otras || [])].sort(sortByNombre);
      setData(json);
    } catch (err) {
      console.error(err);
      Toast.show({ type: "error", text1: "No se pudieron cargar las monedas" });
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMonedas();
    setRefreshing(false);
  }, [fetchMonedas]);

  useEffect(() => {
    if (visible) {
      fetchMonedas();
      setQ("");
    }
  }, [visible, fetchMonedas]);

  const filterFn = (m: Moneda) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      m.nombre.toLowerCase().includes(s) ||
      m.codigo.toLowerCase().includes(s) ||
      (m.simbolo || "").toLowerCase().includes(s)
    );
  };

  const favoritasFiltradas = useMemo(
    () => data.favoritas.filter(filterFn),
    [data.favoritas, q]
  );
  const otrasFiltradas = useMemo(() => data.otras.filter(filterFn), [data.otras, q]);

  const toggleFavorita = useCallback(
    async (codigoMoneda: string) => {
      const prev = JSON.parse(JSON.stringify(data)) as MonedasResponse;
      const enFav = data.favoritas.find((m) => m.codigo === codigoMoneda);
      const enOtras = data.otras.find((m) => m.codigo === codigoMoneda);

      let next: MonedasResponse = {
        favoritas: [...data.favoritas],
        otras: [...data.otras],
        total: data.total,
        totalFavoritas: data.totalFavoritas,
      };

      LayoutAnimation.configureNext(ease);

      if (enFav) {
        next.favoritas = next.favoritas.filter((m) => m.codigo !== codigoMoneda);
        next.otras = [...next.otras, { ...enFav, esFavorita: false }].sort(sortByNombre);
        next.totalFavoritas = Math.max(0, (next.totalFavoritas || 1) - 1);
      } else if (enOtras) {
        next.otras = next.otras.filter((m) => m.codigo !== codigoMoneda);
        next.favoritas = [...next.favoritas, { ...enOtras, esFavorita: true }].sort(
          sortByNombre
        );
        next.totalFavoritas = (next.totalFavoritas || 0) + 1;
      }

      setData(next);

      const idStar =
        (enFav?.id as string | undefined) || (enOtras?.id as string | undefined);
      if (idStar) {
        const anim = getStarAnim(idStar);
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.85, duration: 90, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }),
        ]).start();
      }

      try {
        const headers = await getHeaders();
        const res = await fetch(`${API_BASE_URL}/user/monedas/toggle-favorita`, {
          method: "POST",
          headers,
          body: JSON.stringify({ codigoMoneda }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message || "No se pudo actualizar favorita");
        Toast.show({ type: "success", text1: json?.message || "Actualizado" });
      } catch (err: any) {
        console.error(err);
        LayoutAnimation.configureNext(ease);
        setData(prev);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: err?.message || "No se pudo actualizar favorita",
        });
      }
    },
    [API_BASE_URL, data, getHeaders]
  );

  const Row: React.FC<{ m: Moneda }> = ({ m }) => {
    const selected = value && value.toUpperCase() === m.codigo.toUpperCase();
    const s = getStarAnim(m.id);

    return (
      <View style={styles.row}>
        <Pressable style={styles.rowLeft} onPress={() => onSelect(m)}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleTxt}>{m.simbolo || "¤"}</Text>
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.mName}>
              {m.nombre} <Text style={styles.mCode}>({m.codigo})</Text>
            </Text>
            <View style={styles.badgesLine}>
              {m.esPrincipal ? (
                <Text style={styles.badgePrincipal}>Moneda principal</Text>
              ) : null}
              {selected ? <Text style={styles.badgeSel}>Seleccionada</Text> : null}
            </View>
          </View>
        </Pressable>

        <Animated.View style={{ transform: [{ scale: s }] }}>
          <Pressable onPress={() => toggleFavorita(m.codigo)} hitSlop={8} style={styles.starBtn}>
            <Ionicons
              name={m.esFavorita ? "star" : "star-outline"}
              size={20}
              color={m.esFavorita ? "#F4B400" : "#999"}
            />
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={{ justifyContent: "flex-end", margin: 0 }}
      backdropOpacity={0.5}
      propagateSwipe
      avoidKeyboard
      useNativeDriver
      useNativeDriverForBackdrop
      coverScreen
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 }) ?? 0}
      >
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Selecciona una moneda</Text>
            <Pressable onPress={refresh} hitSlop={10}>
              <Ionicons name="refresh" size={18} color="#666" />
            </Pressable>
          </View>

          {showSearch && (
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color="#888" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={searchPlaceholder}
                style={styles.searchInput}
                placeholderTextColor="#9aa0a6"
                returnKeyType="search"
              />
              {!!q && (
                <Pressable onPress={() => setQ("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#bbb" />
                </Pressable>
              )}
            </View>
          )}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Cargando monedas…</Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: maxListHeight }}
              contentContainerStyle={{ paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled" // 👈 importante para taps con teclado abierto
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
              showsVerticalScrollIndicator={false}
            >
              {data.totalFavoritas > 0 && (
                <>
                  <Text style={styles.groupTitle}>★ Favoritas ({favoritasFiltradas.length})</Text>
                  <View style={styles.groupCard}>
                    {favoritasFiltradas.map((m) => (
                      <Row key={m.id} m={m} />
                    ))}
                    {favoritasFiltradas.length === 0 && (
                      <Text style={styles.emptyText}>No hay favoritas para “{q}”.</Text>
                    )}
                  </View>
                </>
              )}

              <Text
                style={[styles.groupTitle, { marginTop: data.totalFavoritas ? 16 : 0 }]}
              >
                $ Todas ({otrasFiltradas.length})
              </Text>
              <View style={styles.groupCard}>
                {otrasFiltradas.map((m) => (
                  <Row key={m.id} m={m} />
                ))}
                {otrasFiltradas.length === 0 && (
                  <Text style={styles.emptyText}>Sin resultados para “{q}”.</Text>
                )}
              </View>
            </ScrollView>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>Cerrar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export type CurrencyFieldProps = {
  label?: string;
  value?: Moneda | null;
  onChange?: (moneda: Moneda) => void;
  placeholder?: string;
  disabled?: boolean;
  getAuthToken?: () => Promise<string | null>;
  showSearch?: boolean;
  maxListHeight?: number;
  currentCode?: string;
  allowFavorites?: boolean;
};

export const CurrencyField: React.FC<CurrencyFieldProps> = ({
  value,
  onChange,
  placeholder = "Selecciona…",
  disabled = false,
  getAuthToken,
  showSearch,
  maxListHeight,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={[styles.fieldBox, disabled && { opacity: 0.5 }]}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.fieldValue}>
          {value ? `${value.nombre} (${value.codigo}) ${value.simbolo}` : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </Pressable>

      <CurrencyPicker
        visible={open}
        onClose={() => setOpen(false)}
        value={value?.codigo}
        onSelect={(m) => {
          onChange?.(m);
          setOpen(false);
        }}
        getAuthToken={getAuthToken}
        showSearch={showSearch}
        maxListHeight={maxListHeight}
      />
    </>
  );
};

const styles = StyleSheet.create({
  // Sheet
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 26,
    paddingBottom: 0,
    maxHeight: "100%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#333" },

  // Buscador
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 10,
  },
  searchInput: { flex: 1, color: "#222", fontSize: 14 },

  // Listas
  loadingWrap: { alignItems: "center", paddingVertical: 20 },
  loadingText: { marginTop: 6, fontSize: 12, color: "#777" },
  groupTitle: { fontSize: 13, fontWeight: "700", color: "#555", marginBottom: 8 },
  groupCard: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  emptyText: {
    padding: 14,
    textAlign: "center",
    color: "#888",
    fontSize: 12,
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  bubble: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#f0f0f3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  bubbleTxt: { fontSize: 14, fontWeight: "700", color: "#444" },
  mName: { fontSize: 14, color: "#222", fontWeight: "600" },
  mCode: { fontSize: 12, color: "#777", fontWeight: "500" },
  badgesLine: { flexDirection: "row", gap: 6, marginTop: 2 },
  badgePrincipal: {
    fontSize: 10,
    color: "#EF6C00",
    backgroundColor: "rgba(239,108,0,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  badgeSel: {
    fontSize: 10,
    color: "#2563eb",
    backgroundColor: "rgba(37,99,235,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  starBtn: { padding: 6, marginLeft: 8 },

  // Field
  fieldLabel: { fontSize: 14, color: "#444", marginBottom: 6 },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 10,
    justifyContent: "space-between",
  },
  fieldValue: { fontSize: 14, color: "#333", marginRight: 8 },

  closeBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  closeTxt: { color: "#888", fontSize: 13 },
});
