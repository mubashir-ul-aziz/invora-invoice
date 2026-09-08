import Constants from 'expo-constants';

import type { BusinessRepository } from './business/BusinessRepository';
import { SqliteBusinessRepository } from './business/SqliteBusinessRepository';
import type { BusinessCardRepository } from './businessCard/BusinessCardRepository';
import { SqliteBusinessCardRepository } from './businessCard/SqliteBusinessCardRepository';
import type { CustomerRepository } from './customer/CustomerRepository';
import { SqliteCustomerRepository } from './customer/SqliteCustomerRepository';
import type { CustomerActivityRepository } from './customerActivity/CustomerActivityRepository';
import { InvoiceBackedCustomerActivityRepository } from './customerActivity/InvoiceBackedCustomerActivityRepository';
import type { DashboardRepository } from './dashboard/DashboardRepository';
import { SqliteDashboardRepository } from './dashboard/SqliteDashboardRepository';
import type { InvoiceRepository } from './invoice/InvoiceRepository';
import { SqliteInvoiceRepository } from './invoice/SqliteInvoiceRepository';
import type { ItemRepository } from './item/ItemRepository';
import { SqliteItemRepository } from './item/SqliteItemRepository';
import type { PaymentRepository } from './payment/PaymentRepository';
import { SqlitePaymentRepository } from './payment/SqlitePaymentRepository';
import { PaymentBackedPaymentTotalsRepository } from './paymentTotals/PaymentBackedPaymentTotalsRepository';
import type { PaymentTotalsRepository } from './paymentTotals/PaymentTotalsRepository';
import { ExpoPdfService } from './pdf/ExpoPdfService';
import type { PdfService } from './pdf/PdfService';
import { LocalInvoiceShareLinkService } from './shareLink/LocalInvoiceShareLinkService';
import { LocalShareLinkService } from './shareLink/LocalShareLinkService';
import type { InvoiceShareLinkService } from './shareLink/InvoiceShareLinkService';
import type { ShareLinkService } from './shareLink/ShareLinkService';
import { ExpoBiometricService } from './security/ExpoBiometricService';
import type { BiometricService } from './security/BiometricService';
import { SqliteSecurityRepository } from './security/SqliteSecurityRepository';
import type { SecurityRepository } from './security/SecurityRepository';
import { BackupService } from './backup/BackupService';
import type { BackupLogRepository } from './backup/BackupLogRepository';
import { SqliteBackupLogRepository } from './backup/SqliteBackupLogRepository';
import type { BackupRepository } from './backup/BackupRepository';
import { SqliteBackupRepository } from './backup/SqliteBackupRepository';
import type { BackupSettingsRepository } from './backup/BackupSettingsRepository';
import { SqliteBackupSettingsRepository } from './backup/SqliteBackupSettingsRepository';
import { ExpoGoogleDriveBackupService } from './backup/googleDrive/ExpoGoogleDriveBackupService';
import type { GoogleDriveBackupService } from './backup/googleDrive/GoogleDriveBackupService';
import { CloudBackupService } from './cloudBackup/CloudBackupService';
import type { CloudBackupApi } from './cloudBackup/CloudBackupApi';
import { RestCloudBackupApi } from './cloudBackup/RestCloudBackupApi';
import type { CloudBackupSettingsRepository } from './cloudBackup/CloudBackupSettingsRepository';
import { SqliteCloudBackupSettingsRepository } from './cloudBackup/SqliteCloudBackupSettingsRepository';
import type { BackupEncryptionService } from './cloudBackup/encryption/BackupEncryptionService';
import { ExpoBackupEncryptionService } from './cloudBackup/encryption/ExpoBackupEncryptionService';
import type { CloudUpgradeService } from './subscription/CloudUpgradeService';
import { PlaceholderCloudUpgradeService } from './subscription/PlaceholderCloudUpgradeService';

/**
 * Composition root: the one place that knows which concrete repository/
 * service implementation is wired up at runtime. Screens and stores depend
 * only on the interfaces above.
 *
 * Tests / Storybook-style previews should not import this module — they
 * should construct an `InMemoryBusinessCardRepository` directly and inject
 * it, exactly like the frontend-first mock phase did.
 */
