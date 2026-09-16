import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FormField } from '@/components/businessCard/FormField';
import { LogoPicker } from '@/components/businessCard/LogoPicker';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
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
 *
 * Restyled to match the Stitch "Business Details" design's card sections —
 * Brand Identity & Logo, Business Details, Financial & Tax, Social Links &
 * Maps — with every existing field/testID unchanged. The Stitch mock's
 * "Industry / Tagline" field has no backing column anywhere in
 * `BusinessProfile`/`BusinessCard`, so it's DESIGN ONLY (local state, never
 * submitted); its phone field's "🇬🇧 +44" country-code prefix is likewise
 * decorative — this app stores whatever the user types verbatim, same
 * DESIGN ONLY treatment as Create/Edit Customer's phone field.
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

  // DESIGN ONLY: no backing field exists on `BusinessProfile`/`BusinessCard`.
  const [tagline, setTagline] = useState('');

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
    <KeyboardAvoidingScreen
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="edit-business-screen"
    >
      {/* Brand Identity & Logo */}
      <View style={styles.card}>
        <Controller
          control={control}
          name="logoUri"
          render={({ field: { value, onChange } }) => (
            <LogoPicker logoUri={value || null} onChange={(uri) => onChange(uri ?? '')} />
          )}
        />
      </View>

      {/* Business Details */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="briefcase" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Business Details</Text>
        </View>
        <Field name="businessName" label="Business Name *" control={control} errors={errors} />
        {/* DESIGN ONLY: no industry/tagline field exists on `BusinessProfile`/`BusinessCard`. */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Industry / Tagline · DESIGN ONLY</Text>
          <FormField
            label=""
            value={tagline}
            onChangeText={setTagline}
            placeholder="e.g. Architectural Design & Contracting"
            testID="field-tagline-design-only"
          />
        </View>
        <Field name="ownerName" label="Owner / Contact Name" control={control} errors={errors} />
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone</Text>
          <View style={styles.phoneRow}>
            {/* DESIGN ONLY: no country-code field exists — the number is saved exactly as typed. */}
            <View style={styles.countryBadge} accessibilityLabel="Country code — DESIGN ONLY, not stored">
              <Text style={styles.countryBadgeText}>DESIGN ONLY</Text>
            </View>
            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange, onBlur } }) => (
                <FormField
                  value={typeof value === 'string' ? value : ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="phone-pad"
                  error={errors.phone?.message}
                  testID="field-phone"
                  style={styles.phoneInput}
                  label=""
                />
              )}
            />
          </View>
        </View>
        <Field
          name="email"
          label="Email Address"
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
        <Field name="address" label="Business Address" control={control} errors={errors} multiline />
      </View>

      {/* Financial & Tax */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="credit-card" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Financial &amp; Tax</Text>
        </View>
        <Field
          name="currency"
          label="Base Currency (3-letter code)"
          control={control}
          errors={errors}
          autoCapitalize="characters"
          maxLength={3}
        />
        <Field name="taxId" label="Tax / VAT Number" control={control} errors={errors} />
        <Field name="invoicePrefix" label="Invoice Prefix" control={control} errors={errors} />
        {/*
          Read-only, not an editable input: the invoice sequence is reserved
          and advanced exclusively by `BusinessRepository.reserveNextInvoiceNumber()`
          at invoice-creation time (see `domain/business/types.ts`'s doc
          comment on `formatNextInvoiceNumber`) — nothing in the app is allowed
          to change it by hand, so this field is shown for visibility only.
        */}
        <View style={styles.readOnlyRow}>
          <Text style={styles.readOnlyLabel}>Next invoice number</Text>
          <Text style={styles.readOnlyValue} testID="field-nextInvoiceNumber">
            {formatNextInvoiceNumber(
              profileStore.profile?.invoicePrefix ?? 'INV-',
              profileStore.profile?.businessCode ?? '',
              profileStore.profile?.nextInvoiceNumber ?? 1,
            )}
          </Text>
        </View>
      </View>

      {/* Social Links & Maps */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="share-2" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Social Links &amp; Maps</Text>
        </View>
        <Text style={styles.sectionHint}>
          Shown on the back of your digital business card, along with a QR code.
        </Text>
        <Field
          name="whatsapp"
          label="WhatsApp Business"
          control={control}
          errors={errors}
          keyboardType="phone-pad"
          placeholder="+44 ..."
        />
        <Field
          name="facebook"
          label="Facebook Page"
          control={control}
          errors={errors}
          autoCapitalize="none"
          placeholder="facebook.com/page"
        />
        <Field
          name="instagram"
          label="Instagram Handle"
          control={control}
          errors={errors}
          autoCapitalize="none"
          placeholder="@username"
        />
        <Field
          name="googleMapsUrl"
          label="Google Maps Location"
          control={control}
          errors={errors}
          autoCapitalize="none"
          placeholder="maps.google.com/..."
        />
      </View>

      <ActionButton
        label={isSaving ? 'Saving…' : 'Save Changes'}
        variant="primary"
        icon="check"
        onPress={onSubmit}
        disabled={isSaving}
        testID="save-business"
      />
    </KeyboardAvoidingScreen>
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

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },

  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },

  phoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  countryBadge: {
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  phoneInput: { flex: 1 },

  sectionHint: { fontSize: 12, color: colors.textMuted, marginTop: -6 },

  readOnlyRow: { gap: 2 },
  readOnlyLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  readOnlyValue: { fontSize: 15, color: colors.textMuted },
});
