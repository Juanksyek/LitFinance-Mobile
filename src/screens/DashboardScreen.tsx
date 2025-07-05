import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import DashboardHeader from "../components/DashboardHeader";
import BalanceCard from "../components/BalanceCard";
import ActionButtons from "../components/ActionButtons";
import ExpensesChart from "../components/ExpensesChart";
import TransactionHistory from "../components/TransactionHistory";
import SubaccountsList from "../components/SubaccountList";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import { useFocusEffect, useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { CommonActions } from '@react-navigation/native';
import Toast from "react-native-toast-message";
import RecurrentesList from "../components/RecurrenteList";

export default function DashboardScreen() {
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(Date.now());
  const route = useRoute<RouteProp<RootStackParamList, 'Dashboard'>>();
  const [recurrentesFiltrados, setRecurrentesFiltrados] = useState([]);
  const navigation = useNavigation();
  const [refreshKey, setRefreshKey] = useState(Date.now());

  const fetchCuentaId = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await axios.get(`${API_BASE_URL}/cuenta/principal`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCuentaId(res.data.id || res.data._id);
      setUserId(res.data.userId);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al recuperar la cuenta principal',
        text2: 'Inicia sesión de nuevo o intentalo mas tarde',
      });
    }
  };

  useEffect(() => {
    fetchCuentaId();
  }, []);

  const handleRefresh = () => {
    setReloadTrigger(Date.now());
  };

  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.updated) {
        setReloadTrigger(Date.now());
        navigation.dispatch(CommonActions.setParams({ updated: undefined }));
      }
    }, [route.params?.updated])
  );

  return (
    <View style={styles.wrapper}>
      <StatusBar style="dark" />
      <View style={styles.topHeaderContainer}>
        <DashboardHeader />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} >
        <BalanceCard reloadTrigger={reloadTrigger} />
        {cuentaId && userId && (
          <ActionButtons cuentaId={cuentaId} userId={userId} onRefresh={handleRefresh} />
        )}

        {userId && <RecurrentesList userId={userId} refreshKey={reloadTrigger} />}

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
