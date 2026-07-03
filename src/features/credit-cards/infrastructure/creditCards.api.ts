import { httpClient } from '../../../shared/api/api-client';
import type {
  CreateCreditCardDto,
  CreditCard,
  CreditCardMovimientosParams,
  CreditCardMovimientosResponse,
  CreditCardSaludResponse,
  RegisterMovimientoDto,
} from '../domain/creditCards.types';

const BASE_PATH = '/credit-cards';
const authenticatedOptions = { authenticated: true } as const;

function cardPath(cardId: string): string {
  return `${BASE_PATH}/${encodeURIComponent(cardId)}`;
}

export const creditCardsApi = {
  list(): Promise<CreditCard[]> {
    return httpClient.get(BASE_PATH, authenticatedOptions);
  },

  get(cardId: string): Promise<CreditCard> {
    return httpClient.get(cardPath(cardId), authenticatedOptions);
  },

  create(dto: CreateCreditCardDto): Promise<CreditCard> {
    return httpClient.post(BASE_PATH, dto, authenticatedOptions);
  },

  update(
    cardId: string,
    dto: Partial<CreateCreditCardDto>,
  ): Promise<CreditCard> {
    return httpClient.patch(cardPath(cardId), dto, authenticatedOptions);
  },

  delete(cardId: string): Promise<void> {
    return httpClient.delete(cardPath(cardId), authenticatedOptions);
  },

  registerMovimiento(
    cardId: string,
    dto: RegisterMovimientoDto,
  ): Promise<CreditCard> {
    return httpClient.post(
      `${cardPath(cardId)}/movimientos`,
      dto,
      authenticatedOptions,
    );
  },

  getMovimientos(
    cardId: string,
    params: CreditCardMovimientosParams = {},
  ): Promise<CreditCardMovimientosResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.desde) query.set('desde', params.desde);
    if (params.hasta) query.set('hasta', params.hasta);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return httpClient.get(
      `${cardPath(cardId)}/movimientos${suffix}`,
      authenticatedOptions,
    );
  },

  getSalud(cardId: string): Promise<CreditCardSaludResponse> {
    return httpClient.get(
      `${cardPath(cardId)}/salud`,
      authenticatedOptions,
    );
  },
};
