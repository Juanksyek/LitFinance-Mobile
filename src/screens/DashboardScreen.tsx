import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { StatusBar } from "expo-status-bar";
import DashboardHeader from "../components/DashboardHeader";
import BalanceCard from "../components/BalanceCard";
import ActionButtons from "../components/ActionButtons";
import ExpensesChart from "../components/ExpensesChart";
import TransactionHistory from "../components/TransactionHistory";
import SubaccountsList from "../components/SubaccountList";
import RecurrentesList from "../components/RecurrenteList";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import { useFocusEffect, useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { RootStackParamList } from "../navigation/AppNavigator";

export default function DashboardScreen() {
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const route = useRoute<RouteProp<RootStackParamList, "Dashboard">>();
  const navigation = useNavigation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  const handleCurrencyChange = useCallback(() => {
    console.log('💱 [DashboardScreen] === INICIO ACTUALIZACIÓN POR CAMBIO DE MONEDA ===');
    console.log('💱 [DashboardScreen] Actualizando todos los componentes por cambio de moneda');
    const newTrigger = Date.now();
    console.log('💱 [DashboardScreen] Nuevos triggers:', {
      reloadTrigger: newTrigger,
      refreshKey: newTrigger,
      timestamp: new Date().toISOString()
    });
    setReloadTrigger(newTrigger);
    setRefreshKey(newTrigger);
    console.log('💱 [DashboardScreen] === FIN ACTUALIZACIÓN POR CAMBIO DE MONEDA ===');
  }, []);

  const fetchCuentaId = async () => {
    try {
      console.log('Obteniendo datos de cuenta principal...');
      const token = await AsyncStorage.getItem("authToken");
      
      if (!token) {
        throw new Error('No hay token de autenticación');
      }
      
      const res = await axios.get(`${API_BASE_URL}/cuenta/principal`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000, // 10 segundos de timeout
      });
      
      setCuentaId(res.data.id || res.data._id);
      setUserId(res.data.userId);
      console.log('Datos de cuenta obtenidos exitosamente');
    } catch (err: any) {
      console.error('Error fetching cuenta:', err);
      
      let errorMessage = "Inicia sesión de nuevo o inténtalo más tarde";
      
      if (err.response?.status === 429) {
        errorMessage = "Demasiadas peticiones. Espera un momento e intenta de nuevo";
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = "Tiempo de espera agotado. Verifica tu conexión";
      } else if (err.response?.status === 401) {
        errorMessage = "Sesión expirada. Inicia sesión nuevamente";
      }
      
      Toast.show({
        type: "error",
        text1: "Error al recuperar la cuenta principal",
        text2: errorMessage,
      });
    }
  };

  useEffect(() => {
    fetchCuentaId();
  }, []);

  useEffect(() => {
    if (route.params?.updated) {
      setReloadTrigger(prev => prev + 1);
    }
  }, [route.params]);

  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    const minInterval = 2000; // Mínimo 2 segundos entre refreshes
    
    if (now - lastRefreshTime < minInterval) {
      console.log('Refresh bloqueado: muy pronto desde el último refresh');
      return;
    }
    
    if (isRefreshing) {
      console.log('Refresh ya en progreso, ignorando');
      return;
    }

    setIsRefreshing(true);
    setLastRefreshTime(now);
    
    try {
      console.log('Iniciando refresh de datos...');
      
      await fetchCuentaId();
      
      setReloadTrigger(Date.now());
      setRefreshKey(Date.now());
      
      console.log('Refresh completado exitosamente');
      Toast.show({
        type: "success",
        text1: "Datos actualizados",
        text2: "La información se ha refrescado correctamente",
      });
    } catch (error) {
      console.error('Error al refrescar:', error);
      Toast.show({
        type: "error",
        text1: "Error al recargar",
        text2: "No se pudieron actualizar los datos.",
      });
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1500);
    }
  }, [lastRefreshTime, isRefreshing]);

  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.updated) {
        handleRefresh();
        navigation.dispatch(CommonActions.setParams({ updated: undefined }));
      }
    }, [route.params?.updated])
  );

  useFocusEffect(
    useCallback(() => {
      // Solo refrescar si han pasado más de 30 segundos desde el último refresh
      const now = Date.now();
      if (now - lastRefreshTime > 30000) {
        console.log('Auto-refresh al enfocar la pantalla');
        handleRefresh();
      } else {
        console.log('Auto-refresh omitido: refresh reciente');
      }
    }, [lastRefreshTime, handleRefresh])
  );

  return (
    <View style={styles.wrapper}>
      <StatusBar style="dark" />
      <View style={styles.topHeaderContainer}>
        <DashboardHeader />
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >

        <BalanceCard reloadTrigger={reloadTrigger} onCurrencyChange={handleCurrencyChange} />

        {cuentaId && userId && (
          <ActionButtons cuentaId={cuentaId} userId={userId} onRefresh={handleRefresh} />
        )}

        {userId && (
          <RecurrentesList userId={userId} refreshKey={reloadTrigger} />
        )}

        {userId && (
          <SubaccountsList userId={userId} refreshKey={reloadTrigger} />
        )}

        <ExpensesChart />
        <TransactionHistory refreshKey={refreshKey} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#f0f0f3",
  },
  topHeaderContainer: {
    width: "100%",
    paddingHorizontal: 0,
    backgroundColor: "#f0f0f3",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
});