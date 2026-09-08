import type { BiometricService } from './BiometricService';

/**
 * The Jest-safe double for `BiometricService` — `expo-local-authentication`
 * is a native module Jest can't drive without a device, same reasoning every
 * `Sqlite*Repository`/`FakePdfService` in this codebase already documents.
 * Records every `authenticate()` call so tests can assert what a screen/store
 * asked for, and returns configurable canned results instead of touching
 * anything native.
 */
export class FakeBiometricService implements BiometricService {
  supported = true;
  nextAuthenticateResult = true;
  authenticateCalls: string[] = [];

  async isSupported(): Promise<boolean> {
    return this.supported;
  }

  async authenticate(reason: string): Promise<boolean> {
    this.authenticateCalls.push(reason);
    return this.nextAuthenticateResult;
  }
}
