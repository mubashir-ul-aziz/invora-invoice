import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { OptionPicker } from '@/components/business/OptionPicker';
import { FormField } from '@/components/businessCard/FormField';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { customerToFormDefaults, formValuesToCustomerInput } from '@/domain/customer/formMapping';
import {
  NOTES_MAX_LENGTH,
  customerFormSchema,
  type CustomerFormOutput,
  type CustomerFormValues,
} from '@/domain/customer/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerStore } from '@/state/customerStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCustomer'>;

/** Matches the Stitch "Billing Address" country dropdown's fixed option list. */
const COUNTRY_OPTIONS = [
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States', label: 'United States' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Germany', label: 'Germany' },
  { value: 'France', label: 'France' },
];

/**
 * Create Customer screen, restyled to match the Stitch "Create Customer"
 * design: a Basic Information card, a structured Billing Address card, and a
 * Terms & Customer Notes card, ending in a sticky Cancel/Save Customer dock.
 *
 * `Customer` (`domain/customer/types.ts`) only has one freeform `address`
 * string — there are no separate street/city/postcode/state/country columns.
 * Rather than fake structured storage, the four address text inputs plus the
 * country picker are combined into that single existing `address` field on
 * submit (see `composeAddress` below), so the data still saves for real, just
 * through a friendlier entry form.
 *
 * Three Stitch elements have no backing field at all and are marked DESIGN
 * ONLY (rendered, interactive where harmless, but never submitted):
 * - The phone field's country-code badge (no `countryCode`/dial-code column;
 *   the phone number the user types is saved verbatim, same as before).
 * - "Net 14 Default Terms" (no default-payment-terms field on `Customer`).
 * - "Auto-send Payment Receipts" (no receipt-preference field on `Customer`).
 *
 * The notes counter uses the shared `NOTES_MAX_LENGTH` (500) rather than the
 * Stitch mock's 240 — that constant is validated by `customerFormSchema` and
 * shared with Edit Customer, so it isn't changed for this screen alone.
 * "Billing Email" is shown as in Stitch, but is left optional (not enforced
 * required) since the existing shared schema doesn't require it and Edit
 * Customer relies on the same schema.
 *
 * When opened with `route.params.onCreated` (a future "add customer while
 * creating an invoice" flow — see `navigation/types.ts`), the newly created
 * customer is handed back to the caller instead of the screen just closing on
 * its own. Otherwise (the plain "+ New customer" flow from the list), saving
 * replaces this screen with Customer Detail for the customer just created.
 */
