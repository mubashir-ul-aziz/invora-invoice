import type { BusinessRepository } from './business/BusinessRepository';
import { SqliteBusinessRepository } from './business/SqliteBusinessRepository';
import type { BusinessCardRepository } from './businessCard/BusinessCardRepository';
import { SqliteBusinessCardRepository } from './businessCard/SqliteBusinessCardRepository';
import type { CustomerRepository } from './customer/CustomerRepository';
import { SqliteCustomerRepository } from './customer/SqliteCustomerRepository';
import type { CustomerActivityRepository } from './customerActivity/CustomerActivityRepository';
import { InvoiceBackedCustomerActivityRepository } from './customerActivity/InvoiceBackedCustomerActivityRepository';
import type { InvoiceRepository } from './invoice/InvoiceRepository';
import { SqliteInvoiceRepository } from './invoice/SqliteInvoiceRepository';
import type { ItemRepository } from './item/ItemRepository';
import { SqliteItemRepository } from './item/SqliteItemRepository';
import type { PaymentTotalsRepository } from './paymentTotals/PaymentTotalsRepository';
import { ZeroPaymentTotalsRepository } from './paymentTotals/ZeroPaymentTotalsRepository';
import { LocalShareLinkService } from './shareLink/LocalShareLinkService';
import type { ShareLinkService } from './shareLink/ShareLinkService';

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
let invoiceRepository: InvoiceRepository | null = null;
let paymentTotalsRepository: PaymentTotalsRepository | null = null;
let shareLinkService: ShareLinkService | null = null;

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

/**
 * See the doc comment on `PaymentTotalsRepository` — this returns the
 * honest "no payments exist yet" implementation until Phase 7 provides a
 * real one to swap in here.
 */
export function getPaymentTotalsRepository(): PaymentTotalsRepository {
  if (!paymentTotalsRepository) {
    paymentTotalsRepository = new ZeroPaymentTotalsRepository();
  }
  return paymentTotalsRepository;
}

/**
 * See the doc comment on `CustomerActivityRepository`. Phase 6 replaces
 * `NullCustomerActivityRepository` with the real, invoice-backed
 * implementation predicted in Phase 5 — payments (Phase 7) still come back
 * as zero via `getPaymentTotalsRepository()` until that phase exists.
 */
export function getCustomerActivityRepository(): CustomerActivityRepository {
  if (!customerActivityRepository) {
    customerActivityRepository = new InvoiceBackedCustomerActivityRepository(
      getInvoiceRepository(),
      getPaymentTotalsRepository(),
    );
  }
  return customerActivityRepository;
}

export function getShareLinkService(): ShareLinkService {
  if (!shareLinkService) {
    shareLinkService = new LocalShareLinkService();
  }
  return shareLinkService;
}
