import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteCategory, LiteTransactionType } from '../types/local-models';

export const DEFAULT_CATEGORIES: Array<Pick<LiteCategory, 'id' | 'name' | 'icon' | 'color' | 'type' | 'isDefault'>> = [
  { id: 'local_cat_default_food', name: 'Comida', icon: 'restaurant', color: '#EF7725', type: 'expense', isDefault: true },
  { id: 'local_cat_default_transport', name: 'Transporte', icon: 'car', color: '#3377FF', type: 'expense', isDefault: true },
  { id: 'local_cat_default_home', name: 'Hogar', icon: 'home', color: '#22AA66', type: 'expense', isDefault: true },
  { id: 'local_cat_default_health', name: 'Salud', icon: 'heart', color: '#DD4466', type: 'expense', isDefault: true },
  { id: 'local_cat_default_subscriptions', name: 'Suscripciones', icon: 'repeat', color: '#8855FF', type: 'expense', isDefault: true },
  { id: 'local_cat_default_income', name: 'Ingreso', icon: 'wallet', color: '#22AA66', type: 'income', isDefault: true },
];

export type CreateLiteCategoryInput = {
  name: string;
  type: LiteTransactionType;
  color?: string | null;
  icon?: string | null;
};

export type UpdateLiteCategoryInput = {
  name?: string;
  type?: LiteTransactionType;
  color?: string | null;
  icon?: string | null;
};

export const categoriesRepository = {
  async ensureDefaults(): Promise<LiteCategory[]> {
    const now = currentIso();
    const state = await liteLocalDb.update((draft) => {
      const existingIds = new Set(draft.categories.map((category) => category.id));
      DEFAULT_CATEGORIES.forEach((category) => {
        if (!existingIds.has(category.id)) {
          draft.categories.push({
            ...category,
            createdAt: now,
            deletedAt: null,
            serverId: null,
            syncStatus: 'pending',
            updatedAt: now,
          });
        }
      });
    });
    return state.categories;
  },

  async createLocal(input: CreateLiteCategoryInput): Promise<LiteCategory> {
    const now = currentIso();
    const category: LiteCategory = {
      id: createLocalId('local_cat'),
      serverId: null,
      name: input.name.trim() || 'Categoria',
      color: input.color ?? '#EF7725',
      icon: input.icon ?? 'pricetag',
      type: input.type,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.categories.push(category);
    });

    return category;
  },

  async list(type?: LiteTransactionType): Promise<LiteCategory[]> {
    await this.ensureDefaults();
    const state = await liteLocalDb.getState();
    return state.categories
      .filter((category) => !category.deletedAt)
      .filter((category) => !type || category.type === type)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async findByAnyId(id: string): Promise<LiteCategory | null> {
    await this.ensureDefaults();
    const state = await liteLocalDb.getState();
    return state.categories.find((category) => !category.deletedAt && (category.id === id || category.serverId === id)) ?? null;
  },

  async updateLocal(id: string, input: UpdateLiteCategoryInput): Promise<LiteCategory | null> {
    const now = currentIso();
    let nextCategory: LiteCategory | null = null;

    await liteLocalDb.update((draft) => {
      draft.categories = draft.categories.map((category) => {
        if ((category.id !== id && category.serverId !== id) || category.isDefault) return category;
        nextCategory = {
          ...category,
          name: input.name !== undefined ? input.name.trim() || category.name : category.name,
          type: input.type ?? category.type,
          color: input.color !== undefined ? input.color : category.color,
          icon: input.icon !== undefined ? input.icon : category.icon,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return nextCategory;
      });
    });

    return nextCategory;
  },

  async deleteLocal(id: string): Promise<LiteCategory | null> {
    const now = currentIso();
    let deletedCategory: LiteCategory | null = null;

    await liteLocalDb.update((draft) => {
      draft.categories = draft.categories.map((category) => {
        if ((category.id !== id && category.serverId !== id) || category.isDefault) return category;
        deletedCategory = {
          ...category,
          deletedAt: now,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return deletedCategory;
      });
    });

    return deletedCategory;
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.categories = draft.categories.map((category) =>
        category.id === clientEntityId || category.serverId === clientEntityId
          ? { ...category, serverId: serverId ?? category.serverId, syncStatus: 'synced', updatedAt: now }
          : category,
      );
    });
  },
};
