import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { OptionPicker } from '@/components/business/OptionPicker';
import { FormField } from '@/components/businessCard/FormField';
import { KeyboardAvoidingScreen } from '@/components/shared/KeyboardAvoidingScreen';
import { customerToFormDefaults, formValuesToCustomerInput } from '@/domain/customer/formMapping';
import type { Customer } from '@/domain/customer/types';
import {
  NOTES_MAX_LENGTH,
  customerFormSchema,
  type CustomerFormOutput,
  type CustomerFormValues,
} from '@/domain/customer/validation';
import { openGoogleMaps } from '@/lib/linking';
import type { RootStackParamList } from '@/navigation/types';
import { useCustomerActivityStore } from '@/state/customerActivityStore';
import { useCustomerStore } from '@/state/customerStore';
import { useCurrencySymbol } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'EditCustomer'>;

type LoadStatus = 'loading' | 'ready' | 'error' | 'not-found';

/** Mirrors Create Customer's fixed country list — kept local rather than importing across screens. */
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
 * Edit Customer, restyled to match the Stitch "Edit Customer" design: a
 * profile sub-header with a real "last updated" timestamp, a financial
 * overview capsule, Basic Information / Billing Address / Invoice Notes
 * cards, and a Danger Zone with a real delete action.
 *
 * `Customer` (`domain/customer/types.ts`) only has one freeform `address`
 * string — there is no structured street/city/postcode/country storage.
 * Unlike Create Customer (which starts blank and can safely compose four
 * inputs into that one field), Edit loads a pre-existing, arbitrarily
 * formatted address. Silently re-composing it from four fields on every save
 * risked corrupting data the user never touched (e.g. appending a default
 * country to an address that already had one). So here only "Street Address"
 * is wired to the real `address` field (loaded as-is, saved as-is); City,
 * Postcode and Country are local UI state only, interactive but never
 * submitted, and marked DESIGN ONLY.
 *
 * DESIGN ONLY elements (no backing field/behavior on `Customer` or its
 * repository):
 * - "CUST-0042 • Active" and "Verified VAT Reg" (no customer code, active
 *   status, or VAT-verification field).
 * - The Micro Health Sparkbar ("Paid on time" / "Draft/Pending" split) — no
 *   on-time/draft tracking exists on invoices.
 * - City / Postcode / Country billing-address fields (see above).
 * - The "PDF memo" tag and "Appears in footer notes of issued bills" caption
 *   on Notes — `customer.notes` is not actually rendered into invoice PDFs
 *   anywhere in `domain/pdf`, so that claim is replaced with accurate copy.
 *
 * Real, backend-connected elements:
 * - Name / Phone / Billing Email / Street Address / Notes load from and save
 *   to the existing customer record via `customerStore.update`.
 * - "Last updated" is `customer.updatedAt`, formatted relative to now.
 * - Lifetime Revenue / Billing Volume are `CustomerBalanceSummary.totalBilled`
 *   / `.invoiceCount` (`customerActivityStore`), the same real, invoice-
 *   derived numbers Customer Detail shows as "Total Invoiced".
 * - "Map Pin" opens the customer's address in Google Maps (`lib/linking`),
 *   same real capability Customer Detail's directions action already uses.
 * - Delete Customer calls `customerStore.remove` for real. The Stitch copy
 *   claiming deleted customers' invoices "remain archived" doesn't match
 *   this schema (`invoice`/`payment` rows `REFERENCES customer(id)` with no
 *   `ON DELETE` clause, and `PRAGMA foreign_keys = ON` — see
 *   `data/db/client.ts`/`schema.ts`), so deleting a customer with billing
 *   history actually fails; the copy below reflects that instead.
 */
