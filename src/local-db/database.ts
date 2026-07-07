import * as SQLite from 'expo-sqlite';
import type { LiteBloc, LiteBlocItem, LiteBudget, LiteCategory, LiteCreditCard, LiteCreditCardMovement, LiteGoal, LiteGoalMovement, LiteRecurring, LiteSharedSpace, LiteSharedSpaceMovement, LiteSubaccount, LiteTicket, LiteTransaction } from './types/local-models';
import type { LiteEntityIdMap, LiteSyncQueueOperation } from './types/sync.types';
import {
  ADD_GOAL_STATUS_SQL,
  ADD_SUBACCOUNT_IS_ACTIVE_SQL,
  CREATE_BLOCS_SQL,
  CREATE_GOAL_MOVEMENTS_SQL,
  CREATE_CREDIT_CARDS_SQL,
  CREATE_RECURRINGS_SQL,
  CREATE_SHARED_SPACES_SQL,
  CREATE_TICKETS_SQL,
  INIT_LITE_SCHEMA_SQL,
  LITE_SCHEMA_VERSION,
} from './migrations/001_init_lite_schema';

const DB_NAME = 'litfinance_lite.db';

export type LiteLocalDbState = {
  blocItems: LiteBlocItem[];
  blocs: LiteBloc[];
  budgets: LiteBudget[];
  categories: LiteCategory[];
  creditCardMovements: LiteCreditCardMovement[];
  creditCards: LiteCreditCard[];
  entityIdMap: LiteEntityIdMap[];
  goalMovements: LiteGoalMovement[];
  goals: LiteGoal[];
  recurrings: LiteRecurring[];
  sharedSpaceMovements: LiteSharedSpaceMovement[];
  sharedSpaces: LiteSharedSpace[];
  subaccounts: LiteSubaccount[];
  syncQueue: LiteSyncQueueOperation[];
  syncState: Record<string, string>;
  tickets: LiteTicket[];
  transactions: LiteTransaction[];
};

export const emptyLiteDbState = (): LiteLocalDbState => ({
  blocItems: [],
  blocs: [],
  budgets: [],
  categories: [],
  creditCardMovements: [],
  creditCards: [],
  entityIdMap: [],
  goalMovements: [],
  goals: [],
  recurrings: [],
  sharedSpaceMovements: [],
  sharedSpaces: [],
  subaccounts: [],
  syncQueue: [],
  syncState: {},
  tickets: [],
  transactions: [],
});

type Db = SQLite.SQLiteDatabase;
type Row = Record<string, any>;

let dbPromise: Promise<Db> | null = null;

async function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: Db): Promise<void> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = Number(versionRow?.user_version ?? 0);
  if (currentVersion >= LITE_SCHEMA_VERSION) return;

  if (currentVersion < 1) {
    await db.execAsync(INIT_LITE_SCHEMA_SQL);
  }
  if (currentVersion < 2) {
    try {
      await db.execAsync(ADD_GOAL_STATUS_SQL);
    } catch (error) {
      const message = String((error as any)?.message ?? error).toLowerCase();
      if (!message.includes('duplicate column')) throw error;
    }
  }
  if (currentVersion < 3) {
    try {
      await db.execAsync(ADD_SUBACCOUNT_IS_ACTIVE_SQL);
    } catch (error) {
      const message = String((error as any)?.message ?? error).toLowerCase();
      if (!message.includes('duplicate column')) throw error;
    }
  }
  if (currentVersion < 4) {
    await db.execAsync(CREATE_GOAL_MOVEMENTS_SQL);
  }
  if (currentVersion < 5) {
    await db.execAsync(CREATE_RECURRINGS_SQL);
  }
  if (currentVersion < 6) {
    await db.execAsync(CREATE_CREDIT_CARDS_SQL);
  }
  if (currentVersion < 7) {
    await db.execAsync(CREATE_TICKETS_SQL);
  }
  if (currentVersion < 8) {
    await db.execAsync(CREATE_SHARED_SPACES_SQL);
  }
  if (currentVersion < 9) {
    await db.execAsync(CREATE_BLOCS_SQL);
  }
  await db.execAsync(`PRAGMA user_version = ${LITE_SCHEMA_VERSION}`);
}

