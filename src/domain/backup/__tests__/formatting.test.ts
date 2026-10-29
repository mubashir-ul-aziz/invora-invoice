import { backupFileName, backupSourceLabel, formatBackupSize, formatBackupTimestamp } from '../formatting';

describe('formatBackupSize', () => {
  it('formats null as a dash', () => {
    expect(formatBackupSize(null)).toBe('—');
  });

  it('formats small sizes in bytes', () => {
    expect(formatBackupSize(500)).toBe('500 B');
  });

  it('formats mid sizes in KB', () => {
    expect(formatBackupSize(2048)).toBe('2.0 KB');
  });

  it('formats large sizes in MB', () => {
    expect(formatBackupSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('formatBackupTimestamp', () => {
  it('formats null as "Never"', () => {
    expect(formatBackupTimestamp(null)).toBe('Never');
  });

  it('formats an invalid string as "Never"', () => {
    expect(formatBackupTimestamp('not-a-date')).toBe('Never');
  });

  it('formats a valid ISO timestamp', () => {
    const iso = new Date(2026, 0, 15, 10, 30).toISOString();
    expect(formatBackupTimestamp(iso)).not.toBe('Never');
  });
});

describe('backupFileName', () => {
  it('uses metriqo-backup-YYYY-MM-DD-HHmmss.json in local time', () => {
    expect(backupFileName(new Date(2026, 0, 5, 9, 7, 3).getTime())).toBe('metriqo-backup-2026-01-05-090703.json');
  });

  it('names safety backups distinctly', () => {
    expect(backupFileName(new Date(2026, 11, 31, 23, 59, 59).getTime(), 'safety')).toBe(
      'metriqo-safety-backup-2026-12-31-235959.json',
    );
  });
});

describe('backupSourceLabel', () => {
  it.each([
    [{ direction: 'backup', trigger: 'automatic', destination: 'google_drive' }, 'Google Drive · Automatic'],
    [{ direction: 'backup', trigger: 'manual', destination: 'google_drive' }, 'Google Drive · Manual'],
    [{ direction: 'backup', trigger: 'manual', destination: 'local' }, 'Exported file'],
    [{ direction: 'backup', trigger: 'safety', destination: 'local' }, 'Safety backup'],
    [{ direction: 'restore', trigger: 'manual', destination: 'local' }, 'Restore from file'],
    [{ direction: 'restore', trigger: 'manual', destination: 'google_drive' }, 'Restore from Google Drive'],
  ] as const)('%o → %s', (entry, label) => {
    expect(backupSourceLabel(entry)).toBe(label);
  });
});
