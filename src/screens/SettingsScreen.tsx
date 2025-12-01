import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../theme/ThemeContext";
import { useThemeColors } from "../theme/useThemeColors";

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const colors = useThemeColors();

  const themeAnimations = React.useRef({
    light: new Animated.Value(themeMode === "light" ? 1 : 0.5),
    dark: new Animated.Value(themeMode === "dark" ? 1 : 0.5),
    auto: new Animated.Value(themeMode === "auto" ? 1 : 0.5),
  }).current;

  const handleThemeChange = (mode: "light" | "dark" | "auto") => {
    Object.keys(themeAnimations).forEach((key) => {
      Animated.spring(themeAnimations[key as keyof typeof themeAnimations], {
        toValue: key === mode ? 1 : 0.5,
        useNativeDriver: true,
        friction: 6,
        tension: 100,
      }).start();
    });

    setThemeMode(mode);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Configuración</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Sección de Apariencia */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Apariencia</Text>
          
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Tema de la aplicación</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Selecciona cómo quieres ver la aplicación
            </Text>

            <View style={styles.themeButtons}>
              <Animated.View
                style={[
                  styles.themeButtonWrapper,
                  {
                    opacity: themeAnimations.light,
                    transform: [
                      {
                        scale: themeAnimations.light.interpolate({
                          inputRange: [0.5, 1],
                          outputRange: [0.95, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor: themeMode === "light" ? colors.button : colors.cardSecondary,
                      borderColor: themeMode === "light" ? colors.button : colors.border,
                    },
                  ]}
                  onPress={() => handleThemeChange("light")}
                >
                  <Ionicons
                    name="sunny"
                    size={24}
                    color={themeMode === "light" ? "#fff" : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.themeButtonText,
                      { color: themeMode === "light" ? "#fff" : colors.textSecondary },
                    ]}
                  >
                    Claro
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={[
                  styles.themeButtonWrapper,
                  {
                    opacity: themeAnimations.dark,
                    transform: [
                      {
                        scale: themeAnimations.dark.interpolate({
                          inputRange: [0.5, 1],
                          outputRange: [0.95, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor: themeMode === "dark" ? colors.button : colors.cardSecondary,
                      borderColor: themeMode === "dark" ? colors.button : colors.border,
                    },
                  ]}
                  onPress={() => handleThemeChange("dark")}
                >
                  <Ionicons
                    name="moon"
                    size={24}
                    color={themeMode === "dark" ? "#fff" : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.themeButtonText,
                      { color: themeMode === "dark" ? "#fff" : colors.textSecondary },
                    ]}
                  >
                    Oscuro
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={[
                  styles.themeButtonWrapper,
                  {
                    opacity: themeAnimations.auto,
                    transform: [
                      {
                        scale: themeAnimations.auto.interpolate({
                          inputRange: [0.5, 1],
                          outputRange: [0.95, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor: themeMode === "auto" ? colors.button : colors.cardSecondary,
                      borderColor: themeMode === "auto" ? colors.button : colors.border,
                    },
                  ]}
                  onPress={() => handleThemeChange("auto")}
                >
                  <Ionicons
                    name="phone-portrait"
                    size={24}
                    color={themeMode === "auto" ? "#fff" : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.themeButtonText,
                      { color: themeMode === "auto" ? "#fff" : colors.textSecondary },
                    ]}
                  >
                    Auto
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </View>

        {/* Sección de Cuenta - Placeholder para futuras opciones */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Cuenta</Text>
          
          <TouchableOpacity 
            style={[styles.settingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.settingItemText, { color: colors.text }]}>Perfil</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.settingItemText, { color: colors.text }]}>Privacidad y seguridad</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Sección de Notificaciones - Placeholder */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notificaciones</Text>
          
          <TouchableOpacity 
            style={[styles.settingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.settingItemText, { color: colors.text }]}>Preferencias de notificación</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Sección Acerca de - Placeholder */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Acerca de</Text>
          
          <TouchableOpacity 
            style={[styles.settingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.settingItemText, { color: colors.text }]}>Versión de la app</Text>
            </View>
            <Text style={[styles.versionText, { color: colors.textTertiary }]}>1.0.0</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  themeButtons: {
    flexDirection: "row",
    gap: 12,
  },
  themeButtonWrapper: {
    flex: 1,
  },
  themeButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  themeButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
  versionText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
