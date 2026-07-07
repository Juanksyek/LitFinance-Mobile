export type ReportFormat = 'pdf' | 'xlsx';
export type ReportRango =
  | 'dia'
  | 'semana'
  | 'mes'
  | '3meses'
  | '6meses'
  | 'a\u00F1o';

export type ReportExportResponse = {
  filename: string;
  mimeType: string;
  base64: string;
  sizeBytes: number;
  generatedAt: string;
  meta?: {
    format?: ReportFormat;
    incluirMovimientos?: boolean;
    limiteMovimientos?: number;
    movimientosTotal?: number;
    topN?: number;
    moneda?: string;
    periodo?: {
      fechaInicio?: string;
      fechaFin?: string;
      descripcion?: string;
    };
  };
};

export type ReportExportParams = {
  format?: ReportFormat;
  rango?: ReportRango;
  fechaInicio?: string;
  fechaFin?: string;
  monedaBase?: string;
  limiteMovimientos?: number;
  topN?: number;
  incluirMovimientos?: boolean;
};

