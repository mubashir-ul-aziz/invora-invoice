import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { BackupService } from '@/data/backup/BackupService';
import { InMemoryBackupLogRepository } from '@/data/backup/InMemoryBackupLogRepository';
import { InMemoryBackupRepository } from '@/data/backup/InMemoryBackupRepository';
import { InMemoryBackupSettingsRepository } from '@/data/backup/InMemoryBackupSettingsRepository';
import { FakeGoogleDriveBackupService } from '@/data/backup/googleDrive/FakeGoogleDriveBackupService';
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

import { BackupScreen } from '../BackupScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<BackupScreen navigation={navigation as never} route={{} as never} />);
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
    store: createBackupStore({ backupService, driveService, settingsRepository, logRepository }),
  };
}

describe('BackupScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a sign-in prompt when not signed in, with the toggle/backup actions disabled', async () => {
    const { store } = makeStore();
    mockStore = store;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('backup-sign-in')).toBeTruthy());
    expect(view.getByTestId('backup-auto-toggle').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('backup-now').props.accessibilityState.disabled).toBe(true);
  });

  it('signing in reveals the signed-in state', async () => {
    const { store } = makeStore();
    mockStore = store;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('backup-sign-in')).toBeTruthy());
    fireEvent.press(view.getByTestId('backup-sign-in'));

    await waitFor(() => expect(view.getByTestId('backup-sign-out')).toBeTruthy());
  });

  it('toggling automatic backup saves immediately', async () => {
    const { store, driveService } = makeStore();
    mockStore = store;
    await driveService.signIn();
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('backup-auto-toggle')).toBeTruthy());
    fireEvent.press(view.getByTestId('backup-auto-toggle'));

    await waitFor(() => expect(mockStore.getState().settings.autoBackupEnabled).toBe(true));
  });

  it('"Backup now" runs a backup and shows a success alert', async () => {
    const { store, driveService } = makeStore();
    mockStore = store;
    await driveService.signIn();
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('backup-now')).toBeTruthy());
    fireEvent.press(view.getByTestId('backup-now'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Backup complete', expect.any(String)));
    expect(mockStore.getState().settings.lastBackupStatus).toBe('success');
  });

  it('shows the last failure reason when the most recent attempt failed', async () => {
    const { store, driveService } = makeStore();
    mockStore = store;
    await driveService.signIn();
    driveService.simulateUnavailable = true;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('backup-now')).toBeTruthy());
    fireEvent.press(view.getByTestId('backup-now'));

    await waitFor(() => expect(view.getByTestId('backup-last-error')).toBeTruthy());
  });
});
