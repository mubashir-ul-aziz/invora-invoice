/**
 * The encrypted form of a backup JSON payload actually sent to/read from the
 * cloud API — the object storage layer never sees plaintext. `alg` names the
 * scheme, the same "version everything that could need to change later"
 * reasoning `BACKUP_FORMAT_VERSION` uses in `domain/backup/types.ts`: a
 * future stronger/different scheme is a new `alg` value, decodable
 * alongside old ones, rather than a breaking change.
 */
export interface EncryptedBackupEnvelope {
  alg: 'aes-256-gcm-v1';
  /** Base64, opaque to every caller above this module. */
  data: string;
}

/**
 * The one door `CloudBackupService` uses to encrypt a backup payload before
 * `CloudBackupApi.uploadBackup()` and decrypt one after
 * `CloudBackupApi.downloadBackup()`. Deliberately separate from
 * `CloudBackupApi` (the network door) — encryption/decryption never touches
 * the network, and keeping it its own interface means `CloudBackupService`
 * never has to know *how* a payload is protected, only that it is, before it
 * leaves the device. See `ExpoBackupEncryptionService` for the real
 * implementation (native AES-256-GCM via `expo-crypto`) and
 * `FakeBackupEncryptionService` for the Jest-safe double every test in this
 * phase runs against.
 */
export interface BackupEncryptionService {
  encrypt(plaintext: string): Promise<EncryptedBackupEnvelope>;
  decrypt(envelope: EncryptedBackupEnvelope): Promise<string>;
}
