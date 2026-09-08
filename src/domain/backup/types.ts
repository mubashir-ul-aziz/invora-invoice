import type { business, socialLink, item, customer, invoice, invoiceItem, payment, appSettings } from '@/data/db/schema';

/**
 * The current on-disk/on-Drive backup format. Bump this whenever the shape of
 * `BackupTables` changes in a way older code couldn't read correctly, and add
 * the old value to `SUPPORTED_BACKUP_FORMAT_VERSIONS` (or a migration step in
 * `validation.ts`) if old backups should keep restoring. A backup whose
 * `formatVersion` isn't supported is rejected up front — see
 * `validateBackupPayload()` — instead of partially applying it.
 */
export const BACKUP_FORMAT_VERSION = 1;

/** Every format version this build knows how to restore. */
export const SUPPORTED_BACKUP_FORMAT_VERSIONS: number[] = [1];

/**
 * One row shape per table, exactly as Drizzle reads/writes it (raw DB rows,
 * not the app's domain types) — see `MVP_BUILD_PLAN.md` §"BACKUP CONTENT".
 * Backup/restore is a data-layer concern: it round-trips the database's own
 * rows rather than going through each feature's higher-level repository, so
 * nothing is lost or reshaped in translation (e.g. `InvoiceItem` snapshot
 * fields, which no domain type re-exposes verbatim).
 */
export interface BackupTables {
  business: (typeof business.$inferSelect)[];
  socialLinks: (typeof socialLink.$inferSelect)[];
  items: (typeof item.$inferSelect)[];
  customers: (typeof customer.$inferSelect)[];
  invoices: (typeof invoice.$inferSelect)[];
  invoiceItems: (typeof invoiceItem.$inferSelect)[];
  payments: (typeof payment.$inferSelect)[];
  appSettings: (typeof appSettings.$inferSelect)[];
}

/** Table names in the fixed order `BackupTables` always lists them — used to keep counts/labels/insert-order in one place. */
export const BACKUP_TABLE_NAMES = [
  'business',
  'socialLinks',
  'items',
  'customers',
  'invoices',
  'invoiceItems',
  'payments',
  'appSettings',
] as const;

export type BackupTableName = (typeof BACKUP_TABLE_NAMES)[number];

/** Row counts per table — a quick "what's in this backup" summary stored alongside history entries without re-parsing the full payload. */
export type BackupCounts = Record<BackupTableName, number>;

export function countBackupTables(tables: BackupTables): BackupCounts {
  return {
    business: tables.business.length,
    socialLinks: tables.socialLinks.length,
    items: tables.items.length,
    customers: tables.customers.length,
    invoices: tables.invoices.length,
    invoiceItems: tables.invoiceItems.length,
    payments: tables.payments.length,
    appSettings: tables.appSettings.length,
  };
}

/**
 * The versioned envelope actually written to / read from Google Drive.
 * `checksum` is computed over the serialized `tables` payload (see
 * `checksum.ts`) so a truncated/corrupted/interrupted upload or download is
 * caught before anything touches the local database — see the "PROTECT
 * AGAINST" list in `MVP_BUILD_PLAN.md`.
 */
export interface BackupPayload {
  formatVersion: number;
  /** Epoch ms the backup was assembled. */
  createdAt: number;
  /** The app's own version (`app.json`'s `expo.version`) at backup time — informational only, not used to gate restore. */
  appVersion: string;
  tables: BackupTables;
  checksum: string;
}

export type BackupTrigger = 'manual' | 'automatic';
export type BackupDirection = 'backup' | 'restore';
export type BackupOutcome = 'success' | 'failure';
/**
 * `'cloud'` (Phase 12 — Optional Cloud Backup) reuses this exact column/type
 * instead of a second history table — see the doc comment on `destination`
 * in `data/db/schema.ts` for why it was left free text from the start.
 */
export type BackupDestination = 'google_drive' | 'cloud';

/** One row of `backup_log` (Phase 11) — see the doc comment on `backupLog` in `data/db/schema.ts`. */
export interface BackupLogEntry {
  id: string;
  direction: BackupDirection;
  trigger: BackupTrigger;
  status: BackupOutcome;
  destination: BackupDestination;
  /** ISO timestamp. */
  startedAt: string;
  /** ISO timestamp, or null if the attempt never reached completion (e.g. the app crashed mid-attempt — see "Known limitations"). */
  finishedAt: string | null;
  formatVersion: number | null;
  sizeBytes: number | null;
  counts: BackupCounts | null;
  errorMessage: string | null;
}

/** Automatic-backup preference + the outcome of the most recent attempt (manual or automatic) — see the doc comment on the new `app_settings` columns. */
export interface BackupSettings {
  autoBackupEnabled: boolean;
  /** ISO timestamp of the most recent *successful* backup, or null if none has ever succeeded. */
  lastBackupAt: string | null;
  /** Outcome of the most recent *attempt*, or null if a backup has never been attempted. */
  lastBackupStatus: BackupOutcome | null;
  lastBackupError: string | null;
}

export type BackupSettingsInput = Pick<BackupSettings, 'autoBackupEnabled'>;

export const EMPTY_BACKUP_SETTINGS: BackupSettings = {
  autoBackupEnabled: false,
  lastBackupAt: null,
  lastBackupStatus: null,
  lastBackupError: null,
};

/** Metadata for one backup file as Google Drive reports it — never the file's content (see `GoogleDriveBackupService`). */
export interface DriveBackupFile {
  id: string;
  name: string;
  /** ISO timestamp Drive recorded for the file, per its `createdTime`. */
  createdAt: string;
  sizeBytes: number | null;
}

/** How many backups to keep on Drive — older ones are pruned only after a new backup is confirmed uploaded (see `BackupService.backupNow()`). */
export const BACKUP_RETENTION_COUNT = 10;
