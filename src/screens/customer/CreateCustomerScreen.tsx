import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/businessCard/FormField';
import { BottomActionBar } from '@/components/shared/BottomActionBar';
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

/**
 * Create Customer screen, restyled to match the Stitch "Create Customer"
 * design: a Basic Information card, a structured Billing Address card, and a
 * Customer Notes card, with a fixed Cancel/Save Customer bottom action bar.
 *
 * `Customer` (`domain/customer/types.ts`) only has one freeform `address`
 * string — there are no separate street/city/postcode/state columns.
 * Rather than fake structured storage, the four address text inputs are
 * combined into that single existing `address` field on
 * submit (see `composeAddress` below), so the data still saves for real, just
 * through a friendlier entry form.
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
    setValue('address', composeAddress({ street, city, postcode, stateCounty }), {
      shouldDirty: true,
    });
  }, [street, city, postcode, stateCounty, setValue]);

  const resetAddressParts = () => {
    setStreet('');
    setCity('');
    setPostcode('');
    setStateCounty('');
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
      footer={
        <BottomActionBar
          secondary={{ label: 'Cancel', onPress: () => navigation.goBack(), testID: 'action-cancel-bottom' }}
          primary={{
            label: isSubmitting ? 'Saving…' : 'Save Customer',
            accessibilityLabel: 'Save Customer',
            icon: 'check-circle',
            onPress: onSubmit,
            disabled: isSubmitting || justCreated,
            testID: 'save-customer',
          }}
        />
      }
    >
      {/* Top action sub-bar */}
      <View style={styles.subBar}>
        <Text style={styles.subBarTitle}>New Customer</Text>
        <View style={styles.subBarCaptionRow}>
          <View style={styles.subBarDot} />
          <Text style={styles.subBarCaption}>Step 1 of 1 · Direct Billing Profile</Text>
        </View>
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

        <Controller
          control={control}
          name="phone"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Phone Number"
              value={typeof value === 'string' ? value : ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="+44 7700 900123"
              keyboardType="phone-pad"
              error={errors.phone?.message}
              testID="field-phone"
            />
          )}
        />

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
      </View>

      {/* Card 3: Customer Notes */}
      <View style={styles.card}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.cardIcon}>
            <Feather name="clipboard" size={16} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Customer Notes</Text>
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
    </KeyboardAvoidingScreen>
  );
}

function composeAddress(parts: {
  street: string;
  city: string;
  postcode: string;
  stateCounty: string;
}): string {
  return [parts.street, parts.city, parts.postcode, parts.stateCounty]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },

  subBar: { gap: 8 },
  subBarTitle: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  subBarCaptionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  subBarDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  subBarCaption: { fontSize: 12, color: colors.textMuted },

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
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  helperText: { fontSize: 11, color: colors.textMuted, flexShrink: 1 },

  rowTwoCol: { flexDirection: 'row', gap: 10 },
  colHalf: { flex: 1, minWidth: 0 },

  notesHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notesCount: { fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums'] },

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

});
