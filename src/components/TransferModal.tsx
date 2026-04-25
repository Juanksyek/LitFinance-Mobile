import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import Modal from 'react-native-modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { API_BASE_URL } from '../constants/api';
import apiRateLimiter from '../services/apiRateLimiter';
import { useThemeColors } from '../theme/useThemeColors';
import { createIdempotencyKey } from '../utils/idempotency';
import { emitSubcuentasChanged, emitTransaccionesChanged } from '../utils/dashboardRefreshBus';
import { authService } from '../services/authService';
import { jwtDecode } from '../utils/jwtDecode';
import { fixEncoding } from '../utils/fixEncoding';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type EntityType = 'cuenta' | 'subcuenta';

type TransferEndpointEntity = {
  type: EntityType;
  id: string;
  nombre: string;
  moneda?: string;
  cuentaId?: string | null;
};

type Option = TransferEndpointEntity & {
  label: string;
  subtitle: string;
};

type CuentaPrincipalResponse = {
  cuentaId?: string;
  id?: string;
  _id?: string;
  nombre?: string;
  moneda?: string;
  simbolo?: string;
};

type SubcuentaResponse = {
  subCuentaId?: string;
  _id?: string;
  id?: string;
  nombre?: string;
  moneda?: string;
  simbolo?: string;
  cuentaId?: string | null;
  activa?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  cuentaId?: string;
  userId?: string;
  isSubcuenta?: boolean;
  currentSubcuentaId?: string;
  onSuccess?: (result?: any) => void;
};

type JwtPayload = {
  userId?: string;
  cuentaId?: string;
  [key: string]: any;
};

