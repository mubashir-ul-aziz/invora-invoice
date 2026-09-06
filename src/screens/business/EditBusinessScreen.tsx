import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FormField } from '@/components/businessCard/FormField';
import { LogoPicker } from '@/components/businessCard/LogoPicker';
import { profileToFormDefaults, formValuesToProfileInput } from '@/domain/business/formMapping';
import {
  businessProfileFormSchema,
  type BusinessProfileFormOutput,
  type BusinessProfileFormValues,
} from '@/domain/business/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditBusiness'>;

export function EditBusinessScreen({ navigation }: Props) {
  const { profile, status, save } = useBusinessProfileStore();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BusinessProfileFormValues, unknown, BusinessProfileFormOutput>({
    resolver: zodResolver(businessProfileFormSchema),
    defaultValues: profileToFormDefaults(profile),
  });

  // Re-seed the form once the profile finishes loading (defaultValues above only
  // apply on first mount).
  useEffect(() => {
    if (status === 'ready') {
      reset(profileToFormDefaults(profile));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save(formValuesToProfileInput(values));
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save", 'Your changes could not be saved. Please try again.');
    }
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="edit-business-screen"
    >
      <Controller
        control={control}
        name="logoUri"
        render={({ field: { value, onChange } }) => (
          <LogoPicker logoUri={value || null} onChange={(uri) => onChange(uri ?? '')} />
        )}
      />

      <Field name="businessName" label="Business name *" control={control} errors={errors} />
      <Field
        name="phone"
        label="Phone"
        control={control}
        errors={errors}
        keyboardType="phone-pad"
      />
      <Field
        name="email"
        label="Email"
        control={control}
        errors={errors}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        name="website"
        label="Website"
        control={control}
        errors={errors}
        autoCapitalize="none"
        keyboardType="url"
      />
      <Field name="address" label="Address" control={control} errors={errors} multiline />
      <Field
        name="currency"
        label="Currency (3-letter code)"
        control={control}
        errors={errors}
        autoCapitalize="characters"
        maxLength={3}
      />
      <Field name="taxId" label="Tax / VAT number" control={control} errors={errors} />
      <Field name="invoicePrefix" label="Invoice prefix" control={control} errors={errors} />
      <Field
        name="nextInvoiceNumber"
        label="Next invoice number"
        control={control}
        errors={errors}
        keyboardType="numeric"
      />

      <ActionButton
        label={isSubmitting || status === 'saving' ? 'Saving…' : 'Save'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting || status === 'saving'}
        testID="save-business"
      />
    </ScrollView>
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
  name: keyof BusinessProfileFormValues;
  label: string;
  control: ReturnType<typeof useForm<BusinessProfileFormValues>>['control'];
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
});
