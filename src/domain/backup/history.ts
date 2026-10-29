import { backupSourceLabel } from './formatting';
import type { BackupCounts, BackupLogEntry, BackupOutcome, DriveBackupFile } from './types';

/** Where a history item's backup file lives — decides what Delete removes and how Restore/Share read it. */
export type BackupFileLocation = 'local' | 'google_drive';

export interface BackupHistoryActions {
  share: boolean;
  restore: boolean;
  delete: boolean;
}

/** One row of the Backup & Restore screen's history list. */
export interface BackupHistoryItem {
  key: string;
  /** The logged attempt; null for a Google Drive file this device never logged (made before history recorded Drive file ids, or by another install). */
  entry: BackupLogEntry | null;
  /** The Drive file, when the item is (or points at) one that is currently listed on Drive. */
  remote: DriveBackupFile | null;
  title: string;
  /** ISO timestamp. */
  occurredAt: string;
  status: BackupOutcome;
  sizeBytes: number | null;
  counts: BackupCounts | null;
  errorMessage: string | null;
  fileName: string | null;
  location: BackupFileLocation | null;
  actions: BackupHistoryActions;
  /** Why a backup that has a file can't be used right now (e.g. not signed in to Drive). */
  unavailableReason: string | null;
}

const NO_ACTIONS: BackupHistoryActions = { share: false, restore: false, delete: false };
const ALL_ACTIONS: BackupHistoryActions = { share: true, restore: true, delete: true };

export interface BuildHistoryParams {
  history: BackupLogEntry[];
  remoteBackups: DriveBackupFile[];
  driveSignedIn: boolean;
  /** True once `remoteBackups` has been fetched from Drive at least once while signed in — until then a Drive entry missing from the list may just not be loaded yet. */
  remoteListLoaded: boolean;
}

function itemFor(entry: BackupLogEntry, params: BuildHistoryParams, remoteById: Map<string, DriveBackupFile>): BackupHistoryItem {
  const base: BackupHistoryItem = {
    key: entry.id,
    entry,
    remote: null,
    title: backupSourceLabel(entry),
    occurredAt: entry.startedAt,
    status: entry.status,
    sizeBytes: entry.sizeBytes,
    counts: entry.counts,
    errorMessage: entry.errorMessage,
    fileName: entry.fileName,
    location: null,
    actions: NO_ACTIONS,
    unavailableReason: null,
  };

  if (entry.direction !== 'backup' || entry.status !== 'success') {
    return base;
  }
  if (entry.destination === 'local' && entry.fileUri) {
    return { ...base, location: 'local', actions: ALL_ACTIONS };
  }
  if (entry.destination === 'google_drive' && entry.remoteFileId) {
    const remote = remoteById.get(entry.remoteFileId) ?? null;
    if (!params.driveSignedIn) {
      return { ...base, location: 'google_drive', unavailableReason: 'Sign in to Google Drive to use this backup.' };
    }
    if (params.remoteListLoaded && !remote) {
      return { ...base, unavailableReason: 'No longer on Google Drive (deleted or replaced by newer backups).' };
    }
    return { ...base, remote, location: 'google_drive', actions: ALL_ACTIONS };
  }
  return base;
}

/**
 * Merges this device's persistent backup log with the files currently on
 * Google Drive into one newest-first list. Every logged attempt is shown
 * (successes and failures, backups and restores); only a successful backup
 * whose file still exists gets actions. Drive files no log entry points at
 * are listed too, so nothing restorable is hidden.
 */
export function buildBackupHistory(params: BuildHistoryParams): BackupHistoryItem[] {
  const remoteById = new Map(params.remoteBackups.map((file) => [file.id, file]));
  const tracked = new Set(params.history.map((entry) => entry.remoteFileId).filter((value): value is string => !!value));

  const items = params.history.map((entry) => itemFor(entry, params, remoteById));
  if (params.driveSignedIn) {
    for (const file of params.remoteBackups) {
      if (tracked.has(file.id)) continue;
      items.push({
        key: `drive:${file.id}`,
        entry: null,
        remote: file,
        title: 'Google Drive backup',
        occurredAt: file.createdAt,
        status: 'success',
        sizeBytes: file.sizeBytes,
        counts: null,
        errorMessage: null,
        fileName: file.name,
        location: 'google_drive',
        actions: ALL_ACTIONS,
        unavailableReason: null,
      });
    }
  }
  return items.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
}
