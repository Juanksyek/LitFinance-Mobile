import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteSharedSpace, LiteSharedSpaceMovement } from '../types/local-models';

export type CreateLiteSharedSpaceInput = Omit<LiteSharedSpace, 'createdAt' | 'deletedAt' | 'id' | 'serverId' | 'syncStatus' | 'updatedAt'>;
export type UpdateLiteSharedSpaceInput = Partial<CreateLiteSharedSpaceInput>;
export type CreateLiteSharedSpaceMovementInput = Omit<LiteSharedSpaceMovement, 'createdAt' | 'deletedAt' | 'id' | 'serverId' | 'syncStatus' | 'updatedAt'>;
export type UpdateLiteSharedSpaceMovementInput = Partial<CreateLiteSharedSpaceMovementInput>;

export const sharedSpacesRepository = {
  async createLocal(input: CreateLiteSharedSpaceInput): Promise<LiteSharedSpace> {
    const now = currentIso();
    const space: LiteSharedSpace = {
      id: createLocalId('local_space'),
      serverId: null,
      ...input,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.sharedSpaces.unshift(space);
    });

    return space;
  },

  async list(): Promise<LiteSharedSpace[]> {
    const state = await liteLocalDb.getState();
    return state.sharedSpaces
      .filter((space) => !space.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async findByLocalOrServerId(id: string): Promise<LiteSharedSpace | null> {
    const state = await liteLocalDb.getState();
    return state.sharedSpaces.find((space) => space.id === id || space.serverId === id) ?? null;
  },

  async updateLocal(id: string, input: UpdateLiteSharedSpaceInput): Promise<LiteSharedSpace | null> {
    const now = currentIso();
    let updated: LiteSharedSpace | null = null;

    await liteLocalDb.update((draft) => {
      draft.sharedSpaces = draft.sharedSpaces.map((space) => {
        if (space.id !== id || space.deletedAt) return space;
        updated = { ...space, ...input, syncStatus: 'pending', updatedAt: now };
        return updated;
      });
    });

    return updated;
  },

  async archiveLocal(id: string): Promise<LiteSharedSpace | null> {
    return this.updateLocal(id, { status: 'archivado' });
  },

  async createMovement(spaceId: string, input: Omit<CreateLiteSharedSpaceMovementInput, 'spaceId'>): Promise<LiteSharedSpaceMovement | null> {
    const now = currentIso();
    let movement: LiteSharedSpaceMovement | null = null;

    await liteLocalDb.update((draft) => {
      const space = draft.sharedSpaces.find((item) => item.id === spaceId && !item.deletedAt);
      if (!space) return;

      movement = {
        id: createLocalId('local_shared_mov'),
        serverId: null,
        spaceId,
        ...input,
        totalAmount: Math.max(0, Number(input.totalAmount) || 0),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending',
      };

      draft.sharedSpaceMovements.unshift(movement);
      draft.sharedSpaces = draft.sharedSpaces.map((item) =>
        item.id === spaceId ? { ...item, updatedAt: now, syncStatus: 'pending' } : item,
      );
    });

    return movement;
  },

  async listMovements(spaceId: string): Promise<LiteSharedSpaceMovement[]> {
    const state = await liteLocalDb.getState();
    return state.sharedSpaceMovements
      .filter((movement) => movement.spaceId === spaceId && !movement.deletedAt)
      .sort((a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime());
  },

  async findMovementByLocalOrServerId(id: string): Promise<LiteSharedSpaceMovement | null> {
    const state = await liteLocalDb.getState();
    return state.sharedSpaceMovements.find((movement) => movement.id === id || movement.serverId === id) ?? null;
  },

  async updateMovementLocal(id: string, input: UpdateLiteSharedSpaceMovementInput): Promise<LiteSharedSpaceMovement | null> {
    const now = currentIso();
    let updated: LiteSharedSpaceMovement | null = null;

    await liteLocalDb.update((draft) => {
      draft.sharedSpaceMovements = draft.sharedSpaceMovements.map((movement) => {
        if (movement.id !== id || movement.deletedAt) return movement;
        updated = { ...movement, ...input, syncStatus: 'pending', updatedAt: now };
        return updated;
      });
    });

    return updated;
  },

  async markMovementCancelled(id: string): Promise<LiteSharedSpaceMovement | null> {
    return this.updateMovementLocal(id, { status: 'cancelled' });
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.sharedSpaces = draft.sharedSpaces.map((space) =>
        space.id === clientEntityId
          ? { ...space, serverId: serverId ?? space.serverId, syncStatus: 'synced', updatedAt: now }
          : space,
      );
      draft.sharedSpaceMovements = draft.sharedSpaceMovements.map((movement) =>
        movement.id === clientEntityId
          ? { ...movement, serverId: serverId ?? movement.serverId, syncStatus: 'synced', updatedAt: now }
          : movement,
      );
    });
  },
};
