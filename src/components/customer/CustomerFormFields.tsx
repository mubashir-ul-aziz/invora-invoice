import React from 'react';
import { Controller, type Control } from 'react-hook-form';

import { FormField } from '@/components/businessCard/FormField';
import type { CustomerFormOutput, CustomerFormValues } from '@/domain/customer/validation';

/** Matches the exact `useForm<CustomerFormValues, unknown, CustomerFormOutput>()` shape both screens use. */
type CustomerFormControl = Control<CustomerFormValues, unknown, CustomerFormOutput>;

interface Props {
  control: CustomerFormControl;
  errors: Record<string, { message?: string } | undefined>;
}

/**
 * The field set shared by Create Customer and Edit Customer — one
 * implementation so the two screens can never drift apart. Same pattern as
 * `components/item/ItemFormFields.tsx`.
 */
export function CustomerFormFields({ control, errors }: Props) {
  return (
    <>
      <Field name="name" label="Name *" control={control} errors={errors} />
      <Field name="phone" label="Phone" control={control} errors={errors} keyboardType="phone-pad" />
      <Field name="email" label="Email" control={control} errors={errors} keyboardType="email-address" />
      <Field name="address" label="Address" control={control} errors={errors} multiline />
      <Field name="notes" label="Notes" control={control} errors={errors} multiline />
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
  name: keyof CustomerFormValues;
  label: string;
  control: CustomerFormControl;
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
