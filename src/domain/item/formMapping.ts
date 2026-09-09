import type { ItemFormOutput } from './validation';
import { EMPTY_ITEM_INPUT, type Item, type ItemInput } from './types';

/** Item (or nothing, for "creating new") -> flat string-based form default values. */
export function itemToFormDefaults(item: Item | null) {
  const input = item ?? EMPTY_ITEM_INPUT;
  return {
    name: input.name,
    description: input.description ?? '',
    sku: input.sku ?? '',
    unit: input.unit ?? '',
    defaultPrice: String(input.defaultPrice ?? 0),
    taxRate: input.taxRate != null ? String(input.taxRate) : '',
    weight: input.weight != null ? String(input.weight) : '',
    weightUnit: input.weightUnit ?? '',
    length: input.length != null ? String(input.length) : '',
    width: input.width != null ? String(input.width) : '',
    height: input.height != null ? String(input.height) : '',
    lengthUnit: input.lengthUnit ?? '',
    invoiceTypeId: input.invoiceTypeId,
  };
}

/** Validated flat form output -> the shape the repository expects. */
export function formValuesToItemInput(values: ItemFormOutput): ItemInput {
  return {
    name: values.name,
    description: values.description,
    sku: values.sku,
    unit: values.unit,
    defaultPrice: values.defaultPrice,
    taxRate: values.taxRate,
    weight: values.weight,
    weightUnit: values.weightUnit,
    length: values.length,
    width: values.width,
    height: values.height,
    lengthUnit: values.lengthUnit,
    invoiceTypeId: values.invoiceTypeId,
  };
}
