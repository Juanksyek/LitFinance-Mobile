export type {
  CreateCreditCardDto,
  CreditCard,
  CreditCardMovimientosResponse,
  CreditCardSaludResponse,
  RegisterMovimientoDto,
} from '../../../types/creditCards';

export type CreditCardMovimientosParams = {
  page?: number;
  limit?: number;
  desde?: string;
  hasta?: string;
};