export function CreateCustomerScreen({ navigation, route }: Props) {
  const { create } = useCustomerStore();
  const onCreated = route.params?.onCreated;
  const [justCreated, setJustCreated] = useState(false);

  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [stateCounty, setStateCounty] = useState('');
  const [country, setCountry] = useState('United Kingdom');

  // DESIGN ONLY: no backing fields on `Customer` — local UI state only, never submitted.
  const [net14Terms, setNet14Terms] = useState(true);
  const [autoReceipts, setAutoReceipts] = useState(true);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues, unknown, CustomerFormOutput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: customerToFormDefaults(null),
  });

  useEffect(() => {
    setValue('address', composeAddress({ street, city, postcode, stateCounty, country }), {
      shouldDirty: true,
    });
  }, [street, city, postcode, stateCounty, country, setValue]);

  const resetAddressParts = () => {
    setStreet('');
    setCity('');
    setPostcode('');
    setStateCounty('');
    setCountry('United Kingdom');
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await create(formValuesToCustomerInput(values));
      // Clear the form and keep the button disabled immediately so nothing
      // stale (filled fields, a re-enabled button) flashes while the screen
      // transition below is still in flight.
      setJustCreated(true);
      reset(customerToFormDefaults(null));
      resetAddressParts();
      if (onCreated) {
        onCreated(created);
        navigation.goBack();
        return;
      }
      // Replace (not navigate/goBack) so this filled-in form is removed from
      // the stack — landing on Customer Detail instead of the list, and
      // leaving no stale form behind to show blank-expecting fields if the
      // user later backs out of Detail.
      navigation.replace('CustomerDetail', { customerId: created.id });
    } catch {
      Alert.alert("Couldn't save", 'This customer could not be created. Please try again.');
    }
  });

  return (
    <KeyboardAvoidingScreen
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="create-customer-screen"
    >
      {/* Top action sub-bar */}
      <View style={styles.subBar}>
        <View>
          <Text style={styles.subBarTitle}>New Customer</Text>
          <View style={styles.subBarCaptionRow}>
            <View style={styles.subBarDot} />
            <Text style={styles.subBarCaption}>Step 1 of 1 · Direct Billing Profile</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          testID="action-cancel-top"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.cancelPill, pressed && styles.pressed]}
        >
          <Text style={styles.cancelPillText}>Cancel</Text>
        </Pressable>
      </View>

      {/* Card 1: Basic Information */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Feather name="briefcase" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Basic Information</Text>
          </View>
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredBadgeText}>Required</Text>
          </View>
        </View>

        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Full or Company Name *"
              value={typeof value === 'string' ? value : ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Acme Construction Ltd or John Smith"
              error={errors.name?.message}
              testID="field-name"
            />
          )}
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Direct Phone Number</Text>
          <View style={styles.phoneRow}>
            {/*
              DESIGN ONLY: Stitch pairs the phone number with a country-code
              badge (flag + dial code). `Customer` has no separate
              countryCode/dial-code field, so this badge is decorative only —
              it does not alter or prefix the phone value below, which is
              saved exactly as typed (same as the screen's previous behavior).
            */}
            <View style={styles.countryBadge} accessibilityLabel="Country code selector — DESIGN ONLY, not stored">
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
                  placeholder="+44 7700 900123"
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

        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.fieldGroup}>
              <FormField
                label="Billing Email"
                value={typeof value === 'string' ? value : ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="billing@clientcompany.com"
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email?.message}
                testID="field-email"
              />
              <View style={styles.helperRow}>
                <Feather name="info" size={12} color={colors.primary} />
                <Text style={styles.helperText}>
                  Automated invoices, receipts &amp; reminders will be sent here
                </Text>
              </View>
            </View>
          )}
        />
      </View>

      {/* Card 2: Billing Address — composes into the single existing `address` field on submit. */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Feather name="map-pin" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Billing Address</Text>
          </View>
          <Text style={styles.cardHeaderCaption}>Tax &amp; Dispatch</Text>
        </View>

        <FormField
          label="Street and Number"
          value={street}
          onChangeText={setStreet}
          placeholder="e.g. 42 Bishopsgate, Suite 4B"
          testID="field-address-street"
        />

        <View style={styles.rowTwoCol}>
          <View style={styles.colHalf}>
            <FormField
              label="City / Town"
              value={city}
              onChangeText={setCity}
              placeholder="London"
              testID="field-address-city"
            />
          </View>
          <View style={styles.colHalf}>
            <FormField
              label="Postcode / ZIP"
              value={postcode}
              onChangeText={setPostcode}
              placeholder="EC2N 4AH"
              autoCapitalize="characters"
              testID="field-address-postcode"
            />
          </View>
        </View>

        <FormField
          label="State / County"
          value={stateCounty}
          onChangeText={setStateCounty}
          placeholder="Greater London"
          testID="field-address-state"
        />

        <OptionPicker
          label="Country"
          options={COUNTRY_OPTIONS}
          value={country}
          onChange={setCountry}
          testID="field-address-country"
        />
      </View>

      {/* Card 3: Terms & Customer Notes */}
      <View style={styles.card}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.cardIcon}>
            <Feather name="clipboard" size={16} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Terms &amp; Customer Notes</Text>
        </View>

        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => {
            const text = typeof value === 'string' ? value : String(value ?? '');
            return (
              <View style={styles.fieldGroup}>
                <View style={styles.notesHeaderRow}>
                  <Text style={styles.label}>Operational Instructions</Text>
                  <Text style={styles.notesCount}>
                    {text.length}/{NOTES_MAX_LENGTH}
                  </Text>
                </View>
                <FormField
                  label=""
                  value={text}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Payment terms, preferred contact hours, site gate codes, or VAT exemption notes..."
                  error={errors.notes?.message}
                  testID="field-notes"
                  multiline
                  numberOfLines={3}
                  maxLength={NOTES_MAX_LENGTH}
                />
              </View>
            );
          }}
        />

        {/* DESIGN ONLY: no default-payment-terms field exists on `Customer`; this toggle is local UI state and is never submitted. */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleLabel}>Net 14 Default Terms</Text>
            <Text style={styles.toggleCaption}>Auto-apply 14 day due dates on new draft invoices</Text>
            <Text style={styles.designOnlyTag}>DESIGN ONLY</Text>
          </View>
          <Switch
            value={net14Terms}
            onValueChange={setNet14Terms}
            trackColor={{ true: colors.primary, false: colors.border }}
            testID="toggle-net14-design-only"
          />
        </View>

        {/* DESIGN ONLY: no receipt-preference field exists on `Customer`; this toggle is local UI state and is never submitted. */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleLabel}>Auto-send Payment Receipts</Text>
            <Text style={styles.toggleCaption}>Deliver instant confirmation upon balance settlement</Text>
            <Text style={styles.designOnlyTag}>DESIGN ONLY</Text>
          </View>
          <Switch
            value={autoReceipts}
            onValueChange={setAutoReceipts}
            trackColor={{ true: colors.primary, false: colors.border }}
            testID="toggle-auto-receipts-design-only"
          />
        </View>
      </View>

      {/* Informational preview — describes real, existing functionality (Customer Detail's Create Invoice action), not a form field. */}
      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <Feather name="shield" size={18} color="#1E7B41" />
        </View>
        <View style={styles.infoTextCol}>
          <Text style={styles.infoTitle}>Instant Verification Ready</Text>
          <Text style={styles.infoCaption}>Once saved, tap to issue invoices in under 15 seconds.</Text>
        </View>
      </View>

      {/* Sticky bottom dock */}
      <View style={styles.dock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          testID="action-cancel-bottom"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.dockCancel, pressed && styles.pressed]}
        >
          <Text style={styles.dockCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save Customer"
          testID="save-customer"
          onPress={onSubmit}
          disabled={isSubmitting || justCreated}
          style={({ pressed }) => [
            styles.dockSave,
            (isSubmitting || justCreated) && styles.dockSaveDisabled,
            pressed && !(isSubmitting || justCreated) && styles.pressed,
          ]}
        >
          <Feather name="check-circle" size={18} color={colors.primaryText} />
          <Text style={styles.dockSaveText}>{isSubmitting ? 'Saving…' : 'Save Customer'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingScreen>
  );
}

