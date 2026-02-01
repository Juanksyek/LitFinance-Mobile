
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/api';
import { apiRateLimiter } from './apiRateLimiter';

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
    moneda: string;
    simbolo: string;
    montoConvertido?: number;
    tasaConversion?: number;
    fechaConversion?: string;
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

export interface AnalisisTemporalNormalized {
  range?: string;
  points: Array<{ x: string; in: number; out: number }>;
  raw?: AnalisisTemporal;
}

export interface AnalyticsFilters {
  rangoTiempo?: 'dia' | 'semana' | 'mes' | '3meses' | '6meses' | 'año' | 'desdeSiempre' | 'personalizado';
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
  private async makeRequest<T>(endpoint: string, filters?: AnalyticsFilters, signal?: AbortSignal): Promise<T> {
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

    // Use global rate limiter which will attach Authorization automatically
    const res = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Error ${res.status}: ${body || res.statusText}`);
    }

    return res.json();
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

  async getAnalisisTemporal(filters?: AnalyticsFilters, signal?: AbortSignal): Promise<AnalisisTemporal> {
    return this.makeRequest<AnalisisTemporal>('/analisis-temporal', filters, signal);
  }

  /**
   * Nueva variante que normaliza la respuesta para el nuevo contrato { range, points }
   * Permite mantener compatibilidad con consumidores antiguos que usan `AnalisisTemporal`.
   */
  async getAnalisisTemporalNormalized(filters?: AnalyticsFilters, signal?: AbortSignal): Promise<AnalisisTemporalNormalized | AnalisisTemporal> {
    const res: any = await this.makeRequest<any>('/analisis-temporal', filters, signal);

    if (res && Array.isArray(res.points)) {
      return {
        range: res.range,
        points: res.points.map((p: any) => ({ x: String(p.x), in: Number(p.in || 0), out: Number(p.out || 0) })),
        raw: res,
      } as AnalisisTemporalNormalized;
    }

    if (res && Array.isArray(res.datos)) {
      const points = res.datos.map((d: any) => ({ x: String(d.fecha), in: Number(d.ingresos || 0), out: Number(d.gastos || 0) }));
      return { range: res.periodoAnalisis || undefined, points, raw: res } as AnalisisTemporalNormalized;
    }

    return res as AnalisisTemporal;
  }

  /**
   * FASE 5: Preview de balances en cualquier moneda
   * Obtiene todos los balances (cuenta principal + subcuentas) convertidos a la moneda especificada
   * Solo lectura - no modifica la base de datos
   */
  async getPreview(codigoMoneda: string): Promise<PreviewBalance> {
    const url = `${API_BASE_URL}/cuenta/preview/${codigoMoneda}`;
    const res = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Error ${res.status}: ${body || res.statusText}`);
    }

    return res.json();
  }
}

export interface PreviewBalance {
  monedaPreview: string;
  simbolo: string;
  cuentaPrincipal: {
    cantidad: number;
    monedaOriginal: string;
    tasaConversion: number;
  };
  subcuentas: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    monedaOriginal: string;
    tasaConversion: number;
    color: string;
    activa: boolean;
  }>;
  totalGeneral: number;
  tasasUtilizadas: Record<string, number>;
  timestamp: string;
}

export const analyticsService = new AnalyticsService();
// commit