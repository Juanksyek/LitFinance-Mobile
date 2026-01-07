import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';

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
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(
        `${API_BASE_URL}/recurrentes/historial/estadisticas?filtro=${filtro}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          await AsyncStorage.removeItem('authToken');
          throw new Error('Session expired');
        }
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
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(
        `${API_BASE_URL}/recurrentes/${recurrenteId}/historial?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          await AsyncStorage.removeItem('authToken');
          throw new Error('Session expired');
        }
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
