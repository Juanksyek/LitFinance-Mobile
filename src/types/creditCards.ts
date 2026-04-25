export type CreditCardEmitter = 'VISA' | 'Mastercard' | 'AMEX' | 'Discover' | string;

export type SaludLabel = 'excelente' | 'buena' | 'regular' | 'critica';

export type MovimientoTipo = 'compra' | 'pago' | 'credito' | 'ajuste';

export interface CreditCard {
  cardId: string;
  nombre: string;
  last4: string;
  emisor: CreditCardEmitter;
  banco: string;
  color: string;
  moneda: string;
  limiteCredito: number;
  saldoUsado: number;
  saldoDisponible: number;
  utilizacion: number;
  saludScore: number;
  saludLabel: SaludLabel;
  pagoMinimo: number;
  proximaFechaCorte: string | null;
  proximaFechaPago: string | null;
  activa?: boolean;
  diaCorte?: number;
  diaPago?: number;
  porcentajePagoMinimo?: number;
  recordatorios?: Recordatorio[];
  movimientosRecientes?: CreditCardMovimiento[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Recordatorio {
  tipo: 'pago' | 'corte' | 'custom';
  diasAntes?: number;
  activo?: boolean;
  fecha?: string | null;
}

export interface CreditCardMovimiento {
  movimientoId?: string;
  _id?: string;
  tipo: MovimientoTipo;
  monto: number;
  descripcion?: string;
  concepto?: string;
  fecha: string;
  createdAt?: string;
  cuentaId?: string | null;
  subCuentaId?: string | null;
  transaccionId?: string | null;
  metadata?: Record<string, any> | null;
}

export interface CreditCardSaludResponse {
  card: { cardId: string; nombre: string };
  limiteCredito: number;
  saldoUsado: number;
  saldoDisponible: number;
  utilizacion: number;
  score: number;
  label: SaludLabel;
  pagoMinimo: number;
  alertas: string[];
}

export interface CreditCardMovimientosResponse {
  total: number;
  page: number;
  limit: number;
  data: CreditCardMovimiento[];
}

export interface CreateCreditCardDto {
  nombre: string;
  last4: string;
  emisor: string;
  banco: string;
  color: string;
  moneda: string;
  limiteCredito: number;
  diaCorte: number;
  diaPago: number;
  porcentajePagoMinimo?: number;
  recordatorios?: Recordatorio[];
}

export interface RegisterMovimientoDto {
  tipo: MovimientoTipo;
  monto: number;
  descripcion?: string;
  concepto?: string;
  fecha?: string;
  cuentaId?: string;
  subCuentaId?: string;
}

export interface CreditCardsSummary {
  total: number;
  totalLimiteCredito: number;
  totalSaldoUsado: number;
  totalSaldoDisponible: number;
  utilizacionPromedio: number;
  saludGeneral: SaludLabel;
  tarjetas: Partial<CreditCard>[];
}
