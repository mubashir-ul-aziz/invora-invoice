import React from 'react';
import { Controller, type Control } from 'react-hook-form';

import { OptionPicker } from '@/components/business/OptionPicker';
import { FormField } from '@/components/businessCard/FormField';
import { DateField } from '@/components/shared/DateField';
import { PAYMENT_METHOD_OPTIONS } from '@/domain/payment/types';
import type { PaymentFormOutput, PaymentFormValues } from '@/domain/payment/validation';

/** Matches the exact `useForm<PaymentFormValues, unknown, PaymentFormOutput>()` shape both screens use. */
type PaymentFormControl = Control<PaymentFormValues, unknown, PaymentFormOutput>;

interface Props {
  control: PaymentFormControl;
  errors: Record<string, { message?: string } | undefined>;
}

/**
 * The field set shared by Record Payment and Edit Payment — one
 * implementation so the two screens can never drift apart. Same pattern as
 * `components/customer/CustomerFormFields.tsx`. `invoiceId` is deliberately
 * not a field here — it's fixed by the screen's route param, never
 * user-editable (see the doc comment on `PaymentUpdateInput`).
 */
export function PaymentFormFields({ control, errors }: Props) {
  return (
    <>
      <Field
        name="amount"
        label="Amount *"
        control={control}
        errors={errors}
        keyboardType="decimal-pad"
      />
      <Controller
        control={control}
        name="paymentDate"
        render={({ field: { value, onChange, onBlur } }) => (
          <DateField
            label="Payment date *"
            value={typeof value === 'string' ? value : ''}
            onChange={onChange}
            onBlur={onBlur}
            error={errors.paymentDate?.message}
            testID="field-paymentDate"
          />
        )}
      />

      <Controller
        control={control}
        name="method"
        render={({ field: { value, onChange } }) => (
          <OptionPicker
            label="Payment method"
            options={PAYMENT_METHOD_OPTIONS}
            value={value}
            onChange={onChange}
            testID="field-method"
          />
        )}
      />

      <Field name="reference" label="Reference" control={control} errors={errors} />
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
  name: keyof PaymentFormValues;
  label: string;
  control: PaymentFormControl;
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
