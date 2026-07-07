import { liteLocalDb } from '../database';

export const syncStateRepository = {
  async get(key: string): Promise<string | null> {
    const state = await liteLocalDb.getState();
    return state.syncState[key] ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    await liteLocalDb.update((draft) => {
      draft.syncState[key] = value;
    });
  },
};
