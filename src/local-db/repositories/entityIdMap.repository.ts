import { currentIso, liteLocalDb } from '../database';
import type { LiteSyncEntity } from '../types/sync.types';

export const entityIdMapRepository = {
  async set(clientEntityId: string, serverEntityId: string, entity: LiteSyncEntity): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      const existing = draft.entityIdMap.findIndex((item) => item.clientEntityId === clientEntityId);
      const next = { clientEntityId, serverEntityId, entity, createdAt: now };
      if (existing >= 0) draft.entityIdMap[existing] = next;
      else draft.entityIdMap.push(next);
    });
  },

  async getServerId(clientEntityId: string): Promise<string | null> {
    const state = await liteLocalDb.getState();
    return state.entityIdMap.find((item) => item.clientEntityId === clientEntityId)?.serverEntityId ?? null;
  },
};
