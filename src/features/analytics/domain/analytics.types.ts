export type {
  AnalisisTemporal,
  EstadisticaConcepto,
  EstadisticaRecurrente,
  EstadisticaSubcuenta,
} from '../../../types/analytics';

export interface ResumenFinanciero {
  ingresos: number;
  gastos: number;
  totalIngresado: {
    monto: number;
    moneda: string;
    expenses: number;
    gastos: number;
    desglosePorMoneda: Array<{
      moneda: string;
      monto: number;
      simbolo: string;
    }>;
  };
  totalGastado: {
    monto: number;
    moneda: string;
    desglosePorMoneda: Array<{
      moneda: string;
      monto: number;
      simbolo: string;
    }>;
  };
  balance: {
    monto: number;
    moneda: string;
    esPositivo: boolean;
  };
  totalEnSubcuentas: {
    monto: number;
    moneda: string;
    desglosePorSubcuenta: Array<{
      subcuentaId: string;
      nombre: string;
      monto: number;
      moneda: string;
      simbolo: string;
      activa: boolean;
    }>;
  };
  totalMovimientos: number;
  periodo: {
    fechaInicio: string;
    fechaFin: string;
    descripcion: string;
  };
}

export interface AnalisisTemporalNormalized {
  range?: string;
  points: Array<{ x: string; in: number; out: number }>;
  raw?: unknown;
}

export interface AnalyticsFilters {
  rangoTiempo?:
    | 'dia'
    | 'semana'
    | 'mes'
    | '3meses'
    | '6meses'
    | 'año'
    | 'desdeSiempre'
    | 'personalizado';
  fechaInicio?: string;
  fechaFin?: string;
  subcuentas?: string[];
  conceptos?: string[];
  monedas?: string[];
  cuentas?: string[];
  incluirRecurrentes?: boolean;
  soloTransaccionesManuales?: boolean;
  tipoTransaccion?: 'ingreso' | 'egreso' | 'ambos';
  monedaBase?: string;
  incluirSubcuentasInactivas?: boolean;
  montoMinimo?: number;
  montoMaximo?: number;
}

export interface AnalyticsSmartFilters extends AnalyticsFilters {
  topN?: number;
  meses?: number;
}

export type SmartInsightSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface SmartInsight {
  codigo: string;
  severidad: SmartInsightSeverity;
  titulo: string;
  detalle: string;
  metadata?: Record<string, unknown>;
}

export interface SmartSerieMensualBucket {
  mes: string;
  ingresos: number;
  gastos: number;
  balance: number;
  gastosRecurrentes?: number;
}

export interface SmartTopConceptoGasto {
  conceptoId?: string;
  concepto?: {
    id: string;
    nombre: string;
    color?: string;
    icono?: string;
  };
  nombre?: string;
  color?: string;
  icono?: string;
  monto: number;
  movimientos?: number;
  deltaVsPeriodoAnterior?: number;
}

export interface SmartRecurrentesResumen {
  totalEjecutado: number;
  top: Array<{
    id?: string;
    nombre: string;
    monto: number;
    moneda?: string;
    categoria?: string;
    color?: string;
  }>;
}

export interface AnalyticsResumenInteligente {
  periodo: { fechaInicio: string; fechaFin: string; descripcion: string };
  moneda: string;
  totales: {
    ingresos: number;
    gastos: number;
    balance: number;
    movimientos: number;
  };
  serieMensual: SmartSerieMensualBucket[];
  topConceptosGasto: SmartTopConceptoGasto[];
  recurrentes?: SmartRecurrentesResumen;
  insights: SmartInsight[];
}

export interface PreviewBalance {
  monedaPreview: string;
  simbolo: string;
  cuentaPrincipal: {
    cantidad: number;
    monedaOriginal: string;
    tasaConversion: number;
  };
  subcuentas: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    monedaOriginal: string;
    tasaConversion: number;
    color: string;
    activa: boolean;
  }>;
  totalGeneral: number;
  tasasUtilizadas: Record<string, number>;
  timestamp: string;
}
