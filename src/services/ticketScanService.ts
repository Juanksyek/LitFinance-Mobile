import { API_BASE_URL } from '../constants/api';
import apiRateLimiter from './apiRateLimiter';

// ─── Types ──────────────────────────────────────────────────
export type TicketEstado = 'processing' | 'review' | 'completed' | 'failed' | 'cancelled';

export type TicketCategoria =
  | 'alimentos' | 'farmacia' | 'higiene' | 'hogar' | 'transporte'
  | 'entretenimiento' | 'ropa' | 'educacion' | 'servicios'
  | 'restaurante' | 'mascotas' | 'tecnologia' | 'otros';

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
  /** Lista de detalles/leyendas extraído por ticket (p.ej. nombres de productos) */
  detalles?: string[];
  transaccionId?: string;
  notas?: string;
  createdAt: string;
  /** Nivel de revisión sugerido por el backend según confianza OCR */
  reviewLevel?: 'auto' | 'light' | 'full' | 'manual';
  /** Confianza por campo (0-1) — clave = nombre del campo, valor = confianza */
  fieldConfidence?: Record<string, number>;
  /** Score global de calidad OCR (0-1) */
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
  /** Rich metadata from front-end scan pipeline */
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
  /** Additional captures for long tickets (header / body sections / footer) */
  capturasAdicionales?: {
    base64: string;
    mimeType: string;
    section: 'header' | 'body' | 'footer';
    ancho: number;
    alto: number;
  }[];
  /**
   * On-device ML Kit OCR result — used by backend as an additional OCR candidate.
   * Structured blocks allow the backend to align lines with price fields.
   */
  localOcr?: {
    rawText: string;
    score: number;
    blocks?: { text: string; lines: { text: string }[] }[];
  };
  /** Capture context metadata */
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

// ─── Category Config ────────────────────────────────────────
export const CATEGORY_CONFIG: Record<TicketCategoria, { icon: string; color: string; label: string }> = {
  alimentos:       { icon: '🍎', color: '#4CAF50', label: 'Alimentos' },
  farmacia:        { icon: '💊', color: '#F44336', label: 'Farmacia' },
  higiene:         { icon: '🧴', color: '#2196F3', label: 'Higiene' },
  hogar:           { icon: '🏠', color: '#FF9800', label: 'Hogar' },
  transporte:      { icon: '🚗', color: '#9C27B0', label: 'Transporte' },
  entretenimiento: { icon: '🎬', color: '#E91E63', label: 'Entretenimiento' },
  ropa:            { icon: '👕', color: '#00BCD4', label: 'Ropa' },
  educacion:       { icon: '📚', color: '#3F51B5', label: 'Educación' },
  servicios:       { icon: '⚡', color: '#607D8B', label: 'Servicios' },
  restaurante:     { icon: '🍽️', color: '#FF5722', label: 'Restaurante' },
  mascotas:        { icon: '🐾', color: '#795548', label: 'Mascotas' },
  tecnologia:      { icon: '📱', color: '#673AB7', label: 'Tecnología' },
  otros:           { icon: '📦', color: '#9E9E9E', label: 'Otros' },
};

// ─── Service ────────────────────────────────────────────────
class TicketScanService {
  private base = `${API_BASE_URL}/tickets`;

  /** POST /tickets/scan — send image + optional OCR text */
  async scan(data: TicketScanRequest): Promise<{ message: string; ticket: Ticket }> {
    console.log('[TicketScanService] scan() llamado, payload size ~', Math.round((data.imagenBase64?.length ?? 0) / 1024), 'KB');
    const res = await apiRateLimiter.fetch(this.base + '/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[TicketScanService] scan() error HTTP', res.status, body?.slice(0, 500));
      throw new Error(body || `Error ${res.status}`);
    }
    const json = await res.json();
    console.log('[TicketScanService] scan() respuesta keys:', Object.keys(json));
    console.log('[TicketScanService] scan() respuesta completa:', JSON.stringify(json).slice(0, 1200));

