import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch, Dimensions, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import Modal from "react-native-modal";
import Ionicons from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { API_BASE_URL } from "../constants/api";
import SmartInput from './SmartInput';
import SmartNumber from './SmartNumber';

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface Props {
  visible: boolean;
  onClose: () => void;
  cuentaPrincipalId: string;
  onSuccess: () => void;
}

const presetColors = [
  "#4CAF50", "#EF6C00", "#1976D2",
  "#9C27B0", "#FFEB3B", "#E91E63",
  "#795548", "#00BCD4", "#F44336",
  "#3F51B5", "#607D8B", "#8BC34A",
];

const SubaccountModal: React.FC<Props> = ({
  visible,
  onClose,
  cuentaPrincipalId,
  onSuccess,
}) => {
  const [nombre, setNombre] = useState("");
  const [moneda, setMoneda] = useState("MXN");
  const [simbolo, setSimbolo] = useState("$");
  const [color, setColor] = useState("#4CAF50");
  const [afectaCuenta, setAfectaCuenta] = useState(true);
  const [monedas, setMonedas] = useState<any[]>([]);
  const [monedaModalVisible, setMonedaModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cantidadNumerica, setCantidadNumerica] = useState<number | null>(0);
  const [cantidadValida, setCantidadValida] = useState(true);
  const [erroresCantidad, setErroresCantidad] = useState<string[]>([]);

  const getLimitesSubcuenta = () => ({
    min: 0,
    max: 999999999999,
    warning: 100000000,
  });

  const handleCantidadChange = (value: number | null) => {
    setCantidadNumerica(value);
  };

  const handleCantidadValidation = (isValid: boolean, errors: string[]) => {
    setCantidadValida(isValid);
    setErroresCantidad(errors);
  };

  const fetchMonedas = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(`${API_BASE_URL}/monedas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMonedas(data);
        const actual = data.find(
          (m) => m.codigo === moneda || m.clave === moneda
        );
        if (actual) setSimbolo(actual.simbolo || "$");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    if (!nombre.trim()) {
      Toast.show({
        type: "error",
        text1: "Nombre requerido",
        text2: "Ingresa un nombre para la subcuenta.",
      });
      return;
    }

    // ✅ NUEVO: Validar cantidad numérica
    if (!cantidadValida || cantidadNumerica === null) {
      Toast.show({
        type: "error",
        text1: "Cantidad inválida",
        text2: "Verifica la cantidad inicial.",
      });
      return;
    }

    // ✅ NUEVO: Advertencia para cantidades muy grandes
    if (erroresCantidad.some(error => error.includes('muy grande'))) {
      Toast.show({
        type: "info",
        text1: "Cantidad inusualmente grande",
        text2: "Verifica que sea correcta antes de continuar.",
      });
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");

      const payload = {
        nombre: nombre.trim(),
        cantidad: cantidadNumerica, // ✅ NUEVO: Usar valor numérico validado
        moneda,
        simbolo,
        color,
        afectaCuenta,
        cuentaPrincipalId,
      };

      const res = await fetch(`${API_BASE_URL}/subcuenta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          responseData?.message || "Error desconocido al crear subcuenta";
        throw new Error(msg);
      }

      Toast.show({ type: "success", text1: "Subcuenta creada" });
      // ✅ NUEVO: Limpiar todos los estados incluyendo los numéricos
      setNombre("");
      setCantidadNumerica(0);
      setCantidadValida(true);
      setErroresCantidad([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("❌ Error en handleCreate:", err);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err.message || "Algo salió mal.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) fetchMonedas();
  }, [visible]);

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modalContainer}
      backdropOpacity={0.2}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modal}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Ionicons name="wallet-outline" size={22} color="#EF7725" />
          <Text style={styles.title}>Nueva Subcuenta</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color="#999" />
          </TouchableOpacity>
        </View>

        <TextInput
          placeholder="Nombre de la subcuenta"
          value={nombre}
          onChangeText={setNombre}
          style={styles.input}
        />

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.monedaBox}
            onPress={() => setMonedaModalVisible(true)}
          >
            <Text style={styles.monedaText}>{moneda}</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>

          <View style={styles.symbolBox}>
            <Text style={styles.switchLabel}>Símbolo:</Text>
            <Text style={styles.symbolValue}>{simbolo}</Text>
          </View>
        </View>

        {/* ✅ NUEVO: SmartInput en lugar de TextInput básico */}
        <View style={styles.smartInputContainer}>
          <SmartInput
            type="currency"
            placeholder="Cantidad inicial"
            prefix={simbolo}
            initialValue={cantidadNumerica || undefined}
            {...getLimitesSubcuenta()}
            onValueChange={handleCantidadChange}
            onValidationChange={handleCantidadValidation}
            style={styles.input}
            autoFix={true}
          />
        </View>

        {/* ✅ NUEVO: Mostrar advertencia si hay errores */}
        {erroresCantidad.length > 0 && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning-outline" size={20} color="#F59E0B" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Cantidad muy grande</Text>
              <Text style={styles.warningText}>
                Cantidad: <SmartNumber value={cantidadNumerica || 0} options={{ context: 'modal', symbol: simbolo }} />
              </Text>
              <Text style={styles.warningSubtext}>
                {erroresCantidad[0]}
              </Text>
            </View>
          </View>
        )}

        <View style={{ marginBottom: 16 }}>
          <Text style={styles.switchLabel}>Color</Text>
          <View style={styles.colorGrid}>
            {presetColors.map((c) => {
              const selected = c === color;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    selected && styles.colorSelected,
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>¿Afecta cuenta principal?</Text>
          <Switch value={afectaCuenta} onValueChange={setAfectaCuenta} />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#EF7725" }]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Guardando..." : "Crear Subcuenta"}
          </Text>
        </TouchableOpacity>

        <Modal
          isVisible={monedaModalVisible}
          onBackdropPress={() => setMonedaModalVisible(false)}
          style={{ justifyContent: "flex-end", margin: 0 }}
          backdropOpacity={0.5}
        >
          <View style={styles.monedaModal}>
            <Text style={styles.monedaModalTitle}>Selecciona una moneda</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {monedas.map((m) => (
                <TouchableOpacity
                  key={m.codigo}
                  onPress={() => {
                    setMoneda(m.codigo || m.clave);
                    setSimbolo(m.simbolo || "$");
                    setMonedaModalVisible(false);
                  }}
                  style={styles.monedaOption}
                >
                  <Text style={{ fontSize: 16 }}>
                    {m.nombre} ({m.codigo}) {m.simbolo}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { justifyContent: "flex-end", margin: 0 },
  modal: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: SCREEN_HEIGHT * 0.95,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 5,
    alignSelf: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  input: {
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center" },
  monedaBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 10,
  },
  monedaText: { fontSize: 14, color: "#333", marginRight: 4 },
  monedaModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "60%",
  },
  monedaModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  monedaOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
  switchLabel: { fontSize: 14, color: "#444" },
  button: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  colorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  colorSelected: {
    borderWidth: 2,
    borderColor: "#000",
  },
  symbolBox: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
  },
  symbolValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 4,
  },
  // ✅ NUEVO: Estilos para SmartInput y advertencias
  smartInputContainer: {
    marginBottom: 0, // SmartInput ya tiene su propio margin
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningContent: {
    flex: 1,
    marginLeft: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 2,
  },
  warningSubtext: {
    fontSize: 11,
    color: '#A16207',
    fontStyle: 'italic',
  },
});

export default SubaccountModal;
