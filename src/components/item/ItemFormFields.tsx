import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Controller, useController, useWatch, type Control } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OptionPicker } from '@/components/business/OptionPicker';
import { FormField } from '@/components/businessCard/FormField';
import { UnitOptionPicker } from '@/components/shared/UnitOptionPicker';
import { getFieldDefinition } from '@/domain/invoiceType/fieldCatalog';
import type { UnitFieldKind } from '@/domain/invoiceType/customUnits';
import { PRICING_METHOD_OPTIONS, getInvoiceTypeDefinition, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { getFieldLabel } from '@/domain/invoiceType/types';
import { relevantOptionalFieldsForInvoiceType } from '@/domain/item/relevantFields';
import type { ItemFormOutput, ItemFormValues } from '@/domain/item/validation';
import { DEFAULT_LENGTH_UNIT, DEFAULT_WEIGHT_UNIT } from '@/domain/invoiceType/units';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { useCurrencySymbol } from '@/state/currencyContext';
import { colors } from '@/theme/colors';

/** Matches the exact `useForm<ItemFormValues, unknown, ItemFormOutput>()` shape both screens use. */
type ItemFormControl = Control<ItemFormValues, unknown, ItemFormOutput>;

interface Props {
  control: ItemFormControl;
  errors: Record<string, { message?: string } | undefined>;
  /**
   * Set when this item is being created for a specific invoice (the
   * "+ Add item" catalog flow, via `CreateItemScreen`'s `defaultInvoiceTypeId`
   * param) — the item's Pricing Method can't be anything else, since §15
   * only lets an item onto an invoice that shares its pricing method, so it's
   * shown locked instead of as a choice. Absent (regular Create/Edit Item,
   * outside any invoice) leaves it a free editable dropdown.
   */
  lockedInvoiceTypeId?: InvoiceTypeId | null;
}

/** Matches the Stitch "Create/Edit Item" Category dropdown's fixed option list — DESIGN ONLY, see below. */
const DESIGN_ONLY_CATEGORY_OPTIONS = [
  { value: 'materials', label: 'Materials & Supplies' },
  { value: 'labor', label: 'Labor & Services' },
  { value: 'rental', label: 'Equipment Rental' },
  { value: 'hardware', label: 'Hardware' },
];

/** Matches the Stitch "Tax / VAT Rate" dropdown's fixed tiers — these presets write into the real `taxRate` field (see `TaxRateField`), they aren't decorative. */
const TAX_RATE_PRESETS = [
  { value: '20', label: 'Standard 20%' },
  { value: '5', label: 'Reduced 5%' },
  { value: '0', label: 'Zero 0%' },
  { value: '', label: 'Exempt' },
];

/**
 * The field set shared by Create Item and Edit Item — one implementation so
 * the two screens can never drift apart. Restyled into Stitch's card-based
 * "Item Identification" / "Pricing & Units" / "Pricing Method & Measurements"
 * / "Item Description" sections, but every field, `Controller`, and `testID`
 * below is unchanged from before the restyle — existing screen tests
 * (`CreateItemScreen.*.test.tsx`, `EditItemScreen.*.test.tsx`) assert on
 * `field-name`, `field-defaultPrice`, `field-sku`, `field-invoiceTypeId`
 * (+ its `-weight`/`-volume` chip variants), `field-weight`, `field-weightUnit`,
 * `field-length`, `field-width`, `field-height`, `field-lengthUnit` and must
 * keep working.
 *
 * Which of Weight/Length/Width/Height/their unit dropdowns are shown is
 * driven by the selected Pricing Method (reusing
 * `relevantOptionalFieldsForInvoiceType`), and for "Custom" additionally by
 * the business's own custom field selection. The price field's label follows
 * the method too (e.g. "Price per weight unit" for Weight) via
 * `getFieldLabel`, instead of a single generic "Default price" that doesn't
 * say what it's a price *of*.
 *
 * Two Stitch elements have no backing field on `Item`/the `item` table and
 * are DESIGN ONLY (rendered, interactive where harmless, never submitted):
 * - The Category dropdown (Materials/Labor/Rental/Hardware) — `Item` has no
 *   category column; this app's real categorization axis is Pricing Method
 *   (`invoiceTypeId`), which is a real, fully-wired field below instead.
 * - The barcode-scan button next to SKU — no camera/barcode-scanning
 *   integration exists. The SKU text field itself is real and submitted.
 *
 * The Tax/VAT preset chips are NOT design-only — they're a convenience that
 * writes straight into the real `taxRate` field (same one the freeform input
 * below it edits), matching Stitch's fixed-tier dropdown without faking a
 * separate concept.
 */
export function ItemFormFields({ control, errors, lockedInvoiceTypeId }: Props) {
  const invoiceTypeId = useWatch({ control, name: 'invoiceTypeId' });
  const { selection, load: loadInvoiceType } = useInvoiceTypeStore();
  const [designOnlyCategory, setDesignOnlyCategory] = useState('materials');
  const [scannedSku, setScannedSku] = useState(false);

  useEffect(() => {
    loadInvoiceType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const relevantFields = relevantOptionalFieldsForInvoiceType(
    invoiceTypeId,
    invoiceTypeId === 'custom' ? selection?.customFieldKeys : undefined,
  );

  const hasMeasurementFields =
    relevantFields.includes('weight') ||
    relevantFields.includes('length') ||
    relevantFields.includes('width') ||
    relevantFields.includes('height');

  return (
    <>
      {/* SECTION 1: Item Identification & Details */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Feather name="tag" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Item Identification</Text>
          </View>
          <Text style={styles.cardHeaderCaption}>Core Info</Text>
        </View>

        <Field name="name" label="Item Name *" control={control} errors={errors} placeholder="e.g. Oak Timber Batten 45x70mm" />

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>SKU / Barcode</Text>
          <View style={styles.skuRow}>
            <Controller
              control={control}
              name="sku"
              render={({ field: { value, onChange, onBlur } }) => (
                <FormField
                  value={typeof value === 'string' ? value : ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="e.g. WOD-8821"
                  error={errors.sku?.message}
                  testID="field-sku"
                  style={styles.skuInput}
                  label=""
                />
              )}
            />
            {/* DESIGN ONLY: no camera/barcode-scanning integration exists — this button is decorative, the SKU field itself is real and submitted. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan barcode — DESIGN ONLY, camera scanning not supported"
              testID="field-sku-scan-design-only"
              onPress={() => setScannedSku(true)}
              style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
            >
              <Feather name="camera" size={17} color={colors.textMuted} />
            </Pressable>
          </View>
          {scannedSku && <Text style={styles.designOnlyInline}>DESIGN ONLY — scanning is not connected to a camera</Text>}
        </View>

        {/* DESIGN ONLY: `Item` has no category column — this app's real categorization axis is Pricing Method, below. */}
        <View accessibilityLabel="Category — DESIGN ONLY, no such field exists on Item">
          <OptionPicker
            label="Category · DESIGN ONLY"
            options={DESIGN_ONLY_CATEGORY_OPTIONS}
            value={designOnlyCategory}
            onChange={setDesignOnlyCategory}
            testID="field-category-design-only"
          />
        </View>
      </View>

      {/* SECTION 2: Pricing & Units */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Feather name="dollar-sign" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Pricing &amp; Units</Text>
          </View>
        </View>

        <PriceField
          name="defaultPrice"
          label={`${getFieldLabel(invoiceTypeId, 'unitPrice')} *`}
          control={control}
          errors={errors}
        />

        <SelectField name="unit" fieldKey="unit" control={control} />

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tax / VAT Rate</Text>
          <View style={styles.taxPresetRow}>
            {TAX_RATE_PRESETS.map((preset) => (
              <TaxPresetChip key={preset.label} preset={preset} control={control} />
            ))}
          </View>
          <Field name="taxRate" label="" control={control} errors={errors} keyboardType="decimal-pad" placeholder="Custom rate (%)" />
        </View>
      </View>

      {/* SECTION 3: Pricing Method (real "invoice type") & Extended Measurement */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Feather name="sliders" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Pricing Method</Text>
          </View>
          {hasMeasurementFields && <Text style={styles.cardHeaderCaption}>Custom Calc</Text>}
        </View>

        {lockedInvoiceTypeId ? (
          <View style={styles.banner} testID="field-invoiceTypeId-readonly">
            <Feather name="maximize" size={18} color={colors.primary} />
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerLabel}>Locked to this invoice's pricing method</Text>
              <Text style={styles.bannerValue}>{getInvoiceTypeDefinition(lockedInvoiceTypeId).label}</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.banner}>
              <Feather name="maximize" size={18} color={colors.primary} />
              <View style={styles.bannerTextCol}>
                <Text style={styles.bannerLabel}>Active Pricing Method</Text>
                <Text style={styles.bannerValue}>{getInvoiceTypeDefinition(invoiceTypeId).label}</Text>
              </View>
            </View>
            <Controller
              control={control}
              name="invoiceTypeId"
              render={({ field: { value, onChange } }) => (
                <OptionPicker
                  label="Change pricing method"
                  options={PRICING_METHOD_OPTIONS}
                  value={value}
                  onChange={onChange}
                  testID="field-invoiceTypeId"
                />
              )}
            />
          </>
        )}

        {relevantFields.includes('weight') && (
          <Field
            name="weight"
            label={`${getFieldLabel(invoiceTypeId, 'weight')} *`}
            control={control}
            errors={errors}
            keyboardType="decimal-pad"
          />
        )}
        {relevantFields.includes('weightUnit') && (
          <SelectField name="weightUnit" fieldKey="weightUnit" control={control} defaultUnit={DEFAULT_WEIGHT_UNIT} />
        )}
        {relevantFields.includes('length') && (
          <Field
            name="length"
            label={`${getFieldLabel(invoiceTypeId, 'length')} *`}
            control={control}
            errors={errors}
            keyboardType="decimal-pad"
          />
        )}
        {relevantFields.includes('width') && (
          <Field
            name="width"
            label={`${getFieldLabel(invoiceTypeId, 'width')} *`}
            control={control}
            errors={errors}
            keyboardType="decimal-pad"
          />
        )}
        {relevantFields.includes('height') && (
          <Field
            name="height"
            label={`${getFieldLabel(invoiceTypeId, 'height')} *`}
            control={control}
            errors={errors}
            keyboardType="decimal-pad"
          />
        )}
        {relevantFields.includes('lengthUnit') && (
          <SelectField name="lengthUnit" fieldKey="lengthUnit" control={control} defaultUnit={DEFAULT_LENGTH_UNIT} />
        )}
      </View>

      {/* SECTION 4: Item Description */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Feather name="align-left" size={16} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Item Description</Text>
          </View>
          <Text style={styles.cardHeaderCaption}>Optional</Text>
        </View>
        <Field name="description" label="" control={control} errors={errors} multiline numberOfLines={3} placeholder="Detailed item specifications, warranty notes, or billing notes printed on customer invoices..." />
      </View>
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
  name: keyof ItemFormValues;
  label: string;
  control: ItemFormControl;
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

/** Same as `Field`, but overlays the business's own currency symbol to match Stitch's money input — used only for `defaultPrice`. */
function PriceField({
  name,
  label,
  control,
  errors,
}: {
  name: keyof ItemFormValues;
  label: string;
  control: ItemFormControl;
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

/** One Tax/VAT preset chip — writes its value straight into the real `taxRate` field on press. */
function TaxPresetChip({
  preset,
  control,
}: {
  preset: { value: string; label: string };
  control: ItemFormControl;
}) {
  const { field } = useController({ control, name: 'taxRate' });
  const currentValue = typeof field.value === 'string' ? field.value : '';
  const selected = currentValue === preset.value;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={preset.label}
      accessibilityState={{ selected }}
      onPress={() => field.onChange(preset.value)}
      style={({ pressed }) => [styles.taxChip, selected && styles.taxChipSelected, pressed && !selected && styles.pressed]}
    >
      <Text style={[styles.taxChipLabel, selected && styles.taxChipLabelSelected]}>{preset.label}</Text>
    </Pressable>
  );
}

/**
 * A unit dropdown (generic/weight/dimension) for the item's own default
 * unit — its choices come straight from the field catalog. When `defaultUnit`
 * is given (weight/dimension only — the generic `unit` field has no natural
 * default), auto-fills it the moment this field becomes relevant (i.e. its
 * value is still blank, which is true for a brand-new item, or one that just
 * switched into a pricing method that needs a unit it didn't have before) so
 * the picker is never shown with nothing selected and the stored value
 * silently null.
 */
function SelectField({
  name,
  fieldKey,
  control,
  defaultUnit,
}: {
  name: keyof ItemFormValues;
  fieldKey: 'unit' | 'weightUnit' | 'lengthUnit';
  control: ItemFormControl;
  defaultUnit?: string;
}) {
  const definition = getFieldDefinition(fieldKey);
  const { field } = useController({ control, name });
  const value = typeof field.value === 'string' ? field.value : '';

  useEffect(() => {
    if (!value && defaultUnit) {
      field.onChange(defaultUnit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const kind: UnitFieldKind = fieldKey === 'unit' ? 'generic' : fieldKey === 'weightUnit' ? 'weight' : 'length';

  return (
    <UnitOptionPicker
      label={fieldKey === 'unit' ? 'Billing Unit' : definition.label}
      kind={kind}
      value={value}
      onChange={field.onChange}
      testID={`field-${name}`}
    />
  );
}

const styles = StyleSheet.create({
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
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.75 },

  skuRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  skuInput: { flex: 1 },
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  designOnlyInline: { fontSize: 10, fontWeight: '700', color: colors.textMuted },

  priceRow: { flexDirection: 'row', alignItems: 'center' },
  priceCurrency: { position: 'absolute', left: 12, zIndex: 1, fontSize: 18, fontWeight: '700', color: colors.primary },
  priceInput: { flex: 1, paddingLeft: 26, fontSize: 18, fontWeight: '700' },

  taxPresetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  taxChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  taxChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  taxChipLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
  taxChipLabelSelected: { color: colors.primaryText },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  bannerTextCol: { flex: 1, gap: 1 },
  bannerLabel: { fontSize: 11, color: colors.textMuted },
  bannerValue: { fontSize: 14, fontWeight: '700', color: colors.text },
});
