import React, { useEffect, useState } from "react";
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

export default function DashboardScreen() {
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const fetchCuentaId = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await axios.get(`${API_BASE_URL}/cuenta/principal`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCuentaId(res.data.id || res.data._id);
      setUserId(res.data.userId);
    } catch (err) {
      console.error("Error obteniendo cuenta principal:", err);
    }
  };

  useEffect(() => {
    fetchCuentaId();
  }, []);

  const handleRefresh = () => {
    setReloadTrigger(prev => prev + 1);
  };

  return (
    <View style={styles.wrapper}>
      <StatusBar style="dark" />
      <View style={styles.topHeaderContainer}>
        <DashboardHeader />
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <BalanceCard reloadTrigger={reloadTrigger} />
        {cuentaId && (
          <ActionButtons cuentaId={cuentaId} onRefresh={handleRefresh} />
        )}
        
        {userId && (
          <SubaccountsList userId={userId} />
        )}

        <ExpensesChart />
        <TransactionHistory />
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
