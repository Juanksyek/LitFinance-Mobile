export const LITE_SCHEMA_VERSION = 9;

export const ADD_GOAL_STATUS_SQL = `
ALTER TABLE goals ADD COLUMN status TEXT NOT NULL DEFAULT 'activa';
`;

export const ADD_SUBACCOUNT_IS_ACTIVE_SQL = `
ALTER TABLE subaccounts ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
`;

export const CREATE_GOAL_MOVEMENTS_SQL = `
CREATE TABLE IF NOT EXISTS goal_movements (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_goal_movements_goal_id ON goal_movements(goal_id);
`;

export const CREATE_RECURRINGS_SQL = `
CREATE TABLE IF NOT EXISTS recurrings (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  frequency_type TEXT NOT NULL,
  frequency_value TEXT NOT NULL,
  platform_json TEXT,
  account_id TEXT,
  subaccount_id TEXT,
  user_id TEXT,
  affects_main_account INTEGER NOT NULL DEFAULT 1,
  affects_subaccount INTEGER NOT NULL DEFAULT 0,
  reminders_json TEXT,
  status TEXT NOT NULL DEFAULT 'activo',
  recurring_type TEXT,
  total_payments REAL,
  payments_made REAL NOT NULL DEFAULT 0,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_recurrings_subaccount_id ON recurrings(subaccount_id);
CREATE INDEX IF NOT EXISTS idx_recurrings_sync_status ON recurrings(sync_status);
`;

export const CREATE_CREDIT_CARDS_SQL = `
CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  last4 TEXT NOT NULL,
  issuer TEXT NOT NULL,
  bank TEXT NOT NULL,
  color TEXT NOT NULL,
  currency TEXT NOT NULL,
  credit_limit REAL NOT NULL DEFAULT 0,
  used_balance REAL NOT NULL DEFAULT 0,
  statement_day REAL,
  payment_day REAL,
  min_payment_pct REAL,
  reminders_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS credit_card_movements (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  description TEXT,
  date TEXT NOT NULL,
  account_id TEXT,
  subaccount_id TEXT,
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_credit_card_movements_card_id ON credit_card_movements(card_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_sync_status ON credit_cards(sync_status);
`;

export const CREATE_TICKETS_SQL = `
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  store TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'review',
  confirmed INTEGER NOT NULL DEFAULT 0,
  has_image INTEGER NOT NULL DEFAULT 0,
  image_base64 TEXT,
  image_mime_type TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_purchase_date ON tickets(purchase_date);
CREATE INDEX IF NOT EXISTS idx_tickets_sync_status ON tickets(sync_status);
`;

export const CREATE_SHARED_SPACES_SQL = `
CREATE TABLE IF NOT EXISTS shared_spaces (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'activo',
  config_json TEXT NOT NULL,
  members_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS shared_space_movements (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  space_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_by_member_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  movement_date TEXT NOT NULL,
  split_mode TEXT NOT NULL,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  has_account_impact INTEGER NOT NULL DEFAULT 0,
  contributions_json TEXT NOT NULL,
  splits_json TEXT NOT NULL,
  notes TEXT,
  tags_json TEXT NOT NULL,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_shared_spaces_status ON shared_spaces(status);
CREATE INDEX IF NOT EXISTS idx_shared_spaces_sync_status ON shared_spaces(sync_status);
CREATE INDEX IF NOT EXISTS idx_shared_space_movements_space_id ON shared_space_movements(space_id);
CREATE INDEX IF NOT EXISTS idx_shared_space_movements_sync_status ON shared_space_movements(sync_status);
`;

export const CREATE_BLOCS_SQL = `
CREATE TABLE IF NOT EXISTS blocs (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS bloc_items (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  bloc_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL,
  mode TEXT NOT NULL,
  amount REAL,
  quantity REAL,
  unit_price REAL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  paid_accumulated REAL NOT NULL DEFAULT 0,
  last_liquidation_id TEXT,
  last_transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_blocs_sync_status ON blocs(sync_status);
CREATE INDEX IF NOT EXISTS idx_bloc_items_bloc_id ON bloc_items(bloc_id);
CREATE INDEX IF NOT EXISTS idx_bloc_items_sync_status ON bloc_items(sync_status);
`;

