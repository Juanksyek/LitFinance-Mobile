import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteGoal } from '../types/local-models';

export type CreateLiteGoalInput = {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  currency: string;
  targetDate?: string | null;
  status?: string;
};

export type UpdateLiteGoalInput = {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string | null;
  status?: string;
};

export const goalsRepository = {
  async createLocal(input: CreateLiteGoalInput): Promise<LiteGoal> {
    const now = currentIso();
    const goal: LiteGoal = {
      id: createLocalId('local_goal'),
      serverId: null,
      name: input.name.trim() || 'Meta',
      targetAmount: Math.max(0, Number(input.targetAmount) || 0),
      currentAmount: Math.max(0, Number(input.currentAmount) || 0),
      currency: input.currency || 'MXN',
      targetDate: input.targetDate ?? null,
      status: input.status ?? 'activa',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.goals.unshift(goal);
    });

    return goal;
  },

  async list(): Promise<LiteGoal[]> {
    const state = await liteLocalDb.getState();
    return state.goals
      .filter((goal) => !goal.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async findById(id: string): Promise<LiteGoal | null> {
    const state = await liteLocalDb.getState();
    return state.goals.find((goal) => goal.id === id) ?? null;
  },

  async findByLocalOrServerId(id: string): Promise<LiteGoal | null> {
    const state = await liteLocalDb.getState();
    return state.goals.find((goal) => goal.id === id || goal.serverId === id) ?? null;
  },

  async updateProgress(id: string, currentAmount: number): Promise<LiteGoal | null> {
    const now = currentIso();
    let nextGoal: LiteGoal | null = null;

    await liteLocalDb.update((draft) => {
      draft.goals = draft.goals.map((goal) => {
        if (goal.id !== id) return goal;
        nextGoal = {
          ...goal,
          currentAmount: Math.max(0, Number(currentAmount) || 0),
          syncStatus: 'pending',
          updatedAt: now,
        };
        return nextGoal;
      });
    });

    return nextGoal;
  },

  async updateLocal(id: string, input: UpdateLiteGoalInput): Promise<LiteGoal | null> {
    const now = currentIso();
    let nextGoal: LiteGoal | null = null;

    await liteLocalDb.update((draft) => {
      draft.goals = draft.goals.map((goal) => {
        if (goal.id !== id) return goal;
        nextGoal = {
          ...goal,
          name: input.name !== undefined ? input.name.trim() || goal.name : goal.name,
          targetAmount:
            input.targetAmount !== undefined
              ? Math.max(0, Number(input.targetAmount) || 0)
              : goal.targetAmount,
          currentAmount:
            input.currentAmount !== undefined
              ? Math.max(0, Number(input.currentAmount) || 0)
              : goal.currentAmount,
          targetDate: input.targetDate !== undefined ? input.targetDate : goal.targetDate,
          status: input.status !== undefined ? input.status : goal.status ?? 'activa',
          syncStatus: 'pending',
          updatedAt: now,
        };
        return nextGoal;
      });
    });

    return nextGoal;
  },

  async deleteLocal(id: string): Promise<LiteGoal | null> {
    const now = currentIso();
    let deletedGoal: LiteGoal | null = null;

    await liteLocalDb.update((draft) => {
      draft.goals = draft.goals.map((goal) => {
        if (goal.id !== id) return goal;
        deletedGoal = {
          ...goal,
          deletedAt: now,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return deletedGoal;
      });
    });

    return deletedGoal;
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.goals = draft.goals.map((goal) =>
        goal.id === clientEntityId
          ? { ...goal, serverId: serverId ?? goal.serverId, syncStatus: 'synced', updatedAt: now }
          : goal,
      );
    });
  },
};
