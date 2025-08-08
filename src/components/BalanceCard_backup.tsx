import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import AccountSettingsModal from "./AccountSettingsModal";
import SmartNumber from "./SmartNumber";
import Toast from "react-native-toast-message";

interface Transaccion {
  tipo: 'ingreso' | 'egreso';
  monto: number;
}

interface BalanceCardProps {
  reloadTrigger: number;
}

interface CuentaData {
  cantidad: number;
  moneda: string;
}

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const BalanceCard: React.FC<BalanceCardProps> = ({ reloadTrigger }) => {
  console.log('🚀 [BalanceCard] Componente inicializado con reloadTrigger:', reloadTrigger);
  
  const [saldo, setSaldo] = useState(0);
  const [monedaActual, setMonedaActual] = useState('MXN');
  const [ingresos, setIngresos] = useState(0);
  const [egresos, setEgresos] = useState(0);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [periodo, setPeriodo] = useState('mes');
  const [isFetching, setIsFetching] = useState(false);
  const [isChangingCurrency, setIsChangingCurrency] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

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
        type: 'error',
        text1: 'Error al obtener saldo',
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
      // Ejecutar ambas cargas en paralelo para mayor velocidad
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

    // Verificar si realmente necesitamos cambiar
    if (monedaActual === nuevaMoneda) {
      console.log('⚠️ [BalanceCard] La moneda solicitada es igual a la actual, cancelando cambio');
      return;
    }

    setIsChangingCurrency(true);
    
    try {
      console.log('🔄 [BalanceCard] Actualizando moneda local para sincronización visual');
      // Actualizar inmediatamente para sincronización visual
      setMonedaActual(nuevaMoneda);
      
      console.log('🔄 [BalanceCard] Esperando procesamiento del backend...');
      // Esperar un poco para asegurar que el backend procesó el cambio
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('🔄 [BalanceCard] Recargando todos los datos...');
      await reloadAllData();
      
      // Verificación adicional para asegurar sincronización
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
      
      // Revertir cambio local y recargar desde backend
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

  useEffect(() => {
    console.log('🔄 [BalanceCard] useEffect - reloadTrigger cambió:', reloadTrigger);
    fetchDatosCuenta();
  }, [reloadTrigger]);

  useEffect(() => {
    console.log('🔄 [BalanceCard] useEffect - reloadTrigger o periodo cambió:', { reloadTrigger, periodo });
    fetchTransacciones();
  }, [reloadTrigger, periodo]);

  return (
    <View style={[styles.card, styles.neumorphicLight]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Saldo total</Text>
        <TouchableOpacity onPress={() => setSettingsVisible(true)}>
          <Ionicons name="settings-outline" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.amountContainer}>
        <SmartNumber
          value={saldo}
          currentCurrency={monedaActual}
          allowCurrencyChange={!isChangingCurrency}
          onCurrencyChange={(moneda: string) => {
            console.log('🎯 [BalanceCard] SmartNumber (Saldo) - Cambio de moneda solicitado:', {
              from: monedaActual,
              to: moneda,
              value: saldo,
              component: 'Saldo Principal',
              timestamp: new Date().toISOString()
            });
            console.log('🚀 [BalanceCard] Ejecutando handleCurrencyChange desde SmartNumber (Saldo)...');
            handleCurrencyChange(moneda);
          }}
          textStyle={styles.amount}
          options={{
            context: 'card',
            currency: monedaActual,
            maxLength: 20
          }}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.infoItem}>
          <Ionicons name="arrow-up-outline" size={16} color="#4CAF50" />
          <Text style={[styles.infoText, { color: "#4CAF50" }]}>
            Ingreso: 
          </Text>
          <SmartNumber
            value={ingresos}
            currentCurrency={monedaActual}
            allowCurrencyChange={!isChangingCurrency}
            onCurrencyChange={(moneda: string) => {
              console.log('🎯 [BalanceCard] SmartNumber (Ingresos) - Cambio de moneda solicitado:', {
                from: monedaActual,
                to: moneda,
                value: ingresos,
                component: 'Ingresos',
                timestamp: new Date().toISOString()
              });
              console.log('🚀 [BalanceCard] Ejecutando handleCurrencyChange desde SmartNumber (Ingresos)...');
              handleCurrencyChange(moneda);
            }}
            textStyle={[styles.infoText, { color: "#4CAF50", marginLeft: 4 }]}
            options={{
              context: 'list',
              currency: monedaActual,
              maxLength: 15
            }}
          />
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="arrow-down-outline" size={16} color="#F44336" />
          <Text style={[styles.infoText, { color: "#F44336" }]}>
            Egreso: 
          </Text>
          <SmartNumber
            value={egresos}
            currentCurrency={monedaActual}
            allowCurrencyChange={!isChangingCurrency}
            onCurrencyChange={(moneda: string) => {
              console.log('🎯 [BalanceCard] SmartNumber (Egresos) - Cambio de moneda solicitado:', {
                from: monedaActual,
                to: moneda,
                value: egresos,
                component: 'Egresos',
                timestamp: new Date().toISOString()
              });
              console.log('🚀 [BalanceCard] Ejecutando handleCurrencyChange desde SmartNumber (Egresos)...');
              handleCurrencyChange(moneda);
            }}
            textStyle={[styles.infoText, { color: "#F44336", marginLeft: 4 }]}
            options={{
              context: 'list',
              currency: monedaActual,
              maxLength: 15
            }}
          />
        </View>
      </View>

      <View style={styles.filtroContainer}>
        <TouchableOpacity style={styles.filtroToggle} onPress={toggleFiltros}>
          <Ionicons name="funnel-outline" size={18} color="#EF6C00" />
          <Text style={styles.filtroTexto}>{etiquetasFiltro[periodo] || 'Filtrar'}</Text>
          <Ionicons name={mostrarFiltros ? 'chevron-up' : 'chevron-down'} size={18} color="#EF6C00" />
        </TouchableOpacity>

        {mostrarFiltros && (
          <Animated.View style={styles.filtroOpciones}>
            {Object.entries(etiquetasFiltro).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.filtroOpcion, periodo === key && styles.filtroActivo]}
                onPress={() => {
                  console.log('📅 [BalanceCard] Cambiando período de filtro:', { from: periodo, to: key });
                  setPeriodo(key);
                  setMostrarFiltros(false);
                }}
              >
                <Text style={periodo === key ? styles.filtroActivoTexto : styles.filtroTexto}>{label}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
      </View>

      <AccountSettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    backgroundColor: "#f0f0f3",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#EF6C00",
  },
  amount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
    marginTop: 8,
  },
  amountContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    marginLeft: 6,
    fontWeight: "500",
  },
  filtroContainer: {
    marginTop: 16,
  },
  filtroToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f0f0f3',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f0f0f3',
  },
  filtroTexto: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  filtroOpciones: {
    marginTop: 10,
    borderWidth: 1,
    padding: 8,
    backgroundColor: '#f0f0f3',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderColor: '#f0f0f3',
  },
  filtroOpcion: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  filtroActivo: {
    backgroundColor: '#EF772520',
  },
  filtroActivoTexto: {
    color: '#EF6C00',
    fontWeight: '600',
  },
  neumorphicLight: {
    backgroundColor: "#f0f0f3",
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f0f0f3",
  },
});

export default BalanceCard;
