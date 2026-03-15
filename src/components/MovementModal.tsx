import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  PanResponder,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from "@expo/vector-icons";
import Toast from 'react-native-toast-message';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL } from '../constants/api';
import apiRateLimiter from '../services/apiRateLimiter';
import SmartInput from './SmartInput';
import SmartNumber from './SmartNumber';
import { CurrencyField, Moneda } from '../components/CurrencyPicker';
import { useThemeColors } from '../theme/useThemeColors';
import { emitSubcuentasChanged, emitTransaccionesChanged } from '../utils/dashboardRefreshBus';
import { normalizeEmojiStrict, emojiFontFix } from '../utils/fixMojibake';
import { fixEncoding } from '../utils/fixEncoding';
import { offlineSyncService } from '../services/offlineSyncService';
import EventBus from '../utils/eventBus';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onClose: () => void;
  tipo: 'ingreso' | 'egreso';
  cuentaId: string;
  onSuccess: () => void;
  isSubcuenta?: boolean;
  subcuentaId?: string;
  onRefresh?: () => void;
}

interface Concepto {
  conceptoId: string;
  nombre: string;
  color: string;
  icono: string;
}

/** =======================
 *  Fecha efectiva (UI pro)
 *  ======================= */
function formatYYYYMMDD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYYYYMMDD(s: string): Date | null {
  const t = (s || '').trim();
  if (!t) return null;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(t);
  if (!m) return null;
  const [yStr, moStr, dStr] = t.split('-');
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  const dt = new Date(y, mo - 1, d);
  if (
    dt.getFullYear() === y &&
    dt.getMonth() === mo - 1 &&
    dt.getDate() === d
  ) return dt;
  return null;
}

type EffectiveDateFieldProps = {
  value: string; // YYYY-MM-DD o ""
  onChange: (next: string) => void;
  colors: any;
};

const EffectiveDateField: React.FC<EffectiveDateFieldProps> = ({ value, onChange, colors }) => {
  const [showPicker, setShowPicker] = useState(false);

  const currentDate = useMemo(() => {
    const parsed = parseYYYYMMDD(value);
    return parsed ?? new Date();
  }, [value]);

  const setRelative = (deltaDays: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + deltaDays);
    onChange(formatYYYYMMDD(d));
  };

  const clear = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onChange('');
  };

  const open = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowPicker(true);
  };

  const onPickerChange = (_event: DateTimePickerEvent, selected?: Date) => {
    // Android cierra automáticamente; iOS puede seguir visible dependiendo del display
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) {
      onChange(formatYYYYMMDD(selected));
    }
  };

  const pretty = useMemo(() => {
    if (!value?.trim()) return 'Sin fecha (usa hoy por defecto)';
    return value;
  }, [value]);

  return (
    <View style={[styles.fieldBlock, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text }]}>Fecha efectiva (opcional)</Text>
        {!!value?.trim() ? (
          <TouchableOpacity onPress={clear} activeOpacity={0.85}>
            <Text style={[styles.clearText, { color: colors.textSecondary }]}>Limpiar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={open}
        activeOpacity={0.9}
        style={[
          styles.dateDisplay,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.dateIcon, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          </View>
          <Text style={[styles.dateText, { color: colors.inputText }]}>
            {pretty}
          </Text>
        </View>

        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.quickRow}>
        <TouchableOpacity
          onPress={() => setRelative(0)}
          activeOpacity={0.88}
          style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.quickText, { color: colors.text }]}>Hoy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setRelative(-1)}
          activeOpacity={0.88}
          style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.quickText, { color: colors.text }]}>Ayer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setRelative(1)}
          activeOpacity={0.88}
          style={[styles.quickPill, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.quickText, { color: colors.text }]}>Mañana</Text>
        </TouchableOpacity>
      </View>

      {showPicker ? (
        <View style={{ marginTop: 10 }}>
          <DateTimePicker
            value={currentDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onPickerChange}
          />

          {Platform.OS === 'ios' ? (
            <TouchableOpacity
              onPress={() => setShowPicker(false)}
              activeOpacity={0.9}
              style={[styles.doneBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.doneText, { color: colors.text }]}>Listo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.dateHint, { color: colors.textSecondary }]}>
        Tip: si no eliges fecha, se usa la fecha actual.
      </Text>
    </View>
  );
};

