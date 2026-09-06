import { itemFormSchema } from '../validation';
import { itemToFormDefaults } from '../formMapping';

const validValues = () => ({
  name: 'Steel Pipe',
  description: '',
  sku: '',
  unit: '',
  defaultPrice: '10',
  taxRate: '',
  weight: '',
  length: '',
  width: '',
  height: '',
  invoiceTypeId: 'general' as const,
});

describe('itemFormSchema', () => {
  it('accepts a minimal valid item (name + price only)', () => {
    const result = itemFormSchema.safeParse(validValues());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultPrice).toBe(10);
      expect(result.data.taxRate).toBeNull();
    }
  });

  it('rejects an empty item name', () => {
    const result = itemFormSchema.safeParse({ ...validValues(), name: '  ' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric default price', () => {
    const result = itemFormSchema.safeParse({ ...validValues(), defaultPrice: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects a tax rate above 100', () => {
    const result = itemFormSchema.safeParse({ ...validValues(), taxRate: '150' });
    expect(result.success).toBe(false);
  });

  it('accepts and coerces optional decimal fields (weight/length/width/height)', () => {
    const result = itemFormSchema.safeParse({
      ...validValues(),
      invoiceTypeId: 'dimension',
      length: '10.5',
      width: '5',
      height: '2',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(10.5);
      expect(result.data.width).toBe(5);
      expect(result.data.height).toBe(2);
    }
  });

  it('rejects a non-numeric weight', () => {
    const result = itemFormSchema.safeParse({ ...validValues(), weight: 'heavy' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown invoice type id', () => {
    const result = itemFormSchema.safeParse({ ...validValues(), invoiceTypeId: 'nope' });
    expect(result.success).toBe(false);
  });

  it('trims and nullifies blank optional text fields', () => {
    const result = itemFormSchema.safeParse({ ...validValues(), sku: '  ', description: '  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sku).toBeNull();
      expect(result.data.description).toBeNull();
    }
  });
});

describe('itemToFormDefaults', () => {
  it('defaults to the empty-item shape when no item exists yet', () => {
    expect(itemToFormDefaults(null)).toEqual({ ...validValues(), name: '', defaultPrice: '0' });
  });
});
