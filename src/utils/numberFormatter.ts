/**
 * Sistema robusto de formateo de números para LitFinance
 * Maneja cifras extremas, diferentes contextos y localizaciones
 */

export interface FormatOptions {
  context?: 'card' | 'modal' | 'list' | 'detail' | 'input';
  currency?: string;
  symbol?: string;
  locale?: string;
  maxLength?: number;
  showFullOnHover?: boolean;
  allowNegative?: boolean;
  trimZeros?: boolean;
  forceFullNumbers?: boolean;
}

export interface NumberLimits {
  min: number;
  max: number;
  warningThreshold: number;
}

// Límites seguros para diferentes contextos
export const NUMBER_LIMITS: Record<string, NumberLimits> = {
  default: {
    min: -999999999999999, // -999 billones
    max: 999999999999999,  // 999 billones  
    warningThreshold: 1000000000000 // 1 billón
  },
  transaction: {
    min: -100000000000, // -100 mil millones
    max: 100000000000,  // 100 mil millones
    warningThreshold: 1000000000 // 1 mil millones
  },
  account: {
    min: -999999999999999,
    max: 999999999999999,
    warningThreshold: 1000000000000
  }
};

export class SmartNumberFormatter {
  private static instance: SmartNumberFormatter;
  
  private constructor() {}
  
  public static getInstance(): SmartNumberFormatter {
    if (!SmartNumberFormatter.instance) {
      SmartNumberFormatter.instance = new SmartNumberFormatter();
    }
    return SmartNumberFormatter.instance;
  }

  /**
   * Formatea un número según el contexto y las opciones
   */
  public format(
    amount: number,
    options: FormatOptions = {}
  ): {
    formatted: string;
    fullValue: string;
    isLarge: boolean;
    isTruncated: boolean;
    scientific?: string;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const {
      context = 'default',
      currency = 'MXN',
      symbol = '$',
      locale = 'es-MX',
      maxLength = this.getMaxLengthForContext(context),
      allowNegative = true,
      trimZeros = false,
      forceFullNumbers = false
    } = options;

    // Validaciones básicas
    if (!this.isValidNumber(amount)) {
      return {
        formatted: '—',
        fullValue: 'Número inválido',
        isLarge: false,
        isTruncated: false,
        warnings: ['Número inválido']
      };
    }

    // Verificar límites
    const limits = NUMBER_LIMITS[context] || NUMBER_LIMITS.default;
    if (Math.abs(amount) > limits.max) {
      warnings.push('Número excede límites seguros');
      return this.formatExtremeNumber(amount, symbol, warnings);
    }

    if (Math.abs(amount) >= limits.warningThreshold) {
      warnings.push('Número muy grande - considera verificar');
    }

    if (!allowNegative && amount < 0) {
      amount = Math.abs(amount);
      warnings.push('Número negativo convertido a positivo');
    }

    // Valor completo para referencia
    const fullValue = this.getFullValueString(amount, symbol, locale);
    const scientific = Math.abs(amount) >= 1e6 ? amount.toExponential(2) : undefined;

    // Formateo según contexto
    let formatted: string;
    let isTruncated = false;
    let isLarge = Math.abs(amount) >= 1000000;

    switch (context) {
      case 'card':
        ({ formatted, isTruncated } = this.formatForCard(amount, symbol, locale, maxLength, forceFullNumbers));
        break;
      case 'modal':
        ({ formatted, isTruncated } = this.formatForModal(amount, symbol, locale));
        break;
      case 'list':
        ({ formatted, isTruncated } = this.formatForList(amount, symbol, locale, maxLength, forceFullNumbers));
        break;
      case 'detail':
        formatted = this.formatForDetail(amount, symbol, locale);
        break;
      case 'input':
        formatted = this.formatForInput(amount, trimZeros);
        break;
      default:
        ({ formatted, isTruncated } = this.formatDefault(amount, symbol, locale, maxLength, forceFullNumbers));
    }

    return {
      formatted,
      fullValue,
      isLarge,
      isTruncated,
      scientific,
      warnings
    };
  }

