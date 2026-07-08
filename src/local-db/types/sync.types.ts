export type LiteSyncEntity = 'transaction' | 'category' | 'budget' | 'goal' | 'subaccount' | 'account' | 'recurring' | 'creditCard' | 'ticket' | 'sharedSpace' | 'sharedSpaceMovement' | 'bloc' | 'blocItem';
export type LiteSyncAction = 'create' | 'update' | 'delete';
export type LiteSyncQueueStatus = 'pending' | 'syncing' | 'synced' | 'retryable' | 'conflict' | 'rejected' | 'error';

export type LiteSyncQueueOperation = {
  id: string;
  clientOperationId: string;
  entity: LiteSyncEntity;
  action: LiteSyncAction;
  clientEntityId: string;
  serverEntityId?: string | null;
  payload: Record<string, unknown>;
  status: LiteSyncQueueStatus;
  retryCount: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LiteEntityIdMap = {
  clientEntityId: string;
  serverEntityId: string;
  entity: LiteSyncEntity;
  createdAt: string;
};
