export type LiteEntitySyncStatus = 'pending' | 'synced' | 'conflict' | 'error';

export type LiteTransactionType = 'expense' | 'income';

export type LiteTransaction = {
  id: string;
  serverId?: string | null;
  type: LiteTransactionType;
  amount: number;
  currency: string;
  categoryId?: string | null;
  categoryName?: string | null;
  description?: string | null;
  date: string;
  accountId?: string | null;
  subaccountId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteCategory = {
  id: string;
  serverId?: string | null;
  name: string;
  color?: string | null;
  icon?: string | null;
  type?: LiteTransactionType | null;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteBudget = {
  id: string;
  serverId?: string | null;
  month: string;
  incomePlanned: number;
  savingsTarget: number;
  spendingLimit: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteBloc = {
  id: string;
  serverId?: string | null;
  name: string;
  description?: string | null;
  icon?: string | null;
  type: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteBlocItem = {
  id: string;
  serverId?: string | null;
  blocId: string;
  category: string;
  title: string;
  description?: string | null;
  currency: string;
  mode: string;
  amount?: number | null;
  quantity?: number | null;
  unitPrice?: number | null;
  status: string;
  paidAccumulated: number;
  lastLiquidationId?: string | null;
  lastTransactionId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteGoal = {
  id: string;
  serverId?: string | null;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate?: string | null;
  status?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteGoalMovement = {
  id: string;
  goalId: string;
  type: 'ingreso' | 'egreso' | 'aporte' | 'retiro' | string;
  amount: number;
  currency: string;
  description?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteSubaccount = {
  id: string;
  serverId?: string | null;
  name: string;
  balance: number;
  currency: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteRecurring = {
  id: string;
  serverId?: string | null;
  name: string;
  amount: number;
  currency: string;
  frequencyType: string;
  frequencyValue: string;
  platform?: Record<string, unknown> | string | null;
  accountId?: string | null;
  subaccountId?: string | null;
  userId?: string | null;
  affectsMainAccount: boolean;
  affectsSubaccount: boolean;
  reminders: number[];
  status: string;
  recurringType?: string | null;
  totalPayments?: number | null;
  paymentsMade: number;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteCreditCard = {
  id: string;
  serverId?: string | null;
  name: string;
  last4: string;
  issuer: string;
  bank: string;
  color: string;
  currency: string;
  creditLimit: number;
  usedBalance: number;
  statementDay?: number | null;
  paymentDay?: number | null;
  minPaymentPct?: number | null;
  reminders?: unknown[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteCreditCardMovement = {
  id: string;
  cardId: string;
  type: string;
  amount: number;
  description?: string | null;
  date: string;
  accountId?: string | null;
  subaccountId?: string | null;
  transactionId?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteTicket = {
  id: string;
  serverId?: string | null;
  store: string;
  purchaseDate: string;
  total: number;
  currency: string;
  status: string;
  confirmed: boolean;
  hasImage: boolean;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteSharedSpace = {
  id: string;
  serverId?: string | null;
  ownerUserId: string;
  name: string;
  type: string;
  currency: string;
  status: string;
  config: Record<string, unknown>;
  members: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};

export type LiteSharedSpaceMovement = {
  id: string;
  serverId?: string | null;
  spaceId: string;
  createdByUserId: string;
  createdByMemberId: string;
  type: string;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  totalAmount: number;
  currency: string;
  movementDate: string;
  splitMode: string;
  visibility: string;
  status: string;
  hasAccountImpact: boolean;
  contributions: Record<string, unknown>[];
  splits: Record<string, unknown>[];
  notes?: string | null;
  tags: string[];
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: LiteEntitySyncStatus;
};
