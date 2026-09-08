import * as LocalAuthentication from 'expo-local-authentication';

import type { BiometricService } from './BiometricService';

/**
 * Real implementation, backed by `expo-local-authentication`. No Jest
 * coverage — see the doc comment on `BiometricService`.
 */
export class ExpoBiometricService implements BiometricService {
  async isSupported(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return false;
    }
    return LocalAuthentication.isEnrolledAsync();
  }

  async authenticate(reason: string): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        // Never lock a user out of their own offline, local data with no
        // account/password-reset system to fall back on — the OS's own
        // device-passcode fallback stays available if biometrics fail.
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }
}
