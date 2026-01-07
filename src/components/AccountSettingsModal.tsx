import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
// import { CurrencyField, Moneda } from "../components/CurrencyPicker";
import Modal from "react-native-modal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
// import CurrencyPreviewModal from "./CurrencyPreviewModal";
import { useTheme } from "../theme/ThemeContext";
import { useThemeColors } from "../theme/useThemeColors";
import PremiumModal from "./PremiumModal";
import TipJarModal from "./TipJarModal";
import PremiumStatusCard from "./PremiumStatusCard";
import { useCuentaPrincipal } from "../hooks/useCuentaPrincipal";
import PlanConfigAdminModal from "./PlanConfigAdminModal";
import { ScrollView } from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SHOW_FULL_NUMBERS_KEY = "showFullNumbers";

const AccountSettingsModal: React.FC<Props> = ({ visible, onClose }) => {
  const navigation = useNavigation<any>();
  const { themeMode, setThemeMode } = useTheme();
  const colors = useThemeColors();
  const [showFullNumbers, setShowFullNumbers] = useState(false);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);
  const [tipJarModalVisible, setTipJarModalVisible] = useState(false);
  const [planConfigModalVisible, setPlanConfigModalVisible] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  
  const { cuenta, isPremium } = useCuentaPrincipal(token, reloadKey);
  // const [selectedMoneda, setSelectedMoneda] = useState<Moneda | null>(null);
  // const [previewModalVisible, setPreviewModalVisible] = useState(false);

  // Cargar preferencias y asegurar que siempre haya una moneda seleccionada
  useEffect(() => {
    if (visible) {
      loadNumberPreference();
      loadToken();
      loadUserData();
    }
  }, [visible]);

  const loadToken = async () => {
    try {
      const authToken = await AsyncStorage.getItem("authToken");
      setToken(authToken);
    } catch (error) {
      console.error("Error cargando token:", error);
    }
  };

  const loadUserData = async () => {
    try {
      const raw = await AsyncStorage.getItem("userData");
      if (!raw) {
        setUserEmail(null);
        setIsAdmin(false);
        return;
      }

      const user = JSON.parse(raw);
      const email = typeof user?.email === "string" ? user.email : null;
      const rol = typeof user?.rol === "string" ? user.rol : typeof user?.role === "string" ? user.role : null;

      setUserEmail(email);
      setIsAdmin(String(rol || "").toLowerCase() === "admin");
    } catch (error) {
      setUserEmail(null);
      setIsAdmin(false);
    }
  };

  const loadNumberPreference = useCallback(async () => {
    try {
      const preference = await AsyncStorage.getItem(SHOW_FULL_NUMBERS_KEY);
      setShowFullNumbers(preference === "true");
    } catch (error) {
      console.error("Error cargando preferencia de números:", error);
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
      backdropOpacity={0.35}
      style={styles.modalWrapper}
      onBackdropPress={onClose}
      propagateSwipe
    >
      <View style={[styles.modal, { backgroundColor: colors.modalBackground }]}> 
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.button }]}>Ajustes de cuenta</Text>

        {/* Distintivo visual si premium es por donación */}
        {cuenta?.premiumUntil && (!cuenta?.premiumSubscriptionStatus || cuenta?.premiumSubscriptionStatus === 'none') && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 10 }}>
            <Ionicons name="gift" size={18} color="#f59e0b" style={{ marginRight: 6 }} />
            <Text style={{ color: '#b45309', fontWeight: 'bold' }}>Premium temporal por donación</Text>
          </View>
        )}

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

        {/* Premium Status Card */}
        {cuenta && (
          <PremiumStatusCard
            premiumSubscriptionStatus={cuenta.premiumSubscriptionStatus}
            premiumUntil={cuenta.premiumUntil}
            stripeSubscriptionId={cuenta.stripeSubscriptionId}
          />
        )}

        {/* Premium y Tip Jar */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Premium</Text>
          
          {/* CTA Premium: si ya es premium, muestra beneficios; si no, muestra compra */}
          <TouchableOpacity
            style={[styles.premiumOption, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
            onPress={() => setPremiumModalVisible(true)}
          >
            <View style={styles.premiumIconContainer}>
              <Ionicons name="sparkles" size={24} color="#f59e0b" />
            </View>
            <View style={styles.premiumTextContainer}>
              <Text style={[styles.premiumTitle, { color: colors.text }]}>
                {isPremium ? 'Tus beneficios premium' : 'Hazte Premium'}
              </Text>
              <Text style={[styles.premiumSubtext, { color: colors.textSecondary }]}>
                {isPremium ? 'Revisa tu estado y días restantes' : 'Desbloquea funciones avanzadas'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Admin-only: plan config */}
          {isAdmin && token && (
            <TouchableOpacity
              style={[styles.premiumOption, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
              onPress={() => setPlanConfigModalVisible(true)}
            >
              <View style={styles.premiumIconContainer}>
                <Ionicons name="options" size={24} color={colors.button} />
              </View>
              <View style={styles.premiumTextContainer}>
                <Text style={[styles.premiumTitle, { color: colors.text }]}>Límites del plan (admin)</Text>
                <Text style={[styles.premiumSubtext, { color: colors.textSecondary }]}>Configura límites del plan gratuito</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          {/* Siempre mostrar opción de donación */}
          <TouchableOpacity
            style={[styles.tipJarOption, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
            onPress={() => setTipJarModalVisible(true)}
          >
            <View style={styles.tipJarIconContainer}>
              <Ionicons name="heart" size={24} color="#ef4444" />
            </View>
            <View style={styles.tipJarTextContainer}>
              <Text style={[styles.tipJarTitle, { color: colors.text }]}>Apoya el desarrollo</Text>
              <Text style={[styles.tipJarSubtext, { color: colors.textSecondary }]}>
                Una donación ayuda mucho ❤️
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
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
        </ScrollView>
      </View>

      {/* Modales de Premium y Tip Jar */}
      {token && (
        <>
          <PremiumModal
            visible={premiumModalVisible}
            onClose={() => setPremiumModalVisible(false)}
            token={token}
            onRefresh={() => setReloadKey(prev => prev + 1)}
          />
          {isAdmin && (
            <PlanConfigAdminModal
              visible={planConfigModalVisible}
              onClose={() => setPlanConfigModalVisible(false)}
              token={token}
            />
          )}
          <TipJarModal
            visible={tipJarModalVisible}
            onClose={() => setTipJarModalVisible(false)}
            token={token}
            onRefresh={() => setReloadKey(prev => prev + 1)}
          />
        </>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalWrapper: {
    justifyContent: "flex-end",
    margin: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  modal: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    width: '100%',
    maxHeight: '85%',
    marginHorizontal: 6,
    // elevation / shadow for Android / iOS
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    padding: 6,
    borderRadius: 20,
    zIndex: 20,
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
  premiumOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  premiumIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f59e0b15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  premiumTextContainer: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  premiumSubtext: {
    fontSize: 12,
  },
  tipJarOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  tipJarIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ef444415",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  tipJarTextContainer: {
    flex: 1,
  },
  tipJarTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  tipJarSubtext: {
    fontSize: 12,
  },
});

export default AccountSettingsModal;