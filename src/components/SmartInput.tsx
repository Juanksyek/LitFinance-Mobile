import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCurrencyInput, useNumericInput } from '../hooks/useNumericInput';

interface UseNumericInputOptions {
  initialValue?: number;
  context?: string;
  maxValue?: number;
  minValue?: number;
  allowNegative?: boolean;
  allowDecimals?: boolean;
  maxDecimals?: number;
}

type StyleProp<T> = T | (T & object) | undefined;

interface SmartInputProps extends Omit<UseNumericInputOptions, 'onValueChange' | 'onValidationChange'> {
  label?: React.ReactNode;             // <- permite nodo; lo renderizamos seguro
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  errorStyle?: StyleProp<TextStyle>;
  showErrorIcon?: boolean;
  showValidIcon?: boolean;
  prefix?: React.ReactNode;            // <- puede ser string o nodo; lo separamos de <Text>
  suffix?: React.ReactNode;            // idem
  type?: 'currency' | 'numeric' | 'percentage' | 'integer';
  onValueChange?: (value: number | null) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  disabled?: boolean;
  clearable?: boolean;
  autoFix?: boolean;
}

const SmartInput: React.FC<SmartInputProps> = ({
  label,
  placeholder,
  style,
  inputStyle,
  labelStyle,
  errorStyle,
  showErrorIcon = true,
  showValidIcon = true,
  prefix,
  suffix,
  type = 'numeric',
  onValueChange,
  onValidationChange,
  disabled = false,
  clearable = true,
  autoFix = true,
  ...numericOptions
}) => {
  // Selección del hook según tipo
  const getNumericHook = () => {
    switch (type) {
      case 'currency':
        return useCurrencyInput({ 
          ...numericOptions, 
          onValueChange, 
          onValidationChange 
        });
      case 'percentage':
        return useNumericInput({
          ...numericOptions,
          maxValue: 100,
          minValue: 0,
          allowDecimals: true,
          maxDecimals: 2,
          allowNegative: false,
          onValueChange,
          onValidationChange,
        });
      case 'integer':
        return useNumericInput({
          ...numericOptions,
          allowDecimals: false,
          onValueChange,
          onValidationChange,
        });
      default:
        return useNumericInput({ 
          ...numericOptions, 
          onValueChange, 
          onValidationChange 
        });
    }
  };

  const numericInput = getNumericHook();

  const getInputColor = () => {
    if (disabled) return '#9CA3AF';
    if (!numericInput.hasBeenTouched) return '#6B7280';
    return numericInput.isValid ? '#059669' : '#DC2626';
  };

  const getBorderColor = () => {
    if (disabled) return '#E5E7EB';
    if (numericInput.isFocused) return numericInput.isValid ? '#10B981' : '#EF4444';
    if (!numericInput.hasBeenTouched) return '#D1D5DB';
    return numericInput.isValid ? '#D1FAE5' : '#FEE2E2';
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    switch (type) {
      case 'currency': return '0.00';
      case 'percentage': return '0.00%';
      case 'integer': return '0';
      default: return '0.00';
    }
  };

  const handleClear = () => numericInput.clear();

  const handleAutoFix = () => {
    if (!autoFix || numericInput.numericValue == null) return;
    let fixed = numericInput.numericValue;

    if (type === 'percentage' && fixed > 100) fixed = 100;
    if (numericOptions.maxValue != null && fixed > numericOptions.maxValue) fixed = numericOptions.maxValue;
    if (numericOptions.minValue != null && fixed < numericOptions.minValue) fixed = numericOptions.minValue;

    if (fixed !== numericInput.numericValue) numericInput.setValue(fixed);
  };

  const renderPrefix = () => {
    const hasPrefix = prefix != null || type === 'currency';
    if (!hasPrefix) return null;

    // Si prefix es string/number, envolver en <Text>; si es nodo, render tal cual
    const resolved =
      typeof prefix === 'string' || typeof prefix === 'number'
        ? <Text style={[styles.prefixText, { color: getInputColor() }]}>{prefix}</Text>
        : prefix ?? <Text style={[styles.prefixText, { color: getInputColor() }]}>$</Text>;

    return <View style={styles.prefixContainer}>{resolved}</View>;
  };

  const renderSuffix = () => {
    const showClearButton = !!(clearable && numericInput.displayValue && !disabled);
    const showAutoFixButton = !!(autoFix && !numericInput.isValid && numericInput.numericValue != null && !disabled);

    const hasSuffix = suffix != null || type === 'percentage';

    let suffixNode: React.ReactNode = null;
    if (hasSuffix) {
      if (typeof suffix === 'string' || typeof suffix === 'number') {
        suffixNode = <Text style={[styles.suffixText, { color: getInputColor() }]}>{suffix}</Text>;
      } else if (suffix) {
        suffixNode = suffix; // nodo personalizado
      } else if (type === 'percentage') {
        suffixNode = <Text style={[styles.suffixText, { color: getInputColor() }]}>%</Text>;
      }
    }

    return (
      <View style={styles.suffixContainer}>
        {suffixNode}

        {showAutoFixButton && (
          <TouchableOpacity style={styles.actionButton} onPress={handleAutoFix}>
            <Ionicons name="build-outline" size={16} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {showClearButton && (
          <TouchableOpacity style={styles.actionButton} onPress={handleClear}>
            <Ionicons name="close-circle" size={16} color="#6B7280" />
          </TouchableOpacity>
        )}

        {showValidIcon && numericInput.hasBeenTouched && (
          <View style={styles.statusIcon}>
            <Ionicons
              name={numericInput.isValid ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={numericInput.isValid ? '#10B981' : '#EF4444'}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {label != null && (
        typeof label === 'string' || typeof label === 'number'
          ? <Text style={[styles.label, labelStyle, { color: getInputColor() }]}>{label}</Text>
          : <View style={{ marginBottom: 6 }}>{label}</View>
      )}

      <View
        style={[
          styles.inputContainer,
          { borderColor: getBorderColor() },
          disabled && styles.disabledContainer,
        ]}
      >
        {renderPrefix()}

        <TextInput
          {...numericInput.textInputProps}
          style={[styles.input, inputStyle, { color: getInputColor() }]}
          placeholder={getPlaceholder()}
          placeholderTextColor="#9CA3AF"
          editable={!disabled}
          selectTextOnFocus
        />

        {renderSuffix()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16, backgroundColor: '#f8f8f8', borderRadius: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#374151' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  disabledContainer: { backgroundColor: '#F9FAFB' },
  prefixContainer: { marginRight: 8 },
  prefixText: { fontSize: 16, fontWeight: '600' },
  input: { flex: 1, fontSize: 16, fontWeight: '500', paddingVertical: 12, textAlign: 'right' },
  suffixContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  suffixText: { fontSize: 16, fontWeight: '600', marginRight: 8 },
  actionButton: { padding: 4, marginLeft: 4 },
  statusIcon: { padding: 4, marginLeft: 4 },
  errorsContainer: { marginTop: 6 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 },
  errorText: { fontSize: 12, color: '#EF4444', marginLeft: 6, flex: 1, lineHeight: 16 },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  infoText: { fontSize: 12, color: '#6B7280', marginLeft: 6, flex: 1 },
});

export default SmartInput;