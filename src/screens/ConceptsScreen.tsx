import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
  ScrollView,
  RefreshControl,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useStableSafeInsets } from "../hooks/useStableSafeInsets";
import EventBus from "../utils/eventBus";
import { apiRateLimiter } from "../services/apiRateLimiter";
import Toast from "react-native-toast-message";
import { API_BASE_URL } from "../constants/api";
import { useThemeColors } from "../theme/useThemeColors";

interface Concepto {
  conceptoId: string;
  nombre: string;
  color: string;
  icono?: string; // Ionicon name
}

type FormMode = "create" | "edit";
type FormState = {
  mode: FormMode;
  conceptoId?: string;
  nombre: string;
  color: string;
  icono: string; // Ionicon name
};

const SCREEN_H = Dimensions.get("window").height;

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

// quick icons row
const IONICON_QUICK = [
  "sparkles-outline",
  "airplane-outline",
  "wallet-outline",
  "car-outline",
  "heart-outline",
  "gift-outline",
  "restaurant-outline",
  "cart-outline",
  "home-outline",
  "beer-outline",
] as const;

const DEFAULT_ICON = "pricetag-outline";

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

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const withAlpha = (color: string, alpha: number) => {
  const a = clamp(alpha, 0, 1);
  const c = (color || "").trim();
  if (c.startsWith("#")) {
    const hex = c.replace("#", "");
    const full = hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      if ([r, g, b].every((x) => Number.isFinite(x))) return `rgba(${r},${g},${b},${a})`;
    }
  }
  return c;
};

/** Full catalog (dedupe + robust) */
const RAW_ICON_CATALOG = [
  "add",
  "airplane-outline",
  "albums-outline",
  "archive-outline",
  "bar-chart-outline",
  "battery-charging-outline",
  "bed-outline",
  "bicycle-outline",
  "boat-outline",
  "book-outline",
  "bus-outline",
  "restaurant-outline",
  "beer-outline",
  "cafe-outline",
  "planet-outline",
  "musical-notes-outline",
  "images-outline",
  "camera-outline",
  "trophy-outline",
  "briefcase-outline",
  "business-outline",
  "analytics-outline",
  "gift-outline",
  "people-outline",
  "server-outline",
  "shirt-outline",
  "calculator-outline",
  "calendar-outline",
  "call-outline",
  "car-outline",
  "cart-outline",
  "cash-outline",
  "chatbubble-outline",
  "cloud-outline",
  "diamond-outline",
  "document-text-outline",
  "football-outline",
  "globe-outline",
  "heart-outline",
  "home-outline",
  "information-circle-outline",
  "key-outline",
  "laptop-outline",
  "leaf-outline",
  "library-outline",
  "list-outline",
  "locate-outline",
  "mail-outline",
  "man-outline",
  "map-outline",
  "mic-outline",
  "moon-outline",
  "newspaper-outline",
  "pause-outline",
  "paw-outline",
  "phone-portrait-outline",
  "pizza-outline",
  "pricetag-outline",
  "ribbon-outline",
  "rocket-outline",
  "save-outline",
  "school-outline",
  "shop-outline",
  "sparkles-outline",
  "star-outline",
  "storefront-outline",
  "train-outline",
  "trash-outline",
  "wallet-outline",
  "watch-outline",
  "water-outline",
  "wine-outline",
  // add a few extras (still Ionicons)
  "cash-outline",
  "card-outline",
  "create-outline",
  "cut-outline",
  "download-outline",
  "egg-outline",
  "fast-food-outline",
  "file-tray-full-outline",
  "flash-outline",
  "game-controller-outline",
  "hammer-outline",
  "headset-outline",
  "help-circle-outline",
  "ice-cream-outline",
  "infinite-outline",
  "medkit-outline",
  "megaphone-outline",
  "newspaper-outline",
  "notifications-outline",
  "nutrition-outline",
  "options-outline",
  "paper-plane-outline",
  "partly-sunny-outline",
  "paw-outline",
  "person-outline",
  "phone-portrait-outline",
  "pulse-outline",
  "receipt-outline",
  "remove",
  "repeat-outline",
  "shield-checkmark-outline",
  "skull-outline",
  "snow-outline",
  "sunny-outline",
  "sync-outline",
  "ticket-outline",
  "time-outline",
  "today-outline",
  "trending-up-outline",
  "tv-outline",
  "umbrella-outline",
  "videocam-outline",
  "volume-high-outline",
  "warning-outline",
  "wifi-outline",
] as const;

