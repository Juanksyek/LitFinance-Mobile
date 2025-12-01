import { darkColors, lightColors } from "../constants/colors";
import { useTheme } from "./ThemeContext";

export const useThemeColors = () => {
  const { theme } = useTheme();
  return theme === "dark" ? darkColors : lightColors;
};
