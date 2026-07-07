import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteGoalMovement } from '../types/local-models';

export type CreateLiteGoalMovementInput = {
  goalId: string;
  type: LiteGoalMovement['type'];
  amount: number;
  currency: string;
  description?: string | null;
};

export const goalMovementsRepository = {
  async createLocal(input: CreateLiteGoalMovementInput): Promise<LiteGoalMovement> {
    const movement: LiteGoalMovement = {
      id: createLocalId('local_goal_mov'),
      goalId: input.goalId,
      type: input.type,
      amount: Math.max(0, Number(input.amount) || 0),
      currency: input.currency || 'MXN',
      description: input.description ?? null,
      createdAt: currentIso(),
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.goalMovements.unshift(movement);
    });

    return movement;
  },

  async listByGoalId(goalId: string, limit = 20): Promise<LiteGoalMovement[]> {
    const state = await liteLocalDb.getState();
    return state.goalMovements
      .filter((movement) => movement.goalId === goalId && !movement.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  },
};
