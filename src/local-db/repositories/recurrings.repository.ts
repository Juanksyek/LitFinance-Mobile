import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteRecurring } from '../types/local-models';

export type CreateLiteRecurringInput = Omit<LiteRecurring, 'createdAt' | 'deletedAt' | 'id' | 'serverId' | 'syncStatus' | 'updatedAt'>;
export type UpdateLiteRecurringInput = Partial<CreateLiteRecurringInput>;

export const recurringsRepository = {
  async createLocal(input: CreateLiteRecurringInput): Promise<LiteRecurring> {
    const now = currentIso();
    const recurring: LiteRecurring = {
      id: createLocalId('local_recurring'),
      serverId: null,
      name: input.name.trim() || 'Recurrente',
      amount: Math.max(0, Number(input.amount) || 0),
      currency: input.currency || 'MXN',
      frequencyType: input.frequencyType || 'mensual',
      frequencyValue: input.frequencyValue || '1',
      platform: input.platform ?? null,
      accountId: input.accountId ?? null,
      subaccountId: input.subaccountId ?? null,
      userId: input.userId ?? null,
      affectsMainAccount: input.affectsMainAccount ?? true,
      affectsSubaccount: input.affectsSubaccount ?? false,
      reminders: input.reminders ?? [],
      status: input.status || 'activo',
      recurringType: input.recurringType ?? null,
      totalPayments: input.totalPayments ?? null,
      paymentsMade: input.paymentsMade ?? 0,
      nextRunAt: input.nextRunAt ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.recurrings.unshift(recurring);
    });

    return recurring;
  },

  async findByLocalOrServerId(id: string): Promise<LiteRecurring | null> {
    const state = await liteLocalDb.getState();
    return state.recurrings.find((recurring) => recurring.id === id || recurring.serverId === id) ?? null;
  },

  async listBySubaccountId(subaccountId: string): Promise<LiteRecurring[]> {
    const state = await liteLocalDb.getState();
    const localSubaccountId = state.subaccounts.find((subaccount) => subaccount.serverId === subaccountId)?.id;
    return state.recurrings
      .filter((recurring) => !recurring.deletedAt)
      .filter((recurring) => recurring.subaccountId === subaccountId || recurring.subaccountId === localSubaccountId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async listAll(): Promise<LiteRecurring[]> {
    const state = await liteLocalDb.getState();
    return state.recurrings
      .filter((recurring) => !recurring.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async updateLocal(id: string, input: UpdateLiteRecurringInput): Promise<LiteRecurring | null> {
    const now = currentIso();
    let nextRecurring: LiteRecurring | null = null;

    await liteLocalDb.update((draft) => {
      draft.recurrings = draft.recurrings.map((recurring) => {
        if (recurring.id !== id || recurring.deletedAt) return recurring;
        nextRecurring = {
          ...recurring,
          ...input,
          amount: input.amount !== undefined ? Math.max(0, Number(input.amount) || 0) : recurring.amount,
          name: input.name !== undefined ? input.name.trim() || recurring.name : recurring.name,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return nextRecurring;
      });
    });

    return nextRecurring;
  },

  async deleteLocal(id: string): Promise<LiteRecurring | null> {
    const now = currentIso();
    let deletedRecurring: LiteRecurring | null = null;

    await liteLocalDb.update((draft) => {
      draft.recurrings = draft.recurrings.map((recurring) => {
        if (recurring.id !== id || recurring.deletedAt) return recurring;
        deletedRecurring = {
          ...recurring,
          deletedAt: now,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return deletedRecurring;
      });
    });

    return deletedRecurring;
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.recurrings = draft.recurrings.map((recurring) =>
        recurring.id === clientEntityId
          ? { ...recurring, serverId: serverId ?? recurring.serverId, syncStatus: 'synced', updatedAt: now }
          : recurring,
      );
    });
  },
};
