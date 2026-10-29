import { create } from 'zustand';

import type { BackupLogRepository } from '@/data/backup/BackupLogRepository';
import type { BackupRestoreService, PreparedRestore, RestoreResult, RestoreSource } from '@/data/backup/BackupRestoreService';
import type { BackupService } from '@/data/backup/BackupService';
import type { BackupSettingsRepository } from '@/data/backup/BackupSettingsRepository';
import type { BackupFileExchange, SaveCopyOutcome } from '@/data/backup/files/BackupFileExchange';
import type { GoogleDriveBackupService } from '@/data/backup/googleDrive/GoogleDriveBackupService';
import type { LocalBackupService } from '@/data/backup/LocalBackupService';
import {
  getBackupFileExchange,
  getBackupLogRepository,
  getBackupRestoreService,
  getBackupService,
  getBackupSettingsRepository,
  getGoogleDriveBackupService,
  getLocalBackupService,
} from '@/data/container';
import { buildBackupHistory, type BackupHistoryItem } from '@/domain/backup/history';
import {
  EMPTY_BACKUP_SETTINGS,
  type BackupLogEntry,
  type BackupPreview,
  type BackupSettings,
  type DriveBackupFile,
} from '@/domain/backup/types';

import { refreshAppDataAfterRestore } from './appDataRefresh';

/** A backup is considered "due" for the automatic trigger after this long since the last successful one — see `runAutomaticBackupIfDue()`. There's no true background scheduler (see `AutoBackupRunner`), so this is only ever checked opportunistically, when the app is opened or foregrounded. */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type BackupStatus = 'idle' | 'loading' | 'ready' | 'error';

/** What the screen is busy with — at most one backup/restore action runs at a time. */
export type BackupBusyAction = 'signing_in' | 'drive_backup' | 'export' | 'preparing' | 'restoring' | 'sharing' | 'deleting';

/** Result of reading and validating a backup before restoring it. `ready` means the preview is in `pendingRestore`, awaiting confirmation. */
export type PrepareOutcome =
  | { status: 'ready'; preview: BackupPreview }
  | { status: 'cancelled' }
  | { status: 'invalid'; message: string };

interface BackupState {
  status: BackupStatus;
  busy: BackupBusyAction | null;
  signedIn: boolean;
  accountEmail: string | null;
  settings: BackupSettings;
  /** This device's persistent log, newest first. */
  history: BackupLogEntry[];
  remoteBackups: DriveBackupFile[];
  remoteListLoaded: boolean;
  /** `history` merged with the Drive file list — what the screen renders. */
  items: BackupHistoryItem[];
  /** A validated backup waiting for the user's confirmation. Nothing has been replaced yet. */
  pendingRestore: PreparedRestore | null;
  error: string | null;
  load: () => Promise<void>;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  setAutoBackupEnabled: (enabled: boolean) => Promise<void>;
  /** Back up to Google Drive now. */
  backupNow: () => Promise<BackupLogEntry>;
  /** "Export Backup": a durable local file + history entry. Offering Download/Share is up to the screen. */
  exportBackup: () => Promise<BackupLogEntry>;
  /** Opens the share sheet for a history item's file. Throws when the file can't be read or sharing is unavailable. */
  shareItem: (item: BackupHistoryItem) => Promise<void>;
  /** Android: writes a copy of the item's file to a folder the user picks. */
  saveItemToDevice: (item: BackupHistoryItem) => Promise<SaveCopyOutcome>;
  /** "Import Backup": pick a file, read and validate it. */
  importBackup: () => Promise<PrepareOutcome>;
  /** Restore from the history list: read and validate the item's file. */
  prepareRestoreFromItem: (item: BackupHistoryItem) => Promise<PrepareOutcome>;
  /** Safety backup, then replace the data with `pendingRestore`. Refreshes the whole app on success. */
  confirmRestore: () => Promise<RestoreResult | null>;
  cancelRestore: () => void;
  /** Deletes the item's file — locally or on Google Drive — and its history row. Throws on failure. */
  deleteItem: (item: BackupHistoryItem) => Promise<void>;
  refreshRemoteBackups: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  /** Called opportunistically (app launch / foreground) — see `AUTO_BACKUP_INTERVAL_MS` and `AutoBackupRunner`. Never throws; a failed automatic attempt is just logged like any other. */
  runAutomaticBackupIfDue: () => Promise<void>;
}

