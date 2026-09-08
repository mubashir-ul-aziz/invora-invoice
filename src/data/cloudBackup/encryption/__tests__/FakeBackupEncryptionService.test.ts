import { FakeBackupEncryptionService } from '../FakeBackupEncryptionService';

describe('FakeBackupEncryptionService', () => {
  it('round-trips plaintext through encrypt/decrypt', async () => {
    const service = new FakeBackupEncryptionService();
    const plaintext = JSON.stringify({ hello: 'world', n: 42 });

    const envelope = await service.encrypt(plaintext);
    expect(envelope.alg).toBe('aes-256-gcm-v1');
    expect(envelope.data).not.toBe(plaintext); // never stores plaintext verbatim

    const decrypted = await service.decrypt(envelope);
    expect(decrypted).toBe(plaintext);
  });

  it('rejects an envelope with an unsupported algorithm', async () => {
    const service = new FakeBackupEncryptionService();
    await expect(
      service.decrypt({ alg: 'unknown-alg' as never, data: 'abc' }),
    ).rejects.toThrow(/unsupported/i);
  });

  it('simulateDecryptFailure makes decrypt throw', async () => {
    const service = new FakeBackupEncryptionService();
    const envelope = await service.encrypt('{}');
    service.simulateDecryptFailure = new Error('corrupted envelope');

    await expect(service.decrypt(envelope)).rejects.toThrow('corrupted envelope');
  });
});