// Additional icons and aliases to improve search (Spanish + English synonyms)
const EXTRA_ICON_ALIASES: Record<string, string[]> = {
  foco: ["bulb-outline", "flash-outline", "flashlight-outline", "sparkles-outline", "sunny-outline"],
  bombilla: ["bulb-outline", "lightbulb-outline", "flash-outline"],
  luz: ["bulb-outline", "flash-outline", "sunny-outline", "partly-sunny-outline"],
  viaje: ["airplane-outline", "car-outline", "train-outline"],
  comida: ["restaurant-outline", "pizza-outline", "fast-food-outline", "cafe-outline"],
  pago: ["card-outline", "cash-outline", "wallet-outline", "receipt-outline"],
  pago_online: ["card-outline", "card"],
  casa: ["home-outline", "house-outline"],
  hogar: ["home-outline"],
  trabajo: ["briefcase-outline", "laptop-outline"],
  deporte: ["football-outline"],
  regalo: ["gift-outline"],
  salud: ["medkit-outline"],
  transporte: ["car-outline", "bus-outline", "train-outline"],
  entretenimiento: ["film-outline", "musical-notes-outline", "game-controller-outline"],
  ahorro: ["piggy-bank-outline", "save-outline", "pricetag-outline"],
};

// Add any extra icons referenced by aliases to the RAW catalog to ensure availability
const EXTRA_ICONS = Array.from(new Set(Object.values(EXTRA_ICON_ALIASES).flat())).filter(Boolean);

const ICON_PAGE_SIZE = 48;
const ICON_COLS = 6;

function buildIconCatalog() {
  const s = new Set<string>();
  for (const i of RAW_ICON_CATALOG) {
    if (typeof i === "string" && i.trim()) s.add(i.trim());
  }
  for (const i of EXTRA_ICONS) {
    if (typeof i === "string" && i.trim()) s.add(i.trim());
  }
  // Keep stable ordering: sort but prefer "-outline" first feels consistent
  const arr = Array.from(s);
  arr.sort((a, b) => {
    const ao = a.includes("outline") ? 0 : 1;
    const bo = b.includes("outline") ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return a.localeCompare(b);
  });
  // Ensure default exists
  if (!s.has(DEFAULT_ICON)) arr.unshift(DEFAULT_ICON);
  return arr;
}

