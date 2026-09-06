import { ALL_FIELD_KEYS } from '../fieldCatalog';
import { customFieldSelectionFormSchema } from '../validation';

function formValues(checked: string[]) {
  const set = new Set(checked);
  return Object.fromEntries(ALL_FIELD_KEYS.map((key) => [key, set.has(key)]));
}

describe('customFieldSelectionFormSchema', () => {
  it('accepts a selection that includes the always-required fields and returns ordered keys', () => {
    const result = customFieldSelectionFormSchema.safeParse(
      formValues(['itemName', 'unitPrice', 'tax', 'sku']),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(['itemName', 'sku', 'unitPrice', 'tax']);
    }
  });

  it('normalizes item name back in even if the submission left it unchecked', () => {
    const result = customFieldSelectionFormSchema.safeParse(formValues(['unitPrice', 'tax']));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(['itemName', 'unitPrice', 'tax']);
    }
  });

  it('normalizes unit price back in even if the submission left it unchecked', () => {
    const result = customFieldSelectionFormSchema.safeParse(formValues(['itemName', 'tax']));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(['itemName', 'unitPrice', 'tax']);
    }
  });

  it('accepts every field checked', () => {
    const result = customFieldSelectionFormSchema.safeParse(formValues(ALL_FIELD_KEYS));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(ALL_FIELD_KEYS);
    }
  });
});
