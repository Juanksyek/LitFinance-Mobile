import { useState, useCallback, useMemo, useEffect } from 'react';
import { validateNumericInput, parseNumber } from '../utils/numberFormatter';

interface UseNumericInputOptions {
  initialValue?: number;
  context?: string;
  maxValue?: number;
  minValue?: number;
  allowNegative?: boolean;
  allowDecimals?: boolean;
  maxDecimals?: number;
  onValueChange?: (value: number | null) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
}

export const useNumericInput = (options: UseNumericInputOptions = {}) => {
  const {
    initialValue = 0,
    context = 'default',
    maxValue,
    minValue,
    allowNegative = true,
    allowDecimals = true,
    maxDecimals = 2,
    onValueChange,
    onValidationChange
  } = options;

  const [displayValue, setDisplayValue] = useState(
    initialValue.toString()
  );
  const [isFocused, setIsFocused] = useState(false);
  const [hasBeenTouched, setHasBeenTouched] = useState(false);

  const validation = useMemo(() => {
    if (!hasBeenTouched && displayValue === initialValue.toString()) {
      return { isValid: true, errors: [], numericValue: initialValue };
    }

    const baseValidation = validateNumericInput(displayValue, context);
    const errors = [...baseValidation.errors];
    let isValid = baseValidation.isValid;

    if (baseValidation.numericValue !== undefined) {
      const value = baseValidation.numericValue;

      if (!allowNegative && value < 0) {
        errors.push('No se permiten números negativos');
        isValid = false;
      }

      if (maxValue !== undefined && value > maxValue) {
        errors.push(`Valor máximo permitido: ${maxValue}`);
        isValid = false;
      }

      if (minValue !== undefined && value < minValue) {
        errors.push(`Valor mínimo permitido: ${minValue}`);
        isValid = false;
      }

      if (!allowDecimals && value % 1 !== 0) {
        errors.push('Solo se permiten números enteros');
        isValid = false;
      }

      // Verificar decimales
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      if (decimalPlaces > maxDecimals) {
        errors.push(`Máximo ${maxDecimals} decimales permitidos`);
        isValid = false;
      }
    }

    return {
      isValid,
      errors,
      numericValue: baseValidation.numericValue
    };
  }, [displayValue, context, maxValue, minValue, allowNegative, allowDecimals, maxDecimals, hasBeenTouched, initialValue]);

  // Notificar cambios
  useEffect(() => {
    onValidationChange?.(validation.isValid, validation.errors);
    onValueChange?.(validation.numericValue ?? null);
  }, [validation, onValidationChange, onValueChange]);

  const handleChangeText = useCallback((text: string) => {
    setHasBeenTouched(true);
    
    // Limpiar caracteres no permitidos
    let cleaned = text;
    
    if (!allowDecimals) {
      cleaned = cleaned.replace(/\./g, '');
    }
    
    if (!allowNegative) {
      cleaned = cleaned.replace(/-/g, '');
    }

    // Permitir solo números, punto decimal y signo negativo
    cleaned = cleaned.replace(/[^0-9.-]/g, '');

    // Asegurar solo un punto decimal
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    // Asegurar solo un signo negativo al inicio
    if (cleaned.includes('-')) {
      const negative = cleaned.startsWith('-');
      cleaned = cleaned.replace(/-/g, '');
      if (negative) {
        cleaned = '-' + cleaned;
      }
    }

    // Limitar decimales durante la escritura
    if (allowDecimals && cleaned.includes('.')) {
      const [integer, decimal] = cleaned.split('.');
      if (decimal && decimal.length > maxDecimals) {
        cleaned = integer + '.' + decimal.slice(0, maxDecimals);
      }
    }

    setDisplayValue(cleaned);
  }, [allowDecimals, allowNegative, maxDecimals]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setHasBeenTouched(true);

    // Formatear el valor cuando se pierde el foco
    if (validation.numericValue !== undefined && !isNaN(validation.numericValue)) {
      const formattedValue = validation.numericValue.toFixed(
        allowDecimals ? Math.min(2, maxDecimals) : 0
      );
      setDisplayValue(formattedValue);
    }
  }, [validation.numericValue, allowDecimals, maxDecimals]);

  const setValue = useCallback((value: number) => {
    const stringValue = allowDecimals ? 
      value.toFixed(Math.min(2, maxDecimals)) : 
      Math.round(value).toString();
    setDisplayValue(stringValue);
    setHasBeenTouched(true);
  }, [allowDecimals, maxDecimals]);

  const reset = useCallback(() => {
    setDisplayValue(initialValue.toString());
    setHasBeenTouched(false);
    setIsFocused(false);
  }, [initialValue]);

  const clear = useCallback(() => {
    setDisplayValue('');
    setHasBeenTouched(true);
  }, []);

  // Formatear para mostrar (con separadores de miles, etc.)
  const getFormattedDisplay = useCallback(() => {
    if (isFocused || !validation.numericValue) {
      return displayValue;
    }

    try {
      return validation.numericValue.toLocaleString('es-MX', {
        minimumFractionDigits: allowDecimals ? 2 : 0,
        maximumFractionDigits: allowDecimals ? maxDecimals : 0
      });
    } catch {
      return displayValue;
    }
  }, [displayValue, isFocused, validation.numericValue, allowDecimals, maxDecimals]);

  return {
    // Valores
    displayValue,
    numericValue: validation.numericValue,
    formattedDisplay: getFormattedDisplay(),
    
    // Estado
    isFocused,
    hasBeenTouched,
    isValid: validation.isValid,
    errors: validation.errors,
    
    // Handlers
    onChangeText: handleChangeText,
    onFocus: handleFocus,  
    onBlur: handleBlur,
    
    // Métodos
    setValue,
    reset,
    clear,
    
    // Props útiles para TextInput
    textInputProps: {
      value: displayValue,
      onChangeText: handleChangeText,
      onFocus: handleFocus,
      onBlur: handleBlur,
      keyboardType: allowDecimals ? 'decimal-pad' as const : 'number-pad' as const,
      placeholder: '0' + (allowDecimals ? '.00' : ''),
    }
  };
};

// Hook especializado para cantidades de dinero
export const useCurrencyInput = (options: Omit<UseNumericInputOptions, 'allowDecimals' | 'maxDecimals'> = {}) => {
  return useNumericInput({
    ...options,
    allowDecimals: true,
    maxDecimals: 2,
    context: 'transaction'
  });
};

// Hook especializado para porcentajes
export const usePercentageInput = (options: Omit<UseNumericInputOptions, 'maxValue' | 'minValue' | 'allowDecimals'> = {}) => {
  return useNumericInput({
    ...options,
    maxValue: 100,
    minValue: 0,
    allowDecimals: true,
    maxDecimals: 2,
    allowNegative: false
  });
};

// Hook especializado para enteros
export const useIntegerInput = (options: Omit<UseNumericInputOptions, 'allowDecimals'> = {}) => {
  return useNumericInput({
    ...options,
    allowDecimals: false
  });
};
