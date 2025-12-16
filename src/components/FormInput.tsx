import React from 'react';
import { TextInput, StyleSheet, View, TextInputProps, TouchableOpacity, useColorScheme } from 'react-native';
import { useThemeColors } from '../theme/useThemeColors';

interface FormInputProps extends TextInputProps {
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

const FormInput: React.FC<FormInputProps> = ({
  rightIcon,
  onRightIconPress,
  style,
  ...props
}) => {
  const colors = useThemeColors();
  const theme = useColorScheme();
  const shadowColor = theme === 'dark' ? '#000000' : '#d1d9e6';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.inputBackground,
          shadowColor: shadowColor,
          shadowOffset: { width: -3, height: -3 },
        },
        style,
      ]}
    >
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholderTextColor={colors.placeholder}
        {...props}
      />
      {rightIcon && (
        <TouchableOpacity onPress={onRightIconPress} style={styles.icon}>
          {rightIcon}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    minHeight: 50,
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  icon: {
    marginLeft: 10,
  },
});

export default FormInput;
