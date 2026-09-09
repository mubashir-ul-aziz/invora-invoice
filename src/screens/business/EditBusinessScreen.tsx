import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FormField } from '@/components/businessCard/FormField';
import { LogoPicker } from '@/components/businessCard/LogoPicker';
import {
  businessFormSchema,
  businessFormToCardInput,
  businessFormToProfileInput,
  businessToFormDefaults,
  type BusinessFormOutput,
  type BusinessFormValues,
} from '@/domain/business/combinedForm';
import { formatNextInvoiceNumber } from '@/domain/business/types';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { colors } from '@/theme/colors';

// Reached from both routes `RootNavigator` points at this component — see
// its doc comment on why there are two.
type Props = NativeStackScreenProps<RootStackParamList, 'EditBusiness' | 'EditBusinessCard'>;

/**
 * The single "Business" form: business info (Business Settings' view) and
 * Digital Business Card info (owner, social links) are two feature-shaped
 * slices of the same underlying `business` row (see
 * `domain/business/types.ts`), so they're edited here together and saved
 * with one Save action instead of two near-duplicate screens. Reached from
 * both the Business screen ("Business profile") and the Digital Card screen
 * ("Edit card") — see `RootNavigator`, which points both the `EditBusiness`
 * and `EditBusinessCard` routes at this same component.
 */
export function EditBusinessScreen({ navigation }: Props) {
  // Neither store is loaded here — same convention the two screens this
  // form replaces followed: `BusinessScreen` and `DigitalCardScreen` (the
  // only two entry points into this screen) each load *both* stores on
  // mount, so by the time a user reaches this form both are already
  // populated. Loading them again from here as well would race their
  // promises against this screen's own mount/unmount in tests (and, in the
  // app, needlessly re-fetch data the hub screen the user just came from
  // already has).
  const profileStore = useBusinessProfileStore();
  const cardStore = useBusinessCardStore();
  const bothLoaded = profileStore.status === 'ready' && cardStore.status === 'ready';

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BusinessFormValues, unknown, BusinessFormOutput>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: businessToFormDefaults(profileStore.profile, cardStore.card),
  });

  // Re-seed the form once both slices finish loading (defaultValues above
  // only apply on first mount).
  useEffect(() => {
    if (bothLoaded) {
      reset(businessToFormDefaults(profileStore.profile, cardStore.card));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothLoaded]);

  const isSaving = isSubmitting || profileStore.status === 'saving' || cardStore.status === 'saving';

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Sequential, not Promise.all: both writes target the same row, and
      // the first save is what creates it when this is a brand-new
      // business — a concurrent insert from the second save would race it.
      await profileStore.save(businessFormToProfileInput(values));
      await cardStore.save(businessFormToCardInput(values));
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
      <Field name="ownerName" label="Owner / contact name" control={control} errors={errors} />
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
      {/*
        Read-only, not an editable input: the invoice sequence is reserved
        and advanced exclusively by `BusinessRepository.reserveNextInvoiceNumber()`
        at invoice-creation time (see `domain/business/types.ts`'s doc
        comment on `formatNextInvoiceNumber`) — nothing in the app is allowed
        to change it by hand, so this field is shown for visibility only.
      */}
      <Text style={styles.readOnlyLabel}>Next invoice number</Text>
      <Text style={styles.readOnlyValue} testID="field-nextInvoiceNumber">
        {formatNextInvoiceNumber(
          profileStore.profile?.invoicePrefix ?? 'INV-',
          profileStore.profile?.businessCode ?? '',
          profileStore.profile?.nextInvoiceNumber ?? 1,
        )}
      </Text>

      <Text style={styles.sectionTitle}>Social & sharing</Text>
      <Text style={styles.sectionHint}>
        Shown on the back of your digital business card, along with a QR code.
      </Text>
      <Field
        name="whatsapp"
        label="WhatsApp number"
        control={control}
        errors={errors}
        keyboardType="phone-pad"
      />
      <Field
        name="facebook"
        label="Facebook page URL"
        control={control}
        errors={errors}
        autoCapitalize="none"
      />
      <Field
        name="instagram"
        label="Instagram profile URL"
        control={control}
        errors={errors}
        autoCapitalize="none"
      />
      <Field
        name="googleMapsUrl"
        label="Google Maps link (optional)"
        control={control}
        errors={errors}
        autoCapitalize="none"
      />

      <ActionButton
        label={isSaving ? 'Saving…' : 'Save'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSaving}
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
  name: keyof BusinessFormValues;
  label: string;
  control: ReturnType<typeof useForm<BusinessFormValues>>['control'];
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
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 8 },
  sectionHint: { fontSize: 12, color: colors.textMuted, marginTop: -8 },
  readOnlyLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: -10 },
  readOnlyValue: { fontSize: 15, color: colors.textMuted },
});
