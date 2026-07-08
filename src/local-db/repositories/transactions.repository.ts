import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteTransaction, LiteTransactionType } from '../types/local-models';

export type CreateLiteTransactionInput = {
  type: LiteTransactionType;
  amount: number;
  currency: string;
  categoryId?: string | null;
  categoryName?: string | null;
  description?: string | null;
  date?: string;
  accountId?: string | null;
  subaccountId?: string | null;
};

export type UpdateLiteTransactionInput = {
  type?: LiteTransactionType;
  amount?: number;
  currency?: string;
  categoryId?: string | null;
  categoryName?: string | null;
  description?: string | null;
  date?: string;
  accountId?: string | null;
  subaccountId?: string | null;
};

function getSubaccountDelta(transaction: Pick<LiteTransaction, 'amount' | 'type'>): number {
  return transaction.type === 'income' ? transaction.amount : -transaction.amount;
}

export const transactionsRepository = {
  async createLocal(input: CreateLiteTransactionInput): Promise<LiteTransaction> {
    const now = currentIso();
    const transaction: LiteTransaction = {
      id: createLocalId('local_trx'),
      serverId: null,
      type: input.type,
      amount: Math.max(0, Number(input.amount) || 0),
      currency: input.currency || 'MXN',
      categoryId: input.categoryId ?? null,
      categoryName: input.categoryName ?? null,
      description: input.description ?? null,
      date: input.date ?? now,
      accountId: input.accountId ?? null,
      subaccountId: input.subaccountId ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.transactions.unshift(transaction);
      if (transaction.subaccountId) {
        draft.subaccounts = draft.subaccounts.map((subaccount) => {
          if (subaccount.id !== transaction.subaccountId) return subaccount;
          return {
            ...subaccount,
            balance: subaccount.balance + getSubaccountDelta(transaction),
            updatedAt: now,
          };
        });
      }
    });

    return transaction;
  },

  async listRecent(limit = 20): Promise<LiteTransaction[]> {
    const state = await liteLocalDb.getState();
    return state.transactions
      .filter((transaction) => !transaction.deletedAt)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  },

  async list(params?: {
    limit?: number;
    page?: number;
    search?: string;
    cuentaId?: string | null;
  }): Promise<{ items: LiteTransaction[]; total: number; page: number; limit: number; hasNextPage: boolean }> {
    const page = Math.max(1, Number(params?.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(100, Number(params?.limit ?? 20) || 20));
    const query = String(params?.search ?? '').trim().toLowerCase();
    const cuentaId = String(params?.cuentaId ?? '').trim();
    const state = await liteLocalDb.getState();
    const filtered = state.transactions
      .filter((transaction) => !transaction.deletedAt)
      .filter((transaction) => !cuentaId || !transaction.accountId || transaction.accountId === cuentaId)
      .filter((transaction) => {
        if (!query) return true;
        return [
          transaction.categoryName,
          transaction.description,
          transaction.currency,
          transaction.type,
        ].some((value) => String(value ?? '').toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const start = (page - 1) * limit;
    return {
      hasNextPage: start + limit < filtered.length,
      items: filtered.slice(start, start + limit),
      limit,
      page,
      total: filtered.length,
    };
  },

  async listByMonth(month: string): Promise<LiteTransaction[]> {
    const state = await liteLocalDb.getState();
    return state.transactions
      .filter((transaction) => !transaction.deletedAt)
      .filter((transaction) => transaction.date.slice(0, 7) === month)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async listBySubaccountId(
    subaccountId: string,
    params?: {
      desde?: string;
      hasta?: string;
      search?: string;
    },
  ): Promise<LiteTransaction[]> {
    const query = params?.search?.trim().toLowerCase();
    const state = await liteLocalDb.getState();
    const matchedSubaccount = state.subaccounts.find((subaccount) => subaccount.id === subaccountId || subaccount.serverId === subaccountId);
    const candidateIds = new Set([subaccountId, matchedSubaccount?.id, matchedSubaccount?.serverId].filter(Boolean));
    return state.transactions
      .filter((transaction) => !transaction.deletedAt)
      .filter((transaction) => Boolean(transaction.subaccountId && candidateIds.has(transaction.subaccountId)))
      .filter((transaction) => !params?.desde || transaction.date >= params.desde)
      .filter((transaction) => !params?.hasta || transaction.date <= params.hasta)
      .filter((transaction) => {
        if (!query) return true;
        return [
          transaction.categoryName,
          transaction.description,
          transaction.currency,
          transaction.type,
        ].some((value) => String(value ?? '').toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async findById(id: string): Promise<LiteTransaction | null> {
    const state = await liteLocalDb.getState();
    return state.transactions.find((transaction) => transaction.id === id) ?? null;
  },

  async findByLocalOrServerId(id: string): Promise<LiteTransaction | null> {
    const state = await liteLocalDb.getState();
    return (
      state.transactions.find(
        (transaction) => transaction.id === id || transaction.serverId === id,
      ) ?? null
    );
  },

  async updateLocal(id: string, input: UpdateLiteTransactionInput): Promise<LiteTransaction | null> {
    const now = currentIso();
    let nextTransaction: LiteTransaction | null = null;

    await liteLocalDb.update((draft) => {
      const previous = draft.transactions.find((transaction) => transaction.id === id && !transaction.deletedAt);
      if (!previous) return;

      nextTransaction = {
        ...previous,
        type: input.type ?? previous.type,
        amount:
          input.amount !== undefined
            ? Math.max(0, Number(input.amount) || 0)
            : previous.amount,
        currency: input.currency ?? previous.currency,
        categoryId: input.categoryId !== undefined ? input.categoryId : previous.categoryId,
        categoryName: input.categoryName !== undefined ? input.categoryName : previous.categoryName,
        description: input.description !== undefined ? input.description : previous.description,
        date: input.date ?? previous.date,
        accountId: input.accountId !== undefined ? input.accountId : previous.accountId,
        subaccountId: input.subaccountId !== undefined ? input.subaccountId : previous.subaccountId,
        syncStatus: 'pending',
        updatedAt: now,
      };

      draft.transactions = draft.transactions.map((transaction) =>
        transaction.id === id ? nextTransaction! : transaction,
      );

      draft.subaccounts = draft.subaccounts.map((subaccount) => {
        let balance = subaccount.balance;
        if (previous.subaccountId === subaccount.id) {
          balance -= getSubaccountDelta(previous);
        }
        if (nextTransaction?.subaccountId === subaccount.id) {
          balance += getSubaccountDelta(nextTransaction);
        }
        return balance === subaccount.balance ? subaccount : { ...subaccount, balance, updatedAt: now };
      });
    });

    return nextTransaction;
  },

  async deleteLocal(id: string): Promise<LiteTransaction | null> {
    const now = currentIso();
    let deletedTransaction: LiteTransaction | null = null;

    await liteLocalDb.update((draft) => {
      const previous = draft.transactions.find((transaction) => transaction.id === id && !transaction.deletedAt);
      if (!previous) return;

      deletedTransaction = {
        ...previous,
        deletedAt: now,
        syncStatus: 'pending',
        updatedAt: now,
      };

      draft.transactions = draft.transactions.map((transaction) =>
        transaction.id === id ? deletedTransaction! : transaction,
      );

      if (previous.subaccountId) {
        draft.subaccounts = draft.subaccounts.map((subaccount) =>
          subaccount.id === previous.subaccountId
            ? { ...subaccount, balance: subaccount.balance - getSubaccountDelta(previous), updatedAt: now }
            : subaccount,
        );
      }
    });

    return deletedTransaction;
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.transactions = draft.transactions.map((transaction) =>
        transaction.id === clientEntityId
          ? { ...transaction, serverId: serverId ?? transaction.serverId, syncStatus: 'synced', updatedAt: now }
          : transaction,
      );
    });
  },
};
