import React from 'react';
import { Controller, type Control } from 'react-hook-form';

import { FormField } from '@/components/businessCard/FormField';
import type { InvoiceLineFormOutput, InvoiceLineFormValues } from '@/domain/invoice/validation';
import type { InvoiceFieldConfig } from '@/domain/invoiceType/types';

/** Matches the exact `useForm<InvoiceLineFormValues, unknown, InvoiceLineFormOutput>()` shape the screen uses. */
type InvoiceLineFormControl = Control<InvoiceLineFormValues, unknown, InvoiceLineFormOutput>;

interface Props {
  control: InvoiceLineFormControl;
  errors: Record<string, { message?: string } | undefined>;
  /** Which fields to render — resolved once by the screen from the invoice's type, per `MVP_BUILD_PLAN.md`'s "fields must dynamically follow the selected invoice type" rule. */
  fieldConfig: InvoiceFieldConfig;
}

/**
 * The line-item form shared by "add from catalog" fine-tuning and "add a
 * manual line" (both routed through `EditInvoiceLineScreen`) — one
 * implementation so the two entry points can never drift apart, mirroring
 * `ItemFormFields`. Item Name and Unit Price always render (every invoice
 * type includes them — see `fieldCatalog.ts`'s `alwaysIncluded`); every
 * other field only renders when `fieldConfig` includes it.
 */
export function InvoiceLineFormFields({ control, errors, fieldConfig }: Props) {
  const has = (key: string) => fieldConfig.fields.some((field) => field.key === key);

  return (
    <>
      <Field name="itemName" label="Item name *" control={control} errors={errors} />
      {has('description') && (
        <Field name="description" label="Description" control={control} errors={errors} multiline />
      )}
      {has('sku') && <Field name="sku" label="SKU" control={control} errors={errors} />}
      {has('quantity') && (
        <Field name="quantity" label="Quantity" control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('unit') && (
        <Field name="unit" label="Unit" control={control} errors={errors} placeholder="e.g. pcs, kg, hr" />
      )}
      {has('weight') && (
        <Field name="weight" label="Weight" control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('length') && (
        <Field name="length" label="Length" control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('width') && (
        <Field name="width" label="Width" control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('height') && (
        <Field name="height" label="Height" control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      <Field name="unitPrice" label="Unit price *" control={control} errors={errors} keyboardType="decimal-pad" />
      {has('discount') && (
        <Field
          name="discountPercent"
          label="Discount (%)"
          control={control}
          errors={errors}
          keyboardType="decimal-pad"
        />
      )}
      {has('tax') && (
        <Field name="taxPercent" label="Tax (%)" control={control} errors={errors} keyboardType="decimal-pad" />
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
