
export interface DesglosePorMoneda {
  moneda: string;
  monto: number;
  simbolo: string;
}

export interface TotalFinanciero {
  monto: number;
  moneda: string;
  desglosePorMoneda?: DesglosePorMoneda[];
}

export interface Balance {
  monto: number;
  moneda: string;
  esPositivo: boolean;
}

export interface DesglosePorSubcuenta {
  subcuentaId: string;
  nombre: string;
  monto: number;
  moneda: string;
  simbolo: string;
  activa: boolean;
}

export interface TotalEnSubcuentas {
  monto: number;
  moneda: string;
  desglosePorSubcuenta: DesglosePorSubcuenta[];
}

export interface PeriodoAnalisis {
  fechaInicio: string;
  fechaFin: string;
  descripcion: string;
}

export interface ResumenFinanciero {
  totalIngresado: TotalFinanciero;
  totalGastado: TotalFinanciero;
  balance: Balance;
  totalEnSubcuentas: TotalEnSubcuentas;
  totalMovimientos: number;
  periodo: PeriodoAnalisis;
}

export interface ConceptoInfo {
  id: string;
  nombre: string;
  color: string;
  icono: string;
}

export interface EstadisticaConcepto {
  concepto: ConceptoInfo;
  totalIngreso: number;
  totalGasto: number;
  cantidadMovimientos: number;
  montoPromedio: number;
  ultimoMovimiento: string;
  participacionPorcentual: number;
}

export interface SubcuentaInfo {
  id: string;
  nombre: string;
  color: string;
  moneda: string;
  simbolo: string;
  activa: boolean;
}

export interface EstadisticaSubcuenta {
  subcuenta: SubcuentaInfo;
  saldoActual: number;
  totalIngresos: number;
  totalEgresos: number;
  cantidadMovimientos: number;
  ultimoMovimiento: string;
  crecimientoMensual: number;
}

export interface PlataformaInfo {
  nombre: string;
  color: string;
  categoria: string;
}

export interface RecurrenteInfo {
  id: string;
  nombre: string;
  plataforma: PlataformaInfo;
  frecuencia: string;
}

export interface EstadisticaRecurrente {
  recurrente: RecurrenteInfo;
  montoMensual: number;
  totalEjecutado: number;
  ultimaEjecucion: string;
  proximaEjecucion: string;
  estadoActual: string;
  cantidadEjecuciones: number;
}

export interface DatoTemporal {
  fecha: string;
  ingresos: number;
  gastos: number;
  balance: number;
  cantidadMovimientos: number;
}

export interface Tendencias {
  ingresosTendencia: 'ascendente' | 'descendente' | 'estable';
  gastosTendencia: 'ascendente' | 'descendente' | 'estable';
  balanceTendencia: 'ascendente' | 'descendente' | 'estable';
}

export interface Promedios {
  ingresoPromedio: number;
  gastoPromedio: number;
  balancePromedio: number;
}

export interface AnalisisTemporal {
  periodoAnalisis: 'diario' | 'semanal' | 'mensual';
  datos: DatoTemporal[];
  tendencias: Tendencias;
  promedios: Promedios;
}

export type RangoTiempo = 'dia' | 'semana' | 'mes' | '3meses' | '6meses' | 'año' | 'personalizado';
export type TipoTransaccion = 'ingreso' | 'egreso' | 'ambos';

export interface FiltrosAnalytics {
  rangoTiempo?: RangoTiempo;
  fechaInicio?: string;
  fechaFin?: string;
  subcuentas?: string[];
  conceptos?: string[];
  monedas?: string[];
  cuentas?: string[];
  incluirRecurrentes?: boolean;
  soloTransaccionesManuales?: boolean;
  tipoTransaccion?: TipoTransaccion;
  monedaBase?: string;
  incluirSubcuentasInactivas?: boolean;
  montoMinimo?: number;
  montoMaximo?: number;
}