  /**
   * Formatea números extremadamente grandes
   */
  private formatExtremeNumber(amount: number, symbol: string, warnings: string[]): any {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    
    if (absAmount >= 1e15) { // Cuatrillones
      const quadrillions = absAmount / 1e15;
      return {
        formatted: `${sign}${symbol}${quadrillions.toFixed(1)}Q`,
        fullValue: `${sign}${symbol}${absAmount.toExponential(2)}`,
        isLarge: true,
        isTruncated: true,
        scientific: amount.toExponential(2),
        warnings: [...warnings, 'Número extremadamente grande - mostrado en notación compacta']
      };
    }
    
    // Fallback a notación científica
    return {
      formatted: `${sign}${symbol}${amount.toExponential(1)}`,
      fullValue: `${sign}${symbol}${amount.toExponential(6)}`,
      isLarge: true,
      isTruncated: true,
      scientific: amount.toExponential(2),
      warnings: [...warnings, 'Número muy grande - mostrado en notación científica']
    };
  }

  /**
   * Formato para tarjetas (limitado en espacio)
   */
  private formatForCard(amount: number, symbol: string, locale: string, maxLength: number, forceFullNumbers: boolean = false): { formatted: string; isTruncated: boolean } {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';

    // Si se fuerza mostrar números completos, saltar abreviaciones
    if (forceFullNumbers) {
      const formatted = `${sign}${symbol}${absAmount.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
      
      return {
        formatted,
        isTruncated: false
      };
    }

    // Números muy grandes - usar notación compacta agresiva
    if (absAmount >= 1e12) { // Billones
      const trillions = absAmount / 1e12;
      return {
        formatted: `${sign}${symbol}${trillions.toFixed(1)}B`,
        isTruncated: true
      };
    }

    if (absAmount >= 1e9) { // Miles de millones
      const billions = absAmount / 1e9;
      return {
        formatted: `${sign}${symbol}${billions.toFixed(1)}MM`,
        isTruncated: true
      };
    }

    if (absAmount >= 1e6) { // Millones
      const millions = absAmount / 1e6;
      return {
        formatted: `${sign}${symbol}${millions.toFixed(1)}M`,
        isTruncated: true
      };
    }

    if (absAmount >= 1e3) { // Miles
      const thousands = absAmount / 1e3;
      return {
        formatted: `${sign}${symbol}${thousands.toFixed(1)}K`,
        isTruncated: true
      };
    }

    // Números pequeños
    const formatted = `${sign}${symbol}${absAmount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    return {
      formatted: formatted.length > maxLength ? `${sign}${symbol}${absAmount.toFixed(0)}` : formatted,
      isTruncated: formatted.length > maxLength
    };
  }

  /**
   * Formato para modales (más espacio disponible)
   */
  private formatForModal(amount: number, symbol: string, locale: string): { formatted: string; isTruncated: boolean } {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';

    if (absAmount >= 1e9) {
      return {
        formatted: `${sign}${symbol}${absAmount.toLocaleString(locale, {
          notation: 'compact',
          compactDisplay: 'short',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`,
        isTruncated: true
      };
    }

    return {
      formatted: `${sign}${symbol}${absAmount.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`,
      isTruncated: false
    };
  }

  /**
   * Formato para listas (balance entre legibilidad y espacio)
   */
  private formatForList(amount: number, symbol: string, locale: string, maxLength: number, forceFullNumbers: boolean = false): { formatted: string; isTruncated: boolean } {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';

    // Si se fuerza mostrar números completos, saltar abreviaciones
    if (forceFullNumbers) {
      const formatted = `${sign}${symbol}${absAmount.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
      
      return {
        formatted,
        isTruncated: formatted.length > maxLength
      };
    }

    if (absAmount >= 1e6) {
      const millions = absAmount / 1e6;
      return {
        formatted: `${sign}${symbol}${millions.toFixed(2)}M`,
        isTruncated: true
      };
    }

    if (absAmount >= 1e3) {
      const thousands = absAmount / 1e3;
      return {
        formatted: `${sign}${symbol}${thousands.toFixed(1)}K`,
        isTruncated: true
      };
    }

    const formatted = `${sign}${symbol}${absAmount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    return {
      formatted,
      isTruncated: formatted.length > maxLength
    };
  }

  /**
   * Formato para vistas detalladas (información completa)
   */
  private formatForDetail(amount: number, symbol: string, locale: string): string {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';

    return `${sign}${symbol}${absAmount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    })}`;
  }

  /**
   * Formato para inputs (sin símbolo, números puros)
   */
  private formatForInput(amount: number, trimZeros: boolean): string {
    if (amount === 0) return '0';
    
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: trimZeros ? 0 : 2,
      maximumFractionDigits: 8,
      useGrouping: false
    });

    return trimZeros ? formatted.replace(/\.?0+$/, '') : formatted;
  }

  /**
   * Formato por defecto
   */
  private formatDefault(amount: number, symbol: string, locale: string, maxLength: number, forceFullNumbers: boolean = false): { formatted: string; isTruncated: boolean } {
    return this.formatForCard(amount, symbol, locale, maxLength, forceFullNumbers);
  }

  /**
   * Obtiene el valor completo como string para tooltips/modales
   */
  private getFullValueString(amount: number, symbol: string, locale: string): string {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    
    return `${sign}${symbol}${absAmount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    })}`;
  }

  /**
   * Obtiene la longitud máxima según el contexto
   */
  private getMaxLengthForContext(context: string): number {
    const limits = {
      card: 12,
      modal: 20,
      list: 15,
      detail: 50,
      input: 20
    };
    return limits[context as keyof typeof limits] || 15;
  }

  /**
   * Valida si un número es válido
   */
  private isValidNumber(value: any): boolean {
    return typeof value === 'number' && 
           !isNaN(value) && 
           isFinite(value);
  }

  /**
   * Utilidades de validación para inputs
   */
  public validateInput(input: string, context: string = 'default'): {
    isValid: boolean;
    numericValue?: number;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Limpiar input
    const cleaned = input.replace(/[^\d.-]/g, '');
    
    if (cleaned === '' || cleaned === '-') {
      return { isValid: false, errors: ['Campo requerido'] };
    }

    const numericValue = parseFloat(cleaned);
    
    if (!this.isValidNumber(numericValue)) {
      errors.push('Número inválido');
      return { isValid: false, errors };
    }

    const limits = NUMBER_LIMITS[context] || NUMBER_LIMITS.default;
    
    if (numericValue > limits.max) {
      errors.push(`Número muy grande (máximo: ${this.format(limits.max).formatted})`);
    }
    
    if (numericValue < limits.min) {
      errors.push(`Número muy pequeño (mínimo: ${this.format(limits.min).formatted})`);
    }

    if (Math.abs(numericValue) >= limits.warningThreshold) {
      errors.push('Número muy grande - verifica que sea correcto');
    }

    return {
      isValid: errors.length === 0,
      numericValue,
      errors
    };
  }

  /**
   * Parsea un string con formato a número
   */
  public parseFormattedNumber(formatted: string): number | null {
    // Remover símbolos de moneda y espacios
    const cleaned = formatted.replace(/[$€£¥₹₽\s,]/g, '');
    
    // Manejar notación compacta
    const compactMultipliers = {
      'K': 1e3,
      'M': 1e6,
      'MM': 1e9,
      'B': 1e12,
      'Q': 1e15
    };

    for (const [suffix, multiplier] of Object.entries(compactMultipliers)) {
      if (cleaned.endsWith(suffix)) {
        const baseNumber = parseFloat(cleaned.slice(0, -suffix.length));
        return isNaN(baseNumber) ? null : baseNumber * multiplier;
      }
    }

    // Manejar notación científica
    if (cleaned.includes('e') || cleaned.includes('E')) {
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
}

// Instancia singleton
export const formatter = SmartNumberFormatter.getInstance();

// Funciones de conveniencia
export const formatCurrency = (amount: number, options?: FormatOptions) => 
  formatter.format(amount, options);

export const formatForCard = (amount: number, symbol = '$') => 
  formatter.format(amount, { context: 'card', symbol });

export const formatForList = (amount: number, symbol = '$') => 
  formatter.format(amount, { context: 'list', symbol });

export const formatForModal = (amount: number, symbol = '$') => 
  formatter.format(amount, { context: 'modal', symbol });

export const formatForDetail = (amount: number, symbol = '$') => 
  formatter.format(amount, { context: 'detail', symbol });

export const validateNumericInput = (input: string, context?: string) => 
  formatter.validateInput(input, context);

export const parseNumber = (formatted: string) => 
  formatter.parseFormattedNumber(formatted);
