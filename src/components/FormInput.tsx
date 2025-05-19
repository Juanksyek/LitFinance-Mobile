import React from 'react';
import { TextInput, StyleSheet, View, TextInputProps } from 'react-native';
import { useThemeColors } from '../theme/useThemeColors';

const FormInput: React.FC<TextInputProps> = (props) => {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.inputBackground }]}>
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholderTextColor={colors.placeholder}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    fontSize: 16,
  },
});

export default FormInput;