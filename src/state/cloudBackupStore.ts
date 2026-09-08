import { create } from 'zustand';

import { CloudBackupService } from '@/data/cloudBackup/CloudBackupService';
import type { CloudBackupSettingsRepository } from '@/data/cloudBackup/CloudBackupSettingsRepository';
import {
  getBackupLogRepository,
  getCloudBackupService,
  getCloudBackupSettingsRepository,
  getCloudUpgradeService,
} from '@/data/container';
import type { BackupLogRepository } from '@/data/backup/BackupLogRepository';
import type { CloudUpgradeResult, CloudUpgradeService } from '@/data/subscription/CloudUpgradeService';
import type { BackupLogEntry } from '@/domain/backup/types';
import {
  EMPTY_CLOUD_BACKUP_SETTINGS,
  type CloudBackupFile,
  type CloudBackupSettings,
  type CloudStoragePlan,
  type CloudStoragePlanId,
  type CloudStorageUsage,
} from '@/domain/cloudBackup/types';

export type CloudBackupStatus = 'idle' | 'loading' | 'running' | 'ready' | 'error';

interface CloudBackupState {
  status: CloudBackupStatus;
  settings: CloudBackupSettings;
  /** `BackupLogRepository.list()` filtered to `destination === 'cloud'` — the log table is shared with Google Drive backup (Phase 11), see `CloudBackupService`'s doc comment. */
  history: BackupLogEntry[];
  remoteBackups: CloudBackupFile[];
  storageUsage: CloudStorageUsage | null;
  error: string | null;
  load: () => Promise<void>;
  setCloudBackupEnabled: (enabled: boolean) => Promise<void>;
  backupNow: () => Promise<BackupLogEntry>;
  restore: (fileId: string) => Promise<BackupLogEntry>;
  refreshRemoteBackups: () => Promise<void>;
  refreshStorageUsage: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  /** Static plan registry, via `CloudUpgradeService` — see its doc comment on why this stays a seam instead of a direct `domain/cloudBackup/types` import from `UpgradeStorageScreen` (keeps that screen off `data/container` entirely, same "screens depend only on the store" rule every other screen follows). */
  getUpgradePlans: () => CloudStoragePlan[];
  requestUpgrade: (planId: CloudStoragePlanId) => Promise<CloudUpgradeResult>;
}

interface CloudBackupStoreDeps {
  cloudBackupService: CloudBackupService;
  settingsRepository: CloudBackupSettingsRepository;
  logRepository: BackupLogRepository;
  upgradeService: CloudUpgradeService;
}

function cloudEntriesOnly(entries: BackupLogEntry[]): BackupLogEntry[] {
  return entries.filter((entry) => entry.destination === 'cloud');
}

/**
 * Dependencies are resolved lazily so tests can inject fakes before anything
 * touches the database or a real network call — same pattern as
 * `createBackupStore()` (Phase 11).
 */
export function createCloudBackupStore(deps?: Partial<CloudBackupStoreDeps>) {
  const cloudBackupService = deps?.cloudBackupService ?? getCloudBackupService();
  const settingsRepository = deps?.settingsRepository ?? getCloudBackupSettingsRepository();
  const logRepository = deps?.logRepository ?? getBackupLogRepository();
  const upgradeService = deps?.upgradeService ?? getCloudUpgradeService();

  return create<CloudBackupState>((set, get) => ({
    status: 'idle',
    settings: EMPTY_CLOUD_BACKUP_SETTINGS,
    history: [],
    remoteBackups: [],
    storageUsage: null,
    error: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const [settings, allHistory] = await Promise.all([settingsRepository.getSettings(), logRepository.list()]);
        set({ settings, history: cloudEntriesOnly(allHistory), status: 'ready' });
        if (settings.cloudBackupEnabled) {
          // Best-effort — a failed refresh shouldn't flip the whole screen into an error state on load.
          get().refreshStorageUsage();
          get().refreshRemoteBackups();
        }
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    setCloudBackupEnabled: async (enabled: boolean) => {
      const settings = await settingsRepository.saveSettings({ cloudBackupEnabled: enabled });
      set({ settings });
      if (enabled) {
        // Awaited (unlike `load()`'s best-effort refreshes) so a caller that
        // awaits this action sees up-to-date storage usage/remote backups
        // immediately, with no race against a later action (e.g. disabling
        // again) that also touches this state.
        await Promise.all([get().refreshStorageUsage(), get().refreshRemoteBackups()]);
      } else {
        set({ remoteBackups: [], storageUsage: null });
      }
    },

    backupNow: async () => {
      set({ status: 'running', error: null });
      const entry = await cloudBackupService.backupNow('manual');
      const [settings, allHistory] = await Promise.all([settingsRepository.getSettings(), logRepository.list()]);
      set({
        settings,
        history: cloudEntriesOnly(allHistory),
        status: entry.status === 'success' ? 'ready' : 'error',
        error: entry.status === 'failure' ? entry.errorMessage : null,
      });
      if (entry.status === 'success') {
        await Promise.all([get().refreshStorageUsage(), get().refreshRemoteBackups()]);
      }
      return entry;
    },

    restore: async (fileId: string) => {
      set({ status: 'running', error: null });
      const entry = await cloudBackupService.restoreBackup(fileId, 'manual');
      const allHistory = await logRepository.list();
      set({
        history: cloudEntriesOnly(allHistory),
        status: entry.status === 'success' ? 'ready' : 'error',
        error: entry.status === 'failure' ? entry.errorMessage : null,
      });
      return entry;
    },

    refreshRemoteBackups: async () => {
      try {
        const remoteBackups = await cloudBackupService.listRemoteBackups();
        set({ remoteBackups });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    refreshStorageUsage: async () => {
      try {
        const storageUsage = await cloudBackupService.getStorageUsage();
        set({ storageUsage });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) });
      }
    },

    refreshHistory: async () => {
      const allHistory = await logRepository.list();
      set({ history: cloudEntriesOnly(allHistory) });
    },

    getUpgradePlans: () => upgradeService.getPlans(),

    requestUpgrade: (planId: CloudStoragePlanId) => upgradeService.requestUpgrade(planId),
  }));
}

/** App-wide singleton store, wired to the real repositories/services. */
export const useCloudBackupStore = createCloudBackupStore();
