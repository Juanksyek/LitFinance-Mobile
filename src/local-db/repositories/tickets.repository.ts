import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteTicket } from '../types/local-models';

export type CreateLiteTicketInput = Omit<LiteTicket, 'createdAt' | 'deletedAt' | 'id' | 'serverId' | 'syncStatus' | 'updatedAt'>;
export type UpdateLiteTicketInput = Partial<CreateLiteTicketInput>;

export const ticketsRepository = {
  async createLocal(input: CreateLiteTicketInput): Promise<LiteTicket> {
    const now = currentIso();
    const ticket: LiteTicket = {
      id: createLocalId('local_ticket'),
      serverId: null,
      ...input,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.tickets.unshift(ticket);
    });

    return ticket;
  },

  async findByLocalOrServerId(id: string): Promise<LiteTicket | null> {
    const state = await liteLocalDb.getState();
    return state.tickets.find((ticket) => ticket.id === id || ticket.serverId === id) ?? null;
  },

  async list(params?: { estado?: string; page?: number; limit?: number }): Promise<{ items: LiteTicket[]; total: number; page: number; limit: number }> {
    const state = await liteLocalDb.getState();
    const page = Math.max(1, Number(params?.page ?? 1) || 1);
    const limit = Math.max(1, Number(params?.limit ?? 15) || 15);
    const filtered = state.tickets
      .filter((ticket) => !ticket.deletedAt)
      .filter((ticket) => !params?.estado || ticket.status === params.estado)
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      limit,
      page,
      total: filtered.length,
    };
  },

  async updateLocal(id: string, input: UpdateLiteTicketInput): Promise<LiteTicket | null> {
    const now = currentIso();
    let nextTicket: LiteTicket | null = null;

    await liteLocalDb.update((draft) => {
      draft.tickets = draft.tickets.map((ticket) => {
        if (ticket.id !== id || ticket.deletedAt) return ticket;
        nextTicket = {
          ...ticket,
          ...input,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return nextTicket;
      });
    });

    return nextTicket;
  },

  async deleteLocal(id: string): Promise<LiteTicket | null> {
    const now = currentIso();
    let deletedTicket: LiteTicket | null = null;

    await liteLocalDb.update((draft) => {
      draft.tickets = draft.tickets.map((ticket) => {
        if (ticket.id !== id || ticket.deletedAt) return ticket;
        deletedTicket = { ...ticket, deletedAt: now, syncStatus: 'pending', updatedAt: now };
        return deletedTicket;
      });
    });

    return deletedTicket;
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.tickets = draft.tickets.map((ticket) =>
        ticket.id === clientEntityId
          ? { ...ticket, serverId: serverId ?? ticket.serverId, syncStatus: 'synced', updatedAt: now }
          : ticket,
      );
    });
  },
};
