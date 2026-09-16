import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Controller, useController, useWatch, type Control } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OptionPicker } from '@/components/business/OptionPicker';
import { FormField } from '@/components/businessCard/FormField';
import { UnitOptionPicker } from '@/components/shared/UnitOptionPicker';
import { calculateLineTotal } from '@/domain/invoice/calculations';
import type { InvoiceLineFormOutput, InvoiceLineFormValues } from '@/domain/invoice/validation';
import type { UnitFieldKind } from '@/domain/invoiceType/customUnits';
import { getFieldDefinition } from '@/domain/invoiceType/fieldCatalog';
import { PRICING_METHOD_OPTIONS, getInvoiceTypeDefinition, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { getFieldLabel, type InvoiceFieldConfig } from '@/domain/invoiceType/types';
import { useCurrencySymbol } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

/** Matches the exact `useForm<InvoiceLineFormValues, unknown, InvoiceLineFormOutput>()` shape the screen uses. */
type InvoiceLineFormControl = Control<InvoiceLineFormValues, unknown, InvoiceLineFormOutput>;

interface Props {
  control: InvoiceLineFormControl;
  errors: Record<string, { message?: string } | undefined>;
  /** Which fields to render, and which pricing method they belong to (for method-specific labels/units) — resolved once by the screen from the invoice's Pricing Method. */
  fieldConfig: InvoiceFieldConfig;
  /**
   * Whether the Pricing Method field above Item Name is an editable dropdown
   * rather than a read-only label. Only true for a brand-new line on an
   * invoice that has no items yet (the screen decides this — every other
   * line must match the invoice's already-established pricing method, see
   * `assertLinesMatchPricingMethod`).
   */
  pricingMethodEditable?: boolean;
  /** Required when `pricingMethodEditable` is true — picking a new method re-resolves `fieldConfig` and re-renders the fields below it. */
  onPricingMethodChange?: (invoiceTypeId: InvoiceTypeId) => void;
}

/** Matches the Stitch "Discount" preset chips — the 0/5/10% presets write into the real `discountPercent` field; "Fixed £" has no backing field (see below) and is DESIGN ONLY. */
const DISCOUNT_PRESETS = ['0', '5', '10'];

/**
 * The line-item form shared by "add from catalog" fine-tuning and "add a
 * manual line" (both routed through `EditInvoiceLineScreen`) — one
 * implementation so the two entry points can never drift apart, mirroring
 * `ItemFormFields`. This is the app's one reusable `InvoiceLineEditor`: it
 * never hard-codes a field list per pricing method, only walks whatever
 * `fieldConfig` resolved (`resolveInvoiceFieldConfig`). Item Name and Unit
 * Price always render (every pricing method includes them — see
 * `fieldCatalog.ts`'s `alwaysIncluded`); every other field only renders when
 * `fieldConfig` includes it, with its label resolved per-method (e.g. TIME's
 * "Duration" instead of the generic "Quantity").
 *
 * Restyled into Stitch's "Edit Line Item" card sections. Every existing
 * `Controller`/`testID` is unchanged — `EditInvoiceLineScreen`'s tests assert
 * on `field-itemName`, `field-quantity`, `field-weight`, `field-length`,
 * `field-unitPrice`, etc. directly.
 *
 * New real addition: a "Line Total Preview" card computed live via
 * `calculateLineTotal` (the same function `CreateInvoiceItemsScreen`/
 * `InvoiceReviewScreen` use to freeze the real snapshot at save time) — this
 * screen previously showed no running total at all while editing.
 *
 * One Stitch element has no backing field: the "Fixed £" discount option —
 * `InvoiceItemSnapshot.discountPercent` is a percentage only, there is no
 * fixed-amount discount field, so that specific preset is DESIGN ONLY
 * (shown, inert) while the 0/5/10% presets are real.
 */
export function InvoiceLineFormFields({
  control,
  errors,
  fieldConfig,
  pricingMethodEditable,
  onPricingMethodChange,
}: Props) {
  const has = (key: string) => fieldConfig.fields.some((field) => field.key === key);
  const label = (key: Parameters<typeof getFieldLabel>[1]) => getFieldLabel(fieldConfig.invoiceTypeId, key);
  const hasDimensions = has('weight') || has('length') || has('width') || has('height');
  const currencySymbol = useCurrencySymbol();

  return (
    <>
      {/* Pricing Method */}
      <View style={styles.card}>
        {pricingMethodEditable && onPricingMethodChange ? (
          <OptionPicker
            label="Pricing Method"
            options={PRICING_METHOD_OPTIONS}
            value={fieldConfig.invoiceTypeId}
            onChange={onPricingMethodChange}
            testID="field-pricingMethod"
          />
        ) : (
          <View style={styles.readonlyRow} testID="field-pricingMethod-readonly">
            <Text style={styles.readonlyLabel}>Pricing Method</Text>
            <Text style={styles.readonlyValue}>{getInvoiceTypeDefinition(fieldConfig.invoiceTypeId).label}</Text>
          </View>
        )}
      </View>

      {/* Line Details */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="edit-3" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Line Details</Text>
        </View>
        <Field name="itemName" label={`${label('itemName')} *`} control={control} errors={errors} />
        {has('description') && (
          <Field name="description" label={label('description')} control={control} errors={errors} multiline />
        )}
        {has('sku') && <Field name="sku" label={label('sku')} control={control} errors={errors} />}
      </View>

      {/* Quantity & Unit */}
      {(has('quantity') || has('unit')) && (
        <View style={styles.card}>
          {has('quantity') && (
            <QuantityField name="quantity" label={`${label('quantity')} *`} control={control} errors={errors} />
          )}
          {has('unit') && <SelectField name="unit" fieldKey="unit" control={control} />}
        </View>
      )}

      {/* Pricing */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Feather name="dollar-sign" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Pricing</Text>
        </View>
        <PriceField name="unitPrice" label={`${label('unitPrice')} *`} control={control} errors={errors} />
        {has('tax') && (
          <Field name="taxPercent" label={`${label('tax')} (%)`} control={control} errors={errors} keyboardType="decimal-pad" />
        )}
        {has('discount') && (
          <View style={styles.fieldGroup}>
            <View style={styles.discountHeaderRow}>
              <Text style={styles.label}>{`${label('discount')} (%)`}</Text>
              <Text style={styles.discountCaption}>Applied to line net</Text>
            </View>
            <View style={styles.discountRow}>
              <View style={styles.discountInputWrap}>
                <Field name="discountPercent" label="" control={control} errors={errors} keyboardType="decimal-pad" />
              </View>
              {DISCOUNT_PRESETS.map((preset) => (
                <DiscountPresetChip key={preset} value={preset} control={control} />
              ))}
              {/* DESIGN ONLY: `discountPercent` is a percentage only — there is no fixed-amount discount field. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fixed amount discount — DESIGN ONLY, only percentage discounts are supported"
                testID="field-discount-fixed-design-only"
                onPress={() => undefined}
                style={styles.presetChip}
              >
                <Text style={styles.presetChipText}>Fixed {currencySymbol} · DESIGN ONLY</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Logistics & Dimensions */}
      {hasDimensions && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Feather name="package" size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Logistics &amp; Dimensions</Text>
          </View>
          {has('weight') && (
            <Field name="weight" label={`${label('weight')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
          )}
          {has('weightUnit') && <SelectField name="weightUnit" fieldKey="weightUnit" control={control} />}
          {has('length') && (
            <Field name="length" label={`${label('length')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
          )}
          {has('width') && (
            <Field name="width" label={`${label('width')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
          )}
          {has('height') && (
            <Field name="height" label={`${label('height')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
          )}
          {has('lengthUnit') && <SelectField name="lengthUnit" fieldKey="lengthUnit" control={control} />}
          {has('timeUnit') && <SelectField name="timeUnit" fieldKey="timeUnit" control={control} />}
        </View>
      )}

      <LineTotalPreview control={control} fieldConfig={fieldConfig} />
    </>
  );
}

/** Live "Line Total Preview" — real math via the same `calculateLineTotal` the rest of the app freezes at save time. Previously this screen showed no running total at all. */
function LineTotalPreview({ control, fieldConfig }: { control: InvoiceLineFormControl; fieldConfig: InvoiceFieldConfig }) {
  const values = useWatch({ control });
  const currencySymbol = useCurrencySymbol();
  const toNum = (v: unknown): number | null => {
    if (typeof v !== 'string' || v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const calc = calculateLineTotal(
    {
      quantity: toNum(values.quantity),
      weight: toNum(values.weight),
      length: toNum(values.length),
      width: toNum(values.width),
      height: toNum(values.height),
      unitPrice: toNum(values.unitPrice) ?? 0,
      discountPercent: toNum(values.discountPercent),
      taxPercent: toNum(values.taxPercent),
    },
    fieldConfig.invoiceTypeId,
  );

  return (
    <View style={styles.previewCard} testID="invoice-line-total-preview">
      <View style={styles.previewHeaderRow}>
        <View style={styles.previewHeaderLeft}>
          <Feather name="hash" size={16} color={colors.primary} />
          <Text style={styles.previewTitle}>Line Total Preview</Text>
        </View>
      </View>
      {calc.discountAmount > 0 && (
        <View style={styles.previewRow}>
          <Text style={styles.previewRowLabel}>Discount</Text>
          <Text style={styles.previewRowValue}>-{currencySymbol}{calc.discountAmount.toFixed(2)}</Text>
        </View>
      )}
      <View style={styles.previewRow}>
        <Text style={styles.previewRowLabel}>{calc.taxAmount > 0 ? `+${currencySymbol}${calc.taxAmount.toFixed(2)} VAT` : 'No VAT'}</Text>
      </View>
      <View style={styles.previewGrossRow}>
        <Text style={styles.previewGrossLabel}>Line Total</Text>
        <Text style={styles.previewGrossValue}>{currencySymbol}{calc.lineTotal.toFixed(2)}</Text>
      </View>
    </View>
  );
}

/** One Discount preset chip — writes its value straight into the real `discountPercent` field on press. */
function DiscountPresetChip({ value, control }: { value: string; control: InvoiceLineFormControl }) {
  const { field } = useController({ control, name: 'discountPercent' });
  const currentValue = typeof field.value === 'string' ? field.value : '';
  const selected = currentValue === value;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value}% discount`}
      accessibilityState={{ selected }}
      onPress={() => field.onChange(value)}
      style={[styles.presetChip, selected && styles.presetChipSelected]}
    >
      <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>{value}%</Text>
    </Pressable>
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
  name: keyof InvoiceLineFormValues;
  label: string;
  control: InvoiceLineFormControl;
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

/** Quantity field with a Stitch-style +/- stepper wrapped around the same real `quantity` Controller/testID. */
function QuantityField({
  name,
  label,
  control,
  errors,
}: {
  name: keyof InvoiceLineFormValues;
  label: string;
  control: InvoiceLineFormControl;
  errors: Record<string, { message?: string } | undefined>;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => {
        const text = typeof value === 'string' ? value : String(value ?? '');
        const step = (delta: number) => {
          const current = Number(text);
          const base = Number.isFinite(current) ? current : 0;
          const next = Math.max(0, base + delta);
          onChange(String(next));
        };
        return (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.stepperRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                onPress={() => step(-1)}
                style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
              >
                <Feather name="minus" size={16} color={colors.text} />
              </Pressable>
              <FormField
                label=""
                value={text}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="decimal-pad"
                error={errors[name]?.message}
                testID={`field-${name}`}
                style={styles.stepperInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                onPress={() => step(1)}
                style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
              >
                <Feather name="plus" size={16} color={colors.text} />
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

/** Same as `Field`, but overlays the business's own currency symbol to match Stitch's money input — used only for `unitPrice`. */
function PriceField({
  name,
  label,
  control,
  errors,
}: {
  name: keyof InvoiceLineFormValues;
  label: string;
  control: InvoiceLineFormControl;
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

/** A unit dropdown (generic/weight/dimension/time) — its fixed choices come straight from the field catalog's `options`. */
function SelectField({
  name,
  fieldKey,
  control,
}: {
  name: keyof InvoiceLineFormValues;
  fieldKey: 'unit' | 'weightUnit' | 'lengthUnit' | 'timeUnit';
  control: InvoiceLineFormControl;
}) {
  const definition = getFieldDefinition(fieldKey);
  const kind: UnitFieldKind =
    fieldKey === 'unit' ? 'generic' : fieldKey === 'weightUnit' ? 'weight' : fieldKey === 'lengthUnit' ? 'length' : 'time';
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => (
        <UnitOptionPicker
          label={definition.label}
          kind={kind}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
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
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },

  readonlyRow: { gap: 4 },
  readonlyLabel: { fontSize: 12, color: colors.textMuted },
  readonlyValue: { fontSize: 16, fontWeight: '700', color: colors.text },

  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.75 },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: { flex: 1, textAlign: 'center' },

  priceRow: { flexDirection: 'row', alignItems: 'center' },
  priceCurrency: { position: 'absolute', left: 12, zIndex: 1, fontSize: 16, fontWeight: '700', color: colors.primary },
  priceInput: { flex: 1, paddingLeft: 24 },

  discountHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discountCaption: { fontSize: 11, color: colors.textMuted },
  discountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  discountInputWrap: { flexBasis: '100%' },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  presetChipSelected: { backgroundColor: colors.primary },
  presetChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  presetChipTextSelected: { color: colors.primaryText },

  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  previewHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewTitle: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewRowLabel: { fontSize: 12, color: colors.textMuted },
  previewRowValue: { fontSize: 12, color: colors.textMuted },
  previewGrossRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewGrossLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  previewGrossValue: { fontSize: 22, fontWeight: '700', color: colors.primary },
});
