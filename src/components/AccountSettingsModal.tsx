import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import { CurrencyField, Moneda } from "../components/CurrencyPicker";
import Modal from "react-native-modal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PREFERRED_CURRENCY_KEY = "preferredCurrency";
const SHOW_FULL_NUMBERS_KEY = "showFullNumbers";

const AccountSettingsModal: React.FC<Props> = ({ visible, onClose }) => {
  const [showFullNumbers, setShowFullNumbers] = useState(false);
  const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>({
    id: "init",
    codigo: "USD",
    nombre: "US Dollar",
    simbolo: "$",
  });

  useEffect(() => {
    if (visible) {
      loadNumberPreference();
      loadPreferredCurrency();
    }
  }, [visible]);

  const loadNumberPreference = useCallback(async () => {
    try {
      const preference = await AsyncStorage.getItem(SHOW_FULL_NUMBERS_KEY);
      setShowFullNumbers(preference === "true");
    } catch (error) {
      console.error("Error cargando preferencia de números:", error);
    }
  }, []);

  const loadPreferredCurrency = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PREFERRED_CURRENCY_KEY);
      if (raw) {
        const parsed: Moneda = JSON.parse(raw);
        if (parsed?.codigo) setSelectedMoneda(parsed);
      }
    } catch (error) {
      console.error("Error cargando moneda preferida:", error);
    }
  }, []);

  const toggleNumberFormat = async (value: boolean) => {
    try {
      setShowFullNumbers(value);
      await AsyncStorage.setItem(SHOW_FULL_NUMBERS_KEY, value.toString());
      Toast.show({
        type: "success",
        text1: "Formato actualizado",
        text2: value
          ? "Mostrando números completos"
          : "Mostrando números abreviados",
      });
    } catch (error) {
      console.error("Error guardando preferencia de números:", error);
      Toast.show({
        type: "error",
        text1: "Error al guardar preferencia",
      });
    }
  };

  const handleChangeCurrency = async (m: Moneda) => {
    try {
      setSelectedMoneda(m);
      await AsyncStorage.setItem(PREFERRED_CURRENCY_KEY, JSON.stringify(m));
      Toast.show({
        type: "success",
        text1: "Moneda actualizada",
        text2: `${m.nombre} (${m.codigo}) ${m.simbolo}`,
      });

      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        // Solo intenta persistir si hay token válido
        // await fetch(`${API_BASE_URL}/cuenta/principal/moneda`, {
        //   method: 'PATCH',
        //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        //   body: JSON.stringify({ moneda: m.codigo })
        // });
      }

    } catch (err) {
      console.error(err);
      Toast.show({
        type: "error",
        text1: "No se pudo guardar la moneda",
      });
    }
  };

  return (
    <Modal
      isVisible={visible}
      onSwipeComplete={onClose}
      swipeDirection="down"
      backdropOpacity={0}
      style={styles.modalWrapper}
      onBackdropPress={onClose}
      propagateSwipe
    >
      <View style={styles.modal}>
        <View style={styles.grabber} />

        <Text style={styles.title}>Ajustes de cuenta</Text>

        {/* Formato de números */}
        <View style={styles.switchOption}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.optionText}>Números completos</Text>
            <Text style={styles.optionSubtext}>
              {showFullNumbers
                ? "Muestra cantidades completas (ej: $1,234,567.89)"
                : "Abrevia cantidades grandes (ej: $1.2M)"}
            </Text>
          </View>
          <Switch
            value={showFullNumbers}
            onValueChange={toggleNumberFormat}
            trackColor={{ false: "#E0E0E0", true: "#EF6C00" }}
            thumbColor={showFullNumbers ? "#FF8F00" : "#F5F5F5"}
          />
        </View>

        {/* Selector reutilizable de Moneda */}
        <View style={{ marginTop: 12 }}>
          <CurrencyField
            label="Moneda de la cuenta"
            value={selectedMoneda}
            onChange={handleChangeCurrency}
            // Si quieres inyectar tu propio getter de token:
            // getAuthToken={async () => await AsyncStorage.getItem('authToken')}
            showSearch
          />
        </View>

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancelText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalWrapper: {
    justifyContent: "flex-end",
    margin: 0,
  },
  modal: {
    backgroundColor: "#f0f0f3",
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  grabber: {
    width: 40,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
    color: "#EF6C00",
  },
  option: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#444",
  },
  switchOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  optionSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    lineHeight: 16,
  },
  cancelText: {
    textAlign: "center",
    marginTop: 16,
    marginBottom: 26,
    color: "#888",
  },
});

export default AccountSettingsModal;