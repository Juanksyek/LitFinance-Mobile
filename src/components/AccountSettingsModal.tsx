import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import { CurrencyField, Moneda } from "../components/CurrencyPicker";
import Modal from "react-native-modal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import CurrencyPreviewModal from "./CurrencyPreviewModal";
import { useTheme } from "../theme/ThemeContext";
import { useThemeColors } from "../theme/useThemeColors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PREFERRED_CURRENCY_KEY = "preferredCurrency";
const SHOW_FULL_NUMBERS_KEY = "showFullNumbers";

const AccountSettingsModal: React.FC<Props> = ({ visible, onClose }) => {
  const navigation = useNavigation<any>();
  const { themeMode, setThemeMode } = useTheme();
  const colors = useThemeColors();
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

  const getThemeModeLabel = () => {
    switch (themeMode) {
      case 'light':
        return 'Claro';
      case 'dark':
        return 'Oscuro';
      case 'auto':
        return 'Automático';
    }
  };

  const getThemeIcon = () => {
    switch (themeMode) {
      case 'light':
        return 'sunny';
      case 'dark':
        return 'moon';
      case 'auto':
        return 'phone-portrait';
    }
  };

  return (
    <Modal
      isVisible={visible}
      onSwipeComplete={onClose}
      swipeDirection="down"
      backdropOpacity={0.3}
      style={styles.modalWrapper}
      onBackdropPress={onClose}
      propagateSwipe
    >
      <View style={[styles.modal, { backgroundColor: colors.modalBackground }]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />

        <Text style={[styles.title, { color: colors.button }]}>Ajustes de cuenta</Text>

        {/* Tema */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Apariencia</Text>
          
          <View style={styles.themeOptions}>
            <TouchableOpacity
              style={[
                styles.themeOption,
                { 
                  backgroundColor: themeMode === 'light' ? colors.button : colors.cardSecondary,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => setThemeMode('light')}
            >
              <Ionicons 
                name="sunny" 
                size={24} 
                color={themeMode === 'light' ? '#FFF' : colors.textSecondary} 
              />
              <Text style={[
                styles.themeOptionText,
                { color: themeMode === 'light' ? '#FFF' : colors.textSecondary }
              ]}>
                Claro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                { 
                  backgroundColor: themeMode === 'dark' ? colors.button : colors.cardSecondary,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => setThemeMode('dark')}
            >
              <Ionicons 
                name="moon" 
                size={24} 
                color={themeMode === 'dark' ? '#FFF' : colors.textSecondary} 
              />
              <Text style={[
                styles.themeOptionText,
                { color: themeMode === 'dark' ? '#FFF' : colors.textSecondary }
              ]}>
                Oscuro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                { 
                  backgroundColor: themeMode === 'auto' ? colors.button : colors.cardSecondary,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => setThemeMode('auto')}
            >
              <Ionicons 
                name="phone-portrait" 
                size={24} 
                color={themeMode === 'auto' ? '#FFF' : colors.textSecondary} 
              />
              <Text style={[
                styles.themeOptionText,
                { color: themeMode === 'auto' ? '#FFF' : colors.textSecondary }
              ]}>
                Auto
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.switchOption}>
          <View style={styles.switchTextContainer}>
            <Text style={[styles.optionText, { color: colors.text }]}>Números completos</Text>
            <Text style={[styles.optionSubtext, { color: colors.textSecondary }]}>
              {showFullNumbers
                ? "Muestra cantidades completas (ej: $1,234,567.89)"
                : "Abrevia cantidades grandes (ej: $1.2M)"}
            </Text>
          </View>
          <Switch
            value={showFullNumbers}
            onValueChange={toggleNumberFormat}
            trackColor={{ false: colors.border, true: "#EF6C00" }}
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
          <Text style={[styles.helperText, { color: colors.textTertiary }]}>
            Esta es tu moneda de visualización. La moneda principal de tu cuenta se establece en el registro y no puede cambiar.
          </Text>
        </View>

        {/* Botón de Preview de Moneda */}
        <TouchableOpacity
          style={[styles.previewOption, { borderTopColor: colors.border }]}
          onPress={() => setPreviewModalVisible(true)}
        >
          <View style={styles.previewIconContainer}>
            <Ionicons name="cash-outline" size={24} color="#4CAF50" />
          </View>
          <View style={styles.previewTextContainer}>
            <Text style={[styles.previewTitle, { color: colors.text }]}>Vista previa de moneda</Text>
            <Text style={[styles.previewSubtext, { color: colors.textSecondary }]}>
              Ve tus balances en cualquier moneda sin cambiar configuración
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.supportOption, { borderTopColor: colors.border }]}
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
            <Text style={[styles.supportTitle, { color: colors.text }]}>Soporte y ayuda</Text>
            <Text style={[styles.supportSubtext, { color: colors.textSecondary }]}>
              ¿Tienes algún problema? Contáctanos
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cerrar</Text>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    width: '100%',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  themeOption: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  option: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
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
    marginTop: 4,
    lineHeight: 16,
  },
  cancelText: {
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  supportOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 1,
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
    marginBottom: 2,
  },
  supportSubtext: {
    fontSize: 12,
  },
  helperText: {
    fontSize: 11,
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
    marginBottom: 2,
  },
  previewSubtext: {
    fontSize: 12,
  },
});

export default AccountSettingsModal;