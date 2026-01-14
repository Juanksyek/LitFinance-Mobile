import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { apiRateLimiter } from "../services/apiRateLimiter";
import { API_BASE_URL } from "../constants/api";
import { useThemeColors } from "../theme/useThemeColors";

interface Concepto {
  conceptoId: string;
  nombre: string;
  color: string;
  icono?: string;
}

interface Props {
  onClose: () => void;
}

type FormMode = "create" | "edit";
type FormState = {
  mode: FormMode;
  conceptoId?: string;
  nombre: string;
  color: string;
  icono: string;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;

const COLORS = [
  "#FFA726",
  "#EF5350",
  "#42A5F5",
  "#AB47BC",
  "#66BB6A",
  "#FF7043",
  "#26A69A",
  "#5C6BC0",
  "#FFCA28",
  "#8D6E63",
  "#BDBDBD",
  "#78909C",
  "#7E57C2",
  "#D4E157",
  "#26C6DA",
];

const QUICK_EMOJIS = [
  "💰",
  "🛒",
  "🍽️",
  "🚗",
  "🏠",
  "🎉",
  "📌",
  "📈",
  "💡",
  "🎁",
  "📊",
  "🧾",
  "✈️",
  "☕️",
  "🧠",
  "🏥",
  "📚",
  "🐶",
  "👕",
  "🎮",
  "🍿",
];

const DEFAULT_ICON = "📌";

function useDebouncedValue<T>(value: T, delay = 280) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Arregla “mojibake” típico (UTF-8 interpretado como Latin-1) para emojis/símbolos.
function fixMojibake(input: string) {
  if (!input) return input;
  const suspicious = /Ã|Â|â|ï|�/.test(input);
  if (!suspicious) return input;

  try {
    const bytes = Uint8Array.from(Array.from(input).map((ch) => ch.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (decoded && !/Ã|Â|â|ï|�/.test(decoded)) return decoded;
    return decoded || input;
  } catch {
    return input;
  }
}

function takeFirstGrapheme(s: string) {
  const trimmed = (s ?? "").trim();
  if (!trimmed) return "";
  return Array.from(trimmed)[0] ?? trimmed;
}

const emojiFontFix = Platform.select({
  ios: { fontFamily: "System" },
  android: { fontFamily: "sans-serif" },
  default: {},
});

function shortId(id: string) {
  if (!id) return "";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-3)}`;
}

const ConceptsManager: React.FC<Props> = ({ onClose }) => {
  const colors = useThemeColors();

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  const [loading, setLoading] = useState(false);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const lastConceptosRef = useRef<Concepto[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    mode: "create",
    nombre: "",
    color: COLORS[0],
    icono: DEFAULT_ICON,
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
      } catch {}
    }
  }, []);

  const activeIcon = useMemo(() => {
    const raw = form.icono?.trim() || DEFAULT_ICON;
    const fixed = fixMojibake(raw);
    return fixed || DEFAULT_ICON;
  }, [form.icono]);

  const activeColor = form.color || COLORS[0];

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
  }, []);

  const resetToCreate = useCallback(() => {
    setForm({
      mode: "create",
      nombre: "",
      color: COLORS[0],
      icono: DEFAULT_ICON,
    });
  }, []);

  const openEdit = useCallback((c: Concepto) => {
    setForm({
      mode: "edit",
      conceptoId: c.conceptoId,
      nombre: c.nombre ?? "",
      color: c.color ?? COLORS[0],
      icono: fixMojibake(c.icono ?? DEFAULT_ICON) || DEFAULT_ICON,
    });
  }, []);

  const fetchConceptos = useCallback(async () => {
    const q = (debouncedQuery ?? "").trim();
    try {
      setLoading(true);
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/conceptos?search=${encodeURIComponent(q)}`);
      if (!res.ok) {
        try {
          await res.json();
        } catch {}
        setConceptos([]);
        lastConceptosRef.current = [];
        return;
      }

      const data = await res.json();
      const resultados = data?.resultados ?? data?.data ?? data ?? [];
      const items = Array.isArray(resultados)
        ? resultados
        : Array.isArray(resultados?.items)
        ? resultados.items
        : [];

      const normalized: Concepto[] = items.map((it: any) => ({
        conceptoId: it.conceptoId ?? it.id ?? String(it._id ?? Math.random()),
        nombre: it.nombre ?? it.name ?? "",
        color: it.color ?? it.hex ?? COLORS[0],
        icono: fixMojibake(it.icono ?? it.icon ?? "") ?? "",
      }));

      lastConceptosRef.current = normalized;
      setConceptos(normalized);

      if (expandedId && !normalized.some((c) => c.conceptoId === expandedId)) {
        setExpandedId(null);
      }
    } catch {
      setConceptos([]);
      Toast.show({ type: "error", text1: "Error al cargar conceptos", text2: "Intenta más tarde." });
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, expandedId]);

  useEffect(() => {
    fetchConceptos();
  }, [fetchConceptos]);

  const crearConcepto = useCallback(async () => {
    const nombre = form.nombre.trim();
    if (!nombre) {
      Toast.show({ type: "info", text1: "Escribe un nombre para el concepto" });
      return;
    }

    const iconoFinal = takeFirstGrapheme(fixMojibake(form.icono || DEFAULT_ICON)) || DEFAULT_ICON;

    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/conceptos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, color: form.color, icono: iconoFinal }),
      });

      if (!res.ok) throw new Error("Error al crear");

      Toast.show({ type: "success", text1: "Concepto creado" });
      resetToCreate();
      setTimeout(() => fetchConceptos(), 250);
    } catch {
      Toast.show({ type: "error", text1: "Error al crear concepto" });
    }
  }, [fetchConceptos, form.color, form.icono, form.nombre, resetToCreate]);

  const guardarEdicion = useCallback(async () => {
    if (form.mode !== "edit" || !form.conceptoId) return;

    const nextNombre = form.nombre.trim();
    if (!nextNombre) {
      Toast.show({ type: "error", text1: "El nombre no puede estar vacío" });
      return;
    }

    const original = conceptos.find((c) => c.conceptoId === form.conceptoId);
    const nextIcon = takeFirstGrapheme(fixMojibake(form.icono || DEFAULT_ICON)) || DEFAULT_ICON;

    const payload: Partial<Pick<Concepto, "nombre" | "color" | "icono">> = {};
    if (!original || nextNombre !== original.nombre) payload.nombre = nextNombre;
    if (!original || form.color !== original.color) payload.color = form.color;
    if (!original || nextIcon !== (original.icono ?? "")) payload.icono = nextIcon;

    if (Object.keys(payload).length === 0) {
      Toast.show({ type: "info", text1: "Sin cambios para guardar" });
      resetToCreate();
      return;
    }

    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/conceptos/${form.conceptoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error al editar");

      Toast.show({ type: "success", text1: "Concepto actualizado" });
      resetToCreate();
      setTimeout(() => fetchConceptos(), 220);
    } catch {
      Toast.show({ type: "error", text1: "Error al editar concepto" });
    }
  }, [conceptos, fetchConceptos, form, resetToCreate]);

  const openDeleteConfirm = useCallback((id: string) => {
    setConfirmDeleteId(id);
    setShowDeleteModal(true);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setShowDeleteModal(false);
    setConfirmDeleteId(null);
  }, []);

  const eliminarConcepto = useCallback(
    async (conceptoId: string) => {
      setDeletingId(conceptoId);
      const previous = lastConceptosRef.current;

      try {
        lastConceptosRef.current = lastConceptosRef.current.filter((c) => c.conceptoId !== conceptoId);
        setConceptos((prev) => prev.filter((c) => c.conceptoId !== conceptoId));

        const res = await apiRateLimiter.fetch(`${API_BASE_URL}/conceptos/${conceptoId}`, { method: "DELETE" });

        if (!res.ok) {
          lastConceptosRef.current = previous;
          setConceptos(previous);
          throw new Error("Error al eliminar");
        }

        Toast.show({ type: "success", text1: "Concepto eliminado" });
        if (expandedId === conceptoId) setExpandedId(null);
        setTimeout(() => fetchConceptos(), 220);
      } catch {
        Toast.show({ type: "error", text1: "Error al eliminar concepto" });
      } finally {
        setDeletingId(null);
        closeDeleteConfirm();
      }
    },
    [closeDeleteConfirm, expandedId, fetchConceptos]
  );

  const pickColor = useCallback((hex: string) => setForm((s) => ({ ...s, color: hex })), []);
  const pickEmoji = useCallback((emoji: string) => {
    setForm((s) => ({ ...s, icono: emoji }));
    setShowEmojiPicker(false);
  }, []);
  const applyEmojiFromInput = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setForm((s) => ({ ...s, icono: "" }));
      return;
    }
    setForm((s) => ({ ...s, icono: takeFirstGrapheme(trimmed) }));
  }, []);

  const isEdit = form.mode === "edit";

  // ✅ LISTA “lista” (no grid): minimalista, animada, con expansión suave
  const ConceptRow = useCallback(
    ({ item, index }: { item: Concepto; index: number }) => {
      const isExpanded = expandedId === item.conceptoId;
      const icon = fixMojibake(item.icono ?? "")?.trim() || DEFAULT_ICON;

      const scale = useRef(new Animated.Value(1)).current;
      const appear = useRef(new Animated.Value(0)).current;

      useEffect(() => {
        // micro-anim de aparición por fila (suave y rápido)
        Animated.timing(appear, {
          toValue: 1,
          duration: 180,
          delay: Math.min(index * 18, 140),
          useNativeDriver: true,
        }).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const pressIn = () => {
        Animated.spring(scale, {
          toValue: 0.99,
          useNativeDriver: true,
          speed: 30,
          bounciness: 0,
        }).start();
      };

      const pressOut = () => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 26,
          bounciness: 7,
        }).start();
      };

      const toggleExpand = () => {
        animateLayout();
        setExpandedId((prev) => (prev === item.conceptoId ? null : item.conceptoId));
      };

      return (
        <Animated.View
          style={[
            styles.rowWrap,
            {
              opacity: appear,
              transform: [{ scale }, { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
            },
          ]}
        >
          <Pressable
            onPress={toggleExpand}
            onPressIn={pressIn}
            onPressOut={pressOut}
            style={[
              styles.row,
              {
                backgroundColor: colors.card,
                borderColor: isExpanded ? item.color : colors.border,
                shadowColor: isExpanded ? item.color : "#000",
                opacity: deletingId === item.conceptoId ? 0.45 : 1,
              },
            ]}
          >
            {/* Accent line */}
            <View style={[styles.rowAccent, { backgroundColor: item.color }]} />

            {/* Left: icon */}
            <View style={[styles.rowIconBadge, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <Text style={[styles.rowIconText, { color: colors.text }]}>{icon}</Text>
            </View>

            {/* Center: name + meta */}
            <View style={styles.rowCenter}>
              <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                {item.nombre}
              </Text>

              {isExpanded ? (
                <Text style={[styles.rowMetaExpanded, { color: colors.textSecondary }]} numberOfLines={1}>
                  ID: {item.conceptoId}
                </Text>
              ) : (
                <Text style={[styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  ID: {shortId(item.conceptoId)}
                </Text>
              )}
            </View>

            {/* Right: dot + chevron */}
            <View style={styles.rowRight}>
              <View style={[styles.rowDot, { backgroundColor: item.color, borderColor: colors.card }]} />
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textSecondary}
              />
            </View>

            {/* Expanded actions */}
            {isExpanded ? (
              <View style={[styles.rowExpandedArea, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => {
                    animateLayout();
                    openEdit(item);
                    setExpandedId(null);
                  }}
                  style={[styles.rowActionPill, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                >
                  <Ionicons name="create-outline" size={16} color={colors.button} />
                  <Text style={[styles.rowActionText, { color: colors.text }]}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={!!deletingId}
                  onPress={() => openDeleteConfirm(item.conceptoId)}
                  style={[styles.rowActionPill, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={[styles.rowActionText, { color: colors.error }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      );
    },
    [
      animateLayout,
      colors.border,
      colors.button,
      colors.card,
      colors.cardSecondary,
      colors.error,
      colors.text,
      colors.textSecondary,
      deletingId,
      expandedId,
      openDeleteConfirm,
      openEdit,
    ]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.cardSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Mis Conceptos</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Lista limpia, dinámica y minimal ✨</Text>
        </View>

        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={26} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
        <TextInput
          placeholder="Buscar concepto…"
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: colors.inputText }]}
          placeholderTextColor={colors.placeholder}
        />

        {loading ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : query ? (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Form Card */}
      <View style={[styles.formCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <View style={styles.formTopRow}>
          <View style={styles.previewWrap}>
            <View style={[styles.previewIcon, { backgroundColor: colors.card, borderColor: activeColor }]}>
              <Text style={[styles.previewIconText, { color: colors.text }]}>{activeIcon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.formTitle, { color: colors.text }]}>
                {isEdit ? "Editando concepto" : "Crear concepto"}
              </Text>
              <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                {isEdit ? "Guarda cambios o cancela" : "Nombre, emoji y color"}
              </Text>
            </View>
          </View>

          {isEdit ? (
            <TouchableOpacity
              onPress={() => {
                animateLayout();
                resetToCreate();
              }}
              style={[styles.cancelPill, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
              activeOpacity={0.86}
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TextInput
          placeholder={isEdit ? "Nombre del concepto…" : "Ej. Viajes, Café, Renta…"}
          value={form.nombre}
          onChangeText={(v) => setForm((s) => ({ ...s, nombre: v }))}
          style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.inputText }]}
          placeholderTextColor={colors.placeholder}
        />

        <View style={styles.emojiRow}>
          <TouchableOpacity
            onPress={() => setShowEmojiPicker(true)}
            activeOpacity={0.86}
            style={[styles.emojiPickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.emojiPickBtnText, { color: colors.text }]}>{activeIcon}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            value={form.icono}
            onChangeText={applyEmojiFromInput}
            placeholder="Escribe un emoji…"
            placeholderTextColor={colors.placeholder}
            style={[styles.emojiInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.inputText }]}
            maxLength={6}
            keyboardType="default"
            returnKeyType="done"
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.text }]}>Color</Text>
        <View style={styles.colorGrid}>
          {COLORS.map((c) => {
            const selected = activeColor === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => pickColor(c)}
                activeOpacity={0.86}
                style={[
                  styles.colorCircle,
                  {
                    backgroundColor: c,
                    borderWidth: selected ? 2 : 0,
                    borderColor: selected ? colors.text : "transparent",
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          onPress={isEdit ? guardarEdicion : crearConcepto}
          activeOpacity={0.88}
          style={[styles.primaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons
            name={isEdit ? "checkmark-circle-outline" : "add-circle-outline"}
            size={22}
            color={isEdit ? "#059669" : "#EF6C00"}
          />
          <Text style={[styles.primaryBtnText, { color: colors.text }]}>
            {isEdit ? "Guardar cambios" : "Crear concepto"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {conceptos.length === 0 && !loading ? (
        <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aún no tienes conceptos</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Crea uno arriba y aparecerá aquí para reutilizarlo en tus movimientos.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conceptos}
          keyExtractor={(item) => item.conceptoId}
          renderItem={({ item, index }) => <ConceptRow item={item} index={index} />}
          style={{ maxHeight: SCREEN_HEIGHT * 0.44, minHeight: SCREEN_HEIGHT * 0.24 }}
          contentContainerStyle={{ paddingBottom: 22 }}
          showsVerticalScrollIndicator
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={9}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* Emoji Picker */}
      <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.18)" }]}>
          <View style={[styles.emojiModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.emojiModalHeader}>
              <Text style={[styles.emojiModalTitle, { color: colors.text }]}>Elige un símbolo</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.emojiGrid}>
              {QUICK_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => pickEmoji(e)}
                  activeOpacity={0.86}
                  style={[styles.emojiCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                >
                  <Text style={[styles.emojiCellText, { color: colors.text }]}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.emojiTip, { color: colors.textSecondary }]}>
              Tip: también puedes escribir un emoji directamente en el campo.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={closeDeleteConfirm}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.18)" }]}>
          <View style={[styles.deleteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.deleteTitle, { color: colors.text }]}>¿Eliminar concepto?</Text>
            <Text style={[styles.deleteText, { color: colors.textSecondary }]}>Esta acción no se puede deshacer.</Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={closeDeleteConfirm}
                activeOpacity={0.88}
              >
                <Text style={[styles.deleteBtnText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={() => {
                  if (!confirmDeleteId) return;
                  eliminarConcepto(confirmDeleteId);
                }}
                activeOpacity={0.88}
                disabled={!confirmDeleteId}
              >
                <Text style={[styles.deleteBtnText, { color: colors.error }]}>
                  {deletingId ? "Eliminando…" : "Eliminar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxHeight: SCREEN_HEIGHT * 0.95,
    minHeight: SCREEN_HEIGHT * 0.7,
    padding: 22,
    borderRadius: 28,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },

  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  formTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  previewWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  previewIconText: {
    fontSize: 22,
    includeFontPadding: false,
    ...emojiFontFix,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  formHint: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  cancelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 10,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: "800",
  },

  nameInput: {
    width: "100%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 10,
  },

  emojiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  emojiPickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    width: 92,
  },
  emojiPickBtnText: {
    fontSize: 18,
    includeFontPadding: false,
    ...emojiFontFix,
  },
  emojiInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    fontSize: 16,
    borderWidth: 1,
    ...emojiFontFix,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 8,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
  },

  primaryBtn: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "900",
  },

  // ===== LISTA (NO GRID) =====
  rowWrap: {
    width: "100%",
  },
  row: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    overflow: "hidden",
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 4,
  },
  rowAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  rowIconBadge: {
    width: 46,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: {
    fontSize: 18,
    includeFontPadding: false,
    ...emojiFontFix,
  },
  rowTop: {},
  rowCenter: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.95,
  },
  rowMetaExpanded: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Layout for row main content
  // (icon + center + right) in one line
  // then expanded area below
  // NOTE: this relies on parent row being a column; we build it with the wrapper below
  // We'll do that by applying this style through inline composition:
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
  },

  rowExpandedArea: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
  },
  rowActionPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  rowActionText: {
    fontSize: 12.5,
    fontWeight: "900",
  },

  emptyWrap: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },

  emojiModal: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  emojiModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  emojiModalTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  emojiCell: {
    width: 52,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiCellText: {
    fontSize: 18,
    includeFontPadding: false,
    ...emojiFontFix,
  },
  emojiTip: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "600",
  },

  deleteCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  deleteTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  deleteText: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 14,
  },
  deleteActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  deleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "900",
  },
});

export default ConceptsManager;
