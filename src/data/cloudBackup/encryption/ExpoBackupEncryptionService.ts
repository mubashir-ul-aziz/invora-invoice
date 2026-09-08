import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import type { BackupEncryptionService, EncryptedBackupEnvelope } from './BackupEncryptionService';

const KEY_STORAGE_KEY = 'invora_cloud_backup_encryption_key';

/**
 * Real implementation, using `expo-crypto`'s native AES-256-GCM (the `AES`
 * submodule already ships in this SDK version — see the doc comment below —
 * so no new dependency was added for this phase). The key is generated once
 * per device and stored via `expo-secure-store` (a credential, not app
 * data — same reasoning Phase 11 used for the Google OAuth tokens), never
 * uploaded anywhere: the cloud object-storage backend only ever sees
 * ciphertext, and only this device can decrypt what it uploaded.
 *
 * `expo-crypto`'s AES functions work on bytes, not JS strings directly, so
 * this relies on the global `TextEncoder`/`TextDecoder` React Native ships
 * by default (landed in Hermes some releases before the RN 0.86 this project
 * pins) rather than adding a UTF-8/base64 polyfill package. No Jest
 * coverage — same "native module, no device in this environment" reasoning
 * as `ExpoGoogleDriveBackupService`/`SqliteBackupRepository`; the envelope
 * shape and round-trip behavior are instead proven, in plain TypeScript,
 * against `FakeBackupEncryptionService`'s deterministic double.
 */
export class ExpoBackupEncryptionService implements BackupEncryptionService {
  private cachedKey: InstanceType<typeof Crypto.AESEncryptionKey> | null = null;

  private async getOrCreateKey(): Promise<InstanceType<typeof Crypto.AESEncryptionKey>> {
    if (this.cachedKey) {
      return this.cachedKey;
    }
    const stored = await SecureStore.getItemAsync(KEY_STORAGE_KEY);
    if (stored) {
      this.cachedKey = (await Crypto.AESEncryptionKey.import(stored, 'hex')) as InstanceType<
        typeof Crypto.AESEncryptionKey
      >;
      return this.cachedKey;
    }
    const generated = (await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256)) as InstanceType<
      typeof Crypto.AESEncryptionKey
    >;
    const encoded = await generated.encoded('hex');
    await SecureStore.setItemAsync(KEY_STORAGE_KEY, encoded);
    this.cachedKey = generated;
    return generated;
  }

  async encrypt(plaintext: string): Promise<EncryptedBackupEnvelope> {
    const key = await this.getOrCreateKey();
    const bytes = new TextEncoder().encode(plaintext);
    const sealed = await Crypto.aesEncryptAsync(bytes, key);
    const combined = await sealed.combined('base64');
    return { alg: 'aes-256-gcm-v1', data: combined };
  }

  async decrypt(envelope: EncryptedBackupEnvelope): Promise<string> {
    if (envelope.alg !== 'aes-256-gcm-v1') {
      throw new Error(`Unsupported backup encryption scheme: ${envelope.alg}`);
    }
    const key = await this.getOrCreateKey();
    const sealed = Crypto.AESSealedData.fromCombined(envelope.data);
    // No `output` option passed, so this always resolves a `Uint8Array` — see `aesDecryptAsync`'s overloads.
    const bytes = await Crypto.aesDecryptAsync(sealed, key);
    return new TextDecoder().decode(bytes);
  }
}
