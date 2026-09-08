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

/** "Never" / a locale-formatted date-time string for `lastBackupAt` and history rows. */
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
