import { buildBackupHistory } from '../history';
import type { BackupLogEntry, DriveBackupFile } from '../types';

function entry(overrides: Partial<BackupLogEntry>): BackupLogEntry {
  return {
    id: 'e',
    direction: 'backup',
    trigger: 'manual',
    status: 'success',
    destination: 'local',
    startedAt: '2026-10-01T10:00:00.000Z',
    finishedAt: '2026-10-01T10:00:01.000Z',
    formatVersion: 2,
    sizeBytes: 100,
    counts: null,
    errorMessage: null,
    fileName: 'metriqo-backup.json',
    fileUri: 'file:///backups/metriqo-backup.json',
    remoteFileId: null,
    ...overrides,
  };
}

const driveFile: DriveBackupFile = { id: 'd1', name: 'metriqo-backup-d1.json', createdAt: '2026-10-03T00:00:00.000Z', sizeBytes: 50 };

describe('buildBackupHistory', () => {
  it('gives a local backup every action and lists newest first', () => {
    const items = buildBackupHistory({
      history: [entry({ id: 'old', startedAt: '2026-09-01T00:00:00.000Z' }), entry({ id: 'new' })],
      remoteBackups: [],
      driveSignedIn: false,
      remoteListLoaded: false,
    });
    expect(items.map((i) => i.key)).toEqual(['new', 'old']);
    expect(items[0]).toMatchObject({ location: 'local', actions: { share: true, restore: true, delete: true } });
  });

  it('shows safety backups as their own type', () => {
    const [item] = buildBackupHistory({
      history: [entry({ trigger: 'safety' })],
      remoteBackups: [],
      driveSignedIn: false,
      remoteListLoaded: false,
    });
    expect(item.title).toBe('Safety backup');
  });

  it('never offers actions on failures or restore entries', () => {
    const items = buildBackupHistory({
      history: [entry({ id: 'f', status: 'failure', fileUri: null }), entry({ id: 'r', direction: 'restore', fileUri: null })],
      remoteBackups: [],
      driveSignedIn: true,
      remoteListLoaded: true,
    });
    for (const item of items) expect(item.actions).toEqual({ share: false, restore: false, delete: false });
  });

  it('disables a Drive backup while signed out, and explains why', () => {
    const [item] = buildBackupHistory({
      history: [entry({ destination: 'google_drive', fileUri: null, remoteFileId: 'd1' })],
      remoteBackups: [],
      driveSignedIn: false,
      remoteListLoaded: false,
    });
    expect(item.actions.restore).toBe(false);
    expect(item.unavailableReason).toMatch(/sign in/i);
  });

  it('marks a Drive backup that has been pruned from Drive as no longer available', () => {
    const items = buildBackupHistory({
      history: [entry({ destination: 'google_drive', fileUri: null, remoteFileId: 'gone' })],
      remoteBackups: [driveFile],
      driveSignedIn: true,
      remoteListLoaded: true,
    });
    const item = items.find((candidate) => candidate.key === 'e')!;
    expect(item.actions.restore).toBe(false);
    expect(item.unavailableReason).toMatch(/no longer/i);
  });

  it('links a logged Drive backup to its file, and lists untracked Drive files too', () => {
    const items = buildBackupHistory({
      history: [entry({ id: 'logged', destination: 'google_drive', fileUri: null, remoteFileId: 'd1' })],
      remoteBackups: [driveFile, { ...driveFile, id: 'd2', name: 'older-install.json' }],
      driveSignedIn: true,
      remoteListLoaded: true,
    });
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.key === 'logged')).toMatchObject({ location: 'google_drive', remote: driveFile });
    expect(items.find((i) => i.key === 'drive:d2')).toMatchObject({ entry: null, actions: { restore: true, delete: true } });
  });
});
