import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, useColorScheme } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { darkColors, lightColors } from "../constants/colors";
const SplashScreen: React.FC = () => {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? darkColors : lightColors;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" as never }],
      });
    }, 2500);

    return () => clearTimeout(timeout);
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
