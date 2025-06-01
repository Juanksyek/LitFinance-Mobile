import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Image, Dimensions, TouchableOpacity, Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

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
      } catch (error) {
        setNombre("Error al cargar nombre");
      }
    };

    fetchNombre();
  }, []);

  const toggleExpand = () => {
    const expanding = !expanded;
    setExpanded(expanding);

    Animated.timing(animatedHeight, {
      toValue: expanding ? 220 : 92,
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
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "No se pudo cerrar la sesión.",
      });
    }
  };

  return (
    <View style={styles.headerWrapper}>
      <Animated.View style={[styles.notchBar, { height: animatedHeight }]}>
        <View style={styles.headerTop}>
          <Image
            source={require("../images/LitFinance.png")}
            style={styles.logo}
          />
          <Text style={styles.welcomeText}>Bienvenido, {nombre}</Text>
        </View>

        <Animated.View
          style={[
            styles.optionsContainer,
            {
              opacity: opacityAnim,
              transform: [{ translateY }],
              position: "absolute",
              top: 80,
              left: 0,
              right: 0,
              alignItems: "center",
            },
          ]}
          pointerEvents={expanded ? "auto" : "none"}
        >
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText}>Mi Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText}>Configuración</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Text style={styles.menuText}>Cerrar sesión</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  headerWrapper: {
    width: width,
    alignItems: "center",
  },
  notchBar: {
    width: width,
    backgroundColor: "#f0f0f3",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 20,
    paddingTop: 24,
    overflow: "hidden",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logo: {
    width: 44,
    height: 44,
    resizeMode: "contain",
    marginRight: 8,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#424242",
  },
  optionsContainer: {
    gap: 12,
    marginTop: 6,
  },
  menuItem: {
    alignItems: "center",
    paddingVertical: 4,
  },
  menuText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#424242",
  },
  grabber: {
    width: 30,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#bbb",
    opacity: 0.6,
    marginTop: 6,
  },
  expandTrigger: {
    alignItems: "center",
    paddingVertical: 6,
    paddingBottom: 8,
    marginTop: -10,
  },
});

export default DashboardWidget;
