import { DriveUnavailableError, NotSignedInError, OfflineError } from '../GoogleDriveBackupService';
import { FakeGoogleDriveBackupService } from '../FakeGoogleDriveBackupService';

describe('FakeGoogleDriveBackupService', () => {
  it('starts signed out', async () => {
    const service = new FakeGoogleDriveBackupService();
    await expect(service.isSignedIn()).resolves.toBe(false);
  });

  it('signIn/signOut toggle signed-in state', async () => {
    const service = new FakeGoogleDriveBackupService();
    await service.signIn();
    await expect(service.isSignedIn()).resolves.toBe(true);
    await service.signOut();
    await expect(service.isSignedIn()).resolves.toBe(false);
  });

  it('requires sign-in before uploading/listing/downloading/deleting', async () => {
    const service = new FakeGoogleDriveBackupService();
    await expect(service.uploadBackup('a.json', '{}')).rejects.toBeInstanceOf(NotSignedInError);
    await expect(service.listBackups()).rejects.toBeInstanceOf(NotSignedInError);
    await expect(service.downloadBackup('x')).rejects.toBeInstanceOf(NotSignedInError);
    await expect(service.deleteBackup('x')).rejects.toBeInstanceOf(NotSignedInError);
  });

  it('uploads and lists backups newest first', async () => {
    const service = new FakeGoogleDriveBackupService();
    await service.signIn();
    await service.uploadBackup('one.json', '{"a":1}');
    await new Promise((resolve) => setTimeout(resolve, 2));
    await service.uploadBackup('two.json', '{"a":2}');

    const files = await service.listBackups();
    expect(files).toHaveLength(2);
    expect(files[0].name).toBe('two.json');
  });

  it('downloads exactly what was uploaded', async () => {
    const service = new FakeGoogleDriveBackupService();
    await service.signIn();
    const meta = await service.uploadBackup('one.json', '{"hello":"world"}');
    await expect(service.downloadBackup(meta.id)).resolves.toBe('{"hello":"world"}');
  });

  it('deletes a backup', async () => {
    const service = new FakeGoogleDriveBackupService();
    await service.signIn();
    const meta = await service.uploadBackup('one.json', '{}');
    await service.deleteBackup(meta.id);
    await expect(service.listBackups()).resolves.toEqual([]);
  });

  it('simulateOffline makes every call throw OfflineError', async () => {
    const service = new FakeGoogleDriveBackupService();
    await service.signIn();
    service.simulateOffline = true;
    await expect(service.uploadBackup('a.json', '{}')).rejects.toBeInstanceOf(OfflineError);
  });

  it('simulateUnavailable makes every call throw DriveUnavailableError', async () => {
    const service = new FakeGoogleDriveBackupService();
    await service.signIn();
    service.simulateUnavailable = true;
    await expect(service.listBackups()).rejects.toBeInstanceOf(DriveUnavailableError);
  });
});
