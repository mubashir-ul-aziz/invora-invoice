import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { createBackupHarness } from '@/data/backup/testHarness';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { EntitlementService } from '@/data/subscription/EntitlementService';
import { InvoiceUsageTracker } from '@/data/subscription/InvoiceUsageTracker';
import { activeInfo, makeHarness, type Harness } from '@/data/subscription/testFixtures';
import { VERIFICATION_MAX_AGE_MS } from '@/domain/subscription/verificationPolicy';
import { createBackupStore } from '@/state/backupStore';
import { createSubscriptionStore } from '@/state/subscriptionStore';
import { toast } from '@/state/toastStore';

let mockSubscriptionStore: ReturnType<typeof createSubscriptionStore>;
let mockBackupStore: ReturnType<typeof createBackupStore>;

jest.mock('@/state/subscriptionStore', () => {
  const actual = jest.requireActual('@/state/subscriptionStore');
  return { ...actual, useSubscriptionStore: (...args: unknown[]) => (mockSubscriptionStore as any)(...args) };
});
jest.mock('@/state/backupStore', () => {
  const actual = jest.requireActual('@/state/backupStore');
  const useBackupStore = (...args: unknown[]) => (mockBackupStore as any)(...args);
  useBackupStore.getState = () => mockBackupStore.getState();
  return { ...actual, useBackupStore };
});

import { PlanVerificationGate } from '../PlanVerificationGate';

const HOUR = 3_600_000;
let h: Harness;
let nowSpy: jest.SpyInstance;

async function boot() {
  h = makeHarness(Date.now());
  nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => h.clock.now);
  const tracker = new InvoiceUsageTracker(new InMemoryInvoiceRepository([]), h.cache, () => h.clock.now);
  const identity = { getOrCreateLocalUserId: async () => ({ localUserId: 'guest-1' }) };
  mockSubscriptionStore = createSubscriptionStore(
    () => h.service,
    () => new EntitlementService(h.service, tracker, () => h.clock.now),
    async () => true,
    () => identity as never,
  );
  const backup = createBackupHarness();
  mockBackupStore = createBackupStore({
    backupService: backup.backupService,
    localBackupService: backup.localBackupService,
    restoreService: backup.restoreService,
    exchange: backup.exchange,
    driveService: backup.driveService,
    settingsRepository: backup.settingsRepository,
    logRepository: backup.logRepository,
    onRestored: async () => undefined,
  });
  h.adapter.setCustomerInfo(activeInfo('business', h.clock.now));
  await mockSubscriptionStore.getState().init();
  return backup;
}

function renderGate() {
  return render(
    <PlanVerificationGate>
      <Text testID="app-content">App</Text>
    </PlanVerificationGate>,
  );
}

describe('PlanVerificationGate', () => {
  beforeEach(() => {
    jest.spyOn(toast, 'show');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    nowSpy?.mockRestore();
  });

  it('lets the app run while the plan was verified within 24 hours', async () => {
    await boot();
    h.connectivity.setOnline(false);
    h.clock.now += VERIFICATION_MAX_AGE_MS - HOUR;
    await mockSubscriptionStore.getState().refresh();

    const view = await renderGate();
    expect(view.getByTestId('app-content')).toBeTruthy();
  });

  it('after 24 hours offline, blocks normal use without calling the plan expired, and keeps recovery actions', async () => {
    await boot();
    h.connectivity.setOnline(false);
    h.clock.now += VERIFICATION_MAX_AGE_MS + HOUR;
    await mockSubscriptionStore.getState().refresh();

    const view = await renderGate();

    expect(view.queryByTestId('app-content')).toBeNull();
    expect(view.getByText('Connect to the internet to verify your plan')).toBeTruthy();
    expect(view.queryByText(/expired/i)).toBeNull();
    expect(view.getByTestId('plan-verification-verify')).toBeTruthy();
    expect(view.getByTestId('plan-verification-restore')).toBeTruthy();
    expect(view.getByTestId('plan-verification-export')).toBeTruthy();
    expect(mockSubscriptionStore.getState().snapshot.plan).toBe('business');
  });

  it('a failed retry reports pending verification; a successful one lets the app continue', async () => {
    await boot();
    h.connectivity.setOnline(false);
    h.clock.now += VERIFICATION_MAX_AGE_MS + HOUR;
    await mockSubscriptionStore.getState().refresh();
    const view = await renderGate();

    await fireEvent.press(view.getByTestId('plan-verification-verify'));
    await waitFor(() => expect(view.getByTestId('plan-verification-error')).toBeTruthy());
    expect(toast.show).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringMatching(/hasn't expired/) }));

    h.connectivity.online = true;
    h.adapter.setCustomerInfo(activeInfo('business', h.clock.now));
    await fireEvent.press(view.getByTestId('plan-verification-verify'));

    await waitFor(() => expect(view.getByTestId('app-content')).toBeTruthy());
    expect(toast.show).toHaveBeenCalledWith('success', expect.objectContaining({ title: 'Plan verified' }));
  });

  it('a clock rolled back below the highest time seen is caught', async () => {
    await boot();
    h.clock.now += 3 * HOUR;
    await h.service.touchClock();
    h.connectivity.setOnline(false);
    await mockSubscriptionStore.getState().refresh();
    h.clock.now -= 2 * HOUR;

    const view = await renderGate();
    expect(view.getByTestId('plan-verification-clock')).toBeTruthy();
  });

  it('Export Backup stays available while blocked', async () => {
    const backup = await boot();
    h.connectivity.setOnline(false);
    h.clock.now += VERIFICATION_MAX_AGE_MS + HOUR;
    await mockSubscriptionStore.getState().refresh();
    const view = await renderGate();

    await fireEvent.press(view.getByTestId('plan-verification-export'));

    await waitFor(() => expect(backup.files.files.size).toBe(1));
    expect(backup.exchange.sharedFiles).toHaveLength(1);
  });
});
