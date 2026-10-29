import type { BackupImageAsset } from '@/domain/backup/types';

/**
 * Reads and writes the image files a backup embeds (today: the business
 * logo). Kept behind an interface so the backup/restore orchestration can be
 * tested without the native file system — see `InMemoryBackupAssetStore`.
 */
export interface BackupAssetStore {
  /** Reads an image file for embedding. Never throws: a missing/unreadable/oversized file resolves to null and the backup is made without it. */
  readImage(uri: string): Promise<BackupImageAsset | null>;
  /** Writes an embedded image to a new durable file in this app's own storage and returns its uri. */
  writeLogo(asset: BackupImageAsset): Promise<string>;
  exists(uri: string): Promise<boolean>;
  /** Best-effort delete. Only ever removes files inside this store's own directory (`isManaged`). */
  delete(uri: string): Promise<void>;
  /** True for files this store created — the only ones it will ever delete. */
  isManaged(uri: string): boolean;
}
