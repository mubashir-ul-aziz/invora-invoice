/**
 * WhatsApp-style "Today / Yesterday / date" grouping, shared by the Customer
 * List and Invoice List screens (see `components/shared/DateSectionHeader`
 * for the centered pill that renders the label this produces).
 *
 * Both screens already sort their rows newest-first by the same date this
 * groups on (`sortCustomers` by `createdAt`, `sortInvoices` by `issueDate`),
 * so consecutive rows sharing a calendar day collapse into one section.
 */

/** Calendar-day label for an ISO date/datetime string, relative to `now`. */
export function dateSectionLabel(isoDateOrDateTime: string, now: Date = new Date()): string {
  const date = new Date(isoDateOrDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateOrDateTime;
  }

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric',
  });
}

export interface DateSection<T> {
  /** "Today" / "Yesterday" / a formatted date — see `dateSectionLabel`. */
  title: string;
  data: T[];
}

/**
 * Groups an already date-sorted list into contiguous same-day sections. Only
 * merges *consecutive* items — callers are responsible for sorting by the
 * same date `getIsoDate` reads, or a single day's items can split across
 * multiple sections.
 */
export function groupByDateSection<T>(
  items: T[],
  getIsoDate: (item: T) => string,
  now: Date = new Date(),
): DateSection<T>[] {
  const sections: DateSection<T>[] = [];

  for (const item of items) {
    const title = dateSectionLabel(getIsoDate(item), now);
    const lastSection = sections[sections.length - 1];
    if (lastSection && lastSection.title === title) {
      lastSection.data.push(item);
    } else {
      sections.push({ title, data: [item] });
    }
  }

  return sections;
}
