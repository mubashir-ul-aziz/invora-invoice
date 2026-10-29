import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, type AlertButton } from 'react-native';

import { createBackupHarness } from '@/data/backup/testHarness';
import { realisticBackupTables } from '@/domain/backup/testFixtures';
import { createBackupStore } from '@/state/backupStore';
import { toast } from '@/state/toastStore';

let mockStore: ReturnType<typeof createBackupStore>;

jest.mock('@/state/backupStore', () => {
  const actual = jest.requireActual('@/state/backupStore');
  const useBackupStore = (...args: unknown[]) => (mockStore as any)(...args);
  useBackupStore.getState = () => mockStore.getState();
  return { ...actual, useBackupStore };
});

import { BackupScreen } from '../BackupScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<BackupScreen navigation={navigation as never} route={{} as never} />);
}

function makeStore() {
  const harness = createBackupHarness({ seed: realisticBackupTables() });
  const onRestored = jest.fn(async () => undefined);
  mockStore = createBackupStore({
    backupService: harness.backupService,
    localBackupService: harness.localBackupService,
    restoreService: harness.restoreService,
    exchange: harness.exchange,
    driveService: harness.driveService,
    settingsRepository: harness.settingsRepository,
    logRepository: harness.logRepository,
    onRestored,
  });
  return { ...harness, onRestored };
}

/** Presses the button labelled `text` on the most recent `Alert.alert` call. */
async function pressAlertButton(alertSpy: jest.SpyInstance, text: string) {
  const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2] as AlertButton[];
  const button = buttons.find((candidate) => candidate.text === text);
  if (!button) throw new Error(`No "${text}" button in ${JSON.stringify(buttons.map((b) => b.text))}`);
  await act(async () => {
    await button.onPress?.();
  });
}

describe('BackupScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(toast, 'show');
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the Drive sign-in prompt with the automatic toggle disabled, plus Export/Import and the platform note', async () => {
    makeStore();
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('backup-sign-in')).toBeTruthy());
    expect(view.getByTestId('backup-auto-toggle').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('backup-export')).toBeTruthy();
    expect(view.getByTestId('backup-import')).toBeTruthy();
    expect(String(view.getByTestId('backup-platform-note').props.children)).toMatch(/exact schedule/);
    expect(view.getByTestId('backup-history-empty')).toBeTruthy();
  });

  it('signed in: shows the connected Google email and last successful backup', async () => {
    const { driveService } = makeStore();
    await driveService.signIn();
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('backup-account').props.children).toBe('Signed in as owner@example.com'));
    expect(view.getByTestId('backup-last-success').props.children).toBe('Never');

    await fireEvent.press(view.getByTestId('backup-now'));
    await waitFor(() => expect(view.getByTestId('backup-last-success').props.children).not.toBe('Never'));
    expect(toast.show).toHaveBeenCalledWith('success', expect.objectContaining({ title: 'Backup complete' }));
  });

  it('Export Backup saves a local backup, lists it, and offers Download/Share without claiming an external save', async () => {
    const { exchange } = makeStore();
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('backup-export')).toBeTruthy());

    await fireEvent.press(view.getByTestId('backup-export'));

    await waitFor(() => expect(toast.show).toHaveBeenCalledWith('success', expect.objectContaining({ title: 'Backup saved on this device' })));
    const item = mockStore.getState().items[0];
    expect(view.getByTestId(`history-row-${item.key}`)).toBeTruthy();
    expect(alertSpy).toHaveBeenLastCalledWith('Keep a copy somewhere else?', item.fileName, expect.any(Array));

    (toast.show as jest.Mock).mockClear();
    const shareLabel = (alertSpy.mock.calls.at(-1)![2] as AlertButton[]).find((b) => b.text?.startsWith('Share'))!.text!;
    await pressAlertButton(alertSpy, shareLabel);
    expect(exchange.sharedFiles).toEqual([item.entry!.fileUri]);
    expect(toast.show).not.toHaveBeenCalledWith('success', expect.anything());
  });

  it('Import Backup shows a preview, and confirming restores and refreshes the app', async () => {
    const { exchange, backupRepository, onRestored } = makeStore();
    const source = createBackupHarness({ seed: { ...realisticBackupTables(), payments: [] } });
    const exported = await source.localBackupService.exportBackup();
    const content = source.files.files.get(exported.fileUri!)!;
    exchange.nextPick = { uri: 'file:///b.json', name: 'b.json', sizeBytes: content.length, content };
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('backup-import')).toBeTruthy());

    await fireEvent.press(view.getByTestId('backup-import'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Restore this backup?', expect.any(String), expect.any(Array), expect.anything()));
    const message = alertSpy.mock.calls.at(-1)![1] as string;
    expect(message).toMatch(/Business: Acme Tiles/);
    expect(message).toMatch(/0 payments/);
    expect(message).toMatch(/REPLACES all business data/);
    expect(backupRepository.restoreCalls).toBe(0);

    await pressAlertButton(alertSpy, 'Replace my data');

    expect(onRestored).toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('success', expect.objectContaining({ title: 'Restore complete' }));
    expect((await backupRepository.exportAll()).payments).toEqual([]);
  });

  it('an invalid import file is reported and nothing is restored', async () => {
    const { exchange, backupRepository } = makeStore();
    exchange.nextPick = { uri: 'file:///x.json', name: 'x.json', sizeBytes: 9, content: 'not json!' };
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('backup-import')).toBeTruthy());

    await fireEvent.press(view.getByTestId('backup-import'));

    await waitFor(() => expect(toast.show).toHaveBeenCalledWith('error', expect.objectContaining({ title: "Can't restore this backup" })));
    expect(backupRepository.restoreCalls).toBe(0);
  });

  it('deleting a local backup confirms that it deletes a file on this device', async () => {
    const { files } = makeStore();
    const view = await renderScreen();
    await act(async () => {
      await mockStore.getState().exportBackup();
    });
    const item = mockStore.getState().items[0];

    await fireEvent.press(view.getByTestId(`delete-${item.key}`));

    expect(alertSpy).toHaveBeenLastCalledWith('Delete backup file from this device?', expect.stringContaining(item.fileName!), expect.any(Array));
    await pressAlertButton(alertSpy, 'Delete local file');
    expect(files.files.size).toBe(0);
  });

  it('deleting a Drive backup says it deletes from Google Drive, naming the account', async () => {
    const { driveService } = makeStore();
    await driveService.signIn();
    const view = await renderScreen();
    await act(async () => {
      await mockStore.getState().load();
      await mockStore.getState().backupNow();
    });
    const item = mockStore.getState().items.find((candidate) => candidate.location === 'google_drive')!;

    await fireEvent.press(view.getByTestId(`delete-${item.key}`));

    expect(alertSpy).toHaveBeenLastCalledWith('Delete backup from Google Drive?', expect.stringContaining('owner@example.com'), expect.any(Array));
    await pressAlertButton(alertSpy, 'Delete from Drive');
    await expect(driveService.listBackups()).resolves.toEqual([]);
  });

  it('shows the last failure reason when the most recent attempt failed', async () => {
    const { driveService } = makeStore();
    await driveService.signIn();
    driveService.simulateUnavailable = true;
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('backup-now')).toBeTruthy());

    await fireEvent.press(view.getByTestId('backup-now'));

    await waitFor(() => expect(view.getByTestId('backup-last-error')).toBeTruthy());
  });
});