    // Normalizar: el backend puede devolver { ticket } o { data: ticket } o el ticket directamente
    let ticket: Ticket | undefined = json.ticket ?? json.data?.ticket ?? json.data;
    if (!ticket && json.ticketId) ticket = json as Ticket;
    if (!ticket) {
      console.warn('[TicketScanService] scan() no se encontró ticket en la respuesta:', JSON.stringify(json).slice(0, 800));
      throw new Error('El servidor no devolvió datos del ticket');
    }

    // Asegurar campos mínimos para que TicketReviewScreen no crashee
    ticket.items = Array.isArray(ticket.items) ? ticket.items : [];
    ticket.tienda = ticket.tienda ?? '';
    ticket.subtotal = ticket.subtotal ?? 0;
    ticket.impuestos = ticket.impuestos ?? 0;
    ticket.descuentos = ticket.descuentos ?? 0;
    ticket.propina = ticket.propina ?? 0;
    ticket.total = ticket.total ?? 0;
    ticket.moneda = ticket.moneda ?? 'MXN';
    ticket.estado = ticket.estado ?? 'review';
    ticket.confirmado = ticket.confirmado ?? false;
    ticket.hasImage = ticket.hasImage ?? true;
    ticket.resumenCategorias = ticket.resumenCategorias ?? {};
    ticket.fechaCompra = ticket.fechaCompra ?? ticket.createdAt ?? new Date().toISOString();
    ticket.createdAt = ticket.createdAt ?? new Date().toISOString();
    ticket.ticketId = ticket.ticketId ?? (ticket as any)._id ?? '';

    // Extraer campos de revisión devueltos por el backend
    ticket.reviewLevel = ticket.reviewLevel ?? json.reviewLevel ?? json.data?.reviewLevel;
    ticket.fieldConfidence = ticket.fieldConfidence ?? json.fieldConfidence ?? json.data?.fieldConfidence;
    ticket.ocrScore = ticket.ocrScore ?? json.ocrScore ?? json.data?.ocrScore;