export function EditCustomerScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const { getById, update, remove } = useCustomerStore();
  const { summary, load: loadActivity } = useCustomerActivityStore();
  const currencySymbol = useCurrencySymbol();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('United Kingdom');

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues, unknown, CustomerFormOutput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: customerToFormDefaults(null),
  });

  const streetAddress = watch('address');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getById(customerId);
        if (cancelled) {
          return;
        }
        if (!found) {
          setStatus('not-found');
          return;
        }
        setCustomer(found);
        reset(customerToFormDefaults(found));
        await loadActivity(customerId);
        if (cancelled) {
          return;
        }
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update(customerId, formValuesToCustomerInput(values));
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save", 'Your changes could not be saved. Please try again.');
    }
  });

  const handleDelete = async () => {
    setDeleteModalVisible(false);
    setDeleting(true);
    try {
      await remove(customerId);
      navigation.navigate('CustomerList');
    } catch {
      setDeleting(false);
      Alert.alert("Couldn't delete", 'This customer could not be deleted. Please try again.');
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="edit-customer-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'not-found') {
    return (
      <View style={styles.centered} testID="edit-customer-not-found">
        <Text style={styles.errorText}>This customer no longer exists.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backLinkButton, pressed && styles.pressed]}
        >
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'error' || !customer) {
    return (
      <View style={styles.centered} testID="edit-customer-error">
        <Text style={styles.errorText}>Couldn't load this customer.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backLinkButton, pressed && styles.pressed]}
        >
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const notesText = watch('notes');
  const notesLength = typeof notesText === 'string' ? notesText.length : 0;

  return (
    <KeyboardAvoidingScreen
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="edit-customer-screen"
    >
      {/* Header sub-bar */}
      <View style={styles.subBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          testID="action-back"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Feather name="arrow-left" size={22} color={colors.textMuted} />
        </Pressable>
        <View style={styles.subBarCenter}>
          <Text style={styles.subBarTitle}>Edit Customer</Text>
          <Text style={styles.subBarCaption}>{formatLastUpdated(customer.updatedAt)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save"
          testID="action-save-top"
          onPress={onSubmit}
          disabled={isSubmitting || deleting}
          style={({ pressed }) => [styles.savePill, pressed && styles.pressed]}
        >
          <Text style={styles.savePillText}>Save</Text>
        </Pressable>
      </View>

      {/* Customer Overview Hero Capsule */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge} accessibilityLabel="Customer code and status — DESIGN ONLY, no such field exists">
            <View style={styles.heroBadgeDot} />
            <Text style={styles.heroBadgeText}>DESIGN ONLY</Text>
          </View>
          <View style={styles.heroVerifiedRow} accessibilityLabel="Verified VAT registration — DESIGN ONLY, no VAT field exists">
            <Feather name="shield" size={13} color={colors.textMuted} />
            <Text style={styles.heroVerifiedText}>Verified VAT Reg · DESIGN ONLY</Text>
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <View>
            <Text style={styles.heroStatLabel}>Lifetime Revenue</Text>
            <Text style={styles.heroStatValue} testID="hero-lifetime-revenue">
              {currencySymbol}{summary.totalBilled.toFixed(2)}
            </Text>
          </View>
          <View style={styles.heroStatRight}>
            <Text style={styles.heroStatLabel}>Billing Volume</Text>
            <Text style={styles.heroStatValueSmall} testID="hero-billing-volume">
              {summary.invoiceCount} Invoice{summary.invoiceCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
        {/* DESIGN ONLY: no "paid on time" / "draft" tracking exists on invoices. */}
        <View style={styles.sparkbar} accessibilityLabel="Health sparkbar — DESIGN ONLY, not derived from real data">
          <View style={styles.sparkbarPaid} />
          <View style={styles.sparkbarPending} />
        </View>
        <Text style={styles.sparkbarCaption}>Paid on time / Draft &amp; pending · DESIGN ONLY</Text>
      </View>

      {/* 1. Basic Information Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Feather name="briefcase" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Basic Information</Text>
          </View>
          <Text style={styles.cardHeaderCaption}>Required fields *</Text>
        </View>

        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Company / Full Name *"
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
              placeholder="+44 20 7946 0812"
              keyboardType="phone-pad"
              error={errors.phone?.message}
              testID="field-phone"
            />
          )}
        />

        {/* Stitch labels this "Billing Email Address *"; the shared schema (also used by Create Customer) leaves email optional, so it isn't enforced required here. */}
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.fieldGroup}>
              <FormField
                label="Billing Email Address *"
                value={typeof value === 'string' ? value : ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="accounts@clientcompany.com"
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email?.message}
                testID="field-email"
              />
              <View style={styles.helperRow}>
                <Feather name="info" size={12} color={colors.primary} />
                <Text style={styles.helperText}>Automated invoices &amp; payment receipts deliver here.</Text>
              </View>
            </View>
          )}
        />
      </View>

      {/* 2. Billing Address Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Feather name="map-pin" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Billing Address</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open address in Google Maps"
            testID="action-map-pin"
            onPress={() =>
              openGoogleMaps({ address: typeof streetAddress === 'string' ? streetAddress : customer.address })
            }
            style={({ pressed }) => [styles.mapPinButton, pressed && styles.pressed]}
          >
            <Text style={styles.mapPinButtonText}>Map Pin</Text>
            <Feather name="external-link" size={12} color={colors.primary} />
          </Pressable>
        </View>

        <Controller
          control={control}
          name="address"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Street Address"
              value={typeof value === 'string' ? value : ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="24 Hanover Square, Mayfair"
              error={errors.address?.message}
              testID="field-address-street"
            />
          )}
        />

        {/* DESIGN ONLY: no separate city/postcode/country columns exist — see the class doc comment above. */}
        <View style={styles.rowTwoCol}>
          <View style={styles.colHalf}>
            <FormField
              label="City · DESIGN ONLY"
              value={city}
              onChangeText={setCity}
              placeholder="London"
              testID="field-address-city"
            />
          </View>
          <View style={styles.colHalf}>
            <FormField
              label="Postcode · DESIGN ONLY"
              value={postcode}
              onChangeText={setPostcode}
              placeholder="W1S 1JD"
              autoCapitalize="characters"
              testID="field-address-postcode"
            />
          </View>
        </View>

        <OptionPicker
          label="Country · DESIGN ONLY"
          options={COUNTRY_OPTIONS}
          value={country}
          onChange={setCountry}
          testID="field-address-country"
        />
      </View>

      {/* 3. Invoice Notes & Terms Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Feather name="file-text" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Invoice Notes &amp; Terms</Text>
          </View>
        </View>

        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <View style={styles.fieldGroup}>
              <FormField
                label="Special Invoicing Instructions"
                value={typeof value === 'string' ? value : String(value ?? '')}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Requires purchase order (PO) number on all invoice PDFs..."
                error={errors.notes?.message}
                testID="field-notes"
                multiline
                numberOfLines={3}
                maxLength={NOTES_MAX_LENGTH}
              />
              <View style={styles.notesFooterRow}>
                {/* Stitch's "Appears in footer notes of issued bills" claim doesn't match real behavior — `customer.notes` isn't rendered into invoice PDFs anywhere in `domain/pdf`. */}
                <Text style={styles.helperText}>Private notes about this customer.</Text>
                <Text style={styles.notesCount}>
                  {notesLength}/{NOTES_MAX_LENGTH}
                </Text>
              </View>
            </View>
          )}
        />
      </View>

      {/* 4. Danger Zone */}
      <View style={styles.dangerCard}>
        <View style={styles.dangerHeaderRow}>
          <View style={styles.dangerIcon}>
            <Feather name="alert-triangle" size={18} color={colors.danger} />
          </View>
          <View style={styles.dangerTextCol}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Text style={styles.dangerCaption}>
              Permanently removes this customer record. Customers with existing invoices or payments can&apos;t be
              deleted until that billing history is removed first.
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete customer"
          testID="action-delete-customer"
          onPress={() => setDeleteModalVisible(true)}
          disabled={deleting}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <Feather name="trash-2" size={18} color={colors.danger} />
          <Text style={styles.deleteButtonText}>{deleting ? 'Deleting…' : 'Delete Customer'}</Text>
        </Pressable>
      </View>

      {/* Bottom Save action */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save Changes"
        testID="save-customer"
        onPress={onSubmit}
        disabled={isSubmitting || deleting}
        style={({ pressed }) => [
          styles.dockSave,
          (isSubmitting || deleting) && styles.dockSaveDisabled,
          pressed && !(isSubmitting || deleting) && styles.pressed,
        ]}
      >
        <Feather name="check" size={18} color={colors.primaryText} />
        <Text style={styles.dockSaveText}>{isSubmitting ? 'Saving…' : 'Save Changes'}</Text>
      </Pressable>

      {/* Deletion Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalBackdrop} testID="confirm-delete-modal">
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Feather name="trash-2" size={24} color={colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Confirm Deletion?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to remove <Text style={styles.modalMessageBold}>{customer.name}</Text>? This
              action cannot be undone.
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="confirm-delete-btn"
              onPress={handleDelete}
              style={({ pressed }) => [styles.modalDeleteButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalDeleteButtonText}>Yes, Delete Customer</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="cancel-delete-btn"
              onPress={() => setDeleteModalVisible(false)}
              style={({ pressed }) => [styles.modalCancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalCancelButtonText}>Keep Customer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingScreen>
  );
}

function formatLastUpdated(updatedAt: string): string {
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(updated)) {
    return '';
  }
  const diffMinutes = Math.floor((Date.now() - updated) / 60000);
  if (diffMinutes < 1) {
    return 'Last updated just now';
  }
  if (diffMinutes < 60) {
    return `Last updated ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Last updated ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `Last updated ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `Last updated ${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  }
  const diffYears = Math.floor(diffMonths / 12);
  return `Last updated ${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  backLinkButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surface },
  backLinkText: { fontSize: 14, fontWeight: '700', color: colors.text },

  subBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  subBarCenter: { flex: 1, alignItems: 'center' },
  subBarTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  subBarCaption: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  savePill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.background },
  savePillText: { fontSize: 14, fontWeight: '700', color: colors.primary },

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  heroBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  heroVerifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroVerifiedText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },

  heroStatsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  heroStatRight: { alignItems: 'flex-end' },
  heroStatLabel: { fontSize: 11, color: colors.textMuted },
  heroStatValue: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2, letterSpacing: -0.3 },
  heroStatValueSmall: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },

  sparkbar: { flexDirection: 'row', width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.background },
  sparkbarPaid: { width: '85%', backgroundColor: '#1E7B41' },
  sparkbarPending: { width: '15%', backgroundColor: colors.border },
  sparkbarCaption: { fontSize: 10, color: colors.textMuted },

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
  cardHeaderCaption: { fontSize: 12, color: colors.textMuted },

  fieldGroup: { gap: 6 },
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  helperText: { fontSize: 11, color: colors.textMuted, flexShrink: 1 },

  mapPinButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  mapPinButtonText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  rowTwoCol: { flexDirection: 'row', gap: 10 },
  colHalf: { flex: 1, minWidth: 0 },

  notesFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  notesCount: { fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums'] },

  dangerCard: { backgroundColor: '#FBE4E2', borderRadius: 16, padding: 16, gap: 12 },
  dangerHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dangerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5C6C1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTextCol: { flex: 1, gap: 3 },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: colors.danger },
  dangerCaption: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  deleteButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5C6C1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: { fontSize: 14, fontWeight: '700', color: colors.danger },

  dockSave: {
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

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,28,48,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FBE4E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalMessage: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  modalMessageBold: { fontWeight: '700', color: colors.text },
  modalDeleteButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalDeleteButtonText: { fontSize: 14, fontWeight: '700', color: colors.primaryText },
  modalCancelButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: { fontSize: 14, fontWeight: '700', color: colors.text },
});