const MovementModal: React.FC<Props> = ({
  visible,
  onClose,
  tipo,
  cuentaId,
  onSuccess,
  isSubcuenta,
  subcuentaId,
  onRefresh
}) => {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();

  const [montoNumerico, setMontoNumerico] = useState<number | null>(null);
  const [montoValido, setMontoValido] = useState(false);
  const [erroresMonto, setErroresMonto] = useState<string[]>([]);

  const [motivo, setMotivo] = useState('');
  const [fechaEfectiva, setFechaEfectiva] = useState(''); // YYYY-MM-DD
  const [afectaCuenta, setAfectaCuenta] = useState(true);

  const [moneda, setMoneda] = useState('MXN');
  const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>({
    id: 'seed',
    codigo: 'MXN',
    nombre: 'Peso mexicano',
    simbolo: '$',
  });

  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [conceptoBusqueda, setConceptoBusqueda] = useState('');
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState<Concepto | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingBootstrap, setLoadingBootstrap] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
      } catch {}
    }
  }, []);

  // PanResponder para cerrar solo desde el handle superior
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gs) => Math.abs(gs.dy) > 6 && Math.abs(gs.dx) < 20,
      onPanResponderRelease: (_evt, gs) => {
        if (gs.dy > 80) onClose();
      },
    })
  ).current;

  const icon = tipo === 'ingreso' ? 'arrow-up-outline' : 'arrow-down-outline';
  const tipoColor = tipo === 'ingreso' ? '#4CAF50' : '#F44336';

  const getLimitesPorTipo = useCallback(() => {
    const baseLimit = isSubcuenta ? 1_000_000 : 10_000_000;
    return tipo === 'egreso'
      ? { maxValue: baseLimit, minValue: 0.01, warningThreshold: baseLimit * 0.1 }
      : { maxValue: baseLimit * 10, minValue: 0.01, warningThreshold: baseLimit * 0.5 };
  }, [isSubcuenta, tipo]);

  const warningThreshold = getLimitesPorTipo().warningThreshold;

  const handleMontoChange = (value: number | null) => setMontoNumerico(value);
  const handleValidationChange = (isValid: boolean, errors: string[]) => {
    setMontoValido(isValid);
    setErroresMonto(errors);
  };

  const getSymbolForCurrency = (currency: string): string => {
    const symbols: Record<string, string> = {
      MXN: '$',
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CNY: '¥',
    };
    return symbols[currency] || '$';
  };

  const resetForm = useCallback(() => {
    setMontoNumerico(null);
    setMontoValido(false);
    setErroresMonto([]);
    setMotivo('');
    setFechaEfectiva('');
    setConceptoBusqueda('');
    setConceptoSeleccionado(null);
    setAfectaCuenta(true);
  }, []);

  const fetchCuentaYConceptos = useCallback(async () => {
    try {
      setLoadingBootstrap(true);
      const [resCuentaRaw, resConceptosRaw] = await Promise.all([
        apiRateLimiter.fetch(`${API_BASE_URL}/cuenta/principal`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-store',
            'X-Skip-Cache': '1',
          },
        }),
        apiRateLimiter.fetch(`${API_BASE_URL}/conceptos`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-store',
            'X-Skip-Cache': '1',
          },
        }),
      ]);

      const [resCuenta, resConceptos] = await Promise.all([
        resCuentaRaw.json().catch(() => ({})),
        resConceptosRaw.json().catch(() => ({})),
      ]);

      const codigo = resCuenta?.moneda || 'MXN';
      const symbol = resCuenta?.simbolo || getSymbolForCurrency(codigo);

      setMoneda(codigo);
      setSelectedMoneda({
        id: 'seed',
        codigo,
        nombre: codigo,
        simbolo: symbol,
      });

      if (Array.isArray(resConceptos?.resultados)) setConceptos(resConceptos.resultados);
      else if (Array.isArray(resConceptos?.data)) setConceptos(resConceptos.data);
      else if (Array.isArray(resConceptos)) setConceptos(resConceptos);
      else setConceptos([]);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al cargar datos',
        text2: err?.message || 'No se pudieron cargar cuenta ni conceptos.',
      });
      setConceptos([]);
    } finally {
      setLoadingBootstrap(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      fetchCuentaYConceptos();
    } else {
      resetForm();
    }
  }, [visible, fetchCuentaYConceptos, resetForm]);

  useEffect(() => {
    if (!visible) return;

    const handleConceptChanged = (payload?: any) => {
      fetchCuentaYConceptos();

      const changed = payload?.item;
      if (changed?.conceptoId && changed?.nombre) {
        setConceptoSeleccionado({
          conceptoId: String(changed.conceptoId),
          nombre: String(changed.nombre),
          color: String(changed.color ?? '#EF7725'),
          icono: String(changed.icono ?? 'pricetag-outline'),
        });
        setConceptoBusqueda('');
      }
    };

    EventBus.on('conceptChanged', handleConceptChanged);
    return () => EventBus.off('conceptChanged', handleConceptChanged);
  }, [visible, fetchCuentaYConceptos]);

  const conceptosFiltrados = useMemo(() => {
    const q = conceptoBusqueda.trim().toLowerCase();
    if (!q) return conceptos;
    return conceptos.filter((c) => (c?.nombre || '').toLowerCase().includes(q));
  }, [conceptoBusqueda, conceptos]);

  const canSubmit = useMemo(() => {
    return !!montoNumerico && montoValido && !!motivo.trim();
  }, [montoNumerico, montoValido, motivo]);

  const validateFecha = (fecha: string) => {
    const trimmed = (fecha || '').trim();
    if (!trimmed) return { ok: true as const };

    const parsed = parseYYYYMMDD(trimmed);
    if (!parsed) {
      return {
        ok: false as const,
        message: 'Selecciona una fecha válida.',
      };
    }

    return { ok: true as const };
  };

  const handleSend = useCallback(async () => {
    if (!montoNumerico || !montoValido || !motivo.trim()) {
      return Toast.show({
        type: 'error',
        text1: 'Datos incompletos',
        text2: 'Verifica el monto y el motivo.',
      });
    }

    const fechaCheck = validateFecha(fechaEfectiva);
    if (!fechaCheck.ok) {
      return Toast.show({
        type: 'error',
        text1: 'Fecha inválida',
        text2: fechaCheck.message,
      });
    }

    if (erroresMonto.some((e) => e.includes('muy grande'))) {
      Toast.show({
        type: 'warning',
        text1: 'Monto inusualmente grande',
        text2: '¿Seguro que es correcto?',
      });
    }

    const conceptoFinal = (conceptoSeleccionado?.nombre || motivo.trim()).trim();
    if (!conceptoFinal) {
      return Toast.show({
        type: 'error',
        text1: 'Concepto requerido',
        text2: 'Selecciona o escribe un concepto.',
      });
    }

    try {
      setLoading(true);
      const payload: any = {
        tipo,
        monto: montoNumerico,
        concepto: conceptoFinal,
        motivo,
        ...(fechaEfectiva.trim() ? { fecha: fechaEfectiva.trim() } : {}),
        moneda,
        cuentaId,
        afectaCuenta,
        ...(isSubcuenta && subcuentaId ? { subCuentaId: subcuentaId } : {}),
      };

      const netState = await NetInfo.fetch().catch(() => null);
      const isConnected = !!netState?.isConnected;

      if (!isConnected) {
        await offlineSyncService.enqueueTransaccion(payload);
        Toast.show({
          type: 'success',
          text1: 'Movimiento guardado offline',
          text2: 'Se sincronizará cuando haya conexión.',
        });

        onRefresh?.();
        onSuccess();
        resetForm();
        onClose();

        if (isSubcuenta) {
          emitSubcuentasChanged();
        }

        // offlineSyncService already emits transacciones:changed, but keep behavior consistent.
        emitTransaccionesChanged();
        return;
      }

      let res: any;
      try {
        res = await apiRateLimiter.fetch(`${API_BASE_URL}/transacciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e: any) {
        const msg = String(e?.message ?? e ?? '');
        if (msg.toLowerCase().includes('network request failed') || msg.toLowerCase().includes('failed to fetch')) {
          await offlineSyncService.enqueueTransaccion(payload);
          Toast.show({
            type: 'success',
            text1: 'Movimiento guardado offline',
            text2: 'Se sincronizará cuando haya conexión.',
          });

          onRefresh?.();
          onSuccess();
          resetForm();
          onClose();

          if (isSubcuenta) {
            emitSubcuentasChanged();
          }

          emitTransaccionesChanged();
          return;
        }
        throw e;
      }

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || 'Error al guardar');

      Toast.show({ type: 'success', text1: 'Movimiento guardado' });

      onRefresh?.();
      onSuccess();

      resetForm();
      onClose();

      // Mantener dashboard y feeds sincronizados tras mutaciones
      emitTransaccionesChanged();

      if (isSubcuenta) {
        emitSubcuentasChanged();
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err?.message || 'No se pudo guardar' });
    } finally {
      setLoading(false);
    }
  }, [
    montoNumerico,
    montoValido,
    motivo,
    fechaEfectiva,
    erroresMonto,
    conceptoSeleccionado,
    tipo,
    moneda,
    cuentaId,
    afectaCuenta,
    isSubcuenta,
    subcuentaId,
    onRefresh,
    onSuccess,
    resetForm,
    onClose,
  ]);

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.modalContainer}
      backdropOpacity={0.14}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={320}
      animationOutTiming={260}
      useNativeDriver
      avoidKeyboard
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          <View {...pan.panHandlers} style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.tipoBadge, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <Ionicons name={icon} size={18} color={tipoColor} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Agregar {tipo}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isSubcuenta ? 'Subcuenta' : 'Cuenta principal'}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {loadingBootstrap ? (
            <View style={[styles.bootstrap, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={[styles.bootstrapText, { color: colors.textSecondary }]}>Cargando datos…</Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <SmartInput
              type="currency"
              initialValue={0}
              context="transaction"
              maxValue={getLimitesPorTipo().maxValue}
              minValue={getLimitesPorTipo().minValue}
              onValueChange={handleMontoChange}
              onValidationChange={handleValidationChange}
              prefix={selectedMoneda?.simbolo || getSymbolForCurrency(moneda)}
              clearable
              autoFix
              style={StyleSheet.flatten([{ flex: 1, marginRight: 10, marginTop: 6 }])}
              placeholder="0.00"
            />

            <View style={{ minWidth: 128, marginTop: 6 }}>
              <CurrencyField
                value={selectedMoneda}
                onChange={(m) => {
                  setSelectedMoneda(m);
                  setMoneda(m.codigo);
                }}
                showSearch
              />
            </View>
          </View>

          {!!montoNumerico && montoNumerico >= warningThreshold ? (
            <View style={[styles.warningContainer, { borderLeftColor: '#F59E0B' }]}>
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Monto inusualmente grande</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.warningText}>Has ingresado: </Text>
                  <SmartNumber
                    value={montoNumerico}
                    options={{
                      context: 'detail',
                      symbol: selectedMoneda?.simbolo || getSymbolForCurrency(moneda),
                    }}
                    textStyle={[styles.warningText, styles.warningAmount]}
                  />
                </View>
                <Text style={styles.warningSubtext}>Verifica que sea correcto antes de continuar.</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.fieldBlock, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.label, { color: colors.text }]}>Motivo</Text>
            <TextInput
              placeholder="Ej: Gasolina, Nómina, Starbucks…"
              value={motivo}
              onChangeText={setMotivo}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.border,
                  color: colors.inputText,
                },
              ]}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          {/* ✅ NUEVO: Fecha efectiva pro */}
          <EffectiveDateField
            value={fechaEfectiva}
            onChange={setFechaEfectiva}
            colors={colors}
          />

          {/* Conceptos (tu lógica original, pero con emojis seguros) */}
          <View style={[styles.fieldBlock, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.conceptHeader}>
              <Text style={[styles.label, { color: colors.text }]}>Conceptos</Text>
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('Concepts');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.8}
              >
                <Text style={styles.adminLink}>Administrar</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
              <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Buscar concepto…"
                placeholderTextColor={colors.placeholder}
                value={conceptoBusqueda}
                onChangeText={setConceptoBusqueda}
                style={[styles.searchInput, { color: colors.inputText }]}
              />
              {!!conceptoBusqueda ? (
                <TouchableOpacity onPress={() => setConceptoBusqueda('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.chipsWrap}>
              {conceptosFiltrados.slice(0, 24).map((item) => {
                const isSelected = conceptoSeleccionado?.conceptoId === item.conceptoId;
                const emoji = normalizeEmojiStrict(item.icono || '', '•');
                const looksLikeIonicon = typeof item.icono === 'string' && item.icono.includes('-');

                return (
                  <TouchableOpacity
                    key={item.conceptoId}
                    onPress={() => setConceptoSeleccionado(isSelected ? null : item)}
                    activeOpacity={0.88}
                    style={[
                      styles.chip,
                      {
                        borderColor: isSelected ? item.color : colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    {looksLikeIonicon ? (
                      <View style={[styles.chipIconBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}> 
                        <Ionicons name={(item.icono || '') as any} size={16} color={item.color || colors.text} />
                      </View>
                    ) : (
                      <View style={[styles.chipDot, { backgroundColor: item.color }]}> 
                        <Text style={{ fontSize: 12 }}>{emoji}</Text>
                      </View>
                    )}

                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.text },
                        isSelected && { fontWeight: '900' },
                      ]}
                      numberOfLines={1}
                    >
                      {fixEncoding(item.nombre)}
                    </Text>
                    {isSelected ? <Ionicons name="checkmark" size={14} color={item.color} /> : null}
                  </TouchableOpacity>
                );
              })}

              {conceptosFiltrados.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 6 }}>
                  Sin resultados…
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.switchCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Afecta cuenta principal</Text>
              <Text style={[styles.switchHint, { color: colors.textSecondary }]}>
                Si lo apagas, se registra sin modificar saldo.
              </Text>
            </View>
            <Switch value={afectaCuenta} onValueChange={setAfectaCuenta} />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: tipoColor, opacity: loading ? 0.8 : 1 },
              !canSubmit && { opacity: 0.55 },
            ]}
            onPress={handleSend}
            disabled={loading || !canSubmit}
            activeOpacity={0.9}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>Guardar</Text>}
          </TouchableOpacity>
        </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { justifyContent: 'flex-end', margin: 0 },
  modal: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 10,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipoBadge: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center' },

  bootstrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  bootstrapText: { fontSize: 12, fontWeight: '700' },

  fieldBlock: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '900' },
  clearText: { fontSize: 12, fontWeight: '900' },

  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    fontSize: 14,
    borderWidth: 1,
  },

  // Fecha efectiva
  dateDisplay: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  dateIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { fontSize: 13.5, fontWeight: '800' },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  quickPill: { borderRadius: 999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12 },
  quickText: { fontSize: 12, fontWeight: '900' },
  doneBtn: { marginTop: 10, borderRadius: 14, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  doneText: { fontSize: 13, fontWeight: '900' },
  dateHint: { marginTop: 8, fontSize: 11, fontWeight: '700' },

  // Conceptos
  conceptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  adminLink: { fontSize: 12, color: '#EF7725', fontWeight: '900' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0, fontWeight: '700' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipDot: { width: 34, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipIconBadge: { width: 34, height: 30, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  chipText: { fontSize: 12.5, fontWeight: '800', maxWidth: 220, ...emojiFontFix },

  // Switch
  switchCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchLabel: { fontSize: 14, fontWeight: '900' },
  switchHint: { fontSize: 12, fontWeight: '700', marginTop: 3 },

  // CTA
  button: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  // Warning
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    marginTop: 10,
    borderLeftWidth: 4,
  },
  warningContent: { flex: 1, marginLeft: 8 },
  warningTitle: { fontSize: 14, fontWeight: '900', color: '#92400E', marginBottom: 4 },
  warningText: { fontSize: 12, color: '#92400E', marginBottom: 2, fontWeight: '700' },
  warningAmount: { fontWeight: '900', color: '#92400E' },
  warningSubtext: { fontSize: 11, color: '#A16207', fontStyle: 'italic', fontWeight: '700' },
});

export default MovementModal;
