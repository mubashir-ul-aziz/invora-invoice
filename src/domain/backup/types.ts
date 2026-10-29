import type { business, socialLink, item, customer, invoice, invoiceItem, payment } from '@/data/db/schema';

/**
 * The current backup format, shared by Google Drive, cloud and local-file
 * backups. Bump this whenever the shape of `BackupPayload` changes in a way
 * older code couldn't read correctly, and keep the old value in
 * `SUPPORTED_BACKUP_FORMAT_VERSIONS` (with a normalization step in
 * `validation.ts`) if old backups should keep restoring. A backup whose
 * `formatVersion` isn't supported is rejected up front — see
 * `validateBackupPayload()` — instead of partially applying it.
 *
 * Version history:
 *  - 1: every user table plus the whole `app_settings` row; the business
 *    logo was only a device file path (`business.logoUri`).
 *  - 2: drops `app_settings` (device settings: App Lock, backup/sync state),
 *    embeds the logo image itself in `assets.logo`, and adds the `app`
 *    marker. Version 1 files still restore (see `normalizeV1()`).
 */
export const BACKUP_FORMAT_VERSION = 2;

/** Every format version this build knows how to restore. */
export const SUPPORTED_BACKUP_FORMAT_VERSIONS: number[] = [1, 2];

/** Identifies a version-2+ file as a Metriqo backup, so an unrelated JSON file is rejected with a clear message. */
export const BACKUP_APP_ID = 'metriqo-invoice';

/** Largest backup file Metriqo will read. Far above what a small business's data reaches; stops a wrong (huge) file from being loaded into memory. */
export const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;

/** Largest embedded logo (decoded bytes). The picker crops and compresses logos, so real ones are a few hundred KB. */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/**
 * One row shape per table, exactly as Drizzle reads/writes it (raw DB rows,
 * not the app's domain types). Backup/restore is a data-layer concern: it
 * round-trips the database's own rows rather than going through each
 * feature's higher-level repository, so nothing is lost or reshaped in
 * translation (e.g. `InvoiceItem` snapshot fields, each invoice's own
 * `currency`), and original ids and timestamps are preserved.
 *
 * What is deliberately NOT here (never exported, never touched by a
 * restore): `app_settings` (App Lock, biometrics, auto/cloud backup flags
 * and status — this device's settings, not business data),
 * `subscription_state` (RevenueCat is the only plan authority),
 * `user_identity` (this install's RevenueCat identity), `backup_log` (this
 * device's history) and anything in SecureStore (Google tokens, the cache
 * signing secret). The portable preferences — invoice prefix and next
 * number, default tax/terms/template, invoice type, custom fields and units,
 * currency — all live on the `business` row, so they travel with it.
 */
export interface BackupTables {
  business: (typeof business.$inferSelect)[];
  socialLinks: (typeof socialLink.$inferSelect)[];
  items: (typeof item.$inferSelect)[];
  customers: (typeof customer.$inferSelect)[];
  invoices: (typeof invoice.$inferSelect)[];
  invoiceItems: (typeof invoiceItem.$inferSelect)[];
  payments: (typeof payment.$inferSelect)[];
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
  };
}

export const BACKUP_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type BackupImageMimeType = (typeof BACKUP_IMAGE_MIME_TYPES)[number];

/** An image carried inside the backup file itself (base64), so it survives a move to another device — unlike a device file path. */
export interface BackupImageAsset {
  mimeType: BackupImageMimeType;
  base64: string;
}

export interface BackupAssets {
  /** The business logo. In a version-2 payload `business.logoUri` is always null; restore writes this image to a durable file and points the row at it. */
  logo: BackupImageAsset | null;
}

export const EMPTY_BACKUP_ASSETS: BackupAssets = { logo: null };

/**
 * The versioned envelope written to Google Drive, the cloud, or a local
 * `.json` file. `checksum` covers `tables` and `assets` (see `checksum.ts`)
 * so a truncated/corrupted/interrupted file is caught before anything
 * touches the local database.
 */
export interface BackupPayload {
  formatVersion: number;
  /** Epoch ms the backup was assembled. */
  createdAt: number;
  /** The app's own version (`app.json`'s `expo.version`) at backup time — informational only, not used to gate restore. */
  appVersion: string;
  tables: BackupTables;
  assets: BackupAssets;
  checksum: string;
}

/**
 * `'safety'` is the automatic copy of the current data taken right before a
 * restore replaces it — so a wrong restore can itself be undone.
 */
export type BackupTrigger = 'manual' | 'automatic' | 'safety';
export type BackupDirection = 'backup' | 'restore';
export type BackupOutcome = 'success' | 'failure';
/**
 * Where a backup was stored / a restore came from. `'cloud'` (Phase 12) and
 * `'local'` (a `.json` file in this app's own storage, or one the user
 * picked to import) reuse the same history table — see the doc comment on
 * `destination` in `data/db/schema.ts`.
 */
export type BackupDestination = 'google_drive' | 'cloud' | 'local';

/** One row of `backup_log` — see the doc comment on `backupLog` in `data/db/schema.ts`. */
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
  /** The backup file's name (`metriqo-backup-….json`); null for entries from before this was recorded. */
  fileName: string | null;
  /** For a `'local'` backup: the durable file in this app's storage. Null otherwise, and for imports (the picked file isn't kept). */
  fileUri: string | null;
  /** For a `'google_drive'` backup: the Drive file id, so the entry can be restored, shared or deleted. */
  remoteFileId: string | null;
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

/** What the restore confirmation shows about a validated backup before anything is replaced. */
export interface BackupPreview {
  formatVersion: number;
  /** ISO timestamp the backup was made. */
  createdAt: string;
  appVersion: string;
  businessName: string | null;
  counts: BackupCounts;
  hasLogo: boolean;
  sizeBytes: number;
}
