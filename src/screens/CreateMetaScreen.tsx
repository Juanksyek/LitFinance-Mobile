import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';

import { useThemeColors } from '../theme/useThemeColors';
import { useNumericInput } from '../hooks/useNumericInput';
import metasService from '../services/metasService';
import { authService } from '../services/authService';
import { API_BASE_URL } from '../constants/api';
import AppTextInput from '../components/AppTextInput';
import { filterConceptIcons } from '../constants/conceptIconCatalog';

async function getMainAccountCurrency(): Promise<string | null> {
  const access = await authService.getAccessToken({ allowRefresh: true });
  if (!access) return null;

  try {
    const r = await fetch(`${API_BASE_URL}/cuenta/principal`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${access}` },
    });
    const text = await r.text();
    if (!r.ok) return null;
    const j = text ? JSON.parse(text) : null;
    const normalized = j?.data ?? j;
    const monedaDirect = normalized?.moneda ?? normalized?.account?.moneda ?? normalized?.cuenta?.moneda;
    if (monedaDirect) return String(monedaDirect);
  } catch {}

  return null;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const formatDate = (d: Date) => {
  try {
    return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return d.toLocaleDateString('es-MX');
  }
};

const formatDateForBackend = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatMoney = (value: number, currency?: string | null) => {
  const v = Number.isFinite(value) ? value : 0;
  try {
    if (currency && currency.length <= 4) {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(v);
    }
  } catch {}
  const num = v.toFixed(2);
  return currency ? `${currency} ${num}` : num;
};

const getCurrencySymbol = (currency?: string | null): string | null => {
  if (!currency) return null;
  try {
    const parts = (new Intl.NumberFormat('es-MX', { style: 'currency', currency }) as any).formatToParts(1);
    const cur = parts.find((p: any) => p.type === 'currency');
    if (cur?.value) return cur.value;
  } catch {}
  try {
    const map: Record<string, string> = { USD: '$', MXN: '$', EUR: '€', GBP: '£' };
    return map[(currency || '').toUpperCase()] || currency;
  } catch {
    return currency;
  }
};

const formatMoneyWithSymbol = (value: number, currency?: string | null) => {
  const v = Number.isFinite(value) ? value : 0;
  try {
    const formattedNumber = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    const symbol = getCurrencySymbol(currency);
    return symbol ? `${symbol} ${formattedNumber}` : formattedNumber;
  } catch {
    const num = v.toFixed(2);
    const symbol = getCurrencySymbol(currency);
    return symbol ? `${symbol} ${num}` : num;
  }
};

const withAlpha = (color: string, alpha: number) => {
  const a = Math.max(0, Math.min(1, alpha));
  const c = (color || '').trim();
  if (c.startsWith('#')) {
    const hex = c.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex;
    if (full.length === 6) {
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      if ([r, g, b].every((n) => Number.isFinite(n))) return `rgba(${r},${g},${b},${a})`;
    }
  }
  return c;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const diffInDays = (from: Date, to: Date) => {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const CreateMetaScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();

  const editingMeta = route?.params?.meta;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // ✅ estabiliza bottom inset (evita saltos/recortes al abrir teclado)
  const [stableBottomInset, setStableBottomInset] = useState(insets.bottom);
  useEffect(() => {
    setStableBottomInset((prev) => Math.max(prev, insets.bottom));
  }, [insets.bottom]);

  // =========================
  // ✅ FIX 1: NO LayoutAnimation mientras el teclado está abierto en Android
  // (es la causa #1 del “scroll al top”/saltos raros en ScrollView al tipear)
  // =========================
  const keyboardVisibleRef = useRef(false);
  const runLayoutAnim = useCallback((preset = LayoutAnimation.Presets.easeInEaseOut) => {
    if (Platform.OS === 'android' && keyboardVisibleRef.current) return;
    LayoutAnimation.configureNext(preset);
  }, []);

  // =========================
  // ✅ FIX 2: scroll estable al input SOLO iOS
  // (Android con resize es más estable sin auto-scroll)
  // =========================
  const scrollRef = useRef<any>(null);
  const pendingFocusTargetRef = useRef<number | null>(null);
  const focusScrollLockRef = useRef(false);

  const scrollToFocused = useCallback((target: number) => {
    if (!scrollRef.current) return;
    if (focusScrollLockRef.current) return;
    focusScrollLockRef.current = true;

    requestAnimationFrame(() => {
      try {
        // @ts-ignore
        scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard?.(
          target,
          160, // extra (por tu footer sticky)
          true
        );
      } catch {}
      setTimeout(() => {
        focusScrollLockRef.current = false;
      }, 260);
    });
  }, []);

  const handleInputFocus = useCallback(
    (e: any) => {
      const target: number | undefined =
        (typeof e?.target === 'number' ? e.target : undefined) ??
        (typeof e?.nativeEvent?.target === 'number' ? e.nativeEvent.target : undefined);

      if (typeof target !== 'number') return;
      pendingFocusTargetRef.current = target;

      // ✅ Android: no auto-scroll (reduce jumps)
      if (Platform.OS !== 'ios') return;

      if (keyboardVisibleRef.current) {
        setTimeout(() => scrollToFocused(target), 50);
      }
    },
    [scrollToFocused]
  );

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvt, () => {
      keyboardVisibleRef.current = true;
      if (Platform.OS === 'ios') {
        const t = pendingFocusTargetRef.current;
        if (typeof t === 'number') setTimeout(() => scrollToFocused(t), 80);
      }
    });

    const subHide = Keyboard.addListener(hideEvt, () => {
      keyboardVisibleRef.current = false;
      pendingFocusTargetRef.current = null;
      focusScrollLockRef.current = false;
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [scrollToFocused]);

  // Form state
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [moneda, setMoneda] = useState<string | null>(null);
  const [loadingCurrency, setLoadingCurrency] = useState(true);

  const [fechaLimite, setFechaLimite] = useState<Date | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [focus, setFocus] = useState({
    nombre: false,
    descripcion: false,
    objetivo: false,
  });

  const objetivo = useNumericInput({
    initialValue: 0,
    context: 'default',
    allowNegative: false,
    allowDecimals: true,
    maxDecimals: 2,
    minValue: 0.01,
  });

  // Layout / scroll refs (for “smart scroll to first error”)
  const sectionY = useRef<{ nombre?: number; objetivo?: number }>({}).current;

  // Animations
  const enter = useRef(new Animated.Value(0)).current;
  const headerShadow = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const shimmer = useRef(new Animated.Value(0)).current;
  const heroPulse = useRef(new Animated.Value(0)).current;

  const btnScale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  // iOS bottom-sheet date picker animation
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // Focus glow animations (kept)
  const focusNombre = useRef(new Animated.Value(0)).current;
  const focusDesc = useRef(new Animated.Value(0)).current;
  const focusObj = useRef(new Animated.Value(0)).current;

  const animateFocus = useCallback((v: Animated.Value, to: number) => {
    Animated.timing(v, { toValue: to, duration: 180, useNativeDriver: false }).start();
  }, []);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 520, useNativeDriver: true }).start();

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    shimmerLoop.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(heroPulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    return () => {
      shimmerLoop.stop();
      pulseLoop.stop();
    };
  }, [enter, shimmer, heroPulse]);

  const retryCurrency = useCallback(async () => {
    try {
      setLoadingCurrency(true);
      const cur = await getMainAccountCurrency();
      runLayoutAnim();
      setMoneda(cur);
    } catch {
      runLayoutAnim();
      setMoneda(null);
    } finally {
      setLoadingCurrency(false);
    }
  }, [runLayoutAnim]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCurrency(true);
        const cur = await getMainAccountCurrency();
        if (!mounted) return;
        runLayoutAnim();
        setMoneda(cur);
      } catch {
        if (!mounted) return;
        runLayoutAnim();
        setMoneda(null);
      } finally {
        if (mounted) setLoadingCurrency(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [runLayoutAnim]);

  useEffect(() => {
    if (editingMeta) {
      setNombre(String(editingMeta.nombre || ''));
      setDescripcion(String(editingMeta.descripcion || ''));
      setMoneda(String(editingMeta.moneda || '') || null);
      setColor(editingMeta.color ?? null);
      setIcon(editingMeta.icono ?? null);
      setFechaLimite(editingMeta.fechaObjetivo ? new Date(editingMeta.fechaObjetivo) : null);
      try {
        objetivo.setValue(Number((editingMeta as any).objetivo ?? (editingMeta as any).objetivoMonto ?? 0));
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMeta]);

  const nameOk = useMemo(() => {
    const t = nombre.trim();
    return t.length > 0 && t.length <= 60;
  }, [nombre]);

  const objValue = objetivo.numericValue ?? 0;
  const objOk = useMemo(() => Number.isFinite(objValue) && objValue >= 0.01, [objValue]);
  const isValid = useMemo(() => Boolean(nameOk && objOk), [nameOk, objOk]);

  const completion = useMemo(() => {
    let c = 0;
    if (nameOk) c += 0.5;
    if (objOk) c += 0.5;
    return Math.min(1, Math.max(0, c));
  }, [nameOk, objOk]);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: completion,
      friction: 10,
      tension: 120,
      useNativeDriver: false,
    }).start();
  }, [completion, progressAnim]);

  const onScroll = useCallback(
    (e: any) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      const t = clamp(y / 20, 0, 1);
      headerShadow.setValue(t);
    },
    [headerShadow]
  );

  const headerBgOpacity = headerShadow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const headerBorderOpacity = headerShadow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_W - 40 - 26],
  });

  const shakeX = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-8, 0, 8],
  });

  const presets = useMemo(() => [3000, 5000, 10000, 20000], []);
  const namePresets = useMemo(() => ['Emergencias', 'Viaje', 'Auto', 'Casa', 'Regalos', 'Ahorro'], []);

  const colorOptions = useMemo(() => ['#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444'], []);
  const iconOptions = useMemo(
    () => [
      'sparkles-outline',
      'airplane-outline',
      'wallet-outline',
      'car-outline',
      'heart-outline',
      'gift-outline',
      'home-outline',
      'fitness-outline',
      'school-outline',
      'cash-outline',
      'bicycle-outline',
    ],
    []
  );

  const ICON_CATALOG = useMemo(
    () => [
      'add',
      'airplane-outline',
      'albums-outline',
      'archive-outline',
      'bar-chart-outline',
      'battery-charging-outline',
      'bed-outline',
      'bicycle-outline',
      'boat-outline',
      'book-outline',
      'boat-outline',
      'bus-outline',
      'restaurant-outline',
      'beer-outline',
      'cafe-outline',
      'planet-outline',
      'musical-notes-outline',
      'images-outline',
      'camera-outline',
      'bed-outline',
      'beer-outline',
      'trophy-outline',
      'briefcase-outline',
      'business-outline',
      'analytics-outline',
      'gift-outline',
      'people-outline',
      'server-outline',
      'shirt-outline',
      'briefcase-outline',
      'business-outline',
      'calculator-outline',
      'calendar-outline',
      'call-outline',
      'camera-outline',
      'car-outline',
      'cart-outline',
      'cash-outline',
      'chatbubble-outline',
      'cloud-outline',
      'cash-outline',
      'diamond-outline',
      'document-text-outline',
      'football-outline',
      'gift-outline',
      'globe-outline',
      'heart-outline',
      'home-outline',
      'images-outline',
      'information-circle-outline',
      'key-outline',
      'laptop-outline',
      'leaf-outline',
      'library-outline',
      'list-outline',
      'locate-outline',
      'mail-outline',
      'man-outline',
      'map-outline',
      'mic-outline',
      'moon-outline',
      'musical-notes-outline',
      'newspaper-outline',
      'pause-outline',
      'people-outline',
      'paw-outline',
      'phone-portrait-outline',
      'pizza-outline',
      'pricetag-outline',
      'ribbon-outline',
      'rocket-outline',
      'save-outline',
      'school-outline',
      'shirt-outline',
      'shop-outline',
      'sparkles-outline',
      'star-outline',
      'storefront-outline',
      'train-outline',
      'trash-outline',
      'trophy-outline',
      'wallet-outline',
      'watch-outline',
      'water-outline',
      'wine-outline',
    ],
    []
  );

  const [showIconCatalog, setShowIconCatalog] = useState(false);
  const [iconCatalogQuery, setIconCatalogQuery] = useState('');
  const [iconCatalogPage, setIconCatalogPage] = useState(1);
  const ICON_CATALOG_PAGE_SIZE = 24;

  const filteredIcons = useMemo(() => filterConceptIcons(ICON_CATALOG, iconCatalogQuery), [ICON_CATALOG, iconCatalogQuery]);

  const totalIconPages = Math.max(1, Math.ceil(filteredIcons.length / ICON_CATALOG_PAGE_SIZE));
  const pageIcons = useMemo(() => {
    const start = (iconCatalogPage - 1) * ICON_CATALOG_PAGE_SIZE;
    return filteredIcons.slice(start, start + ICON_CATALOG_PAGE_SIZE);
  }, [filteredIcons, iconCatalogPage]);

  const openIconCatalog = useCallback(() => {
    setIconCatalogQuery('');
    setIconCatalogPage(1);
    setShowIconCatalog(true);
  }, []);

  const selectIconFromCatalog = useCallback((name: string) => {
    setIcon(name);
    setShowIconCatalog(false);
  }, []);

  const previewTitle = nombre.trim() ? nombre.trim() : 'Nueva meta';
  const previewObjective = objOk ? formatMoneyWithSymbol(objValue, moneda) : 'Define tu objetivo';
  const previewDate = fechaLimite ? formatDate(fechaLimite) : 'Sin fecha límite';

  const savingsHint = useMemo(() => {
    if (!objOk || !fechaLimite) return null;
    const now = new Date();
    const days = diffInDays(now, fechaLimite);
    if (days <= 0) return 'Tu fecha ya pasó. Puedes cambiarla o dejarla sin límite.';
    const weeks = Math.max(1, Math.ceil(days / 7));
    const months = Math.max(1, Math.ceil(days / 30.44));
    const perWeek = objValue / weeks;
    const perMonth = objValue / months;
    return `Aprox: ${formatMoneyWithSymbol(perMonth, moneda)} / mes • ${formatMoneyWithSymbol(perWeek, moneda)} / semana`;
  }, [fechaLimite, moneda, objOk, objValue]);

  const handlePickPreset = useCallback(
    (v: number) => {
      if (saving) return;
      runLayoutAnim();

      const nextText = String(v);
      objetivo.textInputProps?.onChangeText?.(nextText as any);

      Animated.sequence([
        Animated.timing(btnScale, { toValue: 0.985, duration: 90, useNativeDriver: true }),
        Animated.timing(btnScale, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
    },
    [btnScale, objetivo.textInputProps, runLayoutAnim, saving]
  );

  const openDatePicker = useCallback(() => {
    if (saving) return;
    setShowDatePicker(true);
  }, [saving]);

  const closeDatePicker = useCallback(() => setShowDatePicker(false), []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    Animated.timing(sheetAnim, {
      toValue: showDatePicker ? 1 : 0,
      duration: showDatePicker ? 260 : 220,
      useNativeDriver: true,
    }).start();
  }, [sheetAnim, showDatePicker]);

  const clearDate = useCallback(() => {
    if (saving) return;
    runLayoutAnim();
    setFechaLimite(null);
  }, [runLayoutAnim, saving]);

  const clearDesc = useCallback(() => {
    if (saving) return;
    runLayoutAnim();
    setDescripcion('');
  }, [runLayoutAnim, saving]);

  const clearName = useCallback(() => {
    if (saving) return;
    runLayoutAnim();
    setNombre('');
  }, [runLayoutAnim, saving]);

  const clearPersonalization = useCallback(() => {
    if (saving) return;
    runLayoutAnim();
    setColor(null);
    setIcon(null);
  }, [runLayoutAnim, saving]);

  const scrollTo = useCallback(
    (y: number) => {
      try {
        scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 10), animated: true });
      } catch {}
    },
    [scrollRef]
  );

  const triggerShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      triggerShake();
      Toast.show({ type: 'error', text1: 'Revisa los campos', text2: 'Nombre y objetivo son requeridos' });

      if (!nameOk && sectionY.nombre != null) scrollTo(sectionY.nombre);
      else if (!objOk && sectionY.objetivo != null) scrollTo(sectionY.objetivo);

      return;
    }

    try {
      setSaving(true);
      Keyboard.dismiss();

      let sendingMoneda = moneda;
      if (!sendingMoneda) {
        try {
          const cur = await getMainAccountCurrency();
          runLayoutAnim();
          setMoneda(cur);
          sendingMoneda = cur;
        } catch {}
      }

      if (!sendingMoneda) {
        Toast.show({ type: 'error', text1: 'No se pudo obtener la moneda', text2: 'Reintenta más tarde.' });
        setSaving(false);
        return;
      }

      const objetivoNum = Number(objetivo.numericValue ?? 0);
      const payload: any = {
        nombre: nombre.trim(),
        objetivo: objetivoNum,
        moneda: String(sendingMoneda),
        color: color ?? undefined,
        icono: icon ?? undefined,
        fechaObjetivo: fechaLimite ? formatDateForBackend(fechaLimite) : undefined,
        prioridad: 1,
        descripcion: descripcion.trim() ? descripcion.trim() : undefined,
      };

      if (editingMeta) {
        const updated = await metasService.updateMeta((editingMeta as any).metaId, payload);
        Toast.show({ type: 'success', text1: 'Meta actualizada', text2: 'Cambios guardados' });
        const nextMetaId = String((updated as any)?.metaId ?? (updated as any)?.id ?? (editingMeta as any)?.metaId ?? '');
        navigation.replace('MetaDetail', { metaId: nextMetaId, meta: updated });
      } else {
        const created = await metasService.createMeta(payload);
        Toast.show({ type: 'success', text1: 'Meta creada', text2: 'Listo, ya puedes aportar cuando quieras' });
        const nextMetaId = String((created as any)?.metaId ?? (created as any)?.id ?? '');
        navigation.replace('MetaDetail', { metaId: nextMetaId, meta: created });
      }
    } catch (e: any) {
      triggerShake();
      Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'No se pudo crear la meta' });
    } finally {
      setSaving(false);
    }
  }, [
    color,
    descripcion,
    fechaLimite,
    icon,
    isValid,
    moneda,
    nameOk,
    nombre,
    navigation,
    objOk,
    objetivo.numericValue,
    runLayoutAnim,
    scrollTo,
    sectionY.nombre,
    sectionY.objetivo,
    triggerShake,
  ]);

  const iosSheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_H, 0],
  });
  const iosBackdropOpacity = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const currencyLine = useMemo(() => {
    if (moneda) return `Moneda: ${moneda}`;
    if (loadingCurrency) return 'Configurando…';
    return 'Sin moneda • Toca para reintentar';
  }, [loadingCurrency, moneda]);

  const accent = color || colors.button;
  const heroBlobOpacity = heroPulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.22] });

  // ✅ FIX 3: Header fuera del KAV (evita cambios de layout que “resetean” el scroll en iOS)
  const Wrapper: any = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const wrapperProps = Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {};

  const CONTENT_BOTTOM = 170 + stableBottomInset;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header (FUERA del wrapper) */}
      <Animated.View
        style={[
          styles.headerWrap,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Animated.View style={[styles.headerGlass, { backgroundColor: colors.card, borderColor: colors.border, opacity: headerBgOpacity }]} />
        <Animated.View style={[styles.headerBorder, { backgroundColor: colors.border, opacity: headerBorderOpacity }]} />

        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Regresar"
            style={({ pressed }) => [
              styles.iconBtn,
              styles.softShadow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{editingMeta ? 'Editar meta' : 'Crear meta'}</Text>

            <Pressable
              disabled={!!moneda || loadingCurrency || saving}
              onPress={retryCurrency}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Reintentar moneda"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View style={styles.currencyRow}>
                {!moneda && loadingCurrency ? (
                  <Animated.View style={[styles.skeletonLine, { backgroundColor: withAlpha(colors.textSecondary, 0.14), opacity: shimmerOpacity }]} />
                ) : (
                  <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{currencyLine}</Text>
                )}
              </View>
            </Pressable>

            <View style={[styles.miniProgressTrack, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <Animated.View style={[styles.miniProgressFill, { backgroundColor: colors.button, width: progressWidth }]} />
            </View>
          </View>

          <View style={{ width: 44 }} />
        </View>
      </Animated.View>

      {/* Body */}
      <Wrapper style={{ flex: 1, backgroundColor: colors.background }} {...wrapperProps}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[styles.content, { paddingBottom: CONTENT_BOTTOM }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            {/* Hero Preview */}
            <Animated.View
              style={[
                styles.heroCard,
                styles.softShadow,
                {
                  backgroundColor: colors.card,
                  borderColor: isValid ? withAlpha(colors.button, 0.6) : colors.border,
                  transform: [{ translateX: shakeX }],
                },
              ]}
            >
              <Animated.View pointerEvents="none" style={[styles.heroBlob, { backgroundColor: withAlpha(accent, 1), opacity: heroBlobOpacity }]} />
              <Animated.View pointerEvents="none" style={[styles.heroBlob2, { backgroundColor: withAlpha(colors.button, 1), opacity: heroBlobOpacity }]} />

              <View style={styles.heroTop}>
                <View style={[styles.heroIcon, { backgroundColor: color ? color : colors.inputBackground, borderColor: withAlpha(accent, 0.35) }]}>
                  <Ionicons name={(icon || 'sparkles-outline') as any} size={18} color={color ? '#fff' : colors.textSecondary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
                    {previewTitle}
                  </Text>
                  <Text style={[styles.heroSub, { color: colors.textSecondary }]} numberOfLines={2}>
                    {previewObjective} • {previewDate}
                  </Text>
                  {savingsHint ? (
                    <View style={[styles.smartHint, { backgroundColor: withAlpha(colors.button, 0.08), borderColor: withAlpha(colors.button, 0.18) }]}>
                      <Ionicons name="trending-up-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.smartHintText, { color: colors.textSecondary }]} numberOfLines={2}>
                        {savingsHint}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.pill, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  <Ionicons name={isValid ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={isValid ? colors.button : colors.textSecondary} />
                  <Text style={[styles.pillText, { color: colors.textSecondary }]}>{isValid ? 'Listo' : 'En progreso'}</Text>
                </View>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <Animated.View style={[styles.progressFill, { backgroundColor: colors.button, width: progressWidth }]} />
              </View>

              <View style={styles.heroHints}>
                <View style={styles.hintRow}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.hintText, { color: colors.textSecondary }]}>Tip: empieza simple. Puedes ajustar objetivo y personalización después.</Text>
                </View>
              </View>
            </Animated.View>

            {/* Nombre */}
            <View
              onLayout={(e) => {
                sectionY.nombre = e.nativeEvent.layout.y;
              }}
              style={[
                styles.card,
                styles.softShadow,
                { backgroundColor: colors.card, borderColor: nameOk ? withAlpha(colors.button, 0.35) : colors.border },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Nombre *</Text>
                  {nameOk ? <Ionicons name="checkmark-circle" size={16} color={colors.button} /> : null}
                </View>
                <Text style={[styles.counter, { color: colors.textSecondary }]}>{nombre.length}/60</Text>
              </View>

              <View style={styles.quickRow}>
                {namePresets.map((n) => {
                  const selected = nombre.trim().toLowerCase() === n.toLowerCase();
                  return (
                    <Pressable
                      key={n}
                      disabled={saving}
                      onPress={() => {
                        runLayoutAnim();
                        setNombre(n);
                      }}
                      style={({ pressed }) => [
                        styles.quickChip,
                        {
                          backgroundColor: selected ? colors.button : colors.inputBackground,
                          borderColor: selected ? colors.button : colors.border,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.quickText, { color: selected ? '#fff' : colors.text }]}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Animated.View style={[styles.field, { backgroundColor: colors.inputBackground, borderColor: focus.nombre ? colors.button : colors.border }]}>
                <Ionicons name="text-outline" size={18} color={colors.textSecondary} />
                <AppTextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Ej. Viaje, Emergencias, Auto…"
                  placeholderTextColor={colors.placeholder}
                  value={nombre}
                  onChangeText={(t: string) => {
                    if (t.length === 1 || t.length === 0) runLayoutAnim();
                    setNombre(t);
                  }}
                  editable={!saving}
                  maxLength={60}
                  onFocus={(e: any) => {
                    handleInputFocus(e);
                    setFocus((p) => ({ ...p, nombre: true }));
                    animateFocus(focusNombre, 1);
                  }}
                  onBlur={() => {
                    setFocus((p) => ({ ...p, nombre: false }));
                    animateFocus(focusNombre, 0);
                  }}
                  returnKeyType="next"
                />
                {!!nombre && !saving ? (
                  <Pressable onPress={clearName} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              </Animated.View>

              {!nameOk && nombre.trim().length > 0 ? (
                <Text style={[styles.inlineError, { color: colors.textSecondary }]}>El nombre debe tener entre 1 y 60 caracteres.</Text>
              ) : (
                <Text style={[styles.helper, { color: colors.textSecondary }]}>Ponle un nombre claro para ubicarla rápido.</Text>
              )}
            </View>

            {/* Descripción */}
            <View style={[styles.card, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Descripción</Text>
                <Text style={[styles.counter, { color: colors.textSecondary }]}>{descripcion.length}/200</Text>
              </View>

              <View style={[styles.fieldArea, { backgroundColor: colors.inputBackground, borderColor: focus.descripcion ? colors.button : colors.border }]}>
                <AppTextInput
                  style={[styles.textArea, { color: colors.text }]}
                  placeholder={'Opcional (ej. "Viaje a Cancún en verano")'}
                  placeholderTextColor={colors.placeholder}
                  value={descripcion}
                  onChangeText={(t: string) => {
                    if (t.length % 20 === 0) runLayoutAnim();
                    setDescripcion(t);
                  }}
                  editable={!saving}
                  maxLength={200}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  onFocus={(e: any) => {
                    handleInputFocus(e);
                    setFocus((p) => ({ ...p, descripcion: true }));
                    animateFocus(focusDesc, 1);
                  }}
                  onBlur={() => {
                    setFocus((p) => ({ ...p, descripcion: false }));
                    animateFocus(focusDesc, 0);
                  }}
                />

                {!!descripcion && !saving ? (
                  <Pressable onPress={clearDesc} hitSlop={10} style={({ pressed }) => [styles.clearAreaBtn, { opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              </View>

              <Text style={[styles.helper, { color: colors.textSecondary }]}>Úsala para anotar tu plan o motivación (opcional).</Text>
            </View>

            {/* Personaliza */}
            <View style={[styles.card, styles.softShadow, { backgroundColor: colors.card, borderColor: (color || icon) ? withAlpha(colors.button, 0.25) : colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Personaliza</Text>
                  {(color || icon) ? <Ionicons name="color-palette-outline" size={16} color={colors.button} /> : null}
                </View>

                {(color || icon) && !saving ? (
                  <Pressable onPress={clearPersonalization} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                    <Text style={[styles.linkText, { color: colors.textSecondary }]}>Limpiar</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.counter, { color: colors.textSecondary }]}>{icon || 'Ícono'}</Text>
                )}
              </View>

              <Text style={[styles.helper, { color: colors.textSecondary, marginHorizontal: 2, marginTop: 0 }]}>
                Elige un color y un ícono para identificar tu meta rápidamente.
              </Text>

              <View style={{ paddingTop: 12 }}>
                <View style={styles.colorRow}>
                  {colorOptions.map((c) => {
                    const selected = color === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => {
                          if (saving) return;
                          runLayoutAnim();
                          setColor((prev) => (prev === c ? null : c));
                        }}
                        style={({ pressed }) => [
                          styles.colorDot,
                          {
                            backgroundColor: c,
                            borderColor: selected ? '#fff' : withAlpha('#ffffff', 0),
                            opacity: pressed ? 0.88 : 1,
                            transform: [{ scale: selected ? 1.06 : 1 }],
                          },
                        ]}
                      >
                        {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.iconGrid}>
                  {iconOptions.map((ic) => {
                    const selected = icon === ic;
                    const bg = selected ? colors.button : colors.inputBackground;
                    const border = selected ? colors.button : colors.border;

                    return (
                      <Pressable
                        key={ic}
                        onPress={() => {
                          if (saving) return;
                          runLayoutAnim();
                          setIcon((prev) => (prev === ic ? null : ic));
                        }}
                        style={({ pressed }) => [
                          styles.iconTile,
                          {
                            backgroundColor: bg,
                            borderColor: border,
                            opacity: pressed ? 0.86 : 1,
                          },
                        ]}
                      >
                        <Ionicons name={ic as any} size={20} color={selected ? '#fff' : colors.text} />
                      </Pressable>
                    );
                  })}

                  <Pressable
                    onPress={() => {
                      if (saving) return;
                      openIconCatalog();
                    }}
                    style={({ pressed }) => [
                      styles.iconTile,
                      {
                        borderStyle: 'dashed',
                        borderColor: withAlpha(colors.textSecondary, 0.12),
                        backgroundColor: withAlpha(colors.inputBackground, 1),
                        opacity: pressed ? 0.86 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="add" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Objetivo */}
            <View
              onLayout={(e) => {
                sectionY.objetivo = e.nativeEvent.layout.y;
              }}
              style={[
                styles.card,
                styles.softShadow,
                { backgroundColor: colors.card, borderColor: objOk ? withAlpha(colors.button, 0.35) : colors.border },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Objetivo *</Text>
                  {objOk ? <Ionicons name="checkmark-circle" size={16} color={colors.button} /> : null}
                </View>
                <Text style={[styles.counter, { color: colors.textSecondary }]}>{objOk ? formatMoney(objValue, moneda) : '—'}</Text>
              </View>

              <View style={[styles.bigRow, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
                <View style={styles.bigPrefix}>
                  <Text style={[styles.bigPrefixText, { color: colors.textSecondary }]}>{getCurrencySymbol(moneda) || '$'}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={[styles.bigField, { borderColor: focus.objetivo ? colors.button : withAlpha(colors.border, 0.9), backgroundColor: withAlpha(colors.inputBackground, 1) }]}>
                    <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
                    <AppTextInput
                      style={[styles.bigInput, { color: colors.text }]}
                      editable={!saving}
                      placeholderTextColor={colors.placeholder}
                      {...objetivo.textInputProps}
                      keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                      onFocus={(e: any) => {
                        handleInputFocus(e);
                        setFocus((p) => ({ ...p, objetivo: true }));
                        animateFocus(focusObj, 1);
                      }}
                      onBlur={() => {
                        setFocus((p) => ({ ...p, objetivo: false }));
                        animateFocus(focusObj, 0);
                      }}
                    />
                  </View>
                </View>
              </View>

              {!objetivo.isValid && objetivo.errors.length > 0 ? (
                <Text style={[styles.inlineError, { color: colors.textSecondary }]}>{objetivo.errors[0]}</Text>
              ) : (
                <Text style={[styles.helper, { color: colors.textSecondary }]}>Tip: elige un objetivo realista. Puedes ajustarlo cuando quieras.</Text>
              )}

              <View style={styles.presetRow}>
                {presets.map((p) => {
                  const selected = Math.abs((objetivo.numericValue ?? 0) - p) < 0.0001;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => handlePickPreset(p)}
                      disabled={saving}
                      style={({ pressed }) => [
                        styles.presetChip,
                        {
                          backgroundColor: selected ? colors.button : colors.inputBackground,
                          borderColor: selected ? colors.button : colors.border,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                        <Text style={[styles.presetText, { color: selected ? '#fff' : colors.text }]}>{formatMoney(p, moneda)}</Text>
                      </Animated.View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Fecha límite */}
            <View style={[styles.card, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Fecha límite</Text>
                <Text style={[styles.counter, { color: colors.textSecondary }]}>{fechaLimite ? formatDate(fechaLimite) : 'Opcional'}</Text>
              </View>

              <Pressable
                onPress={openDatePicker}
                disabled={saving}
                style={({ pressed }) => [
                  styles.readonly,
                  { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.readonlyText, { color: colors.text }]}>{fechaLimite ? formatDate(fechaLimite) : 'Seleccionar fecha'}</Text>
                <View style={{ flex: 1 }} />
                {fechaLimite ? (
                  <Pressable onPress={clearDate} disabled={saving} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                )}
              </Pressable>

              <Text style={[styles.helper, { color: colors.textSecondary }]}>Si agregas fecha, luego podremos darte recordatorios y un plan de aportaciones.</Text>
            </View>
          </Animated.View>
        </Animated.ScrollView>

        {/* iOS Date Picker Bottom Sheet */}
        {Platform.OS === 'ios' ? (
          <Modal visible={showDatePicker} transparent animationType="none" onRequestClose={closeDatePicker}>
            <Animated.View style={[styles.modalOverlay, { opacity: iosBackdropOpacity }]}>
              <Pressable style={StyleSheet.absoluteFillObject as any} onPress={closeDatePicker} />
            </Animated.View>

            <Animated.View style={[styles.modalSheet, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border, transform: [{ translateY: iosSheetTranslateY }] }]}>
              <View style={styles.modalHandleWrap}>
                <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              </View>

              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Selecciona fecha</Text>
                <Pressable onPress={closeDatePicker} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              <DateTimePicker
                value={fechaLimite ?? new Date()}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (event.type === 'dismissed') return;
                  if (selectedDate) setFechaLimite(selectedDate);
                }}
              />

              <View style={styles.modalActions}>
                <Pressable onPress={closeDatePicker} style={({ pressed }) => [styles.modalBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Listo</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Modal>
        ) : null}

        {/* Icon catalog modal */}
        <Modal visible={showIconCatalog} transparent animationType="fade" onRequestClose={() => setShowIconCatalog(false)}>
          <Animated.View style={[styles.modalOverlay, { opacity: 0.6 }]}>
            <Pressable style={StyleSheet.absoluteFillObject as any} onPress={() => setShowIconCatalog(false)} />
          </Animated.View>

          <Animated.View style={[styles.iconCatalogModal, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.iconCatalogHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Buscar icono</Text>
              <Pressable onPress={() => setShowIconCatalog(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.iconCatalogSearchRow}>
              <AppTextInput
                placeholder="Buscar (ej. 'car', 'gift')"
                placeholderTextColor={colors.placeholder}
                value={iconCatalogQuery}
                onChangeText={(t: string) => {
                  setIconCatalogQuery(t);
                  setIconCatalogPage(1);
                }}
                editable={!saving}
                onFocus={(e: any) => handleInputFocus(e)}
              />
            </View>

            <FlatList
              data={pageIcons}
              keyExtractor={(it) => it}
              numColumns={6}
              style={styles.catalogList}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <Pressable onPress={() => selectIconFromCatalog(item)} style={({ pressed }) => [styles.catalogTile, { backgroundColor: colors.inputBackground, opacity: pressed ? 0.86 : 1 }]}>
                  <Ionicons name={item as any} size={22} color={colors.text} />
                </Pressable>
              )}
            />

            <View style={styles.catalogPagination}>
              <Pressable disabled={iconCatalogPage <= 1} onPress={() => setIconCatalogPage((p) => Math.max(1, p - 1))}>
                <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>Anterior</Text>
              </Pressable>

              <Text style={{ color: colors.textSecondary, fontWeight: '900' }}>
                {iconCatalogPage} / {totalIconPages}
              </Text>

              <Pressable disabled={iconCatalogPage >= totalIconPages} onPress={() => setIconCatalogPage((p) => Math.min(totalIconPages, p + 1))}>
                <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>Siguiente</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Modal>

        {/* Android native picker */}
        {showDatePicker && Platform.OS !== 'ios' ? (
          <DateTimePicker
            value={fechaLimite ?? new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (event.type === 'dismissed') return;
              if (selectedDate) setFechaLimite(selectedDate);
            }}
          />
        ) : null}

        {/* Sticky Footer */}
        <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: (Platform.OS === 'ios' ? 18 : 14) + stableBottomInset }]}>
          <View style={[styles.footerInner, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              onPress={handleSubmit}
              disabled={!isValid || saving}
              onPressIn={() => Animated.timing(btnScale, { toValue: 0.985, duration: 90, useNativeDriver: true }).start()}
              onPressOut={() => Animated.timing(btnScale, { toValue: 1, duration: 140, useNativeDriver: true }).start()}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.button, opacity: !isValid || saving ? 0.55 : pressed ? 0.92 : 1 },
              ]}
            >
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <View style={styles.primaryButtonInner}>
                  {saving ? <ActivityIndicator color="#FFF" /> : <Ionicons name={isValid ? 'checkmark' : 'flag'} size={18} color="#FFF" />}
                  <Text style={styles.primaryButtonText}>
                    {saving ? (editingMeta ? 'Guardando…' : 'Creando…') : isValid ? (editingMeta ? 'Guardar cambios' : 'Crear meta') : 'Completa para continuar'}
                  </Text>
                </View>
              </Animated.View>
            </Pressable>

            <Text style={[styles.footerHint, { color: colors.textSecondary }]}>{isValid ? 'Todo listo. Vamos a darle.' : 'Completa nombre y objetivo.'}</Text>
          </View>
        </View>
      </Wrapper>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  softShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  headerWrap: {
    paddingTop: Platform.OS === 'ios' ? 58 : 46,
    paddingBottom: 10,
    paddingHorizontal: 16,
    position: 'relative',
    zIndex: 10,
  },
  headerGlass: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: 1,
    opacity: 0,
  },
  headerBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    opacity: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },

  currencyRow: { height: 16, justifyContent: 'center', alignItems: 'center' },
  skeletonLine: { height: 12, borderRadius: 8, width: 150 },

  miniProgressTrack: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
    padding: 2,
  },
  miniProgressFill: { height: 4, borderRadius: 999 },

  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },

  heroCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroBlob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    top: -120,
    right: -120,
  },
  heroBlob2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 999,
    bottom: -120,
    left: -120,
  },

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroIconOverlay: { ...StyleSheet.absoluteFillObject },
  heroTitle: { fontSize: 16, fontWeight: '900' },
  heroSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },

  smartHint: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smartHintText: { fontSize: 12, lineHeight: 16, flex: 1, fontWeight: '700' },

  pill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: { fontSize: 12, fontWeight: '800' },

  progressTrack: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
    padding: 2,
  },
  progressFill: { height: 6, borderRadius: 999 },

  heroHints: { marginTop: 12 },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  hintText: { fontSize: 12, lineHeight: 16, flex: 1 },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '900' },
  counter: { fontSize: 12, fontWeight: '800' },
  linkText: { fontSize: 12, fontWeight: '900' },

  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  quickChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  quickText: { fontSize: 12, fontWeight: '900' },

  field: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: { flex: 1, fontSize: 14, padding: 0 },

  fieldArea: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    position: 'relative',
    minHeight: 110,
  },
  textArea: { flex: 1, fontSize: 14, padding: 0, minHeight: 86 },
  clearAreaBtn: { position: 'absolute', right: 10, top: 10 },

  helper: { marginTop: 10, fontSize: 12, lineHeight: 16 },
  inlineError: { marginTop: 10, fontSize: 12, lineHeight: 16, fontWeight: '900' },

  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bigRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 2,
  },
  bigPrefix: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigPrefixText: { fontSize: 16, fontWeight: '900' },
  bigField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderLeftWidth: 1,
  },
  bigInput: { flex: 1, fontSize: 18, padding: 0, fontWeight: '900' },

  presetRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  presetText: { fontSize: 12, fontWeight: '900' },

  readonly: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readonlyText: { fontSize: 14, fontWeight: '900' },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  footerInner: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  footerHint: { marginTop: 10, fontSize: 12, textAlign: 'center', fontWeight: '700' },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHandleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  modalHandle: { width: 50, height: 5, borderRadius: 99 },
  modalHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 14, fontWeight: '900' },
  modalActions: { padding: 14 },
  modalBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { fontSize: 14, fontWeight: '900' },

  iconCatalogModal: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 120,
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: '60%',
    overflow: 'hidden',
  },
  iconCatalogHeader: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconCatalogSearchRow: { paddingHorizontal: 12, paddingBottom: 8 },
  catalogList: { maxHeight: 300 },
  catalogTile: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 6,
  },
  catalogPagination: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

export default CreateMetaScreen;