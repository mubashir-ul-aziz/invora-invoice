import { z } from 'zod';

import { computeChecksum } from './checksum';
import {
  BACKUP_FORMAT_VERSION,
  SUPPORTED_BACKUP_FORMAT_VERSIONS,
  type BackupPayload,
  type BackupTables,
} from './types';

/** Why a backup file was rejected — surfaced to the UI as a specific, honest message instead of a generic "restore failed". */
export type BackupValidationReason = 'malformed' | 'corrupted' | 'incompatible_version';

export class BackupValidationError extends Error {
  readonly reason: BackupValidationReason;

  constructor(reason: BackupValidationReason, message: string) {
    super(message);
    this.name = 'BackupValidationError';
    this.reason = reason;
  }
}

// Every row is stored/restored as the database itself shaped it (Drizzle's
// `$inferSelect`), so this only checks "is this an array of plain objects",
// not each column — a wrong/missing column surfaces as a clear SQLite error
// from `BackupRepository.restoreAll()` (inside its rollback-safe transaction)
// rather than being silently reshaped here.
const tableRowsSchema = z.array(z.record(z.string(), z.unknown()));

const backupTablesSchema = z.object({
  business: tableRowsSchema,
  socialLinks: tableRowsSchema,
  items: tableRowsSchema,
  customers: tableRowsSchema,
  invoices: tableRowsSchema,
  invoiceItems: tableRowsSchema,
  payments: tableRowsSchema,
  appSettings: tableRowsSchema,
});

const backupPayloadSchema = z.object({
  formatVersion: z.number().int(),
  createdAt: z.number(),
  appVersion: z.string(),
  tables: backupTablesSchema,
  checksum: z.string().min(1),
});

/**
 * The one gate every restore must pass through before `BackupRepository`
 * ever sees the data — validates structure, format-version compatibility,
 * and checksum integrity, in that order, and throws a typed
 * `BackupValidationError` naming exactly which one failed. Called on the raw
 * string read back from Google Drive (or a local staged file); the caller
 * never touches the local database until this returns successfully — see
 * `BackupService.restoreBackup()` and the "IMPORTANT SAFETY RULE" in
 * `MVP_BUILD_PLAN.md`.
 */
export function validateBackupPayload(raw: string): BackupPayload {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new BackupValidationError(
      'malformed',
      'This backup file is not valid — it may be incomplete or corrupted.',
    );
  }

  const shapeResult = backupPayloadSchema.safeParse(parsedJson);
  if (!shapeResult.success) {
    throw new BackupValidationError(
      'malformed',
      'This backup file is missing data Invora expects — it may be from an unrelated file or a partially-written backup.',
    );
  }
  const payload = shapeResult.data as BackupPayload;

  if (!SUPPORTED_BACKUP_FORMAT_VERSIONS.includes(payload.formatVersion)) {
    const tooNew = payload.formatVersion > BACKUP_FORMAT_VERSION;
    throw new BackupValidationError(
      'incompatible_version',
      tooNew
        ? 'This backup was made by a newer version of Invora. Update the app before restoring it.'
        : 'This backup format is no longer supported.',
    );
  }

  const expectedChecksum = computeChecksum(JSON.stringify(payload.tables));
  if (expectedChecksum !== payload.checksum) {
    throw new BackupValidationError(
      'corrupted',
      'This backup file appears to be corrupted or was only partially downloaded/uploaded — its contents don\'t match its checksum.',
    );
  }

  return payload;
}

/** Builds the versioned envelope (`BackupPayload`) around freshly-exported table rows — the write-side counterpart to `validateBackupPayload()`. Pure: takes rows already read from the database, doesn't read them itself. */
export function buildBackupPayload(
  tables: BackupTables,
  appVersion: string,
  createdAt: number = Date.now(),
): BackupPayload {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt,
    appVersion,
    tables,
    checksum: computeChecksum(JSON.stringify(tables)),
  };
}
