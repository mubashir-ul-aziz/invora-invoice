import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { FakeBiometricService } from '@/data/security/FakeBiometricService';
import { InMemorySecurityRepository } from '@/data/security/InMemorySecurityRepository';
import { createAppLockStore } from '@/state/appLockStore';
import { createSecurityStore } from '@/state/securityStore';

let mockAppLockStore: ReturnType<typeof createAppLockStore>;
let mockSecurityStore: ReturnType<typeof createSecurityStore>;

jest.mock('@/state/appLockStore', () => {
  const actual = jest.requireActual('@/state/appLockStore');
  return {
    ...actual,
    useAppLockStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockAppLockStore as any)(...args),
  };
});

jest.mock('@/state/securityStore', () => {
  const actual = jest.requireActual('@/state/securityStore');
  return {
    ...actual,
    useSecurityStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockSecurityStore as any)(...args),
  };
});

import { AppLockGate } from '../AppLockGate';

/** One render per file — matches the "overlapping act()" workaround this codebase already documents elsewhere (Phases 1–8). */
describe('AppLockGate', () => {
  it('renders children immediately when App Lock has never been turned on', async () => {
    const biometric = new FakeBiometricService();
    mockAppLockStore = createAppLockStore(biometric);
    mockSecurityStore = createSecurityStore(new InMemorySecurityRepository(), biometric);

    const view = await render(
      <AppLockGate>
        <Text testID="protected-content">Protected</Text>
      </AppLockGate>,
    );

    await waitFor(() => expect(view.getByTestId('protected-content')).toBeTruthy());
    expect(view.queryByTestId('app-lock-screen')).toBeNull();
  });

  it('shows the lock screen (with a working manual Unlock button) when App Lock is on', async () => {
    const biometric = new FakeBiometricService();
    biometric.supported = false;
    biometric.nextAuthenticateResult = true;
    const repo = new InMemorySecurityRepository();
    await repo.saveSettings({ appLockEnabled: true, biometricUnlockEnabled: false });
    mockAppLockStore = createAppLockStore(biometric);
    mockSecurityStore = createSecurityStore(repo, biometric);

    const view = await render(
      <AppLockGate>
        <Text testID="protected-content">Protected</Text>
      </AppLockGate>,
    );

    await waitFor(() => expect(view.getByTestId('app-lock-screen')).toBeTruthy());
    expect(view.queryByTestId('protected-content')).toBeNull();
    // Biometric Unlock is off, so nothing auto-fires the OS prompt.
    expect(biometric.authenticateCalls).toEqual([]);

    fireEvent.press(view.getByTestId('app-lock-unlock'));

    await waitFor(() => expect(view.getByTestId('protected-content')).toBeTruthy());
    expect(biometric.authenticateCalls).toEqual(['Unlock Invora']);
  });

  it('auto-attempts biometric authentication as soon as the lock screen appears when Biometric Unlock is on and supported', async () => {
    const biometric = new FakeBiometricService();
    biometric.supported = true;
    biometric.nextAuthenticateResult = true;
    const repo = new InMemorySecurityRepository();
    await repo.saveSettings({ appLockEnabled: true, biometricUnlockEnabled: true });
    mockAppLockStore = createAppLockStore(biometric);
    mockSecurityStore = createSecurityStore(repo, biometric);

    const view = await render(
      <AppLockGate>
        <Text testID="protected-content">Protected</Text>
      </AppLockGate>,
    );

    await waitFor(() => expect(view.getByTestId('protected-content')).toBeTruthy());
    expect(biometric.authenticateCalls).toEqual(['Unlock Invora']);
  });
});
