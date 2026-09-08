import { formatBackupSize } from '@/domain/backup/formatting';
import type { CloudStorageUsage } from './types';

export { formatBackupSize, formatBackupTimestamp } from '@/domain/backup/formatting';

/** "12.4 MB of 250 MB used" — reuses `formatBackupSize` rather than re-implementing byte formatting (`domain/backup/formatting.ts`, Phase 11). */
export function formatStorageUsage(usage: CloudStorageUsage): string {
  return `${formatBackupSize(usage.usedBytes)} of ${formatBackupSize(usage.limitBytes)} used`;
}

/** 0–1 fraction used, clamped — for a progress bar. `limitBytes <= 0` (shouldn't happen for a real plan, but guards a malformed response) returns 0 rather than dividing by zero. */
export function storageUsageRatio(usage: CloudStorageUsage): number {
  if (usage.limitBytes <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, usage.usedBytes / usage.limitBytes));
}
