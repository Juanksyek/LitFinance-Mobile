import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Platform, StatusBar, Modal, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import { useThemeColors } from "../theme/useThemeColors";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const getResponsiveSpacing = () => {
  const baseWidth = 375;
  const scale = screenWidth / baseWidth;
  return {
    small: Math.max(8 * scale, 8),
    medium: Math.max(16 * scale, 12),
    large: Math.max(24 * scale, 16),
  };
};

const DashboardWidget = () => {
  return (
    <View style={styles.container}>
      <Header />
    </View>
  );
};

const Header = () => {
  const [expanded, setExpanded] = useState(false);
  const [nombre, setNombre] = useState("Usuario");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const animatedHeight = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  const navigation = useNavigation();
  const spacing = getResponsiveSpacing();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const colors = useThemeColors();

  useEffect(() => {
    const fetchNombre = async () => {
      try {
        const userData = await AsyncStorage.getItem("userData");
        if (userData) {
          const parsed = JSON.parse(userData);
          if (parsed?.nombre) {
            setNombre(parsed.nombre);
          }
        }
      } catch {
        setNombre("Error al cargar nombre");
      }
    };
    fetchNombre();
  }, []);

  const topPad =
    insets.top > 0
      ? insets.top
      : Platform.OS === "android"
      ? Math.max((StatusBar.currentHeight ?? 0) * 0.8, 0)
      : 0;

  const toggleExpand = () => {
    const expanding = !expanded;
    setExpanded(expanding);

    Animated.timing(animatedHeight, {
      toValue: expanding ? 220 : 100,
      duration: 300,
      useNativeDriver: false,
    }).start();

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: expanding ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: expanding ? 0 : -10,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("authToken");
      await AsyncStorage.removeItem("userData");
      Toast.show({
        type: "success",
        text1: "Sesión cerrada",
        text2: "Has cerrado sesión correctamente.",
      });
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" as never }],
      });
    } catch {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "No se pudo cerrar la sesión.",
      });
    }
  };

  return (
      <SafeAreaView edges={[]} style={[styles.safeArea]}>
        <StatusBar
        translucent={Platform.OS === "android"}
        backgroundColor="transparent"
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      <View style={[styles.headerWrapper]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={toggleExpand}
          style={styles.expandableContainer}
        />

        <Animated.View
          style={[
            styles.notchBar,
            {
              height: animatedHeight,
              minHeight: 100,
              paddingTop: Math.max(topPad, 12),
              backgroundColor: colors.backgroundTertiary,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.headerTop}>
            <View style={styles.logoContainer}> 
              <Image source={require("../images/LitFinance.png")} style={styles.logo} />
            </View>
            <Text style={[styles.welcomeText, { color: colors.text }]}>Bienvenido, {nombre}</Text>
          </View>

          <Animated.View
            style={[
              styles.optionsContainer,
              {
                opacity: opacityAnim,
                transform: [{ translateY }],
              },
            ]}
            pointerEvents={expanded ? "auto" : "none"}
          >
            {/* Opciones de Cuenta */}
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => navigation.navigate("MainAccount" as never)}
            >
              <Text style={[styles.menuText, { color: colors.textSecondary }]}>Mi Cuenta</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => navigation.navigate("Settings" as never)}
            >
              <Text style={[styles.menuText, { color: colors.textSecondary }]}>Configuración</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.logoutButton, { backgroundColor: colors.card, borderColor: "rgba(244, 67, 54, 0.2)" }]}
              onPress={() => setShowLogoutModal(true)}
            >
              <Text style={[styles.menuText, styles.logoutText]}>Cerrar sesión</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={toggleExpand}
          style={[styles.expandTrigger]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        </TouchableOpacity>

        {/* Modal para confirmar cierre de sesión */}
        <Modal
          transparent={true}
          visible={showLogoutModal}
          animationType="fade"
          onRequestClose={() => setShowLogoutModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.modalBackground, shadowColor: colors.shadow }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>¿Estás seguro de que deseas salir?</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={[styles.modalButtonTextNormal, { color: colors.text }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleLogout}
                >
                  <Text style={styles.confirmButtonText}>Salir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {},
  container: {
    alignItems: "center",
    width: "100%",
  },
  headerWrapper: {
    alignItems: "center",
    width: 400,
  },
  expandableContainer: {
    width: "100%",
    alignItems: "center",
  },
  notchBar: {
    width: "100%",
    borderBottomLeftRadius: Math.min(28, screenWidth * 0.075),
    borderBottomRightRadius: Math.min(28, screenWidth * 0.075),
    paddingHorizontal: Math.max(screenWidth * 0.05, 16),
    paddingBottom: Math.max(screenWidth * 0.04, 12),
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Math.max(screenWidth * 0.03, 8),
  },
  logoContainer: {
    width: Math.min(50, screenWidth * 0.13),
    height: Math.min(50, screenWidth * 0.13),
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Math.max(screenWidth * 0.03, 10),
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeText: {
    fontSize: Math.min(20, screenWidth * 0.05),
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "left",
  },
  logo: {
    width: Math.min(32, screenWidth * 0.085),
    height: Math.min(32, screenWidth * 0.085),
    resizeMode: "contain",
  },
  expandTrigger: {
    width: "100%",
    alignItems: "center",
    paddingVertical: Math.max(screenWidth * 0.02, 6),
    borderRadius: 16,
  },
  grabber: {
    width: Math.min(60, screenWidth * 0.16),
    height: Math.max(6, screenWidth * 0.015),
    borderRadius: 2,
  },
  optionsContainer: {
    gap: 10,
    alignItems: "center",
    paddingVertical: 4,
    width: "100%",
  },
  menuItem: {
    width: "50%",
    maxWidth: 280,
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutButton: {
    borderWidth: 1.5,
  },
  menuText: {
    fontSize: Math.min(13, screenWidth * 0.035),
    fontWeight: "500",
    textAlign: "center",
  },
  logoutText: {
    color: "#F44336",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContainer: {
    width: Math.min(screenWidth * 0.8, 320),
    borderRadius: 20,
    padding: Math.max(screenWidth * 0.05, 20),
    alignItems: "center",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: Math.min(18, screenWidth * 0.045),
    fontWeight: "bold",
    marginBottom: Math.max(screenWidth * 0.05, 16),
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: Math.max(screenWidth * 0.02, 12),
  },
  modalButton: {
    flex: 1,
    padding: Math.max(screenWidth * 0.03, 12),
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmButton: {
    backgroundColor: "#d32f2f",
    borderColor: "#d32f2f",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: Math.min(14, screenWidth * 0.037),
  },
  modalButtonTextNormal: {
    fontWeight: "bold",
    fontSize: Math.min(14, screenWidth * 0.037),
  },
});

export default DashboardWidget;
