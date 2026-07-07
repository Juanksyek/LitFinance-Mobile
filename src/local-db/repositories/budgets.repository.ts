import { currentIso, liteLocalDb } from '../database';
import type { LiteBudget } from '../types/local-models';

export type UpsertLiteBudgetInput = {
  month: string;
  incomePlanned: number;
  savingsTarget: number;
  spendingLimit: number;
  currency: string;
};

export const budgetsRepository = {
  async getCurrent(month = new Date().toISOString().slice(0, 7)): Promise<LiteBudget | null> {
    const state = await liteLocalDb.getState();
    return state.budgets.find((budget) => budget.month === month && !budget.deletedAt) ?? null;
  },

  async upsertCurrent(input: UpsertLiteBudgetInput): Promise<LiteBudget> {
    const now = currentIso();
    const id = `local_budget_${input.month.replace('-', '_')}`;
    const state = await liteLocalDb.getState();
    const existing = state.budgets.find((budget) => budget.id === id);
    const nextBudget: LiteBudget = {
      id,
      serverId: existing?.serverId ?? null,
      month: input.month,
      incomePlanned: Math.max(0, Number(input.incomePlanned) || 0),
      savingsTarget: Math.max(0, Number(input.savingsTarget) || 0),
      spendingLimit: Math.max(0, Number(input.spendingLimit) || 0),
      currency: input.currency || 'MXN',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      const existingIndex = draft.budgets.findIndex((budget) => budget.id === id);
      if (existingIndex >= 0) draft.budgets[existingIndex] = nextBudget;
      else draft.budgets.push(nextBudget);
    });

    return nextBudget;
  },

  async deleteCurrent(month = new Date().toISOString().slice(0, 7)): Promise<LiteBudget | null> {
    const now = currentIso();
    let deletedBudget: LiteBudget | null = null;

    await liteLocalDb.update((draft) => {
      draft.budgets = draft.budgets.map((budget) => {
        if (budget.month !== month || budget.deletedAt) return budget;
        deletedBudget = {
          ...budget,
          deletedAt: now,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return deletedBudget;
      });
    });

    return deletedBudget;
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.budgets = draft.budgets.map((budget) =>
        budget.id === clientEntityId
          ? { ...budget, serverId: serverId ?? budget.serverId, syncStatus: 'synced', updatedAt: now }
          : budget,
      );
    });
  },
};
