import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Controller, useController, type Control } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FormField } from '@/components/businessCard/FormField';
import { DateField, parseIsoDateLocal } from '@/components/shared/DateField';
import { METHOD_STYLE } from '@/components/payment/PaymentListRow';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS, type PaymentMethod } from '@/domain/payment/types';
import type { PaymentFormOutput, PaymentFormValues } from '@/domain/payment/validation';
import { useCurrencySymbol } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

/** Matches the exact `useForm<PaymentFormValues, unknown, PaymentFormOutput>()` shape both screens use. */
type PaymentFormControl = Control<PaymentFormValues, unknown, PaymentFormOutput>;

interface Props {
  control: PaymentFormControl;
  errors: Record<string, { message?: string } | undefined>;
  /** The invoice's own issue date (`YYYY-MM-DD`) — a payment can't be dated before it, so it's also the calendar's lower bound (see `paymentFormSchemaWithMinDate`). */
  minPaymentDate?: string | null;
  /**
   * When provided, shows a "Pay in Full" preset chip above the amount field
   * that fills in the invoice's full remaining balance and today's date in
   * one tap (Record Payment only — Edit Payment doesn't pass this).
   */
  onFullPay?: () => void;
  /** When provided (alongside `onFullPay`), shows a "50%" preset chip that fills in half the remaining balance. Record Payment only. */
  onHalfPay?: () => void;
}

/**
 * The field set shared by Record Payment and Edit Payment — one
 * implementation so the two screens can never drift apart. Same pattern as
 * `components/customer/CustomerFormFields.tsx`. `invoiceId` is deliberately
 * not a field here — it's fixed by the screen's route param, never
 * user-editable (see the doc comment on `PaymentUpdateInput`).
 *
 * Restyled into Stitch's card sections — "Amount Received" (money input +
 * real preset chips), "Payment Method" (an icon grid reusing
 * `PaymentListRow`'s real `METHOD_STYLE` mapping), and a Date/Reference/
 * Notes card. Every existing `Controller`/`testID` is unchanged, since both
 * screens' tests assert on `field-amount`, `field-paymentDate`,
 * `field-method`, `field-reference`, `field-notes`, `full-pay-button`
 * directly.
 */
export function PaymentFormFields({ control, errors, minPaymentDate, onFullPay, onHalfPay }: Props) {
  return (
    <>
      {/* Amount Received */}
      <View style={styles.card}>
        <PriceField name="amount" label="Amount Received *" control={control} errors={errors} />
        {!!onFullPay && (
          <View style={styles.presetRow}>
            <Pressable
              accessibilityRole="button"
              testID="full-pay-button"
              onPress={onFullPay}
              style={({ pressed }) => [styles.presetChip, styles.presetChipPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.presetChipPrimaryText}>Pay in Full</Text>
            </Pressable>
            {!!onHalfPay && (
              <Pressable
                accessibilityRole="button"
                testID="half-pay-button"
                onPress={onHalfPay}
                style={({ pressed }) => [styles.presetChip, pressed && styles.pressed]}
              >
                <Text style={styles.presetChipText}>50%</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Payment Method */}
      <View style={styles.card}>
        <Text style={styles.label}>Payment Method *</Text>
        <MethodField control={control} />
      </View>

      {/* Date, Reference & Notes */}
      <View style={styles.card}>
        <Controller
          control={control}
          name="paymentDate"
          render={({ field: { value, onChange, onBlur } }) => (
            <DateField
              label="Payment Date *"
              value={typeof value === 'string' ? value : ''}
              onChange={onChange}
              onBlur={onBlur}
              error={errors.paymentDate?.message}
              minimumDate={minPaymentDate ? parseIsoDateLocal(minPaymentDate) : null}
              maximumDate={null}
              testID="field-paymentDate"
            />
          )}
        />
        <Field name="reference" label="Reference / Transaction ID" control={control} errors={errors} placeholder="e.g. BACS-98421 or Cheque #" />
        <Field name="notes" label="Internal Notes" control={control} errors={errors} multiline placeholder="Remittance info, e.g. Paid via HSBC business banking" />
      </View>
    </>
  );
}

/** Icon-grid method picker — same real `PAYMENT_METHOD_OPTIONS`/`METHOD_STYLE` used everywhere else, just a grid instead of text chips to match Stitch. */
function MethodField({ control }: { control: PaymentFormControl }) {
  const { field } = useController({ control, name: 'method' });
  const value = field.value as PaymentMethod;
  return (
    <View style={styles.methodGrid} testID="field-method">
      {PAYMENT_METHOD_OPTIONS.map((option) => {
        const selected = value === option.value;
        const style = METHOD_STYLE[option.value as PaymentMethod];
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={PAYMENT_METHOD_LABELS[option.value as PaymentMethod]}
            accessibilityState={{ selected }}
            testID={`field-method-${option.value}`}
            onPress={() => field.onChange(option.value)}
            style={[styles.methodButton, selected && { backgroundColor: style.bg }]}
          >
            <Feather name={style.icon} size={20} color={selected ? style.fg : colors.textMuted} />
            <Text style={[styles.methodLabel, selected && { color: style.fg, fontWeight: '700' }]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Money-prefixed variant of `Field`, matching `ItemFormFields`/`InvoiceLineFormFields`'s `PriceField` pattern — used only for `amount`. */
function PriceField({
  name,
  label,
  control,
  errors,
}: {
  name: keyof PaymentFormValues;
  label: string;
  control: PaymentFormControl;
  errors: Record<string, { message?: string } | undefined>;
}) {
  const currencySymbol = useCurrencySymbol();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceCurrency}>{currencySymbol}</Text>
            <FormField
              label=""
              value={typeof value === 'string' ? value : String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="0.00"
              keyboardType="decimal-pad"
              error={errors[name]?.message}
              testID={`field-${name}`}
              style={styles.priceInput}
            />
          </View>
        </View>
      )}
    />
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: { opacity: 0.75 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },

  priceRow: { flexDirection: 'row', alignItems: 'center' },
  priceCurrency: { position: 'absolute', left: 12, zIndex: 1, fontSize: 22, fontWeight: '700', color: colors.primary },
  priceInput: { flex: 1, paddingLeft: 30, fontSize: 22, fontWeight: '700' },

  presetRow: { flexDirection: 'row', gap: 8 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.background },
  presetChipPrimary: { backgroundColor: colors.primary },
  presetChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  presetChipPrimaryText: { fontSize: 12, fontWeight: '700', color: colors.primaryText },

  methodGrid: { flexDirection: 'row', gap: 8 },
  methodButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  methodLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
});
