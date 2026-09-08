import type { BackupOutcome } from '@/domain/backup/types';

/**
 * Optional Cloud Backup (Phase 12). Architecture, per `MVP_BUILD_PLAN.md` §4
 * and §10:
 *
 *   Mobile SQLite → versioned/encrypted backup → Cloud API → Object storage
 *
 * Same rule as Google Drive backup (Phase 11): the cloud is a **backup
 * destination only**, never a live data source, and the app never
 * synchronizes individual database operations to it — a "backup" is always
 * one full, versioned, encrypted snapshot, uploaded on request (manual or
 * opportunistic), never a per-write sync. See `CloudBackupService`'s doc
 * comment for how that snapshot is built and encrypted before it ever
 * leaves the device.
 */

/**
 * The storage tiers a device can be on. No billing backend exists yet (see
 * `MVP_BUILD_PLAN.md` §10 "Open decisions" — a subscription/payment
 * provider was never selected), so this is a small **static** registry, not
 * something fetched from a server — `CloudBackupApi.getStorageUsage()` just
 * reports which `planId` a device is already on. Upgrading is a placeholder
 * — see `data/subscription/CloudUpgradeService.ts`.
 */
export type CloudStoragePlanId = 'free' | 'plus';

export interface CloudStoragePlan {
  id: CloudStoragePlanId;
  label: string;
  limitBytes: number;
  /** Shown on the Upgrade Storage screen — a real price is not set until a payment provider is chosen. */
  priceLabel: string;
  /** Whether "Upgrade" is offered for this plan — false for the plan a device is already on or below. */
  isUpgradeTarget: boolean;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Every plan a device could be on, lowest to highest. Kept as one small array (not per-field constants) so `UpgradeStorageScreen` can render it directly without hand-listing tiers. */
export const CLOUD_STORAGE_PLANS: CloudStoragePlan[] = [
  { id: 'free', label: 'Free', limitBytes: 250 * MB, priceLabel: 'Included', isUpgradeTarget: false },
  { id: 'plus', label: 'Plus', limitBytes: 5 * GB, priceLabel: 'Coming soon', isUpgradeTarget: true },
];

export const DEFAULT_CLOUD_STORAGE_PLAN_ID: CloudStoragePlanId = 'free';

export function getCloudStoragePlan(id: CloudStoragePlanId): CloudStoragePlan {
  return CLOUD_STORAGE_PLANS.find((plan) => plan.id === id) ?? CLOUD_STORAGE_PLANS[0];
}

/** Cloud-backup-enabled toggle + the outcome of the most recent attempt — the cloud-backup counterpart to `BackupSettings` (Phase 11), stored on the same `app_settings` singleton row via its own, non-overlapping columns. */
export interface CloudBackupSettings {
  cloudBackupEnabled: boolean;
  /** The plan this device was last known to be on — null until the first successful `getStorageUsage()` call, in which case the UI falls back to `DEFAULT_CLOUD_STORAGE_PLAN_ID`. */
  planId: CloudStoragePlanId | null;
  /** ISO timestamp of the most recent *successful* cloud backup, or null if none has ever succeeded. */
  lastCloudBackupAt: string | null;
  /** Outcome of the most recent cloud backup *attempt*, or null if one has never been attempted. */
  lastCloudBackupStatus: BackupOutcome | null;
  lastCloudBackupError: string | null;
}

export type CloudBackupSettingsInput = Pick<CloudBackupSettings, 'cloudBackupEnabled'>;

export const EMPTY_CLOUD_BACKUP_SETTINGS: CloudBackupSettings = {
  cloudBackupEnabled: false,
  planId: null,
  lastCloudBackupAt: null,
  lastCloudBackupStatus: null,
  lastCloudBackupError: null,
};

/** Metadata for one encrypted backup file as the cloud API reports it — never its (encrypted) content, same shape/role as `DriveBackupFile` in Phase 11. */
export interface CloudBackupFile {
  id: string;
  name: string;
  /** ISO timestamp the server recorded for the file. */
  createdAt: string;
  /** Size of the *encrypted* payload actually stored — always a little larger than the plaintext JSON (IV + auth tag overhead), never the plaintext size. */
  sizeBytes: number;
}

/** How much of a device's plan limit is used — drives the "Storage usage" / "Storage limits" UI. */
export interface CloudStorageUsage {
  usedBytes: number;
  limitBytes: number;
  planId: CloudStoragePlanId;
}

/** How many cloud backups to keep per device — smaller than Google Drive's `BACKUP_RETENTION_COUNT` (10) because cloud storage is capacity-limited by plan, not "free" the way a user's own Drive quota is. */
export const CLOUD_BACKUP_RETENTION_COUNT = 5;
