import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../theme/ThemeContext";
import { useThemeColors } from "../theme/useThemeColors";
import * as Notifications from 'expo-notifications';
import { Switch } from 'react-native';
import { registerForPushNotifications, unregisterPushNotifications } from '../services/notificationService';
import {
  applyAppIconVariant,
  getStoredAppIconVariant,
  isDynamicAppIconSupported,
  setStoredAppIconVariant,
  type AppIconVariant,
} from '../services/appIconService';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { themeMode, setThemeMode, isDark } = useTheme();
  const colors = useThemeColors();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [dynamicIconSupported, setDynamicIconSupported] = useState<boolean>(false);
  const [appIconVariant, setAppIconVariant] = useState<AppIconVariant>('light');

  const themeAnimations = React.useRef({
    light: new Animated.Value(themeMode === "light" ? 1 : 0.5),
    dark: new Animated.Value(themeMode === "dark" ? 1 : 0.5),
    auto: new Animated.Value(themeMode === "auto" ? 1 : 0.5),
  }).current;

  useEffect(() => {
    checkNotificationStatus();
    checkUserRole();
    loadAppIconSettings();
  }, []);

  const loadAppIconSettings = async () => {
    try {
      const supported = await isDynamicAppIconSupported();
      setDynamicIconSupported(supported);
      const stored = await getStoredAppIconVariant();
      setAppIconVariant(stored);
    } catch {
      setDynamicIconSupported(false);
      setAppIconVariant('light');
    }
  };

  const handleAppIconChange = async (variant: AppIconVariant) => {
    try {
      if (!dynamicIconSupported) {
        Alert.alert(
          'No disponible',
          Platform.OS === 'android'
            ? 'No se pudo habilitar el cambio de icono en este build.'
            : 'Por el momento, el cambio de icono está disponible solo en Android.'
        );
        return;
      }

      setAppIconVariant(variant);
      await setStoredAppIconVariant(variant);
      await applyAppIconVariant(variant);

      Alert.alert('✅ Icono actualizado', 'El icono se actualizará en el launcher.');
    } catch (e) {
      console.error('Error cambiando icono:', e);
      Alert.alert('Error', 'No se pudo cambiar el icono.');
    }
  };

  const checkUserRole = async () => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        setIsAdmin(user.rol === 'admin');
      }
    } catch (error) {
      console.error('Error verificando rol de usuario:', error);
    }
  };

  const checkNotificationStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationsEnabled(status === 'granted');
    } catch (error) {
      console.error('Error verificando estado de notificaciones:', error);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    try {
      if (value) {
        // Activar: pedir permisos y registrar token
        const token = await registerForPushNotifications();
        if (token) {
          setNotificationsEnabled(true);
          Toast.show({ type: 'success', text1: 'Notificaciones activadas' });
        } else {
          setNotificationsEnabled(false);
          Toast.show({ type: 'info', text1: 'No se pudieron activar las notificaciones' });
        }
      } else {
        // Desactivar: eliminar token y desregistrar en backend
        await unregisterPushNotifications();
        setNotificationsEnabled(false);
        Toast.show({ type: 'success', text1: 'Notificaciones desactivadas' });
      }
    } catch (err) {
      console.error('Error cambiando estado de notificaciones:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo cambiar el estado de notificaciones' });
    }
  };

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

          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Icono de la app</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              Selecciona el icono que quieres ver en tu teléfono
            </Text>

            <View style={styles.themeButtons}>
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  {
                    backgroundColor:
                      appIconVariant === 'light' ? colors.button : colors.cardSecondary,
                    borderColor: appIconVariant === 'light' ? colors.button : colors.border,
                    opacity: dynamicIconSupported ? 1 : 0.5,
                  },
                ]}
                onPress={() => handleAppIconChange('light')}
                disabled={!dynamicIconSupported}
              >
                <Ionicons
                  name="sunny"
                  size={24}
                  color={appIconVariant === 'light' ? '#fff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.themeButtonText,
                    { color: appIconVariant === 'light' ? '#fff' : colors.textSecondary },
                  ]}
                >
                  Claro
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeButton,
                  {
                    backgroundColor:
                      appIconVariant === 'dark' ? colors.button : colors.cardSecondary,
                    borderColor: appIconVariant === 'dark' ? colors.button : colors.border,
                    opacity: dynamicIconSupported ? 1 : 0.5,
                  },
                ]}
                onPress={() => handleAppIconChange('dark')}
                disabled={!dynamicIconSupported}
              >
                <Ionicons
                  name="moon"
                  size={24}
                  color={appIconVariant === 'dark' ? '#fff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.themeButtonText,
                    { color: appIconVariant === 'dark' ? '#fff' : colors.textSecondary },
                  ]}
                >
                  Oscuro
                </Text>
              </TouchableOpacity>
            </View>

            {!dynamicIconSupported && (
              <Text style={[styles.notificationNote, { color: colors.textTertiary, marginTop: 12 }]}>
                Disponible en Android (build con prebuild/EAS). En iOS se agregará después.
              </Text>
            )}
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

        {/* Sección de Notificaciones */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notificaciones</Text>
          
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow, borderColor: colors.border }]}>
            {/* Panel de Admin - Solo visible para administradores */}
            {isAdmin && (
              <TouchableOpacity 
                style={[styles.adminButton, { backgroundColor: colors.button }]}
                onPress={() => (navigation as any).navigate('AdminNotifications')}
                activeOpacity={0.7}
              >
                <View style={styles.adminButtonContent}>
                  <View style={styles.adminButtonLeft}>
                    <Ionicons name="shield-checkmark" size={20} color="#fff" />
                    <Text style={styles.adminButtonText}>Admin Notificaciones</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </View>
                <Text style={styles.adminButtonSubtext}>
                  Enviar notificaciones personalizadas a usuarios
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.notificationToggle}>
              <View style={styles.settingItemLeft}>
                <Ionicons 
                  name={notificationsEnabled ? "notifications" : "notifications-off"} 
                  size={20} 
                  color={notificationsEnabled ? colors.success : colors.textSecondary} 
                />
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.settingItemText, { color: colors.text }]}>
                    Notificaciones
                  </Text>
                  <Text style={[styles.notificationNote, { color: colors.textTertiary, marginTop: 4 }]}>
                    Las notificaciones te informarán sobre recurrentes próximos, recordatorios y actualizaciones importantes.
                  </Text>
                </View>
              </View>

              <Switch
                value={!!notificationsEnabled}
                onValueChange={toggleNotifications}
                disabled={notificationsEnabled === null}
                trackColor={{ true: colors.success, false: colors.inputBackground }}
                thumbColor={notificationsEnabled ? colors.button : colors.card}
              />
            </View>

            <Text style={[styles.notificationNote, { color: colors.textTertiary }]}>
              Las notificaciones te informarán sobre recurrentes próximos, recordatorios y actualizaciones importantes.
            </Text>
          </View>
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
  notificationToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  notificationNote: {
    fontSize: 12,
    lineHeight: 16,
  },
  adminButton: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  adminButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  adminButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  adminButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  adminButtonSubtext: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 4,
  },
});