const ConceptsScreen: React.FC = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const insets = useStableSafeInsets();
  const bottomInset = insets?.bottom ?? 0;
  const EXTRA_BOTTOM_SPACE = 64;

  const ICON_CATALOG = useMemo(() => buildIconCatalog(), []);
  const ICON_SET = useMemo(() => new Set(ICON_CATALOG), [ICON_CATALOG]);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  const [loading, setLoading] = useState(false);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const lastConceptosRef = useRef<Concepto[]>([]);
  const fetchVersionRef = useRef(0);

  const [visibleCount, setVisibleCount] = useState(14);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    mode: "create",
    nombre: "",
    color: COLORS[0],
    icono: DEFAULT_ICON,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Icon picker modal (search + pagination)
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const debouncedIconQuery = useDebouncedValue(iconQuery, 220);
  const [iconPage, setIconPage] = useState(1);

  // Main scroll refs (single scroll for entire screen)
  const scrollRef = useRef<ScrollView | null>(null);
  const loadMoreLockRef = useRef(false);
  const lastLoadMoreAtRef = useRef(0);

  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
      } catch {}
    }
  }, []);

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
  }, []);

  const isEdit = form.mode === "edit";
  const activeColor = form.color || COLORS[0];

  const activeIcon = useMemo(() => {
    const ic = (form.icono || "").trim();
    return ICON_SET.has(ic) ? ic : DEFAULT_ICON;
  }, [form.icono, ICON_SET]);

  const totalCount = conceptos.length;

  const resetToCreate = useCallback(() => {
    setForm({
      mode: "create",
      nombre: "",
      color: COLORS[0],
      icono: DEFAULT_ICON,
    });
    setExpandedId(null);
  }, []);

  const openEdit = useCallback(
    (c: Concepto) => {
      animateLayout();
      setForm({
        mode: "edit",
        conceptoId: c.conceptoId,
        nombre: c.nombre ?? "",
        color: c.color ?? COLORS[0],
        icono: ICON_SET.has(String(c.icono || "").trim()) ? String(c.icono).trim() : DEFAULT_ICON,
      });

      // nice UX: jump to top so user sees the form
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo?.({ y: 0, animated: true });
      });
    },
    [ICON_SET, animateLayout]
  );

  const fetchConceptos = useCallback(async () => {
    const q = (debouncedQuery ?? "").trim();
    let fetchToken = 0;

    try {
      fetchToken = ++fetchVersionRef.current;
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
      if (fetchToken !== fetchVersionRef.current) return;

      const resultados = data?.resultados ?? data?.data ?? data ?? [];
      const items = Array.isArray(resultados)
        ? resultados
        : Array.isArray(resultados?.items)
        ? resultados.items
        : [];

      const normalized: Concepto[] = items.map((it: any) => {
        const rawIcon = typeof (it.icono ?? it.icon) === "string" ? String(it.icono ?? it.icon) : "";
        const icono = ICON_SET.has(rawIcon.trim()) ? rawIcon.trim() : DEFAULT_ICON;

        return {
          conceptoId: it.conceptoId ?? it.id ?? String(it._id ?? Math.random()),
          nombre: it.nombre ?? it.name ?? "",
          color: it.color ?? it.hex ?? COLORS[0],
          icono,
        };
      });

      lastConceptosRef.current = normalized;
      setConceptos(normalized);

      setVisibleCount(Math.min(14, normalized.length));
      if (expandedId && !normalized.some((c) => c.conceptoId === expandedId)) setExpandedId(null);
    } catch {
      setConceptos([]);
      Toast.show({ type: "error", text1: "Error al cargar conceptos", text2: "Intenta más tarde." });
    } finally {
      if (fetchToken === fetchVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [ICON_SET, debouncedQuery, expandedId, refreshing]);

  useFocusEffect(
    useCallback(() => {
      fetchConceptos();
    }, [fetchConceptos])
  );

  // Listen for global concept changes
  useEffect(() => {
    const handler = (payload?: any) => {
      try {
        if (!payload) {
          fetchConceptos();
          return;
        }

        const { type, item } = payload;
        if (type === "updated" && item?.conceptoId) {
          lastConceptosRef.current = lastConceptosRef.current.map((c) =>
            c.conceptoId === item.conceptoId ? { ...c, ...item } : c
          );
          setConceptos((prev) => prev.map((c) => (c.conceptoId === item.conceptoId ? { ...c, ...item } : c)));
        } else if (type === "created" && item) {
          lastConceptosRef.current = [item, ...lastConceptosRef.current];
          setConceptos((prev) => [item, ...prev]);
        } else if (type === "deleted" && item?.conceptoId) {
          lastConceptosRef.current = lastConceptosRef.current.filter((c) => c.conceptoId !== item.conceptoId);
          setConceptos((prev) => prev.filter((c) => c.conceptoId !== item.conceptoId));
        } else {
          fetchConceptos();
        }

        fetchVersionRef.current++;
      } catch {
        fetchConceptos();
      }
    };

    EventBus.on("conceptChanged", handler);
    return () => EventBus.off("conceptChanged", handler);
  }, [fetchConceptos]);

  const crearConcepto = useCallback(async () => {
    const nombre = form.nombre.trim();
    if (!nombre) {
      Toast.show({ type: "info", text1: "Escribe un nombre para el concepto" });
      return;
    }

    const iconoFinal = ICON_SET.has(activeIcon) ? activeIcon : DEFAULT_ICON;

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
            icono:
              typeof (createdBody.icono ?? createdBody.icon) === "string" && ICON_SET.has(String(createdBody.icono ?? createdBody.icon).trim())
                ? String(createdBody.icono ?? createdBody.icon).trim()
                : iconoFinal,
          }
        : {
            conceptoId: String(Math.random()),
            nombre,
            color: form.color,
            icono: iconoFinal,
          };

      animateLayout();
      setConceptos((prev) => [created, ...prev]);
      lastConceptosRef.current = [created, ...lastConceptosRef.current];
      setVisibleCount((v) => Math.max(14, Math.min(v + 1, lastConceptosRef.current.length)));
      fetchVersionRef.current++;

      Toast.show({ type: "success", text1: "Concepto creado" });
      resetToCreate();

      try {
        EventBus.emit("conceptChanged", { type: "created", item: created });
      } catch {}
      // ensure canonical server state is reflected shortly after create
      setTimeout(() => {
        try {
          fetchConceptos();
        } catch {}
      }, 300);
    } catch {
      Toast.show({ type: "error", text1: "Error al crear concepto" });
    }
  }, [ICON_SET, activeIcon, animateLayout, form.color, form.nombre, resetToCreate]);

  const guardarEdicion = useCallback(async () => {
    if (form.mode !== "edit" || !form.conceptoId) return;

    const nextNombre = form.nombre.trim();
    if (!nextNombre) {
      Toast.show({ type: "error", text1: "El nombre no puede estar vacío" });
      return;
    }

    const original = conceptos.find((c) => c.conceptoId === form.conceptoId);
    const nextIcon = ICON_SET.has(activeIcon) ? activeIcon : DEFAULT_ICON;

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

      const originalItem =
        conceptos.find((c) => c.conceptoId === form.conceptoId) ??
        lastConceptosRef.current.find((c) => c.conceptoId === form.conceptoId) ?? {
          conceptoId: form.conceptoId,
          nombre: form.nombre,
          color: form.color,
          icono: nextIcon,
        };

      const updated: Concepto = updatedBody
        ? {
            conceptoId: form.conceptoId,
            nombre: updatedBody.nombre ?? updatedBody.name ?? originalItem.nombre,
            color: updatedBody.color ?? updatedBody.hex ?? originalItem.color,
            icono:
              typeof (updatedBody.icono ?? updatedBody.icon) === "string" && ICON_SET.has(String(updatedBody.icono ?? updatedBody.icon).trim())
                ? String(updatedBody.icono ?? updatedBody.icon).trim()
                : (originalItem.icono ?? nextIcon),
          }
        : ({ ...originalItem, ...payload, conceptoId: form.conceptoId } as Concepto);

      animateLayout();
      setConceptos((prev) => prev.map((c) => (c.conceptoId === updated.conceptoId ? updated : c)));
      lastConceptosRef.current = lastConceptosRef.current.map((c) => (c.conceptoId === updated.conceptoId ? updated : c));
      fetchVersionRef.current++;

      Toast.show({ type: "success", text1: "Concepto actualizado" });
      resetToCreate();

      try {
        EventBus.emit("conceptChanged", { type: "updated", item: updated });
      } catch {}
      // refresh list to ensure update propagates everywhere
      setTimeout(() => {
        try {
          fetchConceptos();
        } catch {}
      }, 200);
    } catch {
      Toast.show({ type: "error", text1: "Error al editar concepto" });
    }
  }, [ICON_SET, activeIcon, animateLayout, conceptos, form, resetToCreate]);

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

        fetchVersionRef.current++;
        setTimeout(() => fetchConceptos(), 220);

        try {
          EventBus.emit("conceptChanged", { type: "deleted", item: { conceptoId } });
        } catch {}
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConceptos();
  }, [fetchConceptos]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (visibleCount >= conceptos.length) return;

    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 12, conceptos.length));
      setLoadingMore(false);
    }, 220);
  }, [conceptos.length, loading, loadingMore, visibleCount]);

  const listData = useMemo(() => conceptos.slice(0, visibleCount), [conceptos, visibleCount]);

  const onMainScroll = useCallback(
    (e: any) => {
      const now = Date.now();
      if (loadMoreLockRef.current) return;

      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent || {};
      const paddingToBottom = 240;

      const isClose =
        layoutMeasurement &&
        contentOffset &&
        contentSize &&
        layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

      if (isClose) {
        if (now - lastLoadMoreAtRef.current < 500) return;
        lastLoadMoreAtRef.current = now;
        loadMoreLockRef.current = true;
        handleLoadMore();
        setTimeout(() => {
          loadMoreLockRef.current = false;
        }, 320);
      }
    },
    [handleLoadMore]
  );

  // ---------- Icon Picker (search + pagination) ----------
  const filteredIcons = useMemo(() => {
    const qRaw = (debouncedIconQuery || "").trim().toLowerCase();
    const normalize = (s: string) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-_]/g, " ");

    const q = normalize(qRaw);
    const src = ICON_CATALOG;
    if (!q) return src;

    // tokenized query
    const tokens = q.split(/\s+/).filter(Boolean);

    // collect matches by name
    const nameMatches = src.filter((icon) => {
      const iname = normalize(icon);
      return tokens.every((t) => iname.includes(t));
    });

    // collect alias matches (map user-friendly keywords to icons)
    const aliasMatches = new Set<string>();
    try {
      for (const [k, icons] of Object.entries(EXTRA_ICON_ALIASES)) {
        const nk = normalize(k);
        if (tokens.some((t) => nk.includes(t) || t.includes(nk))) {
          for (const ic of icons) aliasMatches.add(ic);
        }
      }
    } catch {}

    // final ordered list: nameMatches first, then aliasMatches not already included
    const out: string[] = [];
    nameMatches.forEach((i) => out.push(i));
    for (const a of Array.from(aliasMatches)) if (!out.includes(a) && src.includes(a)) out.push(a);

    // fallback: if nothing matched, try contains substring in raw icon name
    if (out.length === 0) {
      const qSimple = q.replace(/\s+/g, "");
      const fallback = src.filter((x) => x.replace(/[-_]/g, "").toLowerCase().includes(qSimple));
      return fallback.length ? fallback : src;
    }

    return out;
  }, [ICON_CATALOG, debouncedIconQuery]);

  const iconTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredIcons.length / ICON_PAGE_SIZE)), [filteredIcons.length]);

  useEffect(() => {
    // reset page if query changes
    setIconPage(1);
  }, [debouncedIconQuery]);

  const pagedIcons = useMemo(() => {
    const start = (iconPage - 1) * ICON_PAGE_SIZE;
    return filteredIcons.slice(start, start + ICON_PAGE_SIZE);
  }, [filteredIcons, iconPage]);

  const pickIcon = useCallback((name: string) => {
    const ic = (name || "").trim();
    setForm((s) => ({ ...s, icono: ICON_SET.has(ic) ? ic : DEFAULT_ICON }));
    setShowIconPicker(false);
  }, [ICON_SET]);

  // ---------- Row component (no list scroll; still animated) ----------
  const ConceptRow: React.FC<{ item: Concepto; index: number }> = ({ item, index }) => {
    const isExpanded = expandedId === item.conceptoId;
    const iconName = ICON_SET.has(String(item.icono || "").trim()) ? String(item.icono).trim() : DEFAULT_ICON;

    const scale = useRef(new Animated.Value(1)).current;
    const appear = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(appear, {
        toValue: 1,
        duration: 220,
        delay: Math.min(index * 14, 140),
        useNativeDriver: true,
      }).start();
    }, [appear, index]);

    const pressIn = () =>
      Animated.spring(scale, { toValue: 0.992, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
    const pressOut = () =>
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 7 }).start();

    const toggleExpandRow = () => {
      animateLayout();
      setExpandedId((prev) => (prev === item.conceptoId ? null : item.conceptoId));
    };

    return (
      <Animated.View
        style={[
          styles.rowWrap,
          {
            opacity: appear,
            transform: [
              { scale },
              { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          },
        ]}
      >
        <Pressable
          onPress={toggleExpandRow}
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
          {/* Accent */}
          <View style={[styles.rowAccent, { backgroundColor: item.color }]} />

          <View style={styles.rowMain}>
            <View style={[styles.rowIconBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name={iconName as any} size={18} color={colors.text} />
            </View>

            <View style={styles.rowCenter}>
              <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                {item.nombre}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
                ID: {shortId(item.conceptoId)}
              </Text>
            </View>

            <View style={styles.rowRight}>
              <View style={[styles.rowDot, { backgroundColor: item.color, borderColor: colors.card }]} />
              <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
            </View>
          </View>

          {isExpanded ? (
            <View style={[styles.rowExpandedArea, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => openEdit(item)}
                style={[styles.rowActionPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                activeOpacity={0.9}
              >
                <Ionicons name="pencil" size={18} color={colors.button} />
                <Text style={[styles.rowActionText, { color: colors.button }]}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openDeleteConfirm(item.conceptoId)}
                disabled={!!deletingId}
                style={[styles.rowActionPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                activeOpacity={0.9}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.rowActionText, { color: colors.error }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    );
  };

  const SkeletonRow: React.FC<{ index: number }> = ({ index }) => {
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
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowMain}>
            <View style={[styles.rowIconBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ height: 14, width: "62%", backgroundColor: colors.backgroundSecondary, borderRadius: 8, marginBottom: 8 }} />
              <View style={{ height: 12, width: "38%", backgroundColor: colors.backgroundSecondary, borderRadius: 8 }} />
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  // ---------- UI ----------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text }]}>Mis Conceptos</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isEdit ? "Editando concepto" : "Gestiona tus categorías"}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.countPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Text style={[styles.countText, { color: colors.text }]}>{totalCount}</Text>
          </View>
        </View>
      </View>

      {/* SINGLE SCROLL (no nested list scroll) */}
      <ScrollView
        ref={(r) => { scrollRef.current = r; }}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: Math.max(22, bottomInset + EXTRA_BOTTOM_SPACE),
        }}
        showsVerticalScrollIndicator={false}
        onScroll={onMainScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.button} />}
        keyboardShouldPersistTaps="handled"
      >
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
            <TouchableOpacity onPress={() => setQuery("")} activeOpacity={0.85}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Form Card */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.formTopRow}>
            <View style={styles.previewWrap}>
              <View
                style={[
                  styles.previewIcon,
                  {
                    backgroundColor: withAlpha(activeColor, 0.16),
                    borderColor: withAlpha(activeColor, 0.65),
                  },
                ]}
              >
                <Ionicons name={activeIcon as any} size={22} color={activeColor} />
              </View>

              <View>
                <Text style={[styles.formTitle, { color: colors.text }]}>{isEdit ? "Editar" : "Nuevo"}</Text>
                <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                  {isEdit ? "Actualiza los detalles" : "Crea un concepto"}
                </Text>
              </View>
            </View>

            {isEdit ? (
              <TouchableOpacity
                onPress={resetToCreate}
                style={[styles.cancelPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                activeOpacity={0.9}
              >
                <Ionicons name="close" size={14} color={colors.textSecondary} />
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TextInput
            placeholder={isEdit ? "Nombre del concepto…" : "Ej. Viajes, Café, Renta…"}
            value={form.nombre}
            onChangeText={(v) => setForm((s) => ({ ...s, nombre: v }))}
            style={[
              styles.nameInput,
              {
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.border,
                color: colors.inputText,
              },
            ]}
            placeholderTextColor={colors.placeholder}
          />

          {/* Icon Picker (quick row + open catalog) */}
          <View style={{ marginBottom: 10 }}>
            <View style={styles.iconRowHeader}>
              <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 0, marginBottom: 0 }]}>Ícono</Text>
              <TouchableOpacity
                onPress={() => {
                  setIconQuery("");
                  setIconPage(1);
                  setShowIconPicker(true);
                }}
                activeOpacity={0.9}
                style={[styles.smallLinkPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              >
                <Ionicons name="grid-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.smallLinkText, { color: colors.textSecondary }]}>Catálogo</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
              {IONICON_QUICK.map((ic) => {
                const selected = activeIcon === ic;
                return (
                  <TouchableOpacity
                    key={ic}
                    onPress={() => setForm((s) => ({ ...s, icono: ic }))}
                    style={[
                      styles.quickIconPill,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: selected ? withAlpha(activeColor, 0.8) : colors.border,
                      },
                    ]}
                    activeOpacity={0.9}
                  >
                    <Ionicons name={ic as any} size={18} color={selected ? activeColor : colors.text} />
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={() => {
                  setIconQuery("");
                  setIconPage(1);
                  setShowIconPicker(true);
                }}
                style={[styles.quickIconPill, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                activeOpacity={0.9}
              >
                <Ionicons name="add" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Colors */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Color</Text>
          <View style={styles.colorGrid}>
            {COLORS.map((c) => {
              const selected = activeColor === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    {
                      backgroundColor: c,
                      borderWidth: selected ? 3 : 0,
                      borderColor: selected ? colors.text : "transparent",
                    },
                  ]}
                  onPress={() => pickColor(c)}
                  activeOpacity={0.9}
                />
              );
            })}
          </View>

          <TouchableOpacity
            onPress={isEdit ? guardarEdicion : crearConcepto}
            activeOpacity={0.9}
            style={[styles.primaryBtn, { backgroundColor: activeColor }]}
          >
            <Ionicons name={isEdit ? "checkmark-circle-outline" : "add-circle-outline"} size={22} color="#FFF" />
            <Text style={styles.primaryBtnText}>{isEdit ? "Guardar cambios" : "Crear concepto"}</Text>
          </TouchableOpacity>
        </View>

        {/* List header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderTitle, { color: colors.text }]}>Tus conceptos</Text>
          <Text style={[styles.sectionHeaderMeta, { color: colors.textSecondary }]}>
            {totalCount ? `${totalCount} en total` : "—"}
          </Text>
        </View>

        {/* List (rendered inside the same ScrollView) */}
        {loading && conceptos.length === 0 ? (
          <View>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={`skeleton-${i}`} index={i} />
            ))}
          </View>
        ) : conceptos.length === 0 && !loading ? (
          <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="albums-outline" size={46} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Aún no tienes conceptos</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Crea uno arriba y aparecerá aquí para reutilizarlo en tus movimientos.
            </Text>
          </View>
        ) : (
          <View>
            {listData.map((it, idx) => (
              <View key={it.conceptoId} style={{ marginBottom: 10 }}>
                <ConceptRow item={it} index={idx} />
              </View>
            ))}

            {/* load more area */}
            <View style={{ paddingVertical: 10, alignItems: "center" }}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : visibleCount < conceptos.length ? (
                <TouchableOpacity
                  onPress={handleLoadMore}
                  activeOpacity={0.9}
                  style={[styles.loadMoreBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                >
                  <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                  <Text style={[styles.loadMoreText, { color: colors.text }]}>Cargar más</Text>
                  <Text style={[styles.loadMoreMeta, { color: colors.textSecondary }]}>
                    {visibleCount}/{conceptos.length}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ICON PICKER MODAL (search + pagination) */}
      <Modal visible={showIconPicker} transparent animationType="fade" onRequestClose={() => setShowIconPicker(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.52)" }]}>
          <View style={[styles.iconModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.iconModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.iconModalTitle, { color: colors.text }]}>Catálogo de íconos</Text>
                <Text style={[styles.iconModalSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  {filteredIcons.length} disponibles • página {iconPage}/{iconTotalPages}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowIconPicker(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* search */}
            <View style={[styles.iconSearchWrap, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Buscar ícono… (ej. car, home, cash)"
                value={iconQuery}
                onChangeText={setIconQuery}
                style={[styles.searchInput, { color: colors.inputText }]}
                placeholderTextColor={colors.placeholder}
              />
              {iconQuery ? (
                <TouchableOpacity onPress={() => setIconQuery("")} activeOpacity={0.85}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* grid */}
            <FlatList
              data={pagedIcons}
              keyExtractor={(it) => it}
              numColumns={ICON_COLS}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10 }}
              columnWrapperStyle={{ gap: 10 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => {
                const selected = activeIcon === item;
                return (
                  <Pressable
                    onPress={() => pickIcon(item)}
                    style={({ pressed }) => [
                      styles.iconCell,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: selected ? withAlpha(activeColor, 0.85) : colors.border,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <Ionicons name={item as any} size={20} color={selected ? activeColor : colors.text} />
                  </Pressable>
                );
              }}
            />

            {/* pagination */}
            <View style={styles.iconPager}>
              <TouchableOpacity
                onPress={() => setIconPage((p) => Math.max(1, p - 1))}
                disabled={iconPage <= 1}
                activeOpacity={0.9}
                style={[
                  styles.pagerBtn,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                    opacity: iconPage <= 1 ? 0.45 : 1,
                  },
                ]}
              >
                <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                <Text style={[styles.pagerText, { color: colors.text }]}>Anterior</Text>
              </TouchableOpacity>

              <View style={[styles.pagerMid, { borderColor: colors.border }]}>
                <Text style={[styles.pagerMidText, { color: colors.textSecondary }]}>
                  {iconPage}/{iconTotalPages}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setIconPage((p) => Math.min(iconTotalPages, p + 1))}
                disabled={iconPage >= iconTotalPages}
                activeOpacity={0.9}
                style={[
                  styles.pagerBtn,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                    opacity: iconPage >= iconTotalPages ? 0.45 : 1,
                  },
                ]}
              >
                <Text style={[styles.pagerText, { color: colors.text }]}>Siguiente</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirm */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={closeDeleteConfirm}>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.52)" }]}>
          <View style={[styles.deleteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.deleteIconContainer, { backgroundColor: colors.error + "20" }]}>
              <Ionicons name="trash" size={30} color={colors.error} />
            </View>
            <Text style={[styles.deleteTitle, { color: colors.text }]}>¿Eliminar concepto?</Text>
            <Text style={[styles.deleteText, { color: colors.textSecondary }]}>Esta acción no se puede deshacer.</Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={closeDeleteConfirm}
                activeOpacity={0.9}
              >
                <Text style={[styles.deleteBtnText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.error, borderColor: colors.error }]}
                onPress={() => {
                  if (confirmDeleteId) eliminarConcepto(confirmDeleteId);
                }}
                activeOpacity={0.9}
              >
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
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    zIndex: 20,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  headerBtn: {
    width: 42,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerRight: { width: 42, alignItems: "flex-end", justifyContent: "center" },

  countPill: {
    minWidth: 34,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  countText: { fontSize: 12, fontWeight: "900" },

  title: { fontSize: 20, fontWeight: "900", letterSpacing: 0.2 },
  subtitle: { marginTop: 2, fontSize: 12, fontWeight: "600" },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0, fontWeight: "700" },

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
  previewWrap: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  previewIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  formTitle: { fontSize: 15, fontWeight: "900" },
  formHint: { fontSize: 12, fontWeight: "600", marginTop: 2 },

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
  cancelText: { fontSize: 12, fontWeight: "800" },

  nameInput: {
    width: "100%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 10,
    fontWeight: "800",
  },

  iconRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  smallLinkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  smallLinkText: { fontSize: 12, fontWeight: "900" },

  quickIconPill: {
    width: 46,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionLabel: { fontSize: 13, fontWeight: "900", marginTop: 4, marginBottom: 8 },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  colorCircle: { width: 32, height: 32, borderRadius: 999 },

  primaryBtn: {
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "900", color: "#FFF" },

  sectionHeader: { marginTop: 6, marginBottom: 10, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionHeaderTitle: { fontSize: 14, fontWeight: "900" },
  sectionHeaderMeta: { fontSize: 12, fontWeight: "700" },

  rowWrap: { width: "100%" },
  row: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    overflow: "hidden",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
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
  rowMain: { flexDirection: "row", alignItems: "center" },
  rowIconBadge: { width: 46, height: 38, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowCenter: { flex: 1, marginLeft: 12, marginRight: 10 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowDot: { width: 12, height: 12, borderRadius: 999, borderWidth: 2 },
  rowName: { fontSize: 15, fontWeight: "900", marginBottom: 4 },
  rowMeta: { fontSize: 12, fontWeight: "800", opacity: 0.95 },

  rowExpandedArea: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, flexDirection: "row", gap: 10 },
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
  rowActionText: { fontSize: 12.5, fontWeight: "900" },

  emptyWrap: { borderRadius: 18, borderWidth: 1, padding: 24, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "900", textAlign: "center" },
  emptyText: { fontSize: 13, fontWeight: "700", lineHeight: 18, textAlign: "center" },

  loadMoreBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadMoreText: { fontSize: 13, fontWeight: "900" },
  loadMoreMeta: { fontSize: 12, fontWeight: "800" },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 18 },

  // Icon modal
  iconModal: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    maxHeight: Math.min(640, SCREEN_H * 0.82),
  },
  iconModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 },
  iconModalTitle: { fontSize: 15, fontWeight: "900" },
  iconModalSub: { marginTop: 3, fontSize: 12, fontWeight: "700" },

  iconSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },

  iconCell: {
    flex: 1,
    minWidth: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  iconPager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 10 },
  pagerBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pagerText: { fontSize: 13, fontWeight: "900" },
  pagerMid: { width: 78, height: 40, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pagerMidText: { fontSize: 12, fontWeight: "900" },

  // Delete modal
  deleteCard: { width: "100%", maxWidth: 380, borderRadius: 18, borderWidth: 1, padding: 20, alignItems: "center" },
  deleteIconContainer: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  deleteTitle: { fontSize: 18, fontWeight: "900", marginBottom: 6, textAlign: "center" },
  deleteText: { fontSize: 14, fontWeight: "700", marginBottom: 20, textAlign: "center" },
  deleteActions: { flexDirection: "row", width: "100%", gap: 12 },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  deleteBtnText: { fontSize: 15, fontWeight: "900" },
});

export default ConceptsScreen;