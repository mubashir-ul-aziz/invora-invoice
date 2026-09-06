import React, { useEffect } from 'react';
import { Controller, useWatch, type Control } from 'react-hook-form';

import { OptionPicker } from '@/components/business/OptionPicker';
import { FormField } from '@/components/businessCard/FormField';
import { INVOICE_TYPE_REGISTRY } from '@/domain/invoiceType/invoiceTypeRegistry';
import { relevantOptionalFieldsForInvoiceType } from '@/domain/item/relevantFields';
import type { ItemFormOutput, ItemFormValues } from '@/domain/item/validation';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';

const INVOICE_TYPE_FORM_OPTIONS = INVOICE_TYPE_REGISTRY.map((def) => ({
  value: def.id,
  label: def.label,
}));

/** Matches the exact `useForm<ItemFormValues, unknown, ItemFormOutput>()` shape both screens use. */
type ItemFormControl = Control<ItemFormValues, unknown, ItemFormOutput>;

interface Props {
  control: ItemFormControl;
  errors: Record<string, { message?: string } | undefined>;
}

/**
 * The field set shared by Create Item and Edit Item — one implementation so
 * the two screens can never drift apart. Which of Weight/Length/Width/Height
 * are shown is driven by the selected "Invoice type / domain" (reusing the
 * Phase 3 field registry via `relevantOptionalFieldsForInvoiceType`), and for
 * "Custom" additionally by the business's own Phase 3 field selection.
 */
export function ItemFormFields({ control, errors }: Props) {
  const invoiceTypeId = useWatch({ control, name: 'invoiceTypeId' });
  const { selection, load: loadInvoiceType } = useInvoiceTypeStore();

  useEffect(() => {
    loadInvoiceType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const relevantFields = relevantOptionalFieldsForInvoiceType(
    invoiceTypeId,
    invoiceTypeId === 'custom' ? selection?.customFieldKeys : undefined,
  );

  return (
    <>
      <Field name="name" label="Item name *" control={control} errors={errors} />
      <Field name="description" label="Description" control={control} errors={errors} multiline />
      <Field name="sku" label="SKU / item code" control={control} errors={errors} />
      <Field
        name="unit"
        label="Unit"
        control={control}
        errors={errors}
        placeholder="e.g. pcs, kg, hr"
      />
      <Field
        name="defaultPrice"
        label="Default price *"
        control={control}
        errors={errors}
        keyboardType="decimal-pad"
      />
      <Field
        name="taxRate"
        label="Tax (%)"
        control={control}
        errors={errors}
        keyboardType="decimal-pad"
      />

      <Controller
        control={control}
        name="invoiceTypeId"
        render={({ field: { value, onChange } }) => (
          <OptionPicker
            label="Invoice type / domain"
            options={INVOICE_TYPE_FORM_OPTIONS}
            value={value}
            onChange={onChange}
            testID="field-invoiceTypeId"
          />
        )}
      />

      {relevantFields.includes('weight') && (
        <Field name="weight" label="Weight" control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {relevantFields.includes('length') && (
        <Field name="length" label="Length" control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {relevantFields.includes('width') && (
        <Field name="width" label="Width" control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {relevantFields.includes('height') && (
        <Field name="height" label="Height" control={control} errors={errors} keyboardType="decimal-pad" />
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
  name: keyof ItemFormValues;
  label: string;
  control: ItemFormControl;
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
