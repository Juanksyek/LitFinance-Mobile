import { httpClient } from '../../../shared/api/api-client';
import type {
  EvaluationReport,
  Ticket,
  TicketAnalytics,
  TicketConfirmEdits,
  TicketConfirmResponse,
  TicketLiquidationResponse,
  TicketListParams,
  TicketManualRequest,
  TicketScanRequest,
} from '../domain/tickets.types';

const BASE_PATH = '/tickets';
const authenticated = { authenticated: true } as const;

function ticketPath(ticketId: string): string {
  return `${BASE_PATH}/${encodeURIComponent(ticketId)}`;
}

function buildQuery(
  params?: Record<string, string | number | undefined>,
): string {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export const ticketsApi = {
  scan(data: TicketScanRequest): Promise<unknown> {
    return httpClient.post(`${BASE_PATH}/scan`, data, authenticated);
  },

  createManual(data: TicketManualRequest): Promise<unknown> {
    return httpClient.post(`${BASE_PATH}/manual`, data, authenticated);
  },

  confirm(
    ticketId: string,
    edits?: TicketConfirmEdits,
  ): Promise<TicketConfirmResponse> {
    return httpClient.post(
      `${ticketPath(ticketId)}/confirm`,
      edits ?? {},
      authenticated,
    );
  },

  liquidar(
    ticketId: string,
    payload: {
      monto: number;
      cuentaId?: string;
      subCuentaId?: string | null;
      concepto?: string;
    },
    idempotencyKey?: string,
  ): Promise<TicketLiquidationResponse> {
    return httpClient.post(
      `${ticketPath(ticketId)}/liquidar`,
      payload,
      {
        authenticated: true,
        headers: idempotencyKey
          ? { 'Idempotency-Key': idempotencyKey }
          : undefined,
      },
    );
  },

  list(params?: TicketListParams): Promise<unknown> {
    return httpClient.get(
      `${BASE_PATH}${buildQuery(params as Record<string, string | number | undefined>)}`,
      authenticated,
    );
  },

  getDetail(ticketId: string, includeImage: boolean): Promise<unknown> {
    return httpClient.get(
      `${ticketPath(ticketId)}${includeImage ? '?includeImage=true' : ''}`,
      authenticated,
    );
  },

  getImage(ticketId: string): Promise<unknown> {
    return httpClient.get(`${ticketPath(ticketId)}/image`, authenticated);
  },

  delete(ticketId: string): Promise<{ message: string }> {
    return httpClient.delete(ticketPath(ticketId), authenticated);
  },

  cancel(
    ticketId: string,
  ): Promise<{
    message: string;
    ticketId: string;
    transaccionIdAsociada: string | null;
  }> {
    return httpClient.post(
      `${ticketPath(ticketId)}/cancel`,
      undefined,
      authenticated,
    );
  },

  evaluation(params?: {
    desde?: string;
    hasta?: string;
  }): Promise<EvaluationReport> {
    return httpClient.get(
      `${BASE_PATH}/evaluation${buildQuery(params)}`,
      authenticated,
    );
  },

  analytics(desde?: string, hasta?: string): Promise<TicketAnalytics> {
    return httpClient.get(
      `${BASE_PATH}/analytics${buildQuery({ desde, hasta })}`,
      authenticated,
    );
  },
};
