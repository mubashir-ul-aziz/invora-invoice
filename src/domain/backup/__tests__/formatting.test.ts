import { formatBackupSize, formatBackupTimestamp } from '../formatting';

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
