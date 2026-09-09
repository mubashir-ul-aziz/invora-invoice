import { getInvoiceTypeDefinition, type InvoiceTypeId } from './invoiceTypeRegistry';

function fmt(value: number | null): string {
  if (value == null) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * A short, method-aware description of a line's measurement — e.g. "20 m²"
 * for an AREA line, "25 kg" for a WEIGHT line, "5 hour" for TIME — used
 * anywhere a line is listed (Create Invoice Items, Review, Invoice Detail)
 * so the calculation itself is visible, not just the resulting total. Falls
 * back to a plain "quantity unit" reading for the quantity-priced methods,
 * matching the app's pre-existing row copy.
 */
export function describeLineMeasurement(
  pricingMethodId: InvoiceTypeId,
  measurements: PricingMeasurements & { unit?: string | null; weightUnit?: string | null; lengthUnit?: string | null; timeUnit?: string | null },
): string | null {
  const { calculationKind } = getInvoiceTypeDefinition(pricingMethodId);
  switch (calculationKind) {
    case 'weight':
      return measurements.weight != null ? `${fmt(measurements.weight)} ${measurements.weightUnit ?? ''}`.trim() : null;
    case 'length':
      return measurements.length != null ? `${fmt(measurements.length)} ${measurements.lengthUnit ?? ''}`.trim() : null;
    case 'area': {
      if (measurements.length == null || measurements.width == null) return null;
      const unit = measurements.lengthUnit ?? '';
      const area = derivePricingQuantity(pricingMethodId, measurements);
      return `${fmt(measurements.length)}${unit} × ${fmt(measurements.width)}${unit} (${fmt(area)} ${unit}²)`;
    }
    case 'volume': {
      if (measurements.length == null || measurements.width == null || measurements.height == null) return null;
      const unit = measurements.lengthUnit ?? '';
      const volume = derivePricingQuantity(pricingMethodId, measurements);
      return `${fmt(measurements.length)} × ${fmt(measurements.width)} × ${fmt(measurements.height)}${unit} (${fmt(volume)} ${unit}³)`;
    }
    case 'time':
      return measurements.quantity != null ? `${fmt(measurements.quantity)} ${measurements.timeUnit ?? ''}`.trim() : null;
    case 'quantityTimesPrice':
    default:
      return measurements.quantity != null ? `${fmt(measurements.quantity)}${measurements.unit ? ` ${measurements.unit}` : ''}` : null;
  }
}

/**
 * The raw measurement fields a line can carry — a superset of every pricing
 * method's inputs. `domain/invoice/calculations.ts`'s `calculateLineTotal`
 * is the only caller; this module's whole job is turning these raw inputs
 * into the single "billable quantity" that gets multiplied by unit price,
 * per the method's `calculationKind` (`invoiceTypeRegistry.ts`) — so that
 * formula lives in exactly one place instead of being re-derived inline
 * every time a screen or repository needs a line total.
 */
export interface PricingMeasurements {
  quantity: number | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
}

/**
 * quantity × unit price = subtotal (§9 of the brief). The billable quantity
 * itself is method-specific:
 *
 * - GENERAL / QUANTITY / SERVICE / CUSTOM: the quantity field (defaults to 1
 *   — a line with no quantity field at all is still exactly one of that item).
 * - WEIGHT: the weight value.
 * - LENGTH: the length value.
 * - AREA: length × width.
 * - VOLUME: length × width × height.
 * - TIME: the duration value (carried in the `quantity` field, labelled
 *   "Duration" for this method — see `fieldLabelOverrides`).
 *
 * Missing required measurements resolve to 0 (never silently to 1 for a
 * physical measurement — an AREA line with no width entered yet has no area,
 * not "1 unit" worth) so an incomplete line previews as £0 rather than a
 * misleadingly non-zero number.
 */
export function derivePricingQuantity(
  pricingMethodId: InvoiceTypeId,
  measurements: PricingMeasurements,
): number {
  const { calculationKind } = getInvoiceTypeDefinition(pricingMethodId);
  switch (calculationKind) {
    case 'weight':
      return measurements.weight ?? 0;
    case 'length':
      return measurements.length ?? 0;
    case 'area':
      return (measurements.length ?? 0) * (measurements.width ?? 0);
    case 'volume':
      return (measurements.length ?? 0) * (measurements.width ?? 0) * (measurements.height ?? 0);
    case 'time':
      return measurements.quantity ?? 0;
    case 'quantityTimesPrice':
    default:
      return measurements.quantity ?? 1;
  }
}
