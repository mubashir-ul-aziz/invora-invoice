import React from 'react';
import { Controller, type Control } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { OptionPicker } from '@/components/business/OptionPicker';
import { FormField } from '@/components/businessCard/FormField';
import { UnitOptionPicker } from '@/components/shared/UnitOptionPicker';
import type { InvoiceLineFormOutput, InvoiceLineFormValues } from '@/domain/invoice/validation';
import type { UnitFieldKind } from '@/domain/invoiceType/customUnits';
import { getFieldDefinition } from '@/domain/invoiceType/fieldCatalog';
import { PRICING_METHOD_OPTIONS, getInvoiceTypeDefinition, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { getFieldLabel, type InvoiceFieldConfig } from '@/domain/invoiceType/types';
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

  return (
    <>
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
      <Field name="itemName" label={`${label('itemName')} *`} control={control} errors={errors} />
      {has('description') && (
        <Field name="description" label={label('description')} control={control} errors={errors} multiline />
      )}
      {has('sku') && <Field name="sku" label={label('sku')} control={control} errors={errors} />}
      {has('quantity') && (
        <Field name="quantity" label={`${label('quantity')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
      )}
      {has('unit') && <SelectField name="unit" fieldKey="unit" control={control} />}
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
      <Field name="unitPrice" label={`${label('unitPrice')} *`} control={control} errors={errors} keyboardType="decimal-pad" />
      {has('discount') && (
        <Field
          name="discountPercent"
          label={`${label('discount')} (%)`}
          control={control}
          errors={errors}
          keyboardType="decimal-pad"
        />
      )}
      {has('tax') && (
        <Field name="taxPercent" label={`${label('tax')} (%)`} control={control} errors={errors} keyboardType="decimal-pad" />
      )}
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
  readonlyRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  readonlyLabel: { fontSize: 12, color: colors.textMuted },
  readonlyValue: { fontSize: 16, fontWeight: '700', color: colors.text },
});
