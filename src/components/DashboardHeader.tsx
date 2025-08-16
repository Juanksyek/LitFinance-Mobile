import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Platform, StatusBar, Modal, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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
      toValue: expanding ? 250 : 100,
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
    <SafeAreaView edges={[]} style={styles.safeArea}>
      {/* StatusBar translucido en Android para evitar empuje adicional */}
      <StatusBar
        translucent={Platform.OS === "android"}
        backgroundColor="transparent"
        barStyle={Platform.OS === "android" ? "dark-content" : "dark-content"}
      />

      <View style={styles.headerWrapper}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={toggleExpand}
          style={styles.expandableContainer}
        />

        <Animated.View
          style={[
            styles.notchBar,
            styles.neumorphicContainer,
            {
              height: animatedHeight,
              minHeight: 100,
              paddingTop: Math.max(topPad, 12),
            },
          ]}
        >
          <View style={styles.headerTop}>
            <View style={[styles.logoContainer]}>
              <Image source={require("../images/LitFinance.png")} style={styles.logo} />
            </View>
            <Text style={styles.welcomeText}>Bienvenido, {nombre}</Text>
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
            <TouchableOpacity
              style={[styles.menuItem, styles.neumorphicButton]}
              onPress={() => navigation.navigate("MainAccount" as never)}
            >
              <Text style={styles.menuText}>Mi Cuenta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.neumorphicButton]}>
              <Text style={styles.menuText}>Configuración</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.neumorphicButton, styles.logoutButton]}
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
          <View style={styles.grabber} />
        </TouchableOpacity>

        {/* Modal para confirmar cierre de sesión */}
        <Modal
          transparent={true}
          visible={showLogoutModal}
          animationType="fade"
          onRequestClose={() => setShowLogoutModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, styles.neumorphicContainer]}>
              <Text style={styles.modalTitle}>¿Estás seguro de que deseas salir?</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.neumorphicButton]}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={styles.modalButtonTextNormal}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.neumorphicButton, styles.confirmButton]}
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
  safeArea: {
    backgroundColor: "#f0f0f3",
  },
  container: {
    alignItems: "center",
    width: "100%",
    backgroundColor: "#f0f0f3",
  },
  headerWrapper: {
    alignItems: "center",
    backgroundColor: "#f0f0f3",
    width: 400,
  },
  expandableContainer: {
    width: "100%",
    alignItems: "center",
  },
  notchBar: {
    width: "100%",
    backgroundColor: "#f0f0f3",
    borderBottomLeftRadius: Math.min(28, screenWidth * 0.075),
    borderBottomRightRadius: Math.min(28, screenWidth * 0.075),
    paddingHorizontal: Math.max(screenWidth * 0.05, 16),
    paddingBottom: Math.max(screenWidth * 0.04, 12),
  },
  // Efecto neumorphism principal para contenedores
  neumorphicContainer: {
    backgroundColor: "#f0f0f3",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  neumorphicButton: {
    backgroundColor: "#f0f0f3",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  neumorphicElement: {
    backgroundColor: "#f0f0f3",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", // antes estaba "center"
    marginBottom: Math.max(screenWidth * 0.03, 8),
  },
  logoContainer: {
    width: Math.min(50, screenWidth * 0.13),
    height: Math.min(50, screenWidth * 0.13),
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Math.max(screenWidth * 0.03, 10),
  },
  welcomeText: {
    fontSize: Math.min(20, screenWidth * 0.05),
    fontWeight: "600",
    color: "#333",
    flexShrink: 1,
    textAlign: "left", // antes estaba "center"
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
    backgroundColor: "#ccc",
    borderRadius: 2,
  },
  optionsContainer: {
    gap: Math.max(screenWidth * 0.02, 6),
    marginTop: Math.max(screenWidth * 0.02, 6),
    alignItems: "center",
    paddingVertical: Math.max(screenWidth * 0.02, 6),
  },
  menuItem: {
    width: Math.min(screenWidth * 0.7, 200),
    alignItems: "center",
    paddingVertical: Math.max(screenWidth * 0.01, 8),
    paddingHorizontal: Math.max(screenWidth * 0.04, 12),
    borderRadius: 16,
  },
  logoutButton: {
    backgroundColor: "#f0f0f3",
    borderColor: "rgba(244, 67, 54, 0.1)",
  },
  menuText: {
    fontSize: Math.min(13, screenWidth * 0.035),
    fontWeight: "500",
    color: "#555",
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: Math.min(screenWidth * 0.8, 320),
    backgroundColor: "#f0f0f3",
    borderRadius: 16,
    padding: Math.max(screenWidth * 0.05, 16),
    alignItems: "center",
  },
  modalTitle: {
    fontSize: Math.min(18, screenWidth * 0.045),
    fontWeight: "bold",
    marginBottom: Math.max(screenWidth * 0.05, 16),
    textAlign: "center",
    color: "#333",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: Math.max(screenWidth * 0.02, 8),
  },
  modalButton: {
    flex: 1,
    padding: Math.max(screenWidth * 0.025, 10),
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#f0f0f3",
  },
  confirmButton: {
    backgroundColor: "#d32f2f",
    borderColor: "rgba(211, 47, 47, 0.1)",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: Math.min(14, screenWidth * 0.037),
  },
  modalButtonTextNormal: {
    color: "#000",
    fontWeight: "bold",
    fontSize: Math.min(14, screenWidth * 0.037),
  },
});

export default DashboardWidget;