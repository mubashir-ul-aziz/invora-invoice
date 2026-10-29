import * as SQLite from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import {
  APP_SETTINGS_COLUMN_UPGRADES,
  BACKUP_LOG_COLUMN_UPGRADES,
  BUSINESS_COLUMN_UPGRADES,
  CREATE_TABLES_SQL,
  CUSTOMER_COLUMN_UPGRADES,
  INVOICE_COLUMN_UPGRADES,
  INVOICE_ITEM_COLUMN_UPGRADES,
  ITEM_COLUMN_UPGRADES,
  SUBSCRIPTION_STATE_COLUMN_UPGRADES,
  schema,
} from './schema';

const DATABASE_NAME = 'metriqo.db';

let sqliteConnection: SQLite.SQLiteDatabase | null = null;
let drizzleDb: ExpoSQLiteDatabase<typeof schema> | null = null;
let readyPromise: Promise<void> | null = null;

/**
 * Opens the on-device SQLite database and makes sure the tables this
 * functionality needs exist.
 *
 * Note on migrations: the canonical schema lives in `db/schema.ts` and its
 * SQL shape is generated for documentation/versioning via
 * `node node_modules/drizzle-kit/bin.cjs generate` (see `/drizzle`). Wiring
 * drizzle's `useMigrations` runner requires a Metro bundler asset-loader
 * config step for the generated migration files that could not be verified
 * against a running device/simulator in this environment. To guarantee
 * correct, offline, idempotent persistence today, the app instead applies
 * the equivalent `CREATE TABLE IF NOT EXISTS` statements directly at
 * startup. Both are kept in lockstep by hand; if that becomes error-prone,
 * switching to the generated migrator is a drop-in change behind this same
 * module boundary — nothing outside `data/db` needs to change.
 */
export function getDatabase(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      sqliteConnection = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await sqliteConnection.execAsync('PRAGMA foreign_keys = ON;');
      await sqliteConnection.execAsync(CREATE_TABLES_SQL);
      await ensureBusinessColumns(sqliteConnection);
      await ensureAppSettingsColumns(sqliteConnection);
      await ensureInvoiceColumns(sqliteConnection);
      await ensureInvoiceItemColumns(sqliteConnection);
      await ensureItemColumns(sqliteConnection);
      await ensureCustomerColumns(sqliteConnection);
      await ensureSubscriptionStateColumns(sqliteConnection);
      await ensureBackupLogColumns(sqliteConnection);
      drizzleDb = drizzle(sqliteConnection, { schema });
    })();
  }
  return readyPromise;
}

/**
 * Backfills `business` columns added after its first release (Phase 2) onto
 * a database that already has the table from before that change. A no-op on
 * a fresh install, since `CREATE_TABLES_SQL` already creates the table with
 * every current column — checked via `PRAGMA table_info` so this never tries
 * to add a column twice (SQLite has no `ADD COLUMN IF NOT EXISTS`).
 */
async function ensureBusinessColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(business);');
  const existingNames = new Set(existingColumns.map((col) => col.name));
  for (const { column, definition } of BUSINESS_COLUMN_UPGRADES) {
    if (!existingNames.has(column)) {
      await db.execAsync(`ALTER TABLE business ADD COLUMN ${column} ${definition};`);
    }
  }
}

/**
 * Backfills `app_settings` columns added after its first release (Phase 10
 * only shipped `app_lock_enabled`/`biometric_unlock_enabled`; Phase 11 added
 * the backup-status columns). Same idempotent `PRAGMA table_info` check as
 * `ensureBusinessColumns()` — a no-op on a fresh install.
 */
async function ensureAppSettingsColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(app_settings);',
  );
  const existingNames = new Set(existingColumns.map((col) => col.name));
  for (const { column, definition } of APP_SETTINGS_COLUMN_UPGRADES) {
    if (!existingNames.has(column)) {
      await db.execAsync(`ALTER TABLE app_settings ADD COLUMN ${column} ${definition};`);
    }
  }
}

/**
 * Backfills `invoice` columns added after its first release (the per-invoice
 * `currency` snapshot). Same idempotent `PRAGMA table_info` check as
 * `ensureBusinessColumns()`. Any invoice still without a currency (saved
 * before the column existed, or restored from an older backup) is then
 * stamped with the business's currency — the one every amount on it was
 * shown in until now — so its amounts keep their meaning; the stored
 * amounts themselves are never touched.
 */
