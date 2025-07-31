// commnt
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

  const fetchCuentaId = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await axios.get(`${API_BASE_URL}/cuenta/principal`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCuentaId(res.data.id || res.data._id);
      setUserId(res.data.userId);

      // Activar refresh también después de obtener los datos por primera vez
      handleRefresh();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Error al recuperar la cuenta principal",
        text2: "Inicia sesión de nuevo o inténtalo más tarde",
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

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    
    try {
      setReloadTrigger(prev => prev + 1);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error al recargar",
        text2: "No se pudieron recargar los componentes.",
      });
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    }
  }, []);

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
      // Refresca al volver a enfocar el dashboard (útil tras editar un recurrente)
      handleRefresh();
    }, [])
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

        <BalanceCard reloadTrigger={reloadTrigger} />

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