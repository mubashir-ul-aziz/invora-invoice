import { countBackupTables } from '../types';
import { emptyBackupTables, tablesWith } from '../testFixtures';

describe('countBackupTables', () => {
  it('counts every table, including empty ones (backup with no data)', () => {
    expect(countBackupTables(emptyBackupTables())).toEqual({
      business: 0,
      socialLinks: 0,
      items: 0,
      customers: 0,
      invoices: 0,
      invoiceItems: 0,
      payments: 0,
      appSettings: 0,
    });
  });

  it('counts a mix of populated and empty tables', () => {
    const tables = tablesWith({
      business: [{ id: 'default' }],
      items: [{ id: 'i1' }, { id: 'i2' }],
      customers: [{ id: 'c1' }],
      appSettings: [{ id: 'default' }],
    });
    expect(countBackupTables(tables)).toEqual({
      business: 1,
      socialLinks: 0,
      items: 2,
      customers: 1,
      invoices: 0,
      invoiceItems: 0,
      payments: 0,
      appSettings: 1,
    });
  });
});
