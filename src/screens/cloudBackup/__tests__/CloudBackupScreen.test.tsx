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

import { CloudBackupScreen } from '../CloudBackupScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<CloudBackupScreen navigation={navigation as never} route={{} as never} />);
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
    store: createCloudBackupStore({
      cloudBackupService,
      settingsRepository,
      logRepository,
      upgradeService: new PlaceholderCloudUpgradeService(),
    }),
  };
}

describe('CloudBackupScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the toggle disabled state with backup actions disabled while cloud backup is off', async () => {
    const { store } = makeStore();
    mockStore = store;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('cloud-backup-toggle')).toBeTruthy());
    expect(view.getByTestId('cloud-backup-now').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('cloud-backup-storage-unknown')).toBeTruthy();
  });

  it('enabling the toggle saves immediately and loads storage usage', async () => {
    const { store } = makeStore();
    mockStore = store;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('cloud-backup-toggle')).toBeTruthy());
    fireEvent.press(view.getByTestId('cloud-backup-toggle'));

    await waitFor(() => expect(mockStore.getState().settings.cloudBackupEnabled).toBe(true));
    await waitFor(() => expect(mockStore.getState().storageUsage).not.toBeNull());
  });

  it('"Backup now" runs a backup and shows a success alert', async () => {
    const { store } = makeStore();
    mockStore = store;
    await store.getState().setCloudBackupEnabled(true);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('cloud-backup-now')).toBeTruthy());
    fireEvent.press(view.getByTestId('cloud-backup-now'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Backup complete', expect.any(String)));
    expect(mockStore.getState().settings.lastCloudBackupStatus).toBe('success');
  });

  it('shows the last failure reason when the most recent attempt failed', async () => {
    const { store, api } = makeStore();
    mockStore = store;
    await store.getState().setCloudBackupEnabled(true);
    api.simulateUnavailable = true;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('cloud-backup-now')).toBeTruthy());
    fireEvent.press(view.getByTestId('cloud-backup-now'));

    await waitFor(() => expect(view.getByTestId('cloud-backup-last-error')).toBeTruthy());
  });

  it('"Upgrade storage" navigates to the placeholder screen', async () => {
    const { store } = makeStore();
    mockStore = store;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('cloud-backup-upgrade')).toBeTruthy());
    fireEvent.press(view.getByTestId('cloud-backup-upgrade'));

    expect(navigation.navigate).toHaveBeenCalledWith('UpgradeStorage');
  });
});
