import { customerMatchesFilter, sortCustomers } from '../filtering';
import { EMPTY_CUSTOMER_FILTER, type Customer } from '../types';

function makeCustomer(overrides: Partial<Customer>): Customer {
  return {
    id: 'c1',
    name: 'Acme Co',
    phone: null,
    email: null,
    address: null,
    notes: null,
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

describe('customerMatchesFilter', () => {
  it('matches everything when the search text is empty', () => {
    const customer = makeCustomer({});
    expect(customerMatchesFilter(customer, EMPTY_CUSTOMER_FILTER)).toBe(true);
  });

  it('matches on name, case-insensitively', () => {
    const customer = makeCustomer({ name: 'Acme Corporation' });
    expect(customerMatchesFilter(customer, { searchText: 'acme' })).toBe(true);
    expect(customerMatchesFilter(customer, { searchText: 'ACME' })).toBe(true);
    expect(customerMatchesFilter(customer, { searchText: 'globex' })).toBe(false);
  });

  it('matches on phone', () => {
    const customer = makeCustomer({ phone: '+15551234567' });
    expect(customerMatchesFilter(customer, { searchText: '5551234567' })).toBe(true);
  });

  it('matches on email', () => {
    const customer = makeCustomer({ email: 'ap@acme.test' });
    expect(customerMatchesFilter(customer, { searchText: 'acme.test' })).toBe(true);
  });

  it('is null-safe when phone/email are not set', () => {
    const customer = makeCustomer({ phone: null, email: null });
    expect(customerMatchesFilter(customer, { searchText: 'anything' })).toBe(false);
  });
});

describe('sortCustomers', () => {
  it('sorts alphabetically by name without mutating the input', () => {
    const input = [makeCustomer({ id: 'b', name: 'Zebra Inc' }), makeCustomer({ id: 'a', name: 'Acme Co' })];
    const sorted = sortCustomers(input);

    expect(sorted.map((c) => c.name)).toEqual(['Acme Co', 'Zebra Inc']);
    expect(input.map((c) => c.name)).toEqual(['Zebra Inc', 'Acme Co']);
  });
});
