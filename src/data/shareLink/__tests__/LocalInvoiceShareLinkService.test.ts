jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `invora://${path}`),
}));

import * as Linking from 'expo-linking';

import type { Invoice } from '@/domain/invoice/types';

import { LocalInvoiceShareLinkService } from '../LocalInvoiceShareLinkService';

const invoice: Invoice = {
  id: 'inv_1',
  invoiceNumber: 'INV-1',
  customerId: 'cust_1',
  customerName: 'Acme Co',
  invoiceTypeId: 'general',
  issueDate: '2026-01-01',
  dueDate: null,
  notes: null,
  terms: null,
  items: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('LocalInvoiceShareLinkService', () => {
  it('builds a share link from the invoice id via expo-linking, without any network call', () => {
    const service = new LocalInvoiceShareLinkService();
    const link = service.getShareLink(invoice);
    expect(link).toBe('invora://invoice/inv_1');
    expect(Linking.createURL).toHaveBeenCalledWith('invoice/inv_1');
  });

  it('never hard-codes a production https URL', () => {
    const service = new LocalInvoiceShareLinkService();
    const link = service.getShareLink(invoice);
    expect(link).not.toMatch(/^https?:\/\//);
  });
});
