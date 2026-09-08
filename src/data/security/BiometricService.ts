/**
 * The one native operation App Lock needs, behind an interface — same
 * "screens/stores depend on an interface, never a concrete native module"
 * rule `PdfService`/`ShareLinkService` already follow. `ExpoBiometricService`
 * is the only real implementation (backed by `expo-local-authentication`)
 * and, like every other native-backed class in this codebase
 * (`Sqlite*Repository`, `ExpoPdfService`), has no Jest coverage — Jest can't
 * drive this native module without a device. `FakeBiometricService` is the
 * Jest-safe double every store/screen test injects instead.
 */
export interface BiometricService {
  /** Whether this device has biometric hardware AND has at least one biometric enrolled — the "where supported" condition from the brief. */
  isSupported(): Promise<boolean>;
  /**
   * Prompts the OS's own biometric/device-passcode UI with `reason` as the
   * message. Resolves `true` on success, `false` on cancel/failure — never
   * throws, so a screen never needs a try/catch around it.
   */
  authenticate(reason: string): Promise<boolean>;
}
