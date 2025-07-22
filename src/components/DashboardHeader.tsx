import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Platform, StatusBar, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import MainAccountScreen from "../screens/MainAccountScreen";
import { useNavigation } from "@react-navigation/native";

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
  const animatedHeight = useRef(new Animated.Value(92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  const navigation = useNavigation();

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
    <View style={styles.headerWrapper}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={toggleExpand}
        style={styles.expandableContainer}
      >
      </TouchableOpacity>
      <Animated.View style={[styles.notchBar, styles.neumorphicLight, { height: animatedHeight }]}>
        <View style={styles.headerTop}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../images/LitFinance.png")}
              style={styles.logo}
            />
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
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText} onPress={() => navigation.navigate('MainAccount' as never)}>Mi Cuenta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText}>Configuración</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowLogoutModal(true)}>
            <Text style={[styles.menuText, styles.logoutText]}>Cerrar sesión</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={toggleExpand}
        style={styles.expandTrigger}
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
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>¿Estás seguro de que deseas salir?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalButtonTextNormal}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleLogout}
              >
                <Text style={styles.confirmButton}>Salir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
    backgroundColor: "#f0f0f3",
  },
  headerWrapper: {
    marginTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 10,
    width: "100%",
    alignItems: "center",
    backgroundColor: "#f0f0f3",
  },
  expandableContainer: {
    width: "100%",
    alignItems: "center",
  },
  notchBar: {
    width: "100%",
    backgroundColor: "#f0f0f3",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 36,
    paddingBottom: 16,
  },
  neumorphicLight: {
    backgroundColor: "#f0f0f3",
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f0f0f3",
  },
  neumorphicButton: {
    backgroundColor: "#f0f0f3",
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f0f0f3",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f0f0f3",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#d1d9e6",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,

    ...Platform.select({
      ios: {
        shadowColor: "#d1d9e6",
        shadowOffset: { width: -2, height: -2 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
      android: {
        elevation: -2,
      },
    }),

    borderWidth: 1,
    borderColor: "#d1d9e620",
    borderBottomColor: "#d1d9e640",
    borderRightColor: "#d1d9e640",
  },
  logo: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
  expandTrigger: {
    width: "100%",
    alignItems: "center",
  },
  grabber: {
    width: 60,
    height: 6,
    backgroundColor: "#ccc",
    borderRadius: 2,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    flexShrink: 1,
  },
  optionsContainer: {
    gap: 8,
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 8,
  },
  menuItem: {
    width: "70%",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  logoutButton: {
    backgroundColor: "#f0f0f3",
    borderColor: "rgba(244, 67, 54, 0.2)",
  },
  menuText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
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
    width: "80%",
    backgroundColor: "#f0f0f3",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    padding: 10,
    marginHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f0f0f3",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  confirmButton: {
    backgroundColor: "#d32f2f",
    shadowRadius: 4,
    elevation: 6,
    color: "#fff",
  },
  modalButtonTextNormal: {
    color: "#000",
    fontWeight: "bold",
  },
});

export default DashboardWidget;