const TransferModal: React.FC<Props> = ({
  visible,
  onClose,
  cuentaId,
  userId,
  isSubcuenta,
  currentSubcuentaId,
  onSuccess,
}) => {
  const colors = useThemeColors();
  const [loadingBootstrap, setLoadingBootstrap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [concepto, setConcepto] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [origen, setOrigen] = useState<Option | null>(null);
  const [destino, setDestino] = useState<Option | null>(null);

  const reset = useCallback(() => {
    setMonto('');
    setMotivo('');
    setConcepto('');
    setOptions([]);
    setOrigen(null);
    setDestino(null);
  }, []);

  const resolveUserId = useCallback(async (): Promise<string | null> => {
    if (userId) return String(userId);

    try {
      const stored = await AsyncStorage.getItem('userId');
      if (stored) return stored;
    } catch {}

    try {
      const token = await authService.getAccessToken();
      if (!token) return null;
      const decoded = jwtDecode(token) as JwtPayload;
      return decoded?.userId ? String(decoded.userId) : null;
    } catch {
      return null;
    }
  }, [userId]);

  const fetchBootstrap = useCallback(async () => {
    try {
      setLoadingBootstrap(true);

      const resolvedUserId = await resolveUserId();
      if (!resolvedUserId) throw new Error('No se pudo obtener el usuario actual');

      const [cuentaRes, subcuentasRes] = await Promise.all([
        apiRateLimiter.fetch(`${API_BASE_URL}/cuenta/principal`, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-store', 'X-Skip-Cache': '1' },
        }),
        apiRateLimiter.fetch(
          `${API_BASE_URL}/subcuenta/${encodeURIComponent(resolvedUserId)}?soloActivas=true&page=1&limit=200`,
          {
            method: 'GET',
            headers: { 'Cache-Control': 'no-store', 'X-Skip-Cache': '1' },
          }
        ),
      ]);

      const [cuentaBody, subcuentasBody] = await Promise.all([
        cuentaRes.json().catch(() => ({})),
        subcuentasRes.json().catch(() => ([])),
      ]);

      const cuentaRaw: CuentaPrincipalResponse = cuentaBody?.data ?? cuentaBody?.cuenta ?? cuentaBody ?? {};
      const principalId = String(cuentaRaw?.cuentaId ?? cuentaRaw?.id ?? cuentaRaw?._id ?? cuentaId ?? '').trim();
      if (!principalId) throw new Error('No se pudo obtener la cuenta principal');

      const principalOption: Option = {
        type: 'cuenta',
        id: principalId,
        nombre: String(cuentaRaw?.nombre ?? 'Cuenta principal'),
        moneda: String(cuentaRaw?.moneda ?? ''),
        cuentaId: principalId,
        label: fixEncoding(String(cuentaRaw?.nombre ?? 'Cuenta principal')),
        subtitle: `Cuenta principal${cuentaRaw?.moneda ? ` · ${cuentaRaw.moneda}` : ''}`,
      };

      const subcuentasArray: SubcuentaResponse[] = Array.isArray(subcuentasBody?.data)
        ? subcuentasBody.data
        : Array.isArray(subcuentasBody?.resultados)
        ? subcuentasBody.resultados
        : Array.isArray(subcuentasBody)
        ? subcuentasBody
        : [];

      const subcuentasOptions: Option[] = subcuentasArray
        .filter((s) => s && (s.activa ?? true))
        .map((s) => {
          const id = String(s.subCuentaId ?? s.id ?? s._id ?? '').trim();
          return {
            type: 'subcuenta' as const,
            id,
            nombre: String(s.nombre ?? 'Subcuenta'),
            moneda: String(s.moneda ?? ''),
            cuentaId: s.cuentaId != null ? String(s.cuentaId) : principalId,
            label: fixEncoding(String(s.nombre ?? 'Subcuenta')),
            subtitle: `Subcuenta${s.moneda ? ` · ${s.moneda}` : ''}`,
          };
        })
        .filter((s) => !!s.id);

      const nextOptions = [principalOption, ...subcuentasOptions];
      setOptions(nextOptions);

      if (isSubcuenta && currentSubcuentaId) {
        const preferredSource = nextOptions.find((o) => o.type === 'subcuenta' && o.id === currentSubcuentaId) ?? null;
        setOrigen(preferredSource);
        if (preferredSource) {
          const preferredDestination = nextOptions.find((o) => !(o.type === preferredSource.type && o.id === preferredSource.id)) ?? null;
          setDestino(preferredDestination);
        }
      } else {
        setOrigen(principalOption);
        const preferredDestination = subcuentasOptions[0] ?? null;
        setDestino(preferredDestination);
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al cargar transferencias',
        text2: err?.message || 'No se pudieron cargar las cuentas disponibles.',
      });
      setOptions([]);
    } finally {
      setLoadingBootstrap(false);
    }
  }, [resolveUserId, cuentaId, isSubcuenta, currentSubcuentaId]);

  useEffect(() => {
    if (visible) {
      fetchBootstrap();
      return;
    }
    reset();
  }, [visible, fetchBootstrap, reset]);

  const sameOriginDestination = useMemo(() => {
    if (!origen || !destino) return false;
    return origen.type === destino.type && origen.id === destino.id;
  }, [origen, destino]);

  const montoNumerico = useMemo(() => Number(String(monto).replace(/,/g, '.').trim()), [monto]);

  const canSubmit = useMemo(() => {
    return Boolean(origen && destino && !sameOriginDestination && Number.isFinite(montoNumerico) && montoNumerico > 0);
  }, [origen, destino, sameOriginDestination, montoNumerico]);

  const handleSubmit = useCallback(async () => {
    if (!origen || !destino) {
      Toast.show({ type: 'error', text1: 'Selecciona origen y destino' });
      return;
    }
    if (sameOriginDestination) {
      Toast.show({ type: 'error', text1: 'Origen y destino no pueden ser iguales' });
      return;
    }
    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      Toast.show({ type: 'error', text1: 'Monto inválido', text2: 'Ingresa un monto mayor a 0.' });
      return;
    }

    const idempotencyKey = createIdempotencyKey('tr');
    const payload: any = {
      monto: montoNumerico,
      origen: { type: origen.type, id: origen.id },
      destino: { type: destino.type, id: destino.id },
      ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      ...(concepto.trim() ? { concepto: concepto.trim() } : {}),
      idempotencyKey,
    };

    if (origen.moneda) {
      payload.moneda = origen.moneda;
    }

    try {
      setSubmitting(true);
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/transferencias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || 'No se pudo procesar la transferencia');

      Toast.show({
        type: 'success',
        text1: body?.message || 'Transferencia procesada',
        text2: fixEncoding(String(motivo.trim() || concepto.trim() || 'Movimiento interno realizado')),
      });

      emitTransaccionesChanged();
      emitSubcuentasChanged();
      onSuccess?.(body);
      onClose();
      reset();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al transferir',
        text2: err?.message || 'No se pudo completar la transferencia',
      });
    } finally {
      setSubmitting(false);
    }
  }, [origen, destino, sameOriginDestination, montoNumerico, motivo, concepto, onSuccess, onClose, reset]);

  const renderOptionGroup = (title: string, selected: Option | null, onSelect: (value: Option) => void) => (
    <View style={[styles.fieldBlock, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}> 
      <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
      <View style={styles.optionsWrap}>
        {options.map((option) => {
          const active = selected?.type === option.type && selected?.id === option.id;
          return (
            <TouchableOpacity
              key={`${option.type}:${option.id}`}
              onPress={() => onSelect(option)}
              activeOpacity={0.88}
              style={[
                styles.optionChip,
                {
                  backgroundColor: active ? colors.card : colors.inputBackground,
                  borderColor: active ? colors.button : colors.border,
                },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: active ? colors.cardSecondary : colors.card }]}> 
                <Ionicons
                  name={option.type === 'cuenta' ? 'wallet-outline' : 'layers-outline'}
                  size={15}
                  color={active ? colors.button : colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: colors.text }]} numberOfLines={1}>
                  {option.label}
                </Text>
                <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {option.subtitle}
                </Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={18} color={colors.button} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modalContainer}
      backdropOpacity={0.18}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      useNativeDriver
      propagateSwipe
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.modal, { backgroundColor: colors.card }]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerBadge, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}> 
              <Ionicons name="swap-horizontal-outline" size={18} color={colors.button} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Transferencia interna</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Cuenta ↔ subcuenta</Text>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 }}>
          {loadingBootstrap ? (
            <View style={[styles.bootstrap, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}> 
              <ActivityIndicator size="small" color={colors.button} />
              <Text style={[styles.bootstrapText, { color: colors.textSecondary }]}>Cargando cuentas disponibles…</Text>
            </View>
          ) : null}

          <View style={[styles.fieldBlock, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Monto</Text>
            <TextInput
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={monto}
              onChangeText={setMonto}
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          {renderOptionGroup('Origen', origen, setOrigen)}
          {renderOptionGroup('Destino', destino, setDestino)}

          {sameOriginDestination ? (
            <View style={[styles.warningBox, { backgroundColor: colors.cardSecondary, borderColor: colors.warning }]}> 
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={[styles.warningText, { color: colors.textSecondary }]}>El origen y el destino no pueden ser el mismo.</Text>
            </View>
          ) : null}

          <View style={[styles.fieldBlock, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Motivo (opcional)</Text>
            <TextInput
              placeholder="Ej: Abono entre sobres"
              value={motivo}
              onChangeText={setMotivo}
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View style={[styles.fieldBlock, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Concepto (opcional)</Text>
            <TextInput
              placeholder="Ej: Transferencia interna"
              value={concepto}
              onChangeText={setConcepto}
              style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.inputText }]}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.button },
              (!canSubmit || submitting) && { opacity: 0.55 },
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            activeOpacity={0.9}
          >
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Transferir</Text>}
          </TouchableOpacity>
        </ScrollView>
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
    maxHeight: SCREEN_HEIGHT * 0.72,
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
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
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
  label: { fontSize: 12, fontWeight: '900', marginBottom: 8 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    fontSize: 14,
    borderWidth: 1,
  },
  optionsWrap: { gap: 10 },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  optionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontSize: 13.5, fontWeight: '800' },
  optionSubtitle: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  warningBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: { flex: 1, fontSize: 12, fontWeight: '700' },
  submitButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.2 },
});

export default TransferModal;
