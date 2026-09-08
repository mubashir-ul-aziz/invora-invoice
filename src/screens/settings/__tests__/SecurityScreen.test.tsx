import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { FakeBiometricService } from '@/data/security/FakeBiometricService';
import { InMemorySecurityRepository } from '@/data/security/InMemorySecurityRepository';
import { createSecurityStore } from '@/state/securityStore';

let mockStore: ReturnType<typeof createSecurityStore>;

jest.mock('@/state/securityStore', () => {
  const actual = jest.requireActual('@/state/securityStore');
  return {
    ...actual,
    useSecurityStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

import { SecurityScreen } from '../SecurityScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<SecurityScreen navigation={navigation as never} route={{} as never} />);
}

describe('SecurityScreen', () => {
  it('defaults both toggles off for a never-configured device', async () => {
    mockStore = createSecurityStore(new InMemorySecurityRepository(), new FakeBiometricService());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('toggle-app-lock')).toBeTruthy());
    expect(view.getByTestId('toggle-app-lock').props.accessibilityState.checked).toBe(false);
    expect(view.getByTestId('toggle-biometric-unlock').props.accessibilityState.checked).toBe(false);
  });

  it('disables Biometric Unlock with a hint when the device does not support it', async () => {
    const biometric = new FakeBiometricService();
    biometric.supported = false;
    mockStore = createSecurityStore(new InMemorySecurityRepository(), biometric);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('toggle-biometric-unlock')).toBeTruthy());
    expect(view.getByTestId('toggle-biometric-unlock').props.accessibilityState.disabled).toBe(true);
    expect(view.getByText('Not supported on this device')).toBeTruthy();
  });

  it('toggling App Lock saves immediately', async () => {
    const repo = new InMemorySecurityRepository();
    mockStore = createSecurityStore(repo, new FakeBiometricService());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('toggle-app-lock')).toBeTruthy());
    fireEvent.press(view.getByTestId('toggle-app-lock'));

    await waitFor(() => expect(mockStore.getState().settings?.appLockEnabled).toBe(true));
    await expect(repo.getSettings()).resolves.toMatchObject({ appLockEnabled: true });
  });

  it('toggling Biometric Unlock saves immediately when the device supports it', async () => {
    const biometric = new FakeBiometricService();
    biometric.supported = true;
    const repo = new InMemorySecurityRepository();
    mockStore = createSecurityStore(repo, biometric);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('toggle-biometric-unlock')).toBeTruthy());
    fireEvent.press(view.getByTestId('toggle-biometric-unlock'));

    await waitFor(() =>
      expect(mockStore.getState().settings?.biometricUnlockEnabled).toBe(true),
    );
  });
});
