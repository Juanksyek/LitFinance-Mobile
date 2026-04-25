import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  LayoutAnimation,
  UIManager,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../theme/useThemeColors';
import FormInput from '../components/FormInput';
import { blocsService } from '../services/blocsService';
import type { Bloc, BlocTipo, CreateBlocRequest, PatchBlocRequest } from '../types/blocs';
import Toast from 'react-native-toast-message';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { dashboardRefreshBus, emitBlocsChanged } from '../utils/dashboardRefreshBus';
import { buildConceptIconCatalog, DEFAULT_CONCEPT_ICON, filterConceptIcons } from '../constants/conceptIconCatalog';
import { emojiFontFix, hasEmojiLike, normalizeEmojiStrict } from '../utils/fixMojibake';

export default function BlocCuentasScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [items, setItems] = useState<Bloc[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create/Edit modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createNombre, setCreateNombre] = useState('');
  const [createTipo, setCreateTipo] = useState<BlocTipo>('cuentas');
  const [createDesc, setCreateDesc] = useState('');
  const [createIcono, setCreateIcono] = useState<string | null>(null);
  const [editingBloc, setEditingBloc] = useState<Bloc | null>(null);

  // Icon picker (Concepts catalog)
  const ICON_CATALOG = useMemo(() => buildConceptIconCatalog({ defaultIcon: DEFAULT_CONCEPT_ICON }), []);
  const ICON_PAGE_SIZE = 48;
  const ICON_COLS = 6;
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconQuery, setIconQuery] = useState('');
  const [iconPage, setIconPage] = useState(1);

  const filteredIcons = useMemo(() => {
    return filterConceptIcons(ICON_CATALOG, iconQuery);
  }, [ICON_CATALOG, iconQuery]);

  const totalIconPages = useMemo(() => Math.max(1, Math.ceil(filteredIcons.length / ICON_PAGE_SIZE)), [filteredIcons.length]);
  const pageIcons = useMemo(() => {
    const start = (iconPage - 1) * ICON_PAGE_SIZE;
    return filteredIcons.slice(start, start + ICON_PAGE_SIZE);
  }, [filteredIcons, iconPage]);

  const canCreate = useMemo(() => createNombre.trim().length >= 2, [createNombre]);

  // Animations
  const enter = useRef(new Animated.Value(0)).current;
  const headerShadow = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
      } catch {}
    }
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [enter]);

  const animateLayout = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      try {
        if (mode === 'refresh') setRefreshing(true);
        else setLoading(true);

        const blocs = await blocsService.listBlocs();
        // sort newest first when possible
        const next = Array.isArray(blocs) ? [...blocs] : [];
        next.sort((a, b) => {
          const ad = (a as any)?.updatedAt ? new Date((a as any).updatedAt).getTime() : 0;
          const bd = (b as any)?.updatedAt ? new Date((b as any).updatedAt).getTime() : 0;
          return bd - ad;
        });

        setItems(next);
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: e?.message || 'No se pudieron cargar los blocs',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load])
  );

  useEffect(() => {
    const off = dashboardRefreshBus.on('blocs:changed', () => {
      void load('refresh');
    });
    return off;
  }, [load]);

  const onScroll = useCallback(
    (e: any) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      const t = Math.max(0, Math.min(1, y / 18));
      headerShadow.setValue(t);
    },
    [headerShadow]
  );

  const headerBgOpacity = headerShadow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const headerBorderOpacity = headerShadow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const refreshRotate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const resetCreate = useCallback(() => {
    setCreateNombre('');
    setCreateTipo('cuentas');
    setCreateDesc('');
    setCreateIcono(null);
  }, []);

  const openCreate = useCallback(() => {
    animateLayout();
    setEditingBloc(null);
    resetCreate();
    setCreateOpen(true);
    Keyboard.dismiss();

    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [animateLayout, resetCreate, sheetAnim]);

  const openEdit = useCallback(
    (bloc: Bloc) => {
      animateLayout();
      setEditingBloc(bloc);
      setCreateNombre(String(bloc?.nombre ?? ''));
      setCreateTipo((bloc?.tipo ?? 'cuentas') as BlocTipo);
      setCreateDesc(String(bloc?.descripcion ?? ''));
      setCreateIcono(bloc?.icono ?? null);

      setCreateOpen(true);
      Keyboard.dismiss();
      sheetAnim.setValue(0);
      Animated.timing(sheetAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    },
    [animateLayout, sheetAnim]
  );

  const closeCreate = useCallback(() => {
    Keyboard.dismiss();

    Animated.timing(sheetAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setCreateOpen(false);
      setEditingBloc(null);
      setSaving(false);
    });
  }, [sheetAnim]);

  const openIconCatalog = useCallback(() => {
    setIconQuery('');
    setIconPage(1);
    setShowIconPicker(true);
  }, []);

  const selectIconFromCatalog = useCallback((name: string) => {
    setCreateIcono(name);
    setShowIconPicker(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canCreate || saving) return;
    try {
      setSaving(true);

      if (!editingBloc) {
        const payload: CreateBlocRequest = {
          nombre: createNombre.trim(),
          tipo: createTipo,
          descripcion: createDesc.trim() ? createDesc.trim() : undefined,
          icono: (createIcono ?? (createTipo === 'cuentas' ? 'wallet-outline' : 'cart-outline')) || undefined,
        };

        const created = await blocsService.createBloc(payload);
        closeCreate();
        resetCreate();
        emitBlocsChanged();
        navigation.navigate('BlocDetail', { blocId: created.blocId });
        return;
      }

      const patch: PatchBlocRequest = {};
      const nextNombre = createNombre.trim();
      const nextTipo = createTipo;
      const nextDesc = createDesc.trim() ? createDesc.trim() : null;
      const nextIcon = createIcono ?? null;

      const originalNombre = String(editingBloc.nombre ?? '').trim();
      const originalTipo = editingBloc.tipo;
      const originalDesc = (String(editingBloc.descripcion ?? '').trim() || null) as string | null;
      const originalIcon = (editingBloc.icono ?? null) as string | null;

      if (nextNombre && nextNombre !== originalNombre) patch.nombre = nextNombre;
      if (nextTipo !== originalTipo) patch.tipo = nextTipo;
      if (nextDesc !== originalDesc) patch.descripcion = nextDesc;
      if (nextIcon !== originalIcon) patch.icono = nextIcon;

      const keys = Object.keys(patch);
      if (keys.length === 0) {
        closeCreate();
        resetCreate();
        return;
      }

      const updated = await blocsService.patchBloc(editingBloc.blocId, patch);
      setItems((prev) => prev.map((b) => (b.blocId === editingBloc.blocId ? { ...b, ...updated } : b)));

      closeCreate();
      resetCreate();
      emitBlocsChanged();
      Toast.show({ type: 'success', text1: 'Listo', text2: 'Bloc actualizado' });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: e?.message || (editingBloc ? 'No se pudo actualizar el bloc' : 'No se pudo crear el bloc'),
      });
    } finally {
      setSaving(false);
    }
  }, [canCreate, closeCreate, createDesc, createIcono, createNombre, createTipo, editingBloc, navigation, resetCreate, saving]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 800, useNativeDriver: true })).start();
    try {
      await load('refresh');
    } finally {
      rotate.stopAnimation(() => rotate.setValue(0));
      setRefreshing(false);
    }
  }, [load, rotate]);

  const tipoLabel = useCallback((t: BlocTipo) => (t === 'cuentas' ? 'Cuentas' : 'Compras'), []);

  const tipoIcon = useCallback((t: BlocTipo) => (t === 'cuentas' ? 'wallet-outline' : 'cart-outline'), []);

  const renderIconNode = useCallback(
    (icono: string | null | undefined, tipo: BlocTipo, size = 18) => {
      const raw = typeof icono === 'string' ? icono.trim() : '';
      const fallback = tipoIcon(tipo);
      if (raw && (raw.length <= 3 || hasEmojiLike(raw))) {
        const emoji = normalizeEmojiStrict(raw, '📌');
        return <Text style={[{ fontSize: size + 2, lineHeight: size + 4 }, emojiFontFix]}>{emoji}</Text>;
      }

      const name = raw || fallback;
      return <Ionicons name={name as any} size={size} color={colors.button} />;
    },
    [colors.button, tipoIcon]
  );

  const renderCard = useCallback(
    ({ item, index }: { item: Bloc; index: number }) => {
      const sub = item.descripcion ? item.descripcion : 'Sin descripción';
      const chipBg = withAlpha(colors.button, 0.1);
      const chipBd = withAlpha(colors.button, 0.18);

      return (
        <Animated.View
          style={{
            opacity: enter,
            transform: [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12 + Math.min(index, 8) * 2, 0],
                }),
              },
            ],
          }}
        >
          <Pressable
            onPress={() => navigation.navigate('BlocDetail', { blocId: item.blocId })}
            style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
          >
            <View style={[styles.blocCard, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.blocRow}>
                <View style={[styles.iconWrap, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                  {renderIconNode(item.icono, item.tipo, 18)}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.blocName, { color: colors.text }]} numberOfLines={1}>
                      {item.nombre}
                    </Text>

                    <View style={[styles.chip, { backgroundColor: chipBg, borderColor: chipBd }]}>
                      <Ionicons name="layers-outline" size={12} color={colors.textSecondary} />
                      <Text style={[styles.chipText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {tipoLabel(item.tipo)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.blocMeta, { color: colors.textSecondary }]} numberOfLines={2}>
                    {sub}
                  </Text>
                </View>

                <View style={styles.rightCol}>
                  <Pressable
                    onPress={(e) => {
                      (e as any)?.stopPropagation?.();
                      openEdit(item);
                    }}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.miniIconBtn,
                      {
                        backgroundColor: colors.cardSecondary,
                        borderColor: colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                  </Pressable>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </View>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      );
    },
    [colors, enter, navigation, openEdit, renderIconNode, tipoLabel]
  );

  const empty = useMemo(() => {
    return (
      <View style={[styles.emptyCard, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.emptyIcon, { backgroundColor: withAlpha(colors.button, 0.1), borderColor: withAlpha(colors.button, 0.18) }]}>
          <Ionicons name="documents-outline" size={22} color={colors.button} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Crea tu primer bloc</Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          Agrupa items por moneda y liquida cuando lo necesites. No se convierte nada hasta liquidar.
        </Text>

        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.button, opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.buttonText} />
          <Text style={[styles.primaryBtnText, { color: colors.buttonText }]}>Crear bloc</Text>
        </Pressable>
      </View>
    );
  }, [colors, openCreate]);

  // iOS sheet translate
  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [520, 0],
  });
  const sheetBackdropOpacity = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modalTitle = editingBloc ? 'Editar bloc' : 'Nuevo bloc';
  const primaryLabel = editingBloc ? 'Guardar' : 'Crear';
  const previewIcon = (createIcono ?? null) as string | null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header (glass + compact) */}
      <Animated.View style={[styles.headerWrap, { backgroundColor: colors.background }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerGlass,
            { backgroundColor: colors.card, borderBottomColor: colors.border, opacity: headerBgOpacity },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.headerBorder, { backgroundColor: colors.border, opacity: headerBorderOpacity }]}
        />

        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.softShadow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back-outline" size={20} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Bloc de cuentas</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={onRefresh}
              hitSlop={10}
              style={({ pressed }) => [
                styles.iconBtn,
                styles.softShadow,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Animated.View style={{ transform: [{ rotate: refreshing ? refreshRotate : '0deg' }] }}>
                <Ionicons name="refresh" size={18} color={colors.textSecondary} />
              </Animated.View>
            </Pressable>

            <Pressable
              onPress={openCreate}
              hitSlop={10}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: colors.button, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Ionicons name="add" size={20} color={colors.buttonText} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(b) => b.blocId}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.button} />}
        ListEmptyComponent={!loading ? empty : null}
        ListHeaderComponent={
          loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.button} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando blocs…</Text>
            </View>
          ) : (
            <View style={{ height: 6 }} />
          )
        }
      />

      {/* Create modal (iOS sheet + Android slide) */}
      <Modal visible={createOpen} transparent animationType="none" onRequestClose={closeCreate}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.modalOverlay,
            { opacity: sheetBackdropOpacity },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFillObject as any} onPress={closeCreate} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Animated.View
            style={[
              styles.modalCard,
              styles.softShadow,
              {
                backgroundColor: colors.modalBackground,
                borderColor: colors.border,
                transform: [{ translateY: sheetTranslateY }, { scale: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
              },
            ]}
          >
            <View style={styles.modalHandleWrap}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle}</Text>
              <Pressable onPress={closeCreate} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <FormInput placeholder="Nombre" value={createNombre} onChangeText={setCreateNombre} />
            <FormInput placeholder="Descripción (opcional)" value={createDesc} onChangeText={setCreateDesc} />

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Icono</Text>
            <Pressable
              onPress={openIconCatalog}
              style={({ pressed }) => [
                styles.iconPickerRow,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View style={[styles.iconPickerPreview, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                {renderIconNode(previewIcon, createTipo, 18)}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.iconPickerTitle, { color: colors.text }]} numberOfLines={1}>
                  {previewIcon ? 'Icono elegido' : 'Auto por tipo'}
                </Text>
                <Text style={[styles.iconPickerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {previewIcon ? String(previewIcon) : createTipo === 'cuentas' ? 'wallet-outline' : 'cart-outline'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Tipo</Text>
            <View style={styles.tipoRow}>
              <Pressable
                onPress={() => setCreateTipo('cuentas')}
                style={({ pressed }) => [
                  styles.tipoBtn,
                  {
                    backgroundColor: createTipo === 'cuentas' ? colors.button : colors.cardSecondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Ionicons name="wallet-outline" size={16} color={createTipo === 'cuentas' ? colors.buttonText : colors.text} />
                <Text style={[styles.tipoText, { color: createTipo === 'cuentas' ? colors.buttonText : colors.text }]}>
                  Cuentas
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setCreateTipo('compras')}
                style={({ pressed }) => [
                  styles.tipoBtn,
                  {
                    backgroundColor: createTipo === 'compras' ? colors.button : colors.cardSecondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Ionicons name="cart-outline" size={16} color={createTipo === 'compras' ? colors.buttonText : colors.text} />
                <Text style={[styles.tipoText, { color: createTipo === 'compras' ? colors.buttonText : colors.text }]}>
                  Compras
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={!canCreate || saving}
              style={({ pressed }) => [
                styles.primaryBtnWide,
                {
                  backgroundColor: colors.button,
                  opacity: !canCreate || saving ? 0.55 : pressed ? 0.92 : 1,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <>
                  <Ionicons name={editingBloc ? 'checkmark-circle-outline' : 'add-circle-outline'} size={20} color={colors.buttonText} />
                  <Text style={[styles.primaryBtnText, { color: colors.buttonText }]}>{primaryLabel}</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Icon catalog modal */}
      <Modal visible={showIconPicker} transparent animationType="fade" onRequestClose={() => setShowIconPicker(false)}>
        <View style={styles.iconPickerOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject as any} onPress={() => setShowIconPicker(false)} />

          <View style={[styles.iconPickerModal, styles.softShadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.iconPickerHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Buscar icono</Text>
              <Pressable onPress={() => setShowIconPicker(false)} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.iconPickerSearchRow}>
              <FormInput
                placeholder="Buscar… (ej: viaje, comida, pago)"
                value={iconQuery}
                onChangeText={(t) => {
                  setIconQuery(t);
                  setIconPage(1);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ marginBottom: 10 }}
              />
            </View>

            <FlatList
              data={pageIcons}
              keyExtractor={(it) => it}
              numColumns={ICON_COLS}
              contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 10 }}
              columnWrapperStyle={{ gap: 10, paddingBottom: 10 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => selectIconFromCatalog(item)}
                  style={({ pressed }) => [
                    styles.catalogTile,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.border,
                      opacity: pressed ? 0.86 : 1,
                    },
                  ]}
                >
                  <Ionicons name={item as any} size={22} color={colors.text} />
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
            />

            <View style={[styles.iconPickerPager, { borderTopColor: colors.border }]}>
              <Pressable
                disabled={iconPage <= 1}
                onPress={() => setIconPage((p) => Math.max(1, p - 1))}
                style={({ pressed }) => ({ opacity: iconPage <= 1 ? 0.4 : pressed ? 0.7 : 1 })}
              >
                <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
              </Pressable>

              <Text style={[styles.iconPickerPagerText, { color: colors.textSecondary }]}> 
                {iconPage} / {totalIconPages}
              </Text>

              <Pressable
                disabled={iconPage >= totalIconPages}
                onPress={() => setIconPage((p) => Math.min(totalIconPages, p + 1))}
                style={({ pressed }) => ({ opacity: iconPage >= totalIconPages ? 0.4 : pressed ? 0.7 : 1 })}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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

const styles = StyleSheet.create({
  safe: { flex: 1 },

  softShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  // Header
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '900' },
  subtitle: { marginTop: 2, fontSize: 13, fontWeight: '700' },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
  },

  blocCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  blocRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  blocName: { fontSize: 16, fontWeight: '900', flex: 1 },
  blocMeta: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  rightCol: { alignItems: 'flex-end', justifyContent: 'center' },
  miniIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 120,
  },
  chipText: { fontSize: 11, fontWeight: '900' },

  // Loading row
  loadingRow: { paddingVertical: 18, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, fontWeight: '700' },

  // Empty
  emptyCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', marginBottom: 6 },
  emptyBody: { fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 12 },

  primaryBtn: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  primaryBtnWide: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '900' },

  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(31, 41, 55, 0.45)',
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    borderWidth: 1,
    marginHorizontal: 0,
  },
  modalHandleWrap: { alignItems: 'center', paddingTop: 2, paddingBottom: 10 },
  modalHandle: { width: 54, height: 5, borderRadius: 999 },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '900' },

  sectionLabel: { fontSize: 12, fontWeight: '900', marginTop: 4, marginBottom: 10 },

  iconPickerRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconPickerPreview: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPickerTitle: { fontSize: 13, fontWeight: '900' },
  iconPickerSubtitle: { marginTop: 2, fontSize: 12, fontWeight: '700' },

  tipoRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tipoBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  tipoText: { fontSize: 14, fontWeight: '900' },

  // Icon picker modal
  iconPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  iconPickerModal: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  iconPickerHeader: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconPickerSearchRow: { paddingHorizontal: 12, paddingBottom: 0 },
  catalogTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPickerPager: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconPickerPagerText: { fontSize: 12, fontWeight: '800' },
});