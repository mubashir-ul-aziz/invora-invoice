import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import type { SubscriptionCacheSigner } from './SubscriptionCacheRepository';

const SECRET_STORAGE_KEY = 'metriqo_subscription_cache_secret';

/**
 * Real signer. A random 256-bit secret is generated once per install and kept
 * in `expo-secure-store` (the Android Keystore-backed store — same place the
 * cloud-backup encryption key lives), never in SQLite and never in a backup.
 * The signature is SHA-256 over `secret | payload | secret`. This is
 * tamper-*evidence* against casual edits and cross-device copies, not a
 * defence against a fully compromised (rooted + instrumented) device — the
 * entitlement itself is always re-verified by RevenueCat when online, so the
 * cache only bounds what an offline device may do.
 *
 * No Jest coverage — native modules, no device in this environment; the
 * sign/verify contract is exercised through `FakeSubscriptionCacheSigner`.
 */
export class ExpoSecureStoreCacheSigner implements SubscriptionCacheSigner {
  private cachedSecret: string | null = null;

  private async getSecret(): Promise<string> {
    if (this.cachedSecret) {
      return this.cachedSecret;
    }
    let secret = await SecureStore.getItemAsync(SECRET_STORAGE_KEY);
    if (!secret) {
      const bytes = await Crypto.getRandomBytesAsync(32);
      secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync(SECRET_STORAGE_KEY, secret);
    }
    this.cachedSecret = secret;
    return secret;
  }

  async sign(payload: string): Promise<string> {
    const secret = await this.getSecret();
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${secret}|${payload}|${secret}`);
  }

  async verify(payload: string, signature: string): Promise<boolean> {
    const expected = await this.sign(payload);
    return expected === signature;
  }
}
