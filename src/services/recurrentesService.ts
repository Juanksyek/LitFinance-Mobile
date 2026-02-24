import { API_BASE_URL } from '../constants/api';
import { apiRateLimiter } from './apiRateLimiter';

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

class RecurrentesService {
  /**
   * Obtener estadísticas de recurrentes con filtro de tiempo
   */
  async obtenerEstadisticas(filtro: FiltroEstadisticas = 'mes'): Promise<EstadisticasRecurrentes> {
    try {
      const response = await apiRateLimiter.fetch(
        `${API_BASE_URL}/recurrentes/historial/estadisticas?filtro=${filtro}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching estadísticas de recurrentes:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de un recurrente específico
   */
  async obtenerHistorialRecurrente(recurrenteId: string, page: number = 1, limit: number = 10) {
    try {
      const response = await apiRateLimiter.fetch(
        `${API_BASE_URL}/recurrentes/${recurrenteId}/historial?page=${page}&limit=${limit}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching historial de recurrente:', error);
      throw error;
    }
  }
}

export const recurrentesService = new RecurrentesService();
