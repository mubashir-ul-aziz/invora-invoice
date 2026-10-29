import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBackupLogRepository } from '@/data/backup/InMemoryBackupLogRepository';
import { InMemoryBackupRepository } from '@/data/backup/InMemoryBackupRepository';
import { BackupPayloadService } from '@/data/backup/BackupPayloadService';
import { InMemoryBackupAssetStore } from '@/data/backup/files/InMemoryBackupAssetStore';
import { CloudBackupService } from '@/data/cloudBackup/CloudBackupService';
import { FakeCloudBackupApi } from '@/data/cloudBackup/FakeCloudBackupApi';
import { InMemoryCloudBackupSettingsRepository } from '@/data/cloudBackup/InMemoryCloudBackupSettingsRepository';
import { FakeBackupEncryptionService } from '@/data/cloudBackup/encryption/FakeBackupEncryptionService';
import { PlaceholderCloudUpgradeService } from '@/data/subscription/PlaceholderCloudUpgradeService';
import { CLOUD_STORAGE_PLANS } from '@/domain/cloudBackup/types';
import { createCloudBackupStore } from '@/state/cloudBackupStore';
import { toast } from '@/state/toastStore';

let mockStore: ReturnType<typeof createCloudBackupStore>;

jest.mock('@/state/cloudBackupStore', () => {
  const actual = jest.requireActual('@/state/cloudBackupStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useCloudBackupStore: (...args: unknown[]) => (mockStore as any)(...args),
  };
});

import { UpgradeStorageScreen } from '../UpgradeStorageScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<UpgradeStorageScreen navigation={navigation as never} route={{} as never} />);
}

function makeStore() {
  const api = new FakeCloudBackupApi();
  const settingsRepository = new InMemoryCloudBackupSettingsRepository();
  const logRepository = new InMemoryBackupLogRepository();
  const cloudBackupService = new CloudBackupService(
    new BackupPayloadService(new InMemoryBackupRepository(), new InMemoryBackupAssetStore(), '1.0.0'),
    logRepository,
    settingsRepository,
    api,
    new FakeBackupEncryptionService(),
    );
  return createCloudBackupStore({
    cloudBackupService,
    settingsRepository,
    logRepository,
    upgradeService: new PlaceholderCloudUpgradeService(),
  });
}

describe('UpgradeStorageScreen', () => {
  beforeEach(() => {
    jest.spyOn(toast, 'show');
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists every plan from the registry, with only the upgrade-target plan(s) offering an Upgrade button', async () => {
    mockStore = makeStore();
    const view = await renderScreen();

    for (const plan of CLOUD_STORAGE_PLANS) {
      await waitFor(() => expect(view.getByTestId(`plan-${plan.id}`)).toBeTruthy());
      if (plan.isUpgradeTarget) {
        expect(view.getByTestId(`upgrade-${plan.id}`)).toBeTruthy();
      } else {
        expect(view.queryByTestId(`upgrade-${plan.id}`)).toBeNull();
      }
    }
  });

  it('tapping Upgrade shows the honest "not available yet" placeholder message, without throwing', async () => {
    mockStore = makeStore();
    const upgradeTarget = CLOUD_STORAGE_PLANS.find((p) => p.isUpgradeTarget)!;
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId(`upgrade-${upgradeTarget.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`upgrade-${upgradeTarget.id}`));

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith('error', expect.objectContaining({ title: 'Not available yet', message: expect.stringContaining("isn't available yet") })),
    );
  });
});