async function ensureInvoiceColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(invoice);');
  const existingNames = new Set(existingColumns.map((col) => col.name));
  for (const { column, definition } of INVOICE_COLUMN_UPGRADES) {
    if (!existingNames.has(column)) {
      await db.execAsync(`ALTER TABLE invoice ADD COLUMN ${column} ${definition};`);
    }
  }
  await db.execAsync(
    "UPDATE invoice SET currency = (SELECT currency FROM business LIMIT 1) WHERE currency IS NULL AND EXISTS (SELECT 1 FROM business);",
  );
}

/**
 * Backfills `invoice_item` columns added after its first release (this
 * refactor's `pricing_method` snapshot column). Same idempotent
 * `PRAGMA table_info` check as `ensureBusinessColumns()` — a no-op on a
 * fresh install, since `CREATE_TABLES_SQL` already creates the table with
 * this column.
 */
async function ensureInvoiceItemColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(invoice_item);',
  );
  const existingNames = new Set(existingColumns.map((col) => col.name));
  for (const { column, definition } of INVOICE_ITEM_COLUMN_UPGRADES) {
    if (!existingNames.has(column)) {
      await db.execAsync(`ALTER TABLE invoice_item ADD COLUMN ${column} ${definition};`);
    }
  }
}

/**
 * Backfills `item` columns added after its first release (this refactor's
 * `weight_unit`/`length_unit` columns). Same idempotent `PRAGMA table_info`
 * check as `ensureBusinessColumns()` — a no-op on a fresh install.
 */
async function ensureItemColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(item);');
  const existingNames = new Set(existingColumns.map((col) => col.name));
  for (const { column, definition } of ITEM_COLUMN_UPGRADES) {
    if (!existingNames.has(column)) {
      await db.execAsync(`ALTER TABLE item ADD COLUMN ${column} ${definition};`);
    }
  }
}

/**
 * Backfills `customer` columns added after its first release (this
 * refactor's `website` column). Same idempotent `PRAGMA table_info` check as
 * `ensureBusinessColumns()` — a no-op on a fresh install.
 */
async function ensureCustomerColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(customer);');
  const existingNames = new Set(existingColumns.map((col) => col.name));
  for (const { column, definition } of CUSTOMER_COLUMN_UPGRADES) {
    if (!existingNames.has(column)) {
      await db.execAsync(`ALTER TABLE customer ADD COLUMN ${column} ${definition};`);
    }
  }
}

/**
 * Backfills `subscription_state` columns added after its first release (the
 * Account + Subscription Identity model's `revenue_cat_user_id`). Same
 * idempotent `PRAGMA table_info` check as `ensureBusinessColumns()` — a no-op
 * on a fresh install, since `CREATE_TABLES_SQL` already creates the table
 * with this column.
 */
async function ensureSubscriptionStateColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(subscription_state);',
  );
  const existingNames = new Set(existingColumns.map((col) => col.name));
  for (const { column, definition } of SUBSCRIPTION_STATE_COLUMN_UPGRADES) {
    if (!existingNames.has(column)) {
      await db.execAsync(`ALTER TABLE subscription_state ADD COLUMN ${column} ${definition};`);
    }
  }
}

/**
 * Backfills `backup_log` columns added after its first release (file name,
 * local file path, Drive file id). Same idempotent `PRAGMA table_info` check
 * as `ensureBusinessColumns()`. Rows logged before this simply have them
 * null, and the history list shows them without file actions.
 */
async function ensureBackupLogColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const existingColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(backup_log);');
  const existingNames = new Set(existingColumns.map((col) => col.name));
  for (const { column, definition } of BACKUP_LOG_COLUMN_UPGRADES) {
    if (!existingNames.has(column)) {
      await db.execAsync(`ALTER TABLE backup_log ADD COLUMN ${column} ${definition};`);
    }
  }
}

export function getDrizzle(): ExpoSQLiteDatabase<typeof schema> {
  if (!drizzleDb) {
    throw new Error('Database not initialized — call getDatabase() first.');
  }
  return drizzleDb;
}

/** Test/dev-only escape hatch so each test file starts from a clean state. */
export function __resetDatabaseForTests(): void {
  sqliteConnection = null;
  drizzleDb = null;
  readyPromise = null;
}
