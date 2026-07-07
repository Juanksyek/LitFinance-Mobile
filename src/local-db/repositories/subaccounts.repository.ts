import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteSubaccount } from '../types/local-models';

export type CreateLiteSubaccountInput = {
  name: string;
  balance?: number;
  currency: string;
  isActive?: boolean;
};

export type UpdateLiteSubaccountInput = {
  name?: string;
  balance?: number;
  currency?: string;
  isActive?: boolean;
};

export const subaccountsRepository = {
  async createLocal(input: CreateLiteSubaccountInput): Promise<LiteSubaccount> {
    const now = currentIso();
    const subaccount: LiteSubaccount = {
      id: createLocalId('local_subaccount'),
      serverId: null,
      name: input.name.trim() || 'Subcuenta',
      balance: Math.max(0, Number(input.balance) || 0),
      currency: input.currency || 'MXN',
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.subaccounts.unshift(subaccount);
    });

    return subaccount;
  },

  async list(): Promise<LiteSubaccount[]> {
    const state = await liteLocalDb.getState();
    return state.subaccounts
      .filter((subaccount) => !subaccount.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async findByLocalOrServerId(id: string): Promise<LiteSubaccount | null> {
    const state = await liteLocalDb.getState();
    return state.subaccounts.find((subaccount) => subaccount.id === id || subaccount.serverId === id) ?? null;
  },

  async deleteLocal(id: string): Promise<LiteSubaccount | null> {
    const now = currentIso();
    let deletedSubaccount: LiteSubaccount | null = null;

    await liteLocalDb.update((draft) => {
      draft.subaccounts = draft.subaccounts.map((subaccount) => {
        if (subaccount.id !== id) return subaccount;
        deletedSubaccount = {
          ...subaccount,
          deletedAt: now,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return deletedSubaccount;
      });
    });

    return deletedSubaccount;
  },

  async updateLocal(id: string, input: UpdateLiteSubaccountInput): Promise<LiteSubaccount | null> {
    const now = currentIso();
    let nextSubaccount: LiteSubaccount | null = null;

    await liteLocalDb.update((draft) => {
      draft.subaccounts = draft.subaccounts.map((subaccount) => {
        if (subaccount.id !== id) return subaccount;
        nextSubaccount = {
          ...subaccount,
          name: input.name !== undefined ? input.name.trim() || subaccount.name : subaccount.name,
          balance:
            input.balance !== undefined
              ? Math.max(0, Number(input.balance) || 0)
              : subaccount.balance,
          currency: input.currency !== undefined ? input.currency || subaccount.currency : subaccount.currency,
          isActive: input.isActive !== undefined ? input.isActive : subaccount.isActive ?? true,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return nextSubaccount;
      });
    });

    return nextSubaccount;
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.subaccounts = draft.subaccounts.map((subaccount) =>
        subaccount.id === clientEntityId
          ? { ...subaccount, serverId: serverId ?? subaccount.serverId, syncStatus: 'synced', updatedAt: now }
          : subaccount,
      );
    });
  },
};
