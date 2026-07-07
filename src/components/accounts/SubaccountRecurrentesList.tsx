import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import DeleteModal from './DeleteModal';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import SmartNumber from './SmartNumber';
import { useThemeColors } from '../theme/useThemeColors';
import { subaccountsRecurrentesService } from '../../services/subaccountsRecurrentesService';
import { dashboardRefreshBus, emitRecurrentesChanged } from '../../utils/dashboardRefreshBus';
import { getCachedSessionSnapshot } from '../../shared/state';
import { getCachedSubcuentaRecurrentes } from '../../services/subaccountDetailCacheService';

const { width } = Dimensions.get('window');
const SUBACCOUNT_RECURRENTES_DEBUG_PREFIX = '[SubaccountRecurrentesList]';

interface Props {
  subcuentaId: string;
  subcuentaAltId?: string;
  userId: string;
  onRefresh?: () => void;
}

const SubaccountRecurrentesList = ({ subcuentaId, subcuentaAltId, userId, onRefresh }: Props) => {
  const colors = useThemeColors();
  interface Recurrente {
    recurrenteId: string;
    nombre: string;
    monto: number;
    moneda: string;
    proximaEjecucion: string;
    plataforma?: { color: string; nombre: string; categoria: string };
    frecuenciaTipo: 'dia_semana' | 'dia_mes' | 'fecha_anual';
    frecuenciaValor: string;
    afectaCuentaPrincipal: boolean;
    afectaSubcuenta: boolean;
    recordatorios?: number[];
    cuentaId?: string;
    userId?: string;
    pausado?: boolean;
    // 🆕 Campos para tipo de pago y progreso
    tipoRecurrente?: 'indefinido' | 'plazo_fijo';
    totalPagos?: number;
    pagosRealizados?: number;
    estado?: 'activo' | 'pausado' | 'completado';
  }

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState(userId);
  const isMountedRef = useRef(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candidateSubcuentaIds = useMemo(() => {
    return Array.from(
      new Set(
        [subcuentaId, subcuentaAltId]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    );
  }, [subcuentaAltId, subcuentaId]);

  const normalizeItems = useCallback((value: any): Recurrente[] => {
    if (Array.isArray(value)) return value as Recurrente[];
    if (!value || typeof value !== 'object') return [];

    const candidates = [
      value.items,
      value.data,
      value.resultados,
      value.results,
      value.recurrentes,
      value.records,
      value.rows,
      value.subscriptions,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeItems(candidate);
      if (normalized.length > 0) return normalized;
    }

    return [];
  }, []);

  const normalizeRecurrente = useCallback((item: any): Recurrente => ({
    ...item,
    recurrenteId: String(item?.recurrenteId ?? item?.id ?? item?._id ?? ''),
    userId: item?.userId ? String(item.userId) : undefined,
    cuentaId: item?.cuentaId ? String(item.cuentaId) : undefined,
    moneda: String(item?.moneda ?? item?.monedas ?? 'MXN'),
    nombre: String(item?.nombre ?? item?.plataforma?.nombre ?? 'Recurrente'),
    monto: Number(item?.monto ?? 0),
    proximaEjecucion: String(item?.proximaEjecucion ?? item?.fechaProximoPago ?? item?.fecha ?? ''),
  }), []);

  const fetchRecurrentes = useCallback(async () => {
    const effectiveUserId = String(resolvedUserId || userId || '').trim();
    console.log(`${SUBACCOUNT_RECURRENTES_DEBUG_PREFIX} fetch:start`, {
      propUserId: userId,
      resolvedUserId,
      effectiveUserId,
      subcuentaId,
      subcuentaAltId,
      candidateSubcuentaIds,
    });
    if (!effectiveUserId || !subcuentaId) {
      if (isMountedRef.current) {
        setRecurrentes([]);
        setLoading(false);
      }
      return;
    }

    try {
      if (recurrentes.length === 0) {
        setLoading(true);
      }
      let items: any[] = [];

      for (const candidateId of candidateSubcuentaIds) {
        console.log(`${SUBACCOUNT_RECURRENTES_DEBUG_PREFIX} fetch:attempt`, {
          candidateId,
          effectiveUserId,
        });
        const data = await subaccountsRecurrentesService.getSubcuentaRecurrentes(effectiveUserId, candidateId);
        items = normalizeItems((data as any)?.data ?? data);
        console.log(`${SUBACCOUNT_RECURRENTES_DEBUG_PREFIX} fetch:attemptResponse`, {
          candidateId,
          topLevelKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 20) : [],
          itemsLength: items.length,
          sampleItem: items[0]
            ? {
                recurrenteId: items[0]?.recurrenteId,
                id: items[0]?.id,
                _id: items[0]?._id,
                subcuentaId: items[0]?.subcuentaId,
                subCuentaId: items[0]?.subCuentaId,
              }
            : null,
        });
        if (items.length > 0) break;
      }

      const filtered = items
        .filter((item: any) => {
          const itemSubcuentaId = String(
            item?.subcuentaId ??
            item?.subCuentaId ??
            item?.subcuenta?._id ??
            item?.subcuenta?.id ??
            item?.subcuenta?.subCuentaId ??
            '',
          ).trim();
          return candidateSubcuentaIds.includes(itemSubcuentaId);
        })
        .map(normalizeRecurrente)
        .filter((item) => item.recurrenteId);
      console.log(`${SUBACCOUNT_RECURRENTES_DEBUG_PREFIX} fetch:filtered`, {
        originalItemsLength: items.length,
        filteredLength: filtered.length,
        candidateSubcuentaIds,
        sampleFiltered: filtered[0]
          ? {
              recurrenteId: filtered[0].recurrenteId,
              nombre: filtered[0].nombre,
              userId: filtered[0].userId,
              cuentaId: filtered[0].cuentaId,
            }
          : null,
      });

      if (isMountedRef.current) {
        setRecurrentes(filtered);
      }
    } catch (err) {
      console.log(`${SUBACCOUNT_RECURRENTES_DEBUG_PREFIX} fetch:error`, {
        message: (err as any)?.message,
        status: (err as any)?.statusCode ?? (err as any)?.status,
        code: (err as any)?.code,
        details: (err as any)?.details,
        effectiveUserId,
        candidateSubcuentaIds,
      });
      Toast.show({
        type: 'error',
        text1: 'Error al cargar',
        text2: 'No se pudieron cargar los recurrentes',
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [candidateSubcuentaIds, normalizeItems, normalizeRecurrente, recurrentes.length, resolvedUserId, userId]);

  const primeCachedRecurrentes = useCallback(async () => {
    for (const candidateId of candidateSubcuentaIds) {
      const cached = await getCachedSubcuentaRecurrentes(candidateId).catch(() => null);
      const items = normalizeItems(cached?.data?.data ?? cached?.data ?? {});
      if (items.length === 0) continue;

      const filtered = items
        .filter((item: any) => {
          const itemSubcuentaId = String(
            item?.subcuentaId ??
            item?.subCuentaId ??
            item?.subcuenta?._id ??
            item?.subcuenta?.id ??
            item?.subcuenta?.subCuentaId ??
            '',
          ).trim();
          return candidateSubcuentaIds.includes(itemSubcuentaId);
        })
        .map(normalizeRecurrente)
        .filter((item) => item.recurrenteId);

      if (filtered.length === 0) continue;

      if (isMountedRef.current) {
        setRecurrentes(filtered);
        setLoading(false);
        console.log(`${SUBACCOUNT_RECURRENTES_DEBUG_PREFIX} primeCached`, {
          candidateId,
          filteredLength: filtered.length,
          isFresh: cached?.isFresh ?? false,
          updatedAt: cached?.updatedAt ?? null,
        });
      }
      break;
    }
  }, [candidateSubcuentaIds, normalizeItems, normalizeRecurrente]);

  const handleDelete = async () => {
    try {
      if (!selectedId) return;
      await subaccountsRecurrentesService.deleteRecurrente(selectedId);
      Toast.show({
        type: 'success',
        text1: 'Recurrente eliminado',
      });
      setDeleteVisible(false);
      emitRecurrentesChanged();
      fetchRecurrentes();
      if (onRefresh) onRefresh();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo eliminar el recurrente',
      });
      setDeleteVisible(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    console.log(`${SUBACCOUNT_RECURRENTES_DEBUG_PREFIX} propsUserId`, {
      userId,
    });
    const nextUserId = String(userId ?? '').trim();
    if (nextUserId) {
      setResolvedUserId(nextUserId);
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const snapshot = await getCachedSessionSnapshot();
        const fallbackUserId = String(snapshot.userId ?? '').trim();
        console.log(`${SUBACCOUNT_RECURRENTES_DEBUG_PREFIX} sessionFallback`, {
          snapshotUserId: snapshot.userId,
          fallbackUserId,
          currentResolvedUserId: resolvedUserId,
        });
        if (!cancelled && fallbackUserId && fallbackUserId !== resolvedUserId) {
          setResolvedUserId(fallbackUserId);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedUserId]);

  useEffect(() => {
    console.log(`${SUBACCOUNT_RECURRENTES_DEBUG_PREFIX} effectFetchRecurrentes`);
    void primeCachedRecurrentes();
    fetchRecurrentes();
  }, [fetchRecurrentes, primeCachedRecurrentes]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        fetchRecurrentes();
      }, 180);
    };

    const offRec = dashboardRefreshBus.on('recurrentes:changed', scheduleRefresh);
    const offSub = dashboardRefreshBus.on('subcuentas:changed', scheduleRefresh);
    return () => {
      offRec();
      offSub();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [fetchRecurrentes]);

  if (loading) {
    return <ActivityIndicator color={colors.button} style={{ marginTop: 20 }} />;
  }

  if (!recurrentes.length) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="calendar-outline" size={48} color={colors.placeholder} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin recurrentes</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          No hay recurrentes registrados para esta subcuenta.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.inputBackground, shadowColor: colors.shadow }]}> 
      <Text style={[styles.title, { color: colors.text }]}>Recurrentes</Text>
      <FlatList
        data={recurrentes}
        keyExtractor={(item) => item.recurrenteId}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('RecurrenteDetail', { recurrente: { ...item, pausado: item.pausado ?? false } })}
            style={[styles.card, { borderColor: colors.button, backgroundColor: colors.card, alignSelf: 'center', maxWidth: 180, minWidth: 140, width: '90%' }]}
          >
            <View>
              <Text style={[styles.nombre, { color: colors.text }]} numberOfLines={1}>{item.nombre}</Text>
              <Text style={[styles.monto, { color: colors.text }]}>
                ${item.monto >= 1000000 
                  ? `${(item.monto / 1000000).toFixed(1)}M`
                  : item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Próxima: {item.proximaEjecucion.slice(0, 10)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        scrollEnabled={false}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'center', marginBottom: 14 }}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 40,
    borderRadius: 14,
    padding: 16,
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  card: {
    minWidth: 140,
    maxWidth: 170,
    flex: 1,
    height: 90,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'space-between',
    marginHorizontal: 4,
    backgroundColor: '#23272F', // más contraste
    borderColor: '#F59E0B', // naranja más vivo
    shadowColor: '#F59E0B',
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
  },
  nombre: {
    fontSize: 12,
    fontWeight: '600',
  },
  monto: {
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#FDE68A', // amarillo suave
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#B45309', // naranja oscuro
    fontWeight: '600',
  },
  iconActions: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  emptyContainer: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
});

export default SubaccountRecurrentesList;
