import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Dimensions, KeyboardAvoidingView, Platform, findNodeHandle, UIManager, Keyboard } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import EditSubaccountModal from '../components/EditSubaccountModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRateLimiter } from '../services/apiRateLimiter';
import { API_BASE_URL } from '../constants/api';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Toast from "react-native-toast-message";
import { emitSubcuentasChanged } from '../utils/dashboardRefreshBus';
import ActionButtons from '../components/ActionButtons';
import DeleteModal from '../components/DeleteModal';
import SubaccountRecurrentesList from '../components/SubaccountRecurrentesList';
import { useThemeColors } from '../theme/useThemeColors';
import MovimientoDetalleModal from '../components/MovimientoDetalleModal';
const { width } = Dimensions.get('window');

type Subcuenta = {
  _id: string;
  nombre: string;
  cantidad: number;
  moneda: string;
  simbolo: string;
  color: string;
  afectaCuenta: boolean;
  subCuentaId: string;
  cuentaId: string | null;
  userId: string;
  activa: boolean;
  origenSaldo?: 'cuenta_principal' | 'nuevo';
  createdAt: string;
  updatedAt: string;
  __v: number;
};

type RouteParams = {
  SubaccountDetail: {
    subcuenta: Subcuenta;
    onGlobalRefresh?: () => void;
  };
};

