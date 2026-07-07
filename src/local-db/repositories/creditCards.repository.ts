import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteCreditCard, LiteCreditCardMovement } from '../types/local-models';

export type CreateLiteCreditCardInput = Omit<LiteCreditCard, 'createdAt' | 'deletedAt' | 'id' | 'serverId' | 'syncStatus' | 'updatedAt'>;
export type UpdateLiteCreditCardInput = Partial<CreateLiteCreditCardInput>;
export type CreateLiteCreditCardMovementInput = Omit<LiteCreditCardMovement, 'createdAt' | 'deletedAt' | 'id' | 'syncStatus'>;

function getMovementDelta(type: string, amount: number): number {
  if (type === 'compra' || type === 'ajuste') return amount;
  if (type === 'pago' || type === 'credito') return -amount;
  return 0;
}

export const creditCardsRepository = {
  async createLocal(input: CreateLiteCreditCardInput): Promise<LiteCreditCard> {
    const now = currentIso();
    const card: LiteCreditCard = {
      id: createLocalId('local_card'),
      serverId: null,
      ...input,
      creditLimit: Math.max(0, Number(input.creditLimit) || 0),
      usedBalance: Math.max(0, Number(input.usedBalance) || 0),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    };

    await liteLocalDb.update((draft) => {
      draft.creditCards.unshift(card);
    });

    return card;
  },

  async list(): Promise<LiteCreditCard[]> {
    const state = await liteLocalDb.getState();
    return state.creditCards
      .filter((card) => !card.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async findByLocalOrServerId(id: string): Promise<LiteCreditCard | null> {
    const state = await liteLocalDb.getState();
    return state.creditCards.find((card) => card.id === id || card.serverId === id) ?? null;
  },

  async updateLocal(id: string, input: UpdateLiteCreditCardInput): Promise<LiteCreditCard | null> {
    const now = currentIso();
    let nextCard: LiteCreditCard | null = null;

    await liteLocalDb.update((draft) => {
      draft.creditCards = draft.creditCards.map((card) => {
        if (card.id !== id || card.deletedAt) return card;
        nextCard = {
          ...card,
          ...input,
          creditLimit: input.creditLimit !== undefined ? Math.max(0, Number(input.creditLimit) || 0) : card.creditLimit,
          usedBalance: input.usedBalance !== undefined ? Math.max(0, Number(input.usedBalance) || 0) : card.usedBalance,
          syncStatus: 'pending',
          updatedAt: now,
        };
        return nextCard;
      });
    });

    return nextCard;
  },

  async deleteLocal(id: string): Promise<LiteCreditCard | null> {
    const now = currentIso();
    let deletedCard: LiteCreditCard | null = null;

    await liteLocalDb.update((draft) => {
      draft.creditCards = draft.creditCards.map((card) => {
        if (card.id !== id || card.deletedAt) return card;
        deletedCard = { ...card, deletedAt: now, syncStatus: 'pending', updatedAt: now };
        return deletedCard;
      });
    });

    return deletedCard;
  },

  async createMovement(cardId: string, input: Omit<CreateLiteCreditCardMovementInput, 'cardId'>): Promise<{ card: LiteCreditCard; movement: LiteCreditCardMovement } | null> {
    const now = currentIso();
    let nextCard: LiteCreditCard | null = null;
    let movement: LiteCreditCardMovement | null = null;

    await liteLocalDb.update((draft) => {
      const card = draft.creditCards.find((item) => item.id === cardId && !item.deletedAt);
      if (!card) return;

      movement = {
        id: createLocalId('local_card_mov'),
        cardId,
        ...input,
        amount: Math.max(0, Number(input.amount) || 0),
        createdAt: now,
        deletedAt: null,
        syncStatus: 'pending',
      };
      const usedBalance = Math.max(0, card.usedBalance + getMovementDelta(movement.type, movement.amount));
      nextCard = { ...card, usedBalance, syncStatus: 'pending', updatedAt: now };

      draft.creditCards = draft.creditCards.map((item) => (item.id === cardId ? nextCard! : item));
      draft.creditCardMovements.unshift(movement);
    });

    return nextCard && movement ? { card: nextCard, movement } : null;
  },

  async listMovements(cardId: string, limit = 20): Promise<LiteCreditCardMovement[]> {
    const state = await liteLocalDb.getState();
    return state.creditCardMovements
      .filter((movement) => movement.cardId === cardId && !movement.deletedAt)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  },

  async markSynced(clientEntityId: string, serverId?: string | null): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.creditCards = draft.creditCards.map((card) =>
        card.id === clientEntityId
          ? { ...card, serverId: serverId ?? card.serverId, syncStatus: 'synced', updatedAt: now }
          : card,
      );
    });
  },
};
