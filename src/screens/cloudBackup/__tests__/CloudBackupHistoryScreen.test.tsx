import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { InMemoryBackupLogRepository } from '@/data/backup/InMemoryBackupLogRepository';
import { InMemoryBackupRepository } from '@/data/backup/InMemoryBackupRepository';
import { CloudBackupService } from '@/data/cloudBackup/CloudBackupService';
import { FakeCloudBackupApi } from '@/data/cloudBackup/FakeCloudBackupApi';
import { InMemoryCloudBackupSettingsRepository } from '@/data/cloudBackup/InMemoryCloudBackupSettingsRepository';
import { FakeBackupEncryptionService } from '@/data/cloudBackup/encryption/FakeBackupEncryptionService';
import { PlaceholderCloudUpgradeService } from '@/data/subscription/PlaceholderCloudUpgradeService';
import { createCloudBackupStore } from '@/state/cloudBackupStore';

let mockStore: ReturnType<typeof createCloudBackupStore>;

jest.mock('@/state/cloudBackupStore', () => {
  const actual = jest.requireActual('@/state/cloudBackupStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useCloudBackupStore: (...args: unknown[]) => (mockStore as any)(...args),
  };
});

import { CloudBackupHistoryScreen } from '../CloudBackupHistoryScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<CloudBackupHistoryScreen navigation={navigation as never} route={{} as never} />);
}

function makeStore() {
  const api = new FakeCloudBackupApi();
  const settingsRepository = new InMemoryCloudBackupSettingsRepository();
  const logRepository = new InMemoryBackupLogRepository();
  const cloudBackupService = new CloudBackupService(
    new InMemoryBackupRepository(),
    logRepository,
    settingsRepository,
    api,
    new FakeBackupEncryptionService(),
    '1.0.0',
  );
  return {
    api,
    logRepository,
    store: createCloudBackupStore({
      cloudBackupService,
      settingsRepository,
      logRepository,
      upgradeService: new PlaceholderCloudUpgradeService(),
    }),
  };
}

describe('CloudBackupHistoryScreen', () => {
  it('tells a user to enable cloud backup first, and shows no remote backups', async () => {
    const { store } = makeStore();
    mockStore = store;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('cloud-backup-history-disabled')).toBeTruthy());
  });

  it('shows an empty state when enabled with nothing uploaded yet', async () => {
    const { store } = makeStore();
    mockStore = store;
    await store.getState().setCloudBackupEnabled(true);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('cloud-backup-history-no-remote')).toBeTruthy());
  });

  it('lists a remote backup and restoring it after confirming updates history', async () => {
    const { store } = makeStore();
    mockStore = store;
    await store.getState().setCloudBackupEnabled(true);
    await store.getState().backupNow();
    await store.getState().refreshRemoteBackups();
    const [uploaded] = mockStore.getState().remoteBackups;

    let confirmHandler: (() => void) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      confirmHandler = buttons?.find((b) => b.text === 'Restore')?.onPress as (() => void) | undefined;
    });

    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId(`restore-cloud-${uploaded.id}`)).toBeTruthy());

    fireEvent.press(view.getByTestId(`restore-cloud-${uploaded.id}`));
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
      trigger: 'manual',
      status: 'failure',
      destination: 'cloud',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      formatVersion: null,
      sizeBytes: null,
      counts: null,
      errorMessage: 'Cloud backup is unavailable',
    });

    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Cloud backup is unavailable')).toBeTruthy());
    expect(view.getByText('Failed')).toBeTruthy();
  });

  it('a google_drive log entry does not leak into cloud backup history', async () => {
    const { store, logRepository } = makeStore();
    mockStore = store;
    await logRepository.add({
      direction: 'backup',
      trigger: 'manual',
      status: 'success',
      destination: 'google_drive',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      formatVersion: 1,
      sizeBytes: 10,
      counts: null,
      errorMessage: null,
    });

    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('cloud-backup-history-empty')).toBeTruthy());
  });
});
