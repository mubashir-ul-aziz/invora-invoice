import { customerToFormDefaults, formValuesToCustomerInput } from '../formMapping';
import type { Customer } from '../types';

describe('customer formMapping', () => {
  it('defaults to empty strings for a new customer', () => {
    expect(customerToFormDefaults(null)).toEqual({
      name: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      notes: '',
    });
  });

  it('round-trips an existing customer through the form and back', () => {
    const customer: Customer = {
      id: 'c1',
      name: 'Acme Co',
      phone: '+15551234567',
      email: 'ap@acme.test',
      website: 'https://acme.test',
      address: '1 Main St',
      notes: 'Net 30',
      createdAt: 'now',
      updatedAt: 'now',
    };

    const defaults = customerToFormDefaults(customer);
    expect(defaults).toEqual({
      name: 'Acme Co',
      phone: '+15551234567',
      email: 'ap@acme.test',
      website: 'https://acme.test',
      address: '1 Main St',
      notes: 'Net 30',
    });

    const input = formValuesToCustomerInput({
      name: 'Acme Co',
      phone: '+15551234567',
      email: 'ap@acme.test',
      website: 'https://acme.test',
      address: '1 Main St',
      notes: 'Net 30',
    });
    expect(input).toEqual({
      name: 'Acme Co',
      phone: '+15551234567',
      email: 'ap@acme.test',
      website: 'https://acme.test',
      address: '1 Main St',
      notes: 'Net 30',
    });
  });

  it('omits unset optional fields as null', () => {
    const input = formValuesToCustomerInput({
      name: 'Acme Co',
      phone: null,
      email: null,
      website: null,
      address: null,
      notes: null,
    });
    expect(input).toEqual({
      name: 'Acme Co',
      phone: null,
      email: null,
      website: null,
      address: null,
      notes: null,
    });
  });
});
