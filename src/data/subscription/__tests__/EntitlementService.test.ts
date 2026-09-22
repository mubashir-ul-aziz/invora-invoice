import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import type { Invoice } from '@/domain/invoice/types';
import { InvoiceLimitError } from '@/domain/subscription/invoiceAccess';

import { EntitlementService } from '../EntitlementService';
import { InvoiceUsageTracker } from '../InvoiceUsageTracker';
import { DAY, START, activeInfo, lapsedInfo, makeHarness } from '../testFixtures';

const HOUR = 3_600_000;

function seedInvoice(id: string, createdAtMs: number): Invoice {
  const iso = new Date(createdAtMs).toISOString();
  return {
    id,
    invoiceNumber: `INV-${id}`,
    customerId: 'cust_1',
    customerName: 'Acme',
    invoiceTypeId: 'general',
    issueDate: iso.slice(0, 10),
    dueDate: null,
    notes: null,
    terms: null,
    items: [],
    createdAt: iso,
    updatedAt: iso,
  };
}

function makeEntitlement(seed: Invoice[] = []) {
  const h = makeHarness();
  const invoices = new InMemoryInvoiceRepository(seed);
  const tracker = new InvoiceUsageTracker(invoices, h.cache, () => h.clock.now);
  const entitlement = new EntitlementService(h.service, tracker, () => h.clock.now);
  return { ...h, invoices, tracker, entitlement };
}

async function createInvoiceRecorded(e: ReturnType<typeof makeEntitlement>, id: string) {
  await e.entitlement.assertCanCreate();
  await e.invoices.create(`INV-${id}`, {
    customerId: 'c',
    customerName: 'C',
    invoiceTypeId: 'general',
    issueDate: '2026-09-10',
    dueDate: null,
    notes: null,
    terms: null,
    items: [],
  });
  await e.entitlement.recordCreated();
}

describe('EntitlementService — invoice limits', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: START, doNotFake: ['setImmediate', 'nextTick'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('lets a Free user create 5 invoices in a month and blocks the 6th', async () => {
    const e = makeEntitlement();
    for (let i = 1; i <= 5; i += 1) {
      await createInvoiceRecorded(e, String(i));
    }
    const decision = await e.entitlement.canCreateInvoice();
    expect(decision.allowed).toBe(false);
    await expect(e.entitlement.assertCanCreate()).rejects.toBeInstanceOf(InvoiceLimitError);
    expect(await e.invoices.list()).toHaveLength(5); // nothing deleted, nothing extra created
  });

  it('counts only invoices created in the current calendar month', async () => {
    const lastMonth = new Date(2026, 7, 28, 12).getTime();
    const e = makeEntitlement([seedInvoice('a', lastMonth), seedInvoice('b', lastMonth), seedInvoice('c', START - HOUR)]);
    const usage = await e.entitlement.getInvoiceUsage();
    expect(usage.used).toBe(1);
    expect(usage.limit).toBe(5);
    expect(usage.remaining).toBe(4);
  });

  it('resets the count when the calendar month rolls over', async () => {
    const e = makeEntitlement();
    for (let i = 1; i <= 5; i += 1) {
      await createInvoiceRecorded(e, String(i));
    }
    expect((await e.entitlement.canCreateInvoice()).allowed).toBe(false);

    const nextMonth = new Date(2026, 9, 1, 0, 5).getTime();
    e.clock.now = nextMonth;
    jest.setSystemTime(nextMonth);

    const decision = await e.entitlement.canCreateInvoice();
    expect(decision.allowed).toBe(true);
    expect(decision.usage.used).toBe(0);
  });

  it('does not let deleting an invoice hand the slot back', async () => {
    const e = makeEntitlement();
    for (let i = 1; i <= 5; i += 1) {
      await createInvoiceRecorded(e, String(i));
    }
    const [first] = await e.invoices.list();
    await e.invoices.delete(first.id);

    expect((await e.entitlement.getInvoiceUsage()).used).toBe(5);
    expect((await e.entitlement.canCreateInvoice()).allowed).toBe(false);
  });

  it.each([
    ['starter', 15],
    ['business', 40],
    ['pro', 100],
  ] as const)('applies the %s limit of %i once RevenueCat says so', async (plan, limit) => {
    const e = makeEntitlement(Array.from({ length: limit }, (_, i) => seedInvoice(String(i), START - HOUR)));
    e.adapter.setCustomerInfo(activeInfo(plan, e.clock.now));
    await e.service.refresh();

    expect((await e.entitlement.getInvoiceUsage()).limit).toBe(limit);
    expect((await e.entitlement.canCreateInvoice()).allowed).toBe(false);
  });

  it('never limits Unlimited', async () => {
    const e = makeEntitlement(Array.from({ length: 300 }, (_, i) => seedInvoice(String(i), START - HOUR)));
    e.adapter.setCustomerInfo(activeInfo('unlimited', e.clock.now));
    await e.service.refresh();

    const usage = await e.entitlement.getInvoiceUsage();
    expect(usage.limit).toBeNull();
    expect((await e.entitlement.canCreateInvoice()).allowed).toBe(true);
  });

  it('enforces limits with no network, from SQLite and the last known plan', async () => {
    const e = makeEntitlement(Array.from({ length: 15 }, (_, i) => seedInvoice(String(i), START - HOUR)));
    e.adapter.setCustomerInfo(activeInfo('starter', e.clock.now));
    await e.service.refresh();

    e.connectivity.setOnline(false);
    const restarted = new EntitlementService(e.restart(), e.tracker, () => e.clock.now);
    await (restarted as unknown as { subscription: { loadCached(): Promise<unknown> } }).subscription.loadCached();

    expect(restarted.getPlan()).toBe('starter');
    expect((await restarted.canCreateInvoice()).allowed).toBe(false);
  });

  it('does not reset the monthly count by rolling the device clock back a month', async () => {
    const e = makeEntitlement();
    for (let i = 1; i <= 5; i += 1) {
      await createInvoiceRecorded(e, String(i));
    }
    e.clock.now = new Date(2026, 7, 15).getTime(); // user sets the date back to August
    expect((await e.entitlement.canCreateInvoice()).allowed).toBe(false);
  });
});

