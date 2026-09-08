import type { BackupEncryptionService, EncryptedBackupEnvelope } from './BackupEncryptionService';

/**
 * Jest-safe double every cloud-backup test injects instead of the real
 * `ExpoBackupEncryptionService` — same role `FakeGoogleDriveBackupService`
 * plays for `GoogleDriveBackupService` (Phase 11). **This is not
 * encryption** — it's a reversible, deterministic, dependency-free
 * transform (`encodeURIComponent`/`decodeURIComponent`, so it needs no
 * `Buffer`/`atob` global this test environment may not provide), only good
 * enough to prove `CloudBackupService` correctly encrypts before upload and
 * decrypts after download, and that plaintext never reaches the "cloud".
 * Real confidentiality comes from `ExpoBackupEncryptionService`'s native
 * AES-256-GCM, which has no Jest coverage for the same "no device in this
 * environment" reason every other native-module-backed service in this
 * codebase doesn't.
 */
export class FakeBackupEncryptionService implements BackupEncryptionService {
  /** When set, `decrypt()` throws this instead of decoding — simulates a corrupted/undecryptable envelope. */
  simulateDecryptFailure: Error | null = null;

  async encrypt(plaintext: string): Promise<EncryptedBackupEnvelope> {
    return { alg: 'aes-256-gcm-v1', data: encodeURIComponent(plaintext) };
  }

  async decrypt(envelope: EncryptedBackupEnvelope): Promise<string> {
    if (this.simulateDecryptFailure) {
      throw this.simulateDecryptFailure;
    }
    if (envelope.alg !== 'aes-256-gcm-v1') {
      throw new Error(`Unsupported backup encryption scheme: ${envelope.alg}`);
    }
    return decodeURIComponent(envelope.data);
  }
}
