export interface EstadisticasRecurrentes {
  totalCobrado: number;
  cantidadEjecuciones: number;
  porRecurrente: Array<{
    nombre: string;
    total: number;
    cantidad: number;
    plataforma?: string;
    moneda?: string;
  }>;
  periodo: {
    inicio: string;
    fin: string;
  };
}

export type FiltroEstadisticas = 'año' | 'mes' | 'quincena' | 'semana';

export type HistorialRecurrenteParams = {
  recurrenteId: string;
  page?: number;
  limit?: number;
};

