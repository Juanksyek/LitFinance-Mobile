import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../constants/api";
import AccountSettingsModal from "./AccountSettingsModal";
import Toast from "react-native-toast-message";

interface Transaccion {
  tipo: 'ingreso' | 'egreso';
  monto: number;
}

interface BalanceCardProps {
  reloadTrigger: number;
}

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const BalanceCard: React.FC<BalanceCardProps> = ({ reloadTrigger }) => {
  const [saldo, setSaldo] = useState(0);
  const [ingresos, setIngresos] = useState(0);
  const [egresos, setEgresos] = useState(0);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [periodo, setPeriodo] = useState('mes');
  const [isFetching, setIsFetching] = useState(false);
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
    try {
      const token = await AsyncStorage.getItem("authToken");
      const resCuenta = await axios.get(`${API_BASE_URL}/cuenta/principal`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSaldo(resCuenta.data.cantidad || 0);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al obtener saldo',
      });
    }
  };

  const fetchTransacciones = async () => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await axios.get(`${API_BASE_URL}/transacciones?rango=${periodo}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const transacciones = res.data || [];
      const ingresoTotal: number = transacciones
        .filter((t: Transaccion): t is Transaccion => t.tipo === 'ingreso')
        .reduce((acc: number, t: Transaccion): number => acc + t.monto, 0);
      const egresoTotal: number = transacciones
        .filter((t: Transaccion): t is Transaccion => t.tipo === 'egreso')
        .reduce((acc: number, t: Transaccion): number => acc + t.monto, 0);

      setIngresos(ingresoTotal);
      setEgresos(egresoTotal);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error al obtener transacciones',
      });
    } finally {
      setIsFetching(false);
    }
  };

  const toggleFiltros = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMostrarFiltros(prev => !prev);
  };

  useEffect(() => {
    fetchDatosCuenta();
  }, [reloadTrigger]);

  useEffect(() => {
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

      <Text style={styles.amount}>${saldo.toLocaleString()}</Text>

      <View style={styles.row}>
        <View style={styles.infoItem}>
          <Ionicons name="arrow-up-outline" size={16} color="#4CAF50" />
          <Text style={[styles.infoText, { color: "#4CAF50" }]}>Ingreso: ${ingresos.toLocaleString()}</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="arrow-down-outline" size={16} color="#F44336" />
          <Text style={[styles.infoText, { color: "#F44336" }]}>Egreso: ${egresos.toLocaleString()}</Text>
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
    borderColor: 'rgba(255,255,255,0.7)',
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
    borderColor: 'rgba(255,255,255,0.7)',
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
    borderColor: "rgba(255,255,255,0.7)",
  },
});

export default BalanceCard;
