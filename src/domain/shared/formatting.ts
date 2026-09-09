/**
 * Human-readable "created at" formatting shared by the Invoice/Customer
 * list rows and detail screens. Unlike `dateSectionLabel` (a relative
 * "Today"/"Yesterday" label for grouping), this always renders an absolute
 * local date + time, since "Created" is a record of *when* something
 * happened rather than a section heading.
 */
export function formatTimestamp(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
