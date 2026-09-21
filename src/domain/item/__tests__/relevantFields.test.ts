import { relevantOptionalFieldsForInvoiceType } from '../relevantFields';

describe('relevantOptionalFieldsForInvoiceType', () => {
  it('shows only the generic unit field for general/quantity/service', () => {
    expect(relevantOptionalFieldsForInvoiceType('general')).toEqual(['unit']);
    expect(relevantOptionalFieldsForInvoiceType('quantity')).toEqual(['unit']);
    expect(relevantOptionalFieldsForInvoiceType('service')).toEqual(['unit']);
  });

  it('shows weight + weightUnit for the weight method', () => {
    expect(relevantOptionalFieldsForInvoiceType('weight')).toEqual(['weight', 'weightUnit']);
  });

  it('shows length + lengthUnit for the length method', () => {
    expect(relevantOptionalFieldsForInvoiceType('length')).toEqual(['length', 'lengthUnit']);
  });

  it('shows length/width + lengthUnit for the area method', () => {
    expect(relevantOptionalFieldsForInvoiceType('area')).toEqual(['length', 'width', 'lengthUnit']);
  });

  it('shows length/width/height + lengthUnit for the volume method', () => {
    expect(relevantOptionalFieldsForInvoiceType('volume')).toEqual([
      'length',
      'width',
      'height',
      'lengthUnit',
    ]);
  });

  it('shows timeUnit for the time method', () => {
    expect(relevantOptionalFieldsForInvoiceType('time')).toEqual(['timeUnit']);
  });

  it('shows every physical field for custom when no selection is known yet', () => {
    expect(relevantOptionalFieldsForInvoiceType('custom')).toEqual([
      'unit',
      'weight',
      'weightUnit',
      'length',
      'width',
      'height',
      'lengthUnit',
      'timeUnit',
    ]);
  });

  it('narrows custom to the business-chosen field keys', () => {
    expect(relevantOptionalFieldsForInvoiceType('custom', ['itemName', 'weight', 'tax'])).toEqual([
      'weight',
    ]);
    expect(relevantOptionalFieldsForInvoiceType('custom', ['itemName', 'unitPrice'])).toEqual([]);
    expect(relevantOptionalFieldsForInvoiceType('custom', ['itemName', 'unit', 'tax'])).toEqual([
      'unit',
    ]);
  });
});
