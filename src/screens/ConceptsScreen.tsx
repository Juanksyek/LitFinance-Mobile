import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { apiRateLimiter } from "../services/apiRateLimiter";
import { fixMojibake, takeFirstGrapheme, emojiFontFix } from '../utils/fixMojibake';
import Toast from "react-native-toast-message";
import { API_BASE_URL } from "../constants/api";
import { useThemeColors } from "../theme/useThemeColors";

interface Concepto {
  conceptoId: string;
  nombre: string;
  color: string;
  icono?: string;
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

// Debounced value hook
function useDebouncedValue<T>(value: T, delay = 280) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function shortId(id: string) {
  if (!id) return "";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-3)}`;
}

const ConceptsScreen: React.FC = () => {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topInset = insets?.top ?? (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
  const bottomInset = insets?.bottom ?? 0;

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  const [loading, setLoading] = useState(false);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const lastConceptosRef = useRef<Concepto[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  // Entry animations for header and form
  const headerY = useRef(new Animated.Value(-28)).current;
  const formScale = useRef(new Animated.Value(0.98)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerY, { toValue: 0, duration: 420, useNativeDriver: true }),
      Animated.spring(formScale, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [headerY, formScale]);

  const activeIcon = useMemo(() => {
    const raw = form.icono?.trim() || DEFAULT_ICON;
    return takeFirstGrapheme(fixMojibake(raw)) || DEFAULT_ICON;
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
      if (!refreshing) setLoading(true);
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
        icono: fixMojibake(it.icono ?? it.icon ?? "") || DEFAULT_ICON,
      }));

      lastConceptosRef.current = normalized;
      setConceptos(normalized);
      // Reset visible count for lazy rendering
      setVisibleCount(Math.min(12, normalized.length));

      if (expandedId && !normalized.some((c) => c.conceptoId === expandedId)) {
        setExpandedId(null);
      }
    } catch {
      setConceptos([]);
      Toast.show({ type: "error", text1: "Error al cargar conceptos", text2: "Intenta más tarde." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedQuery, expandedId, refreshing]);

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
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ nombre, color: form.color, icono: iconoFinal }),
      });

      if (!res.ok) throw new Error("Error al crear");

      let createdBody: any = null;
      try {
        createdBody = await res.json();
      } catch {}

      const created: Concepto = createdBody
        ? {
            conceptoId: createdBody.conceptoId ?? createdBody.id ?? String(createdBody._id ?? Math.random()),
            nombre: createdBody.nombre ?? createdBody.name ?? nombre,
            color: createdBody.color ?? createdBody.hex ?? form.color,
            icono: fixMojibake(createdBody.icono ?? createdBody.icon ?? iconoFinal) || DEFAULT_ICON,
          }
        : {
            conceptoId: String(Math.random()),
            nombre,
            color: form.color,
            icono: iconoFinal,
          };

      // Insert locally so user sees it immediately
      animateLayout();
      setConceptos((prev) => [created, ...prev]);
      lastConceptosRef.current = [created, ...lastConceptosRef.current];
      // ensure newly created item is visible
      setVisibleCount((v) => Math.max(12, Math.min(v + 1, lastConceptosRef.current.length)));

      Toast.show({ type: "success", text1: "Concepto creado" });
      resetToCreate();
    } catch {
      Toast.show({ type: "error", text1: "Error al crear concepto" });
    }
  }, [form.color, form.icono, form.nombre, resetToCreate]);

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
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error al editar");

      let updatedBody: any = null;
      try {
        updatedBody = await res.json();
      } catch {}

      const originalItem = conceptos.find((c) => c.conceptoId === form.conceptoId) ??
        lastConceptosRef.current.find((c) => c.conceptoId === form.conceptoId) ?? {
          conceptoId: form.conceptoId,
          nombre: form.nombre,
          color: form.color,
          icono: form.icono,
        };

      const updated: Concepto = updatedBody
        ? {
            conceptoId: updatedBody.conceptoId ?? updatedBody.id ?? String(updatedBody._id ?? form.conceptoId),
            nombre: updatedBody.nombre ?? updatedBody.name ?? originalItem.nombre,
            color: updatedBody.color ?? updatedBody.hex ?? originalItem.color,
            icono: fixMojibake(updatedBody.icono ?? updatedBody.icon ?? originalItem.icono) || DEFAULT_ICON,
          }
        : { ...originalItem, ...payload } as Concepto;

      // Apply change locally so user sees update immediately
      animateLayout();
      setConceptos((prev) => prev.map((c) => (c.conceptoId === updated.conceptoId ? updated : c)));
      lastConceptosRef.current = lastConceptosRef.current.map((c) =>
        c.conceptoId === updated.conceptoId ? updated : c
      );

      // make sure edited item remains in visible window
      setVisibleCount((v) => Math.max(v, 12));

      Toast.show({ type: "success", text1: "Concepto actualizado" });
      resetToCreate();
    } catch {
      Toast.show({ type: "error", text1: "Error al editar concepto" });
    }
  }, [conceptos, form, resetToCreate]);

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
        setVisibleCount((v) => Math.min(v, Math.max(0, lastConceptosRef.current.length)));

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
    const clean = takeFirstGrapheme(fixMojibake(emoji || DEFAULT_ICON)) || DEFAULT_ICON;
    setForm((s) => ({ ...s, icono: clean }));
    setShowEmojiPicker(false);
  }, []);
  const applyEmojiFromInput = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setForm((s) => ({ ...s, icono: "" }));
      return;
    }
    const cleaned = takeFirstGrapheme(fixMojibake(trimmed)) || "";
    setForm((s) => ({ ...s, icono: cleaned }));
  }, []);

  const isEdit = form.mode === "edit";

  // Lazy-loading within already-fetched conceptos: progressively render more items
  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (visibleCount >= conceptos.length) return;
    setLoadingMore(true);
    // small delay for nicer UX and allow animation
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 10, conceptos.length));
      setLoadingMore(false);
    }, 350);
  }, [loading, loadingMore, visibleCount, conceptos.length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConceptos();
  }, [fetchConceptos]);

  // Row component for concept list
  const ConceptRow = useCallback(
    ({ item, index }: { item: Concepto; index: number }) => {
      const isExpanded = expandedId === item.conceptoId;
      const icon = takeFirstGrapheme(fixMojibake(item.icono ?? "")) || DEFAULT_ICON;

      const scale = useRef(new Animated.Value(1)).current;
      const appear = useRef(new Animated.Value(0)).current;

      useEffect(() => {
        Animated.timing(appear, {
          toValue: 1,
          duration: 220,
          delay: Math.min(index * 22, 180),
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
            <View style={[styles.rowAccent, { backgroundColor: item.color }]} />

            <View style={styles.rowMain}>
              <View style={[styles.rowIconBadge, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <Text style={[styles.rowIconText, emojiFontFix]}>{icon}</Text>
              </View>

              <View style={styles.rowCenter}>
                <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>ID: {shortId(item.conceptoId)}</Text>
              </View>

              <View style={styles.rowRight}>
                <View style={[styles.rowDot, { backgroundColor: item.color, borderColor: colors.card }]} />
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
              </View>
            </View>

            {isExpanded ? (
              <View style={[styles.rowExpandedArea, { borderTopColor: colors.border }]}> 
                <TouchableOpacity onPress={() => openEdit(item)} style={[styles.rowActionPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                  <Ionicons name="pencil" size={18} color={colors.button} />
                  <Text style={[styles.rowActionText, { color: colors.button }]}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => openDeleteConfirm(item.conceptoId)} disabled={!!deletingId} style={[styles.rowActionPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
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
      colors.backgroundSecondary,
      deletingId,
      expandedId,
      openDeleteConfirm,
      openEdit,
    ]
  );

  // Skeleton placeholder row for initial loading
  const SkeletonRow = ({ index }: { index: number }) => {
    const pulse = useRef(new Animated.Value(0.6)).current;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }, [pulse]);

    return (
      <Animated.View style={[styles.rowWrap, { opacity: pulse }]}> 
        <View style={[styles.row, { backgroundColor: colors.card }]}>
          <View style={styles.rowMain}>
            <View style={[styles.rowIconBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ height: 14, width: '60%', backgroundColor: colors.backgroundSecondary, borderRadius: 6, marginBottom: 8 }} />
              <View style={{ height: 12, width: '35%', backgroundColor: colors.backgroundSecondary, borderRadius: 6 }} />
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: topInset + 8 }]}>
      {/* Header */}
      <Animated.View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, transform: [{ translateY: headerY }] }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text }]}>Mis Conceptos</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{isEdit ? "Editando concepto" : "Gestiona tus categorías"}</Text>
        </View>
        <View style={{ width: 26 }} />
      </Animated.View>

      <View style={[styles.content, { paddingBottom: Math.max(20, bottomInset + 12) }]}> 
        {/* Search */}
        <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
          <TextInput placeholder="Buscar concepto…" value={query} onChangeText={setQuery} style={[styles.searchInput, { color: colors.inputText }]} placeholderTextColor={colors.placeholder} />

          {loading ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : query ? (
            <TouchableOpacity onPress={() => setQuery("")}> 
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Form Card */}
        <Animated.View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale: formScale }] }]}> 
          <View style={styles.formTopRow}>
            <View style={styles.previewWrap}>
              <View style={[styles.previewIcon, { backgroundColor: activeColor + "30", borderColor: activeColor }]}>
                <Text style={styles.previewIconText}>{takeFirstGrapheme(fixMojibake(activeIcon || DEFAULT_ICON))}</Text>
              </View>
              <View>
                <Text style={[styles.formTitle, { color: colors.text }]}>{isEdit ? "Editar" : "Nuevo"}</Text>
                <Text style={[styles.formHint, { color: colors.textSecondary }]}>{isEdit ? "Actualiza los detalles" : "Crea un concepto"}</Text>
              </View>
            </View>

            {isEdit ? (
              <TouchableOpacity onPress={resetToCreate} style={[styles.cancelPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}> 
                <Ionicons name="close" size={14} color={colors.textSecondary} />
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TextInput placeholder={isEdit ? "Nombre del concepto…" : "Ej. Viajes, Café, Renta…"} value={form.nombre} onChangeText={(v) => setForm((s) => ({ ...s, nombre: v }))} style={[styles.nameInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.inputText }]} placeholderTextColor={colors.placeholder} />

          <View style={styles.emojiRow}>
            <TouchableOpacity onPress={() => setShowEmojiPicker(true)} style={[styles.emojiPickBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Text style={styles.emojiPickBtnText}>{takeFirstGrapheme(fixMojibake(activeIcon || DEFAULT_ICON))}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
            </TouchableOpacity>

            <TextInput value={form.icono} onChangeText={applyEmojiFromInput} placeholder="Escribe un emoji…" placeholderTextColor={colors.placeholder} style={[styles.emojiInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.inputText }]} maxLength={6} keyboardType="default" returnKeyType="done" />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.text }]}>Color</Text>
          <View style={styles.colorGrid}>
            {COLORS.map((color) => (
              <TouchableOpacity key={color} style={[styles.colorCircle, { backgroundColor: color, borderWidth: activeColor === color ? 3 : 0, borderColor: colors.text }]} onPress={() => pickColor(color)} />
            ))}
          </View>

          <TouchableOpacity onPress={isEdit ? guardarEdicion : crearConcepto} activeOpacity={0.88} style={[styles.primaryBtn, { backgroundColor: activeColor }]}> 
            <Ionicons name={isEdit ? "checkmark-circle-outline" : "add-circle-outline"} size={22} color="#FFF" />
            <Text style={[styles.primaryBtnText, { color: "#FFF" }]}>{isEdit ? "Guardar cambios" : "Crear concepto"}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* List: show skeletons when initial loading and no data */}
        {loading && conceptos.length === 0 ? (
          <View>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={`skeleton-${i}`} index={i} />
            ))}
          </View>
        ) : conceptos.length === 0 && !loading ? (
          <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Ionicons name="albums-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Aún no tienes conceptos</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Crea uno arriba y aparecerá aquí para reutilizarlo en tus movimientos.</Text>
          </View>
        ) : (
          <FlatList
            data={conceptos.slice(0, visibleCount)}
            keyExtractor={(item) => item.conceptoId}
            renderItem={({ item, index }) => <ConceptRow item={item} index={index} />}
            contentContainerStyle={{ paddingBottom: 22 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={10}
            windowSize={9}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.6}
            ListFooterComponent={() => (
              <View style={{ paddingVertical: 12 }}>
                {loadingMore ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
              </View>
            )}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </View>

      {/* Emoji Picker */}
      <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.emojiModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.emojiModalHeader}>
              <Text style={[styles.emojiModalTitle, { color: colors.text }]}>Elige un emoji</Text>
              <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.emojiGrid}>
              {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity key={emoji} onPress={() => pickEmoji(emoji)} style={[styles.emojiCell, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                  <Text style={styles.emojiCellText}>{takeFirstGrapheme(fixMojibake(emoji))}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.emojiTip, { color: colors.textSecondary }]}>💡 También puedes escribir cualquier emoji directamente en el campo de texto</Text>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={closeDeleteConfirm}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.deleteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.deleteIconContainer, { backgroundColor: colors.error + "20" }]}>
              <Ionicons name="trash" size={32} color={colors.error} />
            </View>
            <Text style={[styles.deleteTitle, { color: colors.text }]}>¿Eliminar concepto?</Text>
            <Text style={[styles.deleteText, { color: colors.textSecondary }]}>Esta acción no se puede deshacer.</Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} onPress={closeDeleteConfirm}>
                <Text style={[styles.deleteBtnText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: colors.error, borderColor: colors.error }]} onPress={() => { if (confirmDeleteId) eliminarConcepto(confirmDeleteId); }}>
                <Text style={[styles.deleteBtnText, { color: "#FFF" }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    zIndex: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },

  content: {
    flex: 1,
    padding: 20,
    marginTop: 8,
    paddingTop: 6,
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
    width: 32,
    height: 32,
    borderRadius: 999,
  },

  primaryBtn: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "900",
  },

  // List styles
  rowWrap: {
    width: "100%",
  },
  row: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    overflow: "hidden",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
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
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
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
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  deleteIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
    textAlign: "center",
  },
  deleteText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  deleteActions: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "900",
  },
});

export default ConceptsScreen;
