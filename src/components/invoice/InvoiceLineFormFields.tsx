import React from 'react';
import { Controller, type Control } from 'react-hook-form';

import { OptionPicker } from '@/components/business/OptionPicker';
import { FormField } from '@/components/businessCard/FormField';
import type { InvoiceLineFormOutput, InvoiceLineFormValues } from '@/domain/invoice/validation';
import { getFieldDefinition } from '@/domain/invoiceType/fieldCatalog';
import { getFieldLabel, type InvoiceFieldConfig } from '@/domain/invoiceType/types';

/** Matches the exact `useForm<InvoiceLineFormValues, unknown, InvoiceLineFormOutput>()` shape the screen uses. */
type InvoiceLineFormControl = Control<InvoiceLineFormValues, unknown, InvoiceLineFormOutput>;

interface Props {
  control: InvoiceLineFormControl;
  errors: Record<string, { message?: string } | undefined>;
  /** Which fields to render, and which pricing method they belong to (for method-specific labels/units) — resolved once by the screen from the invoice's Pricing Method. */
  fieldConfig: InvoiceFieldConfig;
}

/**
 * The line-item form shared by "add from catalog" fine-tuning and "add a
 * manual line" (both routed through `EditInvoiceLineScreen`) — one
 * implementation so the two entry points can never drift apart, mirroring
 * `ItemFormFields`. This is the app's one reusable `InvoiceLineEditor`: it
 * never hard-codes a field list per pricing method, only walks whatever
 * `fieldConfig` resolved (`resolveInvoiceFieldConfig`). Item Name and Unit
 * Price always render (every pricing method includes them — see
 * `fieldCatalog.ts`'s `alwaysIncluded`); every other field only renders when
 * `fieldConfig` includes it, with its label resolved per-method (e.g. TIME's
 * "Duration" instead of the generic "Quantity").
 */
export function InvoiceLineFormFields({ control, errors, fieldConfig }: Props) {
  const has = (key: string) => fieldConfig.fields.some((field) => field.key === key);
  const label = (key: Parameters<typeof getFieldLabel>[1]) => getFieldLabel(fieldConfig.invoiceTypeId, key);

  return (
    <>
      <Field name="itemName" label={`${label('itemName')} *`} control={control} errors={errors} />
      {has('description') && (
        <Field name="description" label={label('description')} control={control} errors={errors} multiline />
      )}
      {has('sku') && <Field name="sku" label={label('sku')} control={control} errors={errors} />}
      {has('quantity') && (
        <Field name="quantity" label={`${label('quantity')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('unit') && (
        <Field name="unit" label={label('unit')} control={control} errors={errors} placeholder="e.g. pcs, box, hr" />
      )}
      {has('weight') && (
        <Field name="weight" label={`${label('weight')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('weightUnit') && <SelectField name="weightUnit" fieldKey="weightUnit" control={control} />}
      {has('length') && (
        <Field name="length" label={`${label('length')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('width') && (
        <Field name="width" label={`${label('width')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('height') && (
        <Field name="height" label={`${label('height')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('lengthUnit') && <SelectField name="lengthUnit" fieldKey="lengthUnit" control={control} />}
      {has('timeUnit') && <SelectField name="timeUnit" fieldKey="timeUnit" control={control} />}
      <Field name="unitPrice" label={`${label('unitPrice')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
      {has('discount') && (
        <Field
          name="discountPercent"
          label={`${label('discount')} (%)`}
          control={control}
          errors={errors}
          keyboardType="decimal-pad"
        />
      )}
      {has('tax') && (
        <Field name="taxPercent" label={`${label('tax')} (%)`} control={control} errors={errors} keyboardType="decimal-pad" />
      )}
    </>
  );
}

/** Local helper to cut down on per-field Controller boilerplate above. */
function Field({
  name,
  label,
  control,
  errors,
  ...inputProps
}: {
  name: keyof InvoiceLineFormValues;
  label: string;
  control: InvoiceLineFormControl;
  errors: Record<string, { message?: string } | undefined>;
} & React.ComponentProps<typeof FormField>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <FormField
          {...inputProps}
          label={label}
          value={typeof value === 'string' ? value : String(value ?? '')}
          onChangeText={onChange}
          onBlur={onBlur}
          error={errors[name]?.message}
          testID={`field-${name}`}
        />
      )}
    />
  );
}

/** A unit dropdown (weight/dimension/time) — its fixed choices come straight from the field catalog's `options`. */
function SelectField({
  name,
  fieldKey,
  control,
}: {
  name: keyof InvoiceLineFormValues;
  fieldKey: 'weightUnit' | 'lengthUnit' | 'timeUnit';
  control: InvoiceLineFormControl;
}) {
  const definition = getFieldDefinition(fieldKey);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => (
        <OptionPicker
          label={definition.label}
          options={definition.options ?? []}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          testID={`field-${name}`}
        />
      )}
    />
  );
}