let businessCardRepository: BusinessCardRepository | null = null;
let businessRepository: BusinessRepository | null = null;
let itemRepository: ItemRepository | null = null;
let customerRepository: CustomerRepository | null = null;
let customerActivityRepository: CustomerActivityRepository | null = null;
let dashboardRepository: DashboardRepository | null = null;
let invoiceRepository: InvoiceRepository | null = null;
let paymentRepository: PaymentRepository | null = null;
let paymentTotalsRepository: PaymentTotalsRepository | null = null;
let shareLinkService: ShareLinkService | null = null;
let invoiceShareLinkService: InvoiceShareLinkService | null = null;
let pdfService: PdfService | null = null;
let securityRepository: SecurityRepository | null = null;
let biometricService: BiometricService | null = null;
let backupRepository: BackupRepository | null = null;
let backupLogRepository: BackupLogRepository | null = null;
let backupSettingsRepository: BackupSettingsRepository | null = null;
let googleDriveBackupService: GoogleDriveBackupService | null = null;
let backupService: BackupService | null = null;
let cloudBackupSettingsRepository: CloudBackupSettingsRepository | null = null;
let cloudBackupApi: CloudBackupApi | null = null;
let backupEncryptionService: BackupEncryptionService | null = null;
let cloudBackupService: CloudBackupService | null = null;
let cloudUpgradeService: CloudUpgradeService | null = null;

export function getBusinessCardRepository(): BusinessCardRepository {
  if (!businessCardRepository) {
    businessCardRepository = new SqliteBusinessCardRepository();
  }
  return businessCardRepository;
}

export function getBusinessRepository(): BusinessRepository {
  if (!businessRepository) {
    businessRepository = new SqliteBusinessRepository();
  }
  return businessRepository;
}

export function getItemRepository(): ItemRepository {
  if (!itemRepository) {
    itemRepository = new SqliteItemRepository();
  }
  return itemRepository;
}

export function getCustomerRepository(): CustomerRepository {
  if (!customerRepository) {
    customerRepository = new SqliteCustomerRepository();
  }
  return customerRepository;
}

export function getInvoiceRepository(): InvoiceRepository {
  if (!invoiceRepository) {
    invoiceRepository = new SqliteInvoiceRepository();
  }
  return invoiceRepository;
}

export function getPaymentRepository(): PaymentRepository {
  if (!paymentRepository) {
    paymentRepository = new SqlitePaymentRepository();
  }
  return paymentRepository;
}

/**
 * See the doc comment on `PaymentTotalsRepository` — Phase 7 replaces
 * `ZeroPaymentTotalsRepository` with the real, payment-backed implementation
 * its doc comment predicted.
 */
export function getPaymentTotalsRepository(): PaymentTotalsRepository {
  if (!paymentTotalsRepository) {
    paymentTotalsRepository = new PaymentBackedPaymentTotalsRepository(getPaymentRepository());
  }
  return paymentTotalsRepository;
}

/**
 * See the doc comment on `CustomerActivityRepository`. Phase 6 replaced
 * `NullCustomerActivityRepository` with the real, invoice-backed
 * implementation predicted in Phase 5; Phase 7 threads real payments into
 * that same implementation (both the totals and the individual payment
 * rows) instead of introducing a second one.
 */
export function getCustomerActivityRepository(): CustomerActivityRepository {
  if (!customerActivityRepository) {
    customerActivityRepository = new InvoiceBackedCustomerActivityRepository(
      getInvoiceRepository(),
      getPaymentTotalsRepository(),
      getPaymentRepository(),
    );
  }
  return customerActivityRepository;
}

/**
 * See the doc comment on `SqliteDashboardRepository` for why the Dashboard
 * gets its own repository instead of reusing `InvoiceRepository`/
 * `PaymentTotalsRepository` — its aggregate SQL queries are the "optimize
 * queries so the dashboard remains fast with many invoices" half of Phase 8.
 */
export function getDashboardRepository(): DashboardRepository {
  if (!dashboardRepository) {
    dashboardRepository = new SqliteDashboardRepository();
  }
  return dashboardRepository;
}

export function getShareLinkService(): ShareLinkService {
  if (!shareLinkService) {
    shareLinkService = new LocalShareLinkService();
  }
  return shareLinkService;
}

/** See the doc comment on `InvoiceShareLinkService` — the invoice-PDF counterpart to `getShareLinkService()`. */
export function getInvoiceShareLinkService(): InvoiceShareLinkService {
  if (!invoiceShareLinkService) {
    invoiceShareLinkService = new LocalInvoiceShareLinkService();
  }
  return invoiceShareLinkService;
}

