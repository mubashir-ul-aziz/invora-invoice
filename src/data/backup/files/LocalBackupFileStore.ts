/**
 * Durable storage for local backup files (exports and safety backups) inside
 * this app's own document directory — not a cache the OS may clear. Files
 * stay until the user deletes them from the backup history (or uninstalls
 * the app, which removes app storage on Android and iOS).
 */
export interface LocalBackupFileStore {
  /** Writes `content` as `fileName` (made unique if taken). The write lands in full or not at all. */
  write(fileName: string, content: string): Promise<{ uri: string; fileName: string; sizeBytes: number }>;
  read(uri: string): Promise<string>;
  exists(uri: string): Promise<boolean>;
  delete(uri: string): Promise<void>;
}
