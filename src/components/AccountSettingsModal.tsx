import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import { CurrencyField, Moneda } from "../components/CurrencyPicker";
import Modal from "react-native-modal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import CurrencyPreviewModal from "./CurrencyPreviewModal";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PREFERRED_CURRENCY_KEY = "preferredCurrency";
const SHOW_FULL_NUMBERS_KEY = "showFullNumbers";

const AccountSettingsModal: React.FC<Props> = ({ visible, onClose }) => {
  const navigation = useNavigation<any>();
  const [showFullNumbers, setShowFullNumbers] = useState(false);
  const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>({
    id: "init",
    codigo: "USD",
    nombre: "US Dollar",
    simbolo: "$",
  });
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

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
      // Solo guardamos la preferencia local, nunca enviamos al backend
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

        <View style={{ marginTop: 12 }}>
          <CurrencyField
            label="Moneda preferida (solo visualización)"
            value={selectedMoneda}
            onChange={handleChangeCurrency}
            showSearch
          />
          <Text style={styles.helperText}>
            Esta es tu moneda de visualización. La moneda principal de tu cuenta se establece en el registro y no puede cambiar.
          </Text>
        </View>

        {/* Botón de Preview de Moneda */}
        <TouchableOpacity
          style={styles.previewOption}
          onPress={() => setPreviewModalVisible(true)}
        >
          <View style={styles.previewIconContainer}>
            <Ionicons name="cash-outline" size={24} color="#4CAF50" />
          </View>
          <View style={styles.previewTextContainer}>
            <Text style={styles.previewTitle}>Vista previa de moneda</Text>
            <Text style={styles.previewSubtext}>
              Ve tus balances en cualquier moneda sin cambiar configuración
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.supportOption}
          onPress={() => {
            onClose();
            // @ts-ignore - Navigation type
            navigation.navigate("Support");
          }}
        >
          <View style={styles.supportIconContainer}>
            <Ionicons name="help-circle-outline" size={24} color="#EF6C00" />
          </View>
          <View style={styles.supportTextContainer}>
            <Text style={styles.supportTitle}>Soporte y ayuda</Text>
            <Text style={styles.supportSubtext}>
              ¿Tienes algún problema? Contáctanos
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancelText}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      {/* Currency Preview Modal */}
      <CurrencyPreviewModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalWrapper: {
    justifyContent: "flex-end",
    margin: 0,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modal: {
    backgroundColor: "#f0f0f3",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    width: '100%',
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
    marginBottom: 8,
    color: "#888",
  },
  supportOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    gap: 12,
  },
  supportIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EF6C0015",
    justifyContent: "center",
    alignItems: "center",
  },
  supportTextContainer: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#444",
    marginBottom: 2,
  },
  supportSubtext: {
    fontSize: 12,
    color: "#666",
  },
  helperText: {
    fontSize: 11,
    color: "#999",
    marginTop: 6,
    fontStyle: "italic",
    lineHeight: 14,
  },
  previewOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    gap: 12,
  },
  previewIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4CAF5015",
    justifyContent: "center",
    alignItems: "center",
  },
  previewTextContainer: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#444",
    marginBottom: 2,
  },
  previewSubtext: {
    fontSize: 12,
    color: "#666",
  },
});

export default AccountSettingsModal;