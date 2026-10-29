import { utf8ByteLength } from '@/domain/backup/size';
import {
  countBackupTables,
  type BackupCounts,
  type BackupPayload,
  type BackupPreview,
  type BackupTables,
} from '@/domain/backup/types';
import { buildBackupPayload, previewBackup, serializeBackupPayload, validateBackupPayload } from '@/domain/backup/validation';

import type { BackupRepository } from './BackupRepository';
import type { BackupAssetStore } from './files/BackupAssetStore';

/** A freshly made backup, ready to write to Drive, the cloud or a file. */
export interface CreatedBackup {
  payload: BackupPayload;
  /** The exact file content. */
  content: string;
  sizeBytes: number;
  counts: BackupCounts;
  /** The business row's logo path on this device at backup time (the payload itself carries the image, not the path). */
  sourceLogoUri: string | null;
}

/** A backup file that passed every check in `validateBackupPayload()` — the only thing `apply()` accepts. */
export interface InspectedBackup {
  payload: BackupPayload;
  preview: BackupPreview;
}

/**
 * The one backup format, shared by Google Drive (`BackupService`), the
 * optional cloud (`CloudBackupService`) and local files
 * (`LocalBackupService`): how a backup is assembled from the database, how a
 * file is checked, and how a checked backup replaces the local data.
 */
export class BackupPayloadService {
  constructor(
    private readonly backupRepository: BackupRepository,
    private readonly assets: BackupAssetStore,
    private readonly appVersion: string,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Reads every backed-up table and embeds the logo image. The payload's
   * `business.logoUri` is cleared — a device path means nothing on another
   * device; restore recreates it from the embedded image.
   */
  async create(createdAt: number = this.now()): Promise<CreatedBackup> {
    const tables = await this.backupRepository.exportAll();
    const sourceLogoUri = tables.business[0]?.logoUri ?? null;
    const logo = sourceLogoUri ? await this.assets.readImage(sourceLogoUri) : null;
    const portable: BackupTables = {
      ...tables,
      business: tables.business.map((row) => ({ ...row, logoUri: null })),
    };
    const payload = buildBackupPayload(portable, { logo }, this.appVersion, createdAt);
    const content = serializeBackupPayload(payload);
    return { payload, content, sizeBytes: utf8ByteLength(content), counts: countBackupTables(tables), sourceLogoUri };
  }

  /** Validates a backup file's content. Throws `BackupValidationError`; never touches the database. */
  inspect(raw: string): InspectedBackup {
    const payload = validateBackupPayload(raw);
    return { payload, preview: previewBackup(payload, utf8ByteLength(raw)) };
  }

  /**
   * Replaces the local business data with an inspected backup, atomically
   * (`BackupRepository.restoreAll()` is one transaction). The embedded logo
   * is written to a new durable file *before* the transaction; if the
   * transaction fails, that new file is deleted again and the old data and
   * old logo are untouched. Only after success is the previous logo file
   * removed — and only if this app created it.
   *
   * A version-1 backup carries no image, only a device path: it's kept if
   * that file still exists on this device (same-device restore), otherwise
   * the logo is left empty rather than pointing at a missing file.
   */
  async apply(inspected: InspectedBackup, previousLogoUri: string | null = null): Promise<void> {
    const { payload } = inspected;
    let newLogoUri: string | null = null;
    let logoUri: string | null = null;

    const business = payload.tables.business[0];
    if (business) {
      if (payload.assets.logo) {
        newLogoUri = await this.assets.writeLogo(payload.assets.logo);
        logoUri = newLogoUri;
      } else if (business.logoUri && (await this.assets.exists(business.logoUri))) {
        logoUri = business.logoUri;
      }
    }

    const tables: BackupTables = {
      ...payload.tables,
      business: payload.tables.business.map((row) => ({ ...row, logoUri })),
    };

    try {
      await this.backupRepository.restoreAll(tables);
    } catch (error) {
      if (newLogoUri) {
        await this.assets.delete(newLogoUri);
      }
      throw error;
    }

    if (previousLogoUri && previousLogoUri !== logoUri && this.assets.isManaged(previousLogoUri)) {
      await this.assets.delete(previousLogoUri);
    }
  }
}