describe('EntitlementService — historical invoice access', () => {
  it('gives Free users 24 hours from createdAt, then locks (without touching data)', async () => {
    const created = START;
    const e = makeEntitlement([seedInvoice('a', created)]);
    await e.service.loadCached();

    e.clock.now = created + 23 * HOUR;
    expect(e.entitlement.canAccessHistoricalInvoice(new Date(created).toISOString())).toBe(true);

    e.clock.now = created + 24 * HOUR;
    expect(e.entitlement.canAccessHistoricalInvoice(new Date(created).toISOString())).toBe(false);
    expect(await e.invoices.getById('a')).not.toBeNull();
  });

  it('never locks invoices for a paid plan', async () => {
    const e = makeEntitlement([seedInvoice('a', START - 400 * DAY)]);
    e.adapter.setCustomerInfo(activeInfo('starter', e.clock.now));
    await e.service.refresh();
    expect(e.entitlement.canAccessHistoricalInvoice(new Date(START - 400 * DAY).toISOString())).toBe(true);
  });

  it('locks history on downgrade, keeps every invoice, and restores access on re-subscribe', async () => {
    const old = START - 30 * DAY;
    const e = makeEntitlement([seedInvoice('old', old), seedInvoice('new', START - HOUR)]);
    const oldIso = new Date(old).toISOString();
    const newIso = new Date(START - HOUR).toISOString();

    e.adapter.setCustomerInfo(activeInfo('business', e.clock.now));
    await e.service.refresh();
    expect(e.entitlement.canAccessHistoricalInvoice(oldIso)).toBe(true);

    // Subscription lapses.
    e.clock.now += DAY;
    e.adapter.setCustomerInfo(lapsedInfo('business', e.clock.now));
    await e.service.refresh();
    expect(e.entitlement.getPlan()).toBe('free');
    expect(e.entitlement.canAccessHistoricalInvoice(oldIso)).toBe(false);
    expect(e.entitlement.canAccessHistoricalInvoice(newIso)).toBe(false); // now > 24h old too
    expect(await e.invoices.list()).toHaveLength(2); // nothing deleted

    // Subscribes again.
    e.adapter.setCustomerInfo(activeInfo('starter', e.clock.now));
    await e.service.refresh();
    expect(e.entitlement.canAccessHistoricalInvoice(oldIso)).toBe(true);
    expect(e.entitlement.canAccessHistoricalInvoice(newIso)).toBe(true);
  });

  it('does not reopen locked invoices when the device clock is set back', async () => {
    const created = START;
    const e = makeEntitlement([seedInvoice('a', created)]);
    e.clock.now = created + 3 * DAY;
    await e.service.refresh(); // records the later time as the high-water mark
    await e.service.loadCached();

    e.clock.now = created + HOUR; // clock rolled back
    expect(e.entitlement.canAccessHistoricalInvoice(new Date(created).toISOString())).toBe(false);
  });
});

describe('EntitlementService — customers and pricing methods', () => {
  it('restricts historical customers on Free, allows them on paid plans', async () => {
    const e = makeEntitlement();
    await e.service.loadCached();
    expect(e.entitlement.canAccessHistoricalCustomer()).toBe(false);

    e.adapter.setCustomerInfo(activeInfo('pro', e.clock.now));
    await e.service.refresh();
    expect(e.entitlement.canAccessHistoricalCustomer()).toBe(true);
  });

  it('keeps every pricing method available regardless of plan', async () => {
    const e = makeEntitlement();
    await e.service.loadCached();
    expect(e.entitlement.canUsePricingMethod('weight')).toBe(true);
    expect(e.entitlement.canUsePricingMethod('custom')).toBe(true);
  });
});
