import { useColorScheme } from "react-native";
import { darkColors, lightColors } from "../constants/colors";

export const useThemeColors = () => {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
};
