import * as SQLite from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import {
  APP_SETTINGS_COLUMN_UPGRADES,
  BUSINESS_COLUMN_UPGRADES,
  CREATE_TABLES_SQL,
  schema,
} from './schema';

const DATABASE_NAME = 'invora.db';

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
