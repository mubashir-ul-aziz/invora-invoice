import type { BackupTables } from '@/domain/backup/types';

/**
 * The only door the backup use-case layer (`BackupService`) uses to read/write
 * every user-data table at once. Deliberately separate from
 * `BusinessRepository`/`ItemRepository`/etc. — those model each feature's
 * *use cases* (save a profile, list items matching a filter); backup is a
 * data-layer concern that needs the *exact* raw rows of every table
 * (including columns no domain type re-exposes, like `InvoiceItem`'s frozen
 * snapshot fields), so it talks to the database directly instead of composing
 * eight other repositories' higher-level methods.
 */
export interface BackupRepository {
  /** Reads every row of every backed-up table. Never throws for "no data yet" — an empty install just returns empty arrays (see "Test: Backup with no data"). */
  exportAll(): Promise<BackupTables>;

  /**
   * Replaces the *entire* local dataset with `tables`, atomically: either
   * every table ends up exactly as `tables` describes, or (on any error) the
   * database is left completely unchanged — see the "IMPORTANT SAFETY RULE"
   * in `MVP_BUILD_PLAN.md`. Callers must have already validated `tables`
   * (`validateBackupPayload()`) before calling this; this method assumes the
   * data is trustworthy and only guards against a *mid-write* failure
   * (e.g. a schema mismatch), not a malformed/corrupted backup.
   */
  restoreAll(tables: BackupTables): Promise<void>;
}