interface BackupStoreDeps {
  backupService: BackupService;
  localBackupService: LocalBackupService;
  restoreService: BackupRestoreService;
  exchange: BackupFileExchange;
  driveService: GoogleDriveBackupService;
  settingsRepository: BackupSettingsRepository;
  logRepository: BackupLogRepository;
  /** Clock used only for the "is it due yet" comparison in `runAutomaticBackupIfDue()`. */
  now: () => number;
  /** Reloads the rest of the app after a successful restore. */
  onRestored: () => Promise<void>;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sourceFor(item: BackupHistoryItem): RestoreSource {
  if (item.location === 'local' && item.entry) {
    return { kind: 'local', entry: item.entry };
  }
  const fileId = item.remote?.id ?? item.entry?.remoteFileId;
  if (item.location === 'google_drive' && fileId) {
    return { kind: 'google_drive', fileId, fileName: item.fileName };
  }
  throw new Error('This backup file is not available.');
}

/**
 * Dependencies are resolved lazily so tests can inject fakes before anything
 * touches the database or a real network call — same pattern as every other
 * store in this codebase (e.g. `securityStore`).
 */
export function createBackupStore(deps?: Partial<BackupStoreDeps>) {
  const backupService = deps?.backupService ?? getBackupService();
  const localBackupService = deps?.localBackupService ?? getLocalBackupService();
  const restoreService = deps?.restoreService ?? getBackupRestoreService();
  const exchange = deps?.exchange ?? getBackupFileExchange();
  const driveService = deps?.driveService ?? getGoogleDriveBackupService();
  const settingsRepository = deps?.settingsRepository ?? getBackupSettingsRepository();
  const logRepository = deps?.logRepository ?? getBackupLogRepository();
  const now = deps?.now ?? Date.now;
  const onRestored = deps?.onRestored ?? refreshAppDataAfterRestore;

  return create<BackupState>((set, get) => {
    /** Sets state and keeps the merged `items` list in sync with `history`/`remoteBackups`/`signedIn`. */
    const update = (patch: Partial<BackupState>) => {
      const next = { ...get(), ...patch };
      set({
        ...patch,
        items: buildBackupHistory({
          history: next.history,
          remoteBackups: next.remoteBackups,
          driveSignedIn: next.signedIn,
          remoteListLoaded: next.remoteListLoaded,
        }),
      });
    };

    const reloadHistoryAndSettings = async () => {
      const [settings, history] = await Promise.all([settingsRepository.getSettings(), logRepository.list()]);
      update({ settings, history });
    };

    const prepare = async (source: RestoreSource): Promise<PrepareOutcome> => {
      update({ busy: 'preparing', error: null, pendingRestore: null });
      try {
        const prepared = await restoreService.prepare(source);
        update({ busy: null, pendingRestore: prepared });
        return { status: 'ready', preview: prepared.preview };
      } catch (err) {
        update({ busy: null });
        return { status: 'invalid', message: messageOf(err) };
      }
    };

    const contentOf = async (item: BackupHistoryItem): Promise<string> => {
      const source = sourceFor(item);
      if (source.kind === 'local') return localBackupService.read(source.entry);
      if (source.kind === 'google_drive') return backupService.downloadBackup(source.fileId);
      throw new Error('This backup file is not available.');
    };

    return {
      status: 'idle',
      busy: null,
      signedIn: false,
      accountEmail: null,
      settings: EMPTY_BACKUP_SETTINGS,
      history: [],
      remoteBackups: [],
      remoteListLoaded: false,
      items: [],
      pendingRestore: null,
      error: null,

      load: async () => {
        update({ status: 'loading', error: null });
        try {
          const [settings, signedIn, history, accountEmail] = await Promise.all([
            settingsRepository.getSettings(),
            driveService.isSignedIn(),
            logRepository.list(),
            driveService.getAccountEmail(),
          ]);
          update({ settings, signedIn, history, accountEmail, status: 'ready' });
        } catch (err) {
          update({ status: 'error', error: messageOf(err) });
        }
      },

      signIn: async () => {
        update({ busy: 'signing_in', error: null });
        try {
          await driveService.signIn();
          const [remoteBackups, accountEmail] = await Promise.all([
            driveService.listBackups().catch(() => null),
            driveService.getAccountEmail(),
          ]);
          update({
            signedIn: true,
            accountEmail,
            remoteBackups: remoteBackups ?? [],
            remoteListLoaded: remoteBackups !== null,
            busy: null,
          });
          return true;
        } catch (err) {
          update({ busy: null, error: messageOf(err) });
          return false;
        }
      },

      signOut: async () => {
        await driveService.signOut();
        update({ signedIn: false, accountEmail: null, remoteBackups: [], remoteListLoaded: false });
      },

      setAutoBackupEnabled: async (enabled: boolean) => {
        const settings = await settingsRepository.saveSettings({ autoBackupEnabled: enabled });
        update({ settings });
      },

      backupNow: async () => {
        update({ busy: 'drive_backup', error: null });
        const entry = await backupService.backupNow('manual');
        await reloadHistoryAndSettings();
        update({ busy: null, error: entry.status === 'failure' ? entry.errorMessage : null });
        await get().refreshRemoteBackups();
        return entry;
      },

      exportBackup: async () => {
        update({ busy: 'export', error: null });
        const entry = await localBackupService.exportBackup();
        await reloadHistoryAndSettings();
        update({ busy: null, error: entry.status === 'failure' ? entry.errorMessage : null });
        return entry;
      },

      shareItem: async (item) => {
        update({ busy: 'sharing' });
        try {
          const source = sourceFor(item);
          if (source.kind === 'local' && source.entry.fileUri) {
            await exchange.shareFile(source.entry.fileUri);
          } else {
            await exchange.shareContent(item.fileName ?? 'metriqo-backup.json', await contentOf(item));
          }
        } finally {
          update({ busy: null });
        }
      },

      saveItemToDevice: async (item) => {
        update({ busy: 'sharing' });
        try {
          return await exchange.saveCopyToDevice(item.fileName ?? 'metriqo-backup.json', await contentOf(item));
        } finally {
          update({ busy: null });
        }
      },

      importBackup: async () => {
        update({ busy: 'preparing', error: null });
        let file;
        try {
          file = await exchange.pickBackupFile();
        } catch (err) {
          update({ busy: null });
          return { status: 'invalid', message: messageOf(err) };
        }
        if (!file) {
          update({ busy: null });
          return { status: 'cancelled' };
        }
        return prepare({ kind: 'picked_file', file });
      },

      prepareRestoreFromItem: async (item) => {
        let source: RestoreSource;
        try {
          source = sourceFor(item);
        } catch (err) {
          return { status: 'invalid', message: messageOf(err) };
        }
        return prepare(source);
      },

      confirmRestore: async () => {
        const prepared = get().pendingRestore;
        if (!prepared) {
          return null;
        }
        update({ busy: 'restoring', error: null, pendingRestore: null });
        const result = await restoreService.restore(prepared);
        await reloadHistoryAndSettings();
        update({ busy: null, error: result.entry.status === 'failure' ? result.entry.errorMessage : null });
        if (result.entry.status === 'success') {
          await onRestored().catch(() => undefined);
        }
        return result;
      },

      cancelRestore: () => {
        update({ pendingRestore: null });
      },

      deleteItem: async (item) => {
        update({ busy: 'deleting' });
        try {
          if (item.location === 'local' && item.entry) {
            await localBackupService.delete(item.entry);
          } else if (item.location === 'google_drive') {
            const fileId = item.remote?.id ?? item.entry?.remoteFileId;
            if (!fileId) throw new Error('This backup file is not available.');
            await backupService.deleteRemoteBackup(fileId, item.entry?.id ?? null);
            update({ remoteBackups: get().remoteBackups.filter((file) => file.id !== fileId) });
          } else {
            throw new Error('This entry has no backup file to delete.');
          }
          await reloadHistoryAndSettings();
        } finally {
          update({ busy: null });
        }
      },

      refreshRemoteBackups: async () => {
        if (!get().signedIn) {
          return;
        }
        try {
          const remoteBackups = await driveService.listBackups();
          update({ remoteBackups, remoteListLoaded: true });
        } catch (err) {
          update({ error: messageOf(err) });
        }
      },

      refreshHistory: async () => {
        update({ history: await logRepository.list() });
      },

      runAutomaticBackupIfDue: async () => {
        const { settings, signedIn, busy } = get();
        if (!settings.autoBackupEnabled || !signedIn || busy !== null) {
          return;
        }
        const lastBackupAt = settings.lastBackupAt ? new Date(settings.lastBackupAt).getTime() : null;
        const due = lastBackupAt === null || now() - lastBackupAt >= AUTO_BACKUP_INTERVAL_MS;
        if (!due) {
          return;
        }
        try {
          await backupService.backupNow('automatic');
        } finally {
          await reloadHistoryAndSettings().catch(() => undefined);
        }
      },
    };
  });
}

/** App-wide singleton store, wired to the real repositories/services. */
export const useBackupStore = createBackupStore();
