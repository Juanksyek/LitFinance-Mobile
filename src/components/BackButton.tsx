import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../theme/useThemeColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BackButtonProps = {
  inline?: boolean;
};

const BackButton = ({ inline }: BackButtonProps) => {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <TouchableOpacity
      style={[
        inline ? styles.inlineButton : styles.backButton,
        !inline
          ? {
              top: Math.max(12, insets.top + 10),
              backgroundColor: colors.card,
              borderColor: colors.border,
            }
          : {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
      ]}
      onPress={handleGoBack}
    >
      <Ionicons name="arrow-back-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  inlineButton: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 999,
    elevation: 20,
  },
});

export default BackButton;
// commit