const SubaccountDetail = () => {
  const colors = useThemeColors();
  const route = useRoute<RouteProp<RouteParams, 'SubaccountDetail'>>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [subcuenta, setSubcuenta] = useState<Subcuenta>(route.params.subcuenta);
  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [historial, setHistorial] = useState<any[]>([]);
  const [pagina, setPagina] = useState(1);
  const [limite] = useState(5);
  const [busqueda, setBusqueda] = useState('');
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [fechaAuto, setFechaAuto] = useState({ desde: '', hasta: '' });
  const [participacion, setParticipacion] = useState<number | null>(null);
  const handleGlobalRefresh = route.params?.onGlobalRefresh || (() => { });
  const [userId, setUserId] = useState<string | null>(null);
  const [detalleVisible, setDetalleVisible] = useState(false);
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<any>(null);

  // Refs para prevención de memory leaks
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<number>(0);
  // Refs para control de scroll y búsqueda
  const scrollRef = useRef<ScrollView | null>(null);
  const searchContainerRef = useRef<View | null>(null);

  const scrollToSearch = () => {
    try {
      const searchNode = findNodeHandle(searchContainerRef.current as any);
      const scrollNode = findNodeHandle(scrollRef.current as any);
      if (searchNode && scrollNode && UIManager.measureLayout) {
        UIManager.measureLayout(
          searchNode,
          scrollNode,
          () => {},
          (left: number, top: number, width: number, height: number) => {
            const offset = Math.max(0, top - 20);
            scrollRef.current?.scrollTo({ y: offset, animated: true });
          }
        );
      } else {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    } catch (e) {
      // ignore measurement errors
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('🧹 [SubaccountDetail] Limpiando componente...');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  const pickDate = (item: any): string | null => {
    const candidates = [
      item?.createdAt,
      item?.fecha,
      item?.executedAt,
      item?.updatedAt,
      item?.timestamp,
      item?.date,
    ];
    const found = candidates.find((d) => typeof d === 'string' && d.trim().length > 0);
    return found ?? null;
  };

  const pickDescripcion = (item: any): string => {
    const candidates = [
      item?.descripcion,
      item?.concepto,
      item?.motivo,
      item?.title,
      item?.nombre,
      item?.tipo,
    ];
    const found = candidates.find((s) => typeof s === 'string' && s.trim().length > 0);
    return found ?? 'Movimiento';
  };

  const pickTipo = (item: any): 'ingreso' | 'egreso' | null => {
    const raw = item?.tipo;
    if (raw === 'ingreso' || raw === 'egreso') return raw;
    const raw2 = item?.movimientoTipo;
    if (raw2 === 'ingreso' || raw2 === 'egreso') return raw2;
    return null;
  };

  const pickMonto = (item: any): number | null => {
    const candidates = [item?.monto, item?.cantidad, item?.importe, item?.amount, item?.total];
    const found = candidates.find((n) => typeof n === 'number' && Number.isFinite(n));
    return found ?? null;
  };

  const pickFuente = (item: any): string | null => {
    const candidates = [item?.fuente, item?.origen, item?.source, item?.tipoMovimiento];
    const found = candidates.find((s) => typeof s === 'string' && s.trim().length > 0);
    return found ?? null;
  };

  useEffect(() => {
    const obtenerUserId = async () => {
      const storedId = await AsyncStorage.getItem('userId');
      if (storedId) setUserId(storedId);
    };
    obtenerUserId();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount?: number) => {
    if (typeof amount !== 'number') return '—';
    return amount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  useEffect(() => {
    fetchSubcuenta();
  }, [reloadTrigger]);

  const InfoCard = ({
    icon,
    label,
    value,
    accentColor = '#F59E0B',
    description
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accentColor?: string;
    description?: string;
  }) => (
    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={styles.infoCardContent}>
        <View style={[styles.iconWrapper, { backgroundColor: accentColor + '15' }]}>
          {React.cloneElement(icon as React.ReactElement<any>, {
            size: 22,
            color: accentColor
          })}
        </View>
        <View style={styles.infoTextContainer}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
          {description && <Text style={[styles.infoDescription, { color: colors.placeholder }]}>{description}</Text>}
        </View>
      </View>
    </View>
  );

  const DetailRow = ({
    icon,
    label,
    value,
    accentColor = '#F59E0B'
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accentColor?: string;
  }) => (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <View style={[styles.detailIcon, { backgroundColor: accentColor + '12' }]}>
          {React.cloneElement(icon as React.ReactElement<any>, {
            size: 18,
            color: accentColor
          })}
        </View>
        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );

  const handleEdit = () => {
    setEditVisible(true);
  };

  const fetchSubcuenta = async () => {
    if (!isMountedRef.current) return;

    // Crear nuevo AbortController para esta petición
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const subCuentaId = subcuenta.subCuentaId;

      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/subcuenta/buscar/${subcuenta?.subCuentaId}`, {
        signal,
      });

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('💳 [SubaccountDetail] Fetch subcuenta cancelado');
        return;
      }

      const data = await res.json();
      if (res.ok && data && data.subCuentaId && isMountedRef.current && !signal.aborted) {
        setSubcuenta({ ...data });
      } else if (isMountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Error al recuperar las subcuentas',
          text2: 'Inicia sesión de nuevo o intentalo mas tarde',
        });
      }
    } catch (err: any) {
      // Ignorar errores de abort
      if (err.name === 'AbortError' || signal.aborted) {
        console.log('💳 [SubaccountDetail] Fetch subcuenta cancelado');
        return;
      }
      if (isMountedRef.current) {
        Toast.show({
          type: 'error',
          text1: 'Error al recuperar las subcuentas',
          text2: 'Inicia sesión de nuevo o intentalo mas tarde',
        });
      }
    }
  };

  const fetchParticipacion = async () => {
    if (!isMountedRef.current) return;

    // Crear nuevo AbortController para esta petición
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/subcuenta/participacion/${subcuenta.cuentaId}`, {
        signal,
      });

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('📊 [SubaccountDetail] Fetch participación cancelado');
        return;
      }

      const data = await res.json();

      if (Array.isArray(data) && isMountedRef.current && !signal.aborted) {
        const actual = data.find((item) => item.subsubCuentaId === subcuenta._id);
        if (actual) {
          setParticipacion(actual.porcentaje);
        }
      }
    } catch (err: any) {
      // Ignorar errores de abort
      if (err.name === 'AbortError' || signal.aborted) {
        console.log('📊 [SubaccountDetail] Fetch participación cancelado');
        return;
      }
      if (isMountedRef.current) {
        Toast.show({
          type: "error",
          text1: "Error al obtener participación",
          text2: "No se pudo calcular la participación de esta subcuenta",
        });
      }
    }
  };

  const handleDelete = () => setDeleteVisible(true);

  const confirmDelete = async () => {
    if (!isMountedRef.current) return;

    // Crear nuevo AbortController para esta operación
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const res = await apiRateLimiter.fetch(`${API_BASE_URL}/subcuenta/${subcuenta.subCuentaId}`, {
        method: 'DELETE',
        signal,
      });

      // Verificar si fue abortado
      if (signal.aborted) {
        console.log('🗑️ [SubaccountDetail] Delete cancelado');
        return;
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Error al eliminar la subcuenta');
      }

      if (isMountedRef.current && !signal.aborted) {
        Toast.show({
          type: 'success',
          text1: 'Subcuenta eliminada',
          text2: 'La subcuenta fue eliminada correctamente',
        });
      }

      setDeleteVisible(false);
      emitSubcuentasChanged();
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Dashboard', { updated: false } as any);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al eliminar la subcuenta',
        text2: 'Inicia sesión de nuevo o intentalo mas tarde',
      });
      setDeleteVisible(false);
    }
  };

  const fetchHistorial = async () => {
    try {
      const queryParams = new URLSearchParams({
        desde,
        hasta,
        limite: String(limite),
        pagina: String(pagina),
      });

      if (busqueda.trim()) {
        queryParams.append('descripcion', busqueda.trim());
      }

      const url = `${API_BASE_URL}/subcuenta/${subcuenta.subCuentaId}/movimientos?${queryParams.toString()}`;
      console.log('[SubaccountDetail] fetchHistorial: URL', url);
      const res = await apiRateLimiter.fetch(url);
      console.log('[SubaccountDetail] fetchHistorial: status', res.status);
      const data = await res.json();
      console.log('[SubaccountDetail] fetchHistorial: data', data);


      // Nuevo: Si la respuesta tiene propiedad 'data' como array
      if (Array.isArray(data?.data)) {
        // Ordenar por fecha descendente (más nuevo primero)
        const movimientos = [...data.data].sort((a, b) => new Date(b.fecha || b.createdAt).getTime() - new Date(a.fecha || a.createdAt).getTime());
        setHistorial(movimientos.slice((pagina - 1) * limite, pagina * limite));
        setTotalPaginas(Math.ceil(movimientos.length / limite));
        // Si no hay filtro manual, setear fechas automáticas (primer movimiento más antiguo)
        if (!desde && !hasta && movimientos.length > 0) {
          const ultimo = movimientos[movimientos.length - 1];
          const fechaInicio = (ultimo.fecha || ultimo.createdAt || '').slice(0, 10);
          const fechaFin = new Date().toISOString().slice(0, 10);
          setDesde(fechaInicio);
          setHasta(fechaFin);
          setFechaAuto({ desde: fechaInicio, hasta: fechaFin });
        }
        return;
      }

      if (Array.isArray(data)) {
        const inicio = (pagina - 1) * limite;
        const fin = inicio + limite;
        setHistorial(data.slice(inicio, fin));
        setTotalPaginas(Math.ceil(data.length / limite));
        return;
      }

      if (Array.isArray(data?.resultados)) {
        setHistorial(data.resultados);
        setTotalPaginas(data.totalPaginas || 1);
        return;
      }

      if (Array.isArray(data?.movimientos)) {
        const inicio = (pagina - 1) * limite;
        const fin = inicio + limite;
        setHistorial(data.movimientos.slice(inicio, fin));
        setTotalPaginas(Math.ceil(data.movimientos.length / limite));
        return;
      }

      throw new Error('Respuesta inválida');

    } catch (err) {
      console.error('[SubaccountDetail] fetchHistorial: error', err);
      Toast.show({
        type: 'error',
        text1: 'Error al cargar movimientos',
        text2: 'No se pudieron cargar los movimientos de la subcuenta',
      });
    }
  };

  useEffect(() => {
    fetchSubcuenta();
    fetchParticipacion();
  }, [reloadTrigger]);

  useEffect(() => {
    fetchHistorial();
  }, [pagina, busqueda, desde, hasta]);

  if (!subcuenta.cuentaId) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Subcuenta sin cuenta principal asignada.</Text>
      </View>
    );
  }

  if (!subcuenta) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Cargando subcuenta...</Text>
      </View>
    );
  }

  const toggleEstadoSubcuenta = async () => {
    try {
      const endpoint = `${API_BASE_URL}/subcuenta/${subcuenta.subCuentaId}/${subcuenta.activa ? 'desactivar' : 'activar'}`;

      const res = await apiRateLimiter.fetch(endpoint, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'No se pudo cambiar el estado');
      }

      Toast.show({
        type: 'success',
        text1: subcuenta.activa ? 'Subcuenta desactivada' : 'Subcuenta activada',
        text2: `La subcuenta fue ${subcuenta.activa ? 'desactivada' : 'activada'} correctamente`,
      });

      setReloadTrigger(prev => prev + 1);
      handleGlobalRefresh();

    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error al cambiar estado',
        text2: 'No se pudo actualizar el estado de la subcuenta',
      });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={[styles.headerContainer, { backgroundColor: colors.background, borderBottomColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {subcuenta.nombre || '—'}
            </Text>
            <View style={[
              styles.statusContainer,
              { 
                backgroundColor: subcuenta.activa ? '#FFF7ED' : '#FEF2F2',
                borderColor: colors.border 
              }
            ]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={subcuenta.activa ? '#F59E0B' : '#EF4444'}
              />
              <Text style={[
                styles.statusText,
                { color: subcuenta.activa ? '#F59E0B' : '#EF4444' }
              ]}>
                {subcuenta.activa ? 'Activa' : 'Inactiva'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight} />
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.balanceCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]} key={subcuenta.updatedAt}>
          <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Saldo actual</Text>

          <View style={styles.balanceContainer}>
            <Text style={[styles.currencySymbol, { color: colors.text }]}>{subcuenta.simbolo || '—'}</Text>
            <Text style={[styles.balanceAmount, { color: colors.text }]}>
              {formatCurrency(subcuenta.cantidad)}
            </Text>
            <Text style={[styles.currencyCode, { color: colors.textSecondary }]}>{subcuenta.moneda || ''}</Text>
          </View>

          <View style={styles.colorIndicator}>
            <View style={[styles.colorDot, { backgroundColor: subcuenta.color || '#9CA3AF', borderColor: colors.card }]} />
            <Text style={[styles.colorText, { color: colors.textSecondary }]}>Color de identificación</Text>
          </View>
        </View>

        <View style={styles.actionsWrapper}>
          <ActionButtons
            cuentaId={subcuenta.cuentaId!}
            isSubcuenta
            subcuenta={{
              cuentaPrincipalId: subcuenta.cuentaId!,
              subCuentaId: subcuenta.subCuentaId,
            }}
            fetchSubcuenta={fetchSubcuenta}
            onRefresh={() => {
              fetchSubcuenta();
              handleGlobalRefresh();
            }}
            userId={userId!}
          />
        </View>

        <View style={{ flex: 1 }}>
          <SubaccountRecurrentesList subcuentaId={subcuenta.subCuentaId} userId={userId!} />
        </View>

        <View style={styles.quickInfoGrid}>
          <InfoCard
            icon={<Ionicons name="trending-up-outline" />}
            label="Impacto en cuenta"
            value={subcuenta.afectaCuenta ? 'Sí afecta' : 'No afecta'}
            accentColor={subcuenta.afectaCuenta ? '#F59E0B' : '#6B7280'}
            description={subcuenta.afectaCuenta ? 'Modifica el saldo principal' : 'Independiente'}
          />

          {subcuenta.origenSaldo && (
            <InfoCard
              icon={<Ionicons name="swap-horizontal-outline" />}
              label="Origen del saldo"
              value={subcuenta.origenSaldo === 'cuenta_principal' ? 'Apartado' : 'Saldo nuevo'}
              accentColor="#F59E0B"
              description={
                subcuenta.origenSaldo === 'cuenta_principal'
                  ? 'Reservado desde la cuenta principal'
                  : 'Depósito adicional'
              }
            />
          )}

          <InfoCard
            icon={<Ionicons name="finger-print-outline" />}
            label="ID Subcuenta"
            value={subcuenta.subCuentaId?.slice(-8) || '—'}
            accentColor="#F59E0B"
            description="Identificador único"
          />
        </View>

        {participacion !== null && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Participación en subcuentas</Text>
            <View style={styles.sectionContent}>
              <InfoCard
                icon={<Ionicons name="pie-chart-outline" />}
                label="Participación"
                value={`${participacion.toFixed(1)}%`}
                accentColor="#F59E0B"
                description="Proporción en el total de subcuentas activas"
              />
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Información de cuenta</Text>
          <View style={styles.sectionContent}>
            <DetailRow
              icon={<Ionicons name="person-outline" />}
              label="Usuario"
              value={subcuenta.userId?.slice(-12) || '—'}
              accentColor="#F59E0B"
            />
            <DetailRow
              icon={<Ionicons name="wallet-outline" />}
              label="Cuenta principal"
              value={subcuenta.cuentaId?.slice(-8) || 'No asignada'}
              accentColor="#F59E0B"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Movimientos</Text>
          <View style={styles.sectionContent}>
            <View ref={searchContainerRef} style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                placeholder="Buscar en historial..."
                value={busqueda}
                onChangeText={(text) => {
                  setPagina(1);
                  setBusqueda(text);
                }}
                onFocus={scrollToSearch}
                style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.dateRangeContainer}>
              <View style={styles.dateInputContainer}>
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Desde</Text>
                <TextInput
                  style={[styles.dateInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={desde || fechaAuto.desde}
                  onChangeText={setDesde}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.dateInputContainer}>
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Hasta</Text>
                <TextInput
                  style={[styles.dateInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  value={hasta || fechaAuto.hasta}
                  onChangeText={setHasta}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            {/* History List */}
            {/* Movimientos List */}
            <View style={styles.historyContainer}>
              {historial.length === 0 ? (
                <View style={styles.emptyHistoryContainer}>
                  <Ionicons name="document-text-outline" size={48} color={colors.border} />
                  <Text style={[styles.emptyHistoryText, { color: colors.textSecondary }]}>No hay movimientos registrados</Text>
                  <Text style={[styles.emptyHistorySubtext, { color: colors.placeholder }]}>Los movimientos aparecerán aquí cuando se realicen</Text>
                </View>
              ) : (
                historial.map((item, index) => (
                  <TouchableOpacity
                    key={item._id || index}
                    style={[
                      styles.historyItem,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        marginBottom: 4,
                        shadowColor: colors.shadow,
                        shadowOpacity: 0.08,
                        shadowRadius: 6,
                        elevation: 2,
                        paddingVertical: 18,
                        paddingHorizontal: 16,
                        borderLeftWidth: 6,
                        borderLeftColor: pickTipo(item) === 'egreso' ? '#EF4444' : '#10B981',
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setMovimientoSeleccionado(item);
                      setDetalleVisible(true);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons
                        name={pickTipo(item) === 'egreso' ? 'arrow-up-circle' : 'arrow-down-circle'}
                        size={28}
                        color={pickTipo(item) === 'egreso' ? '#EF4444' : '#10B981'}
                        style={{ marginRight: 12 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyDescription, { color: colors.text }]} numberOfLines={1}>
                          {pickDescripcion(item)}
                        </Text>
                        {item.motivo && (
                          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                            {item.motivo}
                          </Text>
                        )}
                        <Text style={[styles.historyDate, { color: colors.textSecondary, marginTop: item.motivo ? 0 : 2 }]} numberOfLines={1}>
                          {pickDate(item) ? formatDate(pickDate(item) as string) : '—'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', minWidth: 90 }}>
                        {/* Multi-currency display */}
                        {item.montoOriginal != null && item.moneda && (item.montoConvertido != null || item.montoConvertidoCuenta != null || item.montoConvertidoSubcuenta != null) && (item.monedaConvertida || item.monedaConvertidaCuenta || item.monedaConvertidaSubcuenta) ? (
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '700',
                              color: pickTipo(item) === 'egreso' ? '#EF4444' : '#10B981',
                            }}
                          >
                            {(pickTipo(item) === 'egreso' ? '-' : '+') +
                              formatCurrency(item.montoOriginal) + ' ' + item.moneda +
                              ' → ' +
                              formatCurrency(item.montoConvertido ?? item.montoConvertidoCuenta ?? item.montoConvertidoSubcuenta) + ' ' + (item.monedaConvertida ?? item.monedaConvertidaCuenta ?? item.monedaConvertidaSubcuenta)}
                          </Text>
                        ) : pickMonto(item) != null ? (
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '700',
                              color: pickTipo(item) === 'egreso' ? '#EF4444' : '#10B981',
                            }}
                          >
                            {(pickTipo(item) === 'egreso' ? '-' : '+') + (subcuenta.simbolo || '') + formatCurrency(pickMonto(item) as number)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
      {/* Modal de detalle de movimiento */}
      <MovimientoDetalleModal
        visible={detalleVisible}
        onClose={() => setDetalleVisible(false)}
        movimiento={movimientoSeleccionado}
        simbolo={subcuenta.simbolo}
      />

            {/* Pagination */}
            {historial.length > 0 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  onPress={() => setPagina((prev) => Math.max(1, prev - 1))}
                  disabled={pagina === 1}
                  style={[styles.paginationButton, pagina === 1 && [styles.paginationButtonDisabled, { backgroundColor: colors.cardSecondary }]]}
                >
                  <Ionicons name="chevron-back-outline" size={18} color={pagina === 1 ? colors.placeholder : '#FFFFFF'} />
                  <Text style={[styles.paginationButtonText, pagina === 1 && [styles.paginationButtonTextDisabled, { color: colors.placeholder }]]}>
                    Anterior
                  </Text>
                </TouchableOpacity>

                <View style={styles.paginationInfo}>
                  <Text style={[styles.paginationText, { color: colors.textSecondary }]}> {pagina} de {totalPaginas}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setPagina((prev) => (prev < totalPaginas ? prev + 1 : prev))}
                  disabled={pagina === totalPaginas}
                  style={[styles.paginationButton, pagina === totalPaginas && [styles.paginationButtonDisabled, { backgroundColor: colors.cardSecondary }]]}
                >
                  <Text style={[styles.paginationButtonText, pagina === totalPaginas && [styles.paginationButtonTextDisabled, { color: colors.placeholder }]]}>
                    Siguiente
                  </Text>
                  <Ionicons name="chevron-forward-outline" size={18} color={pagina === totalPaginas ? colors.placeholder : '#FFFFFF'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Enhanced Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
            onPress={handleEdit}
          >
            <Ionicons name="create-outline" size={20} color="#F59E0B" />
            <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Eliminar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { borderColor: subcuenta.activa ? '#EF4444' : '#10B981', backgroundColor: colors.card, shadowColor: colors.shadow }
            ]}
            onPress={toggleEstadoSubcuenta}
          >
            <Ionicons
              name={subcuenta.activa ? "pause-circle-outline" : "play-circle-outline"}
              size={20}
              color={subcuenta.activa ? "#EF4444" : "#10B981"}
            />
            <Text style={[
              styles.actionButtonText,
              { color: subcuenta.activa ? "#EF4444" : "#10B981" }
            ]}>
              {subcuenta.activa ? "Desactivar" : "Activar"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Modal de edición */}
      <EditSubaccountModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        subcuenta={subcuenta}
        onSuccess={() => {
          setEditVisible(false);
          fetchSubcuenta();
          emitSubcuentasChanged();
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Dashboard', { updated: false } as any);
          }
        }}
      />

      <DeleteModal
        visible={deleteVisible}
        onCancel={() => setDeleteVisible(false)}
        onConfirm={confirmDelete}
        title="Eliminar Subcuenta"
        message="¿Estás seguro de que deseas eliminar esta Subcuenta? Esta acción no se puede deshacer."
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flexDirection: "row",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerContainer: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderBottomStartRadius: 28,
    borderBottomEndRadius: 28
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerRight: {
    width: 44,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 24,
    padding: 32,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  actionsWrapper: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '800',
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  colorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  colorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickInfoGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  infoCard: {
    flex: 1,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  infoCardContent: {
    padding: 20,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoTextContainer: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoDescription: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 1,
  },
  searchInput: {
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  historyContainer: {
    gap: 16,
  },
  emptyHistoryContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  historyItem: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  historyHeader: {
    marginBottom: 8,
  },
  historyDescription: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  historyDetails: {
    gap: 8,
  },
  historyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDetailText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  historyDetailValue: {
    fontWeight: '700',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    gap: 16,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  paginationButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {},
  paginationInfo: {
    flex: 1,
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  editButton: {
    borderColor: '#F59E0B',
  },
  deleteButton: {
    borderColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 40,
  },
});

export default SubaccountDetail;