async function readState(): Promise<LiteLocalDbState> {
  try {
    const db = await getDb();
    const [
      transactionRows,
      blocRows,
      blocItemRows,
      categoryRows,
      budgetRows,
      creditCardRows,
      creditCardMovementRows,
      goalRows,
      goalMovementRows,
      recurringRows,
      sharedSpaceRows,
      sharedSpaceMovementRows,
      subaccountRows,
      syncQueueRows,
      syncStateRows,
      ticketRows,
      entityIdMapRows,
    ] = await Promise.all([
      db.getAllAsync<Row>('SELECT * FROM transactions'),
      db.getAllAsync<Row>('SELECT * FROM blocs'),
      db.getAllAsync<Row>('SELECT * FROM bloc_items'),
      db.getAllAsync<Row>('SELECT * FROM categories'),
      db.getAllAsync<Row>('SELECT * FROM budgets'),
      db.getAllAsync<Row>('SELECT * FROM credit_cards'),
      db.getAllAsync<Row>('SELECT * FROM credit_card_movements'),
      db.getAllAsync<Row>('SELECT * FROM goals'),
      db.getAllAsync<Row>('SELECT * FROM goal_movements'),
      db.getAllAsync<Row>('SELECT * FROM recurrings'),
      db.getAllAsync<Row>('SELECT * FROM shared_spaces'),
      db.getAllAsync<Row>('SELECT * FROM shared_space_movements'),
      db.getAllAsync<Row>('SELECT * FROM subaccounts'),
      db.getAllAsync<Row>('SELECT * FROM sync_queue'),
      db.getAllAsync<Row>('SELECT * FROM sync_state'),
      db.getAllAsync<Row>('SELECT * FROM tickets'),
      db.getAllAsync<Row>('SELECT * FROM entity_id_map'),
    ]);

    return {
      blocItems: blocItemRows.map(toBlocItem),
      blocs: blocRows.map(toBloc),
      budgets: budgetRows.map(toBudget),
      categories: categoryRows.map(toCategory),
      creditCardMovements: creditCardMovementRows.map(toCreditCardMovement),
      creditCards: creditCardRows.map(toCreditCard),
      entityIdMap: entityIdMapRows.map(toEntityIdMap),
      goalMovements: goalMovementRows.map(toGoalMovement),
      goals: goalRows.map(toGoal),
      recurrings: recurringRows.map(toRecurring),
      sharedSpaceMovements: sharedSpaceMovementRows.map(toSharedSpaceMovement),
      sharedSpaces: sharedSpaceRows.map(toSharedSpace),
      subaccounts: subaccountRows.map(toSubaccount),
      syncQueue: syncQueueRows.map(toSyncQueueOperation),
      syncState: syncStateRows.reduce<Record<string, string>>((acc, row) => {
        acc[String(row.key)] = String(row.value);
        return acc;
      }, {}),
      tickets: ticketRows.map(toTicket),
      transactions: transactionRows.map(toTransaction),
    };
  } catch {
    return emptyLiteDbState();
  }
}

