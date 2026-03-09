export type BlocTipo = 'cuentas' | 'compras';

export type Bloc = {
  blocId: string;
  nombre: string;
  descripcion?: string | null;
  icono?: string | null;
  tipo: BlocTipo;
};

export type BlocItemModo = 'monto' | 'articulo';
export type BlocItemEstado = 'pendiente' | 'parcial' | 'pagado' | 'archivado';

export type BlocItem = {
  itemId: string;
  blocId: string;
  categoria: string;
  titulo: string;
  descripcion?: string | null;
  moneda: string;
  modo: BlocItemModo;
  monto?: number;
  cantidad?: number;
  precioUnitario?: number;
  estado: BlocItemEstado;
  pagadoAcumulado: number;
  lastLiquidationId?: string | null;
  lastTransactionId?: string | null;
};

export type CreateBlocRequest = {
  nombre: string;
  tipo: BlocTipo;
  descripcion?: string;
  icono?: string;
};

// PATCH /blocs/:blocId (partial)
export type PatchBlocRequest = Partial<{
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  tipo: BlocTipo;
}>;

export type CreateItemMontoRequest = {
  categoria: string;
  titulo: string;
  descripcion?: string;
  moneda: string;
  modo: 'monto';
  monto: number;
};

export type CreateItemArticuloRequest = {
  categoria: string;
  titulo: string;
  descripcion?: string;
  moneda: string;
  modo: 'articulo';
  cantidad: number;
  precioUnitario: number;
};

export type CreateBlocItemRequest = CreateItemMontoRequest | CreateItemArticuloRequest;

export type UpdateBlocItemRequest = Partial<{
  categoria: string;
  titulo: string;
  descripcion: string | null;
  moneda: string;
  modo: BlocItemModo;
  monto: number;
  cantidad: number;
  precioUnitario: number;
  estado: BlocItemEstado;
  pagadoAcumulado: number;
}>;

// Batch autosave/upsert/delete (PATCH /blocs/:blocId/items)
// Notes:
// - This endpoint does not allow changing `estado` or `pagadoAcumulado`.
// - For `modo=monto`, include `monto`.
// - For `modo=articulo`, include `cantidad` and `precioUnitario`.
export type BlocItemUpsert = Partial<Omit<UpdateBlocItemRequest, 'estado' | 'pagadoAcumulado'>> &
  Partial<CreateBlocItemRequest> & {
    itemId?: string;
  };

export type PatchBlocItemsRequest = {
  upserts?: BlocItemUpsert[];
  deleteItemIds?: string[];
};

export type PatchBlocItemsResponse = {
  deletedCount: number;
  updatedCount: number;
  createdCount: number;
  createdItems?: Array<{
    itemId: string;
    titulo?: string;
  }>;
};

export type BlocDetailResponse = {
  bloc: Bloc;
  items: BlocItem[];
};

export type LiquidationTargetType = 'principal' | 'cuenta' | 'subcuenta';

export type LiquidationPartialPayment = {
  itemId: string;
  amount: number;
};

export type LiquidationPreviewRequest = {
  itemIds: string[];
  targetType: LiquidationTargetType;
  // Only required when targetType is 'cuenta' or 'subcuenta'.
  targetId?: string;
  porItem: boolean;
  partialPayments?: LiquidationPartialPayment[];
};

export type MoneyAmount = { amount: number; currency: string };

export type LiquidationPreviewItem = {
  itemId: string;
  titulo: string;
  original: MoneyAmount;
  rateUsed: number;
  rateAsOf: string;
  converted: MoneyAmount;
};

export type LiquidationPreviewResponse = {
  bloc: Bloc;
  targetCurrency: string;
  totalOriginalByCurrency: Record<string, number>;
  totalConverted: number;
  items: LiquidationPreviewItem[];
};

export type LiquidationCommitRequest = {
  itemIds: string[];
  targetType: LiquidationTargetType;
  // Only required when targetType is 'cuenta' or 'subcuenta'.
  targetId?: string;
  porItem: boolean;
  nota?: string;
};

export type LiquidationCommitResponse = {
  liquidationId: string;
  targetCurrency: string;
  totalOriginalByCurrency: Record<string, number>;
  totalConverted: number;
  items: LiquidationPreviewItem[];
  transactionIds: string[];
};

export type ListLiquidacionesResponse = Array<{
  liquidationId: string;
  createdAt: string;
  targetType: LiquidationTargetType;
  targetId: string;
  targetCurrency: string;
  totalOriginalByCurrency: Record<string, number>;
  totalConverted: number;
}>;
