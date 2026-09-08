import type { DriveBackupFile } from '@/domain/backup/types';

/** Thrown when there is no network path to Google at all (airplane mode, no Wi-Fi/cell) — distinct from `DriveUnavailableError` so the UI can say "you're offline" instead of "Google Drive is having trouble". */
export class OfflineError extends Error {
  constructor(message = "You're offline — connect to the internet to back up or restore.") {
    super(message);
    this.name = 'OfflineError';
  }
}

/** Thrown when the device is online but Google Drive itself rejects/fails the request (outage, rate limit, revoked access, quota, a non-2xx response) — see "Test: Google Drive unavailable". */
export class DriveUnavailableError extends Error {
  constructor(message = "Google Drive isn't available right now. Try again in a moment.") {
    super(message);
    this.name = 'DriveUnavailableError';
  }
}

/** Thrown by `signIn()`/`uploadBackup()`/etc. when the app isn't signed in to a Google account yet. */
export class NotSignedInError extends Error {
  constructor(message = 'Sign in with Google before backing up or restoring.') {
    super(message);
    this.name = 'NotSignedInError';
  }
}

/**
 * The one door `BackupService` uses to reach Google Drive — never a live
 * data source (`MVP_BUILD_PLAN.md` §4: "Google Drive is a backup destination
 * only"), just a place to put/get one JSON file per backup. Every method can
 * throw `OfflineError` or `DriveUnavailableError`; callers (see
 * `BackupService`) always catch those and turn them into a failed
 * `BackupLogEntry` rather than letting them bubble into the UI as a raw
 * exception.
 *
 * Backups are stored in Drive's **App Data folder** (`spaces: appDataFolder`,
 * scope `drive.appdata`) — a hidden, per-app storage area the user's Drive UI
 * never shows and no other app can read, matching
 * `MVP_BUILD_PLAN.md` §2's "Google Drive backup ... (App Data folder)". This
 * also means signing out of/reinstalling the app doesn't touch the user's
 * visible Drive files.
 */
export interface GoogleDriveBackupService {
  /** Whether the app currently holds a usable (or refreshable) Google sign-in — checking this is inherently async (it may read from secure storage), so callers `await` it once per screen load, the same way `securityStore.load()` awaits `BiometricService.isSupported()`. */
  isSignedIn(): Promise<boolean>;
  /** Runs the Google OAuth flow (see `ExpoGoogleDriveBackupService`'s doc comment for the real, browser-based implementation). Resolves once signed in; throws if the user cancels or the device is offline. */
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Uploads `content` as a new file named `fileName` into the App Data folder. */
  uploadBackup(fileName: string, content: string): Promise<DriveBackupFile>;
  /** Every backup file in the App Data folder, newest first. */
  listBackups(): Promise<DriveBackupFile[]>;
  downloadBackup(fileId: string): Promise<string>;
  deleteBackup(fileId: string): Promise<void>;
}