async function writeState(state: LiteLocalDbState): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.execAsync(`
      DELETE FROM transactions;
      DELETE FROM blocs;
      DELETE FROM bloc_items;
      DELETE FROM categories;
      DELETE FROM budgets;
      DELETE FROM credit_cards;
      DELETE FROM credit_card_movements;
      DELETE FROM goals;
      DELETE FROM goal_movements;
      DELETE FROM recurrings;
      DELETE FROM shared_spaces;
      DELETE FROM shared_space_movements;
      DELETE FROM subaccounts;
      DELETE FROM sync_queue;
      DELETE FROM sync_state;
      DELETE FROM tickets;
      DELETE FROM entity_id_map;
    `);

    for (const item of state.transactions) {
      await tx.runAsync(
        `INSERT INTO transactions (
          id, server_id, type, amount, currency, category_id, category_name, description,
          date, account_id, subaccount_id, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.type,
        item.amount,
        item.currency,
        item.categoryId ?? null,
        item.categoryName ?? null,
        item.description ?? null,
        item.date,
        item.accountId ?? null,
        item.subaccountId ?? null,
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.blocs) {
      await tx.runAsync(
        `INSERT INTO blocs (
          id, server_id, name, description, icon, type, created_at, updated_at,
          deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.name,
        item.description ?? null,
        item.icon ?? null,
        item.type,
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.blocItems) {
      await tx.runAsync(
        `INSERT INTO bloc_items (
          id, server_id, bloc_id, category, title, description, currency, mode,
          amount, quantity, unit_price, status, paid_accumulated,
          last_liquidation_id, last_transaction_id, created_at, updated_at,
          deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.blocId,
        item.category,
        item.title,
        item.description ?? null,
        item.currency,
        item.mode,
        item.amount ?? null,
        item.quantity ?? null,
        item.unitPrice ?? null,
        item.status,
        item.paidAccumulated,
        item.lastLiquidationId ?? null,
        item.lastTransactionId ?? null,
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.categories) {
      await tx.runAsync(
        `INSERT INTO categories (
          id, server_id, name, color, icon, type, is_default, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.name,
        item.color ?? null,
        item.icon ?? null,
        item.type ?? null,
        item.isDefault ? 1 : 0,
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.budgets) {
      await tx.runAsync(
        `INSERT INTO budgets (
          id, server_id, month, income_planned, savings_target, spending_limit,
          currency, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.month,
        item.incomePlanned,
        item.savingsTarget,
        item.spendingLimit,
        item.currency,
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.creditCards) {
      await tx.runAsync(
        `INSERT INTO credit_cards (
          id, server_id, name, last4, issuer, bank, color, currency, credit_limit,
          used_balance, statement_day, payment_day, min_payment_pct, reminders_json,
          is_active, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.name,
        item.last4,
        item.issuer,
        item.bank,
        item.color,
        item.currency,
        item.creditLimit,
        item.usedBalance,
        item.statementDay ?? null,
        item.paymentDay ?? null,
        item.minPaymentPct ?? null,
        item.reminders ? JSON.stringify(item.reminders) : null,
        item.isActive ? 1 : 0,
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.creditCardMovements) {
      await tx.runAsync(
        `INSERT INTO credit_card_movements (
          id, card_id, type, amount, description, date, account_id, subaccount_id,
          transaction_id, created_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.cardId,
        item.type,
        item.amount,
        item.description ?? null,
        item.date,
        item.accountId ?? null,
        item.subaccountId ?? null,
        item.transactionId ?? null,
        item.createdAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.goals) {
      await tx.runAsync(
        `INSERT INTO goals (
          id, server_id, name, target_amount, current_amount, currency, target_date,
          status, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.name,
        item.targetAmount,
        item.currentAmount,
        item.currency,
        item.targetDate ?? null,
        item.status ?? 'activa',
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.goalMovements) {
      await tx.runAsync(
        `INSERT INTO goal_movements (
          id, goal_id, type, amount, currency, description, created_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.goalId,
        item.type,
        item.amount,
        item.currency,
        item.description ?? null,
        item.createdAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.recurrings) {
      await tx.runAsync(
        `INSERT INTO recurrings (
          id, server_id, name, amount, currency, frequency_type, frequency_value,
          platform_json, account_id, subaccount_id, user_id, affects_main_account,
          affects_subaccount, reminders_json, status, recurring_type, total_payments,
          payments_made, next_run_at, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.name,
        item.amount,
        item.currency,
        item.frequencyType,
        item.frequencyValue,
        item.platform !== undefined && item.platform !== null ? JSON.stringify(item.platform) : null,
        item.accountId ?? null,
        item.subaccountId ?? null,
        item.userId ?? null,
        item.affectsMainAccount ? 1 : 0,
        item.affectsSubaccount ? 1 : 0,
        JSON.stringify(item.reminders ?? []),
        item.status,
        item.recurringType ?? null,
        item.totalPayments ?? null,
        item.paymentsMade,
        item.nextRunAt ?? null,
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.sharedSpaces) {
      await tx.runAsync(
        `INSERT INTO shared_spaces (
          id, server_id, owner_user_id, name, type, currency, status, config_json,
          members_json, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.ownerUserId,
        item.name,
        item.type,
        item.currency,
        item.status,
        JSON.stringify(item.config ?? {}),
        JSON.stringify(item.members ?? []),
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.sharedSpaceMovements) {
      await tx.runAsync(
        `INSERT INTO shared_space_movements (
          id, server_id, space_id, created_by_user_id, created_by_member_id,
          type, title, description, category_id, total_amount, currency,
          movement_date, split_mode, visibility, status, has_account_impact,
          contributions_json, splits_json, notes, tags_json, idempotency_key,
          created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.spaceId,
        item.createdByUserId,
        item.createdByMemberId,
        item.type,
        item.title,
        item.description ?? null,
        item.categoryId ?? null,
        item.totalAmount,
        item.currency,
        item.movementDate,
        item.splitMode,
        item.visibility,
        item.status,
        item.hasAccountImpact ? 1 : 0,
        JSON.stringify(item.contributions ?? []),
        JSON.stringify(item.splits ?? []),
        item.notes ?? null,
        JSON.stringify(item.tags ?? []),
        item.idempotencyKey ?? null,
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.subaccounts) {
      await tx.runAsync(
        `INSERT INTO subaccounts (
          id, server_id, name, balance, currency, is_active, created_at, updated_at, deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.name,
        item.balance,
        item.currency,
        item.isActive === false ? 0 : 1,
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.tickets) {
      await tx.runAsync(
        `INSERT INTO tickets (
          id, server_id, store, purchase_date, total, currency, status, confirmed,
          has_image, image_base64, image_mime_type, data_json, created_at, updated_at,
          deleted_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.serverId ?? null,
        item.store,
        item.purchaseDate,
        item.total,
        item.currency,
        item.status,
        item.confirmed ? 1 : 0,
        item.hasImage ? 1 : 0,
        item.imageBase64 ?? null,
        item.imageMimeType ?? null,
        JSON.stringify(item.data ?? {}),
        item.createdAt,
        item.updatedAt,
        item.deletedAt ?? null,
        item.syncStatus,
      );
    }

    for (const item of state.syncQueue) {
      await tx.runAsync(
        `INSERT INTO sync_queue (
          id, client_operation_id, entity, action, client_entity_id, server_entity_id,
          payload, status, retry_count, last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        item.id,
        item.clientOperationId,
        item.entity,
        item.action,
        item.clientEntityId,
        item.serverEntityId ?? null,
        JSON.stringify(item.payload ?? {}),
        item.status,
        item.retryCount,
        item.lastError ?? null,
        item.createdAt,
        item.updatedAt,
      );
    }

    for (const [key, value] of Object.entries(state.syncState)) {
      await tx.runAsync(
        'INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)',
        key,
        value,
        currentIso(),
      );
    }

    for (const item of state.entityIdMap) {
      await tx.runAsync(
        'INSERT INTO entity_id_map (client_entity_id, server_entity_id, entity, created_at) VALUES (?, ?, ?, ?)',
        item.clientEntityId,
        item.serverEntityId,
        item.entity,
        item.createdAt,
      );
    }
  });
}

export const liteLocalDb = {
  async getState(): Promise<LiteLocalDbState> {
    return readState();
  },

  async setState(state: LiteLocalDbState): Promise<void> {
    await writeState(state);
  },

  async update(mutator: (state: LiteLocalDbState) => LiteLocalDbState | void): Promise<LiteLocalDbState> {
    const current = await readState();
    const next = mutator(current) ?? current;
    await writeState(next);
    return next;
  },

  async reset(): Promise<void> {
    await writeState(emptyLiteDbState());
  },
};

function toTransaction(row: Row): LiteTransaction {
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    type: row.type,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'MXN'),
    categoryId: row.category_id ?? null,
    categoryName: row.category_name ?? null,
    description: row.description ?? null,
    date: String(row.date),
    accountId: row.account_id ?? null,
    subaccountId: row.subaccount_id ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toBloc(row: Row): LiteBloc {
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    name: String(row.name ?? 'Bloc'),
    description: row.description ?? null,
    icon: row.icon ?? null,
    type: String(row.type ?? 'cuentas'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toBlocItem(row: Row): LiteBlocItem {
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    blocId: String(row.bloc_id),
    category: String(row.category ?? 'General'),
    title: String(row.title ?? 'Item'),
    description: row.description ?? null,
    currency: String(row.currency ?? 'MXN'),
    mode: String(row.mode ?? 'monto'),
    amount: row.amount == null ? null : Number(row.amount),
    quantity: row.quantity == null ? null : Number(row.quantity),
    unitPrice: row.unit_price == null ? null : Number(row.unit_price),
    status: String(row.status ?? 'pendiente'),
    paidAccumulated: Number(row.paid_accumulated ?? 0),
    lastLiquidationId: row.last_liquidation_id ?? null,
    lastTransactionId: row.last_transaction_id ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toCategory(row: Row): LiteCategory {
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    name: String(row.name),
    color: row.color ?? null,
    icon: row.icon ?? null,
    type: row.type ?? null,
    isDefault: Number(row.is_default ?? 0) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toBudget(row: Row): LiteBudget {
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    month: String(row.month),
    incomePlanned: Number(row.income_planned ?? 0),
    savingsTarget: Number(row.savings_target ?? 0),
    spendingLimit: Number(row.spending_limit ?? 0),
    currency: String(row.currency ?? 'MXN'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toCreditCard(row: Row): LiteCreditCard {
  const reminders = safeJsonParse(row.reminders_json);
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    name: String(row.name),
    last4: String(row.last4),
    issuer: String(row.issuer),
    bank: String(row.bank),
    color: String(row.color),
    currency: String(row.currency ?? 'MXN'),
    creditLimit: Number(row.credit_limit ?? 0),
    usedBalance: Number(row.used_balance ?? 0),
    statementDay: row.statement_day == null ? null : Number(row.statement_day),
    paymentDay: row.payment_day == null ? null : Number(row.payment_day),
    minPaymentPct: row.min_payment_pct == null ? null : Number(row.min_payment_pct),
    reminders: Array.isArray(reminders) ? reminders : [],
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toCreditCardMovement(row: Row): LiteCreditCardMovement {
  return {
    id: String(row.id),
    cardId: String(row.card_id),
    type: String(row.type),
    amount: Number(row.amount ?? 0),
    description: row.description ?? null,
    date: String(row.date),
    accountId: row.account_id ?? null,
    subaccountId: row.subaccount_id ?? null,
    transactionId: row.transaction_id ?? null,
    createdAt: String(row.created_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toGoal(row: Row): LiteGoal {
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    name: String(row.name),
    targetAmount: Number(row.target_amount ?? 0),
    currentAmount: Number(row.current_amount ?? 0),
    currency: String(row.currency ?? 'MXN'),
    targetDate: row.target_date ?? null,
    status: String(row.status ?? 'activa'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toGoalMovement(row: Row): LiteGoalMovement {
  return {
    id: String(row.id),
    goalId: String(row.goal_id),
    type: String(row.type),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'MXN'),
    description: row.description ?? null,
    createdAt: String(row.created_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toRecurring(row: Row): LiteRecurring {
  const remindersRaw = safeJsonParse(row.reminders_json);
  const reminders = Array.isArray(remindersRaw)
    ? remindersRaw.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
  const platformRaw = safeJsonParse(row.platform_json);

  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    name: String(row.name),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'MXN'),
    frequencyType: String(row.frequency_type ?? 'mensual'),
    frequencyValue: String(row.frequency_value ?? '1'),
    platform: Object.keys(platformRaw).length ? platformRaw : null,
    accountId: row.account_id ?? null,
    subaccountId: row.subaccount_id ?? null,
    userId: row.user_id ?? null,
    affectsMainAccount: Number(row.affects_main_account ?? 1) === 1,
    affectsSubaccount: Number(row.affects_subaccount ?? 0) === 1,
    reminders,
    status: String(row.status ?? 'activo'),
    recurringType: row.recurring_type ?? null,
    totalPayments: row.total_payments == null ? null : Number(row.total_payments),
    paymentsMade: Number(row.payments_made ?? 0),
    nextRunAt: row.next_run_at ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toSharedSpace(row: Row): LiteSharedSpace {
  const config = safeJsonParse(row.config_json);
  const members = safeJsonParse(row.members_json);
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    ownerUserId: String(row.owner_user_id ?? ''),
    name: String(row.name ?? 'Espacio compartido'),
    type: String(row.type ?? 'grupo'),
    currency: String(row.currency ?? 'MXN'),
    status: String(row.status ?? 'activo'),
    config,
    members: Array.isArray(members) ? members : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toSharedSpaceMovement(row: Row): LiteSharedSpaceMovement {
  const contributions = safeJsonParse(row.contributions_json);
  const splits = safeJsonParse(row.splits_json);
  const tags = safeJsonParse(row.tags_json);
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    spaceId: String(row.space_id),
    createdByUserId: String(row.created_by_user_id ?? ''),
    createdByMemberId: String(row.created_by_member_id ?? ''),
    type: String(row.type ?? 'expense'),
    title: String(row.title ?? 'Movimiento compartido'),
    description: row.description ?? null,
    categoryId: row.category_id ?? null,
    totalAmount: Number(row.total_amount ?? 0),
    currency: String(row.currency ?? 'MXN'),
    movementDate: String(row.movement_date),
    splitMode: String(row.split_mode ?? 'equal'),
    visibility: String(row.visibility ?? 'all'),
    status: String(row.status ?? 'published'),
    hasAccountImpact: Number(row.has_account_impact ?? 0) === 1,
    contributions: Array.isArray(contributions) ? contributions : [],
    splits: Array.isArray(splits) ? splits : [],
    notes: row.notes ?? null,
    tags: Array.isArray(tags) ? tags.map(String) : [],
    idempotencyKey: row.idempotency_key ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toSubaccount(row: Row): LiteSubaccount {
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    name: String(row.name),
    balance: Number(row.balance ?? 0),
    currency: String(row.currency ?? 'MXN'),
    isActive: Number(row.is_active ?? 1) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toTicket(row: Row): LiteTicket {
  return {
    id: String(row.id),
    serverId: row.server_id ?? null,
    store: String(row.store ?? ''),
    purchaseDate: String(row.purchase_date),
    total: Number(row.total ?? 0),
    currency: String(row.currency ?? 'MXN'),
    status: String(row.status ?? 'review'),
    confirmed: Number(row.confirmed ?? 0) === 1,
    hasImage: Number(row.has_image ?? 0) === 1,
    imageBase64: row.image_base64 ?? null,
    imageMimeType: row.image_mime_type ?? null,
    data: safeJsonParse(row.data_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ?? null,
    syncStatus: row.sync_status,
  };
}

function toSyncQueueOperation(row: Row): LiteSyncQueueOperation {
  return {
    id: String(row.id),
    clientOperationId: String(row.client_operation_id),
    entity: row.entity,
    action: row.action,
    clientEntityId: String(row.client_entity_id),
    serverEntityId: row.server_entity_id ?? null,
    payload: safeJsonParse(row.payload),
    status: row.status,
    retryCount: Number(row.retry_count ?? 0),
    lastError: row.last_error ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toEntityIdMap(row: Row): LiteEntityIdMap {
  return {
    clientEntityId: String(row.client_entity_id),
    serverEntityId: String(row.server_entity_id),
    entity: row.entity,
    createdAt: String(row.created_at),
  };
}

function safeJsonParse(value: unknown): any {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function currentIso(): string {
  return new Date().toISOString();
}
