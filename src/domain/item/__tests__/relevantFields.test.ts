import { relevantOptionalFieldsForInvoiceType } from '../relevantFields';

describe('relevantOptionalFieldsForInvoiceType', () => {
  it('shows no physical fields for general/quantity', () => {
    expect(relevantOptionalFieldsForInvoiceType('general')).toEqual([]);
    expect(relevantOptionalFieldsForInvoiceType('quantity')).toEqual([]);
  });

  it('shows only weight for the weight type', () => {
    expect(relevantOptionalFieldsForInvoiceType('weight')).toEqual(['weight']);
  });

  it('shows only length/width/height for the dimension type', () => {
    expect(relevantOptionalFieldsForInvoiceType('dimension')).toEqual(['length', 'width', 'height']);
  });

  it('shows every physical field for custom when no selection is known yet', () => {
    expect(relevantOptionalFieldsForInvoiceType('custom')).toEqual([
      'weight',
      'length',
      'width',
      'height',
    ]);
  });

  it('narrows custom to the business-chosen field keys', () => {
    expect(relevantOptionalFieldsForInvoiceType('custom', ['itemName', 'weight', 'tax'])).toEqual([
      'weight',
    ]);
    expect(relevantOptionalFieldsForInvoiceType('custom', ['itemName', 'unitPrice'])).toEqual([]);
  });
});
