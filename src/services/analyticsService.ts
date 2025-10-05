
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';

export interface ResumenFinanciero {
  ingresos: number;
  gastos: number;
  totalIngresado: {
    monto: number;
    moneda: string;
    expenses: number;
    gastos: number;
    desglosePorMoneda: Array<{
      moneda: string;
      monto: number;
      simbolo: string;
    }>;
  };
  totalGastado: {
    monto: number;
    moneda: string;
    desglosePorMoneda: Array<{
      moneda: string;
      monto: number;
      simbolo: string;
    }>;
  };
  balance: {
    monto: number;
    moneda: string;
    esPositivo: boolean;
  };
  totalEnSubcuentas: {
    monto: number;
    moneda: string;
    desglosePorSubcuenta: Array<{
      subcuentaId: string;
      nombre: string;
      monto: number;
      moneda: string;
      simbolo: string;
      activa: boolean;
    }>;
  };
  totalMovimientos: number;
  periodo: {
    fechaInicio: string;
    fechaFin: string;
    descripcion: string;
  };
}

export interface EstadisticaConcepto {
  concepto: {
    id: string;
    nombre: string;
    color: string;
    icono: string;
  };
  totalIngreso: number;
  totalGasto: number;
  cantidadMovimientos: number;
  montoPromedio: number;
  ultimoMovimiento: string;
  participacionPorcentual: number;
}

export interface EstadisticaSubcuenta {
  subcuenta: {
    id: string;
    nombre: string;
    color: string;
    moneda: string;
    simbolo: string;
    activa: boolean;
  };
  saldoActual: number;
  totalIngresos: number;
  totalEgresos: number;
  cantidadMovimientos: number;
  ultimoMovimiento: string;
  crecimientoMensual: number;
}

export interface EstadisticaRecurrente {
  recurrente: {
    id: string;
    nombre: string;
    plataforma: {
      nombre: string;
      color: string;
      categoria: string;
    };
    frecuencia: string;
  };
  montoMensual: number;
  totalEjecutado: number;
  ultimaEjecucion: string;
  proximaEjecucion: string;
  estadoActual: string;
  cantidadEjecuciones: number;
}

export interface AnalisisTemporal {
  periodoAnalisis: string;
  datos: Array<{
    fecha: string;
    ingresos: number;
    gastos: number;
    balance: number;
    cantidadMovimientos: number;
  }>;
  tendencias: {
    ingresosTendencia: string;
    gastosTendencia: string;
    balanceTendencia: string;
  };
  promedios: {
    ingresoPromedio: number;
    gastoPromedio: number;
    balancePromedio: number;
  };
}

export interface AnalyticsFilters {
  rangoTiempo?: 'dia' | 'semana' | 'mes' | '3meses' | '6meses' | 'año' | 'personalizado';
  fechaInicio?: string;
  fechaFin?: string;
  subcuentas?: string[];
  conceptos?: string[];
  monedas?: string[];
  cuentas?: string[];
  incluirRecurrentes?: boolean;
  soloTransaccionesManuales?: boolean;
  tipoTransaccion?: 'ingreso' | 'egreso' | 'ambos';
  monedaBase?: string;
  incluirSubcuentasInactivas?: boolean;
  montoMinimo?: number;
  montoMaximo?: number;
}

class AnalyticsService {
  private async makeRequest<T>(endpoint: string, filters?: AnalyticsFilters): Promise<T> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(`${key}[]`, v));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const url = `${API_BASE_URL}/analytics${endpoint}${params.toString() ? `?${params}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

    private async getToken(): Promise<string> {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        throw new Error("No se encontró un token válido en AsyncStorage");
      }
      return token;
    }

  async getResumenFinanciero(filters?: AnalyticsFilters): Promise<ResumenFinanciero> {
    return this.makeRequest<ResumenFinanciero>('/resumen-financiero', filters);
  }

  async getEstadisticasPorConcepto(filters?: AnalyticsFilters): Promise<EstadisticaConcepto[]> {
    return this.makeRequest<EstadisticaConcepto[]>('/por-concepto', filters);
  }

  async getEstadisticasPorSubcuenta(filters?: AnalyticsFilters): Promise<EstadisticaSubcuenta[]> {
    return this.makeRequest<EstadisticaSubcuenta[]>('/por-subcuenta', filters);
  }

  async getEstadisticasPorRecurrente(filters?: AnalyticsFilters): Promise<EstadisticaRecurrente[]> {
    return this.makeRequest<EstadisticaRecurrente[]>('/por-recurrente', filters);
  }

  async getAnalisisTemporal(filters?: AnalyticsFilters): Promise<AnalisisTemporal> {
    return this.makeRequest<AnalisisTemporal>('/analisis-temporal', filters);
  }
}

export const analyticsService = new AnalyticsService();