export const INIT_LITE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  category_id TEXT,
  category_name TEXT,
  description TEXT,
  date TEXT NOT NULL,
  account_id TEXT,
  subaccount_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  type TEXT,
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  month TEXT NOT NULL,
  income_planned REAL NOT NULL DEFAULT 0,
  savings_target REAL NOT NULL DEFAULT 0,
  spending_limit REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  target_date TEXT,
  status TEXT NOT NULL DEFAULT 'activa',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS subaccounts (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS goal_movements (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS recurrings (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  frequency_type TEXT NOT NULL,
  frequency_value TEXT NOT NULL,
  platform_json TEXT,
  account_id TEXT,
  subaccount_id TEXT,
  user_id TEXT,
  affects_main_account INTEGER NOT NULL DEFAULT 1,
  affects_subaccount INTEGER NOT NULL DEFAULT 0,
  reminders_json TEXT,
  status TEXT NOT NULL DEFAULT 'activo',
  recurring_type TEXT,
  total_payments REAL,
  payments_made REAL NOT NULL DEFAULT 0,
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  last4 TEXT NOT NULL,
  issuer TEXT NOT NULL,
  bank TEXT NOT NULL,
  color TEXT NOT NULL,
  currency TEXT NOT NULL,
  credit_limit REAL NOT NULL DEFAULT 0,
  used_balance REAL NOT NULL DEFAULT 0,
  statement_day REAL,
  payment_day REAL,
  min_payment_pct REAL,
  reminders_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS credit_card_movements (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  description TEXT,
  date TEXT NOT NULL,
  account_id TEXT,
  subaccount_id TEXT,
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  store TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'review',
  confirmed INTEGER NOT NULL DEFAULT 0,
  has_image INTEGER NOT NULL DEFAULT 0,
  image_base64 TEXT,
  image_mime_type TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS shared_spaces (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'activo',
  config_json TEXT NOT NULL,
  members_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS shared_space_movements (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  space_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_by_member_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  movement_date TEXT NOT NULL,
  split_mode TEXT NOT NULL,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  has_account_impact INTEGER NOT NULL DEFAULT 0,
  contributions_json TEXT NOT NULL,
  splits_json TEXT NOT NULL,
  notes TEXT,
  tags_json TEXT NOT NULL,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS blocs (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS bloc_items (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  bloc_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL,
  mode TEXT NOT NULL,
  amount REAL,
  quantity REAL,
  unit_price REAL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  paid_accumulated REAL NOT NULL DEFAULT 0,
  last_liquidation_id TEXT,
  last_transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  client_operation_id TEXT NOT NULL UNIQUE,
  entity TEXT NOT NULL,
  action TEXT NOT NULL,
  client_entity_id TEXT NOT NULL,
  server_entity_id TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_id_map (
  client_entity_id TEXT PRIMARY KEY,
  server_entity_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_sync_status ON transactions(sync_status);
CREATE INDEX IF NOT EXISTS idx_goal_movements_goal_id ON goal_movements(goal_id);
CREATE INDEX IF NOT EXISTS idx_recurrings_subaccount_id ON recurrings(subaccount_id);
CREATE INDEX IF NOT EXISTS idx_recurrings_sync_status ON recurrings(sync_status);
CREATE INDEX IF NOT EXISTS idx_credit_card_movements_card_id ON credit_card_movements(card_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_sync_status ON credit_cards(sync_status);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_purchase_date ON tickets(purchase_date);
CREATE INDEX IF NOT EXISTS idx_tickets_sync_status ON tickets(sync_status);
CREATE INDEX IF NOT EXISTS idx_shared_spaces_status ON shared_spaces(status);
CREATE INDEX IF NOT EXISTS idx_shared_spaces_sync_status ON shared_spaces(sync_status);
CREATE INDEX IF NOT EXISTS idx_shared_space_movements_space_id ON shared_space_movements(space_id);
CREATE INDEX IF NOT EXISTS idx_shared_space_movements_sync_status ON shared_space_movements(sync_status);
CREATE INDEX IF NOT EXISTS idx_blocs_sync_status ON blocs(sync_status);
CREATE INDEX IF NOT EXISTS idx_bloc_items_bloc_id ON bloc_items(bloc_id);
CREATE INDEX IF NOT EXISTS idx_bloc_items_sync_status ON bloc_items(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
`;
