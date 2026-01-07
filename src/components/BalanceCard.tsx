import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import AccountSettingsModal from "./AccountSettingsModal";
import SmartNumber from "./SmartNumber";
import Toast from "react-native-toast-message";
import { useThemeColors } from "../theme/useThemeColors"; 

interface Transaccion {
  tipo: 'ingreso' | 'egreso';
  monto: number;
}

interface BalanceCardProps {
  reloadTrigger: number;
  onCurrencyChange?: () => void;
}

interface CuentaData {
  cantidad: number;
  moneda: string;
}

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const BalanceCard: React.FC<BalanceCardProps> = ({ reloadTrigger, onCurrencyChange }) => {
  console.log('🚀 [BalanceCard] Componente inicializado con reloadTrigger:', reloadTrigger);
  const colors = useThemeColors();
  
  const [saldo, setSaldo] = useState(0);
  const [monedaActual, setMonedaActual] = useState('MXN');
  const [ingresos, setIngresos] = useState(0);
  const [egresos, setEgresos] = useState(0);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [periodo, setPeriodo] = useState('mes');
  const [isFetching, setIsFetching] = useState(false);
  const [isChangingCurrency, setIsChangingCurrency] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [refreshPreferences, setRefreshPreferences] = useState(0);
  const [showFullNumbers, setShowFullNumbers] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;

  const FILTER_MAX_HEIGHT = 180; // Ajusta según el contenido

  useEffect(() => {
    const loadNumberPreference = async () => {
      try {
        const preference = await AsyncStorage.getItem('showFullNumbers');
        setShowFullNumbers(preference === 'true');
      } catch (error) {
        console.error('Error cargando preferencia de números:', error);
      }
    };
    
    loadNumberPreference();
    
    // Listener para cambios en la preferencia
    const checkInterval = setInterval(() => {
      loadNumberPreference();
    }, 500);
    
    return () => clearInterval(checkInterval);
  }, []);

  useEffect(() => {
    if (mostrarFiltros) {
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: FILTER_MAX_HEIGHT,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [mostrarFiltros]);


  const etiquetasFiltro: Record<string, string> = {
    dia: 'Día',
    semana: 'Semana',
    mes: 'Mes',
    '3meses': '3 Meses',
    '6meses': '6 Meses',
    año: 'Año',
  };

  const fetchDatosCuenta = async () => {
    console.log('📊 [BalanceCard] Iniciando fetch de datos de cuenta...');
    
    try {
      const token = await AsyncStorage.getItem("authToken");
      console.log('🔑 [BalanceCard] Token obtenido:', token ? 'Existe' : 'No encontrado');
      
      const url = `${API_BASE_URL}/cuenta/principal`;
      console.log('🌐 [BalanceCard] Realizando petición a:', url);

      if (!token) {
        console.log('⚠️ [BalanceCard] No hay token de autenticación, saltando fetch de cuenta');
        return;
      }
      
      const resCuenta = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log('📥 [BalanceCard] Respuesta de cuenta recibida:', {
        status: resCuenta.status,
        data: resCuenta.data
      });
      
      const cuentaData: CuentaData = resCuenta.data;
      const nuevoSaldo = cuentaData.cantidad || 0;
      const nuevaMoneda = cuentaData.moneda || 'MXN';
      
      console.log('💰 [BalanceCard] Actualizando estado con datos de cuenta:', {
        saldoAnterior: saldo,
        saldoNuevo: nuevoSaldo,
        monedaAnterior: monedaActual,
        monedaNueva: nuevaMoneda,
        sincronizacionBackend: nuevaMoneda !== monedaActual ? 'Detectado cambio de moneda en backend' : 'Moneda consistente'
      });
      
      setSaldo(nuevoSaldo);
      setMonedaActual(nuevaMoneda);
      
      console.log('✅ [BalanceCard] Datos de cuenta actualizados exitosamente');
    } catch (err) {
      console.error('❌ [BalanceCard] Error al obtener datos de cuenta:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      Toast.show({
        type: 'info',
        text1: 'Los datos se cargaron errorneamente, intenta de nuevo',
      });
    }
  };

  const fetchTransacciones = async () => {
    if (isFetching) {
      console.log('⏳ [BalanceCard] Fetch de transacciones ya en progreso, saltando...');
      return;
    }
    
    console.log('📋 [BalanceCard] Iniciando fetch de transacciones:', { periodo });
    setIsFetching(true);
    
    try {
      const token = await AsyncStorage.getItem("authToken");
      console.log('🔑 [BalanceCard] Token obtenido para transacciones:', token ? 'Existe' : 'No encontrado');
      
      const url = `${API_BASE_URL}/transacciones?rango=${periodo}`;
      console.log('🌐 [BalanceCard] Realizando petición de transacciones a:', url);
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('📥 [BalanceCard] Respuesta de transacciones recibida:', {
        status: res.status,
        dataLength: res.data?.length || 0,
        periodo
      });

      const transacciones = res.data || [];
      console.log('🔍 [BalanceCard] Procesando transacciones:', {
        totalTransacciones: transacciones.length,
        tipos: transacciones.reduce((acc: any, t: Transaccion) => {
          acc[t.tipo] = (acc[t.tipo] || 0) + 1;
          return acc;
        }, {})
      });

      const ingresoTotal: number = transacciones
        .filter((t: Transaccion): t is Transaccion => t.tipo === 'ingreso')
        .reduce((acc: number, t: Transaccion): number => acc + t.monto, 0);
      const egresoTotal: number = transacciones
        .filter((t: Transaccion): t is Transaccion => t.tipo === 'egreso')
        .reduce((acc: number, t: Transaccion): number => acc + t.monto, 0);

      console.log('💹 [BalanceCard] Totales calculados:', {
        ingresosAnteriores: ingresos,
        ingresosNuevos: ingresoTotal,
        egresosAnteriores: egresos,
        egresosNuevos: egresoTotal,
        diferencia: {
          ingresos: ingresoTotal - ingresos,
          egresos: egresoTotal - egresos
        }
      });

      setIngresos(ingresoTotal);
      setEgresos(egresoTotal);
      
      console.log('✅ [BalanceCard] Transacciones actualizadas exitosamente');
    } catch (err) {
      console.error('❌ [BalanceCard] Error al obtener transacciones:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        periodo,
        timestamp: new Date().toISOString()
      });
      
      Toast.show({
        type: 'error',
        text1: 'Error al obtener transacciones',
      });
    } finally {
      setIsFetching(false);
      console.log('🏁 [BalanceCard] Finalizando fetch de transacciones');
    }
  };

  const reloadAllData = async () => {
    console.log('🔄 [BalanceCard] Iniciando recarga completa de datos...');
    try {
      await Promise.all([
        fetchDatosCuenta(),
        fetchTransacciones()
      ]);
      console.log('✅ [BalanceCard] Recarga completa de datos exitosa');
    } catch (error) {
      console.error('❌ [BalanceCard] Error en recarga completa:', error);
    }
  };

  const handleCurrencyChange = async (nuevaMoneda: string) => {
    console.log('🔄 [BalanceCard] === INICIO CAMBIO DE MONEDA ===');
    console.log('🔄 [BalanceCard] Iniciando cambio de moneda:', {
      monedaActual,
      nuevaMoneda,
      saldoActual: saldo,
      ingresosActuales: ingresos,
      egresosActuales: egresos,
      periodo,
      timestamp: new Date().toISOString()
    });

    if (monedaActual === nuevaMoneda) {
      console.log('⚠️ [BalanceCard] La moneda solicitada es igual a la actual, cancelando cambio');
      return;
    }

    setIsChangingCurrency(true);
    
    try {
      console.log('🔄 [BalanceCard] Actualizando moneda local para sincronización visual');
      setMonedaActual(nuevaMoneda);
      
      console.log('🔄 [BalanceCard] Esperando procesamiento del backend...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('🔄 [BalanceCard] Recargando todos los datos...');
      await reloadAllData();
      
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        console.log(`🔍 [BalanceCard] Verificación ${retries + 1}/${maxRetries} de sincronización`);
        
        try {
          const token = await AsyncStorage.getItem("authToken");
          const response = await axios.get(`${API_BASE_URL}/cuenta/principal`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          const currentBackendCurrency = response.data.moneda;
          console.log('🔍 [BalanceCard] Moneda en backend:', currentBackendCurrency);
          
          if (currentBackendCurrency === nuevaMoneda) {
            console.log('✅ [BalanceCard] Sincronización confirmada');
            setMonedaActual(currentBackendCurrency); // Asegurar sincronización
            break;
          } else {
            console.log('⚠️ [BalanceCard] Moneda aún no sincronizada, reintentando...');
            retries++;
            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              await reloadAllData();
            }
          }
        } catch (verifyError) {
          console.error('❌ [BalanceCard] Error verificando sincronización:', verifyError);
          break;
        }
      }
      
      console.log('✅ [BalanceCard] Cambio de moneda completado exitosamente:', {
        monedaFinal: nuevaMoneda,
        timestamp: new Date().toISOString()
      });
      console.log('🔄 [BalanceCard] === FIN CAMBIO DE MONEDA EXITOSO ===');
      
      // 🆕 Notificar al Dashboard para que actualice todos los componentes
      if (onCurrencyChange) {
        console.log('📢 [BalanceCard] Notificando al Dashboard sobre cambio de moneda');
        onCurrencyChange();
      }
      
      Toast.show({
        type: 'success',
        text1: 'Moneda actualizada',
        text2: `Cuenta convertida a ${nuevaMoneda}`,
      });
    } catch (error) {
      console.error('❌ [BalanceCard] === ERROR EN CAMBIO DE MONEDA ===');
      console.error('❌ [BalanceCard] Error en el proceso de cambio de moneda:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        monedaInicial: monedaActual,
        monedaObjetivo: nuevaMoneda,
        timestamp: new Date().toISOString()
      });
      
      console.log('🔄 [BalanceCard] Revirtiendo cambio y recargando desde backend');
      await reloadAllData();
      
      Toast.show({
        type: 'error',
        text1: 'Error al cambiar moneda',
      });
    } finally {
      setIsChangingCurrency(false);
    }
  };

  const toggleFiltros = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMostrarFiltros(prev => !prev);
  };

  const handleSettingsClose = () => {
    setSettingsVisible(false);
    setRefreshPreferences(prev => prev + 1);
  };

  useEffect(() => {
    console.log('🔄 [BalanceCard] useEffect - reloadTrigger cambió:', reloadTrigger);
    fetchDatosCuenta();
  }, [reloadTrigger]);

  useEffect(() => {
    console.log('🔄 [BalanceCard] useEffect - reloadTrigger o periodo cambió:', { reloadTrigger, periodo });
    fetchTransacciones();
  }, [reloadTrigger, periodo]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow, borderColor: colors.border }]}>
      {/* Header con título y configuración */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Saldo total</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setSettingsVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Contenedor del saldo principal */}
      <View style={styles.balanceWrapper}>
        <SmartNumber
          value={saldo}
          textStyle={[styles.balanceAmount, { color: colors.text }]}
          options={{
            context: 'card',
            currency: monedaActual,
            maxLength: 20
          }}
        />
      </View>

      {/* Contenedor de ingresos y egresos */}
      <View style={styles.statsContainer}>
        <View style={[styles.statItem, { shadowColor: colors.shadow, borderColor: colors.border }]}>
          <View style={styles.statIconWrapper}>
            <Ionicons name="arrow-up" size={14} color="#34C759" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ingreso</Text>
            <SmartNumber
              value={ingresos}
              textStyle={[styles.statValue, { color: colors.text }]}
              options={{
                context: 'list',
                currency: monedaActual,
                maxLength: 15
              }}
            />
          </View>
        </View>

        <View style={[styles.statItem, { shadowColor: colors.shadow, borderColor: colors.border }]}>
          <View style={styles.statIconWrapper}>
            <Ionicons name="arrow-down" size={14} color="#FF3B30" />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Egreso</Text>
            <SmartNumber
              value={egresos}
              textStyle={[styles.statValue, { color: colors.text }]}
              options={{
                context: 'list',
                currency: monedaActual,
                maxLength: 15
              }}
            />
          </View>
        </View>
      </View>

      {/* Sección de filtros con animación */}
      <View style={styles.filterSection}>
        <TouchableOpacity 
          style={[styles.filterToggle, { shadowColor: colors.shadow, borderColor: colors.border }]} 
          onPress={toggleFiltros}
          activeOpacity={0.8}
        >
          <View style={styles.filterContent}>
            <View style={styles.filterIconWrapper}>
              <Ionicons name="funnel" size={16} color="#FF9500" />
            </View>
            <Text style={[styles.filterText, { color: colors.text }]}>{etiquetasFiltro[periodo]}</Text>
            <Ionicons 
              name={mostrarFiltros ? 'chevron-up' : 'chevron-down'} 
              size={16} 
              color={colors.textSecondary} 
            />
          </View>
        </TouchableOpacity>

        <Animated.View style={{
          overflow: 'hidden',
          height: animatedHeight,
          opacity: animatedOpacity,
        }}>
          {mostrarFiltros && (
            <View style={[styles.filterOptions, { backgroundColor: colors.cardSecondary, shadowColor: colors.shadow, borderColor: colors.border }]}>
              {Object.entries(etiquetasFiltro).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterOption,
                    periodo === key && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    console.log('📅 [BalanceCard] Cambiando período de filtro:', { from: periodo, to: key });
                    setPeriodo(key);
                    setMostrarFiltros(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterOptionText,
                    { color: colors.textSecondary },
                    periodo === key && styles.filterOptionTextActive
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      </View>

      <AccountSettingsModal visible={settingsVisible} onClose={handleSettingsClose} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    shadowOffset: {
      width: 3,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  settingsButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 1,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  balanceWrapper: {
    marginBottom: 10,
    paddingVertical: 2,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 32,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 1,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statIconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
    shadowColor: "#000",
    shadowOffset: {
      width: 1,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  statTextContainer: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginBottom: 0.5,
    letterSpacing: -0.1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  filterSection: {
    marginTop: 4,
  },
  filterToggle: {
    borderRadius: 12,
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    borderWidth: 1,
  },
  filterContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterIconWrapper: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255, 149, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  filterText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  filterOptions: {
    marginTop: 6,
    borderRadius: 12,
    padding: 4,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    borderWidth: 1,
  },
  filterOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 0.5,
  },
  filterOptionActive: {
    backgroundColor: "rgba(255, 149, 0, 0.15)",
    shadowColor: "rgba(255, 149, 0, 0.3)",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  filterOptionTextActive: {
    color: "#FF9500",
    fontWeight: "600",
  },
});

export default BalanceCard;
// commit