/** See the doc comment on `PdfService` (Phase 9 — PDF and Sharing). */
export function getPdfService(): PdfService {
  if (!pdfService) {
    pdfService = new ExpoPdfService();
  }
  return pdfService;
}

/** See the doc comment on `SecurityRepository` (Phase 10 — Settings). */
export function getSecurityRepository(): SecurityRepository {
  if (!securityRepository) {
    securityRepository = new SqliteSecurityRepository();
  }
  return securityRepository;
}

/** See the doc comment on `BiometricService` (Phase 10 — Settings). */
export function getBiometricService(): BiometricService {
  if (!biometricService) {
    biometricService = new ExpoBiometricService();
  }
  return biometricService;
}

/** See the doc comment on `BackupRepository` (Phase 11 — Google Drive Backup). */
export function getBackupRepository(): BackupRepository {
  if (!backupRepository) {
    backupRepository = new SqliteBackupRepository();
  }
  return backupRepository;
}

/** See the doc comment on `BackupLogRepository`. */
export function getBackupLogRepository(): BackupLogRepository {
  if (!backupLogRepository) {
    backupLogRepository = new SqliteBackupLogRepository();
  }
  return backupLogRepository;
}

/** See the doc comment on `BackupSettingsRepository`. */
export function getBackupSettingsRepository(): BackupSettingsRepository {
  if (!backupSettingsRepository) {
    backupSettingsRepository = new SqliteBackupSettingsRepository();
  }
  return backupSettingsRepository;
}

/** See the doc comment on `GoogleDriveBackupService`. */
export function getGoogleDriveBackupService(): GoogleDriveBackupService {
  if (!googleDriveBackupService) {
    googleDriveBackupService = new ExpoGoogleDriveBackupService();
  }
  return googleDriveBackupService;
}

/** See the doc comment on `BackupService` — the composition root for every dependency Phase 11's store/screens need. */
export function getBackupService(): BackupService {
  if (!backupService) {
    backupService = new BackupService(
      getBackupRepository(),
      getBackupLogRepository(),
      getBackupSettingsRepository(),
      getGoogleDriveBackupService(),
      Constants.expoConfig?.version ?? '1.0.0',
    );
  }
  return backupService;
}

/** See the doc comment on `CloudBackupSettingsRepository` (Phase 12 — Optional Cloud Backup). */
export function getCloudBackupSettingsRepository(): CloudBackupSettingsRepository {
  if (!cloudBackupSettingsRepository) {
    cloudBackupSettingsRepository = new SqliteCloudBackupSettingsRepository();
  }
  return cloudBackupSettingsRepository;
}

/** See the doc comment on `CloudBackupApi`. */
export function getCloudBackupApi(): CloudBackupApi {
  if (!cloudBackupApi) {
    cloudBackupApi = new RestCloudBackupApi();
  }
  return cloudBackupApi;
}

/** See the doc comment on `BackupEncryptionService`. */
export function getBackupEncryptionService(): BackupEncryptionService {
  if (!backupEncryptionService) {
    backupEncryptionService = new ExpoBackupEncryptionService();
  }
  return backupEncryptionService;
}

/**
 * See the doc comment on `CloudBackupService` — the composition root for
 * every dependency Phase 12's store/screens need. Deliberately reuses
 * `getBackupRepository()`/`getBackupLogRepository()` (Phase 11) instead of
 * constructing cloud-specific equivalents — see `CloudBackupService`'s doc
 * comment for why.
 */
export function getCloudBackupService(): CloudBackupService {
  if (!cloudBackupService) {
    cloudBackupService = new CloudBackupService(
      getBackupRepository(),
      getBackupLogRepository(),
      getCloudBackupSettingsRepository(),
      getCloudBackupApi(),
      getBackupEncryptionService(),
      Constants.expoConfig?.version ?? '1.0.0',
    );
  }
  return cloudBackupService;
}

/** See the doc comment on `CloudUpgradeService`. */
export function getCloudUpgradeService(): CloudUpgradeService {
  if (!cloudUpgradeService) {
    cloudUpgradeService = new PlaceholderCloudUpgradeService();
  }
  return cloudUpgradeService;
}
