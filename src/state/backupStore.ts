import { create } from 'zustand';

import { BackupService } from '@/data/backup/BackupService';
import type { BackupLogRepository } from '@/data/backup/BackupLogRepository';
import type { BackupSettingsRepository } from '@/data/backup/BackupSettingsRepository';
import type { GoogleDriveBackupService } from '@/data/backup/googleDrive/GoogleDriveBackupService';
import {
  getBackupLogRepository,
  getBackupService,
  getBackupSettingsRepository,
  getGoogleDriveBackupService,
} from '@/data/container';
import {
  EMPTY_BACKUP_SETTINGS,
  type BackupLogEntry,
  type BackupSettings,
  type DriveBackupFile,
} from '@/domain/backup/types';

/** A backup is considered "due" for the automatic trigger after this long since the last successful one — see `runAutomaticBackupIfDue()`. There's no true background scheduler (see IMPLEMENTATION_STATUS.md), so this is only ever checked opportunistically, when the app is foregrounded. */
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type BackupStatus = 'idle' | 'loading' | 'running' | 'ready' | 'error';

interface BackupState {
  status: BackupStatus;
  signedIn: boolean;
  settings: BackupSettings;
  history: BackupLogEntry[];
  remoteBackups: DriveBackupFile[];
  error: string | null;
  load: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setAutoBackupEnabled: (enabled: boolean) => Promise<void>;
  backupNow: () => Promise<BackupLogEntry>;
  restore: (fileId: string) => Promise<BackupLogEntry>;
  refreshRemoteBackups: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  /** Called opportunistically (app launch / foreground) — see the doc comment on `AUTO_BACKUP_INTERVAL_MS` and `AutoBackupRunner`. Never throws; a failed automatic attempt is just logged like any other. */
  runAutomaticBackupIfDue: () => Promise<void>;
}

interface BackupStoreDeps {
  backupService: BackupService;
  driveService: GoogleDriveBackupService;
  settingsRepository: BackupSettingsRepository;
  logRepository: BackupLogRepository;
  /** Clock used only for the "is it due yet" comparison in `runAutomaticBackupIfDue()` — injectable so tests don't depend on real wall-clock time. Defaults to `Date.now`. */
  now: () => number;
}

/**
 * Dependencies are resolved lazily so tests can inject fakes before anything
 * touches the database or a real network call — same pattern as every other
 * store in this codebase (e.g. `securityStore`).
 */
export function createBackupStore(deps?: Partial<BackupStoreDeps>) {
  const backupService = deps?.backupService ?? getBackupService();
  const driveService = deps?.driveService ?? getGoogleDriveBackupService();
  const settingsRepository = deps?.settingsRepository ?? getBackupSettingsRepository();
  const logRepository = deps?.logRepository ?? getBackupLogRepository();
  const now = deps?.now ?? Date.now;

  return create<BackupState>((set, get) => ({
    status: 'idle',
    signedIn: false,
    settings: EMPTY_BACKUP_SETTINGS,
    history: [],
    remoteBackups: [],
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const [settings, signedIn, history] = await Promise.all([
          settingsRepository.getSettings(),
          driveService.isSignedIn(),
          logRepository.list(),
        ]);
        set({ settings, signedIn, history, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    signIn: async () => {
      set({ status: 'running', error: null });
      try {
        await driveService.signIn();
        const remoteBackups = await driveService.listBackups().catch(() => []);
        set({ signedIn: true, remoteBackups, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    signOut: async () => {
      await driveService.signOut();
      set({ signedIn: false, remoteBackups: [] });
    },

    setAutoBackupEnabled: async (enabled: boolean) => {
      const settings = await settingsRepository.saveSettings({ autoBackupEnabled: enabled });
      set({ settings });
    },

    backupNow: async () => {
      set({ status: 'running', error: null });
      const entry = await backupService.backupNow('manual');
      const [settings, history] = await Promise.all([settingsRepository.getSettings(), logRepository.list()]);
      set({
        settings,
        history,
        status: entry.status === 'success' ? 'ready' : 'error',
        error: entry.status === 'failure' ? entry.errorMessage : null,
      });
      return entry;
    },

    restore: async (fileId: string) => {
      set({ status: 'running', error: null });
      const entry = await backupService.restoreBackup(fileId, 'manual');
      const history = await logRepository.list();
      set({
        history,
        status: entry.status === 'success' ? 'ready' : 'error',
        error: entry.status === 'failure' ? entry.errorMessage : null,
      });
      return entry;
    },

    refreshRemoteBackups: async () => {
      try {
        const remoteBackups = await driveService.listBackups();
        set({ remoteBackups });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    refreshHistory: async () => {
      const history = await logRepository.list();
      set({ history });
    },

    runAutomaticBackupIfDue: async () => {
      const { settings, signedIn } = get();
      if (!settings.autoBackupEnabled || !signedIn) {
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
        const [refreshedSettings, history] = await Promise.all([
          settingsRepository.getSettings(),
          logRepository.list(),
        ]);
        set({ settings: refreshedSettings, history });
      }
    },
  }));
}

/** App-wide singleton store, wired to the real repositories/services. */
export const useBackupStore = createBackupStore();
