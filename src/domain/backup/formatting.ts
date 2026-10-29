import type { BackupLogEntry } from './types';

/** Human-readable "2.4 KB" / "1.1 MB" formatting for the Backup screens. */
export function formatBackupSize(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Never" / a date-time string in the device's local timezone, for `lastBackupAt` and history rows. */
export function formatBackupTimestamp(iso: string | null): string {
  if (!iso) {
    return 'Never';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }
  return date.toLocaleString();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * `metriqo-backup-YYYY-MM-DD-HHmmss.json` (or `metriqo-safety-backup-…` for
 * the automatic copy taken before a restore), in the device's local time so
 * the name matches the time the user sees in the history list.
 */
export function backupFileName(createdAt: number, kind: 'backup' | 'safety' = 'backup'): string {
  const d = new Date(createdAt);
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${kind === 'safety' ? 'metriqo-safety-backup' : 'metriqo-backup'}-${stamp}.json`;
}

/** What kind of history entry this is, in the words the history list uses ("Google Drive · Automatic", "Exported file", …). */
export function backupSourceLabel(entry: Pick<BackupLogEntry, 'direction' | 'trigger' | 'destination'>): string {
  if (entry.direction === 'restore') {
    switch (entry.destination) {
      case 'google_drive':
        return 'Restore from Google Drive';
      case 'cloud':
        return 'Restore from cloud';
      default:
        return 'Restore from file';
    }
  }
  if (entry.trigger === 'safety') {
    return 'Safety backup';
  }
  switch (entry.destination) {
    case 'google_drive':
      return entry.trigger === 'automatic' ? 'Google Drive · Automatic' : 'Google Drive · Manual';
    case 'cloud':
      return entry.trigger === 'automatic' ? 'Cloud · Automatic' : 'Cloud · Manual';
    default:
      return 'Exported file';
  }
}