    console.log('[TicketScanService] scan() ticket normalizado:', ticket.ticketId, 'tienda:', ticket.tienda, 'items:', ticket.items.length, 'total:', ticket.total, 'reviewLevel:', ticket.reviewLevel);
    return { message: json.message ?? 'Ticket procesado', ticket };
  }

  /** POST /tickets/manual — create without scanning */
  async createManual(data: TicketManualRequest): Promise<{ message: string; ticket: Ticket }> {
    console.log('[TicketScanService] createManual() llamado, tienda:', data.tienda, 'items:', data.items?.length);
    const res = await apiRateLimiter.fetch(this.base + '/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[TicketScanService] createManual() error HTTP', res.status, body?.slice(0, 500));
      throw new Error(body || `Error ${res.status}`);
    }
    const json = await res.json();
    console.log('[TicketScanService] createManual() respuesta keys:', Object.keys(json));

    let ticket: Ticket | undefined = json.ticket ?? json.data?.ticket ?? json.data;
    if (!ticket && json.ticketId) ticket = json as Ticket;
    if (!ticket) {
      console.warn('[TicketScanService] createManual() no se encontró ticket:', JSON.stringify(json).slice(0, 800));
      throw new Error('El servidor no devolvió datos del ticket');
    }

    ticket.items = Array.isArray(ticket.items) ? ticket.items : [];
    ticket.tienda = ticket.tienda ?? data.tienda ?? '';
    ticket.subtotal = ticket.subtotal ?? 0;
    ticket.impuestos = ticket.impuestos ?? 0;
    ticket.descuentos = ticket.descuentos ?? 0;
    ticket.propina = ticket.propina ?? 0;
    ticket.total = ticket.total ?? 0;
    ticket.moneda = ticket.moneda ?? 'MXN';
    ticket.estado = ticket.estado ?? 'review';
    ticket.confirmado = ticket.confirmado ?? false;
    ticket.hasImage = ticket.hasImage ?? false;
    ticket.resumenCategorias = ticket.resumenCategorias ?? {};
    ticket.fechaCompra = ticket.fechaCompra ?? ticket.createdAt ?? new Date().toISOString();
    ticket.createdAt = ticket.createdAt ?? new Date().toISOString();
    ticket.ticketId = ticket.ticketId ?? (ticket as any)._id ?? '';

    return { message: json.message ?? 'Ticket creado', ticket };
  }

  /** POST /tickets/:id/confirm — confirm and apply charge */
  async confirm(ticketId: string, edits?: TicketConfirmEdits): Promise<TicketConfirmResponse> {
    const res = await apiRateLimiter.fetch(`${this.base}/${encodeURIComponent(ticketId)}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edits ?? {}),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Error ${res.status}`);
    }
    return res.json();
  }

  /** POST /tickets/:id/liquidar — liquidate ticket into an account/subaccount */
  async liquidar(ticketId: string, payload: { monto: number; cuentaId?: string; subCuentaId?: string | null; concepto?: string }, idempotencyKey?: string): Promise<{ message: string; ticket: Ticket; transaccion?: { transaccionId: string; tipo: string; monto: number; moneda: string; concepto: string; motivo?: string; fecha?: string } }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await apiRateLimiter.fetch(`${this.base}/${encodeURIComponent(ticketId)}/liquidar`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload ?? {}),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Error ${res.status}`);
    }
    return res.json();
  }

  /** GET /tickets — list with filters */
  async list(params?: TicketListParams): Promise<TicketListResponse> {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.append(k, String(v));
      });
    }
    const url = `${this.base}${qs.toString() ? '?' + qs : ''}`;
    const res = await apiRateLimiter.fetch(url, { method: 'GET' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Error ${res.status}`);
    }
    return res.json();
  }

  /** GET /tickets/:id */
  async getDetail(ticketId: string, includeImage = false): Promise<Ticket> {
    const url = `${this.base}/${encodeURIComponent(ticketId)}${includeImage ? '?includeImage=true' : ''}`;
    const res = await apiRateLimiter.fetch(url, { method: 'GET' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Error ${res.status}`);
    }
    return res.json();
  }

  /** GET /tickets/:id/image */
  async getImage(ticketId: string): Promise<{ imagenBase64: string; mimeType: string }> {
    const url = `${this.base}/${encodeURIComponent(ticketId)}/image`;
    const res = await apiRateLimiter.fetch(url, { method: 'GET' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Error ${res.status}`);
    }
    return res.json();
  }

  /** DELETE /tickets/:id */
  async delete(ticketId: string): Promise<{ message: string }> {
    const res = await apiRateLimiter.fetch(`${this.base}/${encodeURIComponent(ticketId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Error ${res.status}`);
    }
    return res.json();
  }

  /** POST /tickets/:id/cancel */
  async cancel(ticketId: string): Promise<{ message: string; ticketId: string; transaccionIdAsociada: string | null }> {
    const res = await apiRateLimiter.fetch(`${this.base}/${encodeURIComponent(ticketId)}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Error ${res.status}`);
    }
    return res.json();
  }

  /** GET /tickets/evaluation — métricas de precisión OCR (admin) */
  async evaluation(params?: { desde?: string; hasta?: string }): Promise<EvaluationReport> {
    const qs = new URLSearchParams();
    if (params?.desde) qs.append('desde', params.desde);
    if (params?.hasta) qs.append('hasta', params.hasta);
    const url = `${this.base}/evaluation${qs.toString() ? '?' + qs : ''}`;
    const res = await apiRateLimiter.fetch(url, { method: 'GET' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Error ${res.status}`);
    }
    return res.json();
  }

  /** GET /tickets/analytics */
  async analytics(desde?: string, hasta?: string): Promise<TicketAnalytics> {
    const qs = new URLSearchParams();
    if (desde) qs.append('desde', desde);
    if (hasta) qs.append('hasta', hasta);
    const url = `${this.base}/analytics${qs.toString() ? '?' + qs : ''}`;
    const res = await apiRateLimiter.fetch(url, { method: 'GET' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Error ${res.status}`);
    }
    return res.json();
  }
}

export const ticketScanService = new TicketScanService();
