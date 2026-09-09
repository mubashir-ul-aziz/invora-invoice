import type { CustomerFormOutput } from './validation';
import { EMPTY_CUSTOMER_INPUT, type Customer, type CustomerInput } from './types';

/** Customer (or nothing, for "creating new") -> flat string-based form default values. */
export function customerToFormDefaults(customer: Customer | null) {
  const input = customer ?? EMPTY_CUSTOMER_INPUT;
  return {
    name: input.name,
    phone: input.phone ?? '',
    email: input.email ?? '',
    website: input.website ?? '',
    address: input.address ?? '',
    notes: input.notes ?? '',
  };
}

/** Validated flat form output -> the shape the repository expects. */
export function formValuesToCustomerInput(values: CustomerFormOutput): CustomerInput {
  return {
    name: values.name,
    phone: values.phone,
    email: values.email,
    website: values.website,
    address: values.address,
    notes: values.notes,
  };
}
