import { Alert, Linking } from 'react-native';

import { normalizePhoneDigits, normalizeUrl } from '@/domain/businessCard/validation';

/**
 * Thin wrapper around `react-native`'s `Linking` so screens never call the
 * native module directly and tests can inject a fake. Every function
 * resolves to `true`/`false` (whether the target app/handler was opened)
 * instead of throwing, and shows a friendly alert on failure.
 */
export interface LinkingClient {
  canOpenURL(url: string): Promise<boolean>;
  openURL(url: string): Promise<unknown>;
}

const defaultClient: LinkingClient = Linking;

async function open(
  url: string,
  failureMessage: string,
  client: LinkingClient = defaultClient,
): Promise<boolean> {
  try {
    const canOpen = await client.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Unable to open', failureMessage);
      return false;
    }
    await client.openURL(url);
    return true;
  } catch {
    Alert.alert('Unable to open', failureMessage);
    return false;
  }
}

export function openPhone(phone: string, client?: LinkingClient): Promise<boolean> {
  return open(`tel:${normalizePhoneDigits(phone)}`, 'This device cannot place phone calls.', client);
}

export function openEmail(
  email: string,
  options?: { subject?: string; body?: string },
  client?: LinkingClient,
): Promise<boolean> {
  const params = new URLSearchParams();
  if (options?.subject) params.set('subject', options.subject);
  if (options?.body) params.set('body', options.body);
  const query = params.toString();
  return open(
    `mailto:${email}${query ? `?${query}` : ''}`,
    'No email app is available on this device.',
    client,
  );
}

export function openWebsite(url: string, client?: LinkingClient): Promise<boolean> {
  return open(normalizeUrl(url), 'This link could not be opened.', client);
}

export function openWhatsApp(
  phone: string,
  message?: string,
  client: LinkingClient = defaultClient,
): Promise<boolean> {
  const digits = normalizePhoneDigits(phone).replace(/^\+/, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return open(`https://wa.me/${digits}${text}`, 'WhatsApp is not available on this device.', client);
}

/** Opens WhatsApp's compose UI pre-filled with `message`, with no fixed recipient — for "share this via WhatsApp" actions, as opposed to `openWhatsApp` (which messages one specific business phone number). */
export function shareViaWhatsApp(message: string, client?: LinkingClient): Promise<boolean> {
  return open(
    `https://wa.me/?text=${encodeURIComponent(message)}`,
    'WhatsApp is not available on this device.',
    client,
  );
}

/** Opens the device's SMS/iMessage composer pre-filled with `message`, with no fixed recipient. */
export function openSms(message: string, client?: LinkingClient): Promise<boolean> {
  return open(`sms:?&body=${encodeURIComponent(message)}`, 'Messaging is not available on this device.', client);
}

export function openFacebook(url: string, client?: LinkingClient): Promise<boolean> {
  return open(normalizeUrl(url), 'Facebook could not be opened.', client);
}

export function openInstagram(url: string, client?: LinkingClient): Promise<boolean> {
  return open(normalizeUrl(url), 'Instagram could not be opened.', client);
}

export function openGoogleMaps(
  args: { address?: string | null; mapsUrl?: string | null },
  client?: LinkingClient,
): Promise<boolean> {
  const target =
    args.mapsUrl?.trim() ||
    (args.address?.trim()
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(args.address.trim())}`
      : null);
  if (!target) {
    Alert.alert('No address set', 'Add an address or a Google Maps link to this card first.');
    return Promise.resolve(false);
  }
  return open(target, 'Google Maps could not be opened.', client);
}