function composeAddress(parts: {
  street: string;
  city: string;
  postcode: string;
  stateCounty: string;
  country: string;
}): string {
  return [parts.street, parts.city, parts.postcode, parts.stateCounty, parts.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },

  subBar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  subBarTitle: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  subBarCaptionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  subBarDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  subBarCaption: { fontSize: 12, color: colors.textMuted },
  cancelPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface },
  cancelPillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },

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
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  requiredBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.background },
  requiredBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  cardHeaderCaption: { fontSize: 12, color: colors.textMuted },

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
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  helperText: { fontSize: 11, color: colors.textMuted, flexShrink: 1 },

  rowTwoCol: { flexDirection: 'row', gap: 10 },
  colHalf: { flex: 1, minWidth: 0 },

  notesHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notesCount: { fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums'] },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  toggleTextCol: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  toggleCaption: { fontSize: 11, color: colors.textMuted },
  designOnlyTag: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, marginTop: 2 },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E4F5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextCol: { flex: 1, gap: 2 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  infoCaption: { fontSize: 11, color: colors.textMuted },

  dock: { flexDirection: 'row', gap: 10, marginTop: 4 },
  dockCancel: {
    width: '33%',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockCancelText: { fontSize: 14, fontWeight: '700', color: colors.text },
  dockSave: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dockSaveDisabled: { opacity: 0.6 },
  dockSaveText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
});
