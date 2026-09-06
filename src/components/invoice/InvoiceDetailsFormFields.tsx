import React from 'react';
import { Controller, type Control } from 'react-hook-form';

import { FormField } from '@/components/businessCard/FormField';
import type { InvoiceDetailsFormOutput, InvoiceDetailsFormValues } from '@/domain/invoice/validation';

type InvoiceDetailsFormControl = Control<InvoiceDetailsFormValues, unknown, InvoiceDetailsFormOutput>;

interface Props {
  control: InvoiceDetailsFormControl;
  errors: Record<string, { message?: string } | undefined>;
}

/** Issue date / due date / notes / terms — the Invoice Review step's own fields, shared by create/edit/duplicate. */
export function InvoiceDetailsFormFields({ control, errors }: Props) {
  return (
    <>
      <Field
        name="issueDate"
        label="Invoice date *"
        control={control}
        errors={errors}
        placeholder="YYYY-MM-DD"
      />
      <Field name="dueDate" label="Due date" control={control} errors={errors} placeholder="YYYY-MM-DD" />
      <Field name="notes" label="Notes" control={control} errors={errors} multiline />
      <Field name="terms" label="Terms" control={control} errors={errors} multiline />
    </>
  );
}

function Field({
  name,
  label,
  control,
  errors,
  ...inputProps
}: {
  name: keyof InvoiceDetailsFormValues;
  label: string;
  control: InvoiceDetailsFormControl;
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
          value={value ?? ''}
          onChangeText={onChange}
          onBlur={onBlur}
          error={errors[name]?.message}
          testID={`field-${name}`}
        />
      )}
    />
  );
}
