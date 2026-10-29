import { utf8ByteLength } from '@/domain/backup/size';

import type { LocalBackupFileStore } from './LocalBackupFileStore';

/** Test double for `LocalBackupFileStore`. */
export class InMemoryLocalBackupFileStore implements LocalBackupFileStore {
  readonly files = new Map<string, string>();
  /** When set, the next `write()` throws it (e.g. simulating a full disk). */
  failNextWrite: Error | null = null;

  async write(fileName: string, content: string): Promise<{ uri: string; fileName: string; sizeBytes: number }> {
    if (this.failNextWrite) {
      const error = this.failNextWrite;
      this.failNextWrite = null;
      throw error;
    }
    const base = fileName.replace(/\.json$/i, '');
    let name = `${base}.json`;
    for (let attempt = 2; this.files.has(`memory://backups/${name}`); attempt += 1) {
      name = `${base}-${attempt}.json`;
    }
    const uri = `memory://backups/${name}`;
    this.files.set(uri, content);
    return { uri, fileName: name, sizeBytes: utf8ByteLength(content) };
  }

  async read(uri: string): Promise<string> {
    const content = this.files.get(uri);
    if (content === undefined) {
      throw new Error('The backup file no longer exists.');
    }
    return content;
  }

  async exists(uri: string): Promise<boolean> {
    return this.files.has(uri);
  }

  async delete(uri: string): Promise<void> {
    this.files.delete(uri);
  }
}
