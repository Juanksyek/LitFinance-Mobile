import { apiRateLimiter } from './apiRateLimiter';
import { API_BASE_URL } from '../constants/api';
import type {
  CreditCard,
  CreditCardMovimientosResponse,
  CreditCardSaludResponse,
  CreateCreditCardDto,
  RegisterMovimientoDto,
} from '../types/creditCards';

class CreditCardService {
  private baseUrl = `${API_BASE_URL}/credit-cards`;

  async listCards(): Promise<CreditCard[]> {
    const res = await apiRateLimiter.fetch(this.baseUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async getCard(cardId: string): Promise<CreditCard> {
    const res = await apiRateLimiter.fetch(`${this.baseUrl}/${cardId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }

  async createCard(dto: CreateCreditCardDto): Promise<CreditCard> {
    const res = await apiRateLimiter.fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.status === 403) throw { code: 'PLAN_LIMIT', message: 'Límite de tarjetas alcanzado. Actualiza tu plan.' };
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Error ${res.status}`);
    }
    return res.json();
  }

  async updateCard(cardId: string, dto: Partial<CreateCreditCardDto>): Promise<CreditCard> {
    const res = await apiRateLimiter.fetch(`${this.baseUrl}/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `Error ${res.status}`);
    }
    return res.json();
  }

  async deleteCard(cardId: string): Promise<void> {
    const res = await apiRateLimiter.fetch(`${this.baseUrl}/${cardId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
  }

  async registerMovimiento(cardId: string, dto: RegisterMovimientoDto): Promise<CreditCard> {
    const res = await apiRateLimiter.fetch(`${this.baseUrl}/${cardId}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.status === 400) {
      const err = await res.json().catch(() => ({}));
      throw { code: 'VALIDATION', message: err?.message || 'Cargo excede límite disponible' };
    }
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }

  async getMovimientos(
    cardId: string,
    opts: { page?: number; limit?: number; desde?: string; hasta?: string } = {}
  ): Promise<CreditCardMovimientosResponse> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.desde) params.set('desde', opts.desde);
    if (opts.hasta) params.set('hasta', opts.hasta);
    const url = `${this.baseUrl}/${cardId}/movimientos?${params.toString()}`;
    const res = await apiRateLimiter.fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }

  async getSalud(cardId: string): Promise<CreditCardSaludResponse> {
    const res = await apiRateLimiter.fetch(`${this.baseUrl}/${cardId}/salud`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.json();
  }
}

export const creditCardService = new CreditCardService();
