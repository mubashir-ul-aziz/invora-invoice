import * as FileSystem from 'expo-file-system/legacy';

import { utf8ByteLength } from '@/domain/backup/size';

import type { LocalBackupFileStore } from './LocalBackupFileStore';

/**
 * Real `LocalBackupFileStore`, in `<documentDirectory>/backups/`. Each file
 * is written to a `.partial` name first and then moved into place, so an
 * interrupted write (app killed, storage full) never leaves a half-written
 * file that looks like a backup. No Jest coverage (native module).
 */
export class ExpoLocalBackupFileStore implements LocalBackupFileStore {
  private directory(): string {
    if (!FileSystem.documentDirectory) {
      throw new Error('App storage is not available on this device.');
    }
    return `${FileSystem.documentDirectory}backups/`;
  }

  private async uniqueName(dir: string, fileName: string): Promise<string> {
    const base = fileName.replace(/\.json$/i, '');
    for (let attempt = 1; attempt < 100; attempt += 1) {
      const candidate = attempt === 1 ? `${base}.json` : `${base}-${attempt}.json`;
      if (!(await FileSystem.getInfoAsync(`${dir}${candidate}`)).exists) {
        return candidate;
      }
    }
    throw new Error('Could not choose a file name for the backup.');
  }

  async write(fileName: string, content: string): Promise<{ uri: string; fileName: string; sizeBytes: number }> {
    const dir = this.directory();
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const name = await this.uniqueName(dir, fileName);
    const uri = `${dir}${name}`;
    const partial = `${uri}.partial`;
    try {
      await FileSystem.writeAsStringAsync(partial, content);
      await FileSystem.moveAsync({ from: partial, to: uri });
    } catch (error) {
      await FileSystem.deleteAsync(partial, { idempotent: true }).catch(() => undefined);
      throw error;
    }
    return { uri, fileName: name, sizeBytes: utf8ByteLength(content) };
  }

  async read(uri: string): Promise<string> {
    return FileSystem.readAsStringAsync(uri);
  }

  async exists(uri: string): Promise<boolean> {
    try {
      return (await FileSystem.getInfoAsync(uri)).exists;
    } catch {
      return false;
    }
  }

  async delete(uri: string): Promise<void> {
    if (!uri.startsWith(this.directory())) {
      throw new Error('Refusing to delete a file outside Metriqo’s backup folder.');
    }
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
