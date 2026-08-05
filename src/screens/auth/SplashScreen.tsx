import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useThemeColors } from "../theme/useThemeColors";
import { authService } from "../services/authService";
import Toast from 'react-native-toast-message';
import { jwtDecode } from "../utils/jwtDecode";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { liteRouteService } from '../../services/lite/liteRoute.service';

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
          // Fallback: if we still have a valid access token, we can enter the app.
          // This prevents forcing login every launch when backend doesn't return refreshToken.
          try {
            const access = await authService.getAccessToken({ allowRefresh: false });
            const decoded = access ? jwtDecode(access as any) : null;
            const expMs = decoded?.exp ? Number(decoded.exp) * 1000 : 0;
            const stillValid = Number.isFinite(expMs) && expMs > Date.now() + 30_000;
            if (stillValid) {
              if (!mounted) return;
              const routeName = await liteRouteService.getPostAuthRoute();
              navigation.reset({ index: 0, routes: [{ name: routeName as never }] });
              return;
            }
          } catch {
            // ignore and fall back to login
          }

          if (!mounted) return;
          navigation.reset({ index: 0, routes: [{ name: "Login" as never }] });
          return;
        }

        // Intentar refresh
        try {
          await authService.refreshTokens();
          if (!mounted) return;
          // Restauración exitosa
          const routeName = await liteRouteService.getPostAuthRoute();
          navigation.reset({ index: 0, routes: [{ name: routeName as never }] });
          return;
        } catch (refreshErr) {
          console.warn('⚠️ [Splash] Refresh failed', refreshErr);
          if (!mounted) return;
          // A network/5xx failure must not destroy a valid persisted session.
          // authService clears the refresh token only when the backend confirms it is invalid.
          const [remainingRefreshToken, cachedUser] = await Promise.all([
            authService.getRefreshToken(),
            AsyncStorage.getItem('userData'),
          ]);
          if (remainingRefreshToken && cachedUser) {
            Toast.show({
              type: 'info',
              text1: 'Modo sin conexión',
              text2: 'Tu sesión sigue activa. Sincronizaremos cuando vuelva la conexión.',
            });
            const routeName = await liteRouteService.getPostAuthRoute();
            navigation.reset({ index: 0, routes: [{ name: routeName as never }] });
            return;
          }
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
        source={require("../../images/LitFinance.png")}
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
