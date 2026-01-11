import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useThemeColors } from "../theme/useThemeColors";
import { authService } from "../services/authService";
import Toast from 'react-native-toast-message';

const SplashScreen: React.FC = () => {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    let mounted = true;

    const tryRestore = async () => {
      // esperar al menos la animación
      await new Promise(res => setTimeout(res, 1000));
      try {
        const refreshToken = await authService.getRefreshToken();
        if (!refreshToken) {
          if (!mounted) return;
          navigation.reset({ index: 0, routes: [{ name: "Login" as never }] });
          return;
        }

        // Intentar refresh
        try {
          await authService.refreshTokens();
          if (!mounted) return;
          // Restauración exitosa
          navigation.reset({ index: 0, routes: [{ name: "Dashboard" as never }] });
          return;
        } catch (refreshErr) {
          console.warn('⚠️ [Splash] Refresh failed', refreshErr);
          if (!mounted) return;
          Toast.show({ type: 'error', text1: 'Sesión expirada', text2: 'Por favor inicia sesión nuevamente.' });
          navigation.reset({ index: 0, routes: [{ name: "Login" as never }] });
          return;
        }
      } catch (err) {
        console.error('Error restaurando sesión:', err);
        if (!mounted) return;
        navigation.reset({ index: 0, routes: [{ name: "Login" as never }] });
      }
    };

    tryRestore();

    return () => { mounted = false; };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.Image
        source={require("../images/LitFinance.png")}
        style={[
          styles.logo,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 150,
    height: 150,
  },
});

export default SplashScreen;
