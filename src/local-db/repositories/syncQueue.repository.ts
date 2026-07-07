import { createLocalId, currentIso, liteLocalDb } from '../database';
import type { LiteSyncAction, LiteSyncEntity, LiteSyncQueueOperation, LiteSyncQueueStatus } from '../types/sync.types';

export type EnqueueLiteOperationInput = {
  entity: LiteSyncEntity;
  action: LiteSyncAction;
  clientEntityId: string;
  serverEntityId?: string | null;
  payload: Record<string, unknown>;
};

export const syncQueueRepository = {
  async enqueue(input: EnqueueLiteOperationInput): Promise<LiteSyncQueueOperation> {
    const now = currentIso();
    const operation: LiteSyncQueueOperation = {
      id: createLocalId('local_queue'),
      clientOperationId: createLocalId(`op_${input.entity}`),
      entity: input.entity,
      action: input.action,
      clientEntityId: input.clientEntityId,
      serverEntityId: input.serverEntityId ?? null,
      payload: input.payload,
      status: 'pending',
      retryCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };

    await liteLocalDb.update((draft) => {
      draft.syncQueue.push(operation);
    });

    return operation;
  },

  async listPending(limit = 50): Promise<LiteSyncQueueOperation[]> {
    const state = await liteLocalDb.getState();
    return state.syncQueue
      .filter((operation) => operation.status === 'pending' || operation.status === 'retryable')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, limit);
  },

  async listAll(): Promise<LiteSyncQueueOperation[]> {
    const state = await liteLocalDb.getState();
    return [...state.syncQueue].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async clearSynced(): Promise<number> {
    let removed = 0;
    await liteLocalDb.update((draft) => {
      const before = draft.syncQueue.length;
      draft.syncQueue = draft.syncQueue.filter((operation) => operation.status !== 'synced');
      removed = before - draft.syncQueue.length;
    });
    return removed;
  },

  async retryFailed(): Promise<number> {
    const now = currentIso();
    let changed = 0;
    await liteLocalDb.update((draft) => {
      draft.syncQueue = draft.syncQueue.map((operation) => {
        if (operation.status !== 'error' && operation.status !== 'rejected') return operation;
        changed += 1;
        return {
          ...operation,
          lastError: 'Marcada para reintento manual.',
          status: 'retryable',
          updatedAt: now,
        };
      });
    });
    return changed;
  },

  async setStatus(
    clientOperationId: string,
    status: LiteSyncQueueStatus,
    patch?: { lastError?: string | null; serverEntityId?: string | null },
  ): Promise<void> {
    const now = currentIso();
    await liteLocalDb.update((draft) => {
      draft.syncQueue = draft.syncQueue.map((operation) =>
        operation.clientOperationId === clientOperationId
          ? {
              ...operation,
              ...patch,
              retryCount:
                status === 'retryable' || status === 'error'
                  ? operation.retryCount + 1
                  : operation.retryCount,
              status,
              updatedAt: now,
            }
          : operation,
      );
    });
  },

  async getMetrics(): Promise<{ conflictCount: number; errorCount: number; pendingCount: number; syncedCount: number }> {
    const state = await liteLocalDb.getState();
    return state.syncQueue.reduce(
      (acc, operation) => {
        if (operation.status === 'pending' || operation.status === 'retryable' || operation.status === 'syncing') {
          acc.pendingCount += 1;
        }
        if (operation.status === 'conflict') acc.conflictCount += 1;
        if (operation.status === 'error' || operation.status === 'rejected') acc.errorCount += 1;
        if (operation.status === 'synced') acc.syncedCount += 1;
        return acc;
      },
      { conflictCount: 0, errorCount: 0, pendingCount: 0, syncedCount: 0 },
    );
  },
};
