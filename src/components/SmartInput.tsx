import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
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

interface SmartInputProps extends Omit<UseNumericInputOptions, 'onValueChange' | 'onValidationChange'> {
  label?: string;
  placeholder?: string;
  style?: any;
  inputStyle?: any;
  labelStyle?: any;
  errorStyle?: any;
  showErrorIcon?: boolean;
  showValidIcon?: boolean;
  prefix?: string;
  suffix?: string;
  type?: 'currency' | 'numeric' | 'percentage' | 'integer';
  onValueChange?: (value: number | null) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  disabled?: boolean;
  clearable?: boolean;
  autoFix?: boolean; // Auto-corregir valores cuando sea posible
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
  // Seleccionar el hook correcto según el tipo
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
          onValidationChange
        });
      case 'integer':
        return useNumericInput({
          ...numericOptions,
          allowDecimals: false,
          onValueChange,
          onValidationChange
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
    if (numericInput.isValid) return '#059669';
    return '#DC2626';
  };

  const getBorderColor = () => {
    if (disabled) return '#E5E7EB';
    if (numericInput.isFocused) {
      return numericInput.isValid ? '#10B981' : '#EF4444';
    }
    if (!numericInput.hasBeenTouched) return '#D1D5DB';
    return numericInput.isValid ? '#D1FAE5' : '#FEE2E2';
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    
    switch (type) {
      case 'currency':
        return '0.00';
      case 'percentage':
        return '0.00%';
      case 'integer':
        return '0';
      default:
        return '0.00';
    }
  };

  const handleClear = () => {
    numericInput.clear();
  };

  const handleAutoFix = () => {
    if (!autoFix || !numericInput.numericValue) return;

    // Auto-correcciones comunes
    let fixedValue = numericInput.numericValue;
    
    if (type === 'percentage' && fixedValue > 100) {
      fixedValue = 100;
      numericInput.setValue(fixedValue);
    }
    
    if (numericOptions.maxValue && fixedValue > numericOptions.maxValue) {
      fixedValue = numericOptions.maxValue;
      numericInput.setValue(fixedValue);
    }
    
    if (numericOptions.minValue && fixedValue < numericOptions.minValue) {
      fixedValue = numericOptions.minValue;
      numericInput.setValue(fixedValue);
    }
  };

  const renderPrefix = () => {
    if (!prefix && type !== 'currency') return null;
    
    const prefixText = prefix || (type === 'currency' ? '$' : '');
    
    return (
      <View style={styles.prefixContainer}>
        <Text style={[styles.prefixText, { color: getInputColor() }]}>
          {prefixText}
        </Text>
      </View>
    );
  };

  const renderSuffix = () => {
    const showClearButton = clearable && numericInput.displayValue && !disabled;
    const showAutoFixButton = autoFix && !numericInput.isValid && numericInput.numericValue && !disabled;
    const suffixText = suffix || (type === 'percentage' ? '%' : '');
    
    return (
      <View style={styles.suffixContainer}>
        {suffixText && (
          <Text style={[styles.suffixText, { color: getInputColor() }]}>
            {suffixText}
          </Text>
        )}
        
        {showAutoFixButton && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleAutoFix}
          >
            <Ionicons name="build-outline" size={16} color="#F59E0B" />
          </TouchableOpacity>
        )}
        
        {showClearButton && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleClear}
          >
            <Ionicons name="close-circle" size={16} color="#6B7280" />
          </TouchableOpacity>
        )}
        
        {showValidIcon && numericInput.hasBeenTouched && (
          <View style={styles.statusIcon}>
            <Ionicons
              name={numericInput.isValid ? "checkmark-circle" : "alert-circle"}
              size={16}
              color={numericInput.isValid ? "#10B981" : "#EF4444"}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, labelStyle, { color: getInputColor() }]}>
          {label}
        </Text>
      )}
      
      <View style={[
        styles.inputContainer,
        { borderColor: getBorderColor() },
        disabled && styles.disabledContainer
      ]}>
        {renderPrefix()}
        
        <TextInput
          {...numericInput.textInputProps}
          style={[
            styles.input,
            inputStyle,
            { color: getInputColor() }
          ]}
          placeholder={getPlaceholder()}
          placeholderTextColor="#9CA3AF"
          editable={!disabled}
          selectTextOnFocus
        />
        
        {renderSuffix()}
      </View>
      
      {/* Errores */}
      {numericInput.hasBeenTouched && numericInput.errors.length > 0 && (
        <View style={styles.errorsContainer}>
          {numericInput.errors.map((error, index) => (
            <View key={index} style={styles.errorRow}>
              {showErrorIcon && (
                <Ionicons name="alert-circle-outline" size={12} color="#EF4444" />
              )}
              <Text style={[styles.errorText, errorStyle]}>
                {error}
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {/* Información adicional para números grandes */}
      {numericInput.numericValue && Math.abs(numericInput.numericValue) >= 1000000 && (
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={12} color="#6B7280" />
          <Text style={styles.infoText}>
            Número grande detectado. Toca para ver detalles.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#374151',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  disabledContainer: {
    backgroundColor: '#F9FAFB',
  },
  prefixContainer: {
    marginRight: 8,
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 12,
    textAlign: 'right',
  },
  suffixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  suffixText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  actionButton: {
    padding: 4,
    marginLeft: 4,
  },
  statusIcon: {
    padding: 4,
    marginLeft: 4,
  },
  errorsContainer: {
    marginTop: 6,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
});

export default SmartInput;
