import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Dimensions } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import EditSubaccountModal from '../components/EditSubaccountModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Toast from "react-native-toast-message";
import DeleteSubaccountModal from '../components/DeleteSubaccountModal';
import ActionButtons from '../components/ActionButtons';
import RecurrentesList from '../components/RecurrenteList';

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
  const [desde, setDesde] = useState('2024-01-01');
  const [hasta, setHasta] = useState('2026-01-01');
  const [participacion, setParticipacion] = useState<number | null>(null);
  const handleGlobalRefresh = route.params?.onGlobalRefresh || (() => {});
  const [userId, setUserId] = useState<string | null>(null);

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
    <View style={styles.infoCard}>
      <View style={styles.infoCardContent}>
        <View style={[styles.iconWrapper, { backgroundColor: accentColor + '15' }]}>
          {React.cloneElement(icon as React.ReactElement<any>, { 
            size: 22, 
            color: accentColor
          })}
        </View>
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
          {description && <Text style={styles.infoDescription}>{description}</Text>}
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
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  const handleEdit = () => {
    setEditVisible(true);
  };

  const fetchSubcuenta = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const subCuentaId = subcuenta.subCuentaId;
      
      const res = await fetch(`${API_BASE_URL}/subcuenta/buscar/${subcuenta?.subCuentaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && data && data.subCuentaId) {
        setSubcuenta({ ...data });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error al recuperar las subcuentas',
          text2: 'Inicia sesión de nuevo o intentalo mas tarde',
        });
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al recuperar las subcuentas',
        text2: 'Inicia sesión de nuevo o intentalo mas tarde',
      });
    }
  };

  const fetchParticipacion = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");

      const res = await fetch(`${API_BASE_URL}/subcuenta/participacion/${subcuenta.cuentaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (Array.isArray(data)) {
        const actual = data.find((item) => item.subsubCuentaId === subcuenta._id);
        if (actual) {
          setParticipacion(actual.porcentaje);
        }
      }
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Error al obtener participación",
        text2: "No se pudo calcular la participación de esta subcuenta",
      });
    }
  };

  const handleDelete = () => setDeleteVisible(true);

  const confirmDelete = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(`${API_BASE_URL}/subcuenta/${subcuenta.subCuentaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Error al eliminar la subcuenta');
      }

      Toast.show({
        type: 'success',
        text1: 'Subcuenta eliminada',
        text2: 'La subcuenta fue eliminada correctamente',
      });

      setDeleteVisible(false);
      navigation.navigate('Dashboard', { updated: true });
    } catch (err: any) {
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
      const token = await AsyncStorage.getItem("authToken");

      const queryParams = new URLSearchParams({
        desde,
        hasta,
        limite: String(limite),
        pagina: String(pagina),
      });

      if (busqueda.trim()) {
        queryParams.append('descripcion', busqueda.trim());
      }

      const res = await fetch(`${API_BASE_URL}/subcuenta/${subcuenta.subCuentaId}/historial?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (Array.isArray(data)) {
        const inicio = (pagina - 1) * limite;
        const fin = inicio + limite;
        setHistorial(data.slice(inicio, fin));
        setTotalPaginas(Math.ceil(data.length / limite));
      } else if (Array.isArray(data.resultados)) {
        setHistorial(data.resultados);
        setTotalPaginas(data.totalPaginas || 1);
      } else {
        throw new Error('Respuesta inválida');
      }

    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al cargar historial',
        text2: 'No se pudo cargar el historial de movimientos',
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
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Subcuenta sin cuenta principal asignada.</Text>
      </View>
    );
  }

  if (!subcuenta) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Cargando subcuenta...</Text>
      </View>
    );
  }

  const toggleEstadoSubcuenta = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const endpoint = `${API_BASE_URL}/subcuenta/${subcuenta.subCuentaId}/${subcuenta.activa ? 'desactivar' : 'activar'}`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              {subcuenta.nombre || '—'}
            </Text>
            <View style={[
              styles.statusContainer,
              { backgroundColor: subcuenta.activa ? '#FFF7ED' : '#FEF2F2' }
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

      {/* Body */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard} key={subcuenta.updatedAt}>
          <Text style={styles.balanceLabel}>Saldo actual</Text>
          
          <View style={styles.balanceContainer}>
            <Text style={styles.currencySymbol}>{subcuenta.simbolo || '—'}</Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(subcuenta.cantidad)}
            </Text>
            <Text style={styles.currencyCode}>{subcuenta.moneda || ''}</Text>
          </View>

          <View style={styles.colorIndicator}>
            <View style={[styles.colorDot, { backgroundColor: subcuenta.color || '#9CA3AF' }]} />
            <Text style={styles.colorText}>Color de identificación</Text>
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

        {/* Enhanced Quick Info Cards */}
        <View style={styles.quickInfoGrid}>
          <InfoCard
            icon={<Ionicons name="trending-up-outline" />}
            label="Impacto en cuenta"
            value={subcuenta.afectaCuenta ? 'Sí afecta' : 'No afecta'}
            accentColor={subcuenta.afectaCuenta ? '#F59E0B' : '#6B7280'}
            description={subcuenta.afectaCuenta ? 'Modifica el saldo principal' : 'Independiente'}
          />
          
          <InfoCard
            icon={<Ionicons name="finger-print-outline" />}
            label="ID Subcuenta"
            value={subcuenta.subCuentaId?.slice(-8) || '—'}
            accentColor="#F59E0B"
            description="Identificador único"
          />
        </View>

        {/* Participación en subcuentas */}
        {participacion !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participación en subcuentas</Text>
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

        {/* Enhanced Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de cuenta</Text>
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

        <RecurrentesList esSubcuenta subcuentaId="ID_SUBCUENTA" userId={userId!} />
        
        {/* Enhanced History Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de movimientos</Text>
          <View style={styles.sectionContent}>
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#6B7280" style={styles.searchIcon} />
              <TextInput
                placeholder="Buscar en historial..."
                value={busqueda}
                onChangeText={(text) => {
                  setPagina(1);
                  setBusqueda(text);
                }}
                style={styles.searchInput}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Date Range Inputs */}
            <View style={styles.dateRangeContainer}>
              <View style={styles.dateInputContainer}>
                <Text style={styles.dateLabel}>Desde</Text>
                <TextInput
                  style={styles.dateInput}
                  value={desde}
                  onChangeText={setDesde}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.dateInputContainer}>
                <Text style={styles.dateLabel}>Hasta</Text>
                <TextInput
                  style={styles.dateInput}
                  value={hasta}
                  onChangeText={setHasta}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* History List */}
            <View style={styles.historyContainer}>
              {historial.length === 0 ? (
                <View style={styles.emptyHistoryContainer}>
                  <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyHistoryText}>No hay movimientos registrados</Text>
                  <Text style={styles.emptyHistorySubtext}>Los movimientos aparecerán aquí cuando se realicen</Text>
                </View>
              ) : (
                historial.map((item, index) => (
                  <View key={item._id || index} style={styles.historyItem}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyDescription}>{item.descripcion}</Text>
                      <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                    
                    {item.datos && Object.keys(item.datos).length > 0 && (
                      <View style={styles.historyDetails}>
                        {Object.entries(item.datos).map(([clave, valor]: [string, any]) => {
                          const claveLabel = clave.charAt(0).toUpperCase() + clave.slice(1);

                          const iconName = (() => {
                            switch (clave) {
                              case 'nombre': return 'text-outline';
                              case 'color': return 'color-palette-outline';
                              case 'cantidad': return 'cash-outline';
                              case 'afectaCuenta': return 'swap-horizontal-outline';
                              default: return 'information-circle-outline';
                            }
                          })();

                          if (typeof valor === 'object' && valor.antes !== undefined && valor.despues !== undefined) {
                            return (
                              <View key={clave} style={styles.historyDetailRow}>
                                <Ionicons name={iconName} size={16} color="#F59E0B" />
                                <Text style={styles.historyDetailText}>
                                  {claveLabel}: <Text style={styles.historyDetailValue}>{String(valor.antes)}</Text>
                                  <Ionicons name="arrow-forward-outline" size={13} color="#6B7280" />
                                  <Text style={styles.historyDetailValue}>{String(valor.despues)}</Text>
                                </Text>
                              </View>
                            );
                          } else {
                            return (
                              <View key={clave} style={styles.historyDetailRow}>
                                <Ionicons name={iconName} size={16} color="#F59E0B" />
                                <Text style={styles.historyDetailText}>
                                  {claveLabel}: <Text style={styles.historyDetailValue}>{JSON.stringify(valor)}</Text>
                                </Text>
                              </View>
                            );
                          }
                        })}
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* Pagination */}
            {historial.length > 0 && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  onPress={() => setPagina((prev) => Math.max(1, prev - 1))}
                  disabled={pagina === 1}
                  style={[styles.paginationButton, pagina === 1 && styles.paginationButtonDisabled]}
                >
                  <Ionicons name="chevron-back-outline" size={18} color={pagina === 1 ? '#9CA3AF' : '#FFFFFF'} />
                  <Text style={[styles.paginationButtonText, pagina === 1 && styles.paginationButtonTextDisabled]}>
                    Anterior
                  </Text>
                </TouchableOpacity>

                <View style={styles.paginationInfo}>
                  <Text style={styles.paginationText}> {pagina} de {totalPaginas}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setPagina((prev) => (prev < totalPaginas ? prev + 1 : prev))}
                  disabled={pagina === totalPaginas}
                  style={[styles.paginationButton, pagina === totalPaginas && styles.paginationButtonDisabled]}
                >
                  <Text style={[styles.paginationButtonText, pagina === totalPaginas && styles.paginationButtonTextDisabled]}>
                    Siguiente
                  </Text>
                  <Ionicons name="chevron-forward-outline" size={18} color={pagina === totalPaginas ? '#9CA3AF' : '#FFFFFF'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Enhanced Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEdit}
          >
            <Ionicons name="create-outline" size={20} color="#F59E0B" />
            <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Eliminar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { borderColor: subcuenta.activa ? '#EF4444' : '#10B981' }
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
          navigation.navigate('Dashboard', { updated: true });
          handleGlobalRefresh();
        }}
      />

      <DeleteSubaccountModal
        visible={deleteVisible}
        onCancel={() => setDeleteVisible(false)}
        onConfirm={confirmDelete}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f3f3',
  },
  centerContainer: {
    flexDirection: "row",
    backgroundColor: '#f3f3f3',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  headerContainer: {
    backgroundColor: '#f3f3f3',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
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
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
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
    borderColor: '#E5E7EB',
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
    backgroundColor: '#f3f3f3',
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#6B7280',
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
    color: '#1F2937',
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -2,
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
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
    borderColor: '#f3f3f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  colorText: {
    fontSize: 14,
    color: '#64748B',
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
    backgroundColor: '#f3f3f3',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
    color: '#64748B',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  infoDescription: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  section: {
    backgroundColor: '#f3f3f3',
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
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
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
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
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  dateInput: {
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#64748B',
    fontWeight: '600',
    marginTop: 16,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  historyItem: {
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyHeader: {
    marginBottom: 8,
  },
  historyDescription: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 13,
    color: '#64748B',
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
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  historyDetailValue: {
    fontWeight: '700',
    color: '#1F2937',
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
    backgroundColor: '#f3f3f3',
    shadowOpacity: 0,
    elevation: 0,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#9CA3AF',
  },
  paginationInfo: {
    flex: 1,
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 12,
    color: '#64748B',
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
    backgroundColor: '#f3f3f3',
    shadowColor: '#000',
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