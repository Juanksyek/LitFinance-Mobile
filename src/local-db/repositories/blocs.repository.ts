import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteBloc, LiteBlocItem } from '../types/local-models';

export type CreateLiteBlocInput = Omit<LiteBloc, 'createdAt' | 'deletedAt' | 'id' | 'serverId' | 'syncStatus' | 'updatedAt'>;
export type UpdateLiteBlocInput = Partial<CreateLiteBlocInput>;
export type CreateLiteBlocItemInput = Omit<LiteBlocItem, 'createdAt' | 'deletedAt' | 'id' | 'serverId' | 'syncStatus' | 'updatedAt'>;
export type UpdateLiteBlocItemInput = Partial<Omit<CreateLiteBlocItemInput, 'blocId'>>;

export const blocsRepository = {
  async createLocal(input: CreateLiteBlocInput): Promise<LiteBloc> {
    const now = currentIso();
    const bloc: LiteBloc = {
      id: createLocalId('local_bloc'),
      serverId: null,
      ...input,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.blocs.unshift(bloc);
    });

    return bloc;
  },

  async list(): Promise<LiteBloc[]> {
    const state = await liteLocalDb.getState();
    return state.blocs
      .filter((bloc) => !bloc.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async findByLocalOrServerId(id: string): Promise<LiteBloc | null> {
    const state = await liteLocalDb.getState();
    return state.blocs.find((bloc) => bloc.id === id || bloc.serverId === id) ?? null;
  },

  async updateLocal(id: string, input: UpdateLiteBlocInput): Promise<LiteBloc | null> {
    const now = currentIso();
    let updated: LiteBloc | null = null;

    await liteLocalDb.update((draft) => {
      draft.blocs = draft.blocs.map((bloc) => {
        if (bloc.id !== id || bloc.deletedAt) return bloc;
        updated = { ...bloc, ...input, syncStatus: 'pending', updatedAt: now };
        return updated;
      });
    });

    return updated;
  },

  async createItem(blocId: string, input: Omit<CreateLiteBlocItemInput, 'blocId'>): Promise<LiteBlocItem | null> {
    const now = currentIso();
    let created: LiteBlocItem | null = null;

    await liteLocalDb.update((draft) => {
      const bloc = draft.blocs.find((item) => item.id === blocId && !item.deletedAt);
      if (!bloc) return;

      created = {
        id: createLocalId('local_bloc_item'),
        serverId: null,
        blocId,
        ...input,
        paidAccumulated: Math.max(0, Number(input.paidAccumulated) || 0),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending',
      };

      draft.blocItems.unshift(created);
      draft.blocs = draft.blocs.map((item) =>
        item.id === blocId ? { ...item, syncStatus: 'pending', updatedAt: now } : item,
      );
    });

    return created;
  },

  async listItems(blocId: string): Promise<LiteBlocItem[]> {
    const state = await liteLocalDb.getState();
    return state.blocItems
      .filter((item) => item.blocId === blocId && !item.deletedAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  async findItemByLocalOrServerId(id: string): Promise<LiteBlocItem | null> {
    const state = await liteLocalDb.getState();
    return state.blocItems.find((item) => item.id === id || item.serverId === id) ?? null;
  },

  async updateItemLocal(id: string, input: UpdateLiteBlocItemInput): Promise<LiteBlocItem | null> {
    const now = currentIso();
    let updated: LiteBlocItem | null = null;

    await liteLocalDb.update((draft) => {
      draft.blocItems = draft.blocItems.map((item) => {
        if (item.id !== id || item.deletedAt) return item;
        updated = {
          ...item,
          ...input,
          paidAccumulated: input.paidAccumulated !== undefined
            ? Math.max(0, Number(input.paidAccumulated) || 0)
            : item.paidAccumulated,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return updated;
      });
    });

    return updated;
  },

  async deleteItemLocal(id: string): Promise<LiteBlocItem | null> {
    const now = currentIso();
    let deleted: LiteBlocItem | null = null;

    await liteLocalDb.update((draft) => {
      draft.blocItems = draft.blocItems.map((item) => {
        if (item.id !== id || item.deletedAt) return item;
        deleted = { ...item, deletedAt: now, syncStatus: 'pending', updatedAt: now };
        return deleted;
      });
    });

    return deleted;
  },

  async markItemsPaid(itemIds: string[], liquidationId: string): Promise<LiteBlocItem[]> {
    const now = currentIso();
    const paid: LiteBlocItem[] = [];

    await liteLocalDb.update((draft) => {
      draft.blocItems = draft.blocItems.map((item) => {
        if (!itemIds.includes(item.id) || item.deletedAt) return item;
        const total = item.mode === 'articulo'
          ? Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0)
          : Number(item.amount ?? 0);
        const next = {
          ...item,
          status: 'pagado',
          paidAccumulated: total,
          lastLiquidationId: liquidationId,
          syncStatus: 'pending' as const,
          updatedAt: now,
        };
        paid.push(next);
        return next;
      });
    });

    return paid;
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.blocs = draft.blocs.map((bloc) =>
        bloc.id === clientEntityId
          ? { ...bloc, serverId: serverId ?? bloc.serverId, syncStatus: 'synced', updatedAt: now }
          : bloc,
      );
      draft.blocItems = draft.blocItems.map((item) =>
        item.id === clientEntityId
          ? { ...item, serverId: serverId ?? item.serverId, syncStatus: 'synced', updatedAt: now }
          : item,
      );
    });
  },
};
