import * as FileSystem from 'expo-file-system/legacy';

import { MAX_LOGO_BYTES, type BackupImageAsset, type BackupImageMimeType } from '@/domain/backup/types';

import type { BackupAssetStore } from './BackupAssetStore';

const EXTENSION_BY_MIME: Record<BackupImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function mimeTypeOf(uri: string): BackupImageMimeType {
  const lower = uri.toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Real `BackupAssetStore`. Restored logos go to `<documentDirectory>/branding/`
 * — durable app storage the OS doesn't clear, unlike the image picker's cache
 * path a logo normally points at. No Jest coverage (native module), same as
 * every other `Expo*` service in this codebase.
 */
export class ExpoBackupAssetStore implements BackupAssetStore {
  private directory(): string {
    if (!FileSystem.documentDirectory) {
      throw new Error('App storage is not available on this device.');
    }
    return `${FileSystem.documentDirectory}branding/`;
  }

  async readImage(uri: string): Promise<BackupImageAsset | null> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || info.isDirectory || (info.size ?? 0) > MAX_LOGO_BYTES) {
        return null;
      }
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      return base64 ? { mimeType: mimeTypeOf(uri), base64 } : null;
    } catch {
      return null;
    }
  }

  async writeLogo(asset: BackupImageAsset): Promise<string> {
    const dir = this.directory();
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const uri = `${dir}logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXTENSION_BY_MIME[asset.mimeType]}`;
    await FileSystem.writeAsStringAsync(uri, asset.base64, { encoding: 'base64' });
    return uri;
  }

  async exists(uri: string): Promise<boolean> {
    try {
      return (await FileSystem.getInfoAsync(uri)).exists;
    } catch {
      return false;
    }
  }

  async delete(uri: string): Promise<void> {
    if (!this.isManaged(uri)) return;
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }

  isManaged(uri: string): boolean {
    return !!FileSystem.documentDirectory && uri.startsWith(this.directory());
  }
}
