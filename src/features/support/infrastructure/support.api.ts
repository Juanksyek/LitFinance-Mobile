import { httpClient } from '../../../shared/api/api-client';
import { sanitizeObjectStrings } from '../../../utils/fixMojibake';
import type {
  AddMessageRequest,
  CreateTicketRequest,
  DeleteTicketResponse,
  Ticket,
  TicketStatistics,
  UpdateStatusRequest,
  UpdateTicketRequest,
} from '../domain/support.types';

const BASE_PATH = '/support-tickets';
const authenticatedOptions = { authenticated: true } as const;

function ticketPath(ticketId: string): string {
  return `${BASE_PATH}/${encodeURIComponent(ticketId)}`;
}

function sanitize<T>(value: T): T {
  return sanitizeObjectStrings(value) as T;
}

export const supportApi = {
  async create(data: CreateTicketRequest): Promise<Ticket> {
    return sanitize(await httpClient.post<Ticket>(
      BASE_PATH,
      data,
      authenticatedOptions,
    ));
  },

  async listMine(): Promise<Ticket[]> {
    return sanitize(await httpClient.get<Ticket[]>(BASE_PATH, {
      authenticated: true,
      skipCache: true,
    }));
  },

  async getDetail(ticketId: string): Promise<Ticket> {
    return sanitize(await httpClient.get<Ticket>(ticketPath(ticketId), {
      authenticated: true,
      skipCache: true,
    }));
  },

  async addMessage(
    ticketId: string,
    data: AddMessageRequest,
  ): Promise<Ticket> {
    return sanitize(await httpClient.post<Ticket>(
      `${ticketPath(ticketId)}/messages`,
      data,
      authenticatedOptions,
    ));
  },

  async update(
    ticketId: string,
    data: UpdateTicketRequest,
  ): Promise<Ticket> {
    return sanitize(await httpClient.put<Ticket>(
      ticketPath(ticketId),
      data,
      authenticatedOptions,
    ));
  },

  async delete(ticketId: string): Promise<DeleteTicketResponse> {
    return sanitize(await httpClient.delete<DeleteTicketResponse>(
      ticketPath(ticketId),
      authenticatedOptions,
    ));
  },

  async updateStatus(
    ticketId: string,
    data: UpdateStatusRequest,
  ): Promise<Ticket> {
    return sanitize(await httpClient.put<Ticket>(
      `${ticketPath(ticketId)}/status`,
      data,
      authenticatedOptions,
    ));
  },

  async getStatistics(): Promise<TicketStatistics> {
    return sanitize(await httpClient.get<TicketStatistics>(
      `${BASE_PATH}/statistics`,
      authenticatedOptions,
    ));
  },
};
