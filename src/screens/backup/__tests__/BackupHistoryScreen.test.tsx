import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { BackupService } from '@/data/backup/BackupService';
import { InMemoryBackupLogRepository } from '@/data/backup/InMemoryBackupLogRepository';
import { InMemoryBackupRepository } from '@/data/backup/InMemoryBackupRepository';
import { InMemoryBackupSettingsRepository } from '@/data/backup/InMemoryBackupSettingsRepository';
import { FakeGoogleDriveBackupService } from '@/data/backup/googleDrive/FakeGoogleDriveBackupService';
import { buildBackupPayload } from '@/domain/backup/validation';
import { createBackupStore } from '@/state/backupStore';

let mockStore: ReturnType<typeof createBackupStore>;

jest.mock('@/state/backupStore', () => {
  const actual = jest.requireActual('@/state/backupStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useBackupStore: (...args: unknown[]) => (mockStore as any)(...args),
  };
});

import { BackupHistoryScreen } from '../BackupHistoryScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<BackupHistoryScreen navigation={navigation as never} route={{} as never} />);
}

function makeStore() {
  const driveService = new FakeGoogleDriveBackupService();
  const settingsRepository = new InMemoryBackupSettingsRepository();
  const logRepository = new InMemoryBackupLogRepository();
  const backupService = new BackupService(
    new InMemoryBackupRepository(),
    logRepository,
    settingsRepository,
    driveService,
    '1.0.0',
  );
  return {
    driveService,
    logRepository,
    store: createBackupStore({ backupService, driveService, settingsRepository, logRepository }),
  };
}

describe('BackupHistoryScreen', () => {
  it('tells a signed-out user to sign in first, and shows no remote backups', async () => {
    const { store } = makeStore();
    mockStore = store;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('backup-history-signed-out')).toBeTruthy());
  });

  it('shows an empty state when signed in with nothing on Drive yet', async () => {
    const { store, driveService } = makeStore();
    mockStore = store;
    await driveService.signIn();
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('backup-history-no-remote')).toBeTruthy());
  });

  it('lists remote backups and restoring one after confirming updates history', async () => {
    const { store, driveService } = makeStore();
    mockStore = store;
    await driveService.signIn();
    const payload = buildBackupPayload(
      {
        business: [],
        socialLinks: [],
        items: [],
        customers: [],
        invoices: [],
        invoiceItems: [],
        payments: [],
        appSettings: [],
      },
      '1.0.0',
    );
    const uploaded = await driveService.uploadBackup('seed.json', JSON.stringify(payload));

    let confirmHandler: (() => void) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      confirmHandler = buttons?.find((b) => b.text === 'Restore')?.onPress as (() => void) | undefined;
    });

    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId(`restore-${uploaded.id}`)).toBeTruthy());

    fireEvent.press(view.getByTestId(`restore-${uploaded.id}`));
    expect(confirmHandler).toBeDefined();
    await confirmHandler!();

    await waitFor(() =>
      expect(mockStore.getState().history.some((h) => h.direction === 'restore' && h.status === 'success')).toBe(
        true,
      ),
    );

    jest.restoreAllMocks();
  });

  it('shows a read-only history row for a failed backup attempt', async () => {
    const { store, logRepository } = makeStore();
    mockStore = store;
    await logRepository.add({
      direction: 'backup',
      trigger: 'automatic',
      status: 'failure',
      destination: 'google_drive',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      formatVersion: null,
      sizeBytes: null,
      counts: null,
      errorMessage: 'Google Drive is unavailable',
    });

    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Google Drive is unavailable')).toBeTruthy());
    expect(view.getByText('Failed')).toBeTruthy();
  });
});
