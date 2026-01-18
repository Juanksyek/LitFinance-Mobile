import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../theme/useThemeColors';

const BackButton = () => {
  const colors = useThemeColors();
  const navigation = useNavigation();
  console.log('🔁 [BackButton] render');

  const handleGoBack = () => {
    console.log('🔙 [BackButton] goBack pressed at', new Date().toISOString());
    navigation.goBack();
  };

  return (
    <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.card }]} onPress={handleGoBack}>
      <Ionicons name="arrow-back-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 8,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});

export default BackButton;
// commit