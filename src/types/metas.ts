export type MetaEstado = 'activa' | 'pausada' | 'cumplida' | 'archivada' | 'cancelada' | string;

export type MetaCompletionMoneyAction = 'keep' | 'transfer_to_main' | 'mark_used';
export type MetaCompletionMetaAction = 'none' | 'archive' | 'reset' | 'duplicate';

export type MetaCompletionDecision = {
  moneyAction: MetaCompletionMoneyAction;
  metaAction: MetaCompletionMetaAction;
  decidedAt: string;
  motivo?: string;
  movedAmount?: number;
  txId?: string;
  duplicatedMetaId?: string;
};

export type MetaCompletion = {
  isCompleted: boolean;
  pendingDecision: boolean;
  shouldCelebrate: boolean;
  completedAt: string | null;
  decision: MetaCompletionDecision | null;
};

export type Meta = {
  metaId: string;
  nombre: string;
  descripcion?: string | null;
  moneda: string;
  // New model fields
  mode?: 'independent' | 'legacy' | string;
  saldoActual?: number;
  objetivo?: number;
  progreso?: number; // 0..1
  fechaObjetivo?: string | null;
  // Legacy compatibility
  subcuentaId?: string;
  estado: MetaEstado;
  createdAt?: string;
  updatedAt?: string;

  // V2 completion flow (optional for backward compatibility)
  completion?: MetaCompletion;
};

export type ResolveMetaCompletionRequest = {
  moneyAction: MetaCompletionMoneyAction;
  metaAction: MetaCompletionMetaAction;
  motivo?: string;
  moveToMain?: boolean;
  amount?: number;
  resetObjetivo?: number;
  resetFechaObjetivo?: string;
};

export type ResolveMetaCompletionResponse = {
  message: string;
  decision: MetaCompletionDecision;
  duplicatedMeta?: any | null;
  idempotent: boolean;
};

export type MetaHistorialTipo = 'aporte' | 'retiro' | 'ajuste' | 'estado' | string;

export type MetaHistorialItem = {
  historialId?: string;
  metaId: string;
  tipo: MetaHistorialTipo;
  monto?: number;
  moneda?: string;
  descripcion?: string | null;
  createdAt: string;
};

export type ListMetasParams = {
  estado?: MetaEstado;
  page?: number;
  limit?: number;
  search?: string;
};

export type ListMetasResponse = {
  items: Meta[];
  page?: number;
  limit?: number;
  total?: number;
};

export type CreateMetaRequest = {
  nombre: string;
  descripcion?: string;
  objetivo: number;
  moneda: string;
  color?: string; // hex
  icono?: string; // icon name or emoji
  fechaObjetivo?: string; // YYYY-MM-DD or ISO (backend accepts both)
  prioridad?: number;
  // Legacy compatibility: optional subcuentaId still accepted
  subcuentaId?: string;
};

export type UpdateMetaRequest = Partial<CreateMetaRequest>;

export type MetaMovimientoRequest = {
  monto: number;
  descripcion?: string;
  idempotencyKey?: string;
};

export type MetaOperacionRequest = {
  monto: number;
  moneda?: string;
  origenTipo?: 'cuenta' | 'subcuenta';
  origenId?: string;
  destinoTipo?: 'cuenta' | 'subcuenta';
  destinoId?: string;
  idempotencyKey?: string;
  nota?: string;
};
