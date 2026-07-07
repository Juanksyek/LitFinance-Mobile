export type TicketEstado =
  | 'processing'
  | 'review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TicketCategoria =
  | 'alimentos'
  | 'farmacia'
  | 'higiene'
  | 'hogar'
  | 'transporte'
  | 'entretenimiento'
  | 'ropa'
  | 'educacion'
  | 'servicios'
  | 'restaurante'
  | 'mascotas'
  | 'tecnologia'
  | 'otros';

export interface TicketItem {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  categoria?: TicketCategoria;
  confianza?: number;
}

export interface Ticket {
  ticketId: string;
  userId?: string;
  tienda: string;
  direccionTienda?: string;
  fechaCompra: string;
  items: TicketItem[];
  subtotal: number;
  impuestos: number;
  descuentos: number;
  propina: number;
  total: number;
  moneda: string;
  metodoPago?: string;
  estado: TicketEstado;
  confirmado: boolean;
  hasImage: boolean;
  resumenCategorias: Record<string, number>;
  detalles?: string[];
  transaccionId?: string;
  notas?: string;
  createdAt: string;
  reviewLevel?: 'auto' | 'light' | 'full' | 'manual';
  fieldConfidence?: Record<string, number>;
  ocrScore?: number;
}

export interface TicketScanRequest {
  imagenBase64: string;
  imagenMimeType?: string;
  ocrTexto?: string;
  moneda?: string;
  cuentaId?: string;
  subCuentaId?: string | null;
  autoConfirm?: boolean;
  metadata?: {
    plataforma: 'ios' | 'android' | 'web';
    fuenteCaptura: 'document_scanner' | 'camera' | 'gallery';
    appVersion: string;
    ancho: number;
    alto: number;
    orientacion: 'portrait' | 'landscape' | 'square';
    multiShot: boolean;
    capturas: number;
    scoreCalidad: number;
    problemas: string[];
    ocrPreviewTexto?: string;
    bordesDetectados: boolean;
  };
  capturasAdicionales?: {
    base64: string;
    mimeType: string;
    section: 'header' | 'body' | 'footer';
    ancho: number;
    alto: number;
  }[];
  localOcr?: {
    rawText: string;
    score: number;
    blocks?: { text: string; lines: { text: string }[] }[];
  };
  captureMeta?: {
    usedFlash: boolean;
    source: 'camera' | 'gallery' | 'document_scanner';
    rotation?: number;
  };
}

export interface TicketManualRequest {
  tienda: string;
  direccionTienda?: string;
  fechaCompra: string;
  items: Omit<TicketItem, 'categoria' | 'confianza'>[];
  subtotal: number;
  impuestos?: number;
  descuentos?: number;
  propina?: number;
  total: number;
  moneda?: string;
  metodoPago?: string;
  cuentaId?: string;
  subCuentaId?: string | null;
  imagenBase64?: string | null;
  imagenMimeType?: string;
  notas?: string;
}

export interface TicketConfirmEdits {
  tienda?: string;
  items?: TicketItem[];
  total?: number;
  cuentaId?: string;
  notas?: string;
}

export interface TicketListParams {
  estado?: TicketEstado;
  tienda?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
}

export interface TicketListResponse {
  total: number;
  page: number;
  limit: number;
  data: Ticket[];
}

export interface EvaluationReport {
  totalTickets: number;
  precisionPorCampo: Record<string, number>;
  errorPromedioMontos: number;
  porExtractor: { extractor: string; tickets: number; precision: number }[];
}

export interface TicketAnalytics {
  totalTickets: number;
  totalGastado: number;
  porTienda: { tienda: string; tickets: number; total: number }[];
  porCategoria: { categoria: string; articulos: number; total: number }[];
}

export interface TicketConfirmResponse {
  message: string;
  ticket: Ticket;
  transaccion?: {
    transaccionId: string;
    tipo: string;
    monto: number;
    moneda: string;
    concepto: string;
    motivo: string;
    fecha: string;
  };
}

export interface TicketLiquidationResponse {
  message: string;
  ticket: Ticket;
  transaccion?: {
    transaccionId: string;
    tipo: string;
    monto: number;
    moneda: string;
    concepto: string;
    motivo?: string;
    fecha?: string;
  };
}

