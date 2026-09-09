import React from 'react';
import { Controller, type Control } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';

import { FormField } from '@/components/businessCard/FormField';
import { colors } from '@/theme/colors';
import {
  NOTES_MAX_LENGTH,
  type CustomerFormOutput,
  type CustomerFormValues,
} from '@/domain/customer/validation';

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
      <Field
        name="website"
        label="Website"
        control={control}
        errors={errors}
        keyboardType="url"
        autoCapitalize="none"
      />
      <Field name="address" label="Address" control={control} errors={errors} multiline />
      <Controller
        control={control}
        name="notes"
        render={({ field: { value, onChange, onBlur } }) => {
          const text = typeof value === 'string' ? value : String(value ?? '');
          return (
            <>
              <FormField
                label="Notes"
                value={text}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.notes?.message}
                testID="field-notes"
                multiline
                numberOfLines={5}
                maxLength={NOTES_MAX_LENGTH}
                style={styles.notesInput}
              />
              <Text style={styles.notesCount}>
                {text.length}/{NOTES_MAX_LENGTH}
              </Text>
            </>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  notesInput: { minHeight: 96, textAlignVertical: 'top' },
  notesCount: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: -4 },
});

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
