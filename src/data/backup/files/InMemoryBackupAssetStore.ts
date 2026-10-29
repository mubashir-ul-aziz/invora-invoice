import type { BackupImageAsset } from '@/domain/backup/types';

import type { BackupAssetStore } from './BackupAssetStore';

const MANAGED_PREFIX = 'memory://branding/';

/** Test double for `BackupAssetStore`: files are entries in a map, keyed by uri. */
export class InMemoryBackupAssetStore implements BackupAssetStore {
  readonly files = new Map<string, BackupImageAsset>();
  private counter = 0;
  /** When set, the next `writeLogo()` throws it. */
  failNextWrite: Error | null = null;

  async readImage(uri: string): Promise<BackupImageAsset | null> {
    return this.files.get(uri) ?? null;
  }

  async writeLogo(asset: BackupImageAsset): Promise<string> {
    if (this.failNextWrite) {
      const error = this.failNextWrite;
      this.failNextWrite = null;
      throw error;
    }
    this.counter += 1;
    const uri = `${MANAGED_PREFIX}logo-${this.counter}`;
    this.files.set(uri, asset);
    return uri;
  }

  async exists(uri: string): Promise<boolean> {
    return this.files.has(uri);
  }

  async delete(uri: string): Promise<void> {
    if (this.isManaged(uri)) {
      this.files.delete(uri);
    }
  }

  isManaged(uri: string): boolean {
    return uri.startsWith(MANAGED_PREFIX);
  }
}
